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

const COMMANDER_PROMPT = `You are OpsRelay Incident Commander, an autonomous AI that triages critical production incidents.

Given incident details, similar past incidents, and ranked on-call experts, produce structured JSON ONLY (no markdown fences):
{
  "impactAssessment": "2 sentences on user/business impact",
  "technologies": ["tech1", "tech2"],
  "affectedServices": ["service names"],
  "investigationTasks": [
    { "title": "action-oriented task", "priority": "CRITICAL"|"HIGH"|"MEDIUM", "rationale": "why this task" }
  ],
  "recommendedActions": ["specific immediate steps"],
  "confidenceScore": number (70-98),
  "reasoningSummary": "1-2 sentences explaining the recommendation confidence"
}`;

export interface CommanderAnalysisInput {
  incident: Record<string, unknown>;
  similarIncidents: Array<{
    id: string;
    title: string;
    service: string;
    similarityScore: number;
    keyTakeaway: string;
  }>;
  expertCandidates: Array<{
    name: string;
    memberId: string;
    score: number;
    skills: string[];
    factors: Record<string, unknown>;
  }>;
}

export interface CommanderAnalysisResult {
  impactAssessment: string;
  technologies: string[];
  affectedServices: string[];
  investigationTasks: Array<{ title: string; priority: string; rationale: string }>;
  recommendedActions: string[];
  confidenceScore: number;
  reasoningSummary: string;
}

export async function generateCommanderAnalysis(
  input: CommanderAnalysisInput,
): Promise<CommanderAnalysisResult> {
  const contextBlock = JSON.stringify(input, null, 2);

  try {
    const result = await invokeBedrockModel(bedrockConfig.agentModel, {
      system: [{ text: COMMANDER_PROMPT }],
      messages: [
        {
          role: 'user',
          content: [{ text: `Incident commander context:\n${contextBlock}` }],
        },
      ],
      inferenceConfig: { maxTokens: 2048, temperature: 0.2 },
    });

    const text = parseNovaTextResponse(result);
    const parsed = parseJsonFromLlm(text) as CommanderAnalysisResult;
    return {
      impactAssessment: String(parsed.impactAssessment ?? 'Critical incident under investigation.'),
      technologies: Array.isArray(parsed.technologies) ? parsed.technologies.map(String) : [],
      affectedServices: Array.isArray(parsed.affectedServices) ? parsed.affectedServices.map(String) : [],
      investigationTasks: Array.isArray(parsed.investigationTasks)
        ? parsed.investigationTasks.map((t) => ({
            title: String((t as { title?: string }).title ?? 'Investigate root cause'),
            priority: String((t as { priority?: string }).priority ?? 'HIGH'),
            rationale: String((t as { rationale?: string }).rationale ?? 'Standard triage'),
          }))
        : [],
      recommendedActions: Array.isArray(parsed.recommendedActions)
        ? parsed.recommendedActions.map(String)
        : [],
      confidenceScore: Number(parsed.confidenceScore) || 82,
      reasoningSummary: String(parsed.reasoningSummary ?? 'Based on vector memory and expert ranking.'),
    };
  } catch {
    const inc = input.incident;
    return {
      impactAssessment: `${inc.severity} incident on ${inc.service} requires immediate investigation.`,
      technologies: inferTechnologies(String(inc.summary ?? '')),
      affectedServices: [String(inc.service ?? 'unknown')],
      investigationTasks: [
        {
          title: `Verify ${inc.service} health metrics and error rates`,
          priority: 'CRITICAL',
          rationale: 'Baseline service health check',
        },
        {
          title: 'Review recent deploys and config changes',
          priority: 'HIGH',
          rationale: 'Common root cause for production incidents',
        },
        {
          title: `Compare with ${input.similarIncidents[0]?.id ?? 'prior'} remediation steps`,
          priority: 'HIGH',
          rationale: `Vector match ${input.similarIncidents[0]?.similarityScore ?? 0}%`,
        },
      ],
      recommendedActions: input.similarIncidents[0]?.keyTakeaway
        ? [input.similarIncidents[0].keyTakeaway]
        : ['Confirm blast radius and notify stakeholders'],
      confidenceScore: input.similarIncidents[0]?.similarityScore ?? 75,
      reasoningSummary: 'Local fallback analysis from vector matches and expert scores.',
    };
  }
}

function inferTechnologies(text: string): string[] {
  const lower = text.toLowerCase();
  const techs: string[] = [];
  const map: Record<string, string> = {
    cockroach: 'CockroachDB',
    postgres: 'PostgreSQL',
    kubernetes: 'Kubernetes',
    k8s: 'Kubernetes',
    redis: 'Redis',
    kafka: 'Kafka',
    aws: 'AWS',
    bedrock: 'AWS Bedrock',
    nginx: 'Nginx',
    node: 'Node.js',
  };
  for (const [key, label] of Object.entries(map)) {
    if (lower.includes(key)) techs.push(label);
  }
  return techs.length > 0 ? techs : ['Distributed systems'];
}

export async function generateHandoffSummary(context: {
  incident: Record<string, unknown>;
  replayEvents: Array<{ title: string; description?: string; eventType: string }>;
  decisions: Array<{ title: string; confidence: number }>;
  primaryExpert?: string;
}): Promise<string> {
  const contextBlock = JSON.stringify(context, null, 2);

  try {
    const result = await invokeBedrockModel(bedrockConfig.agentModel, {
      messages: [
        {
          role: 'user',
          content: [{
            text: `Write a concise shift handoff summary (4-6 bullet points) for this resolved incident. Include root cause if known, actions taken, and follow-ups.\n\n${contextBlock}`,
          }],
        },
      ],
      inferenceConfig: { maxTokens: 1024, temperature: 0.3 },
    });
    return parseNovaTextResponse(result);
  } catch {
    const inc = context.incident;
    return [
      `**${inc.id}** (${inc.severity}) — ${inc.title}`,
      `Service: ${inc.service}. Status: ${inc.status}.`,
      context.primaryExpert ? `Lead: ${context.primaryExpert}.` : '',
      `${context.replayEvents.length} commander events tracked.`,
      `${context.decisions.length} AI decisions logged with confidence scoring.`,
    ].filter(Boolean).join('\n');
  }
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
