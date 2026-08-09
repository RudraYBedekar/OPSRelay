-- Mark all existing team chat messages as read for every participant (fixes inflated unread counts)

INSERT INTO team_chat_read_cursors (chat_id, member_id, last_read_at)
SELECT c.id, c.member_a_id, now()
FROM team_chats c
ON CONFLICT (chat_id, member_id) DO NOTHING;

INSERT INTO team_chat_read_cursors (chat_id, member_id, last_read_at)
SELECT c.id, c.member_b_id, now()
FROM team_chats c
ON CONFLICT (chat_id, member_id) DO NOTHING;
