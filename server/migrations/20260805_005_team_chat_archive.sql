-- Permanent append-only archive for team chat (survives message/chat deletes)

CREATE TABLE IF NOT EXISTS opsrelay_chat_archive (
  id               STRING PRIMARY KEY DEFAULT gen_random_uuid()::STRING,
  chat_id          STRING NOT NULL,
  event_type       STRING NOT NULL,
  sender_member_id STRING,
  sender_name      STRING,
  payload          JSONB NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opsrelay_chat_archive_chat
  ON opsrelay_chat_archive (chat_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_opsrelay_chat_archive_event
  ON opsrelay_chat_archive (event_type, created_at DESC);

-- Backfill existing team chat rows into archive
INSERT INTO opsrelay_chat_archive (chat_id, event_type, sender_member_id, sender_name, payload, created_at)
SELECT
  c.id,
  'chat_created',
  c.member_a_id,
  c.member_a_name,
  jsonb_build_object(
    'memberAId', c.member_a_id,
    'memberAName', c.member_a_name,
    'memberBId', c.member_b_id,
    'memberBName', c.member_b_name
  ),
  c.created_at
FROM team_chats c
WHERE NOT EXISTS (
  SELECT 1 FROM opsrelay_chat_archive a
  WHERE a.chat_id = c.id AND a.event_type = 'chat_created'
);

INSERT INTO opsrelay_chat_archive (chat_id, event_type, sender_member_id, sender_name, payload, created_at)
SELECT
  m.chat_id,
  'message_sent',
  m.sender_member_id,
  m.sender_name,
  jsonb_build_object(
    'messageId', m.id,
    'text', m.text,
    'messageType', m.message_type,
    'imageData', m.image_data
  ),
  m.created_at
FROM team_chat_messages m
WHERE NOT EXISTS (
  SELECT 1 FROM opsrelay_chat_archive a
  WHERE a.event_type = 'message_sent'
    AND a.payload->>'messageId' = m.id
);

INSERT INTO opsrelay_chat_archive (chat_id, event_type, sender_member_id, sender_name, payload, created_at)
SELECT
  g.chat_id,
  'guest_invited',
  g.invited_by_member_id,
  NULL,
  jsonb_build_object(
    'guestId', g.id,
    'guestMemberId', g.guest_member_id,
    'guestName', g.guest_name,
    'durationMinutes', g.duration_minutes,
    'expiresAt', g.expires_at,
    'status', g.status
  ),
  g.created_at
FROM team_chat_guests g
WHERE NOT EXISTS (
  SELECT 1 FROM opsrelay_chat_archive a
  WHERE a.event_type = 'guest_invited'
    AND a.payload->>'guestId' = g.id
);
