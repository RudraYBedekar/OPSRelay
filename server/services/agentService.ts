import { query, queryOne } from '../db.js';
import { isBedrockConfigured } from '../config/bedrock.js';
import { generateAgentResponse } from './llmService.js';
import { getEmbedMode } from './embedService.js';
import type { AuthUser } from './authService.js';
import { canViewIncident, filterIncidentsForUser, getGrantedOwnerMemberIds } from './incidentAccessService.js';
import { isAuthEnabled } from '../config/auth.js';
import {
  searchSimilarIncidents,
  searchIncidentsInCorpus,
  mergeSearchHits,
  keywordSearchFallback,
  getEmbeddingCount,
  type IncidentRecord,
} from './vectorService.js';

export interface AgentStep {
  step: number;
  action: string;
  detail: string;
  status: 'done' | 'skipped';
}

export interface SuggestedTask {
  title: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  rationale: string;
}

export interface AgentResult {
  answer: string;
  similarIncidents: Array<{
    id: string;
    title: string;
    service: string;
    summary: string;
    similarityScore: number;
    keyTakeaway: string;
    severity?: string;
    status?: string;
  }>;
  steps: AgentStep[];
  suggestedTasks: SuggestedTask[];
  mode: 'bedrock' | 'local' | 'keyword';
  embeddingCount: number;
  triage?: {
    suggestedSeverity: string;
    suggestedService: string;
    confidence: number;
  };
}

function buildLocalAgentAnswer(
  queryText: string,
  similar: AgentResult['similarIncidents'],
  activeIncident: (IncidentRecord & { severity?: string; status?: string }) | null,
  embedMode: string,
): string {
  const top = similar[0];

  let text = `## Situation Summary\n\n`;
  text += `The on-call engineer asked: "${queryText}". `;
  if (activeIncident) {
    text += `**${activeIncident.id}** (${activeIncident.severity}) — **${activeIncident.title}** affects **${activeIncident.service}** and is **${activeIncident.status}**. `;
    text += `${activeIncident.summary ?? ''}\n\n`;
  } else if (similar[0]) {
    text += `Vector search returned **${similar.length}** relevant prior incident${similar.length === 1 ? '' : 's'} from the OpsRelay knowledge base.\n\n`;
  } else {
    text += `No matching incident was found in the database.\n\n`;
  }

  text += `## Prior Incident Context\n\n`;
  if (similar.length === 0) {
    text += `No strong historical matches were found. Proceed with standard triage: confirm metrics, check recent deploys, and document findings.\n\n`;
  } else {
    for (const m of similar) {
      text += `- **${m.id}** (${m.similarityScore}% relevance) — ${m.title}. `;
      text += `Prior remediation: ${m.keyTakeaway}\n`;
    }
    text += `\n`;
  }

  text += `## Recommended Actions\n\n`;
  text += `1. Review **${top?.id ?? 'similar incidents'}** for proven mitigations and timeline patterns.\n`;
  text += `2. Inspect **${top?.service ?? 'affected service'}** dashboards (error rate, latency, connection pools).\n`;
  text += `3. Confirm blast radius and communicate status to stakeholders if user impact is confirmed.\n`;
  text += `4. Log decisions and timeline updates in OpsRelay for shift handoff.\n\n`;

  text += `## Follow-up Tasks\n\n`;
  text += `- Create action items for any configuration or code changes identified during triage\n`;
  text += `- Schedule post-incident review if severity is SEV-0 or SEV-1\n`;
  text += `- Enable AWS Bedrock for full Nova-powered agent reasoning (current mode: ${embedMode})\n`;

  return text;
}

function inferTriage(queryText: string, similar: AgentResult['similarIncidents']) {
  const lower = queryText.toLowerCase();
  let severity = similar[0]?.severity ?? 'SEV-2';
  if (lower.includes('oom') || lower.includes('outage') || lower.includes('down')) severity = 'SEV-0';
  else if (lower.includes('429') || lower.includes('500') || lower.includes('pool')) severity = 'SEV-1';

  const service = similar[0]?.service ?? 'unknown-service';
  return { suggestedSeverity: severity, suggestedService: service, confidence: similar[0]?.similarityScore ?? 70 };
}

