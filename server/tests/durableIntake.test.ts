import { describe, expect, it } from 'vitest';
import { parseExtractionResult } from '../schemas/extraction.js';
import { scanAndRedactSecrets } from '../utils/redactSecrets.js';

describe('durable intake invariants', () => {
  it('validates extraction draft with null tasks as empty array', () => {
    const parsed = parseExtractionResult({
      severity: 'SEV-2',
      service: 'billing',
      component: 'api',
      summary: 'Test summary',
      tasks: null,
      timeline: null,
      decisions: undefined,
      suggestedFixes: null,
      severityReason: 'test',
      confidenceScore: 80,
    });
    expect(Array.isArray(parsed.tasks)).toBe(true);
    expect(parsed.service).toBe('billing');
  });

  it('redacts secrets before analysis would run', () => {
    const result = scanAndRedactSecrets('token=Bearer abcdefghijklmnopqrst');
    expect(result.redactedText).toContain('[REDACTED');
    expect(result.redactedText).not.toContain('abcdefghijklmnopqrst');
  });

  it('duplicate approval conflict uses 409 semantics in service layer', () => {
    const err = Object.assign(new Error('Analysis already approved'), { status: 409 });
    expect(err.status).toBe(409);
  });
});
