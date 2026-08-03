import { query, queryOne, withTransaction, queryWithClient } from '../db.js';
import { bedrockConfig, isBedrockConfigured } from '../config/bedrock.js';
import { extractIncidentFromNotes } from './llmService.js';
import { parseExtractionResult } from '../schemas/extraction.js';
import { scanAndRedactSecrets, assertNotesSafeForProcessing } from '../utils/redactSecrets.js';
import { enqueuePostApprovalJobs } from './incidentJobService.js';
import type { AuthUser } from './authService.js';
import { PROMPT_VERSION, type AnalysisStatus } from '../types/analysis.js';
import { normalizeIncidentForSave } from '../utils/incidentTasks.js';
import { generateIncidentId } from '../utils/incidentId.js';

export interface AgentRunRecord {
  id: string;
  incidentId: string;
  status: string;
  outputJson?: unknown;
  confidence?: number;
  warnings: unknown[];
  errorCode?: string;
  createdAt: string;
  completedAt?: string;
  approvedAt?: string;
}

export async function getLatestRun(incidentId: string, ownerMemberId: string): Promise<AgentRunRecord | null> {
  const row = await queryOne<{
    id: string;
    incident_id: string;
    status: string;
    output_json: unknown;
    confidence: number | null;
    warnings: unknown;
    error_code: string | null;
    created_at: string;
    completed_at: string | null;
    approved_at: string | null;
  }>(
    `SELECT id, incident_id, status, output_json, confidence, warnings, error_code,
            created_at, completed_at, approved_at
     FROM agent_runs
     WHERE incident_id = $1 AND owner_member_id = $2
     ORDER BY created_at DESC LIMIT 1`,
    [incidentId, ownerMemberId],
  );
  if (!row) return null;
  return {
    id: row.id,
    incidentId: row.incident_id,
    status: row.status,
    outputJson: row.output_json ?? undefined,
    confidence: row.confidence != null ? Number(row.confidence) : undefined,
    warnings: Array.isArray(row.warnings) ? row.warnings : [],
    errorCode: row.error_code ?? undefined,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
    approvedAt: row.approved_at ?? undefined,
  };
}

