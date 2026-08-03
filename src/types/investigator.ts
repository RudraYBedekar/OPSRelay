export interface McpCitation {
  citationId: string;
  incidentId: string;
  title: string;
  service: string;
  field: string;
  excerpt: string;
  source: 'cockroachdb-managed-mcp';
  retrievedAt: string;
}

export interface InvestigationResult {
  answer: string;
  readOnly: true;
  provider: 'cockroachdb-cloud-managed-mcp';
  queryTemplateId: string;
  toolsUsed: string[];
  citations: McpCitation[];
}

export interface InvestigatorStatus {
  status: 'not_configured' | 'ready' | 'last_request_failed';
  provider: string;
  readOnly: boolean;
  evidenceDatabase: string;
}
