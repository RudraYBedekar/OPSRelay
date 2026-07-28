import type { Request, Response, NextFunction } from 'express';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

const attempts = new Map<string, { count: number; resetAt: number }>();

function clientKey(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress ?? 'unknown';
}

export function loginRateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = clientKey(req);
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }

  if (entry.count >= MAX_ATTEMPTS) {
    const retrySec = Math.ceil((entry.resetAt - now) / 1000);
    res.status(429).json({
      error: `Too many login attempts. Try again in ${retrySec} seconds.`,
    });
    return;
  }

  entry.count += 1;
  next();
}

/** Call after failed login to track attempts (successful login clears the counter) */
export function recordFailedLogin(req: Request): void {
  const key = clientKey(req);
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export function clearLoginAttempts(req: Request): void {
  attempts.delete(clientKey(req));
}
