// order-stats.service.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
  orderDailyStat: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
}));
vi.mock('../../prisma', () => ({ prisma: prismaMock }));

import { recomputeOrderStats, getRange } from './order-stats.service';

/** 构造 queryRaw 的分组行(shape 与 $queryRaw 返回一致:bigint cnt、Decimal 求和走 string)。 */
function grpRow(over: {
  campaignCreatorId?: string | null;
  statDate: string;
  orderStatus?: string | null;
  cnt?: number;
  commission?: string | number | null;
  saleAmount?: string | number | null;
  newCustomers?: number;
}) {
  return {
    campaignCreatorId: over.campaignCreatorId ?? null,
    statDate: over.statDate,
    orderStatus: over.orderStatus ?? null,
    cnt: BigInt(over.cnt ?? 1),
    commission: over.commission ?? null,
    saleAmount: over.saleAmount ?? null,
    newCustomers: BigInt(over.newCustomers ?? 0),
  };
}

describe('recomputeOrderStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockResolvedValue([]);
  });

  it('聚合行 = creator 行之和;status 三桶拆分正确', async () => {
    // creator A:07-01 Approved 3 单佣金 4.50 + Pending 2 单 3.00
    // creator B:07-01 Approved 1 单 1.50;无归因(null):07-02 Pending 1 单 2.00
    prismaMock.$queryRaw.mockImplementation((query: unknown) => {
      const q = String((query as { sql?: string }).sql ?? query);
      if (q.includes('clickDevice')) {
        return Promise.resolve([{ statDate: '2026-07-01', device: 'iPhone', cnt: BigInt(3) }]);
      }
      if (q.includes('customerCountry')) {
        return Promise.resolve([{ statDate: '2026-07-01', country: 'Netherlands', cnt: BigInt(4), commission: '6.00' }]);
      }
      if (q.includes('orderDate IS NULL')) {
        return Promise.resolve([{ cnt: BigInt(0) }]);
      }
      return Promise.resolve([
        grpRow({ campaignCreatorId: 'ccA', statDate: '2026-07-01', orderStatus: 'Approved', cnt: 3, commission: '4.50', saleAmount: '3.00', newCustomers: 2 }),
        grpRow({ campaignCreatorId: 'ccA', statDate: '2026-07-01', orderStatus: 'Pending', cnt: 2, commission: '3.00', saleAmount: '2.00' }),
        grpRow({ campaignCreatorId: 'ccB', statDate: '2026-07-01', orderStatus: 'Approved', cnt: 1, commission: '1.50', saleAmount: '1.00' }),
        grpRow({ campaignCreatorId: null, statDate: '2026-07-02', orderStatus: 'Pending', cnt: 1, commission: '2.00', saleAmount: '1.00' }),
      ]);
    });

    const r = await recomputeOrderStats('c1');
    // 行数:聚合行 2 天 + creator 行 2(ccA 07-01 + ccB 07-01)
    expect(r.rows).toBe(4);
    expect(r.dropped).toBe(0);

    const tx = prismaMock.$transaction.mock.calls[0][0] as unknown[];
    expect(prismaMock.orderDailyStat.deleteMany).toHaveBeenCalledWith({ where: { campaignId: 'c1' } });
    expect(tx).toHaveLength(2); // deleteMany + createMany
    // $transaction 收到的是 PrismaPromise;createMany 的 data 从其 mock 调用参数取
    const rows = prismaMock.orderDailyStat.createMany.mock.calls[0][0] as { data: Record<string, unknown>[] };
    expect(rows.data).toHaveLength(4);

    // 聚合行 07-01 = ccA + ccB 之和
    const data = rows.data;
    const total01 = data.find((x) => x.campaignCreatorId === '' && x.statDate === '2026-07-01');
    expect(total01).toMatchObject({
      totalOrders: 6, approvedOrders: 4, pendingOrders: 2, otherOrders: 0,
      newCustomerOrders: 2, hasNewCustomerTag: true,
    });
    // Decimal 求和(字符串化断言,免精度纠缠):9.00 = 4.50+3.00+1.50
    expect((total01!.totalCommission as { toString(): string }).toString()).toMatch(/^9(\.0+)?$/);
    expect((total01!.approvedCommission as { toString(): string }).toString()).toMatch(/^6(\.0+)?$/);

    // 聚合行 07-02 = 无归因单
    const total02 = data.find((x) => x.campaignCreatorId === '' && x.statDate === '2026-07-02');
    expect(total02).toMatchObject({ totalOrders: 1, pendingOrders: 1 });

    // creator 行 ccA
    const ccA = data.find((x) => x.campaignCreatorId === 'ccA');
    expect(ccA).toMatchObject({ totalOrders: 5, approvedOrders: 3, pendingOrders: 2, newCustomerOrders: 2, hasNewCustomerTag: true });

    // 国家 Top5 挂聚合行
    expect(total01!.topCountries).toEqual([{ country: 'Netherlands', orders: 4, commission: '6.00' }]);
    // 设备维度挂聚合行
    expect(total01!.topDevices).toEqual([{ device: 'iPhone', orders: 3 }]);
  });

  it('customerAcquisition 全缺失 → hasNewCustomerTag=false(消费侧渲染 N/A)', async () => {
    prismaMock.$queryRaw.mockImplementation((query: unknown) => {
      const q = String((query as { sql?: string }).sql ?? query);
      if (q.includes('clickDevice')) return Promise.resolve([]);
      if (q.includes('customerCountry')) return Promise.resolve([]);
      if (q.includes('orderDate IS NULL')) return Promise.resolve([{ cnt: BigInt(0) }]);
      return Promise.resolve([
        grpRow({ campaignCreatorId: 'ccA', statDate: '2026-07-01', orderStatus: 'Approved', cnt: 5, commission: '7.50', newCustomers: 0 }),
      ]);
    });
    await recomputeOrderStats('c1');
    const rows = prismaMock.orderDailyStat.createMany.mock.calls[0][0] as { data: Record<string, unknown>[] };
    const total = rows.data.find((x) => x.campaignCreatorId === '');
    expect(total).toMatchObject({ hasNewCustomerTag: false, newCustomerOrders: 0, totalOrders: 5 });
  });

  it('declined 等其它状态 → otherOrders 桶', async () => {
    prismaMock.$queryRaw.mockImplementation((query: unknown) => {
      const q = String((query as { sql?: string }).sql ?? query);
      if (q.includes('clickDevice')) return Promise.resolve([]);
      if (q.includes('customerCountry')) return Promise.resolve([]);
      if (q.includes('orderDate IS NULL')) return Promise.resolve([{ cnt: BigInt(2) }]);
      return Promise.resolve([
        grpRow({ campaignCreatorId: 'ccA', statDate: '2026-07-01', orderStatus: 'Declined', cnt: 1, commission: '1.00' }),
      ]);
    });
    const r = await recomputeOrderStats('c1');
    expect(r.dropped).toBe(2);
    const rows = prismaMock.orderDailyStat.createMany.mock.calls[0][0] as { data: Record<string, unknown>[] };
    expect(rows.data.find((x) => x.campaignCreatorId === '')).toMatchObject({ otherOrders: 1, approvedOrders: 0, pendingOrders: 0 });
  });

  it('零订单 → deleteMany 后不 createMany(幂等空态)', async () => {
    prismaMock.$queryRaw.mockImplementation((query: unknown) => {
      const q = String((query as { sql?: string }).sql ?? query);
      if (q.includes('orderDate IS NULL')) return Promise.resolve([{ cnt: BigInt(0) }]);
      return Promise.resolve([]);
    });
    const r = await recomputeOrderStats('c1');
    expect(r.rows).toBe(0);
    const tx = prismaMock.$transaction.mock.calls[0][0] as unknown[];
    expect(tx).toHaveLength(1); // 只有 deleteMany
  });
});

