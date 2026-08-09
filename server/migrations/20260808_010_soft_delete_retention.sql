-- Retain all operational data when users delete from dashboard or chat UI.

ALTER TABLE team_chat_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE team_chat_messages ADD COLUMN IF NOT EXISTS deleted_by_member_id STRING;

ALTER TABLE team_chats ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE team_chats ADD COLUMN IF NOT EXISTS deleted_by_member_id STRING;

ALTER TABLE memory_chats ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;
ALTER TABLE memory_chats ADD COLUMN IF NOT EXISTS hidden_by_member_id STRING;

ALTER TABLE incidents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS deleted_by_member_id STRING;

CREATE TABLE IF NOT EXISTS team_chat_user_hides (
  chat_id    STRING NOT NULL,
  member_id  STRING NOT NULL,
  hidden_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_team_chat_messages_active
  ON team_chat_messages (chat_id, created_at ASC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_memory_chats_visible
  ON memory_chats (created_at ASC)
  WHERE hidden_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_incidents_active
  ON incidents (updated_at DESC)
  WHERE deleted_at IS NULL;
