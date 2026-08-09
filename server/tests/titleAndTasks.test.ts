import { describe, expect, it } from 'vitest';
import { extractionResultSchema } from '../schemas/extraction.js';
import { parseGeneratedTaskIncidentId, parseTaskIncidentId } from '../utils/incidentTasks.js';

describe('approval title validation', () => {
  it('persists a human-edited title on approval payload', () => {
    const parsed = extractionResultSchema.parse({
      title: 'Custom outage title',
      service: 'payment-api',
      component: 'webhooks',
      summary: 'Stripe webhooks failing',
    });
    expect(parsed.title).toBe('Custom outage title');
  });

  it('trims the approved title', () => {
    const parsed = extractionResultSchema.parse({
      title: '  Trimmed title here  ',
      service: 'payment-api',
      component: 'webhooks',
      summary: 'Summary',
    });
    expect(parsed.title).toBe('Trimmed title here');
  });

  it('rejects an empty approved title when provided', () => {
    expect(() =>
      extractionResultSchema.parse({
        title: '  ',
        service: 'payment-api',
        component: 'webhooks',
        summary: 'Summary',
      }),
    ).toThrow();
  });

  it('allows legacy callers without title', () => {
    const parsed = extractionResultSchema.parse({
      service: 'payment-api',
      component: 'webhooks',
      summary: 'Summary',
    });
    expect(parsed.title).toBeUndefined();
  });
});

describe('task identity helpers', () => {
  it('generates parseable incident id from scoped task ids', () => {
    const taskId = 'tsk-INC-8942-a1b2c3d4-0';
    expect(parseGeneratedTaskIncidentId(taskId)).toBe('INC-8942');
    expect(parseTaskIncidentId(taskId)).toBe('INC-8942');
  });

  it('parses default triage task ids', () => {
    expect(parseTaskIncidentId('tsk-INC-A-PAYMENT-triage')).toBe('INC-A-PAYMENT');
  });
});
