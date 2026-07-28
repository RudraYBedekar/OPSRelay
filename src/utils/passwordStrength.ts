export interface PasswordCheck {
  valid: boolean;
  errors: string[];
  score: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USER_ID_RE = /^[a-zA-Z0-9._-]{3,32}$/;

export function checkPasswordStrength(password: string): PasswordCheck {
  const errors: string[] = [];
  let score = 0;

  if (password.length < 10) errors.push('At least 10 characters');
  else score += 1;
  if (password.length >= 14) score += 1;
  if (!/[a-z]/.test(password)) errors.push('Lowercase letter');
  else score += 1;
  if (!/[A-Z]/.test(password)) errors.push('Uppercase letter');
  else score += 1;
  if (!/[0-9]/.test(password)) errors.push('Number');
  else score += 1;
  if (!/[^a-zA-Z0-9]/.test(password)) errors.push('Special character');
  else score += 1;

  return { valid: errors.length === 0, errors, score };
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim()) && email.trim().length <= 254;
}

export function isValidUserId(userId: string): boolean {
  return USER_ID_RE.test(userId.trim());
}

export function passwordStrengthLabel(score: number): { label: string; color: string } {
  if (score <= 2) return { label: 'Weak', color: 'bg-red-500' };
  if (score <= 4) return { label: 'Fair', color: 'bg-amber-500' };
  return { label: 'Strong', color: 'bg-emerald-500' };
}
