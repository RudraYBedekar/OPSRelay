import { query, queryOne, withTransaction, queryWithClient } from '../db.js';
import { bedrockConfig, isBedrockConfigured } from '../config/bedrock.js';
import { extractIncidentFromNotes } from './llmService.js';
import { parseExtractionResult } from '../schemas/extraction.js';
import { scanAndRedactSecrets, assertNotesSafeForProcessing } from '../utils/redactSecrets.js';
import { enqueuePostApprovalJobs } from './incidentJobService.js';
import { indexIncident, type IncidentRecord } from './vectorService.js';
import { projectIncidentEvidence } from './evidenceProjectionService.js';
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

const SAFE_ERROR_CODES = new Set([
  'BEDROCK_NOT_CONFIGURED',
  'BEDROCK_THROTTLED',
  'BEDROCK_TIMEOUT',
  'BEDROCK_INVALID_OUTPUT',
  'EMBEDDING_DIMENSION_MISMATCH',
  'DATABASE_UNAVAILABLE',
  'ANALYSIS_FAILED',
]);

function sanitizeAnalysisError(err: unknown): string {
  const raw = err instanceof Error ? err.message.toLowerCase() : '';
  if (raw.includes('bedrock_not_configured') || raw.includes('not configured')) {
    return 'BEDROCK_NOT_CONFIGURED';
  }
  if (raw.includes('throttl') || raw.includes('429')) return 'BEDROCK_THROTTLED';
  if (raw.includes('timeout') || raw.includes('timed out')) return 'BEDROCK_TIMEOUT';
  if (raw.includes('zod') || raw.includes('invalid') || raw.includes('parse')) {
    return 'BEDROCK_INVALID_OUTPUT';
  }
  if (raw.includes('econn') || raw.includes('database')) return 'DATABASE_UNAVAILABLE';
  return 'ANALYSIS_FAILED';
}

function mapRun(row: {
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
}): AgentRunRecord {
  return {
    id: row.id,
    incidentId: row.incident_id,
    status: row.status,
    outputJson: row.output_json ?? undefined,
    confidence: row.confidence != null ? Number(row.confidence) : undefined,
    warnings: Array.isArray(row.warnings) ? row.warnings : [],
    errorCode: row.error_code && SAFE_ERROR_CODES.has(row.error_code)
      ? row.error_code
      : row.error_code
        ? 'ANALYSIS_FAILED'
        : undefined,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
    approvedAt: row.approved_at ?? undefined,
  };
}

async function patchIncidentAnalysisStatus(
  incidentId: string,
  status: AnalysisStatus,
): Promise<void> {
  await query(
    `UPDATE incidents
     SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{analysisStatus}', to_jsonb($2::text), true),
         updated_at = now()
     WHERE id = $1`,
    [incidentId, status],
  );
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
  return row ? mapRun(row) : null;
}

