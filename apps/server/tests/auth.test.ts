import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, createUser, login, authHeader, cookieValue } from './helpers';
import { config } from '../src/config';

const COOKIE_NAME = config.cookie.name;

describe('auth', () => {
  describe('POST /api/v1/auth/login', () => {
    it('200 + access token + refresh cookie on valid credentials', async () => {
      await createUser({ email: 'alice@x.com', name: 'Alice', role: 'ADMIN' });
      const res = await request(app())
        .post('/api/v1/auth/login')
        .send({ email: 'alice@x.com', password: 'Password123' });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user.email).toBe('alice@x.com');
      expect(res.body.user.role).toBe('ADMIN');
      expect(res.body.expiresIn).toBe(900);
      const setCookie = res.headers['set-cookie'] as unknown as string[];
      expect(setCookie.some((c) => c.startsWith(`${COOKIE_NAME}=`))).toBe(true);
      expect(setCookie.some((c) => c.includes('HttpOnly'))).toBe(true);
    });

    it('401 on wrong password', async () => {
      await createUser({ email: 'bob@x.com' });
      const res = await request(app())
        .post('/api/v1/auth/login')
        .send({ email: 'bob@x.com', password: 'wrong' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('401 on unknown user', async () => {
      const res = await request(app())
        .post('/api/v1/auth/login')
        .send({ email: 'ghost@x.com', password: 'Password123' });
      expect(res.status).toBe(401);
    });

    it('400 on invalid body', async () => {
      const res = await request(app()).post('/api/v1/auth/login').send({ password: 'x' });
      expect(res.status).toBe(400);
    });

    it('normalizes email to lowercase', async () => {
      await createUser({ email: 'case@x.com' });
      const res = await request(app())
        .post('/api/v1/auth/login')
        .send({ email: 'CASE@X.COM', password: 'Password123' });
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('200 with current user when authenticated', async () => {
      const u = await createUser({ email: 'me@x.com', name: 'Me' });
      const { accessToken } = await login(app(), u.email);
      const res = await request(app()).get('/api/v1/auth/me').set(authHeader(accessToken));
      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(u.id);
    });

    it('401 without access token', async () => {
      const res = await request(app()).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('401 with malformed token', async () => {
      const res = await request(app()).get('/api/v1/auth/me').set(authHeader('garbage'));
      expect(res.status).toBe(401);
    });
  });

  describe('refresh rotation + blacklist', () => {
    it('issues a new access token and rotates the refresh cookie', async () => {
      const u = await createUser({ email: 'rot@x.com' });
      const first = await login(app(), u.email);
      const oldCookie = cookieValue(first.setCookie, COOKIE_NAME);

      const res = await request(app())
        .post('/api/v1/auth/refresh')
        .set('Cookie', oldCookie);

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toEqual(expect.any(String));
      // 新 access token 可用于鉴权（JWT 在同秒对相同 payload 是确定的，不比字符串）。
      const me = await request(app()).get('/api/v1/auth/me').set(authHeader(res.body.accessToken));
      expect(me.status).toBe(200);
      const newCookie = (res.headers['set-cookie'] as unknown as string[]).find((c) =>
        c.startsWith(`${COOKIE_NAME}=`),
      );
      expect(newCookie).toBeDefined();
      // 新 cookie 值与旧的不同（refresh 轮换）。
      expect(cookieValue([newCookie!], COOKIE_NAME)).not.toBe(oldCookie);
    });

    it('rejects replay of an already-rotated refresh token (blacklist)', async () => {
      const u = await createUser({ email: 'blk@x.com' });
      const first = await login(app(), u.email);
      const oldCookie = cookieValue(first.setCookie, COOKIE_NAME);

      // 第一次刷新成功（作废旧 token）。
      await request(app()).post('/api/v1/auth/refresh').set('Cookie', oldCookie);

      // 用同一旧 token 重放 -> 401。
      const replay = await request(app()).post('/api/v1/auth/refresh').set('Cookie', oldCookie);
      expect(replay.status).toBe(401);
    });

    it('400/401 without a refresh cookie', async () => {
      const res = await request(app()).post('/api/v1/auth/refresh');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('204 and clears the refresh cookie', async () => {
      const u = await createUser({ email: 'out@x.com' });
      const { setCookie } = await login(app(), u.email);
      const cookie = cookieValue(setCookie, COOKIE_NAME);

      const res = await request(app()).post('/api/v1/auth/logout').set('Cookie', cookie);
      expect(res.status).toBe(204);

      // logout 后 refresh 失效。
      const replay = await request(app()).post('/api/v1/auth/refresh').set('Cookie', cookie);
      expect(replay.status).toBe(401);
    });

    it('204 even without a cookie (idempotent)', async () => {
      const res = await request(app()).post('/api/v1/auth/logout');
      expect(res.status).toBe(204);
    });
  });
});
