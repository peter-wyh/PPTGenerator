import { describe, expect, it, vi } from 'vitest';

// token.ts 顶层 import config/redis，mock 掉避免读 env / 连 Redis。
vi.mock('../../config', () => ({
  config: {
    jwt: {
      accessSecret: 'test-access-secret-at-least-32-chars!!',
      refreshSecret: 'test-refresh-secret-at-least-32-chars!!',
      accessTtlSec: 900,
      refreshTtlSec: 604800,
    },
  },
}));
vi.mock('../../redis', () => ({ redis: {} }));

import { signAccessToken, verifyAccessToken } from './token';

describe('signAccessToken · businessLineCode claim', () => {
  it('带 bl: 签发后验签可读回', async () => {
    const token = await signAccessToken('user-1', 'USER', 'DG');
    const payload = await verifyAccessToken(token);
    expect(payload.sub).toBe('user-1');
    expect(payload.role).toBe('USER');
    expect(payload.bl).toBe('DG');
    expect(payload.type).toBe('access');
  });

  it('不带 bl: 验签后 bl 为 null（不抛错，兼容显式传 null）', async () => {
    const token = await signAccessToken('user-2', 'ADMIN', null);
    const payload = await verifyAccessToken(token);
    expect(payload.bl).toBeNull();
  });

  it('旧签名（无第三参）: bl 为 null，验签不炸', async () => {
    const token = await signAccessToken('user-3', 'ADMIN');
    const payload = await verifyAccessToken(token);
    expect(payload.bl).toBeNull();
  });
});
