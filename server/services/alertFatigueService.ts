import { query, queryOne } from '../db.js';
import { embedText, vectorToSql } from './embedService.js';

export type AlertStatus = 'active' | 'noise' | 'resolved';

export const SIMILARITY_THRESHOLD = 0.85;

export interface AlertMatchSummary {
  id: string;
  linkedIncidentId?: string;
  service: string;
  firstSeen: string;
  lastSeen: string;
  suppressedCount: number;
  status: AlertStatus;
  similarity: number;
}

export interface DuplicateCandidateResult {
  state: 'none' | 'candidate';
  matchedAlertId?: string;
  matchedIncidentId?: string;
  similarity?: number;
  message?: string;
  match?: AlertMatchSummary;
}

export interface AlertIncidentStats {
  alertId: string;
  suppressedCount: number;
  firstSeen: string;
  lastSeen: string;
  hoursSinceFirst: number;
  status: AlertStatus;
  summaryMessage: string;
}

function cosineSimilarity(distance: number): number {
  return Math.max(0, 1 - distance);
}

function mapMatchRow(row: {
  id: string;
  service: string;
  first_seen: string;
  last_seen: string;
  suppressed_count: number;
  linked_incident_id: string | null;
  status: string;
  distance: number;
}): AlertMatchSummary {
  return {
    id: row.id,
    linkedIncidentId: row.linked_incident_id ?? undefined,
    service: row.service,
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
    suppressedCount: row.suppressed_count,
    status: row.status as AlertStatus,
    similarity: cosineSimilarity(row.distance),
  };
}

export function buildAlertText(input: {
  title?: string;
  summary?: string;
  rawNotes?: string;
}): string {
  const parts = [input.title, input.summary, input.rawNotes?.slice(0, 2000)].filter(Boolean);
  return parts.join('. ').trim();
}

async function searchSimilarAlerts(
  alertText: string,
  service: string,
  ownerMemberId: string,
): Promise<AlertMatchSummary[]> {
  const embedding = await embedText(alertText);
  const vectorLiteral = vectorToSql(embedding.values);

  const rows = await query<{
    id: string;
    service: string;
    first_seen: string;
    last_seen: string;
    suppressed_count: number;
    linked_incident_id: string | null;
    status: string;
    distance: number;
  }>(
    `SELECT id, service, first_seen, last_seen, suppressed_count,
            linked_incident_id, status,
            (embedding <=> $1::VECTOR) AS distance
     FROM alert_embeddings
     WHERE owner_member_id = $3
       AND owner_member_id IS NOT NULL
       AND service = $2
       AND last_seen >= now() - INTERVAL '7 days'
     ORDER BY embedding <=> $1::VECTOR
     LIMIT 5`,
    [vectorLiteral, service, ownerMemberId],
  );

  return rows.map(mapMatchRow);
}

/** Advisory duplicate check — never blocks incident persistence. */
export async function evaluateDuplicateCandidate(
  alertText: string,
  service: string,
  ownerMemberId: string,
): Promise<DuplicateCandidateResult> {
  if (!alertText.trim() || !service.trim() || !ownerMemberId) {
    return { state: 'none' };
  }

  const matches = await searchSimilarAlerts(alertText, service, ownerMemberId);
  const best = matches[0];

  if (!best || best.similarity < SIMILARITY_THRESHOLD) {
    return { state: 'none' };
  }

  if (best.status === 'noise' || best.status === 'resolved') {
    const hours = Math.max(1, Math.round(
      (Date.now() - new Date(best.firstSeen).getTime()) / 3600000,
    ));
    return {
      state: 'candidate',
      matchedAlertId: best.id,
      matchedIncidentId: best.linkedIncidentId,
      similarity: best.similarity,
      match: best,
      message: `Possible duplicate (${Math.round(best.similarity * 100)}% match). `
        + `Similar pattern seen ${best.suppressedCount + 1} time(s) in the last ${hours} hour(s).`,
    };
  }

  return { state: 'none' };
}

