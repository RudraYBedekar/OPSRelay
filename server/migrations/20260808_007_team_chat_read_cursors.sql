-- Per-member read cursor for team chat unread badges

CREATE TABLE IF NOT EXISTS team_chat_read_cursors (
  chat_id       STRING NOT NULL,
  member_id     STRING NOT NULL,
  last_read_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_team_chat_read_member ON team_chat_read_cursors (member_id);
