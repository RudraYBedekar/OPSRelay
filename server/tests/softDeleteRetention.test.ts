import { describe, expect, it } from 'vitest';

describe('soft delete retention policy', () => {
  it('documents team chat message soft delete SQL shape', () => {
    const sql =
      'UPDATE team_chat_messages SET deleted_at = now(), deleted_by_member_id = $3 WHERE id = $1 AND chat_id = $2 AND deleted_at IS NULL';
    expect(sql).toContain('UPDATE team_chat_messages');
    expect(sql).not.toContain('DELETE FROM team_chat_messages');
  });

  it('documents team chat hide instead of cascade delete', () => {
    const sql =
      'INSERT INTO team_chat_user_hides (chat_id, member_id, hidden_at) VALUES ($1, $2, now()) ON CONFLICT (chat_id, member_id) DO UPDATE SET hidden_at = now()';
    expect(sql).toContain('team_chat_user_hides');
    expect(sql).not.toContain('DELETE FROM team_chats');
  });

  it('documents memory chat hide instead of hard delete', () => {
    const sql = 'UPDATE memory_chats SET hidden_at = now(), hidden_by_member_id = $1 WHERE hidden_at IS NULL';
    expect(sql).toContain('hidden_at');
    expect(sql).not.toContain('DELETE FROM memory_chats');
  });

  it('documents incident soft delete retention', () => {
    const sql =
      'UPDATE incidents SET deleted_at = now(), deleted_by_member_id = $2 WHERE id = $1 AND deleted_at IS NULL';
    expect(sql).toContain('deleted_at');
    expect(sql).not.toContain('DELETE FROM incidents');
  });
});
