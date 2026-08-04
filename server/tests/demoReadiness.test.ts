import { describe, expect, it } from 'vitest';
import { sanitizeEvidenceText } from '../services/evidenceProjectionService.js';
import { getMcpHealth } from '../config/mcp.js';
import { assertToolAllowed, assertSafeSelectSql } from '../mcp/mcpToolPolicy.js';

describe('evidence sanitization', () => {
  it('redacts bearer tokens before projection', () => {
    const out = sanitizeEvidenceText('token Bearer abcdefghijklmnopqrstuvwxyz012345', 500);
    expect(out).toContain('[REDACTED');
    expect(out).not.toContain('abcdefghijklmnopqrstuvwxyz012345');
  });

  it('returns null for empty strings', () => {
    expect(sanitizeEvidenceText('   ', 100)).toBeNull();
  });
});

describe('MCP honesty', () => {
  it('does not claim managed MCP when disabled', () => {
    const health = getMcpHealth();
    if (health.mode === 'disabled') {
      expect(health.provider).toBe('none');
      expect(health.status).toBe('not_configured');
    }
  });

  it('still denies write tools', () => {
    expect(() => assertToolAllowed('insert_rows')).toThrow();
    expect(() => assertSafeSelectSql('DELETE FROM incident_evidence', 'incident_evidence')).toThrow();
  });
});
