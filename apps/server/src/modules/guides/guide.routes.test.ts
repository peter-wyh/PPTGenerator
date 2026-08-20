import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';

describe('guides routes · 鉴权与挂载', () => {
  it('未登录 GET /api/v1/guides → 401(不是 404)', async () => {
    const res = await request(createApp()).get('/api/v1/guides');
    expect(res.status).toBe(401);
  });
  it('未登录 POST /api/v1/guides → 401', async () => {
    const res = await request(createApp()).post('/api/v1/guides').send({ name: 'x', content: 'y', businessLineId: 'z' });
    expect(res.status).toBe(401);
  });
});
