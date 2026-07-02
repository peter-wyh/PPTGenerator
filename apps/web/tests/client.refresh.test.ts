import { describe, it, expect, beforeEach, vi } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { api, setAccessToken, getAccessToken, onUnauthorized } from '@/api/client';

const mock = new MockAdapter(api);

describe('axios client — 401 refresh + retry', () => {
  beforeEach(() => {
    setAccessToken('AT1');
    mock.reset();
  });

  it('retries a 401 request after refreshing, using the new token', async () => {
    mock.onPost('/auth/refresh').reply(200, { accessToken: 'AT2' });
    // 第一次 GET 401，第二次（重试）200。
    mock
      .onGet('/projects')
      .replyOnce(401, { error: { code: 'INVALID_ACCESS_TOKEN' } })
      .onGet('/projects')
      .reply(200, { projects: [] });

    const res = await api.get('/projects');
    expect(res.status).toBe(200);
    expect(getAccessToken()).toBe('AT2');
    // 重试时带了新 token。
    const retryReq = mock.history.get[mock.history.get.length - 1];
    expect(retryReq.headers?.Authorization).toBe('Bearer AT2');
  });

  it('does not refresh on a login 401', async () => {
    mock.onPost('/auth/login').reply(401, { error: { code: 'INVALID_CREDENTIALS' } });
    await expect(api.post('/auth/login', { email: 'x', password: 'y' })).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(mock.history.post.filter((r) => r.url === '/auth/refresh')).toHaveLength(0);
  });

  it('dedupes concurrent refreshes (single /auth/refresh call)', async () => {
    mock.onPost('/auth/refresh').reply(200, { accessToken: 'AT2' });
    // 旧 token (AT1) → 401；新 token (AT2) → 200。
    mock.onGet('/projects').reply((cfg) =>
      cfg.headers?.Authorization === 'Bearer AT1' ? [401] : [200, { projects: [] }],
    );

    const [a, b] = await Promise.all([api.get('/projects'), api.get('/projects')]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(mock.history.post.filter((r) => r.url === '/auth/refresh').length).toBe(1);
  });

  it('fires unauthorized listener when refresh fails', async () => {
    const spy = vi.fn();
    const off = onUnauthorized(spy);
    mock.onPost('/auth/refresh').reply(401);
    mock.onGet('/projects').reply(401);

    await expect(api.get('/projects')).rejects.toMatchObject({ response: { status: 401 } });
    expect(spy).toHaveBeenCalled();
    off();
  });
});
