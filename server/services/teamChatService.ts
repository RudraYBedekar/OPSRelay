import { query, queryOne } from '../db.js';
import { secureQuery, secureQueryOne } from '../secureDb.js';
import type { AuthUser } from './authService.js';
import { isValidMemberIdFormat } from './incidentAccessService.js';
import { archiveTeamChatEvent } from './teamChatArchiveService.js';

export type GuestDuration = 5 | 15 | 30 | 60 | 120 | 240 | 480 | 1440;

export type ChatMessageType = 'user' | 'system' | 'image';

export interface TeamChatMember {
  memberId: string;
  name: string;
}

export interface TeamChatGuest {
  id: string;
  guestMemberId: string;
  guestName: string;
  invitedByMemberId: string;
  durationMinutes: GuestDuration;
  expiresAt: string;
  status: 'active' | 'expired';
  remainingMs: number;
}

export interface TeamChatMessage {
  id: string;
  chatId: string;
  senderMemberId: string;
  senderName: string;
  text: string;
  messageType: ChatMessageType;
  imageData?: string;
  createdAt: string;
}

export interface TeamChatSummary {
  id: string;
  otherMember: TeamChatMember;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadHint?: boolean;
  activeGuest?: TeamChatGuest;
  updatedAt: string;
}

export interface TeamChatDetail {
  id: string;
  participants: TeamChatMember[];
  messages: TeamChatMessage[];
  activeGuest?: TeamChatGuest;
  createdAt: string;
  updatedAt: string;
}

function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function chatIdFor(memberA: string, memberB: string): string {
  const [x, y] = orderedPair(memberA, memberB);
  return `chat-${x}-${y}`;
}

async function findUserByMemberId(memberId: string): Promise<TeamChatMember | null> {
  const row = await secureQueryOne<{ member_id: string; name: string }>(
    'SELECT member_id, name FROM users WHERE member_id = $1',
    [memberId.trim().toUpperCase()],
  );
  if (!row) return null;
  return { memberId: row.member_id, name: row.name };
}

export async function listChatMembers(currentMemberId: string): Promise<TeamChatMember[]> {
  const rows = await secureQuery<{ member_id: string; name: string }>(
    'SELECT member_id, name FROM users WHERE member_id != $1 ORDER BY name',
    [currentMemberId],
  );
  return rows.map((r) => ({ memberId: r.member_id, name: r.name }));
}

async function expireStaleGuests(chatId?: string): Promise<void> {
  const params: unknown[] = [];
  let sql = `UPDATE team_chat_guests SET status = 'expired'
             WHERE status = 'active' AND expires_at <= now()`;
  if (chatId) {
    sql += ' AND chat_id = $1';
    params.push(chatId);
  }
  await query(sql, params);
}

