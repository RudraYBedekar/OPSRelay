import { describe, expect, it } from 'vitest';
import { buildInvestigationQuery, renderInvestigationSql } from '../mcp/investigationQueries.js';
import { buildOwnerScopeSql, isIncidentIdAllowed } from '../mcp/investigationAccess.js';
import type { InvestigatorAccessScope } from '../services/incidentAccessService.js';

function mockScope(overrides?: Partial<InvestigatorAccessScope>): InvestigatorAccessScope {
  return {
    viewerMemberId: 'MEM-AAAAAAAA',
    allowedOwnerMemberIds: ['MEM-AAAAAAAA'],
    explicitlySharedIncidentIds: [],
    allowedIncidentIds: ['INC-A-PAYMENT'],
    ...overrides,
  };
}

describe('MCP member-scoped investigation queries', () => {
  it('includes owner scope predicate in every template', () => {
    const scope = mockScope();
    for (const intent of ['service_history', 'unresolved_incidents', 'related_resolutions', 'recurring_tasks'] as const) {
      const spec = buildInvestigationQuery(intent, 'payment-api', scope, 5);
      const sql = renderInvestigationSql(spec);
      expect(sql).toContain("service = 'payment-api'");
      expect(sql).toContain("source_owner_member_id IN ('MEM-AAAAAAAA')");
      expect(() => renderInvestigationSql(spec)).not.toThrow();
    }
  });

  it('includes explicitly shared incident ids in scope predicate', () => {
    const scope = mockScope({
      allowedOwnerMemberIds: ['MEM-AAAAAAAA'],
      explicitlySharedIncidentIds: ['INC-B-SHARED'],
      allowedIncidentIds: ['INC-A-PAYMENT', 'INC-B-SHARED'],
    });
    const sql = renderInvestigationSql(buildInvestigationQuery('service_history', 'billing', scope, 5));
    expect(sql).toContain("incident_id IN ('INC-B-SHARED')");
  });

  it('rejects empty investigator scope', () => {
    expect(() =>
      buildOwnerScopeSql({
        viewerMemberId: 'MEM-AAAAAAAA',
        allowedOwnerMemberIds: [],
        explicitlySharedIncidentIds: [],
        allowedIncidentIds: [],
      }),
    ).toThrow(/empty/i);
  });

  it('post-filter allows only authorized incident ids', () => {
    const scope = mockScope({ allowedIncidentIds: ['INC-A-PAYMENT'] });
    expect(isIncidentIdAllowed('INC-A-PAYMENT', scope)).toBe(true);
    expect(isIncidentIdAllowed('INC-B-PRIVATE', scope)).toBe(false);
  });

  it('viewer with grant sees granted owner incidents only via allowlist', () => {
    const scope = mockScope({
      allowedOwnerMemberIds: ['MEM-AAAAAAAA', 'MEM-BBBBBBBB'],
      allowedIncidentIds: ['INC-A-PAYMENT', 'INC-B-SHARED'],
      explicitlySharedIncidentIds: ['INC-B-SHARED'],
    });
    expect(isIncidentIdAllowed('INC-B-SHARED', scope)).toBe(true);
    expect(isIncidentIdAllowed('INC-B-PRIVATE', scope)).toBe(false);
  });

  it('builds query without scope when auth is disabled', () => {
    const spec = buildInvestigationQuery('service_history', 'checkout-api', null, 5);
    const sql = renderInvestigationSql(spec);
    expect(sql).toContain("service = 'checkout-api'");
    expect(sql).not.toContain('source_owner_member_id');
  });
});
