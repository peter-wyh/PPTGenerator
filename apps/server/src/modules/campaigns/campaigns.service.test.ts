import { beforeEach, describe, expect, it, vi } from 'vitest';

// campaigns.service 顶层 import prisma,这里 mock 掉避免碰 DB。
const prismaMock = vi.hoisted(() => ({
  campaignCreator: { findFirst: vi.fn() },
  creator: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
  businessLine: { findUnique: vi.fn() },
}));

vi.mock('../../prisma', () => ({ prisma: prismaMock }));

import { campaignService, creatorService } from './campaigns.service';

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.campaignCreator.findFirst.mockResolvedValue({ id: 'link_1' });
});


const blViewer = { id: 'u-bl', role: 'USER' as const, businessLineCode: 'DG' };

describe('creatorService · 共享字典读 + owner 写', () => {
  it('list 不再按 ownerId 过滤(共享读),仅保留筛选条件', async () => {
    prismaMock.creator.findMany.mockResolvedValue([]);
    await creatorService.list({ platform: 'TikTok' });
    const call = prismaMock.creator.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ platform: 'TikTok' });
  });

  it('getOrThrow 改为存在性校验(不查 owner)', async () => {
    prismaMock.creator.findFirst.mockResolvedValue({ id: 'cre-1', ownerId: 'u-admin' });
    await expect(creatorService.getOrThrow('cre-1')).resolves.toMatchObject({ id: 'cre-1' });
    expect(prismaMock.creator.findFirst).toHaveBeenCalledWith({ where: { id: 'cre-1' } });
  });

  it('remove: 非 owner 且非 ADMIN → 404', async () => {
    prismaMock.creator.findFirst.mockResolvedValue({ id: 'cre-1', ownerId: 'u-admin' });
    await expect(creatorService.remove('cre-1', blViewer)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('remove: owner → 删除', async () => {
    prismaMock.creator.findFirst.mockResolvedValue({ id: 'cre-1', ownerId: 'u-bl' });
    prismaMock.creator.delete.mockResolvedValue({});
    await expect(creatorService.remove('cre-1', blViewer)).resolves.toBeUndefined();
    expect(prismaMock.creator.delete).toHaveBeenCalledWith({ where: { id: 'cre-1' } });
  });
});

describe('campaignService · resolveBusinessLineCode', () => {
  it('id → code 解析', async () => {
    prismaMock.businessLine.findUnique.mockResolvedValue({ code: 'DG' });
    await expect(campaignService.resolveBusinessLineCode('bl-1')).resolves.toBe('DG');
    expect(prismaMock.businessLine.findUnique).toHaveBeenCalledWith({
      where: { id: 'bl-1' },
      select: { code: true },
    });
  });

  it('不存在 → null', async () => {
    prismaMock.businessLine.findUnique.mockResolvedValue(null);
    await expect(campaignService.resolveBusinessLineCode('nope')).resolves.toBeNull();
  });
});
