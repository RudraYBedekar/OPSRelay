export const mcpConfig = {
  enabled: process.env.MCP_ENABLED === 'true',
  serverUrl: process.env.MCP_SERVER_URL ?? 'https://cockroachlabs.cloud/mcp',
  clusterId: process.env.MCP_CLUSTER_ID ?? '',
  authMode: process.env.MCP_AUTH_MODE ?? 'oauth',
  evidenceDatabase: process.env.MCP_EVIDENCE_DATABASE ?? 'opsrelay_evidence',
  queryTimeoutMs: Math.min(25_000, Math.max(1000, Number(process.env.MCP_QUERY_TIMEOUT_MS ?? 10_000))),
  maxResults: Math.min(25, Math.max(1, Number(process.env.MCP_MAX_RESULTS ?? 10))),
  oauthToken: process.env.MCP_OAUTH_TOKEN ?? '',
};

export type McpHealthStatus = 'not_configured' | 'ready' | 'last_request_failed';

let lastRequestFailed = false;

export function markMcpRequestFailed(failed: boolean): void {
  lastRequestFailed = failed;
}

export function getMcpHealth(): {
  status: McpHealthStatus;
  provider: string;
  readOnly: boolean;
  evidenceDatabase: string;
} {
  if (!mcpConfig.enabled) {
    return {
      status: 'not_configured',
      provider: 'cockroachdb-cloud-managed-mcp',
      readOnly: true,
      evidenceDatabase: mcpConfig.evidenceDatabase,
    };
  }
  return {
    status: lastRequestFailed ? 'last_request_failed' : 'ready',
    provider: mcpConfig.oauthToken ? 'cockroachdb-cloud-managed-mcp' : 'cockroachdb-sql-fallback',
    readOnly: true,
    evidenceDatabase: mcpConfig.evidenceDatabase,
  };
}

export function assertMcpConfigured(): void {
  if (!mcpConfig.enabled) {
    throw new Error('MCP investigator is not configured');
  }
}
