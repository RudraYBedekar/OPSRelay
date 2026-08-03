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
  evidenceVersion?: number;
}

export async function projectIncidentEvidence(input: EvidenceProjectionInput): Promise<void> {
  const summary = scanAndRedactSecrets(input.summary).redactedText.slice(0, 4000);
  const resolution = input.fixesApplied?.[0]
    ? scanAndRedactSecrets(input.fixesApplied[0]).redactedText.slice(0, 2000)
    : null;
  const decisionSummary = (input.decisions ?? [])
    .map((d) => d.title)
    .slice(0, 5)
    .join('; ')
    .slice(0, 2000) || null;
  const taskSummary = (input.tasks ?? [])
    .map((t) => t.title)
    .slice(0, 8)
    .join('; ')
    .slice(0, 2000) || null;

  const version = input.evidenceVersion ?? 1;
  const citationId = `CRDB-EVIDENCE:${input.incidentId}:v${version}`;

  await query(
    `INSERT INTO incident_evidence (
       incident_id, title, service, severity, status,
       approved_summary, approved_resolution, decision_summary, task_summary,
       source_updated_at, evidence_version, citation_id, projected_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12,now())
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
       projected_at = now()`,
    [
      input.incidentId,
      input.title.slice(0, 500),
      input.service.slice(0, 120),
      input.severity,
      input.status,
      summary,
      resolution,
      decisionSummary,
      taskSummary,
      input.sourceUpdatedAt,
      version,
      citationId,
    ],
  );
}
