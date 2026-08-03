import { query } from '../db.js';
import { mcpConfig, markMcpRequestFailed } from '../config/mcp.js';
import { assertSafeSelectSql } from './mcpToolPolicy.js';
import type { InvestigationQuerySpec } from './investigationQueries.js';

export interface EvidenceRow {
  incident_id: string;
  title: string;
  service: string;
  severity?: string;
  status?: string;
  approved_summary?: string;
  approved_resolution?: string;
  decision_summary?: string;
  task_summary?: string;
  citation_id: string;
  projected_at: string;
}

/** Execute approved evidence query via backend SQL (same table MCP would read). */
export async function executeEvidenceQuery(spec: InvestigationQuerySpec): Promise<EvidenceRow[]> {
  assertSafeSelectSql(spec.sql, 'incident_evidence');

  try {
    if (spec.intent === 'recurring_tasks') {
      const rows = await query<EvidenceRow>(spec.sql, [spec.params[0]]);
      markMcpRequestFailed(false);
      return rows;
    }
    const rows = await query<EvidenceRow>(spec.sql, [spec.params[0]]);
    markMcpRequestFailed(false);
    return rows.slice(0, mcpConfig.maxResults);
  } catch {
    markMcpRequestFailed(true);
    throw new Error('Evidence query failed');
  }
}

/** When MCP OAuth is configured, this wrapper would call Managed MCP select_query. */
export async function executeViaManagedMcp(spec: InvestigationQuerySpec): Promise<EvidenceRow[]> {
  if (!mcpConfig.oauthToken) {
    return executeEvidenceQuery(spec);
  }
  // Placeholder for Streamable HTTP MCP client — falls back to backend evidence SQL until token wired
  return executeEvidenceQuery(spec);
}
