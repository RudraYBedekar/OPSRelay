import { query } from '../db.js';
import type { JobStatus, JobType } from '../types/analysis.js';

const MAX_ATTEMPTS = 5;

export async function enqueueJob(incidentId: string, jobType: JobType): Promise<void> {
  await query(
    `INSERT INTO incident_jobs (incident_id, job_type, status, next_attempt_at)
     VALUES ($1, $2, 'pending', now())
     ON CONFLICT (incident_id, job_type) DO UPDATE
       SET status = 'pending', next_attempt_at = now(), updated_at = now()`,
    [incidentId, jobType],
  );
}

export async function claimPendingJobs(limit = 5): Promise<Array<{
  id: string;
  incident_id: string;
  job_type: JobType;
  attempt_count: number;
}>> {
  return query(
    `UPDATE incident_jobs
     SET status = 'running', attempt_count = attempt_count + 1, updated_at = now()
     WHERE id IN (
       SELECT id FROM incident_jobs
       WHERE status = 'pending' AND next_attempt_at <= now()
       ORDER BY next_attempt_at ASC
       LIMIT $1
     )
     RETURNING id, incident_id, job_type, attempt_count`,
    [limit],
  );
}

export async function completeJob(jobId: string): Promise<void> {
  await query(
    `UPDATE incident_jobs SET status = 'complete', updated_at = now() WHERE id = $1`,
    [jobId],
  );
}

export async function failJob(jobId: string, errorCode: string, attemptCount: number): Promise<void> {
  const permanent = attemptCount >= MAX_ATTEMPTS;
  const backoffMinutes = Math.min(30, 2 ** attemptCount);
  await query(
    `UPDATE incident_jobs
     SET status = $2,
         last_error_code = $3,
         next_attempt_at = now() + ($4::int * INTERVAL '1 minute'),
         updated_at = now()
     WHERE id = $1`,
    [jobId, permanent ? 'failed' : 'pending', errorCode.slice(0, 120), backoffMinutes],
  );
}

export async function getJobsForIncident(incidentId: string): Promise<Array<{
  jobType: JobType;
  status: JobStatus;
  lastErrorCode?: string;
}>> {
  const rows = await query<{ job_type: JobType; status: JobStatus; last_error_code: string | null }>(
    'SELECT job_type, status, last_error_code FROM incident_jobs WHERE incident_id = $1',
    [incidentId],
  );
  return rows.map((r) => ({
    jobType: r.job_type,
    status: r.status,
    lastErrorCode: r.last_error_code ?? undefined,
  }));
}

export async function enqueuePostApprovalJobs(incidentId: string): Promise<void> {
  for (const jobType of ['index_incident_vector', 'evaluate_alert_duplicate', 'project_mcp_evidence'] as JobType[]) {
    await enqueueJob(incidentId, jobType);
  }
}

export async function processJobBatch(
  handler: (incidentId: string, jobType: JobType) => Promise<void>,
  limit = 5,
): Promise<void> {
  const jobs = await claimPendingJobs(limit);
  for (const job of jobs) {
    try {
      await handler(job.incident_id, job.job_type);
      await completeJob(job.id);
    } catch (err) {
      const code = err instanceof Error ? err.message.slice(0, 120) : 'job_failed';
      await failJob(job.id, code, job.attempt_count);
    }
  }
}
