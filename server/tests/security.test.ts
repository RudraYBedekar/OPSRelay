import { describe, expect, it } from 'vitest';
import { canEditIncident, canViewIncident } from '../services/incidentAccessService.js';
import type { AuthUser } from '../services/authService.js';
import { scanAndRedactSecrets, assertNotesSafeForProcessing } from '../utils/redactSecrets.js';
import { validateEmbedding } from '../utils/embeddingValidation.js';
import { parseExtractionResult } from '../schemas/extraction.js';

const owner: AuthUser = {
  id: '1',
  memberId: 'MEM-AAAAAAAA',
  userId: 'owner',
  email: 'owner@test.io',
  name: 'Owner',
  role: 'operator',
};

const viewer: AuthUser = {
  id: '2',
  memberId: 'MEM-BBBBBBBB',
  userId: 'viewer',
  email: 'viewer@test.io',
  name: 'Viewer',
  role: 'operator',
};

describe('authorization policy', () => {
  it('allows owner to edit their incident', () => {
    expect(canEditIncident({ ownerMemberId: owner.memberId }, owner)).toBe(true);
  });

  it('denies shared viewer from editing', () => {
    const incident = { ownerMemberId: owner.memberId, sharedWithMemberIds: [viewer.memberId] };
    expect(canViewIncident(incident, viewer, new Set())).toBe(true);
    expect(canEditIncident(incident, viewer)).toBe(false);
  });
});

describe('secret redaction', () => {
  it('blocks AWS access keys', () => {
    expect(() => assertNotesSafeForProcessing('key AKIAIOSFODNN7EXAMPLE leaked')).toThrow();
  });

  it('redacts bearer tokens', () => {
    const result = scanAndRedactSecrets('Authorization: Bearer secret-token-123');
    expect(result.redactedText).toContain('[REDACTED:bearer_token]');
    expect(result.blocked).toBe(false);
  });
});

describe('embedding validation', () => {
  it('rejects wrong dimensions', () => {
    expect(() => validateEmbedding(new Array(1023).fill(0.1))).toThrow();
  });

  it('rejects non-finite values', () => {
    const vec = new Array(1024).fill(0.1);
    vec[10] = NaN;
    expect(() => validateEmbedding(vec)).toThrow();
  });
});

describe('extraction schema', () => {
  it('normalizes malformed LLM output', () => {
    const parsed = parseExtractionResult({
      severity: 'SEV-1',
      service: 'billing',
      tasks: null,
      timeline: null,
    });
    expect(parsed.tasks).toEqual([]);
    expect(parsed.timeline).toEqual([]);
  });
});
