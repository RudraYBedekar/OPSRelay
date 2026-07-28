import type { Request, Response, NextFunction } from 'express';

const WINDOW_MS = 60 * 60 * 1000;
const MAX_REGISTRATIONS = 5;

const attempts = new Map<string, { count: number; resetAt: number }>();

function clientKey(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress ?? 'unknown';
}

export function registerRateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = clientKey(req);
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }

  if (entry.count >= MAX_REGISTRATIONS) {
    const retrySec = Math.ceil((entry.resetAt - now) / 1000);
    res.status(429).json({
      error: `Too many registration attempts. Try again in ${retrySec} seconds.`,
    });
    return;
  }

  entry.count += 1;
  next();
}
