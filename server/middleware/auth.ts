import type { Request, Response, NextFunction } from 'express';
import { isAuthEnabled } from '../config/auth.js';
import { verifyToken } from '../services/authService.js';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!isAuthEnabled()) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const user = verifyToken(authHeader.slice(7));
  if (!user) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  req.user = user;
  next();
}
