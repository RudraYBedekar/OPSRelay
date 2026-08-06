import { query } from '../db.js';

export type TeamChatArchiveEventType =
  | 'chat_created'
  | 'message_sent'
  | 'message_deleted'
  | 'chat_deleted'
  | 'guest_invited'
  | 'guest_removed';

export async function archiveTeamChatEvent(input: {
  chatId: string;
  eventType: TeamChatArchiveEventType;
  senderMemberId?: string;
  senderName?: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  await query(
    `INSERT INTO opsrelay_chat_archive (chat_id, event_type, sender_member_id, sender_name, payload)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [
      input.chatId,
      input.eventType,
      input.senderMemberId ?? null,
      input.senderName ?? null,
      JSON.stringify(input.payload),
    ],
  );
}
