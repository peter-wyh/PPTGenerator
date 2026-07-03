import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, createUser, login, authHeader } from './helpers';

async function setupOwner(email: string) {
  const u = await createUser({ email, role: 'USER' });
  const { accessToken } = await login(app(), u.email);
  return { user: u, token: accessToken, h: authHeader(accessToken) };
}

async function createProject(h: Record<string, string>, name = 'P') {
  const res = await request(app()).post('/api/v1/projects').set(h).send({ name });
  return res.body.project.id as string;
}

describe('share links (M6)', () => {
  it('owner generates a share token; public can read without auth', async () => {
    const { h } = await setupOwner('owner1@x.com');
    const id = await createProject(h, 'Shared');

    const gen = await request(app()).post(`/api/v1/projects/${id}/share`).set(h);
    expect(gen.status).toBe(200);
    expect(gen.body.shareToken).toEqual(expect.any(String));
    const token = gen.body.shareToken;

    // 公开读（无 Authorization 头）
    const pub = await request(app()).get(`/api/v1/share/${token}`);
    expect(pub.status).toBe(200);
    expect(pub.body.project.name).toBe('Shared');
    expect(pub.body.project.pages).toEqual(expect.any(Array));
  });

  it('non-existent / revoked token → 404 (no existence leak)', async () => {
    const bogus = await request(app()).get('/api/v1/share/non-existent-token');
    expect(bogus.status).toBe(404);

    const { h } = await setupOwner('owner2@x.com');
    const id = await createProject(h);
    const token = (await request(app()).post(`/api/v1/projects/${id}/share`).set(h)).body.shareToken;

    // 撤销后读 → 404
    const revoke = await request(app()).delete(`/api/v1/projects/${id}/share`).set(h);
    expect(revoke.status).toBe(204);
    const after = await request(app()).get(`/api/v1/share/${token}`);
    expect(after.status).toBe(404);
  });

  it('non-owner cannot generate share token (ownership isolation → 404)', async () => {
    const owner = await setupOwner('owner3@x.com');
    const other = await setupOwner('other3@x.com');
    const id = await createProject(owner.h, 'Owner Project');

    const r = await request(app()).post(`/api/v1/projects/${id}/share`).set(other.h);
    expect(r.status).toBe(404);
  });

  it('share endpoint requires auth (401 without token)', async () => {
    const { h } = await setupOwner('owner4@x.com');
    const id = await createProject(h);
    const noAuth = await request(app()).post(`/api/v1/projects/${id}/share`);
    expect(noAuth.status).toBe(401);
  });
});
