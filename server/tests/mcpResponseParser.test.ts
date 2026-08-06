import { describe, expect, it } from 'vitest';
import { parseSelectQueryResult } from '../mcp/mcpResponseParser.js';

describe('parseSelectQueryResult', () => {
  it('parses valid JSON rows from text content', () => {
    const rows = parseSelectQueryResult({
      content: [{
        type: 'text',
        text: JSON.stringify({
          rows: [{
            incident_id: 'INC-001',
            title: 'Checkout outage',
            service: 'checkout-api',
            severity: 'SEV-1',
            status: 'RESOLVED',
            approved_summary: 'Payment gateway timeout',
            citation_id: 'CRDB-EVIDENCE:INC-001:v1',
            projected_at: '2026-08-01T00:00:00Z',
          }],
        }),
      }],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].incident_id).toBe('INC-001');
    expect(rows[0].citation_id).toBe('CRDB-EVIDENCE:INC-001:v1');
  });

  it('rejects MCP error results', () => {
    expect(() => parseSelectQueryResult({ isError: true, content: [] })).toThrow(/error result/);
  });

  it('rejects malformed JSON', () => {
    expect(() => parseSelectQueryResult({
      content: [{ type: 'text', text: 'not-json' }],
    })).toThrow(/valid JSON/);
  });

  it('rejects rows missing required citation_id', () => {
    expect(() => parseSelectQueryResult({
      content: [{
        type: 'text',
        text: JSON.stringify({
          rows: [{ incident_id: 'INC-002', title: 'x', service: 'api' }],
        }),
      }],
    })).toThrow(/validation/);
  });

  it('accepts structuredContent payload', () => {
    const rows = parseSelectQueryResult({
      structuredContent: {
        rows: [{
          incident_id: 'INC-003',
          title: 'DB lag',
          service: 'postgres-replica',
          citation_id: 'CRDB-EVIDENCE:INC-003:v1',
          projected_at: '2026-08-02T00:00:00Z',
        }],
      },
    });
    expect(rows[0].service).toBe('postgres-replica');
  });
});
