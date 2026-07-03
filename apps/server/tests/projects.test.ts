import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, createUser, login, authHeader } from './helpers';

async function setupOwner(email: string) {
  const u = await createUser({ email, role: 'USER' });
  const { accessToken } = await login(app(), u.email);
  return { user: u, token: accessToken, h: authHeader(accessToken) };
}

describe('projects CRUD', () => {
  it('create -> default single page; list shows pageCount=1', async () => {
    const { h } = await setupOwner('a@x.com');
    const created = await request(app()).post('/api/v1/projects').set(h).send({ name: 'P1' });
    expect(created.status).toBe(201);
    expect(created.body.project.name).toBe('P1');
    expect(created.body.project.width).toBe(1280);
    expect(created.body.project.height).toBe(720);
    expect(created.body.project.pages).toHaveLength(1);
    expect(created.body.project.pages[0].components).toEqual([]);

    const listed = await request(app()).get('/api/v1/projects').set(h);
    expect(listed.status).toBe(200);
    expect(listed.body.projects[0].pageCount).toBe(1);
  });

  it('persists and returns project meta (业务线/场景/campaign 信息)', async () => {
    const { h } = await setupOwner('a@x.com');
    const meta = {
      businessLine: 'FT',
      creator: 'alex',
      scenario: 'campaign-report',
      scenarioSub: 'weekly',
      advertiser: 'GlowLab',
      campaignInfo: { campaignName: 'Q4 上市', platform: 'TikTok', budget: '¥300K' },
    };
    const created = await request(app()).post('/api/v1/projects').set(h).send({ name: 'M', meta });
    expect(created.status).toBe(201);
    expect(created.body.project.meta).toEqual(meta);

    // 列表也带 meta。
    const listed = await request(app()).get('/api/v1/projects').set(h);
    expect(listed.body.projects[0].meta).toEqual(meta);

    // update meta。
    const updated = await request(app())
      .patch(`/api/v1/projects/${created.body.project.id}`)
      .set(h)
      .send({ meta: { ...meta, scenarioSub: 'monthly' } });
    expect(updated.body.project.meta.scenarioSub).toBe('monthly');
  });

  it('get / update / delete own project', async () => {
    const { h } = await setupOwner('a@x.com');
    const id = (await request(app()).post('/api/v1/projects').set(h).send({ name: 'P' })).body.project.id;

    const got = await request(app()).get(`/api/v1/projects/${id}`).set(h);
    expect(got.status).toBe(200);

    const updated = await request(app())
      .patch(`/api/v1/projects/${id}`)
      .set(h)
      .send({ name: 'P2', pages: [{ id: 'p1', name: '页一', components: [] }] });
    expect(updated.status).toBe(200);
    expect(updated.body.project.name).toBe('P2');
    expect(updated.body.project.pages).toHaveLength(1);

    const deleted = await request(app()).delete(`/api/v1/projects/${id}`).set(h);
    expect(deleted.status).toBe(204);
  });

  it('duplicate clones the project with a new id', async () => {
    const { h } = await setupOwner('a@x.com');
    const id = (await request(app()).post('/api/v1/projects').set(h).send({ name: 'Orig' })).body.project.id;

    const dup = await request(app()).post(`/api/v1/projects/${id}/duplicate`).set(h);
    expect(dup.status).toBe(201);
    expect(dup.body.project.id).not.toBe(id);
    expect(dup.body.project.name).toBe('Orig 副本');
  });

  it('ownership isolation: other users get 404 (no existence leak)', async () => {
    const owner = await setupOwner('owner@x.com');
    const other = await setupOwner('other@x.com');

    const id = (
      await request(app()).post('/api/v1/projects').set(owner.h).send({ name: 'Secret' })
    ).body.project.id;

    for (const [method, path] of [
      ['get', `/api/v1/projects/${id}`],
      ['patch', `/api/v1/projects/${id}`],
      ['delete', `/api/v1/projects/${id}`],
    ] as const) {
      const res = await (request(app()) as any)
        [method](path)
        .set(other.h)
        .send(method === 'patch' ? { name: 'hacked' } : undefined);
      expect(res.status).toBe(404);
    }

    // other does not see it in their list
    const list = await request(app()).get('/api/v1/projects').set(other.h);
    expect(list.body.projects.find((p: any) => p.id === id)).toBeUndefined();
  });

  it('requires authentication', async () => {
    const res = await request(app()).get('/api/v1/projects');
    expect(res.status).toBe(401);
  });

  it('400 on invalid create body', async () => {
    const { h } = await setupOwner('a@x.com');
    const res = await request(app()).post('/api/v1/projects').set(h).send({});
    expect(res.status).toBe(400);
  });
});