async function getActiveGuest(chatId: string): Promise<TeamChatGuest | undefined> {
  await expireStaleGuests(chatId);
  const row = await queryOne<{
    id: string;
    guest_member_id: string;
    guest_name: string;
    invited_by_member_id: string;
    duration_minutes: number;
    expires_at: string;
    status: string;
  }>(
    `SELECT id, guest_member_id, guest_name, invited_by_member_id, duration_minutes, expires_at, status
     FROM team_chat_guests
     WHERE chat_id = $1 AND status = 'active' AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
    [chatId],
  );
  if (!row) return undefined;

  const remainingMs = Math.max(0, new Date(row.expires_at).getTime() - Date.now());
  return {
    id: row.id,
    guestMemberId: row.guest_member_id,
    guestName: row.guest_name,
    invitedByMemberId: row.invited_by_member_id,
    durationMinutes: row.duration_minutes as GuestDuration,
    expiresAt: row.expires_at,
    status: 'active',
    remainingMs,
  };
}

async function canAccessChat(
  chat: { member_a_id: string; member_b_id: string },
  memberId: string,
  chatId: string,
): Promise<boolean> {
  if (chat.member_a_id === memberId || chat.member_b_id === memberId) return true;
  const guest = await getActiveGuest(chatId);
  return guest?.guestMemberId === memberId;
}

async function insertSystemMessage(chatId: string, text: string): Promise<void> {
  await query(
    `INSERT INTO team_chat_messages (chat_id, sender_member_id, sender_name, text, message_type)
     VALUES ($1, 'system', 'OpsRelay', $2, 'system')`,
    [chatId, text],
  );
}

const ALLOWED_GUEST_DURATIONS: GuestDuration[] = [5, 15, 30, 60, 120, 240, 480, 1440];
const MAX_IMAGE_BYTES = 600_000;

function mapMessageRow(m: {
  id: string;
  chat_id: string;
  sender_member_id: string;
  sender_name: string;
  text: string;
  message_type: string;
  image_data: string | null;
  created_at: string;
}): TeamChatMessage {
  const type = m.message_type === 'system'
    ? 'system'
    : m.message_type === 'image'
      ? 'image'
      : 'user';
  return {
    id: m.id,
    chatId: m.chat_id,
    senderMemberId: m.sender_member_id,
    senderName: m.sender_name,
    text: m.text,
    messageType: type,
    imageData: m.image_data ?? undefined,
    createdAt: m.created_at,
  };
}

function validateImageData(imageData: string): void {
  if (!imageData.startsWith('data:image/jpeg') && !imageData.startsWith('data:image/png') && !imageData.startsWith('data:image/webp')) {
    throw new Error('Image must be JPEG, PNG, or WebP');
  }
  if (imageData.length > MAX_IMAGE_BYTES) {
    throw new Error('Image is too large (max ~450KB). Try a smaller photo.');
  }
}

export async function listChatsForUser(user: AuthUser): Promise<TeamChatSummary[]> {
  await expireStaleGuests();

  const rows = await query<{
    id: string;
    member_a_id: string;
    member_a_name: string;
    member_b_id: string;
    member_b_name: string;
    updated_at: string;
  }>(
    `SELECT c.* FROM team_chats c
     WHERE c.member_a_id = $1 OR c.member_b_id = $1
        OR EXISTS (
          SELECT 1 FROM team_chat_guests g
          WHERE g.chat_id = c.id AND g.guest_member_id = $1
            AND g.status = 'active' AND g.expires_at > now()
        )
     ORDER BY c.updated_at DESC`,
    [user.memberId],
  );

  const summaries: TeamChatSummary[] = [];
  for (const row of rows) {
    let other: TeamChatMember;
    if (row.member_a_id === user.memberId) {
      other = { memberId: row.member_b_id, name: row.member_b_name };
    } else if (row.member_b_id === user.memberId) {
      other = { memberId: row.member_a_id, name: row.member_a_name };
    } else {
      other = {
        memberId: row.id,
        name: `${row.member_a_name} & ${row.member_b_name}`,
      };
    }

    const lastMsg = await queryOne<{ text: string; created_at: string }>(
      `SELECT text, created_at FROM team_chat_messages
       WHERE chat_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [row.id],
    );

    summaries.push({
      id: row.id,
      otherMember: other,
      lastMessage: lastMsg?.text,
      lastMessageAt: lastMsg?.created_at,
      activeGuest: await getActiveGuest(row.id),
      updatedAt: row.updated_at,
    });
  }

  return summaries;
}

