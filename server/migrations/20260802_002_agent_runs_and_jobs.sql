-- AI analysis audit + durable post-save jobs

CREATE TABLE IF NOT EXISTS agent_runs (
  id                  STRING PRIMARY KEY DEFAULT gen_random_uuid()::STRING,
  incident_id         STRING NOT NULL,
  owner_member_id     STRING NOT NULL,
  run_type            STRING NOT NULL DEFAULT 'extraction',
  status              STRING NOT NULL,
  idempotency_key     STRING NOT NULL,
  model_id            STRING,
  prompt_version      STRING,
  output_json         JSONB,
  confidence          DECIMAL,
  warnings            JSONB NOT NULL DEFAULT '[]',
  provider_request_id STRING,
  input_tokens        INT,
  output_tokens       INT,
  latency_ms          INT,
  error_code          STRING,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ,
  approved_at         TIMESTAMPTZ,
  UNIQUE (owner_member_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_incident
  ON agent_runs (incident_id, created_at DESC);

CREATE TABLE IF NOT EXISTS incident_jobs (
  id              STRING PRIMARY KEY DEFAULT gen_random_uuid()::STRING,
  incident_id     STRING NOT NULL,
  job_type        STRING NOT NULL,
  status          STRING NOT NULL DEFAULT 'pending',
  attempt_count   INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error_code STRING,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (incident_id, job_type)
);

CREATE INDEX IF NOT EXISTS idx_incident_jobs_pending
  ON incident_jobs (status, next_attempt_at);
