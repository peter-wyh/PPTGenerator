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
      campaignInfo: { campaignName: 'Q4 上市', platform: 'TikTok', budget: '$300K' },
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

  it('persists page-level bgColor/bgImage through update + reload', async () => {
    const { h } = await setupOwner('bg@x.com');
    const id = (await request(app()).post('/api/v1/projects').set(h).send({ name: 'BG' })).body.project
      .id;

    const pageId = 'p1';
    const updated = await request(app())
      .patch(`/api/v1/projects/${id}`)
      .set(h)
      .send({
        pages: [
          { id: pageId, name: '封面', bgColor: '#FF5C00', bgImage: 'https://x/a.png', components: [] },
        ],
      });
    expect(updated.status).toBe(200);
    expect(updated.body.project.pages[0].bgColor).toBe('#FF5C00');
    expect(updated.body.project.pages[0].bgImage).toBe('https://x/a.png');

    // reload 必须保留页面背景（防止 zod strip 丢字段）。
    const reloaded = await request(app()).get(`/api/v1/projects/${id}`).set(h);
    expect(reloaded.body.project.pages[0].bgColor).toBe('#FF5C00');
    expect(reloaded.body.project.pages[0].bgImage).toBe('https://x/a.png');
  });

  it('persists structured report theme (color/font/density/radius/preset) through update + reload', async () => {
    const { h } = await setupOwner('theme@x.com');
    const id = (await request(app()).post('/api/v1/projects').set(h).send({ name: 'T' })).body.project
      .id;

    const theme = {
      color: {
        primary: '#FF5C00',
        secondary: '#3B82F6',
        chartPalette: ['#FF5C00', '#3B82F6', '#22C55E'],
        neutralText: '#1A1A1A',
        neutralBg: '#FFFFFF',
      },
      font: { text: 'noto-sans-sc', number: 'inter', heading: 'funnel-sans' },
      density: 'spacious',
      radius: 'large',
      preset: 'warm-bold',
    };
    const updated = await request(app())
      .patch(`/api/v1/projects/${id}`)
      .set(h)
      .send({ meta: { theme } });
    expect(updated.status).toBe(200);
    expect(updated.body.project.meta.theme).toEqual(theme);

    // reload 必须保留结构化主题（防止 zod strip 丢字段）。
    const reloaded = await request(app()).get(`/api/v1/projects/${id}`).set(h);
    expect(reloaded.body.project.meta.theme).toEqual(theme);
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

  async function setupAdmin(email: string) {
    const u = await createUser({ email, role: 'ADMIN' });
    const { accessToken } = await login(app(), u.email);
    return { h: authHeader(accessToken) };
  }

  /** 建一个带 2 页 + theme 的已发布默认模板(属于给定 cell)。 */
  async function mkDefaultTemplate(
    h: Record<string, string>,
    cell: { businessLine: string; scenario: string; templateType: string },
  ) {
    const created = await request(app()).post('/api/v1/templates').set(h).send({
      name: 'TPL',
      width: 1920,
      height: 1080,
      pages: [
        { id: 'x1', name: '封面', components: [] },
        { id: 'x2', name: '数据', components: [] },
      ],
      meta: {
        ...cell,
        theme: {
          color: { primary: '#FF5C00', secondary: '#3B82F6', chartPalette: ['#FF5C00'], neutralText: '#111', neutralBg: '#FFF' },
          font: { text: 'inter', number: 'inter' },
          density: 'standard',
          radius: 'small',
        },
      },
    });
    const id = created.body.template.id;
    await request(app()).patch(`/api/v1/templates/${id}`).set(h).send({ status: 'PUBLISHED' });
    await request(app()).patch(`/api/v1/templates/${id}/default`).set(h).send({ value: true });
    return id;
  }

  it('create 命中默认模板 → 套用 pages/尺寸/theme, seeded=true', async () => {
    const admin = await setupAdmin('seed-admin@x.com');
    await mkDefaultTemplate(admin.h, { businessLine: 'FT', scenario: 'campaign-report', templateType: 'weekly' });
    const { h } = await setupOwner('seed-user@x.com');

    const res = await request(app())
      .post('/api/v1/projects')
      .set(h)
      .send({ name: 'P', meta: { businessLine: 'FT', scenario: 'campaign-report', templateType: 'weekly' } });

    expect(res.status).toBe(201);
    expect(res.body.seeded).toBe(true);
    expect(res.body.project.pages).toHaveLength(2); // 来自模板
    expect(res.body.project.width).toBe(1920);
    expect(res.body.project.meta.theme.color.primary).toBe('#FF5C00');
    // 业务线/场景/模版类型仍是项目自报值(不被模板覆盖)
    expect(res.body.project.meta.businessLine).toBe('FT');
    expect(res.body.project.meta.scenario).toBe('campaign-report');
  });

  it('create 无匹配默认模板 → 空白页, seeded=false', async () => {
    const { h } = await setupOwner('seed-user2@x.com');
    const res = await request(app())
      .post('/api/v1/projects')
      .set(h)
      .send({ name: 'P', meta: { businessLine: 'CX', scenario: 'media-kit', templateType: 'brand' } });
    expect(res.status).toBe(201);
    expect(res.body.seeded).toBe(false);
    expect(res.body.project.pages).toHaveLength(1);
  });

  it('create 自带 pages → 不套用模板, seeded=false', async () => {
    const admin = await setupAdmin('seed-admin3@x.com');
    await mkDefaultTemplate(admin.h, { businessLine: 'FT', scenario: 'campaign-report', templateType: 'weekly' });
    const { h } = await setupOwner('seed-user3@x.com');
    const res = await request(app())
      .post('/api/v1/projects')
      .set(h)
      .send({
        name: 'P',
        pages: [{ id: 'm1', name: '我的封面', components: [] }],
        meta: { businessLine: 'FT', scenario: 'campaign-report', templateType: 'weekly' },
      });
    expect(res.status).toBe(201);
    expect(res.body.seeded).toBe(false);
    expect(res.body.project.pages).toEqual([{ id: 'm1', name: '我的封面', components: [] }]);
  });
});