export async function getOrCreateChat(
  user: AuthUser,
  otherMemberId: string,
): Promise<TeamChatDetail> {
  const normalized = otherMemberId.trim().toUpperCase();
  if (!isValidMemberIdFormat(normalized)) {
    throw new Error('Invalid member ID format. Use MEM-XXXXXXXX');
  }
  if (normalized === user.memberId) {
    throw new Error('You cannot start a chat with yourself');
  }

  const other = await findUserByMemberId(normalized);
  if (!other) throw new Error(`No user found with member ID ${normalized}`);

  const [memberAId, memberBId] = orderedPair(user.memberId, other.memberId);
  const memberAName = memberAId === user.memberId ? user.name : other.name;
  const memberBName = memberBId === user.memberId ? user.name : other.name;
  const chatId = chatIdFor(user.memberId, other.memberId);

  const existingChat = await queryOne<{ id: string }>(
    'SELECT id FROM team_chats WHERE id = $1',
    [chatId],
  );

  await query(
    `INSERT INTO team_chats (id, member_a_id, member_a_name, member_b_id, member_b_name)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (member_a_id, member_b_id) DO NOTHING`,
    [chatId, memberAId, memberAName, memberBId, memberBName],
  );

  if (!existingChat) {
    await archiveTeamChatEvent({
      chatId,
      eventType: 'chat_created',
      senderMemberId: user.memberId,
      senderName: user.name,
      payload: {
        memberAId,
        memberAName,
        memberBId,
        memberBName,
        initiatedBy: user.memberId,
      },
    }).catch(() => undefined);
  }

  return getChatDetail(chatId, user.memberId);
}

export async function getChatDetail(chatId: string, memberId: string): Promise<TeamChatDetail> {
  await expireStaleGuests(chatId);

  const chat = await queryOne<{
    id: string;
    member_a_id: string;
    member_a_name: string;
    member_b_id: string;
    member_b_name: string;
    created_at: string;
    updated_at: string;
  }>('SELECT * FROM team_chats WHERE id = $1', [chatId]);

  if (!chat) throw new Error('Chat not found');

  const allowed = await canAccessChat(chat, memberId, chatId);
  if (!allowed) throw new Error('Chat not found');

  const messages = await query<{
    id: string;
    chat_id: string;
    sender_member_id: string;
    sender_name: string;
    text: string;
    message_type: string;
    image_data: string | null;
    created_at: string;
  }>(
    'SELECT id, chat_id, sender_member_id, sender_name, text, message_type, image_data, created_at FROM team_chat_messages WHERE chat_id = $1 ORDER BY created_at ASC',
    [chatId],
  );

  const guest = await getActiveGuest(chatId);
  const participants: TeamChatMember[] = [
    { memberId: chat.member_a_id, name: chat.member_a_name },
    { memberId: chat.member_b_id, name: chat.member_b_name },
  ];
  if (guest) {
    participants.push({ memberId: guest.guestMemberId, name: guest.guestName });
  }

  return {
    id: chat.id,
    participants,
    messages: messages.map(mapMessageRow),
    activeGuest: guest,
    createdAt: chat.created_at,
    updatedAt: chat.updated_at,
  };
}

export async function sendChatMessage(
  chatId: string,
  user: AuthUser,
  text: string,
  imageData?: string,
): Promise<TeamChatMessage> {
  const trimmed = text.trim();
  const hasImage = Boolean(imageData?.trim());

  if (!trimmed && !hasImage) throw new Error('Message cannot be empty');

  const chat = await queryOne<{ member_a_id: string; member_b_id: string }>(
    'SELECT member_a_id, member_b_id FROM team_chats WHERE id = $1',
    [chatId],
  );
  if (!chat) throw new Error('Chat not found');

  const allowed = await canAccessChat(chat, user.memberId, chatId);
  if (!allowed) throw new Error('You do not have access to this chat');

  if (hasImage) {
    validateImageData(imageData!);
  }

  const messageType = hasImage ? 'image' : 'user';
  const displayText = trimmed || (hasImage ? '📷 Photo' : '');

  const row = await queryOne<{
    id: string;
    chat_id: string;
    sender_member_id: string;
    sender_name: string;
    text: string;
    message_type: string;
    image_data: string | null;
    created_at: string;
  }>(
    `INSERT INTO team_chat_messages (chat_id, sender_member_id, sender_name, text, message_type, image_data)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, chat_id, sender_member_id, sender_name, text, message_type, image_data, created_at`,
    [chatId, user.memberId, user.name, displayText, messageType, hasImage ? imageData : null],
  );

  await query('UPDATE team_chats SET updated_at = now() WHERE id = $1', [chatId]);

  const mapped = mapMessageRow(row!);
  await archiveTeamChatEvent({
    chatId,
    eventType: 'message_sent',
    senderMemberId: user.memberId,
    senderName: user.name,
    payload: {
      messageId: mapped.id,
      text: mapped.text,
      messageType: mapped.messageType,
      hasImage: Boolean(mapped.imageData),
    },
  }).catch(() => undefined);

  return mapped;
}

