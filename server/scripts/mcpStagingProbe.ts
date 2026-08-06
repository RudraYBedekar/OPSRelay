import 'dotenv/config';
import { mcpConfig } from '../config/mcp.js';
import { probeManagedMcpConnection, withMcpClient } from '../mcp/mcpClientFactory.js';
import { assertToolAllowed } from '../mcp/mcpToolPolicy.js';

async function main() {
  if (process.env.RUN_MCP_STAGING_TESTS !== 'true') {
    console.log('Set RUN_MCP_STAGING_TESTS=true to run staging MCP probe.');
    process.exit(0);
  }

  if (mcpConfig.mode !== 'managed_mcp') {
    console.error('MCP_MODE must be managed_mcp for staging probe.');
    process.exit(1);
  }

  console.log('=== MCP staging probe ===');
  console.log(`Cluster configured: ${Boolean(mcpConfig.clusterId)}`);
  console.log(`Evidence database: ${mcpConfig.evidenceDatabase}`);

  const connected = await probeManagedMcpConnection();
  console.log(`Connection probe: ${connected ? 'PASS' : 'FAIL'}`);
  if (!connected) process.exit(1);

  await withMcpClient(async (client) => {
    const tools = await client.listTools();
    const names = tools.tools.map((t) => t.name);
    console.log(`Tools advertised: ${names.length}`);

    try {
      assertToolAllowed('insert_rows');
      console.error('Write tool policy: FAIL (insert_rows should be denied)');
      process.exit(1);
    } catch {
      console.log('Write tool policy: PASS');
    }

    const result = await client.callTool({
      name: 'select_query',
      arguments: {
        database: mcpConfig.evidenceDatabase,
        query: 'SELECT count(*) AS evidence_rows FROM incident_evidence',
      },
    });

    const hasContent = Boolean(result.content?.length || result.structuredContent);
    console.log(`select_query smoke test: ${hasContent ? 'PASS' : 'FAIL'}`);
    if (!hasContent) process.exit(1);
  });

  console.log('Staging MCP probe complete.');
}

void main().catch((err) => {
  console.error('Staging probe failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
