import { secureQuery, secureQueryOne } from '../secureDb.js';
import { isAuthEnabled } from '../config/auth.js';
import type { AuthUser } from './authService.js';

export interface AccessRequest {
  id: string;
  requesterMemberId: string;
  requesterName: string;
  ownerMemberId: string;
  status: 'pending' | 'approved' | 'rejected';
  message?: string;
  createdAt: string;
  respondedAt?: string;
}

interface RequestRow {
  id: string;
  requester_member_id: string;
  requester_name: string;
  owner_member_id: string;
  status: string;
  message: string | null;
  created_at: string;
  responded_at: string | null;
}

function mapRequest(row: RequestRow): AccessRequest {
  return {
    id: row.id,
    requesterMemberId: row.requester_member_id,
    requesterName: row.requester_name,
    ownerMemberId: row.owner_member_id,
    status: row.status as AccessRequest['status'],
    message: row.message ?? undefined,
    createdAt: row.created_at,
    respondedAt: row.responded_at ?? undefined,
  };
}

export async function migrateAccessSchema(): Promise<void> {
  await secureQuery(`
    CREATE TABLE IF NOT EXISTS access_requests (
      id                  STRING PRIMARY KEY DEFAULT gen_random_uuid()::STRING,
      requester_member_id STRING NOT NULL,
      requester_name      STRING NOT NULL,
      owner_member_id     STRING NOT NULL,
      status              STRING NOT NULL DEFAULT 'pending',
      message             STRING,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      responded_at        TIMESTAMPTZ
    )
  `);
  await secureQuery(`
    CREATE TABLE IF NOT EXISTS member_access_grants (
      id                  STRING PRIMARY KEY DEFAULT gen_random_uuid()::STRING,
      owner_member_id     STRING NOT NULL,
      viewer_member_id    STRING NOT NULL,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (owner_member_id, viewer_member_id)
    )
  `);
  await secureQuery(
    'CREATE INDEX IF NOT EXISTS idx_access_requests_owner ON access_requests (owner_member_id, status)',
  );
  await secureQuery(
    'CREATE INDEX IF NOT EXISTS idx_access_requests_requester ON access_requests (requester_member_id, status)',
  );
}

export async function getGrantedOwnerMemberIds(viewerMemberId: string): Promise<string[]> {
  const rows = await secureQuery<{ owner_member_id: string }>(
    'SELECT owner_member_id FROM member_access_grants WHERE viewer_member_id = $1',
    [viewerMemberId],
  );
  return rows.map((r) => r.owner_member_id);
}

export function canViewIncident(
  incident: { ownerMemberId?: string; sharedWithMemberIds?: string[] },
  viewer: AuthUser | undefined,
  grantedOwnerIds: Set<string>,
): boolean {
  if (!isAuthEnabled() || !viewer) return true;

  const owner = incident.ownerMemberId;
  if (!owner) return false;
  if (owner === viewer.memberId) return true;
  if (grantedOwnerIds.has(owner)) return true;
  if (incident.sharedWithMemberIds?.includes(viewer.memberId)) return true;
  return false;
}

/** Only the incident owner (or admin) may edit incidents and manage tasks. */
export function canEditIncident(
  incident: { ownerMemberId?: string },
  viewer: AuthUser | undefined,
): boolean {
  if (!isAuthEnabled() || !viewer) return true;

  const owner = incident.ownerMemberId;
  if (!owner) return viewer.role === 'admin';
  if (viewer.role === 'admin') return true;
  return owner === viewer.memberId;
}

export function canManageTasks(
  incident: { ownerMemberId?: string },
  viewer: AuthUser | undefined,
): boolean {
  return canEditIncident(incident, viewer);
}

export function canReindexCorpus(viewer: AuthUser | undefined): boolean {
  if (!isAuthEnabled() || !viewer) return true;
  return viewer.role === 'admin';
}

