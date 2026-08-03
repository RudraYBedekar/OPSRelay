export const ALLOWED_MCP_TOOLS = new Set([
  'list_databases',
  'list_tables',
  'get_table_schema',
  'select_query',
  'explain_query',
]);

export const DENIED_MCP_TOOLS = new Set([
  'create_database',
  'create_table',
  'insert_rows',
]);

export function assertToolAllowed(toolName: string): void {
  if (DENIED_MCP_TOOLS.has(toolName)) {
    throw new Error(`MCP tool denied: ${toolName}`);
  }
  if (!ALLOWED_MCP_TOOLS.has(toolName)) {
    throw new Error(`MCP tool not allowed: ${toolName}`);
  }
}

export function assertSafeSelectSql(sql: string, allowedTable: string): void {
  const normalized = sql.trim().toLowerCase();
  if (normalized.includes(';')) throw new Error('Multiple SQL statements are not allowed');
  if (!normalized.startsWith('select')) throw new Error('Only SELECT queries are allowed');
  const forbidden = ['insert', 'update', 'delete', 'drop', 'create', 'alter', 'grant'];
  for (const word of forbidden) {
    if (normalized.includes(word)) throw new Error(`Forbidden SQL keyword: ${word}`);
  }
  if (!normalized.includes(allowedTable.toLowerCase())) {
    throw new Error('Query must target approved evidence table only');
  }
}
