import crypto from 'crypto';

/** Server-generated incident IDs — never trust client-supplied IDs on create. */
export function generateIncidentId(): string {
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `INC-${suffix}`;
}