export async function inviteGuestToChat(
  chatId: string,
  user: AuthUser,
  guestMemberId: string,
  durationMinutes: GuestDuration,
): Promise<TeamChatDetail> {
  if (!ALLOWED_GUEST_DURATIONS.includes(durationMinutes)) {
    throw new Error('Guest duration must be 5, 15, 30, 60, 120, 240, 480, or 1440 minutes');
  }

  const normalized = guestMemberId.trim().toUpperCase();
  if (!isValidMemberIdFormat(normalized)) {
    throw new Error('Invalid member ID format. Use MEM-XXXXXXXX');
  }

  const chat = await queryOne<{
    member_a_id: string;
    member_b_id: string;
  }>('SELECT member_a_id, member_b_id FROM team_chats WHERE id = $1', [chatId]);

  if (!chat) throw new Error('Chat not found');
  if (chat.member_a_id !== user.memberId && chat.member_b_id !== user.memberId) {
    throw new Error('Only chat participants can invite a guest');
  }
  if (normalized === chat.member_a_id || normalized === chat.member_b_id) {
    throw new Error('Guest must be a different user from the two main participants');
  }
  if (normalized === user.memberId) {
    throw new Error('You are already in this chat');
  }

  const guest = await findUserByMemberId(normalized);
  if (!guest) throw new Error(`No user found with member ID ${normalized}`);

  await expireStaleGuests(chatId);
  await query(
    `UPDATE team_chat_guests SET status = 'expired'
     WHERE chat_id = $1 AND status = 'active'`,
    [chatId],
  );

  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
  await query(
    `INSERT INTO team_chat_guests
     (chat_id, guest_member_id, guest_name, invited_by_member_id, duration_minutes, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6::timestamptz)`,
    [chatId, guest.memberId, guest.name, user.memberId, durationMinutes, expiresAt],
  );

  await insertSystemMessage(
    chatId,
    `${user.name} invited ${guest.name} (${guest.memberId}) for ${
      durationMinutes >= 60 ? `${durationMinutes / 60} hour(s)` : `${durationMinutes} minutes`
    }.`,
  );
  await query('UPDATE team_chats SET updated_at = now() WHERE id = $1', [chatId]);

  await archiveTeamChatEvent({
    chatId,
    eventType: 'guest_invited',
    senderMemberId: user.memberId,
    senderName: user.name,
    payload: {
      guestMemberId: guest.memberId,
      guestName: guest.name,
      durationMinutes,
      expiresAt,
    },
  }).catch(() => undefined);

  return getChatDetail(chatId, user.memberId);
}

export async function removeGuestFromChat(
  chatId: string,
  user: AuthUser,
  guestId?: string,
): Promise<TeamChatDetail> {
  const chat = await queryOne<{
    member_a_id: string;
    member_b_id: string;
  }>('SELECT member_a_id, member_b_id FROM team_chats WHERE id = $1', [chatId]);

  if (!chat) throw new Error('Chat not found');
  if (chat.member_a_id !== user.memberId && chat.member_b_id !== user.memberId) {
    throw new Error('Only chat participants can remove a guest');
  }

  await expireStaleGuests(chatId);

  const guest = guestId
    ? await queryOne<{ id: string; guest_member_id: string; guest_name: string }>(
        `SELECT id, guest_member_id, guest_name FROM team_chat_guests
         WHERE id = $1 AND chat_id = $2 AND status = 'active'`,
        [guestId, chatId],
      )
    : await queryOne<{ id: string; guest_member_id: string; guest_name: string }>(
        `SELECT id, guest_member_id, guest_name FROM team_chat_guests
         WHERE chat_id = $1 AND status = 'active' AND expires_at > now()
         ORDER BY created_at DESC LIMIT 1`,
        [chatId],
      );

  if (!guest) throw new Error('No active guest to remove');

  await query(
    `UPDATE team_chat_guests SET status = 'expired', expires_at = now() WHERE id = $1`,
    [guest.id],
  );

  await insertSystemMessage(
    chatId,
    `${user.name} removed ${guest.guest_name} (${guest.guest_member_id}) from the chat.`,
  );
  await query('UPDATE team_chats SET updated_at = now() WHERE id = $1', [chatId]);

  await archiveTeamChatEvent({
    chatId,
    eventType: 'guest_removed',
    senderMemberId: user.memberId,
    senderName: user.name,
    payload: {
      guestId: guest.id,
      guestMemberId: guest.guest_member_id,
      guestName: guest.guest_name,
    },
  }).catch(() => undefined);

  return getChatDetail(chatId, user.memberId);
}

