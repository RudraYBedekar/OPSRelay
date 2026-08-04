-- Job leases and idempotency for durable workers

ALTER TABLE incident_jobs ADD COLUMN IF NOT EXISTS lease_owner STRING;
ALTER TABLE incident_jobs ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;
ALTER TABLE incident_jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE incident_jobs ADD COLUMN IF NOT EXISTS result_version INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS job_effects (
  job_id STRING NOT NULL,
  effect_key STRING NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id, effect_key)
);

-- Tighten agent_runs idempotency to include incident (best-effort; ignore if already correct)
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_runs_owner_incident_idempotency
  ON agent_runs (owner_member_id, incident_id, idempotency_key);
