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
  if (/\bwith\b/.test(normalized) && /\b(insert|update|delete)\b/.test(normalized)) {
    throw new Error('CTE writes are not allowed');
  }
  if (/\bjoin\b/.test(normalized)) throw new Error('JOIN queries are not allowed');
  const forbidden = ['insert', 'update', 'delete', 'drop', 'create', 'alter', 'grant'];
  for (const word of forbidden) {
    const pattern = new RegExp(`\\b${word}\\b`, 'i');
    if (pattern.test(normalized)) throw new Error(`Forbidden SQL keyword: ${word}`);
  }
  const fromMatches = normalized.match(/\bfrom\s+([a-z_][a-z0-9_]*)/g);
  if (!fromMatches || fromMatches.length !== 1) {
    throw new Error('Query must use a single FROM clause on the approved evidence table');
  }
  const tableName = fromMatches[0].replace(/\bfrom\s+/, '');
  if (tableName !== allowedTable.toLowerCase()) {
    throw new Error('Query must target approved evidence table only');
  }
}
