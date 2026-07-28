import { bedrockConfig } from '../config/bedrock.js';
import { invokeBedrockModel, parseNovaTextResponse } from './bedrockClient.js';
import { buildExecutiveSummary, polishSummary } from '../utils/summaryFormat.js';

const EXTRACTION_PROMPT = `You are OpsRelay, an AI incident-response system for on-call SRE teams.

Parse the shift handoff notes into structured JSON. Write in a clear, professional tone suitable for executive handoff and post-incident documentation.

Return ONLY valid JSON with this exact shape (no markdown fences):
{
  "severity": "SEV-0" | "SEV-1" | "SEV-2" | "SEV-3",
  "severityReason": "One complete sentence explaining why this severity was assigned, citing evidence from the logs.",
  "service": "string (kebab-case service name)",
  "component": "string (affected component or subsystem)",
  "summary": "Executive summary: exactly 2-3 complete sentences. (1) What service is affected and what symptom occurred. (2) User or business impact. (3) Current status or immediate concern. Do NOT paste raw logs. Use professional prose.",
  "confidenceScore": number (85-99),
  "timeline": [{ "timestamp": "HH:MM", "title": "string", "description": "string (clear, factual, one sentence)", "actor": "OpsRelay AI" | "SRE Team" | "PagerDuty" | "System Monitor" | "K8s Cluster", "type": "alert" | "action" | "decision" | "fix" | "detection" }],
  "decisions": [{ "title": "string", "description": "string", "madeBy": "string", "timestamp": "HH:MM", "impact": "string" }],
  "tasks": [{ "title": "string (action-oriented)", "assignee": "Unassigned (Ops Team)", "status": "TODO", "priority": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW", "severity": "SEV-0" | "SEV-1" | "SEV-2" | "SEV-3", "createdAt": "ISO8601" }],
  "suggestedFixes": ["string (specific remediation steps)"]
}

Severity guide: SEV-0=full outage, SEV-1=major degradation, SEV-2=moderate partial impact, SEV-3=minor/low impact.

Shift handoff notes:
`;

const AGENT_PROMPT = `You are OpsRelay, an incident response assistant for on-call SRE teams.

Write in a clear, professional tone appropriate for shift handoff documentation. Use complete sentences. Be direct and actionable. Avoid vague advice.

Structure your response with these exact markdown headings:

## Situation Summary
If activeIncident is present in context, lead with that incident's ID, title, severity, status, and summary. Do not say the incident is missing when activeIncident is provided.

2-3 sentences: affected service, observed symptoms, and current user or business impact.

## Prior Incident Context
Reference ONLY incident IDs provided in context. For each relevant match, state the ID, why it is relevant, and what remediation worked.

## Recommended Actions
Numbered list of specific immediate steps the on-call engineer should take.

## Follow-up Tasks
Bullet list of tasks to track after initial mitigation.

Rules:
- Do not invent incident IDs not present in context
- Prefer concrete commands, dashboards, or config changes over generic guidance
- Keep the response focused and scannable (under 450 words unless necessary)
`;

function parseJsonFromLlm(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(candidate);
}

export async function extractIncidentFromNotes(rawNotes: string): Promise<unknown> {
  const result = (await invokeBedrockModel(bedrockConfig.llmModel, {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 4096,
    temperature: 0.2,
    messages: [
      {
        role: 'user',
        content: EXTRACTION_PROMPT + rawNotes,
      },
    ],
  })) as { content?: Array<{ type: string; text?: string }> };

  const text = result.content?.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('Bedrock returned empty extraction response');

  const parsed = parseJsonFromLlm(text) as Record<string, unknown>;
  const now = new Date().toISOString();

  const service = String(parsed.service ?? 'unknown-service');
  const component = String(parsed.component ?? 'unknown-component');
  const severity = String(parsed.severity ?? 'SEV-2');
  const fallbackSummary = buildExecutiveSummary({
    service,
    component,
    severity,
    rawNotes,
  });

  parsed.summary = polishSummary(parsed.summary, fallbackSummary);

  if (typeof parsed.severityReason === 'string') {
    parsed.severityReason = parsed.severityReason.trim();
  }

  if (Array.isArray(parsed.tasks)) {
    parsed.tasks = parsed.tasks.map((t: Record<string, unknown>) => ({
      ...t,
      createdAt: t.createdAt ?? now,
      assignee: t.assignee ?? 'Unassigned (Ops Team)',
      status: t.status ?? 'TODO',
    }));
  }

  return parsed;
}

export async function generateAgentResponse(
  userQuery: string,
  context: {
    similarIncidents: Array<{
      id: string;
      title: string;
      service: string;
      summary: string;
      similarityScore: number;
      keyTakeaway: string;
    }>;
    activeIncident?: Record<string, unknown> | null;
  },
): Promise<string> {
  const contextBlock = JSON.stringify(context, null, 2);

  const result = await invokeBedrockModel(bedrockConfig.agentModel, {
    system: [{ text: AGENT_PROMPT }],
    messages: [
      {
        role: 'user',
        content: [
          {
            text: `Context (similar incidents + active incident):\n${contextBlock}\n\nEngineer question:\n${userQuery}`,
          },
        ],
      },
    ],
    inferenceConfig: {
      maxTokens: 2048,
      temperature: 0.3,
    },
  });

  return parseNovaTextResponse(result);
}

export async function testBedrockConnection(): Promise<{
  llm: boolean;
  agent: boolean;
  embed: boolean;
  error?: string;
}> {
  let llm = false;
  let agent = false;
  let embed = false;
  const errors: string[] = [];

  try {
    await invokeBedrockModel(bedrockConfig.llmModel, {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 32,
      messages: [{ role: 'user', content: 'Reply with OK only.' }],
    });
    llm = true;
  } catch (err) {
    errors.push(`Haiku: ${err instanceof Error ? err.message : 'failed'}`);
  }

  try {
    await invokeBedrockModel(bedrockConfig.agentModel, {
      messages: [{ role: 'user', content: [{ text: 'Reply with OK only.' }] }],
      inferenceConfig: { maxTokens: 32 },
    });
    agent = true;
  } catch (err) {
    errors.push(`Nova: ${err instanceof Error ? err.message : 'failed'}`);
  }

  try {
    const { embedText } = await import('./embedService.js');
    await embedText('connection test');
    embed = true;
  } catch (err) {
    errors.push(`Embed: ${err instanceof Error ? err.message : 'failed'}`);
  }

  if (llm && agent && embed) {
    return { llm, agent, embed };
  }

  return {
    llm,
    agent,
    embed,
    error: errors.join('; ') || 'Bedrock connection failed',
  };
}
