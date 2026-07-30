import crypto from 'crypto';
import { secureQueryOne } from '../secureDb.js';

/** Generate a human-readable unique member ID, e.g. MEM-A3F9B2C1 */
export function generateMemberId(): string {
  return `MEM-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

export async function generateUniqueMemberId(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const memberId = generateMemberId();
    const taken = await secureQueryOne<{ n: number }>(
      'SELECT 1 AS n FROM users WHERE member_id = $1',
      [memberId],
    );
    if (!taken) return memberId;
  }
  throw new Error('Could not generate a unique member ID');
}