function buildSuggestedTasks(queryText: string, similar: AgentResult['similarIncidents']): SuggestedTask[] {
  const top = similar[0];
  const tasks: SuggestedTask[] = [
    {
      title: `Review runbook for ${top?.service ?? 'affected service'}`,
      priority: 'HIGH',
      rationale: `Vector match ${top?.similarityScore ?? 0}% with ${top?.id ?? 'past incident'}`,
    },
    {
      title: 'Document timeline and decisions in OpsRelay',
      priority: 'MEDIUM',
      rationale: 'Shift handoff continuity',
    },
  ];

  if (queryText.toLowerCase().includes('cockroach') || queryText.toLowerCase().includes('db')) {
    tasks.unshift({
      title: 'Check CockroachDB connection pool and replica lag metrics',
      priority: 'CRITICAL',
      rationale: 'Query mentions database symptoms',
    });
  }

  return tasks.slice(0, 4);
}

/** Extract incident ID from natural language queries like "INC-8958 check this incident" */
export function extractIncidentId(text: string): string | null {
  const match = text.match(/\bINC-\d+\b/i);
  return match ? match[0].toUpperCase() : null;
}

function incidentToMatch(
  inc: IncidentRecord & { severity?: string; status?: string; title?: string; fixesApplied?: string[] },
  similarityScore: number,
) {
  return {
    id: inc.id,
    title: inc.title,
    service: inc.service,
    summary: inc.summary,
    similarityScore,
    keyTakeaway: inc.fixesApplied?.[0] ?? inc.summary.slice(0, 120),
    severity: inc.severity,
    status: inc.status,
  };
}

