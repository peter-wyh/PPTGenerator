import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, createUser, login, authHeader } from './helpers';

// 1×1 透明 PNG。
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

describe('uploads', () => {
  it('201 + 返回 /uploads URL（已鉴权 + 图片）', async () => {
    await createUser({ email: 'up@x.com' });
    const { accessToken } = await login(app(), 'up@x.com');
    const res = await request(app())
      .post('/api/v1/uploads')
      .set(authHeader(accessToken))
      .attach('file', PNG, 'a.png');
    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(/\/uploads\/.+\.png$/);
  });

  it('400 非图片类型被拒', async () => {
    await createUser({ email: 'up2@x.com' });
    const { accessToken } = await login(app(), 'up2@x.com');
    const res = await request(app())
      .post('/api/v1/uploads')
      .set(authHeader(accessToken))
      .attach('file', Buffer.from('hello'), 'a.txt');
    expect(res.status).toBe(400);
  });

  it('401 未鉴权', async () => {
    const res = await request(app()).post('/api/v1/uploads').attach('file', PNG, 'a.png');
    expect(res.status).toBe(401);
  });
});
