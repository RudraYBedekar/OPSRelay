import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { mcpConfig, markMcpRequestFailed } from '../config/mcp.js';
import { ALLOWED_MCP_TOOLS, assertToolAllowed } from './mcpToolPolicy.js';
import { MCP_ERROR_CODES, mcpError } from './mcpTypes.js';

export type McpClient = Client;

function redactSecrets(message: string): string {
  const token = mcpConfig.accessToken;
  if (!token) return message;
  return message.split(token).join('[REDACTED]');
}

function sanitizeMcpError(err: unknown, fallbackCode: string): Error {
  const raw = err instanceof Error ? err.message : 'MCP request failed';
  const message = redactSecrets(raw);
  const code = (err as { code?: string }).code ?? fallbackCode;
  const status = (err as { status?: number }).status ?? 503;
  return Object.assign(new Error(message), { code, status });
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(mcpError(MCP_ERROR_CODES.timeout, 'MCP request timed out')),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function assertManagedMcpConfigured(): void {
  if (!mcpConfig.serverUrl?.startsWith('https://')) {
    throw mcpError(MCP_ERROR_CODES.connect_failed, 'MCP server URL must use HTTPS');
  }
  if (!mcpConfig.clusterId?.trim()) {
    throw mcpError(MCP_ERROR_CODES.connect_failed, 'MCP cluster ID is required');
  }
  if (!mcpConfig.accessToken?.trim()) {
    throw mcpError(MCP_ERROR_CODES.connect_failed, 'MCP access token is required');
  }
}

function buildTransport(): StreamableHTTPClientTransport {
  assertManagedMcpConfigured();
  return new StreamableHTTPClientTransport(new URL(mcpConfig.serverUrl!), {
    requestInit: {
      headers: {
        'mcp-cluster-id': mcpConfig.clusterId!,
        Authorization: `Bearer ${mcpConfig.accessToken}`,
      },
    },
  });
}

async function validateSelectQueryAvailable(client: McpClient): Promise<void> {
  const listed = await client.listTools();
  const names = new Set(listed.tools.map((t) => t.name));
  if (!names.has('select_query')) {
    throw mcpError(MCP_ERROR_CODES.connect_failed, 'MCP server does not advertise select_query');
  }
  for (const name of names) {
    if (!ALLOWED_MCP_TOOLS.has(name) && name !== 'mcp_auth') {
      // Server may advertise write tools — we never call them; no fail on discovery.
      continue;
    }
  }
}

export async function withMcpClient<T>(
  fn: (client: McpClient) => Promise<T>,
  options?: { validateTools?: boolean },
): Promise<T> {
  assertManagedMcpConfigured();
  const transport = buildTransport();
  const client = new Client({ name: 'opsrelay-investigator', version: '1.0.0' });

  try {
    await withTimeout(client.connect(transport), mcpConfig.queryTimeoutMs);
    if (options?.validateTools !== false) {
      await withTimeout(validateSelectQueryAvailable(client), mcpConfig.queryTimeoutMs);
    }
    const result = await withTimeout(fn(client), mcpConfig.queryTimeoutMs);
    markMcpRequestFailed(false);
    return result;
  } catch (err) {
    markMcpRequestFailed(true);
    throw sanitizeMcpError(err, MCP_ERROR_CODES.connect_failed);
  } finally {
    try {
      await transport.close();
    } catch {
      // ignore close errors
    }
  }
}

export async function callMcpTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<ReturnType<McpClient['callTool']>> {
  assertToolAllowed(toolName);
  return withMcpClient((client) => client.callTool({ name: toolName, arguments: args }));
}

export async function probeManagedMcpConnection(): Promise<boolean> {
  if (mcpConfig.mode !== 'managed_mcp') return false;
  try {
    await withMcpClient(async (client) => {
      await client.listTools();
    });
    return true;
  } catch {
    return false;
  }
}
