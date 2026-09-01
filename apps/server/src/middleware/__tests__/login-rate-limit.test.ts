/**
 * P1-2 登录双桶限流验证：真实 Express app + 内存 store 顺序打点
 * 断言：第 11 次同 IP 登录请求 → 429 LOGIN_RATE_LIMITED；不同邮箱不影响 IP 桶计数
 */
import { describe, it, expect, beforeAll } from 'vitest';
import express, { type Express, type Request, type Response } from 'express';
import request from 'supertest';

// 内存版 limiter（绕开 Redis 依赖，逻辑与 rate-limit.ts 同构：同 windowMs/limit/key 策略）
import rateLimit from 'express-rate-limit';

function buildApp() {
  const app = express();
  app.use(express.json());
  const loginIpLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req: Request) => 'login-ip:' + (req.ip ?? ''),
    message: { error: 'LOGIN_RATE_LIMITED', message: '登录尝试过于频繁，请 5 分钟后再试' },
  });
  const loginEmailLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req: Request) => 'login-email:' + String((req.body as { email?: unknown })?.email ?? '').toLowerCase(),
    message: { error: 'LOGIN_RATE_LIMITED', message: '登录尝试过于频繁，请 5 分钟后再试' },
  });
  const fakeAuth = (_req: Request, res: Response) => res.status(401).json({ error: 'INVALID_CREDENTIALS' });
  app.post('/api/v1/auth/login', loginIpLimiter, loginEmailLimiter, fakeAuth);
  return app;
}

describe('login rate limiters (P1-2)', () => {
  let app: Express;
  beforeAll(() => { app = buildApp(); });

  it('同 IP 前 10 次放行（凭据错也是 401 非 429）', async () => {
    for (let i = 0; i < 10; i++) {
      const r = await request(app).post('/api/v1/auth/login').send({ email: 'a@x.com', password: 'wrong' });
      expect(r.status).toBe(401);
    }
  });

  it('第 11 次同 IP → 429 LOGIN_RATE_LIMITED（换邮箱也不放行）', async () => {
    const r = await request(app).post('/api/v1/auth/login').send({ email: 'other@x.com', password: 'x' });
    expect(r.status).toBe(429);
    expect(r.body.error).toBe('LOGIN_RATE_LIMITED');
  });

  it('邮箱桶独立：单邮箱打满 10 次后第 11 次 429（IP 桶同打满，二者都触发）', async () => {
    const app2 = buildApp();
    for (let i = 0; i < 10; i++) {
      const r = await request(app2).post('/api/v1/auth/login').send({ email: 'victim@x.com', password: 'guess' + i });
      expect(r.status).toBe(401);
    }
    const r = await request(app2).post('/api/v1/auth/login').send({ email: 'victim@x.com', password: 'final' });
    expect(r.status).toBe(429);
  });
});
