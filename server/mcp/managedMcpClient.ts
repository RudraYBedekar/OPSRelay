import { query } from '../db.js';
import { mcpConfig, markMcpRequestFailed, assertMcpConfigured } from '../config/mcp.js';
import { assertSafeSelectSql, assertToolAllowed } from './mcpToolPolicy.js';
import { renderInvestigationSql, type InvestigationQuerySpec } from './investigationQueries.js';
import { withMcpClient } from './mcpClientFactory.js';
import { parseSelectQueryResult } from './mcpResponseParser.js';
import type { EvidenceRow } from './mcpTypes.js';

export type { EvidenceRow } from './mcpTypes.js';

export type EvidenceQueryResult = {
  rows: EvidenceRow[];
  provider: 'cockroachdb-cloud-managed-mcp' | 'local-sql-demo';
  transport: 'managed_mcp' | 'local_sql_demo';
  toolsUsed: string[];
};

/** Local SQL demo path — never labeled as Managed MCP. */
export async function executeEvidenceQuery(spec: InvestigationQuerySpec): Promise<EvidenceQueryResult> {
  assertToolAllowed('select_query');
  const sql = renderInvestigationSql(spec);

  try {
    const rows = await query<EvidenceRow>(sql);
    markMcpRequestFailed(false);
    return {
      rows: rows.slice(0, mcpConfig.maxResults),
      provider: 'local-sql-demo',
      transport: 'local_sql_demo',
      toolsUsed: ['select_query'],
    };
  } catch (err) {
    markMcpRequestFailed(true);
    throw Object.assign(new Error('Evidence query failed'), { status: 503 });
  }
}

/**
 * Managed MCP path via CockroachDB Cloud Streamable HTTP transport.
 * Fails closed — no silent SQL fallback unless MCP_ALLOW_SQL_BRIDGE=true.
 */
export async function executeViaManagedMcp(spec: InvestigationQuerySpec): Promise<EvidenceQueryResult> {
  assertMcpConfigured();

  if (mcpConfig.mode === 'local_sql_demo') {
    return executeEvidenceQuery(spec);
  }

  if (mcpConfig.mode === 'managed_mcp') {
    if (!mcpConfig.accessToken || !mcpConfig.clusterId) {
      markMcpRequestFailed(true);
      throw Object.assign(new Error('Managed MCP is not fully configured'), { status: 503 });
    }

    if (process.env.MCP_ALLOW_SQL_BRIDGE === 'true') {
      const result = await executeEvidenceQuery(spec);
      return {
        ...result,
        provider: 'local-sql-demo',
        transport: 'local_sql_demo',
      };
    }

    assertToolAllowed('select_query');
    const sql = renderInvestigationSql(spec);
    assertSafeSelectSql(sql, 'incident_evidence');

    const rows = await withMcpClient(async (client) => {
      const result = await client.callTool({
        name: 'select_query',
        arguments: {
          database: mcpConfig.evidenceDatabase,
          query: sql,
        },
      });
      return parseSelectQueryResult(result as import('./mcpResponseParser.js').CallToolResultLike);
    });

    return {
      rows,
      provider: 'cockroachdb-cloud-managed-mcp',
      transport: 'managed_mcp',
      toolsUsed: ['select_query'],
    };
  }

  throw Object.assign(new Error('MCP investigator is disabled'), { status: 503 });
}
