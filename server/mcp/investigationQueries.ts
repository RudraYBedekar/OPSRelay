import { mcpConfig } from '../config/mcp.js';
import { assertSafeSelectSql } from './mcpToolPolicy.js';

export type InvestigationIntent =
  | 'service_history'
  | 'unresolved_incidents'
  | 'related_resolutions'
  | 'recurring_tasks';

export interface InvestigationQuerySpec {
  templateId: string;
  intent: InvestigationIntent;
  sql: string;
  params: string[];
}

const TABLE = 'incident_evidence';

export function buildInvestigationQuery(
  intent: InvestigationIntent,
  service: string,
  limit: number,
): InvestigationQuerySpec {
  const safeService = service.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 120) || 'general';
  const lim = Math.min(mcpConfig.maxResults, Math.max(1, limit));

  switch (intent) {
    case 'unresolved_incidents':
      return {
        templateId: 'unresolved_incidents_v1',
        intent,
        sql: `SELECT incident_id, title, service, severity, status, approved_summary, approved_resolution, citation_id, projected_at FROM ${TABLE} WHERE service = $1 AND status != 'RESOLVED' ORDER BY source_updated_at DESC LIMIT ${lim}`,
        params: [safeService],
      };
    case 'related_resolutions':
      return {
        templateId: 'related_resolutions_v1',
        intent,
        sql: `SELECT incident_id, title, service, severity, status, approved_summary, approved_resolution, decision_summary, citation_id, projected_at FROM ${TABLE} WHERE service = $1 AND approved_resolution IS NOT NULL ORDER BY source_updated_at DESC LIMIT ${lim}`,
        params: [safeService],
      };
    case 'recurring_tasks':
      return {
        templateId: 'recurring_tasks_v1',
        intent,
        sql: `SELECT incident_id, title, service, task_summary, citation_id, projected_at FROM ${TABLE} WHERE service = $1 AND task_summary IS NOT NULL ORDER BY source_updated_at DESC LIMIT ${lim}`,
        params: [safeService],
      };
    case 'service_history':
    default:
      return {
        templateId: 'service_history_v1',
        intent: 'service_history',
        sql: `SELECT incident_id, title, service, severity, status, approved_summary, approved_resolution, citation_id, projected_at FROM ${TABLE} WHERE service = $1 ORDER BY source_updated_at DESC LIMIT ${lim}`,
        params: [safeService],
      };
  }
}

export function inferIntent(question: string): InvestigationIntent {
  const q = question.toLowerCase();
  if (q.includes('unresolved') || q.includes('open')) return 'unresolved_incidents';
  if (q.includes('resolution') || q.includes('fixed') || q.includes('remediation')) return 'related_resolutions';
  if (q.includes('task') || q.includes('follow-up') || q.includes('follow up')) return 'recurring_tasks';
  return 'service_history';
}

function escapeSqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** Render reviewed template SQL with inlined sanitized params for MCP select_query. */
export function renderInvestigationSql(spec: InvestigationQuerySpec): string {
  if (spec.params.length !== 1) {
    throw new Error('Investigation query expects exactly one service parameter');
  }
  const literal = escapeSqlLiteral(spec.params[0]);
  const sql = spec.sql.replace(/\$1\b/g, literal);
  assertSafeSelectSql(sql, 'incident_evidence');
  return sql;
}