export async function recordAlertForIncident(
  alertText: string,
  service: string,
  incidentId: string,
  ownerMemberId: string,
): Promise<string> {
  const embedding = await embedText(alertText);
  const row = await queryOne<{ id: string }>(
    `INSERT INTO alert_embeddings (alert_text, embedding, service, linked_incident_id, status, owner_member_id)
     VALUES ($1, $2::VECTOR, $3, $4, 'active', $5)
     RETURNING id`,
    [alertText.slice(0, 8000), vectorToSql(embedding.values), service, incidentId, ownerMemberId],
  );
  return row!.id;
}

export async function markAlertResolvedForIncident(
  incidentId: string,
  ownerMemberId: string,
): Promise<void> {
  await query(
    `UPDATE alert_embeddings SET status = 'resolved', last_seen = now()
     WHERE linked_incident_id = $1 AND owner_member_id = $2 AND status = 'active'`,
    [incidentId, ownerMemberId],
  );
}

export async function markAlertAsNoise(alertId: string, ownerMemberId: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE alert_embeddings SET status = 'noise', last_seen = now()
     WHERE id = $1 AND owner_member_id = $2
     RETURNING id`,
    [alertId, ownerMemberId],
  );
  return rows.length > 0;
}

export async function markAlertDistinct(alertId: string, ownerMemberId: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE alert_embeddings SET distinct_override = true, status = 'active', last_seen = now()
     WHERE id = $1 AND owner_member_id = $2
     RETURNING id`,
    [alertId, ownerMemberId],
  );
  return rows.length > 0;
}

export async function getAlertStatsForIncident(
  incidentId: string,
  ownerMemberId: string,
): Promise<AlertIncidentStats | null> {
  const row = await queryOne<{
    id: string;
    suppressed_count: number;
    first_seen: string;
    last_seen: string;
    status: string;
  }>(
    `SELECT id, suppressed_count, first_seen, last_seen, status
     FROM alert_embeddings
     WHERE linked_incident_id = $1 AND owner_member_id = $2
     ORDER BY first_seen ASC
     LIMIT 1`,
    [incidentId, ownerMemberId],
  );

  if (!row) return null;

  const hoursSinceFirst = Math.max(
    1,
    Math.round((Date.now() - new Date(row.first_seen).getTime()) / 3600000),
  );
  const totalFires = row.suppressed_count + 1;
  const hoursWindow = Math.min(hoursSinceFirst, 24);

  return {
    alertId: row.id,
    suppressedCount: row.suppressed_count,
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
    hoursSinceFirst,
    status: row.status as AlertStatus,
    summaryMessage: totalFires > 1
      ? `This alert has fired ${totalFires} times in the last ${hoursWindow} hour(s); ${row.suppressed_count} duplicate(s) were flagged.`
      : 'First occurrence — no duplicates flagged yet.',
  };
}

export async function getAlertByIdForOwner(
  alertId: string,
  ownerMemberId: string,
): Promise<AlertMatchSummary | null> {
  const row = await queryOne<{
    id: string;
    service: string;
    first_seen: string;
    last_seen: string;
    suppressed_count: number;
    linked_incident_id: string | null;
    status: string;
  }>(
    `SELECT id, service, first_seen, last_seen, suppressed_count, linked_incident_id, status
     FROM alert_embeddings WHERE id = $1 AND owner_member_id = $2`,
    [alertId, ownerMemberId],
  );

  if (!row) return null;

  return {
    id: row.id,
    linkedIncidentId: row.linked_incident_id ?? undefined,
    service: row.service,
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
    suppressedCount: row.suppressed_count,
    status: row.status as AlertStatus,
    similarity: 1,
  };
}

export async function incrementSuppressedCount(
  alertId: string,
  ownerMemberId: string,
): Promise<void> {
  await query(
    `UPDATE alert_embeddings
     SET suppressed_count = suppressed_count + 1, last_seen = now()
     WHERE id = $1 AND owner_member_id = $2`,
    [alertId, ownerMemberId],
  );
}
