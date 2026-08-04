import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  project: { findFirst: vi.fn(), create: vi.fn() },
  campaign: { findUnique: vi.fn() },
}));

vi.mock('../../prisma', () => ({ prisma: prismaMock }));

import { htmlTemplateService } from './html-templates.service';

beforeEach(() => {
  vi.clearAllMocks();
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
