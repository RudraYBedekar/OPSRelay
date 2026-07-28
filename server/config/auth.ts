export function isAuthEnabled(): boolean {
  return process.env.AUTH_ENABLED !== 'false';
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set (min 32 chars) in production');
  }

  console.warn(
    '[auth] JWT_SECRET not set — using insecure dev default. Set JWT_SECRET in .env for production.',
  );
  return 'opsrelay-dev-secret-change-in-production-min-32-chars';
}

export function getJwtExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN ?? '8h';
}

export function getSeedDefaultPassword(): string {
  return process.env.SEED_DEFAULT_PASSWORD ?? 'OpsRelay2026!';
}
