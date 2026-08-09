import { describe, expect, it } from 'vitest';
import {
  assertToolAllowed,
  assertSafeSelectSql,
  ALLOWED_MCP_TOOLS,
  DENIED_MCP_TOOLS,
} from '../mcp/mcpToolPolicy.js';
import { buildInvestigationQuery, renderInvestigationSql } from '../mcp/investigationQueries.js';
import type { InvestigatorAccessScope } from '../services/incidentAccessService.js';

const testScope: InvestigatorAccessScope = {
  viewerMemberId: 'MEM-TESTTEST',
  allowedOwnerMemberIds: ['MEM-TESTTEST'],
  explicitlySharedIncidentIds: [],
  allowedIncidentIds: ['INC-TEST'],
};

describe('MCP tool policy', () => {
  it('allows read-only tools', () => {
    for (const tool of ALLOWED_MCP_TOOLS) {
      expect(() => assertToolAllowed(tool)).not.toThrow();
    }
  });

  it('denies write tools', () => {
    for (const tool of DENIED_MCP_TOOLS) {
      expect(() => assertToolAllowed(tool)).toThrow(/denied/);
    }
  });

  it('denies unknown tools', () => {
    expect(() => assertToolAllowed('drop_database')).toThrow(/not allowed/);
  });

  it('allows SELECT on evidence table only', () => {
    const sql = 'SELECT citation_id, excerpt FROM incident_evidence WHERE service = $1 LIMIT 5';
    expect(() => assertSafeSelectSql(sql, 'incident_evidence')).not.toThrow();
  });

  it('blocks INSERT and multi-statement SQL', () => {
    expect(() => assertSafeSelectSql('INSERT INTO incident_evidence VALUES (1)', 'incident_evidence')).toThrow();
    expect(() => assertSafeSelectSql('SELECT 1; DROP TABLE incident_evidence', 'incident_evidence')).toThrow();
  });

  it('blocks queries targeting other tables', () => {
    expect(() => assertSafeSelectSql('SELECT * FROM users', 'incident_evidence')).toThrow(/approved evidence/);
  });

  it('denies UPDATE with mixed case', () => {
    expect(() => assertSafeSelectSql('SeLeCt 1; UpDaTe incident_evidence set title=1', 'incident_evidence')).toThrow();
  });

  it('denies comments attempting a second statement', () => {
    expect(() => assertSafeSelectSql('SELECT 1 FROM incident_evidence -- trailing comment', 'incident_evidence')).not.toThrow();
    expect(() => assertSafeSelectSql('SELECT 1 FROM incident_evidence; SELECT 2 FROM incident_evidence', 'incident_evidence')).toThrow();
  });

  it('denies SELECT from users', () => {
    expect(() => assertSafeSelectSql('SELECT * FROM users', 'incident_evidence')).toThrow(/approved evidence/);
  });

  it('inlines sanitized service params for MCP SQL', () => {
    const spec = buildInvestigationQuery('service_history', 'checkout-api', testScope, 5);
    const sql = renderInvestigationSql(spec);
    expect(sql).toContain("service = 'checkout-api'");
    expect(sql).not.toContain('$1');
    expect(() => assertSafeSelectSql(sql, 'incident_evidence')).not.toThrow();
  });

  it('rejects SQL injection in rendered service slug', () => {
    const spec = buildInvestigationQuery('service_history', "x'; DROP TABLE incident_evidence; --", testScope, 5);
    const sql = renderInvestigationSql(spec);
    expect(sql).not.toContain('DROP TABLE');
    expect(sql).not.toContain(';');
  });
});
