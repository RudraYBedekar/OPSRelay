import crypto from 'crypto';
import type { Request } from 'express';
import { secureQueryOne } from '../secureDb.js';
import { getJwtSecret } from '../config/auth.js';

function auditSalt(): string {
  return process.env.AUDIT_IP_SALT ?? getJwtSecret();
}

export function hashClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : req.socket.remoteAddress ?? 'unknown';

  return crypto
    .createHash('sha256')
    .update(`${ip}:${auditSalt()}`)
    .digest('hex')
    .slice(0, 24);
}

export async function logAuthEvent(
  eventType: 'register' | 'login_success' | 'login_failed' | 'register_failed',
  req: Request,
  userRef?: string | null,
  meta: Record<string, unknown> = {},
): Promise<void> {
  try {
    await secureQueryOne(
      `INSERT INTO auth_audit_log (event_type, user_ref, ip_hash, meta)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id`,
      [eventType, userRef ?? null, hashClientIp(req), JSON.stringify(meta)],
    );
  } catch (err) {
    console.warn('[auth-audit] Failed to write audit log:', err instanceof Error ? err.message : err);
  }
}
