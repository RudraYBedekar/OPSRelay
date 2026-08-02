-- Alert Fatigue Agent — dedupe low-signal alerts before they become incidents

CREATE TABLE IF NOT EXISTS alert_embeddings (
  id                 STRING PRIMARY KEY DEFAULT gen_random_uuid()::STRING,
  alert_text         STRING NOT NULL,
  embedding          VECTOR(1024) NOT NULL,
  service            STRING NOT NULL,
  first_seen         TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen          TIMESTAMPTZ NOT NULL DEFAULT now(),
  suppressed_count   INT NOT NULL DEFAULT 0,
  linked_incident_id STRING,
  status             STRING NOT NULL DEFAULT 'active',
  distinct_override  BOOL NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_alert_embeddings_service ON alert_embeddings (service, last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_alert_embeddings_incident ON alert_embeddings (linked_incident_id);
CREATE INDEX IF NOT EXISTS idx_alert_embeddings_status ON alert_embeddings (status, last_seen DESC);

CREATE VECTOR INDEX IF NOT EXISTS idx_alert_embeddings_vector
  ON alert_embeddings (service, embedding vector_cosine_ops);
