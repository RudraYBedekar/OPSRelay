import { z } from 'zod';

export const MCP_ERROR_CODES = {
  connect_failed: 'mcp_connect_failed',
  tool_denied: 'mcp_tool_denied',
  parse_failed: 'mcp_parse_failed',
  timeout: 'mcp_timeout',
} as const;

export type McpErrorCode = (typeof MCP_ERROR_CODES)[keyof typeof MCP_ERROR_CODES];

export const evidenceRowSchema = z.object({
  incident_id: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  service: z.string().min(1).max(120),
  severity: z.string().max(16).optional(),
  status: z.string().max(32).optional(),
  approved_summary: z.string().max(4000).optional(),
  approved_resolution: z.string().max(2000).optional(),
  decision_summary: z.string().max(2000).optional(),
  task_summary: z.string().max(2000).optional(),
  citation_id: z.string().min(1).max(128),
  projected_at: z.string().min(1).max(64),
  evidence_version: z.coerce.number().int().optional(),
});

export type ParsedEvidenceRow = z.infer<typeof evidenceRowSchema>;

export interface EvidenceRow {
  incident_id: string;
  title: string;
  service: string;
  severity?: string;
  status?: string;
  approved_summary?: string;
  approved_resolution?: string;
  decision_summary?: string;
  task_summary?: string;
  citation_id: string;
  projected_at: string;
  evidence_version?: number;
}

export const selectQueryResponseSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())),
});

export function mcpError(code: McpErrorCode, message: string, status = 503): Error {
  return Object.assign(new Error(message), { code, status });
}
