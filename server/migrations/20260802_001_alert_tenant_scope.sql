-- Alert embeddings: owner-scoped tenant boundary
ALTER TABLE alert_embeddings ADD COLUMN IF NOT EXISTS owner_member_id STRING;

CREATE INDEX IF NOT EXISTS idx_alert_embeddings_owner_incident
  ON alert_embeddings (owner_member_id, linked_incident_id);

CREATE INDEX IF NOT EXISTS idx_alert_embeddings_owner_status
  ON alert_embeddings (owner_member_id, status, last_seen DESC);

-- Backfill from linked incidents where possible
UPDATE alert_embeddings AS alert
SET owner_member_id = incident.data->>'ownerMemberId'
FROM incidents AS incident
WHERE alert.linked_incident_id = incident.id
  AND alert.owner_member_id IS NULL
  AND incident.data->>'ownerMemberId' IS NOT NULL;

-- Quarantine unowned legacy rows from app queries (leave NULL)
-- Vector index with owner prefix (drop/recreate if exists)
DROP INDEX IF EXISTS idx_alert_embeddings_vector;

CREATE VECTOR INDEX IF NOT EXISTS idx_alert_embeddings_vector
  ON alert_embeddings (owner_member_id, service, embedding vector_cosine_ops);
