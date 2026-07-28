/** Derive 1–2 letter initials from a display name (strips role suffix in parentheses). */
export function getInitials(name: string): string {
  const base = name.split('(')[0].trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** First token of a name for compact display. */
export function firstName(name: string): string {
  return name.split('(')[0].trim().split(/\s+/)[0] ?? name;
}
