import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from './helpers';

describe('health', () => {
  it('GET /api/v1/health -> { status: ok }', async () => {
    const res = await request(app()).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /healthz probe -> ok', async () => {
    const res = await request(app()).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('unknown route -> 404', async () => {
    const res = await request(app()).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
