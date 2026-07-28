/** Build a professional executive summary when AI/fallback parses raw logs. */
export function buildExecutiveSummary(opts: {
  service: string;
  component: string;
  severity: string;
  rawNotes: string;
}): string {
  const lines = opts.rawNotes
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const alertLine =
    lines.find((l) => /alert|error|fail|oom|timeout|500|503|429|critical|sev-/i.test(l)) ??
    lines[0] ??
    'An operational anomaly was reported in monitoring.';

  const cleanAlert = alertLine.replace(/^\[[^\]]+\]\s*/, '').slice(0, 140);

  const impact =
    opts.severity === 'SEV-0'
      ? 'User-facing availability is likely impaired and immediate response is required.'
      : opts.severity === 'SEV-1'
        ? 'A significant degradation in service reliability or transaction success rate is indicated.'
        : opts.severity === 'SEV-2'
          ? 'Partial degradation is suspected; user impact should be validated against SLO dashboards.'
          : 'Impact appears limited, but monitoring and trend validation are still recommended.';

  return (
    `${opts.service} (${opts.component}) has triggered an incident classified as ${opts.severity}. ` +
    `Initial signal: ${cleanAlert}. ${impact} ` +
    `Engineering should confirm blast radius, establish a timeline, and document mitigations in OpsRelay.`
  );
}

/** Normalize LLM summary field to professional prose (no raw log dumps). */
export function polishSummary(summary: unknown, fallback: string): string {
  if (typeof summary !== 'string' || !summary.trim()) return fallback;

  let text = summary.trim().replace(/\s+/g, ' ');

  // Reject summaries that look like raw log paste
  if (/^\[\d{4}|^\d{4}-\d{2}-\d{2}T|ERROR:|ALERT:/i.test(text) && text.length > 180) {
    return fallback;
  }

  if (text.length > 320) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
    text = sentences.slice(0, 3).join(' ').trim();
  }

  return text;
}
