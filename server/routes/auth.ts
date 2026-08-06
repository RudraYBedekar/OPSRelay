import { Router } from 'express';
import { isAuthEnabled } from '../config/auth.js';
import { requireAuth } from '../middleware/auth.js';
import { clearLoginAttempts, loginRateLimit, recordFailedLogin } from '../middleware/loginRateLimit.js';
import { registerRateLimit } from '../middleware/registerRateLimit.js';
import { logAuthEvent } from '../services/authAudit.js';
import {
  findUserByIdentifier,
  registerUser,
  signToken,
  toPublicUser,
  touchLastLogin,
  verifyPassword,
} from '../services/authService.js';
import { ensureUserMemberId } from '../services/authMigration.js';
import { seedWelcomeIncidentsIfNeeded } from '../services/welcomeIncidentService.js';

export const authRouter = Router();

authRouter.get('/status', (_req, res) => {
  res.json({
    authEnabled: isAuthEnabled(),
    secureDatabase: process.env.CRDB_SECURE_DATABASE ?? 'SecureData',
  });
});

authRouter.post('/register', registerRateLimit, async (req, res, next) => {
  try {
    if (!isAuthEnabled()) {
      res.status(503).json({ error: 'Registration is disabled on this server' });
      return;
    }

    const { userId, email, password, name, confirmPassword } = req.body as {
      userId?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
      name?: string;
    };

    if (!userId?.trim() || !email?.trim() || !password || !name?.trim()) {
      res.status(400).json({ error: 'User ID, email, display name, and password are required' });
      return;
    }

    if (password !== confirmPassword) {
      res.status(400).json({ error: 'Passwords do not match' });
      return;
    }

    const user = await registerUser({ userId, email, password, name });
    await logAuthEvent('register', req, user.id, { userId: user.userId });
    try {
      await seedWelcomeIncidentsIfNeeded(user);
    } catch {
      // auth succeeds even if demo seed fails
    }

    const token = signToken(user);
    res.status(201).json({
      token,
      user,
      expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
      message: 'Account created securely',
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('already taken')) {
      await logAuthEvent('register_failed', req, null, { reason: 'duplicate_user_id' });
      res.status(409).json({ error: err.message });
      return;
    }
    if (err instanceof Error && err.message.includes('email already exists')) {
      await logAuthEvent('register_failed', req, null, { reason: 'duplicate_email' });
      res.status(409).json({ error: err.message });
      return;
    }
    if (err instanceof Error && err.message.includes('already exists')) {
      await logAuthEvent('register_failed', req, null, { reason: 'duplicate' });
      res.status(409).json({ error: err.message });
      return;
    }
    if (err instanceof Error && (
      err.message.includes('User ID') ||
      err.message.includes('email') ||
      err.message.includes('Password') ||
      err.message.includes('Display name')
    )) {
      await logAuthEvent('register_failed', req, null, { reason: 'validation' });
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});

authRouter.post('/login', loginRateLimit, async (req, res, next) => {
  try {
    if (!isAuthEnabled()) {
      res.status(503).json({ error: 'Authentication is disabled on this server' });
      return;
    }

    const { email, identifier, password } = req.body as {
      email?: string;
      identifier?: string;
      password?: string;
    };

    const loginId = (identifier ?? email)?.trim();
    if (!loginId || !password) {
      res.status(400).json({ error: 'Email or user ID and password are required' });
      return;
    }

    if (password.length > 128) {
      res.status(400).json({ error: 'Invalid credentials' });
      return;
    }

    const userRow = await findUserByIdentifier(loginId);
    if (!userRow) {
      recordFailedLogin(req);
      await logAuthEvent('login_failed', req, null, { reason: 'unknown_user' });
      res.status(401).json({ error: 'Invalid email/user ID or password' });
      return;
    }

    const valid = await verifyPassword(password, userRow.password_hash);
    if (!valid) {
      recordFailedLogin(req);
      await logAuthEvent('login_failed', req, userRow.id, { reason: 'bad_password' });
      res.status(401).json({ error: 'Invalid email/user ID or password' });
      return;
    }

    clearLoginAttempts(req);

    const memberId = userRow.member_id || await ensureUserMemberId(userRow.id);

    const user = toPublicUser({
      id: userRow.id,
      memberId,
      userId: userRow.user_id,
      email: userRow.email,
      name: userRow.name,
      role: userRow.role === 'admin' ? 'admin' : 'operator',
    });

    try {
      await seedWelcomeIncidentsIfNeeded(user);
    } catch {
      // login succeeds even if demo seed fails
    }

    await touchLastLogin(userRow.id);
    await logAuthEvent('login_success', req, userRow.id);

    const token = signToken(user);
    res.json({ token, user, expiresIn: process.env.JWT_EXPIRES_IN ?? '8h' });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { findUserById } = await import('../services/authService.js');
    const fresh = await findUserById(req.user!.id);
    res.json({ user: fresh ?? req.user! });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', requireAuth, (_req, res) => {
  res.status(204).send();
});
