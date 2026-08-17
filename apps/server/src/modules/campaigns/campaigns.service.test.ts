import { beforeEach, describe, expect, it, vi } from 'vitest';

// campaigns.service 顶层 import prisma,这里 mock 掉避免碰 DB。
const prismaMock = vi.hoisted(() => ({
  campaignCreator: { findFirst: vi.fn() },
  cpsPerformance: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), upsert: vi.fn() },
  creator: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

vi.mock('../../prisma', () => ({ prisma: prismaMock }));

import { creatorService, importService } from './campaigns.service';

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.campaignCreator.findFirst.mockResolvedValue({ id: 'link_1' });
  prismaMock.cpsPerformance.findUnique.mockResolvedValue(null); // 默认走 create 路径
  prismaMock.cpsPerformance.create.mockResolvedValue({});
  prismaMock.cpsPerformance.update.mockResolvedValue({});
  prismaMock.cpsPerformance.upsert.mockResolvedValue({});
});

describe('importService.importCpsDaily — spend + newCustomers 每日字段', () => {
  it('dailySpend/dailyNewCustomers 落进 daily 记录(新建路径),spend 剥离 $', async () => {
    await importService.importCpsDaily('u', [
      {
        campaignId: 'c1', creatorId: 'cr1', contentType: 'post', date: '2026-08-01',
        dailyClicks: 10, dailyOrders: 2, dailyGmv: '$100',
        dailySpend: '$30', dailyNewCustomers: 5,
      },
    ]);

    expect(prismaMock.cpsPerformance.create).toHaveBeenCalledTimes(1);
    const data = prismaMock.cpsPerformance.create.mock.calls[0][0].data;
    expect(data.campaignCreatorId).toBe('link_1');
    const daily = data.daily as Array<Record<string, unknown>>;
    expect(daily).toHaveLength(1);
    expect(daily[0].spend).toBe('30');          // $ 前缀剥离(同 dailyGmv)
    expect(daily[0].newCustomers).toBe('5');
    expect(daily[0].gmv).toBe('100');
  });

  it('不带 spend/newCustomers 的行不留空键(向后兼容)', async () => {
    await importService.importCpsDaily('u', [
      { campaignId: 'c1', creatorId: 'cr1', contentType: 'post', date: '2026-08-02', dailyClicks: 7 },
    ]);

    const daily = prismaMock.cpsPerformance.create.mock.calls[0][0].data.daily as Array<Record<string, unknown>>;
    expect(daily[0].clicks).toBe('7');
    expect(daily[0]).not.toHaveProperty('spend');
    expect(daily[0]).not.toHaveProperty('newCustomers');
  });

  it('已有 CPS 时走 update 路径,新字段同样落库', async () => {
    prismaMock.cpsPerformance.findUnique.mockResolvedValue({ daily: [] }); // existingCps 真值 → update
    await importService.importCpsDaily('u', [
      {
        campaignId: 'c1', creatorId: 'cr1', contentType: 'post', date: '2026-08-01',
        dailySpend: '$30', dailyNewCustomers: 5,
      },
    ]);

    expect(prismaMock.cpsPerformance.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.cpsPerformance.create).not.toHaveBeenCalled();
    const daily = prismaMock.cpsPerformance.update.mock.calls[0][0].data.daily as Array<Record<string, unknown>>;
    expect(daily[0].spend).toBe('30');
    expect(daily[0].newCustomers).toBe('5');
  });
});

describe('importService.importCpsPerformance — 维度字段落库', () => {
  it('带 5 个维度字段 → upsert 的 create + update 都含维度', async () => {
    prismaMock.campaignCreator.findFirst.mockResolvedValue({ id: 'cc1' });

    await importService.importCpsPerformance('u', [
      {
        campaignId: 'c1', creatorId: 'cr1', contentType: 'post',
        clicks: 100, orders: 10, gmv: 1000, commission: 100, spend: 200,
        productName: 'Vitamin C Serum', category: 'Skincare',
        market: 'US', promoName: 'Summer Sale', promoType: 'discount',
      },
    ]);

    expect(prismaMock.cpsPerformance.upsert).toHaveBeenCalledTimes(1);
    const arg = prismaMock.cpsPerformance.upsert.mock.calls[0][0];
    for (const side of ['create', 'update'] as const) {
      expect(arg[side].productName).toBe('Vitamin C Serum');
      expect(arg[side].category).toBe('Skincare');
      expect(arg[side].market).toBe('US');
      expect(arg[side].promoName).toBe('Summer Sale');
      expect(arg[side].promoType).toBe('discount');
    }
  });

  it('未传维度字段 → upsert create/update 落库为 null', async () => {
    prismaMock.campaignCreator.findFirst.mockResolvedValue({ id: 'cc1' });

    await importService.importCpsPerformance('u', [
      { campaignId: 'c1', creatorId: 'cr1', contentType: 'post', clicks: 1, orders: 1, gmv: 1 },
    ]);

    const arg = prismaMock.cpsPerformance.upsert.mock.calls[0][0];
    for (const side of ['create', 'update'] as const) {
      expect(arg[side].productName).toBeNull();
      expect(arg[side].category).toBeNull();
      expect(arg[side].market).toBeNull();
      expect(arg[side].promoName).toBeNull();
      expect(arg[side].promoType).toBeNull();
    }
  });

  it('维度字段为空字符串/whitespace → 落库 null(trim 生效)', async () => {
    prismaMock.campaignCreator.findFirst.mockResolvedValue({ id: 'cc1' });

    await importService.importCpsPerformance('u', [
      {
        campaignId: 'c1', creatorId: 'cr1', contentType: 'post', clicks: 1, orders: 1, gmv: 1,
        productName: '  ', category: '', market: '\t', promoName: ' ', promoType: '',
      },
    ]);

    const arg = prismaMock.cpsPerformance.upsert.mock.calls[0][0];
    for (const side of ['create', 'update'] as const) {
      expect(arg[side].productName).toBeNull();
      expect(arg[side].category).toBeNull();
      expect(arg[side].market).toBeNull();
      expect(arg[side].promoName).toBeNull();
      expect(arg[side].promoType).toBeNull();
    }
  });
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
