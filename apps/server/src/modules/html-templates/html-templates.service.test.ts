import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  project: { findFirst: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  campaign: { findUnique: vi.fn() },
  htmlVersion: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
}));

vi.mock('../../prisma', () => ({ prisma: prismaMock }));

// mapCampaign stub: createRecipeVersion depends on it; avoid real campaign lookup
const mapCampaignMock = vi.hoisted(() => vi.fn());
vi.mock('./recipe/campaign-report/mapper', () => ({ mapCampaign: mapCampaignMock }));

// Mock getRecipe().render to return a fixed HTML containing the override value,
// so saveRecipeConfig tests don't depend on real DeepSeek / campaign lookup.
const fakeRender = vi
  .fn()
  .mockResolvedValue('<html><body style="color:#3b82f6">rendered</body></html>');
const recipeMod = await import('./recipe');
vi.spyOn(recipeMod, 'getRecipe').mockReturnValue({ render: fakeRender } as any);

import { htmlTemplateService } from './html-templates.service';

beforeEach(() => {
  vi.clearAllMocks();
  mapCampaignMock.mockReset();
  // re-stub default render result after clearAllMocks
  fakeRender.mockResolvedValue(
    '<html><body style="color:#3b82f6">rendered</body></html>',
  );
});

describe('html-templates.service · saveHtmlAsNewProject 全局重名', () => {
  it('重名 → 400,不建报告、不查 campaign', async () => {
    prismaMock.project.findFirst.mockResolvedValue({ id: 'prj_other' });
    await expect(
      htmlTemplateService.saveHtmlAsNewProject('u_ap', {
        html: '<p>x</p>',
        campaignId: 'c1',
        name: '撞名报告',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: '已存在同名报告「撞名报告」，请使用其他名称',
    });
    expect(prismaMock.campaign.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.project.create).not.toHaveBeenCalled();
  });

  it('无重名 → 用 trim 后的名建报告', async () => {
    prismaMock.project.findFirst.mockResolvedValue(null);
    prismaMock.campaign.findUnique.mockResolvedValue(null);
    prismaMock.project.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'prj_new', ...(data as object) }),
    );
    await htmlTemplateService.saveHtmlAsNewProject('u_ap', {
      html: '<p>x</p>',
      campaignId: 'c1',
      name: '  我的 AI 报告  ',
    });
    expect(
      (prismaMock.project.create.mock.calls[0][0] as { data: { name: string } }).data.name,
    ).toBe('我的 AI 报告');
  });
});