export async function startAnalysisRun(
  incidentId: string,
  user: AuthUser,
  idempotencyKey: string,
): Promise<AgentRunRecord> {
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM agent_runs WHERE owner_member_id = $1 AND idempotency_key = $2`,
    [user.memberId, idempotencyKey],
  );
  if (existing) {
    const run = await getLatestRun(incidentId, user.memberId);
    if (run) return run;
  }

  const incidentRow = await queryOne<{ data: Record<string, unknown> }>(
    'SELECT data FROM incidents WHERE id = $1',
    [incidentId],
  );
  if (!incidentRow) throw new Error('Incident not found');

  const incident = { ...incidentRow.data };
  const rawNotes = String(incident.rawNotes ?? '');
  if (!rawNotes.trim()) throw new Error('Incident has no notes to analyze');

  const runRow = await queryOne<{ id: string }>(
    `INSERT INTO agent_runs (incident_id, owner_member_id, run_type, status, idempotency_key, model_id, prompt_version)
     VALUES ($1, $2, 'extraction', 'running', $3, $4, $5)
     RETURNING id`,
    [incidentId, user.memberId, idempotencyKey, bedrockConfig.llmModel, PROMPT_VERSION],
  );

  incident.analysisStatus = 'running';
  await query(
    'UPDATE incidents SET data = $2::jsonb, updated_at = now() WHERE id = $1',
    [incidentId, JSON.stringify(incident)],
  );

  const started = Date.now();
  try {
    if (!isBedrockConfigured()) {
      throw new Error('bedrock_not_configured');
    }
    const redacted = scanAndRedactSecrets(rawNotes).redactedText;
    const output = await extractIncidentFromNotes(redacted);
    const validated = parseExtractionResult(output);

    await query(
      `UPDATE agent_runs
       SET status = 'review_required', output_json = $2::jsonb, confidence = $3,
           warnings = '[]'::jsonb, latency_ms = $4, completed_at = now()
       WHERE id = $1`,
      [runRow!.id, JSON.stringify(validated), validated.confidenceScore ?? 85, Date.now() - started],
    );

    incident.analysisStatus = 'review_required';
    await query(
      'UPDATE incidents SET data = $2::jsonb, updated_at = now() WHERE id = $1',
      [incidentId, JSON.stringify(incident)],
    );
  } catch (err) {
    const code = err instanceof Error ? err.message.slice(0, 80) : 'analysis_failed';
    await query(
      `UPDATE agent_runs SET status = 'failed', error_code = $2, latency_ms = $3, completed_at = now()
       WHERE id = $1`,
      [runRow!.id, code, Date.now() - started],
    );
    incident.analysisStatus = 'failed';
    await query(
      'UPDATE incidents SET data = $2::jsonb, updated_at = now() WHERE id = $1',
      [incidentId, JSON.stringify(incident)],
    );
  }

  return (await getLatestRun(incidentId, user.memberId))!;
}

export async function approveAnalysisRun(
  incidentId: string,
  runId: string,
  user: AuthUser,
  draft: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const validated = parseExtractionResult(draft);

  const incident = await withTransaction(async (client) => {
    const run = await queryWithClient<{ status: string; owner_member_id: string }>(
      client,
      'SELECT status, owner_member_id FROM agent_runs WHERE id = $1 AND incident_id = $2',
      [runId, incidentId],
    );
    if (!run[0] || run[0].owner_member_id !== user.memberId) {
      throw new Error('Analysis run not found');
    }
    if (run[0].status === 'approved') {
      throw Object.assign(new Error('Analysis already approved'), { status: 409 });
    }

    const incRow = await queryWithClient<{ data: Record<string, unknown> }>(
      client,
      'SELECT data FROM incidents WHERE id = $1',
      [incidentId],
    );
    if (!incRow[0]) throw new Error('Incident not found');

    const updated = normalizeIncidentForSave({
      ...incRow[0].data,
      id: incidentId,
      title: `${validated.service} — ${validated.component}`,
      summary: validated.summary,
      severity: validated.severity,
      service: validated.service,
      component: validated.component,
      analysisStatus: 'approved',
      aiConfidence: validated.confidenceScore ?? 85,
      timeline: validated.timeline.map((t, i) => ({ ...t, id: `tl-${i}` })),
      decisions: validated.decisions.map((d, i) => ({ ...d, id: `dec-${i}` })),
      fixesApplied: validated.suggestedFixes,
      tasks: validated.tasks.map((t, i) => ({
        ...t,
        id: `tsk-${i}`,
        incidentId,
        incidentTitle: `${validated.service} — ${validated.component}`,
      })),
    } as never);

    await queryWithClient(
      client,
      'UPDATE incidents SET data = $2::jsonb, updated_at = now() WHERE id = $1',
      [incidentId, JSON.stringify(updated)],
    );

    await queryWithClient(
      client,
      `UPDATE agent_runs SET status = 'approved', approved_at = now(), output_json = $2::jsonb WHERE id = $1`,
      [runId, JSON.stringify(validated)],
    );

    return updated as Record<string, unknown>;
  });

  await enqueuePostApprovalJobs(incidentId);
  return incident;
}

export async function createIntakeIncident(
  user: AuthUser,
  input: { title?: string; rawNotes: string },
): Promise<Record<string, unknown>> {
  assertNotesSafeForProcessing(input.rawNotes);
  const redacted = scanAndRedactSecrets(input.rawNotes).redactedText;

  const id = generateIncidentId();
  const now = new Date().toISOString();
  const firstLine = redacted.split('\n').find((l) => l.trim()) ?? 'Incident report';

  const incident = {
    id,
    title: input.title?.trim() || firstLine.slice(0, 120),
    service: 'general',
    component: 'intake',
    severity: 'SEV-2',
    status: 'INVESTIGATING',
    summary: firstLine.slice(0, 280),
    createdAt: now,
    leadSRE: user.name,
    shiftId: 'SHIFT-CURRENT',
    aiConfidence: 0,
    rawNotes: redacted,
    analysisStatus: 'not_started' as AnalysisStatus,
    ownerMemberId: user.memberId,
    ownerName: user.name,
    timeline: [],
    decisions: [],
    fixesApplied: [],
    tasks: [],
    similarIncidents: [],
  };

  await query(
    `INSERT INTO incidents (id, data, created_at, updated_at)
     VALUES ($1, $2::jsonb, $3::timestamptz, now())`,
    [id, JSON.stringify(incident), now],
  );

  return { ...incident, savedAt: now };
}
