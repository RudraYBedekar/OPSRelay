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
  source: 'cockroachdb-managed-mcp';
  retrievedAt: string;
}

export interface InvestigationResult {
  answer: string;
  readOnly: true;
  provider: 'cockroachdb-cloud-managed-mcp';
  queryTemplateId: string;
  toolsUsed: string[];
  citations: McpCitation[];
}

function rowToCitations(rows: EvidenceRow[]): McpCitation[] {
  const now = new Date().toISOString();
  return rows.flatMap((row) => {
    const citations: McpCitation[] = [];
    const base = {
      citationId: row.citation_id,
      incidentId: row.incident_id,
      title: row.title,
      service: row.service,
      source: 'cockroachdb-managed-mcp' as const,
      retrievedAt: now,
    };
    if (row.approved_summary) {
      citations.push({
        ...base,
        field: 'approved_summary',
        excerpt: row.approved_summary.slice(0, 280),
      });
    }
    if (row.approved_resolution) {
      citations.push({
        ...base,
        field: 'approved_resolution',
        excerpt: row.approved_resolution.slice(0, 280),
      });
    }
    if (row.task_summary) {
      citations.push({
        ...base,
        field: 'task_summary',
        excerpt: row.task_summary.slice(0, 280),
      });
    }
    return citations.slice(0, 1);
  });
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
  if (health.status === 'not_configured') {
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
  const rows = await executeViaManagedMcp(spec);
  const citations = rowToCitations(rows);

  let answer: string;
  if (citations.length === 0) {
    answer = 'No approved MCP evidence found for this service. Only human-approved incidents are projected to the evidence store.';
  } else if (isBedrockConfigured()) {
    try {
      const evidenceContext = citations.map((c) => ({
        citationId: c.citationId,
        incidentId: c.incidentId,
        field: c.field,
        excerpt: c.excerpt,
      }));
      answer = await generateAgentResponse(question, {
        similarIncidents: [],
        activeIncident: { summary: JSON.stringify(evidenceContext), service },
      });
    } catch {
      answer = citations.map((c) => `[${c.citationId}] ${c.excerpt}`).join('\n\n');
    }
  } else {
    answer = citations.map((c) => `[${c.citationId}] ${c.excerpt}`).join('\n\n');
  }

  return {
    answer,
    readOnly: true,
    provider: 'cockroachdb-cloud-managed-mcp',
    queryTemplateId: spec.templateId,
    toolsUsed: ['select_query'],
    citations,
  };
}