describe('html-templates.service · saveRecipeConfig', () => {
  it('写 HtmlVersion 4 字段 + 重渲染 html(调用 recipe.render)', async () => {
    prismaMock.htmlVersion.findUnique.mockResolvedValue({
      id: 'hv1',
      projectId: 'prj_recipe',
      recipeId: 'campaign-report',
      reportContent: null,
      tokenOverrides: null,
      manifestOverrides: null,
    });
    prismaMock.project.findUnique.mockResolvedValue({
      meta: { campaignId: 'camp-everyday-bf' },
    });
    prismaMock.htmlVersion.update.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'hv1', ...(data as object) }),
    );

    await htmlTemplateService.saveRecipeConfig('hv1', {
      tokenOverrides: { brandPrimary: '#3b82f6' },
      manifestOverrides: { hidden: ['insights'] },
    });

    // 调了 recipe.render 并传入覆盖
    expect(fakeRender).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: 'camp-everyday-bf',
        tokenOverrides: { brandPrimary: '#3b82f6' },
        manifestOverrides: { hidden: ['insights'] },
      }),
    );
    // 写回 4 字段 + 重渲染的 html
    const updateData = (prismaMock.htmlVersion.update.mock.calls[0][0] as { data: any })
      .data;
    expect(updateData.tokenOverrides).toMatchObject({ brandPrimary: '#3b82f6' });
    expect(updateData.manifestOverrides).toMatchObject({ hidden: ['insights'] });
    expect(updateData.html).toContain('#3b82f6');
    expect(updateData.html).toContain('rendered');
  });

  it('拒绝非 recipe 版本(recipeId null → badRequest)', async () => {
    prismaMock.htmlVersion.findUnique.mockResolvedValue({
      id: 'hv2',
      projectId: 'prj_ai',
      recipeId: null,
      reportContent: null,
      tokenOverrides: null,
      manifestOverrides: null,
    });

    await expect(
      htmlTemplateService.saveRecipeConfig('hv2', {
        tokenOverrides: { brandPrimary: '#ff0000' },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(fakeRender).not.toHaveBeenCalled();
    expect(prismaMock.htmlVersion.update).not.toHaveBeenCalled();
  });

  it('版本不存在 → notFound', async () => {
    prismaMock.htmlVersion.findUnique.mockResolvedValue(null);
    await expect(
      htmlTemplateService.saveRecipeConfig('hv_missing', {}),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('保留既有配置(未传字段时沿用 version 上现值)', async () => {
    prismaMock.htmlVersion.findUnique.mockResolvedValue({
      id: 'hv3',
      projectId: 'prj_recipe2',
      recipeId: 'campaign-report',
      reportContent: { keep: 'old' },
      tokenOverrides: { brandPrimary: '#111111' },
      manifestOverrides: { order: ['a', 'b'] },
    });
    prismaMock.project.findUnique.mockResolvedValue({ meta: {} });
    prismaMock.htmlVersion.update.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'hv3', ...(data as object) }),
    );

    // 只传 manifestOverrides,其它字段应沿用现值
    await htmlTemplateService.saveRecipeConfig('hv3', {
      manifestOverrides: { hidden: ['insights'] },
    });

    expect(fakeRender).toHaveBeenCalledWith(
      expect.objectContaining({
        reportContent: { keep: 'old' },
        tokenOverrides: { brandPrimary: '#111111' },
        manifestOverrides: { hidden: ['insights'] },
      }),
    );
  });
});

describe('html-templates.service · createRecipeVersion', () => {
  it('无 campaignId → 400,不建版本', async () => {
    prismaMock.project.findUnique.mockResolvedValue({ meta: {} });
    await expect(
      htmlTemplateService.createRecipeVersion('prj1', 'u1', {
        reportPeriod: { startDate: '2026-08-01', endDate: '2026-08-11' },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mapCampaignMock).not.toHaveBeenCalled();
    expect(prismaMock.htmlVersion.create).not.toHaveBeenCalled();
  });

  it('有 campaignId → 停用旧 active + 建 recipe 版本 + 同步 meta.reportPeriod', async () => {
    prismaMock.project.findUnique.mockResolvedValue({ meta: { campaignId: 'camp-x' } });
    mapCampaignMock.mockResolvedValue({ header: { period: { start: '2026-08-01', end: '2026-08-11' } } });
    prismaMock.project.update.mockResolvedValue({});
    prismaMock.htmlVersion.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.htmlVersion.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'ver_new', ...(data as object) }),
    );

    const res = await htmlTemplateService.createRecipeVersion('prj1', 'u1', {
      reportPeriod: { startDate: '2026-08-01', endDate: '2026-08-11' },
    });

    expect(res).toEqual({ versionId: 'ver_new' });
    expect(mapCampaignMock).toHaveBeenCalledWith('camp-x', { startDate: '2026-08-01', endDate: '2026-08-11' });
    expect(prismaMock.htmlVersion.updateMany).toHaveBeenCalledWith({
      where: { projectId: 'prj1', isActive: true },
      data: { isActive: false },
    });
    expect(prismaMock.htmlVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 'prj1', ownerId: 'u1', recipeId: 'campaign-report', isActive: true,
      }),
    });
    expect(prismaMock.project.update).toHaveBeenCalledWith({
      where: { id: 'prj1' },
      data: { meta: expect.objectContaining({ campaignId: 'camp-x', reportPeriod: { startDate: '2026-08-01', endDate: '2026-08-11' } }) },
    });
  });

  it('未传 reportPeriod → 沿用 meta.reportPeriod 兜底', async () => {
    prismaMock.project.findUnique.mockResolvedValue({
      meta: { campaignId: 'camp-x', reportPeriod: { startDate: '2026-07-01', endDate: '2026-07-31' } },
    });
    mapCampaignMock.mockResolvedValue({});
    prismaMock.project.update.mockResolvedValue({});
    prismaMock.htmlVersion.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.htmlVersion.create.mockResolvedValue({ id: 'ver2' });

    await htmlTemplateService.createRecipeVersion('prj1', 'u1', {});
    expect(mapCampaignMock).toHaveBeenCalledWith('camp-x', { startDate: '2026-07-01', endDate: '2026-07-31' });
  });

  it('project 不存在 → 404', async () => {
    prismaMock.project.findUnique.mockResolvedValue(null);
    await expect(
      htmlTemplateService.createRecipeVersion('nope', 'u1', {}),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mapCampaignMock).not.toHaveBeenCalled();
    expect(prismaMock.htmlVersion.create).not.toHaveBeenCalled();
  });
});