/** Sender or permanent chat participant can delete a non-system message. */
export async function deleteChatMessage(
  chatId: string,
  user: AuthUser,
  messageId: string,
): Promise<{ deleted: true; messageId: string }> {
  const chat = await queryOne<{ member_a_id: string; member_b_id: string }>(
    'SELECT member_a_id, member_b_id FROM team_chats WHERE id = $1',
    [chatId],
  );
  if (!chat) throw new Error('Chat not found');

  const allowed = await canAccessChat(chat, user.memberId, chatId);
  if (!allowed) throw new Error('You do not have access to this chat');

  const message = await queryOne<{
    id: string;
    sender_member_id: string;
    message_type: string;
  }>(
    'SELECT id, sender_member_id, message_type FROM team_chat_messages WHERE id = $1 AND chat_id = $2',
    [messageId, chatId],
  );
  if (!message) throw new Error('Message not found');
  if (message.message_type === 'system') {
    throw new Error('System messages cannot be deleted');
  }

  const isSender = message.sender_member_id === user.memberId;
  const isOwner = chat.member_a_id === user.memberId || chat.member_b_id === user.memberId;
  if (!isSender && !isOwner) {
    throw new Error('You can only delete your own messages');
  }

  await query('DELETE FROM team_chat_messages WHERE id = $1 AND chat_id = $2', [messageId, chatId]);
  await query('UPDATE team_chats SET updated_at = now() WHERE id = $1', [chatId]);

  await archiveTeamChatEvent({
    chatId,
    eventType: 'message_deleted',
    senderMemberId: user.memberId,
    senderName: user.name,
    payload: {
      messageId,
      deletedBy: user.memberId,
      originalSender: message.sender_member_id,
    },
  }).catch(() => undefined);

  return { deleted: true, messageId };
}

/** Permanent chat participants can delete the entire conversation. */
export async function deleteChat(
  chatId: string,
  user: AuthUser,
): Promise<{ deleted: true; chatId: string }> {
  const chat = await queryOne<{ member_a_id: string; member_b_id: string }>(
    'SELECT member_a_id, member_b_id FROM team_chats WHERE id = $1',
    [chatId],
  );
  if (!chat) throw new Error('Chat not found');

  const isOwner = chat.member_a_id === user.memberId || chat.member_b_id === user.memberId;
  if (!isOwner) {
    throw new Error('Only chat participants can delete this conversation');
  }

  await archiveTeamChatEvent({
    chatId,
    eventType: 'chat_deleted',
    senderMemberId: user.memberId,
    senderName: user.name,
    payload: {
      deletedBy: user.memberId,
      memberAId: chat.member_a_id,
      memberBId: chat.member_b_id,
    },
  }).catch(() => undefined);

  await query('DELETE FROM team_chat_messages WHERE chat_id = $1', [chatId]);
  await query('DELETE FROM team_chat_guests WHERE chat_id = $1', [chatId]);
  await query('DELETE FROM team_chats WHERE id = $1', [chatId]);

  return { deleted: true, chatId };
}
