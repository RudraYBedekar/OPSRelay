import { isBedrockConfigured } from '../config/bedrock.js';
import { generateAgentResponse } from './llmService.js';
import { queryOne } from '../db.js';
import { getMcpHealth } from '../config/mcp.js';
import { buildInvestigationQuery, inferIntent } from '../mcp/investigationQueries.js';
import { executeViaManagedMcp, type EvidenceRow } from '../mcp/managedMcpClient.js';
import {
  canViewIncident,
  canUseInvestigator,
  getGrantedOwnerMemberIds,
} from './incidentAccessService.js';
import { isAuthEnabled } from '../config/auth.js';
import type { AuthUser } from './authService.js';

export interface McpCitation {
  citationId: string;
  incidentId: string;
  title: string;
  service: string;
  field: string;
  excerpt: string;
  source: 'cockroachdb-managed-mcp' | 'local-sql-demo';
  provider: string;
  retrievedAt: string;
  evidenceVersion?: number;
}

export interface InvestigationResult {
  answer: string;
  readOnly: true;
  provider: string;
  transport: string;
  queryTemplateId: string;
  toolsUsed: string[];
  citations: McpCitation[];
}

function rowToCitations(
  rows: EvidenceRow[],
  source: McpCitation['source'],
  provider: string,
): McpCitation[] {
  const now = new Date().toISOString();
  return rows.flatMap((row) => {
    const fields: Array<{ field: string; excerpt?: string }> = [
      { field: 'approved_summary', excerpt: row.approved_summary },
      { field: 'approved_resolution', excerpt: row.approved_resolution },
      { field: 'task_summary', excerpt: row.task_summary },
    ];
    const first = fields.find((f) => f.excerpt?.trim());
    if (!first?.excerpt) return [];
    return [{
      citationId: row.citation_id,
      incidentId: row.incident_id,
      title: row.title,
      service: row.service,
      field: first.field,
      excerpt: first.excerpt.slice(0, 280),
      source,
      provider,
      retrievedAt: now,
      evidenceVersion: row.evidence_version,
    }];
  });
}

function groundAnswer(answer: string, citations: McpCitation[]): string {
  if (citations.length === 0) {
    return 'No approved evidence citations were returned for this query.';
  }
  const allowed = new Set(citations.map((c) => c.citationId));
  // Drop model-invented citation markers that are not in retrieved evidence
  const cleaned = answer.replace(/\[([^\]]+)\]/g, (match, id: string) => (
    allowed.has(id) ? match : ''
  )).replace(/\s{2,}/g, ' ').trim();

  if (!cleaned || !citations.some((c) => cleaned.includes(c.citationId) || cleaned.includes(c.excerpt.slice(0, 40)))) {
    return citations.map((c) => `[${c.citationId}] ${c.excerpt}`).join('\n\n');
  }
  return cleaned;
}

export async function runInvestigation(
  question: string,
  user: AuthUser,
  incidentId?: string,
): Promise<InvestigationResult> {
  if (!canUseInvestigator(user)) {
    throw Object.assign(new Error('Investigator access denied'), { status: 403 });
  }

  const health = getMcpHealth();
  if (health.status === 'not_configured' && health.mode === 'disabled') {
    throw Object.assign(new Error('MCP investigator is not configured'), { status: 503 });
  }

  let service = 'general';
  if (incidentId) {
    const row = await queryOne<{ data: Record<string, unknown> }>(
      'SELECT data FROM incidents WHERE id = $1',
      [incidentId],
    );
    if (!row) throw Object.assign(new Error('Incident not found'), { status: 404 });

    if (isAuthEnabled()) {
      const granted = new Set(await getGrantedOwnerMemberIds(user.memberId));
      if (!canViewIncident(row.data as { ownerMemberId?: string; sharedWithMemberIds?: string[] }, user, granted)) {
        throw Object.assign(new Error('Incident not found'), { status: 404 });
      }
    }
    service = String(row.data.service ?? 'general');
  }

  const intent = inferIntent(question);
  const spec = buildInvestigationQuery(intent, service, 10);
  const result = await executeViaManagedMcp(spec);
  const source: McpCitation['source'] =
    result.transport === 'managed_mcp' ? 'cockroachdb-managed-mcp' : 'local-sql-demo';
  const citations = rowToCitations(result.rows, source, result.provider);

  let answer: string;
  if (citations.length === 0) {
    answer = 'No approved evidence found for this service. Only human-approved incidents are projected to the evidence store.';
  } else if (isBedrockConfigured()) {
    try {
      const evidenceContext = citations.map((c) => ({
        citationId: c.citationId,
        incidentId: c.incidentId,
        field: c.field,
        excerpt: c.excerpt,
      }));
      const raw = await generateAgentResponse(
        `${question}\n\nOnly cite these citation IDs: ${citations.map((c) => c.citationId).join(', ')}`,
        {
          similarIncidents: [],
          activeIncident: { summary: JSON.stringify(evidenceContext), service },
        },
      );
      answer = groundAnswer(raw, citations);
    } catch {
      answer = citations.map((c) => `[${c.citationId}] ${c.excerpt}`).join('\n\n');
    }
  } else {
    answer = citations.map((c) => `[${c.citationId}] ${c.excerpt}`).join('\n\n');
  }

  return {
    answer,
    readOnly: true,
    provider: result.provider,
    transport: result.transport,
    queryTemplateId: spec.templateId,
    toolsUsed: result.toolsUsed,
    citations,
  };
}
