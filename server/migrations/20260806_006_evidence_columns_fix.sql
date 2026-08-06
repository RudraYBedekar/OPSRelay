-- Ensure incident_evidence has columns required by evidence projection

ALTER TABLE incident_evidence ADD COLUMN IF NOT EXISTS content_hash STRING;
ALTER TABLE incident_evidence ADD COLUMN IF NOT EXISTS source_owner_scope STRING;
