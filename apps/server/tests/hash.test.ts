import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/utils/hash';

describe('hashPassword / verifyPassword', () => {
  it('hashes and verifies a password', () => {
    const hash = hashPassword('correct horse battery staple');
    expect(hash).toMatch(/^scrypt:/);
    expect(hash).not.toContain('correct horse');
    expect(verifyPassword('correct horse battery staple', hash)).toBe(true);
  });

  it('rejects wrong password', () => {
    const hash = hashPassword('hunter2');
    expect(verifyPassword('wrong', hash)).toBe(false);
  });

  it('produces unique salts (different hashes for same password)', () => {
    expect(hashPassword('same')).not.toBe(hashPassword('same'));
  });

  it('rejects malformed stored values', () => {
    expect(verifyPassword('x', 'not-a-valid-hash')).toBe(false);
  });
});
