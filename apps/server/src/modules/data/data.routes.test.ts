import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';

describe('data routes · 挂载与鉴权', () => {
  it('未登录 GET /api/v1/data → 401(不是 404)', async () => {
    const res = await request(createApp()).get('/api/v1/data');
    expect(res.status).toBe(401);
  });
  it('未登录 POST /api/v1/data/import → 401', async () => {
    const res = await request(createApp()).post('/api/v1/data/import').send({ kind: 'campaign', items: [] });
    expect(res.status).toBe(401);
  });
  it('未登录 DELETE /api/v1/data?kind=campaign → 401', async () => {
    const res = await request(createApp()).delete('/api/v1/data?kind=campaign');
    expect(res.status).toBe(401);
  });
});
