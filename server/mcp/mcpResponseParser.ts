import { mcpConfig } from '../config/mcp.js';
import {
  evidenceRowSchema,
  MCP_ERROR_CODES,
  mcpError,
  selectQueryResponseSchema,
  type ParsedEvidenceRow,
} from './mcpTypes.js';
import type { EvidenceRow } from './mcpTypes.js';

type ToolContentBlock = {
  type: string;
  text?: string;
};

export type CallToolResultLike = {
  isError?: boolean;
  content?: ToolContentBlock[];
  structuredContent?: Record<string, unknown>;
};

function pickString(row: Record<string, unknown>, key: string, maxLen: number): string | undefined {
  const value = row[key];
  if (value == null) return undefined;
  const str = String(value);
  if (!str.trim()) return undefined;
  return str.slice(0, maxLen);
}

function mapRow(row: Record<string, unknown>): ParsedEvidenceRow {
  const normalized = {
    incident_id: pickString(row, 'incident_id', 64) ?? '',
    title: pickString(row, 'title', 200) ?? 'Untitled',
    service: pickString(row, 'service', 120) ?? 'general',
    severity: pickString(row, 'severity', 16),
    status: pickString(row, 'status', 32),
    approved_summary: pickString(row, 'approved_summary', 4000),
    approved_resolution: pickString(row, 'approved_resolution', 2000),
    decision_summary: pickString(row, 'decision_summary', 2000),
    task_summary: pickString(row, 'task_summary', 2000),
    citation_id: pickString(row, 'citation_id', 128) ?? '',
    projected_at: pickString(row, 'projected_at', 64) ?? new Date().toISOString(),
    evidence_version: row.evidence_version != null ? Number(row.evidence_version) : undefined,
  };

  const parsed = evidenceRowSchema.safeParse(normalized);
  if (!parsed.success || !parsed.data.citation_id || !parsed.data.incident_id) {
    throw mcpError(MCP_ERROR_CODES.parse_failed, 'MCP row failed validation');
  }
  return parsed.data;
}

function extractJsonPayload(result: CallToolResultLike): unknown {
  if (result.structuredContent && typeof result.structuredContent === 'object') {
    if ('rows' in result.structuredContent) {
      return result.structuredContent;
    }
  }

  const blocks = result.content ?? [];
  for (const block of blocks) {
    if (block.type === 'text' && block.text?.trim()) {
      try {
        return JSON.parse(block.text);
      } catch {
        throw mcpError(MCP_ERROR_CODES.parse_failed, 'MCP response is not valid JSON');
      }
    }
  }

  throw mcpError(MCP_ERROR_CODES.parse_failed, 'MCP response contained no parseable content');
}

export function parseSelectQueryResult(result: CallToolResultLike): EvidenceRow[] {
  if (result.isError) {
    throw mcpError(MCP_ERROR_CODES.parse_failed, 'MCP select_query returned an error result');
  }

  const payload = extractJsonPayload(result);
  const parsed = selectQueryResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw mcpError(MCP_ERROR_CODES.parse_failed, 'MCP response shape is invalid');
  }

  const capped = parsed.data.rows.slice(0, mcpConfig.maxResults);
  return capped.map((row) => mapRow(row) as EvidenceRow);
}
