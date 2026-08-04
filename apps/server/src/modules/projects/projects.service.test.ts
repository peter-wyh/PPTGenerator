import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock 工厂被提升到文件顶部,用 vi.hoisted 共享 mock 句柄(对齐 templates.service.test.ts)。
const prismaMock = vi.hoisted(() => ({
  project: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../prisma', () => ({ prisma: prismaMock }));

import { projectsService } from './projects.service';

/** 构造一个完整 Project(Prisma 形态:Date、Json 原值、htmlContent可为空)。 */
function makeProject(over: Record<string, unknown> = {}) {
  return {
    id: 'prj_1',
    name: '我的报告',
    ownerId: 'u_ap',
    pages: [{ id: 'p1', name: '第 1 页', components: [] }],
    width: 1280,
    height: 720,
    meta: null,
    htmlContent: null,
    shareToken: null,
    createdAt: new Date('2026-01-03T00:00:00.000Z'),
    updatedAt: new Date('2026-01-03T00:00:00.000Z'),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('projects.service · create 全局重名校验', () => {
  it('重名 → 400「已存在同名报告」,不执行 create', async () => {
    prismaMock.project.findFirst.mockResolvedValue({ id: 'prj_other' });
    await expect(projectsService.create('u_ap', { name: '我的报告' })).rejects.toMatchObject({
      statusCode: 400,
      message: '已存在同名报告「我的报告」，请使用其他名称',
    });
    expect(prismaMock.project.create).not.toHaveBeenCalled();
  });

  it('名称先 trim 再校验/落库', async () => {
    prismaMock.project.findFirst.mockResolvedValue(null);
    prismaMock.project.create.mockImplementation(({ data }) =>
      Promise.resolve(makeProject({ name: (data as { name: string }).name })),
    );
    await projectsService.create('u_ap', { name: '  我的报告  ' });
    expect(prismaMock.project.findFirst.mock.calls[0][0]).toMatchObject({
      where: { name: '我的报告' },
    });
    expect(
      (prismaMock.project.create.mock.calls[0][0] as { data: { name: string } }).data.name,
    ).toBe('我的报告');
  });
});

describe('projects.service · update 改名校验', () => {
  it('非归属者 → 404,不查重名/不更新', async () => {
    prismaMock.project.findUnique.mockResolvedValue(makeProject({ ownerId: 'u_other' }));
    await expect(
      projectsService.update('u_ap', 'prj_1', { name: '新名' }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(prismaMock.project.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.project.update).not.toHaveBeenCalled();
  });

  it('改成他人占用名 → 400,不更新', async () => {
    prismaMock.project.findUnique.mockResolvedValue(makeProject());
    prismaMock.project.findFirst.mockResolvedValue({ id: 'prj_other' });
    await expect(
      projectsService.update('u_ap', 'prj_1', { name: '撞名' }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: '已存在同名报告「撞名」，请使用其他名称',
    });
    expect(prismaMock.project.update).not.toHaveBeenCalled();
  });

  it('改成未占用名 → 通过,update 收到 trim 后的名', async () => {
    prismaMock.project.findUnique.mockResolvedValue(makeProject());
    prismaMock.project.findFirst.mockResolvedValue(null);
    prismaMock.project.update.mockImplementation(({ data }) =>
      Promise.resolve(makeProject({ name: (data as { name: string }).name })),
    );
    await projectsService.update('u_ap', 'prj_1', { name: '  新名  ' });
    expect(prismaMock.project.findFirst.mock.calls[0][0]).toMatchObject({
      where: { name: '新名', id: { not: 'prj_1' } },
    });
    expect(
      (prismaMock.project.update.mock.calls[0][0] as { data: { name: string } }).data.name,
    ).toBe('新名');
  });
});

describe('projects.service · duplicate 自动找号', () => {
  it('「X 副本」无冲突 → 用「X 副本」', async () => {
    prismaMock.project.findUnique.mockResolvedValue(makeProject({ name: '我的报告' }));
    prismaMock.project.findFirst.mockResolvedValueOnce(null);
    prismaMock.project.create.mockImplementation(({ data }) =>
      Promise.resolve(makeProject({ name: (data as { name: string }).name })),
    );
    await projectsService.duplicate('u_ap', 'prj_1');
    expect(
      (prismaMock.project.create.mock.calls[0][0] as { data: { name: string } }).data.name,
    ).toBe('我的报告 副本');
  });

  it('「X 副本」已存在 → 用「X 副本 2」', async () => {
    prismaMock.project.findUnique.mockResolvedValue(makeProject({ name: '我的报告' }));
    prismaMock.project.findFirst
      .mockResolvedValueOnce({ id: 'prj_other' })
      .mockResolvedValueOnce(null);
    prismaMock.project.create.mockImplementation(({ data }) =>
      Promise.resolve(makeProject({ name: (data as { name: string }).name })),
    );
    await projectsService.duplicate('u_ap', 'prj_1');
    expect(
      (prismaMock.project.create.mock.calls[0][0] as { data: { name: string } }).data.name,
    ).toBe('我的报告 副本 2');
  });
});