async function getRunByIdempotency(
  incidentId: string,
  ownerMemberId: string,
  idempotencyKey: string,
): Promise<AgentRunRecord | null> {
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
     WHERE incident_id = $1 AND owner_member_id = $2 AND idempotency_key = $3`,
    [incidentId, ownerMemberId, idempotencyKey],
  );
  return row ? mapRun(row) : null;
}

export async function startAnalysisRun(
  incidentId: string,
  user: AuthUser,
  idempotencyKey: string,
): Promise<AgentRunRecord> {
  const inserted = await queryOne<{ id: string }>(
    `INSERT INTO agent_runs (incident_id, owner_member_id, run_type, status, idempotency_key, model_id, prompt_version)
     VALUES ($1, $2, 'extraction', 'running', $3, $4, $5)
     ON CONFLICT (owner_member_id, incident_id, idempotency_key) DO NOTHING
     RETURNING id`,
    [incidentId, user.memberId, idempotencyKey, bedrockConfig.llmModel, PROMPT_VERSION],
  );

  if (!inserted) {
    const existing = await getRunByIdempotency(incidentId, user.memberId, idempotencyKey);
    if (existing) return existing;
    throw Object.assign(new Error('Analysis run conflict'), { status: 409 });
  }

  const incidentRow = await queryOne<{ data: Record<string, unknown> }>(
    'SELECT data FROM incidents WHERE id = $1',
    [incidentId],
  );
  if (!incidentRow) throw new Error('Incident not found');

  const rawNotes = String(incidentRow.data.rawNotes ?? '');
  if (!rawNotes.trim()) throw new Error('Incident has no notes to analyze');

  await patchIncidentAnalysisStatus(incidentId, 'running');

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
      [inserted.id, JSON.stringify(validated), validated.confidenceScore ?? 85, Date.now() - started],
    );

    await patchIncidentAnalysisStatus(incidentId, 'review_required');
  } catch (err) {
    const code = sanitizeAnalysisError(err);
    await query(
      `UPDATE agent_runs SET status = 'failed', error_code = $2, latency_ms = $3, completed_at = now()
       WHERE id = $1`,
      [inserted.id, code, Date.now() - started],
    );
    await patchIncidentAnalysisStatus(incidentId, 'failed');
  }

  return (await getRunByIdempotency(incidentId, user.memberId, idempotencyKey))!;
}

export async function approveAnalysisRun(
  incidentId: string,
  runId: string,
  user: AuthUser,
  draft: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const validated = parseExtractionResult(draft);

  const updated = await withTransaction(async (client) => {
    const run = await queryWithClient<{ status: string; owner_member_id: string }>(
      client,
      `SELECT status, owner_member_id FROM agent_runs
       WHERE id = $1 AND incident_id = $2
       FOR UPDATE`,
      [runId, incidentId],
    );
    if (!run[0] || run[0].owner_member_id !== user.memberId) {
      throw Object.assign(new Error('Analysis run not found'), { status: 404 });
    }
    if (run[0].status === 'approved') {
      throw Object.assign(new Error('Analysis already approved'), {
        status: 409,
        code: 'ANALYSIS_ALREADY_APPROVED',
      });
    }
    if (run[0].status !== 'review_required') {
      throw Object.assign(new Error('Analysis is not ready for approval'), {
        status: 409,
        code: 'ANALYSIS_NOT_REVIEWABLE',
      });
    }

    const incRow = await queryWithClient<{ data: Record<string, unknown> }>(
      client,
      'SELECT data FROM incidents WHERE id = $1 FOR UPDATE',
      [incidentId],
    );
    if (!incRow[0]) throw new Error('Incident not found');

    const approvedTitle =
      typeof validated.title === 'string' && validated.title.trim().length >= 3
        ? validated.title.trim()
        : `${validated.service} — ${validated.component}`;

    const updated = normalizeIncidentForSave({
      ...incRow[0].data,
      id: incidentId,
      title: approvedTitle,
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
        id: `tsk-${incidentId}-${runId.slice(0, 8)}-${i}`,
        incidentId,
        incidentTitle: approvedTitle,
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
      [runId, JSON.stringify({ ...validated, title: approvedTitle })],
    );

    await enqueuePostApprovalJobs(incidentId, client);
    return updated as Record<string, unknown>;
  });

  void syncPostApprovalSideEffects(incidentId).catch((err) => {
    console.warn('Post-approval sync failed:', err instanceof Error ? err.message : err);
  });

  return updated;
}

async function syncPostApprovalSideEffects(incidentId: string): Promise<void> {
  const row = await queryOne<{
    data: IncidentRecord & {
      ownerMemberId?: string;
      analysisStatus?: string;
      status?: string;
      decisions?: Array<{ title: string; description?: string }>;
      tasks?: Array<{ title: string }>;
    };
    updated_at: string;
  }>(
    'SELECT data, updated_at FROM incidents WHERE id = $1',
    [incidentId],
  );
  if (!row?.data || row.data.analysisStatus !== 'approved') return;

  const incident = row.data;
  try {
    await indexIncident(incident);
  } catch {
    // optional when Bedrock unavailable
  }

  await projectIncidentEvidence({
    incidentId,
    title: incident.title,
    service: incident.service,
    severity: incident.severity,
    status: String(incident.status ?? 'INVESTIGATING'),
    summary: incident.summary,
    fixesApplied: incident.fixesApplied,
    decisions: incident.decisions,
    tasks: incident.tasks,
    sourceUpdatedAt: row.updated_at,
    ownerMemberId: incident.ownerMemberId,
    ownerScope: incident.ownerMemberId,
  });
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
