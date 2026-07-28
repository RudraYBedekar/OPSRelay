export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  score: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USER_ID_RE = /^[a-zA-Z0-9._-]{3,32}$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeUserId(userId: string): string {
  return userId.trim().toLowerCase();
}

export function validateEmail(email: string): string | null {
  const normalized = normalizeEmail(email);
  if (!normalized || normalized.length > 254) return 'Enter a valid email address';
  if (!EMAIL_RE.test(normalized)) return 'Enter a valid email (Gmail, Outlook, etc.)';
  return null;
}

export function validateUserId(userId: string): string | null {
  const normalized = normalizeUserId(userId);
  if (!USER_ID_RE.test(normalized)) {
    return 'User ID must be 3–32 characters (letters, numbers, . _ -)';
  }
  return null;
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  let score = 0;

  if (password.length < 10) errors.push('At least 10 characters');
  else score += 1;
  if (password.length >= 14) score += 1;

  if (!/[a-z]/.test(password)) errors.push('One lowercase letter');
  else score += 1;

  if (!/[A-Z]/.test(password)) errors.push('One uppercase letter');
  else score += 1;

  if (!/[0-9]/.test(password)) errors.push('One number');
  else score += 1;

  if (!/[^a-zA-Z0-9]/.test(password)) errors.push('One special character');
  else score += 1;

  if (password.length > 128) errors.push('Password is too long');

  return { valid: errors.length === 0, errors, score };
}

export function validateDisplayName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Display name is required';
  if (trimmed.length > 64) return 'Display name is too long';
  return null;
}
