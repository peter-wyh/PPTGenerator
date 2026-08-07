import { beforeEach, describe, expect, it, vi } from 'vitest';

// campaigns.service 顶层 import prisma,这里 mock 掉避免碰 DB。
const prismaMock = vi.hoisted(() => ({
  campaignCreator: { findFirst: vi.fn() },
  cpsPerformance: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
}));

vi.mock('../../prisma', () => ({ prisma: prismaMock }));

import { importService } from './campaigns.service';

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.campaignCreator.findFirst.mockResolvedValue({ id: 'link_1' });
  prismaMock.cpsPerformance.findUnique.mockResolvedValue(null); // 默认走 create 路径
  prismaMock.cpsPerformance.create.mockResolvedValue({});
  prismaMock.cpsPerformance.update.mockResolvedValue({});
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
