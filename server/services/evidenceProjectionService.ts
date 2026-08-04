import { createHash } from 'node:crypto';
import { query } from '../db.js';
import { scanAndRedactSecrets } from '../utils/redactSecrets.js';

export interface EvidenceProjectionInput {
  incidentId: string;
  title: string;
  service: string;
  severity: string;
  status: string;
  summary: string;
  fixesApplied?: string[];
  decisions?: Array<{ title: string; description?: string }>;
  tasks?: Array<{ title: string }>;
  sourceUpdatedAt: string;
  ownerScope?: string;
}

export function sanitizeEvidenceText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const redacted = scanAndRedactSecrets(value).redactedText
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')
    .trim();
  if (!redacted) return null;
  return redacted.slice(0, maxLength);
}

export async function projectIncidentEvidence(input: EvidenceProjectionInput): Promise<void> {
  const title = sanitizeEvidenceText(input.title, 200) ?? 'Untitled incident';
  const service = sanitizeEvidenceText(input.service, 120) ?? 'general';
  const severity = sanitizeEvidenceText(input.severity, 16) ?? 'SEV-2';
  const status = sanitizeEvidenceText(input.status, 32) ?? 'INVESTIGATING';
  const summary = sanitizeEvidenceText(input.summary, 4000);
  if (!summary) throw new Error('evidence_summary_required');

  const resolution = sanitizeEvidenceText(input.fixesApplied?.[0], 2000);
  const decisionSummary = sanitizeEvidenceText(
    (input.decisions ?? []).map((d) => d.title).slice(0, 5).join('; '),
    2000,
  );
  const taskSummary = sanitizeEvidenceText(
    (input.tasks ?? []).map((t) => t.title).slice(0, 8).join('; '),
    2000,
  );
  const ownerScope = sanitizeEvidenceText(input.ownerScope, 64);

  const contentHash = createHash('sha256')
    .update([title, service, severity, status, summary, resolution ?? '', decisionSummary ?? '', taskSummary ?? ''].join('|'))
    .digest('hex');

  const existing = await query<{ evidence_version: number; content_hash: string | null }>(
    'SELECT evidence_version, content_hash FROM incident_evidence WHERE incident_id = $1',
    [input.incidentId],
  );

  let version = 1;
  if (existing[0]) {
    if (existing[0].content_hash === contentHash) {
      return; // unchanged — preserve citation version
    }
    version = Number(existing[0].evidence_version) + 1;
  }

  const citationId = `CRDB-EVIDENCE:${input.incidentId}:v${version}`;

  await query(
    `INSERT INTO incident_evidence (
       incident_id, title, service, severity, status,
       approved_summary, approved_resolution, decision_summary, task_summary,
       source_updated_at, evidence_version, citation_id, content_hash, source_owner_scope, projected_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12,$13,$14,now())
     ON CONFLICT (incident_id) DO UPDATE SET
       title = EXCLUDED.title,
       service = EXCLUDED.service,
       severity = EXCLUDED.severity,
       status = EXCLUDED.status,
       approved_summary = EXCLUDED.approved_summary,
       approved_resolution = EXCLUDED.approved_resolution,
       decision_summary = EXCLUDED.decision_summary,
       task_summary = EXCLUDED.task_summary,
       source_updated_at = EXCLUDED.source_updated_at,
       evidence_version = EXCLUDED.evidence_version,
       citation_id = EXCLUDED.citation_id,
       content_hash = EXCLUDED.content_hash,
       source_owner_scope = EXCLUDED.source_owner_scope,
       projected_at = now()`,
    [
      input.incidentId,
      title,
      service,
      severity,
      status,
      summary,
      resolution,
      decisionSummary,
      taskSummary,
      input.sourceUpdatedAt,
      version,
      citationId,
      contentHash,
      ownerScope,
    ],
  );
}