describe('getRange', () => {
  beforeEach(() => vi.clearAllMocks());

  it('零行 → null(fallback 判定)', async () => {
    prismaMock.orderDailyStat.findMany
      .mockResolvedValueOnce([])   // 聚合行
      .mockResolvedValueOnce([]);  // creator 行
    expect(await getRange('c1')).toBeNull();
  });

  it('区间聚合:days/totals/byCreator 正确,statDate 过滤生效', async () => {
    const dec = (v: string) => ({ toString: () => v, toNumber: () => Number(v) });
    prismaMock.orderDailyStat.findMany
      .mockResolvedValueOnce([
        { statDate: '2026-07-01', campaignCreatorId: '', totalOrders: 63, approvedOrders: 63, pendingOrders: 0, otherOrders: 0, totalCommission: dec('48.51'), approvedCommission: dec('48.51'), pendingCommission: dec('0'), newCustomerOrders: 0, hasNewCustomerTag: false, topCountries: [{ country: 'Netherlands', orders: 63, commission: '48.51' }] },
        { statDate: '2026-07-02', campaignCreatorId: '', totalOrders: 185, approvedOrders: 0, pendingOrders: 185, otherOrders: 0, totalCommission: dec('142.45'), approvedCommission: dec('0'), pendingCommission: dec('142.45'), newCustomerOrders: 0, hasNewCustomerTag: true, topCountries: null },
      ])
      .mockResolvedValueOnce([
        { statDate: '2026-07-01', campaignCreatorId: 'ccA', totalOrders: 63, approvedOrders: 63, pendingOrders: 0, otherOrders: 0, totalCommission: dec('48.51'), approvedCommission: dec('48.51'), pendingCommission: dec('0'), newCustomerOrders: 0, hasNewCustomerTag: false },
      ]);

    const r = await getRange('c1', '2026-07-01', '2026-07-02');
    expect(r).not.toBeNull();
    expect(r!.days).toHaveLength(2);
    expect(r!.days[0]).toMatchObject({ date: '2026-07-01', orders: 63, commission: 48.51 });
    expect(r!.totals).toMatchObject({ orders: 248, approvedOrders: 63, pendingOrders: 185, hasNewCustomerTag: true });
    expect(r!.totals.commission).toBeCloseTo(190.96, 2);
    expect(r!.byCreator.get('ccA')).toMatchObject({ orders: 63, commission: 48.51 });
  });
});
