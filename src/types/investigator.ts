export interface McpCitation {
  citationId: string;
  incidentId: string;
  title: string;
  service: string;
  field: string;
  excerpt: string;
  source: 'cockroachdb-managed-mcp' | 'local-sql-demo';
  provider: string;
  retrievedAt: string;
  evidenceVersion?: number;
}

export interface InvestigationResult {
  answer: string;
  readOnly: true;
  provider: string;
  transport: string;
  queryTemplateId: string;
  toolsUsed: string[];
  citations: McpCitation[];
}

export interface InvestigatorStatus {
  status: 'not_configured' | 'ready' | 'last_request_failed';
  mode?: 'disabled' | 'managed_mcp' | 'local_sql_demo';
  provider: string;
  readOnly: boolean;
  evidenceDatabase: string;
}
