import { secureQuery } from '../secureDb.js';
import { generateUniqueMemberId } from '../utils/memberId.js';

/** Apply SecureData auth schema updates for existing deployments. */
export async function migrateSecureAuthSchema(): Promise<void> {
  await secureQuery('ALTER TABLE users ADD COLUMN IF NOT EXISTS member_id STRING');
  await secureQuery(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_secure_users_member_id ON users (member_id)',
  );

  const missing = await secureQuery<{ id: string }>(
    "SELECT id FROM users WHERE member_id IS NULL OR member_id = ''",
  );

  for (const row of missing) {
    const memberId = await generateUniqueMemberId();
    await secureQuery(
      'UPDATE users SET member_id = $2, updated_at = now() WHERE id = $1',
      [row.id, memberId],
    );
  }
}

export async function ensureUserMemberId(userDbId: string): Promise<string> {
  const rows = await secureQuery<{ member_id: string | null }>(
    'SELECT member_id FROM users WHERE id = $1',
    [userDbId],
  );
  const existing = rows[0]?.member_id;
  if (existing) return existing;

  const memberId = await generateUniqueMemberId();
  await secureQuery(
    'UPDATE users SET member_id = $2, updated_at = now() WHERE id = $1',
    [userDbId, memberId],
  );
  return memberId;
}
