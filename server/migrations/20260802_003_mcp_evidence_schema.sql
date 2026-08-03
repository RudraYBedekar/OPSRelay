-- Sanitized MCP investigator evidence (no raw notes, credentials, or auth data)

CREATE TABLE IF NOT EXISTS incident_evidence (
  incident_id           STRING PRIMARY KEY,
  title                 STRING NOT NULL,
  service               STRING NOT NULL,
  severity              STRING NOT NULL,
  status                STRING NOT NULL,
  approved_summary      STRING NOT NULL,
  approved_resolution   STRING,
  decision_summary      STRING,
  task_summary          STRING,
  source_updated_at     TIMESTAMPTZ NOT NULL,
  evidence_version      INT NOT NULL DEFAULT 1,
  citation_id           STRING UNIQUE NOT NULL,
  projected_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_service_status
  ON incident_evidence (service, status, source_updated_at DESC);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version     STRING PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
