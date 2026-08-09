-- Full owner member ID for MCP evidence authorization (replaces truncated source_owner_scope)

ALTER TABLE incident_evidence ADD COLUMN IF NOT EXISTS source_owner_member_id STRING;

-- Backfill from authoritative incident JSON ownerMemberId where possible
UPDATE incident_evidence e
SET source_owner_member_id = COALESCE(
  (SELECT data->>'ownerMemberId' FROM incidents i WHERE i.id = e.incident_id),
  source_owner_scope
)
WHERE source_owner_member_id IS NULL OR source_owner_member_id = '';

CREATE INDEX IF NOT EXISTS idx_evidence_owner_service
  ON incident_evidence (source_owner_member_id, service, source_updated_at DESC);
