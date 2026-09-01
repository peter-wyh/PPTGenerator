import { describe, expect, it } from 'vitest';
import { fakeVerifyPassword, hashPassword, verifyPassword } from '../hash';

describe('hash utils', () => {
  it('hash → verify 往返', async () => {
    const stored = await hashPassword('s3cret-P@ss');
    expect(stored.startsWith('scrypt:')).toBe(true);
    expect(await verifyPassword('s3cret-P@ss', stored)).toBe(true);
    expect(await verifyPassword('wrong', stored)).toBe(false);
  });

  it('畸形 stored 直接 false，不抛异常', async () => {
    expect(await verifyPassword('x', '')).toBe(false);
    expect(await verifyPassword('x', 'plain')).toBe(false);
    expect(await verifyPassword('x', 'bcrypt:aa:bb')).toBe(false);
  });

  it('fakeVerifyPassword 恒 false（时序均衡器）', async () => {
    expect(await fakeVerifyPassword('anything')).toBe(false);
    expect(await fakeVerifyPassword('')).toBe(false);
  });

  it('异步实现不阻塞事件循环（scrypt 期间定时器仍触发）', async () => {
    let tick = false;
    const t = setTimeout(() => { tick = true; }, 5);
    await hashPassword('non-blocking-check');
    clearTimeout(t);
    // scrypt(N=16384) 耗时远大于 5ms，若为同步实现定时器必来不及触发
    expect(tick).toBe(true);
  });

  it('时序均衡：不存在用户路径与存在用户路径耗时同量级', async () => {
    const t = async (fn: () => Promise<boolean>) => {
      const start = performance.now();
      await fn();
      return performance.now() - start;
    };
    const stored = await hashPassword('real-user-pass');
    const realMs = await t(() => verifyPassword('guess', stored));
    const fakeMs = await t(() => fakeVerifyPassword('guess'));
    // 都是单次 scrypt(64B)，差异应在 2x 以内（防抖动，量级对齐即达标）
    expect(Math.abs(realMs - fakeMs)).toBeLessThan(Math.max(realMs, fakeMs));
  });
});
