-- OpsRelay CockroachDB schema (runs in the database from DATABASE_URL)
-- User credentials live in the separate SecureData database (see schemaSecure.sql)

CREATE TABLE IF NOT EXISTS incidents (
  id          STRING PRIMARY KEY,
  data        JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shift_handoffs (
  id   STRING PRIMARY KEY DEFAULT 'current',
  data JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS dashboard_metrics (
  id   STRING PRIMARY KEY DEFAULT 'current',
  data JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS memory_chats (
  id         STRING PRIMARY KEY,
  data       JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sample raw logs for AI Intake testing (paste → extract flow)
CREATE TABLE IF NOT EXISTS sample_logs (
  id         STRING PRIMARY KEY,
  data       JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sample_logs_category ON sample_logs ((data->>'category'));

-- Vector memory for semantic incident search (Bedrock Titan embeddings)
CREATE TABLE IF NOT EXISTS incident_embeddings (
  id           STRING PRIMARY KEY DEFAULT gen_random_uuid()::STRING,
  incident_id  STRING NOT NULL,
  chunk_type   STRING NOT NULL,
  content      STRING NOT NULL,
  service      STRING,
  embedding    VECTOR(1024) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incidents_updated ON incidents (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_embeddings_incident ON incident_embeddings (incident_id);

-- Vector index for approximate nearest neighbor search (cosine distance)
CREATE VECTOR INDEX IF NOT EXISTS idx_incident_embeddings_vector
  ON incident_embeddings (service, embedding vector_cosine_ops);
