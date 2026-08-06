import { describe, expect, it } from 'vitest';

function memberSuffix(memberId: string): string {
  return memberId.replace(/[^A-Z0-9]/gi, '').slice(-6).toUpperCase();
}

function welcomeId(memberId: string, index: number): string {
  return `INC-WEL-${memberSuffix(memberId)}-${String(index).padStart(2, '0')}`;
}

describe('welcome incident ids', () => {
  it('uses stable per-member prefix for five starter incidents', () => {
    const memberId = 'MEM-5FF7327A';
    expect(welcomeId(memberId, 1)).toBe('INC-WEL-F7327A-01');
    expect(welcomeId(memberId, 5)).toBe('INC-WEL-F7327A-05');
  });
});
