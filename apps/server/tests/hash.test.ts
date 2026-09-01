import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/utils/hash';

describe('hashPassword / verifyPassword', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).toMatch(/^scrypt:/);
    expect(hash).not.toContain('correct horse');
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
  });

  it('rejects wrong password', async () => {
    const hash = await hashPassword('hunter2');
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('produces unique salts (different hashes for same password)', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('rejects malformed stored values', async () => {
    expect(await verifyPassword('x', 'not-a-valid-hash')).toBe(false);
  });
});
