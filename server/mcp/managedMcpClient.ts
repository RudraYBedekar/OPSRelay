import { query } from '../db.js';
import { mcpConfig, markMcpRequestFailed, assertMcpConfigured } from '../config/mcp.js';
import { assertSafeSelectSql, assertToolAllowed } from './mcpToolPolicy.js';
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
  evidence_version?: number;
}

export type EvidenceQueryResult = {
  rows: EvidenceRow[];
  provider: 'cockroachdb-cloud-managed-mcp' | 'local-sql-demo';
  transport: 'managed_mcp' | 'local_sql_demo';
  toolsUsed: string[];
};

/** Local SQL demo path — never labeled as Managed MCP. */
export async function executeEvidenceQuery(spec: InvestigationQuerySpec): Promise<EvidenceQueryResult> {
  assertSafeSelectSql(spec.sql, 'incident_evidence');
  assertToolAllowed('select_query');

  try {
    const rows = await query<EvidenceRow>(spec.sql, [spec.params[0]]);
    markMcpRequestFailed(false);
    return {
      rows: rows.slice(0, mcpConfig.maxResults),
      provider: 'local-sql-demo',
      transport: 'local_sql_demo',
      toolsUsed: ['select_query'],
    };
  } catch {
    markMcpRequestFailed(true);
    throw new Error('Evidence query failed');
  }
}

/**
 * Managed MCP path. Requires MCP_MODE=managed_mcp with cluster ID + access token.
 * Until the Streamable HTTP client is fully wired with staging credentials,
 * this fails closed instead of silently falling back to primary SQL.
 */
export async function executeViaManagedMcp(spec: InvestigationQuerySpec): Promise<EvidenceQueryResult> {
  assertMcpConfigured();

  if (mcpConfig.mode === 'local_sql_demo') {
    return executeEvidenceQuery(spec);
  }

  if (mcpConfig.mode === 'managed_mcp') {
    // Real MCP HTTPS client belongs here. Until credentials and SDK transport
    // are verified in staging, refuse silent SQL fallback.
    if (!mcpConfig.accessToken || !mcpConfig.clusterId) {
      markMcpRequestFailed(true);
      throw Object.assign(new Error('Managed MCP is not fully configured'), { status: 503 });
    }

    // Attempt local evidence query only when explicitly allowed via MCP_ALLOW_SQL_BRIDGE=true
    // for controlled demos. Default is fail-closed.
    if (process.env.MCP_ALLOW_SQL_BRIDGE === 'true') {
      const result = await executeEvidenceQuery(spec);
      return {
        ...result,
        // Still honest: bridge is not Managed MCP transport
        provider: 'local-sql-demo',
        transport: 'local_sql_demo',
      };
    }

    markMcpRequestFailed(true);
    throw Object.assign(
      new Error('Managed MCP transport is configured but not connected. Set MCP_MODE=local_sql_demo for demo SQL.'),
      { status: 503 },
    );
  }

  throw Object.assign(new Error('MCP investigator is disabled'), { status: 503 });
}
