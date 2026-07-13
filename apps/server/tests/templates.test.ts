import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, createUser, login, authHeader } from './helpers';

async function setupAdmin(email: string) {
  const u = await createUser({ email, role: 'ADMIN' });
  const { accessToken } = await login(app(), u.email);
  return { user: u, h: authHeader(accessToken) };
}

const CELL = { businessLine: 'FT', scenario: 'campaign-report', templateType: 'weekly' };

/** 建模板(默认 DRAFT)→ 按需发布 → 返回 id。 */
async function mkTemplate(
  h: Record<string, string>,
  name: string,
  meta: object = CELL,
  publish = true,
): Promise<string> {
  const created = await request(app()).post('/api/v1/templates').set(h).send({ name, meta });
  const id = created.body.template.id;
  if (publish) {
    await request(app()).patch(`/api/v1/templates/${id}`).set(h).send({ status: 'PUBLISHED' });
  }
  return id;
}

describe('templates — default + filter', () => {
  it('设默认:同格其它默认被清零', async () => {
    const { h } = await setupAdmin('tpl-a@x.com');
    const t1 = await mkTemplate(h, 'T1');
    const t2 = await mkTemplate(h, 'T2');

    await request(app()).patch(`/api/v1/templates/${t1}/default`).set(h).send({ value: true });
    await request(app()).patch(`/api/v1/templates/${t2}/default`).set(h).send({ value: true });

    const t1b = await request(app()).get(`/api/v1/templates/${t1}`).set(h);
    const t2b = await request(app()).get(`/api/v1/templates/${t2}`).set(h);
    expect(t1b.body.template.meta.isDefault).toBe(false);
    expect(t2b.body.template.meta.isDefault).toBe(true);
  });

  it('DRAFT 模板设默认 → 400', async () => {
    const { h } = await setupAdmin('tpl-b@x.com');
    const t = await mkTemplate(h, 'D', CELL, false);
    const res = await request(app()).patch(`/api/v1/templates/${t}/default`).set(h).send({ value: true });
    expect(res.status).toBe(400);
  });

  it('缺 templateType 设默认 → 400', async () => {
    const { h } = await setupAdmin('tpl-c@x.com');
    const t = await mkTemplate(h, 'NT', { businessLine: 'FT', scenario: 'campaign-report' });
    const res = await request(app()).patch(`/api/v1/templates/${t}/default`).set(h).send({ value: true });
    expect(res.status).toBe(400);
  });

  it('取消默认:isDefault 置 false', async () => {
    const { h } = await setupAdmin('tpl-d@x.com');
    const t = await mkTemplate(h, 'U');
    await request(app()).patch(`/api/v1/templates/${t}/default`).set(h).send({ value: true });
    const res = await request(app()).patch(`/api/v1/templates/${t}/default`).set(h).send({ value: false });
    expect(res.status).toBe(200);
    expect(res.body.template.meta.isDefault).toBe(false);
  });

  it('list 按 templateType + isDefault 过滤', async () => {
    const { h } = await setupAdmin('tpl-e@x.com');
    const t = await mkTemplate(h, 'F');
    await request(app()).patch(`/api/v1/templates/${t}/default`).set(h).send({ value: true });
    await mkTemplate(h, 'G', { ...CELL, templateType: 'monthly' });

    const res = await request(app())
      .get('/api/v1/templates')
      .set(h)
      .query({ templateType: 'weekly', isDefault: 'true' });
    expect(res.status).toBe(200);
    expect(res.body.templates).toHaveLength(1);
    expect(res.body.templates[0].id).toBe(t);
  });
});
