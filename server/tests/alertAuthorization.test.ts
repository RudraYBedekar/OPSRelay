import { describe, expect, it } from 'vitest';
import {
  canViewAlertForIncident,
  canManageAlertForIncident,
  canViewIncident,
  canEditIncident,
} from '../services/incidentAccessService.js';
import type { AuthUser } from '../services/authService.js';

const owner: AuthUser = {
  id: '1',
  memberId: 'MEM-AAAAAAAA',
  userId: 'owner',
  email: 'owner@test.io',
  name: 'Owner',
  role: 'operator',
};

const viewer: AuthUser = {
  id: '2',
  memberId: 'MEM-BBBBBBBB',
  userId: 'viewer',
  email: 'viewer@test.io',
  name: 'Viewer',
  role: 'operator',
};

const stranger: AuthUser = {
  id: '3',
  memberId: 'MEM-CCCCCCCC',
  userId: 'stranger',
  email: 'stranger@test.io',
  name: 'Stranger',
  role: 'operator',
};

const incident = {
  ownerMemberId: owner.memberId,
  sharedWithMemberIds: [viewer.memberId],
};

describe('alert authorization', () => {
  it('allows owner to manage alerts for their incident', () => {
    expect(canManageAlertForIncident(incident, owner)).toBe(true);
  });

  it('allows shared viewer to view but not manage alerts', () => {
    expect(canViewAlertForIncident(incident, viewer, new Set())).toBe(true);
    expect(canManageAlertForIncident(incident, viewer)).toBe(false);
  });

  it('denies unrelated user view and manage', () => {
    expect(canViewAlertForIncident(incident, stranger, new Set())).toBe(false);
    expect(canManageAlertForIncident(incident, stranger)).toBe(false);
  });

  it('uses same visibility rules as incident access', () => {
    expect(canViewIncident(incident, viewer, new Set())).toBe(true);
    expect(canEditIncident(incident, viewer)).toBe(false);
  });
});

describe('investigator role', () => {
  it('restricts investigator to admins when auth is enabled', async () => {
    const { canUseInvestigator } = await import('../services/incidentAccessService.js');
    const admin = { ...owner, role: 'admin' as const };
    // When AUTH_ENABLED is true in env, operators are denied
    if (process.env.AUTH_ENABLED !== 'false') {
      expect(canUseInvestigator(admin)).toBe(true);
      expect(canUseInvestigator(viewer)).toBe(false);
    }
  });
});
