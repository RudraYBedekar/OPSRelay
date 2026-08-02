import { query, queryOne } from '../db.js';
import { embedText, vectorToSql } from './embedService.js';

export type AlertStatus = 'active' | 'noise' | 'resolved';

export const SIMILARITY_THRESHOLD = 0.85;

export interface AlertRecord {
  id: string;
  alertText: string;
  service: string;
  firstSeen: string;
  lastSeen: string;
  suppressedCount: number;
  linkedIncidentId?: string;
  status: AlertStatus;
  distinctOverride: boolean;
  similarity?: number;
}

export interface AlertEvaluationResult {
  suppressed: boolean;
  matchedAlert?: AlertRecord;
  similarity?: number;
  message?: string;
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
): Promise<Array<AlertRecord & { similarity: number }>> {
  const embedding = await embedText(alertText);
  const vectorLiteral = vectorToSql(embedding.values);

  const rows = await query<{
    id: string;
    alert_text: string;
    service: string;
    first_seen: string;
    last_seen: string;
    suppressed_count: number;
    linked_incident_id: string | null;
    status: string;
    distinct_override: boolean;
    distance: number;
  }>(
    `SELECT id, alert_text, service, first_seen, last_seen, suppressed_count,
            linked_incident_id, status, distinct_override,
            (embedding <=> $1::VECTOR) AS distance
     FROM alert_embeddings
     WHERE service = $2
       AND last_seen >= now() - INTERVAL '7 days'
     ORDER BY embedding <=> $1::VECTOR
     LIMIT 5`,
    [vectorLiteral, service],
  );

  return rows.map((row) => ({
    id: row.id,
    alertText: row.alert_text,
    service: row.service,
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
    suppressedCount: row.suppressed_count,
    linkedIncidentId: row.linked_incident_id ?? undefined,
    status: row.status as AlertStatus,
    distinctOverride: row.distinct_override,
    similarity: cosineSimilarity(row.distance),
  }));
}

export async function evaluateAlert(
  alertText: string,
  service: string,
  options?: { forceDistinct?: boolean; overrideAlertId?: string },
): Promise<AlertEvaluationResult> {
  if (!alertText.trim() || !service.trim()) {
    return { suppressed: false };
  }

  if (options?.forceDistinct && options.overrideAlertId) {
    await query(
      `UPDATE alert_embeddings SET distinct_override = true, status = 'active', last_seen = now()
       WHERE id = $1`,
      [options.overrideAlertId],
    );
    return { suppressed: false };
  }

  if (options?.forceDistinct) {
    return { suppressed: false };
  }

  const matches = await searchSimilarAlerts(alertText, service);
  const best = matches[0];

  if (!best || best.similarity < SIMILARITY_THRESHOLD) {
    return { suppressed: false };
  }

  if (best.distinctOverride) {
    return { suppressed: false };
  }

  if (best.status === 'noise' || best.status === 'resolved') {
    await query(
      `UPDATE alert_embeddings
       SET suppressed_count = suppressed_count + 1, last_seen = now()
       WHERE id = $1`,
      [best.id],
    );

    const hours = Math.max(1, Math.round(
      (Date.now() - new Date(best.firstSeen).getTime()) / 3600000,
    ));

    return {
      suppressed: true,
      matchedAlert: { ...best, suppressedCount: best.suppressedCount + 1 },
      similarity: best.similarity,
      message: `Duplicate alert suppressed (${Math.round(best.similarity * 100)}% match). `
        + `This pattern fired ${best.suppressedCount + 1} time(s) in the last ${hours} hour(s).`,
    };
  }

  return { suppressed: false };
}

export async function recordAlertForIncident(
  alertText: string,
  service: string,
  incidentId: string,
): Promise<string> {
  const embedding = await embedText(alertText);
  const row = await queryOne<{ id: string }>(
    `INSERT INTO alert_embeddings (alert_text, embedding, service, linked_incident_id, status)
     VALUES ($1, $2::VECTOR, $3, $4, 'active')
     RETURNING id`,
    [alertText.slice(0, 8000), vectorToSql(embedding.values), service, incidentId],
  );
  return row!.id;
}

export async function markAlertResolvedForIncident(incidentId: string): Promise<void> {
  await query(
    `UPDATE alert_embeddings SET status = 'resolved', last_seen = now()
     WHERE linked_incident_id = $1 AND status = 'active'`,
    [incidentId],
  );
}

export async function markAlertAsNoise(alertId: string): Promise<void> {
  await query(
    `UPDATE alert_embeddings SET status = 'noise', last_seen = now() WHERE id = $1`,
    [alertId],
  );
}

export async function getAlertStatsForIncident(
  incidentId: string,
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
     WHERE linked_incident_id = $1
     ORDER BY first_seen ASC
     LIMIT 1`,
    [incidentId],
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
      ? `This alert has fired ${totalFires} times in the last ${hoursWindow} hour(s); ${row.suppressed_count} duplicate(s) were suppressed.`
      : 'First occurrence — no duplicates suppressed yet.',
  };
}

export async function getAlertById(alertId: string): Promise<AlertRecord | null> {
  const row = await queryOne<{
    id: string;
    alert_text: string;
    service: string;
    first_seen: string;
    last_seen: string;
    suppressed_count: number;
    linked_incident_id: string | null;
    status: string;
    distinct_override: boolean;
  }>('SELECT * FROM alert_embeddings WHERE id = $1', [alertId]);

  if (!row) return null;

  return {
    id: row.id,
    alertText: row.alert_text,
    service: row.service,
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
    suppressedCount: row.suppressed_count,
    linkedIncidentId: row.linked_incident_id ?? undefined,
    status: row.status as AlertStatus,
    distinctOverride: row.distinct_override,
  };
}