export function normalizeMemberId(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidMemberIdFormat(memberId: string): boolean {
  return /^MEM-[A-Z0-9]{8}$/.test(normalizeMemberId(memberId));
}

export async function memberIdExists(memberId: string): Promise<boolean> {
  const row = await secureQueryOne<{ member_id: string }>(
    'SELECT member_id FROM users WHERE member_id = $1',
    [normalizeMemberId(memberId)],
  );
  return Boolean(row);
}

/** Validate and normalize share targets when sending an incident to other members. */
export async function normalizeShareTargets(
  ownerMemberId: string,
  targets: string[] | undefined,
): Promise<string[]> {
  if (!targets?.length) return [];

  const normalized = [...new Set(targets.map(normalizeMemberId).filter(Boolean))].filter(
    (id) => id !== ownerMemberId,
  );

  for (const id of normalized) {
    if (!isValidMemberIdFormat(id)) {
      throw new Error(`Invalid member ID: ${id}`);
    }
    if (!(await memberIdExists(id))) {
      throw new Error(`No user found with member ID ${id}`);
    }
  }

  return normalized;
}

export async function filterIncidentsForUser<T extends { ownerMemberId?: string; sharedWithMemberIds?: string[] }>(
  incidents: T[],
  viewer: AuthUser | undefined,
): Promise<T[]> {
  if (!isAuthEnabled() || !viewer) return incidents;

  const granted = new Set(await getGrantedOwnerMemberIds(viewer.memberId));
  return incidents.filter((inc) => canViewIncident(inc, viewer, granted));
}

export async function shareIncidentWithMember(
  incident: { ownerMemberId?: string; sharedWithMemberIds?: string[] },
  owner: AuthUser,
  recipientMemberId: string,
): Promise<string[]> {
  if (incident.ownerMemberId && incident.ownerMemberId !== owner.memberId) {
    throw new Error('Only the incident owner can share this incident.');
  }
  const existing = incident.sharedWithMemberIds ?? [];
  return normalizeShareTargets(owner.memberId, [...existing, recipientMemberId]);
}

export async function createAccessRequest(
  requester: AuthUser,
  ownerMemberId: string,
  message?: string,
): Promise<AccessRequest> {
  const ownerMemberIdNorm = ownerMemberId.trim().toUpperCase();
  if (!/^MEM-[A-Z0-9]{8}$/.test(ownerMemberIdNorm)) {
    throw new Error('Invalid member ID format. Use MEM-XXXXXXXX.');
  }
  if (ownerMemberIdNorm === requester.memberId) {
    throw new Error('You cannot request access to your own incidents.');
  }

  const owner = await secureQueryOne<{ member_id: string }>(
    'SELECT member_id FROM users WHERE member_id = $1',
    [ownerMemberIdNorm],
  );
  if (!owner) {
    throw new Error('No user found with that member ID.');
  }

  const existingGrant = await secureQueryOne<{ id: string }>(
    'SELECT id FROM member_access_grants WHERE owner_member_id = $1 AND viewer_member_id = $2',
    [ownerMemberIdNorm, requester.memberId],
  );
  if (existingGrant) {
    throw new Error('You already have access to this member\'s incidents.');
  }

  const pending = await secureQueryOne<{ id: string }>(
    `SELECT id FROM access_requests
     WHERE requester_member_id = $1 AND owner_member_id = $2 AND status = 'pending'`,
    [requester.memberId, ownerMemberIdNorm],
  );
  if (pending) {
    throw new Error('You already have a pending request to this member.');
  }

  const rows = await secureQuery<RequestRow>(
    `INSERT INTO access_requests (requester_member_id, requester_name, owner_member_id, message)
     VALUES ($1, $2, $3, $4)
     RETURNING id, requester_member_id, requester_name, owner_member_id, status, message, created_at, responded_at`,
    [requester.memberId, requester.name, ownerMemberIdNorm, message?.trim() || null],
  );
  return mapRequest(rows[0]);
}

export async function listIncomingRequests(ownerMemberId: string): Promise<AccessRequest[]> {
  const rows = await secureQuery<RequestRow>(
    `SELECT id, requester_member_id, requester_name, owner_member_id, status, message, created_at, responded_at
     FROM access_requests
     WHERE owner_member_id = $1
     ORDER BY created_at DESC`,
    [ownerMemberId],
  );
  return rows.map(mapRequest);
}

export async function listOutgoingRequests(requesterMemberId: string): Promise<AccessRequest[]> {
  const rows = await secureQuery<RequestRow>(
    `SELECT id, requester_member_id, requester_name, owner_member_id, status, message, created_at, responded_at
     FROM access_requests
     WHERE requester_member_id = $1
     ORDER BY created_at DESC`,
    [requesterMemberId],
  );
  return rows.map(mapRequest);
}

export async function respondToAccessRequest(
  requestId: string,
  ownerMemberId: string,
  approve: boolean,
): Promise<AccessRequest> {
  const row = await secureQueryOne<RequestRow>(
    `SELECT id, requester_member_id, requester_name, owner_member_id, status, message, created_at, responded_at
     FROM access_requests
     WHERE id = $1 AND owner_member_id = $2`,
    [requestId, ownerMemberId],
  );
  if (!row) throw new Error('Access request not found.');
  if (row.status !== 'pending') throw new Error('This request was already handled.');

  const newStatus = approve ? 'approved' : 'rejected';
  await secureQuery(
    `UPDATE access_requests SET status = $2, responded_at = now() WHERE id = $1`,
    [requestId, newStatus],
  );

  if (approve) {
    await secureQuery(
      `INSERT INTO member_access_grants (owner_member_id, viewer_member_id)
       VALUES ($1, $2)
       ON CONFLICT (owner_member_id, viewer_member_id) DO NOTHING`,
      [row.owner_member_id, row.requester_member_id],
    );
  }

  return mapRequest({ ...row, status: newStatus, responded_at: new Date().toISOString() });
}

export async function listGrantsForOwner(ownerMemberId: string): Promise<Array<{ viewerMemberId: string; createdAt: string }>> {
  const rows = await secureQuery<{ viewer_member_id: string; created_at: string }>(
    'SELECT viewer_member_id, created_at FROM member_access_grants WHERE owner_member_id = $1 ORDER BY created_at DESC',
    [ownerMemberId],
  );
  return rows.map((r) => ({ viewerMemberId: r.viewer_member_id, createdAt: r.created_at }));
}
