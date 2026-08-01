-- Team chat between two members with optional timed guest (15 / 30 min)

CREATE TABLE IF NOT EXISTS team_chats (
  id              STRING PRIMARY KEY,
  member_a_id     STRING NOT NULL,
  member_a_name   STRING NOT NULL,
  member_b_id     STRING NOT NULL,
  member_b_name   STRING NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_a_id, member_b_id)
);

CREATE TABLE IF NOT EXISTS team_chat_messages (
  id               STRING PRIMARY KEY DEFAULT gen_random_uuid()::STRING,
  chat_id          STRING NOT NULL,
  sender_member_id STRING NOT NULL,
  sender_name      STRING NOT NULL,
  text             STRING NOT NULL,
  message_type     STRING NOT NULL DEFAULT 'user',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_chat_guests (
  id                  STRING PRIMARY KEY DEFAULT gen_random_uuid()::STRING,
  chat_id             STRING NOT NULL,
  guest_member_id     STRING NOT NULL,
  guest_name          STRING NOT NULL,
  invited_by_member_id STRING NOT NULL,
  duration_minutes    INT NOT NULL,
  expires_at          TIMESTAMPTZ NOT NULL,
  status              STRING NOT NULL DEFAULT 'active',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_chats_members ON team_chats (member_a_id, member_b_id);
CREATE INDEX IF NOT EXISTS idx_team_chat_messages_chat ON team_chat_messages (chat_id, created_at);
CREATE INDEX IF NOT EXISTS idx_team_chat_guests_chat ON team_chat_guests (chat_id, status, expires_at);
