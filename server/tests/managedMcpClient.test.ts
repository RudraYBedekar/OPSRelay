import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const withMcpClientMock = vi.fn();

vi.mock('../mcp/mcpClientFactory.js', () => ({
  withMcpClient: (...args: unknown[]) => withMcpClientMock(...args),
}));

describe('managed MCP client', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    withMcpClientMock.mockReset();
    process.env = {
      ...originalEnv,
      MCP_MODE: 'managed_mcp',
      MCP_ENABLED: 'true',
      MCP_SERVER_URL: 'https://cockroachlabs.cloud/mcp',
      MCP_CLUSTER_ID: 'cluster-test-id',
      MCP_ACCESS_TOKEN: 'super-secret-token-value',
      MCP_EVIDENCE_DATABASE: 'Rudra',
      MCP_ALLOW_SQL_BRIDGE: 'false',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('calls select_query via MCP and labels provider honestly', async () => {
    withMcpClientMock.mockImplementation(async (fn: (client: unknown) => Promise<unknown>) => {
      const fakeClient = {
        callTool: vi.fn().mockResolvedValue({
          content: [{
            type: 'text',
            text: JSON.stringify({
              rows: [{
                incident_id: 'INC-100',
                title: 'Test',
                service: 'checkout-api',
                approved_summary: 'Summary text',
                citation_id: 'CRDB-EVIDENCE:INC-100:v1',
                projected_at: '2026-08-01T00:00:00Z',
              }],
            }),
          }],
        }),
      };
      return fn(fakeClient);
    });

    const { executeViaManagedMcp } = await import('../mcp/managedMcpClient.js');
    const { buildInvestigationQuery } = await import('../mcp/investigationQueries.js');

    const spec = buildInvestigationQuery('service_history', 'checkout-api', 5);
    const result = await executeViaManagedMcp(spec);

    expect(result.transport).toBe('managed_mcp');
    expect(result.provider).toBe('cockroachdb-cloud-managed-mcp');
    expect(result.toolsUsed).toEqual(['select_query']);
    expect(result.rows[0].incident_id).toBe('INC-100');
    expect(withMcpClientMock).toHaveBeenCalledTimes(1);
  });

  it('propagates MCP connection failures without calling local SQL', async () => {
    withMcpClientMock.mockRejectedValue(Object.assign(new Error('MCP connect failed'), { status: 503 }));

    const { executeViaManagedMcp } = await import('../mcp/managedMcpClient.js');
    const { buildInvestigationQuery } = await import('../mcp/investigationQueries.js');

    const spec = buildInvestigationQuery('service_history', 'checkout-api', 5);
    await expect(executeViaManagedMcp(spec)).rejects.toMatchObject({ status: 503 });
  });
});
