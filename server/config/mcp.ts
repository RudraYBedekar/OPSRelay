import { z } from 'zod';

function parsePositiveInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

const mcpEnvSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(['disabled', 'managed_mcp', 'local_sql_demo']),
  serverUrl: z.string().url().optional(),
  clusterId: z.string().min(1).optional(),
  accessToken: z.string().min(1).optional(),
  evidenceDatabase: z.string().min(1),
  queryTimeoutMs: z.number().int().min(1000).max(25_000),
  maxResults: z.number().int().min(1).max(25),
});

function resolveMode(): 'disabled' | 'managed_mcp' | 'local_sql_demo' {
  const explicit = process.env.MCP_MODE?.trim();
  if (explicit === 'managed_mcp' || explicit === 'local_sql_demo' || explicit === 'disabled') {
    return explicit;
  }
  if (process.env.MCP_ENABLED === 'true') {
    // Prefer honest local demo SQL until real MCP credentials exist
    if (process.env.MCP_ACCESS_TOKEN || process.env.MCP_OAUTH_TOKEN) {
      return 'managed_mcp';
    }
    return 'local_sql_demo';
  }
  return 'disabled';
}

const mode = resolveMode();
const accessToken = process.env.MCP_ACCESS_TOKEN || process.env.MCP_OAUTH_TOKEN || '';

export const mcpConfig = mcpEnvSchema.parse({
  enabled: mode !== 'disabled',
  mode,
  serverUrl: process.env.MCP_SERVER_URL || 'https://cockroachlabs.cloud/mcp',
  clusterId: process.env.MCP_CLUSTER_ID || undefined,
  accessToken: accessToken || undefined,
  evidenceDatabase: process.env.MCP_EVIDENCE_DATABASE || process.env.EVIDENCE_DATABASE_NAME || 'opsrelay_evidence',
  queryTimeoutMs: parsePositiveInt(process.env.MCP_QUERY_TIMEOUT_MS, 10_000, 1000, 25_000),
  maxResults: parsePositiveInt(process.env.MCP_MAX_RESULTS, 10, 1, 25),
});

export type McpHealthStatus = 'not_configured' | 'ready' | 'last_request_failed';
export type McpTransportMode = 'disabled' | 'managed_mcp' | 'local_sql_demo';

let lastRequestFailed = false;
let lastSuccessfulConnect = false;

export function markMcpRequestFailed(failed: boolean): void {
  lastRequestFailed = failed;
  if (!failed) lastSuccessfulConnect = true;
}

export function getMcpHealth(): {
  status: McpHealthStatus;
  mode: McpTransportMode;
  provider: string;
  readOnly: boolean;
  evidenceDatabase: string;
} {
  if (mcpConfig.mode === 'disabled') {
    return {
      status: 'not_configured',
      mode: 'disabled',
      provider: 'none',
      readOnly: true,
      evidenceDatabase: mcpConfig.evidenceDatabase,
    };
  }

  if (mcpConfig.mode === 'managed_mcp') {
    if (!mcpConfig.clusterId || !mcpConfig.accessToken || !mcpConfig.serverUrl?.startsWith('https://')) {
      return {
        status: 'not_configured',
        mode: 'managed_mcp',
        provider: 'cockroachdb-cloud-managed-mcp',
        readOnly: true,
        evidenceDatabase: mcpConfig.evidenceDatabase,
      };
    }
    return {
      status: lastRequestFailed ? 'last_request_failed' : lastSuccessfulConnect ? 'ready' : 'not_configured',
      mode: 'managed_mcp',
      provider: 'cockroachdb-cloud-managed-mcp',
      readOnly: true,
      evidenceDatabase: mcpConfig.evidenceDatabase,
    };
  }

  // local_sql_demo — honest label, never claim Managed MCP
  return {
    status: lastRequestFailed ? 'last_request_failed' : 'ready',
    mode: 'local_sql_demo',
    provider: 'local-sql-demo',
    readOnly: true,
    evidenceDatabase: mcpConfig.evidenceDatabase,
  };
}

export function assertMcpConfigured(): void {
  if (mcpConfig.mode === 'disabled') {
    throw Object.assign(new Error('MCP investigator is not configured'), { status: 503 });
  }
  if (mcpConfig.mode === 'managed_mcp') {
    if (!mcpConfig.clusterId || !mcpConfig.accessToken) {
      throw Object.assign(new Error('Managed MCP requires MCP_CLUSTER_ID and MCP_ACCESS_TOKEN'), { status: 503 });
    }
  }
}
