import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock 工厂被提升到文件顶部，不能引用普通外部变量 → 用 vi.hoisted 共享 mock 句柄。
const prismaMock = vi.hoisted(() => ({
  template: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  project: { create: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() },
}));

vi.mock('../../prisma', () => ({ prisma: prismaMock }));

import type { Template } from '@prisma/client';
import { templatesService, toSummary, toDetail, defaultTemplatePages } from './templates.service';
import { projectsService } from '../projects/projects.service';

/** 构造一个完整 Template（Prisma 形态：Date、Json 原值）。 */
function makeTemplate(over: Partial<Template> = {}): Template {
  return {
    id: 'tpl_1',
    name: '周报模板',
    pages: [
      { id: 'p1', name: '第 1 页', components: [] },
      { id: 'p2', name: '第 2 页', components: [] },
    ],
    width: 1280,
    height: 720,
    meta: { businessLine: 'FT', scenario: 'campaign-report' },
    status: 'PUBLISHED',
    note: null,
    ownerId: 'u_admin',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...over,
  } as unknown as Template;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('templates.service · 序列化', () => {
  it('toSummary: pageCount 取自 pages、meta 透传、日期转 ISO', () => {
    const s = toSummary(makeTemplate());
    expect(s.pageCount).toBe(2);
    expect(s.meta).toEqual({ businessLine: 'FT', scenario: 'campaign-report' });
    expect(s.status).toBe('PUBLISHED');
    expect(s.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('toSummary: pages 非数组时 pageCount=0', () => {
    expect(toSummary(makeTemplate({ pages: null as unknown as Template['pages'] })).pageCount).toBe(0);
  });

  it('toDetail: pages 原样透传；缺省时兜底 []', () => {
    expect(toDetail(makeTemplate()).pages).toHaveLength(2);
    expect(toDetail(makeTemplate({ pages: null as unknown as Template['pages'] })).pages).toEqual([]);
  });

  it('defaultTemplatePages: 返回真实页面树（含封面 + 概览页，非单空白页）', () => {
    const pages = defaultTemplatePages();
    // 真实页面树：至少 2 页（封面 + 概览）
    expect(pages.length).toBeGreaterThanOrEqual(2);
    // 每页都有 id 和 name
    for (const p of pages) {
      expect(p.id).toBeTruthy();
      expect(typeof p.name).toBe('string');
      expect(p.name.length).toBeGreaterThan(0);
    }
    // 封面页应包含真实组件（标题文本）
    const cover = pages[0];
    expect(cover.components.length).toBeGreaterThan(0);
    const hasTitleText = cover.components.some((c) => c.type === 'text');
    expect(hasTitleText).toBe(true);
    // 至少一页设置了 pageType（真实页面树语义）
    const anyPageType = pages.some((p) => !!p.pageType);
    expect(anyPageType).toBe(true);
  });
});

describe('templates.service · list 角色过滤', () => {
  it('USER 只看已发布：where.status = PUBLISHED', async () => {
    prismaMock.template.findMany.mockResolvedValue([makeTemplate()]);
    await templatesService.list('USER');
    expect(prismaMock.template.findMany).toHaveBeenCalledWith({
      where: { status: 'PUBLISHED' },
      orderBy: { updatedAt: 'desc' },
    });
  });

  it('ADMIN 不带 status 过滤（看全部含草稿）', async () => {
    prismaMock.template.findMany.mockResolvedValue([]);
    await templatesService.list('ADMIN');
    expect(prismaMock.template.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { updatedAt: 'desc' },
    });
  });

  it('ADMIN + status 过滤：透传 status', async () => {
    prismaMock.template.findMany.mockResolvedValue([]);
    await templatesService.list('ADMIN', { status: 'DRAFT' });
    expect(prismaMock.template.findMany).toHaveBeenCalledWith({
      where: { status: 'DRAFT' },
      orderBy: { updatedAt: 'desc' },
    });
  });

  it('ADMIN + businessLine/scenario:where.AND 同时带两个 JSON path 过滤(修复旧覆盖 bug)', async () => {
    prismaMock.template.findMany.mockResolvedValue([]);
    await templatesService.list('ADMIN', { businessLine: 'FT', scenario: 'campaign-report' });
    const { where } = prismaMock.template.findMany.mock.calls[0][0] as {
      where: { AND?: unknown[] };
    };
    // 旧实现把 where.meta 后写覆盖,只留 scenario;新实现用 AND 合并 + equals 精确匹配,两者都在。
    expect(where.AND).toEqual([
      { meta: { path: '$.businessLine', equals: 'FT' } },
      { meta: { path: '$.scenario', equals: 'campaign-report' } },
    ]);
  });
});

describe('templates.service · 归属校验 getOwnedOrThrow', () => {
  it('存在且归属自己 → 返回原始对象', async () => {
    prismaMock.template.findUnique.mockResolvedValue(makeTemplate());
    const t = await templatesService.getOwnedOrThrow('u_admin', 'tpl_1');
    expect(t.id).toBe('tpl_1');
  });

  it('不存在 → 404', async () => {
    prismaMock.template.findUnique.mockResolvedValue(null);
    await expect(templatesService.getOwnedOrThrow('u_admin', 'tpl_1')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('存在但不归属自己 → 404（不泄露存在性）', async () => {
    prismaMock.template.findUnique.mockResolvedValue(makeTemplate({ ownerId: 'u_other' }));
    await expect(templatesService.getOwnedOrThrow('u_admin', 'tpl_1')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('templates.service · create / update', () => {
  it('create: 缺省尺寸 1280×720、状态 DRAFT、缺省真实页面树（≥2 页）', async () => {
    prismaMock.template.create.mockImplementation(({ data }) => Promise.resolve(makeTemplate(data)));
    await templatesService.create('u_admin', { name: '新模板' });
    const { data } = prismaMock.template.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data.name).toBe('新模板');
    expect(data.width).toBe(1280);
    expect(data.height).toBe(720);
    expect(data.status).toBe('DRAFT');
    expect(Array.isArray(data.pages)).toBe(true);
    // 真实页面树：默认 ≥ 2 页（封面 + 概览），不再是单空白页
    expect((data.pages as unknown[]).length).toBeGreaterThanOrEqual(2);
  });

  it('update: 非归属者 → 404，不会执行 update', async () => {
    prismaMock.template.findUnique.mockResolvedValue(makeTemplate({ ownerId: 'u_other' }));
    await expect(
      templatesService.update('u_admin', 'tpl_1', { name: 'x' }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(prismaMock.template.update).not.toHaveBeenCalled();
  });

  it('update: 归属者 → 仅传出现过的字段', async () => {
    prismaMock.template.findUnique.mockResolvedValue(makeTemplate());
    prismaMock.template.update.mockResolvedValue(makeTemplate({ name: '改名' }));
    await templatesService.update('u_admin', 'tpl_1', { name: '改名', status: 'DRAFT' });
    const { data } = prismaMock.template.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data.name).toBe('改名');
    expect(data.status).toBe('DRAFT');
    // 未传字段不应出现在 data。
    expect('width' in data).toBe(false);
  });
});

describe('templates.service · duplicate', () => {
  it('深拷贝 pages、追加" 副本"、状态 DRAFT', async () => {
    const src = makeTemplate();
    prismaMock.template.findUnique.mockResolvedValue(src);
    prismaMock.template.create.mockImplementation(({ data }) => Promise.resolve(makeTemplate(data)));
    await templatesService.duplicate('u_admin', 'tpl_1');
    const { data } = prismaMock.template.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data.name).toBe('周报模板 副本');
    expect(data.status).toBe('DRAFT');
    // 深拷贝：pages 是新数组、内容相等但引用不同。
    expect(data.pages).toEqual(src.pages);
    expect(data.pages).not.toBe(src.pages);
  });
});

describe('templates.service · getPublishedOrThrow', () => {
  it('已发布 → 返回详情', async () => {
    prismaMock.template.findUnique.mockResolvedValue(makeTemplate({ status: 'PUBLISHED' }));
    const d = await templatesService.getPublishedOrThrow('tpl_1');
    expect(d.id).toBe('tpl_1');
  });

  it('草稿 → 404（普通用户不可读）', async () => {
    prismaMock.template.findUnique.mockResolvedValue(makeTemplate({ status: 'DRAFT' }));
    await expect(templatesService.getPublishedOrThrow('tpl_1')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('不存在 → 404', async () => {
    prismaMock.template.findUnique.mockResolvedValue(null);
    await expect(templatesService.getPublishedOrThrow('tpl_1')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('projects.service · createFromTemplate', () => {
  /** project.create 的返回值需满足 toDetail（含 Date 型 createdAt/updatedAt）。 */
  function makeProject(over: Record<string, unknown> = {}) {
    return {
      id: 'prj_new',
      name: '我的报告',
      ownerId: 'u_bd',
      pages: [{ id: 'p1', name: '第 1 页', components: [] }],
      width: 1280,
      height: 720,
      meta: { businessLine: 'FT' },
      createdAt: new Date('2026-01-03T00:00:00.000Z'),
      updatedAt: new Date('2026-01-03T00:00:00.000Z'),
      ...over,
    };
  }

  it('草稿模板 → 404（不可基于草稿建项目）', async () => {
    prismaMock.template.findUnique.mockResolvedValue(makeTemplate({ status: 'DRAFT' }));
    await expect(projectsService.createFromTemplate('u_bd', 'tpl_1', '我的报告')).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(prismaMock.project.create).not.toHaveBeenCalled();
  });

  it('不存在 → 404', async () => {
    prismaMock.template.findUnique.mockResolvedValue(null);
    await expect(projectsService.createFromTemplate('u_bd', 'tpl_1')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('已发布 → 深拷贝 pages/meta/尺寸，name 缺省回退模板名', async () => {
    const tpl = makeTemplate({ status: 'PUBLISHED' });
    prismaMock.template.findUnique.mockResolvedValue(tpl);
    prismaMock.project.create.mockResolvedValue(makeProject());
    await projectsService.createFromTemplate('u_bd', 'tpl_1');
    const { data } = prismaMock.project.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data.width).toBe(1280);
    expect(data.height).toBe(720);
    expect(data.pages).toEqual(tpl.pages);
    expect(data.pages).not.toBe(tpl.pages); // 深拷贝
    expect(data.name).toBe('周报模板'); // name 缺省回退
  });

  it('已发布 + 指定 name → 用传入名', async () => {
    prismaMock.template.findUnique.mockResolvedValue(makeTemplate({ status: 'PUBLISHED' }));
    prismaMock.project.create.mockResolvedValue(makeProject());
    await projectsService.createFromTemplate('u_bd', 'tpl_1', '  我的报告  ');
    const { data } = prismaMock.project.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data.name).toBe('我的报告'); // trim
  });
});

describe('templates.service · createFromProjectPage（页面存为模板）', () => {
  it('保留页面背景(bgColor/bgGradient/bgImage)与 titleOverridden，清除绑定并换新 id', async () => {
    const srcPage = {
      id: 'pg_src',
      name: '封面',
      pageType: 'cover',
      bgColor: '#112233',
      bgGradient: {
        type: 'linear',
        angle: 90,
        stops: [
          { color: '#000000', position: 0 },
          { color: '#ffffff', position: 100 },
        ],
      },
      bgImage: 'https://example.com/cover.png',
      titleComponentId: 'cmp_title',
      titleOverridden: true,
      campaignId: 'camp_src', // 应清除
      creatorId: 'cre_src', // 应清除
      components: [
        { id: 'cmp_title', type: 'title', data: { text: '自定义标题', campaignId: 'camp_src' } },
      ],
    };
    prismaMock.project.findUnique.mockResolvedValue({
      id: 'prj_1',
      width: 1280,
      height: 720,
      pages: [srcPage],
    });
    prismaMock.template.create.mockResolvedValue(makeTemplate());

    await templatesService.createFromProjectPage('u_admin', {
      projectId: 'prj_1',
      pageId: 'pg_src',
      name: '封面模板',
    });

    const { data } = prismaMock.template.create.mock.calls[0][0] as { data: Record<string, unknown> };
    const savedPage = (data.pages as unknown as Record<string, unknown>[])[0];

    // 背景三件套必须保留（回归：旧实现字段白名单漏拷）
    expect(savedPage.bgColor).toBe('#112233');
    expect(savedPage.bgGradient).toEqual(srcPage.bgGradient);
    expect(savedPage.bgImage).toBe('https://example.com/cover.png');
    // 标题定制标记保留（否则下次加载会被 refreshReportTitle 覆盖）
    expect(savedPage.titleOverridden).toBe(true);
    expect(savedPage.titleComponentId).toBe('cmp_title');
    // 换新 id，不复用源页 id
    expect(savedPage.id).not.toBe('pg_src');
    expect(typeof savedPage.id).toBe('string');
    // 页面级绑定清除
    expect('campaignId' in savedPage).toBe(false);
    expect('creatorId' in savedPage).toBe(false);
    // 组件级绑定清除、文本保留
    const savedComp = (savedPage.components as unknown as Record<string, unknown>[])[0];
    const compData = savedComp.data as Record<string, unknown>;
    expect(compData.text).toBe('自定义标题');
    expect('campaignId' in compData).toBe(false);
  });

  it('项目不存在 → 404', async () => {
    prismaMock.project.findUnique.mockResolvedValue(null);
    await expect(
      templatesService.createFromProjectPage('u_admin', { projectId: 'nope', pageId: 'x', name: 't' }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(prismaMock.template.create).not.toHaveBeenCalled();
  });

  it('页面不存在于项目 → 404', async () => {
    prismaMock.project.findUnique.mockResolvedValue({ id: 'prj_1', width: 1280, height: 720, pages: [] });
    await expect(
      templatesService.createFromProjectPage('u_admin', { projectId: 'prj_1', pageId: 'missing', name: 't' }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(prismaMock.template.create).not.toHaveBeenCalled();
  });
});
