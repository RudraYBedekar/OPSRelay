import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { secureQuery, secureQueryOne } from '../secureDb.js';
import { getJwtExpiresIn, getJwtSecret } from '../config/auth.js';
import {
  normalizeEmail,
  normalizeUserId,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validateUserId,
} from '../utils/passwordPolicy.js';

export interface AuthUser {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: 'operator' | 'admin';
}

interface UserRow {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: string;
  password_hash: string;
}

const BCRYPT_ROUNDS = 12;

function applyPepper(password: string): string {
  const pepper = process.env.PASSWORD_PEPPER ?? '';
  return pepper ? `${password}${pepper}` : password;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(applyPepper(password), BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(applyPepper(password), hash);
}

export function signToken(user: AuthUser): string {
  return jwt.sign(
    {
      sub: user.id,
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    getJwtSecret(),
    { expiresIn: getJwtExpiresIn() },
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as jwt.JwtPayload;
    if (!payload.sub || typeof payload.email !== 'string') return null;
    return {
      id: String(payload.sub),
      userId: typeof payload.userId === 'string' ? payload.userId : String(payload.email).split('@')[0],
      email: payload.email,
      name: typeof payload.name === 'string' ? payload.name : payload.email.split('@')[0],
      role: payload.role === 'admin' ? 'admin' : 'operator',
    };
  } catch {
    return null;
  }
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  return secureQueryOne<UserRow>(
    'SELECT id, user_id, email, name, role, password_hash FROM users WHERE lower(email) = lower($1)',
    [email.trim()],
  );
}

export async function findUserByUserId(userId: string): Promise<UserRow | null> {
  return secureQueryOne<UserRow>(
    'SELECT id, user_id, email, name, role, password_hash FROM users WHERE lower(user_id) = lower($1)',
    [userId.trim()],
  );
}

export async function findUserByIdentifier(identifier: string): Promise<UserRow | null> {
  const trimmed = identifier.trim();
  if (trimmed.includes('@')) return findUserByEmail(trimmed);
  return findUserByUserId(trimmed);
}

export async function findUserById(id: string): Promise<AuthUser | null> {
  const row = await secureQueryOne<{ id: string; user_id: string; email: string; name: string; role: string }>(
    'SELECT id, user_id, email, name, role FROM users WHERE id = $1',
    [id],
  );
  if (!row) return null;
  return rowToPublicUser(row);
}

function rowToPublicUser(row: { id: string; user_id: string; email: string; name: string; role: string }): AuthUser {
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    name: row.name,
    role: row.role === 'admin' ? 'admin' : 'operator',
  };
}

export function toPublicUser(user: AuthUser): AuthUser {
  return { id: user.id, userId: user.userId, email: user.email, name: user.name, role: user.role };
}

export interface RegisterInput {
  userId: string;
  email: string;
  password: string;
  name: string;
}

export async function registerUser(input: RegisterInput): Promise<AuthUser> {
  const userId = normalizeUserId(input.userId);
  const email = normalizeEmail(input.email);
  const name = input.name.trim();

  const userIdErr = validateUserId(userId);
  if (userIdErr) throw new Error(userIdErr);

  const emailErr = validateEmail(email);
  if (emailErr) throw new Error(emailErr);

  const nameErr = validateDisplayName(name);
  if (nameErr) throw new Error(nameErr);

  const pwCheck = validatePassword(input.password);
  if (!pwCheck.valid) throw new Error(pwCheck.errors.join('. '));

  const [existingEmail, existingUserId] = await Promise.all([
    findUserByEmail(email),
    findUserByUserId(userId),
  ]);

  if (existingEmail || existingUserId) {
    throw new Error('An account with this email or user ID already exists');
  }

  const passwordHash = await hashPassword(input.password);

  const row = await secureQueryOne<{ id: string; user_id: string; email: string; name: string; role: string }>(
    `INSERT INTO users (user_id, email, password_hash, name, role)
     VALUES ($1, $2, $3, $4, 'operator')
     RETURNING id, user_id, email, name, role`,
    [userId, email, passwordHash, name],
  );

  if (!row) throw new Error('Registration failed');

  return rowToPublicUser(row);
}

export async function touchLastLogin(userId: string): Promise<void> {
  await secureQuery(
    'UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = $1',
    [userId],
  );
}
