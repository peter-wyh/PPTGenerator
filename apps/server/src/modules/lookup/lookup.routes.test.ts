import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';

describe('lookup routes · 鉴权', () => {
  it('未登录 GET /api/v1/lookup/business-lines → 401', async () => {
    const res = await request(createApp()).get('/api/v1/lookup/business-lines');
    expect(res.status).toBe(401);
  });
  it('未登录 GET /api/v1/lookup/advertisers → 401', async () => {
    const res = await request(createApp()).get('/api/v1/lookup/advertisers');
    expect(res.status).toBe(401);
  });
  it('未登录 GET /api/v1/lookup/merchants → 401', async () => {
    const res = await request(createApp()).get('/api/v1/lookup/merchants');
    expect(res.status).toBe(401);
  });
});
