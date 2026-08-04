import { query, queryWithClient } from '../db.js';
import type { PoolClient } from 'pg';
import type { JobStatus, JobType } from '../types/analysis.js';
import { randomUUID } from 'node:crypto';

const MAX_ATTEMPTS = 5;
const LEASE_SECONDS = 60;
export const WORKER_ID = `worker-${randomUUID().slice(0, 8)}`;

export async function enqueueJob(
  incidentId: string,
  jobType: JobType,
  client?: PoolClient,
): Promise<void> {
  const sql = `INSERT INTO incident_jobs (incident_id, job_type, status, next_attempt_at)
     VALUES ($1, $2, 'pending', now())
     ON CONFLICT (incident_id, job_type) DO UPDATE
       SET status = 'pending',
           next_attempt_at = now(),
           lease_owner = NULL,
           lease_expires_at = NULL,
           last_error_code = NULL,
           updated_at = now()`;
  if (client) {
    await queryWithClient(client, sql, [incidentId, jobType]);
  } else {
    await query(sql, [incidentId, jobType]);
  }
}

export async function enqueuePostApprovalJobs(
  incidentId: string,
  client: PoolClient,
): Promise<void> {
  for (const jobType of [
    'index_incident_vector',
    'evaluate_alert_duplicate',
    'project_mcp_evidence',
  ] as JobType[]) {
    await enqueueJob(incidentId, jobType, client);
  }
}

export async function claimPendingJobs(limit = 5): Promise<Array<{
  id: string;
  incident_id: string;
  job_type: JobType;
  attempt_count: number;
}>> {
  return query(
    `UPDATE incident_jobs
     SET status = 'running',
         attempt_count = attempt_count + 1,
         lease_owner = $2,
         lease_expires_at = now() + ($3::int * INTERVAL '1 second'),
         updated_at = now()
     WHERE id IN (
       SELECT id FROM incident_jobs
       WHERE (
         status = 'pending'
         OR (status = 'running' AND lease_expires_at IS NOT NULL AND lease_expires_at < now())
       )
       AND next_attempt_at <= now()
       ORDER BY next_attempt_at ASC
       LIMIT $1
     )
     RETURNING id, incident_id, job_type, attempt_count`,
    [limit, WORKER_ID, LEASE_SECONDS],
  );
}

export async function completeJob(jobId: string): Promise<void> {
  await query(
    `UPDATE incident_jobs
     SET status = 'complete',
         completed_at = now(),
         lease_owner = NULL,
         lease_expires_at = NULL,
         updated_at = now()
     WHERE id = $1 AND lease_owner = $2`,
    [jobId, WORKER_ID],
  );
}

export async function failJob(jobId: string, errorCode: string, attemptCount: number): Promise<void> {
  const permanent = attemptCount >= MAX_ATTEMPTS;
  const backoffMinutes = Math.min(30, 2 ** attemptCount);
  await query(
    `UPDATE incident_jobs
     SET status = $3,
         last_error_code = $4,
         next_attempt_at = now() + ($5::int * INTERVAL '1 minute'),
         lease_owner = NULL,
         lease_expires_at = NULL,
         updated_at = now()
     WHERE id = $1 AND lease_owner = $2`,
    [jobId, WORKER_ID, permanent ? 'failed' : 'pending', errorCode.slice(0, 120), backoffMinutes],
  );
}

export async function recordJobEffect(jobId: string, effectKey: string): Promise<boolean> {
  const rows = await query<{ job_id: string }>(
    `INSERT INTO job_effects (job_id, effect_key)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING
     RETURNING job_id`,
    [jobId, effectKey],
  );
  return rows.length > 0;
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

export async function processJobBatch(
  handler: (incidentId: string, jobType: JobType, jobId: string) => Promise<void>,
  limit = 5,
): Promise<void> {
  const jobs = await claimPendingJobs(limit);
  for (const job of jobs) {
    try {
      await handler(job.incident_id, job.job_type, job.id);
      await completeJob(job.id);
    } catch (err) {
      const code = err instanceof Error ? err.message.slice(0, 120) : 'job_failed';
      await failJob(job.id, code, job.attempt_count);
    }
  }
}