export async function runAgent(queryText: string, incidentId?: string, viewer?: AuthUser): Promise<AgentResult> {
  const steps: AgentStep[] = [];
  const embeddingCount = await getEmbeddingCount();

  steps.push({
    step: 1,
    action: 'Load incident corpus',
    detail: viewer
      ? `Fetching incidents visible to ${viewer.memberId}`
      : 'Fetching incidents from CockroachDB Rudra database',
    status: 'done',
  });

  const incidentRows = await query<{ data: IncidentRecord & { severity?: string; status?: string; ownerMemberId?: string; sharedWithMemberIds?: string[] } }>(
    'SELECT data FROM incidents ORDER BY updated_at DESC',
  );
  const allIncidents = incidentRows.map((r) => r.data);
  const incidents = isAuthEnabled() && viewer
    ? await filterIncidentsForUser(allIncidents, viewer)
    : allIncidents;
  const visibleIds = new Set(incidents.map((i) => i.id));
  const granted = viewer && isAuthEnabled()
    ? new Set(await getGrantedOwnerMemberIds(viewer.memberId))
    : new Set<string>();

  const corpusHits = searchIncidentsInCorpus(queryText, incidents, 8);
  const queriedIncidentId = incidentId ?? extractIncidentId(queryText);

  let hits;
  let mode: AgentResult['mode'] = 'keyword';

  steps.push({
    step: 2,
    action: 'Embed query vector',
    detail: `Using ${getEmbedMode()} embeddings (${embeddingCount} indexed chunks)`,
    status: 'done',
  });

  if (embeddingCount > 0) {
    try {
      const vectorHits = (await searchSimilarIncidents(queryText, 8, undefined, {
        allowedIncidentIds: visibleIds,
        excludeIncidentId: queriedIncidentId ?? undefined,
      }));
      hits = mergeSearchHits(corpusHits, vectorHits).slice(0, 5);
      mode = getEmbedMode() === 'bedrock' ? 'bedrock' : 'local';
    } catch {
      hits = corpusHits.length > 0 ? corpusHits : keywordSearchFallback(queryText, incidents, 5);
      mode = 'keyword';
    }
  } else {
    hits = corpusHits.length > 0 ? corpusHits : keywordSearchFallback(queryText, incidents, 5);
    steps.push({
      step: 2,
      action: 'Vector index empty',
      detail: 'Using full incident corpus text search. Run npm run db:embed for vector boost.',
      status: 'skipped',
    });
    mode = 'keyword';
  }

  if (corpusHits.length > 0) {
    steps.push({
      step: 3,
      action: 'Corpus incident search',
      detail: `Matched ${corpusHits.length} incident(s) by ID, title, or service in database`,
      status: 'done',
    });
  }

  steps.push({
    step: 4,
    action: 'Vector + corpus ranking',
    detail: `Top ${hits.length} incident(s) selected for agent context`,
    status: 'done',
  });

  const similarIncidents = hits.map((hit) => {
    const inc = incidents.find((i) => i.id === hit.incidentId);
    return incidentToMatch(
      {
        id: hit.incidentId,
        title: inc?.title ?? hit.incidentId,
        service: hit.service,
        summary: inc?.summary ?? hit.content.slice(0, 200),
        fixesApplied: inc?.fixesApplied,
        severity: inc?.severity ?? 'SEV-2',
        status: inc?.status,
      },
      hit.similarityScore,
    );
  });

  let activeIncident: (IncidentRecord & { severity?: string; status?: string; title?: string }) | null = null;

  if (queriedIncidentId) {
    const fromList = incidents.find((i) => i.id === queriedIncidentId);
    if (fromList) {
      activeIncident = fromList;
    } else if (!isAuthEnabled() || !viewer) {
      const row = await queryOne<{ data: IncidentRecord & { severity?: string; status?: string } }>(
        'SELECT data FROM incidents WHERE id = $1',
        [queriedIncidentId],
      );
      activeIncident = row?.data ?? null;
    } else {
      const row = await queryOne<{
        data: IncidentRecord & {
          severity?: string;
          status?: string;
          ownerMemberId?: string;
          sharedWithMemberIds?: string[];
        };
      }>(
        'SELECT data FROM incidents WHERE id = $1',
        [queriedIncidentId],
      );
      if (row?.data && canViewIncident(row.data, viewer, granted)) {
        activeIncident = row.data;
      }
    }

    if (activeIncident) {
      const direct = incidentToMatch(activeIncident, 100);
      const withoutDup = similarIncidents.filter((s) => s.id !== queriedIncidentId);
      similarIncidents.length = 0;
      similarIncidents.push(direct, ...withoutDup.slice(0, 4));
    } else {
      steps[steps.length - 1] = {
        ...steps[steps.length - 1],
        detail: `No incident found for ${queriedIncidentId} in database`,
        status: 'skipped',
      };
    }

    steps.push({
      step: 5,
      action: 'Direct incident lookup',
      detail: activeIncident
        ? `Loaded ${queriedIncidentId} from database (ID in query)`
        : `${queriedIncidentId} not in database — save it via Intake first`,
      status: activeIncident ? 'done' : 'skipped',
    });
  } else if (similarIncidents.length > 0 && similarIncidents[0].similarityScore >= 40) {
    activeIncident = incidents.find((i) => i.id === similarIncidents[0].id) ?? null;
    if (activeIncident) {
      steps.push({
        step: 5,
        action: 'Best corpus match',
        detail: `Using ${similarIncidents[0].id} as primary context (${similarIncidents[0].similarityScore}% match)`,
        status: 'done',
      });
    }
  }

  const suggestedTasks = buildSuggestedTasks(queryText, similarIncidents);
  const triage = inferTriage(queryText, similarIncidents);

  let answer: string;
  if (isBedrockConfigured()) {
    steps.push({
      step: steps.length + 1,
      action: 'Bedrock Nova reasoning',
      detail: 'Generating agent response with Nova 2 Lite + incident context',
      status: 'done',
    });
    answer = await generateAgentResponse(queryText, {
      similarIncidents,
      activeIncident: activeIncident
        ? {
            id: activeIncident.id,
            title: activeIncident.title,
            service: activeIncident.service,
            severity: activeIncident.severity,
            status: activeIncident.status,
            summary: activeIncident.summary,
          }
        : null,
    });
    mode = 'bedrock';
  } else {
    steps.push({
      step: steps.length + 1,
      action: 'Local agent synthesis',
      detail: 'Structured response from vector matches (enable Bedrock for Haiku + Nova)',
      status: 'done',
    });
    answer = buildLocalAgentAnswer(queryText, similarIncidents, activeIncident, mode);
  }

  return {
    answer,
    similarIncidents,
    steps,
    suggestedTasks,
    mode,
    embeddingCount,
    triage,
  };
}

export async function getAgentStatus() {
  const embeddingCount = await getEmbeddingCount();
  const incidentCount = await query<{ n: number }>('SELECT count(*)::int AS n FROM incidents');
  return {
    bedrockEnabled: isBedrockConfigured(),
    embedMode: getEmbedMode(),
    embeddingCount,
    incidentCount: incidentCount[0]?.n ?? 0,
    vectorSearchReady: embeddingCount > 0,
    agentReady: true,
  };
}
