import { query } from '../db.js';

/** Add image support columns to team chat messages (idempotent). */
export async function migrateTeamChatImageSchema(): Promise<void> {
  await query(`
    ALTER TABLE team_chat_messages
    ADD COLUMN IF NOT EXISTS image_data STRING
  `);
}
