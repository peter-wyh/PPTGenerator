// mapper.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  campaign: { findUnique: vi.fn() },
  orderDailyStat: { findMany: vi.fn() },
  // ★ 真源切换(cps-daily 废弃)：loadCreatorCps 走 LP 流量 + 订单 raw 聚合
  campaignCreator: { findMany: vi.fn() },
  linkPerformance: { findMany: vi.fn() },
  $queryRaw: vi.fn(),
}));

/** 同步 loadCreatorCps 的 mock 注入（campaignRow.campaignCreators → cc/LP/订单三查询）。 */
function mockCreatorCps(campaignRow: any) {
  const ccs = (campaignRow.campaignCreators ?? []).map((cc: any, i: any) => ({
    id: cc.id ?? `cc_${i}`,
    creatorId: cc.creatorId ?? `creator_${i}`,
    creator: { name: cc.creator?.name ?? 'X' },
  }));
  prismaMock.campaignCreator.findMany.mockResolvedValue(ccs);
  // LP 行：聚合列来自 cpsPerformances 顶层；daily 原样（数组式 {date,...}）
  const lpRows = (campaignRow.campaignCreators ?? []).flatMap((cc: any, i: any) =>
    (cc.cpsPerformances ?? []).map((p: any, j: any) => ({
      id: `lp_${i}_${j}`, campaignCreatorId: ccs[i].id, publisher: { creatorId: null },
      clicks: p.clicks ?? 0, impressions: p.impressions ?? 0, orders: p.orders ?? 0,
      gmv: p.gmv ?? 0, commission: p.commission ?? 0, spend: p.spend ?? 0,
      daily: p.daily ?? [],
    })),
  );
  prismaMock.linkPerformance.findMany.mockResolvedValue(lpRows);
  // computeCoverage 读 campaign.linkPerformances（生产 include 同形）——挂回 fixture 供覆盖判定
  campaignRow.linkPerformances = lpRows;
  // 成交侧（订单真源）：cpsPerformances 的 orders/gmv → 按日聚合行；newCustomers 从 daily 汇总
  // （fixture cps 顶层无 newCustomers——旧语义在 daily.newCustomers，订单行同样从 daily 取）
  const orderRows = (campaignRow.campaignCreators ?? []).flatMap((cc: any, i: any) => {
    const ccId = ccs[i].id;
    const perfs = cc.cpsPerformances ?? [];
    // 顶层聚合（周期标量）拆成一行哨兵日期？——不行，loadCreatorCps 只认 YYYY-MM-DD 且并进 daily。
    // 正确形态：把顶层 orders/gmv 记到 daily 全日期均摊不可靠；直接给一个专用日期行（coverage 外不影响期内测试——
    // 期内测试的 fixture 顶层全 0，orders/gmv 在 daily 里）。均摊到 daily 各天最贴近旧口径（Σdaily=Σ顶层）。
    const rows = [];
    const days = perfs.flatMap((pp: any) => (pp.daily ?? []).map((d: any) => String(d.date))).filter(Boolean);
    const uniqDays = [...new Set(days)];
    for (const [j, perf] of perfs.entries()) {
      const daily = perf.daily ?? [];
      const sum = (k: any) => daily.reduce((acc: any, d: any) => acc + (Number(d[k]) || 0), 0);
      const ordersTot = (perf.orders ?? 0) - sum('orders');
      const gmvTot = (perf.gmv ?? 0) - sum('gmv');
      const ncTot = (perf.newCustomers ?? 0) - sum('newCustomers');
      if (ordersTot > 0 || gmvTot > 0 || ncTot > 0) {
        // 顶层与 daily 的差值（fixture 语义：顶层=全周期、daily=期内切片）放到 campaign 末日
        const d = uniqDays.length ? uniqDays[uniqDays.length - 1] : '2026-01-01';
        rows.push({ ccId, d, cnt: BigInt(Math.max(0, Math.round(ordersTot))), sale: gmvTot, comm: 0, nc: BigInt(Math.max(0, Math.round(ncTot))) });
      }
      for (const dd of daily) {
        const date = String(dd.date ?? '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        rows.push({
          ccId, d: date,
          cnt: BigInt(Number(dd.orders) || 0),
          sale: Number(dd.gmv) || 0,
          comm: Number(dd.commission) || 0,
          nc: BigInt(Number(dd.newCustomers) || 0),
        });
      }
      void j;
    }
    return rows;
  });
  prismaMock.$queryRaw.mockResolvedValue(orderRows);
}
vi.mock('../../../../prisma', () => ({ prisma: prismaMock }));

import { mapCampaign } from './mapper';

const campaignRow = {
  id: 'c1', name: 'GlowLab x DIGCHIC', platform: 'TikTok',
  startDate: '2026-10-12', endDate: '2026-11-10', budget: '$300K', status: 'Completed',
  businessLineCode: 'FT', advertiserName: 'GlowLab',
  businessLine: { name: 'FT' }, advertiser: { name: 'GlowLab' },
  metrics: { totalRevenue: 876360, clicks: 348619, orders: 4636, newCustomers: 1604, aov: 189, newCustomerRate: 34.6 },
  analytics: { trend: { labels: ['Oct 12','Nov 10'], revenue: [50000,166360], clicks: [15000,83619], orders: [250,876] } },
  campaignCreators: [{
    id: 'cc_0', creatorId: 'creator_0',
    creator: { name: 'Mia Chen', handle: '@miaglowup', platform: 'TikTok', partnerType: 'creator', profileUrl: 'https://tiktok.com/@miaglowup' },
    contentType: 'video', collabType: 'cps',
    cpsPerformances: [{ clicks: 124678, impressions: 0, orders: 1016, gmv: 192000, spend: 0, commission: 0 }],
    performance: { summary: {} },
  }],
};

// 汇总 fixture 带 spend(metrics.totalRevenue 对齐 cps.gmv,使 ROAS 直观)
const campaignRowWithSpend = {
  ...campaignRow,
  metrics: { ...campaignRow.metrics, totalRevenue: 192000 },
  campaignCreators: [{
    ...campaignRow.campaignCreators[0],
    cpsPerformances: [{ clicks: 124678, impressions: 0, orders: 1016, gmv: 192000, spend: 48000, commission: 0 }],
  }],
};

// 带 CPS daily 的 fixture(daily 值为字符串,与 importCpsDaily 落库一致)
const campaignRowWithDaily = {
  id: 'c1', name: 'Test', platform: 'TikTok',
  startDate: '2026-10-12', endDate: '2026-10-20',
  businessLineCode: 'FT', advertiserName: 'GlowLab',
  businessLine: { name: 'FT' }, advertiser: { name: 'GlowLab' },
  metrics: { totalRevenue: 999999, clicks: 999999, orders: 999999, newCustomers: 999999, aov: 999, newCustomerRate: 50 },
  analytics: { trend: { labels: ['x'], revenue: [999999], clicks: [999999], orders: [999999] } },
  campaignCreators: [{
    id: 'cc_0', creatorId: 'creator_0',
    creator: { name: 'Mia Chen', handle: '@mia', platform: 'TikTok', partnerType: 'creator', profileUrl: 'u1' },
    contentType: 'video', collabType: 'cps',
    cpsPerformances: [{
      clicks: 0, impressions: 0, orders: 0, gmv: 0, spend: 0, commission: 0,
      daily: [
        { date: '2026-10-12', clicks: '100', orders: '10', gmv: '1000', spend: '100', newCustomers: '5' },  // 期外 before
        { date: '2026-10-15', clicks: '200', orders: '20', gmv: '2000', spend: '200', newCustomers: '8' },  // 期内
        { date: '2026-10-16', clicks: '300', orders: '30', gmv: '3000', spend: '300', newCustomers: '12' }, // 期内
        { date: '2026-10-20', clicks: '400', orders: '40', gmv: '4000', spend: '400', newCustomers: '15' }, // 期外 after
      ],
    }],
    performance: { summary: {} },
  }],
};

// 带 CPS daily + 维度标签的 fixture(验证 mapFromDaily 聚合 4 维度)
const campaignRowWithDailyAndDims = {
  ...campaignRowWithDaily,
  campaignCreators: [{
    ...campaignRowWithDaily.campaignCreators[0],
    cpsPerformances: [{
      ...(campaignRowWithDaily.campaignCreators[0].cpsPerformances[0] as any),
      productName: 'Vitamin C Serum', category: 'Skincare',
      market: 'US', promoName: 'Summer Sale', promoType: 'discount',
    }],
  }],
};

beforeEach(() => { vi.clearAllMocks(); mockCreatorCps(campaignRow); });

describe('mapCampaign', () => {
  it('campaign 不存在 → 抛 notFound', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(null);
    await expect(mapCampaign('nope')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('KPI 从 metrics 映射 + 格式化', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRow);
    mockCreatorCps(campaignRow);
    const c = await mapCampaign('c1');
    const byLabel = Object.fromEntries(c.kpis.map((k) => [k.label, k.value]));
    expect(byLabel['Total Revenues']).toBe('$876,360');
    expect(byLabel['Clicks']).toBe('348,619');
    expect(byLabel['Orders']).toBe('4,636');
    expect(byLabel['New Customer Acquisition']).toBe('1,604');
    expect(byLabel['AOV']).toBe('$189');
    // New Customer 卡高亮
    expect(c.kpis.find((k) => k.label === 'New Customer Acquisition')?.highlight).toBe(true);
  });

  it('header.period.display 格式化', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRow);
    mockCreatorCps(campaignRow);
    const c = await mapCampaign('c1');
    expect(c.header.period.display).toBe('Oct 12 - Nov 10, 2026');
  });

  it('publisher 从 campaignCreators + cps 映射', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRow);
    mockCreatorCps(campaignRow);
    const c = await mapCampaign('c1');
    expect(c.publishers).toHaveLength(1);
    const p = c.publishers[0];
    expect(p.name).toBe('Mia Chen');
    expect(p.handle).toBe('@miaglowup');
    expect(p.type.kind).toBe('creator');
    expect(p.revenue).toBe('$192,000');
    expect(p.clicks).toBe('124,678');
    expect(p.orders).toBe('1,016');
    expect(p.linkUrl).toBe('https://tiktok.com/@miaglowup');
  });

  it('metrics 全空 → revenue/orders/clicks 回退 CPS 聚合列镜像,其余仍 N/A 不兜 0', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue({ ...campaignRow, metrics: {} });
    mockCreatorCps({ ...campaignRow, metrics: {} });
    const c = await mapCampaign('c1');
    expect(c.kpis.find((k) => k.label === 'Total Revenues')?.value).toBe('$192,000'); // cps.gmv 回退
    expect(c.kpis.find((k) => k.label === 'Clicks')?.value).toBe('124,678'); // cps 聚合列回退(真源)
    expect(c.kpis.find((k) => k.label === 'Orders')?.value).toBe('1,016'); // cps.orders 回退
    expect(c.kpis.find((k) => k.label === 'New Customer Acquisition')?.value).toBe('Metric unavailable'); // daily 无行,不回退
  });

  it('metrics + CPS 聚合列双源皆无 clicks → Metric unavailable(不兜 0)', async () => {
    const noSrc = {
      ...campaignRow,
      metrics: {},
      campaignCreators: [{
        ...campaignRow.campaignCreators[0],
        cpsPerformances: [{ clicks: 0, impressions: 0, orders: 0, gmv: 0, spend: 0, commission: 0 }],
      }],
    };
    prismaMock.campaign.findUnique.mockResolvedValue(noSrc);
    mockCreatorCps(noSrc);
    const c = await mapCampaign('c1');
    expect(c.kpis.find((k) => k.label === 'Clicks')?.value).toBe('Metric unavailable');
  });

  it('actionable 留空(由 narrative 填)', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRow);
    mockCreatorCps(campaignRow);
    const c = await mapCampaign('c1');
    expect(c.actionable).toEqual([]);
  });

  it('有 period → KPI/publishers/trend 只含期内 daily,header.period=reportPeriod', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRowWithDaily);
    mockCreatorCps(campaignRowWithDaily);
    const c = await mapCampaign('c1', { startDate: '2026-10-15', endDate: '2026-10-17' });
    const byLabel = Object.fromEntries(c.kpis.map((k) => [k.label, k.value]));
    expect(byLabel['Total Revenues']).toBe('$5,000');      // 2000+3000
    expect(byLabel['Clicks']).toBe('500');                 // 200+300
    expect(byLabel['Orders']).toBe('50');                  // 20+30
    expect(byLabel['New Customer Acquisition']).toBe('20');// 8+12
    expect(byLabel['AOV']).toBe('$100');                   // 5000/50
    expect(c.publishers).toHaveLength(1);
    expect(c.publishers[0].revenue).toBe('$5,000');
    expect(c.publishers[0].clicks).toBe('500');
    expect(c.publishers[0].orders).toBe('50');
    expect(c.trend.labels).toEqual(['2026-10-15', '2026-10-16']);
    expect(c.trend.revenue).toEqual([2000, 3000]);
    expect(c.trend.orders).toEqual([20, 30]);
    expect(c.header.period.start).toBe('2026-10-15');
    expect(c.header.period.end).toBe('2026-10-17');
  });

  it('有 daily + 维度标签 + period → insights 聚合 4 维度(期内切片)', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRowWithDailyAndDims);
    mockCreatorCps(campaignRowWithDailyAndDims);
    // period 2026-10-15 ~ 2026-10-17:期内 daily = 2000(10-15) + 3000(10-16),orders = 20 + 30 = 50
    const c = await mapCampaign('c1', { startDate: '2026-10-15', endDate: '2026-10-17' });
    expect(c.insights?.topCategories).toEqual([{ label: 'Skincare', pct: 100, color: '#ff099e' }]);
    expect(c.insights?.topProducts).toEqual([{ name: 'Vitamin C Serum', revenue: '$5,000' }]);
    expect(c.insights?.topMarket).toEqual([{ country: 'US', revenue: '$5,000', pct: 100, color: '#ff099e' }]);
    expect(c.insights?.topPromotion).toEqual([{ name: 'Summer Sale', type: 'discount', revenue: '$5,000', usage: '50', tagKind: 'discount' }]);
    // newCustomerRate 仍保留
    expect(c.insights?.newCustomerRate).toBeDefined();
  });

  // ── 宁缺勿假:无 analytics 兜底 ──────────────────────────────

  it('无 daily + period → 空态卡(No data for this period),不读 analytics', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRow);
    mockCreatorCps(campaignRow);
    const r = await mapCampaign('c1', { startDate: '2026-10-13', endDate: '2026-10-19' });
    expect(r.kpis).toEqual([{ label: 'No data for this period', value: '—', highlight: false }]);
    expect(r.trend).toEqual({ labels: [], revenue: [], clicks: [], orders: [] });
    expect(r.publishers).toEqual([]);
    expect(r.dataCoverage?.covered).toBeNull();
    expect(r.dataCoverage?.complete).toBe(false);
  });

  it('部分覆盖 + period → 出真实数 + dataCoverage.missingDays>0', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRowWithDaily);
    mockCreatorCps(campaignRowWithDaily);
    // 请求 10-12~10-20(9 天),daily 期内有 12/15/16/20 四天 → missing 5
    const r = await mapCampaign('c1', { startDate: '2026-10-12', endDate: '2026-10-20' });
    expect(r.kpis.find((k) => k.label === 'Clicks')?.value).toBe('1,000'); // 100+200+300+400
    expect(r.dataCoverage).toMatchObject({ covered: { start: '2026-10-12', end: '2026-10-20' }, missingDays: 5, complete: false });
  });

  it('零交集 + period → 空态卡 + covered=null', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRowWithDaily);
    mockCreatorCps(campaignRowWithDaily);
    const r = await mapCampaign('c1', { startDate: '2026-11-01', endDate: '2026-11-05' });
    expect(r.kpis).toEqual([{ label: 'No data for this period', value: '—', highlight: false }]);
    expect(r.dataCoverage?.covered).toBeNull();
  });

  it('无 period(汇总口径)→ metrics 缺 clicks 回退聚合列,totalRevenue 正常渲染', async () => {
    const partial = { ...campaignRow, metrics: { totalRevenue: 876360 } };
    prismaMock.campaign.findUnique.mockResolvedValue(partial);
    mockCreatorCps(partial);
    const r = await mapCampaign('c1');
    expect(r.kpis.find((k) => k.label === 'Clicks')?.value).toBe('124,678'); // cps 聚合列回退
    expect(r.kpis.find((k) => k.label === 'Total Revenues')?.value).toBe('$876,360');
  });

  it('无 period + analytics 有数据 → KPI/trend 不来自 analytics(宁缺勿假)', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRow);
    mockCreatorCps(campaignRow);
    const r = await mapCampaign('c1');
    expect(r.kpis.find((k) => k.label === 'Clicks')?.value).toBe('348,619'); // metrics.clicks 真实值
    expect(r.trend.labels).toEqual([]); // analytics.trend 不再进 trend
  });

  it('period 半开(只 startDate)→ 单边过滤', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRowWithDaily);
    mockCreatorCps(campaignRowWithDaily);
    const c = await mapCampaign('c1', { startDate: '2026-10-16' }); // 只 start,无 end
    // >= 2026-10-16:10-16、10-20 入;10-12、10-15 出
    expect(c.trend.labels).toEqual(['2026-10-16', '2026-10-20']);
    const byLabel = Object.fromEntries(c.kpis.map((k) => [k.label, k.value]));
    expect(byLabel['Total Revenues']).toBe('$7,000'); // 3000+4000
  });

  it('旧 daily(无 spend/newCustomers)+ period → 当 0,不 NaN', async () => {
    const oldRow = {
      ...campaignRowWithDaily,
      campaignCreators: [{
        ...campaignRowWithDaily.campaignCreators[0],
        cpsPerformances: [{
          clicks: 0, impressions: 0, orders: 0, gmv: 0, spend: 0, commission: 0,
          daily: [{ date: '2026-10-15', clicks: '200', orders: '20', gmv: '2000' }], // 无 spend/newCustomers
        }],
      }],
    };
    prismaMock.campaign.findUnique.mockResolvedValue(oldRow);
    mockCreatorCps(oldRow);
    const c = await mapCampaign('c1', { startDate: '2026-10-15', endDate: '2026-10-17' });
    const byLabel = Object.fromEntries(c.kpis.map((k) => [k.label, k.value]));
    expect(byLabel['New Customer Acquisition']).toBe('0');
    expect(byLabel['Total Revenues']).toBe('$2,000');
  });

  it('汇总路径 spend>0 → KPI 含 ROAS(= totalRevenue/totalSpend)', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRowWithSpend);
    mockCreatorCps(campaignRowWithSpend);
    const c = await mapCampaign('c1');
    const roas = c.kpis.find((k) => k.label === 'ROAS');
    expect(roas).toBeDefined();
    expect(roas!.value).toBe('4.00x'); // 192000 / 48000 = 4
  });

  it('汇总路径 spend=0 → 无 ROAS 卡(仍 6 个 KPI,含 CVR)', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRow); // campaignRow 的 cps spend=0
    mockCreatorCps(campaignRow);
    const c = await mapCampaign('c1');
    expect(c.kpis.find((k) => k.label === 'ROAS')).toBeUndefined();
    expect(c.kpis).toHaveLength(6);
  });

  it('汇总 KPI 含 CVR(= orders/clicks × 100,格式化)', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRow);
    mockCreatorCps(campaignRow);
    const c = await mapCampaign('c1');
    const cvr = c.kpis.find((k) => k.label === 'Conversion Rate');
    expect(cvr).toBeDefined();
    // 汇总分支读 metrics: clicks 348619, orders 4636 → 1.33% → 1.3%
    expect(cvr!.value).toBe('1.3%');
  });

  it('汇总 clicks=0 → CVR 不可用 Metric unavailable(宁缺勿假,不兜 0%)', async () => {
    const row = { ...campaignRow, metrics: { ...campaignRow.metrics, clicks: 0 } };
    prismaMock.campaign.findUnique.mockResolvedValue(row);
    mockCreatorCps(row);
    const c = await mapCampaign('c1');
    expect(c.kpis.find((k) => k.label === 'Conversion Rate')!.value).toBe('Metric unavailable');
  });

  it('mapFromDaily(reportPeriod)KPI 含 CVR(期内 orders/clicks)', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRowWithDaily);
    mockCreatorCps(campaignRowWithDaily);
    const c = await mapCampaign('c1', { startDate: '2026-10-15', endDate: '2026-10-17' });
    // 期内: clicks 200+300=500, orders 20+30=50 → 10%
    expect(c.kpis.find((k) => k.label === 'Conversion Rate')!.value).toBe('10%');
  });

  it('汇总路径(无 daily)+ 维度标签 → insights 聚合 4 维度(用链接 gmv)', async () => {
    const row = {
      ...campaignRow,
      campaignCreators: [{
        ...campaignRow.campaignCreators[0],
        cpsPerformances: [{
          ...campaignRow.campaignCreators[0].cpsPerformances[0],
          productName: 'Serum', category: 'Skincare', market: 'US',
          promoName: 'Sale', promoType: 'discount',
        }],
      }],
    };
    prismaMock.campaign.findUnique.mockResolvedValue(row);
    mockCreatorCps(row);
    const c = await mapCampaign('c1'); // 无 reportPeriod → 汇总分支
    // campaignRow cps.gmv = 192000, orders = 1016
    expect(c.insights?.topCategories).toEqual([{ label: 'Skincare', pct: 100, color: '#ff099e' }]);
    expect(c.insights?.topProducts).toEqual([{ name: 'Serum', revenue: '$192,000' }]);
    expect(c.insights?.topMarket).toEqual([{ country: 'US', revenue: '$192,000', pct: 100, color: '#ff099e' }]);
    expect(c.insights?.topPromotion?.[0]).toMatchObject({ name: 'Sale', usage: '1,016', tagKind: 'discount' });
  });

  it('mapFromDaily + reportPeriod → insights.mom 前等长无数据 → undefined 降级', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRowWithDaily);
    mockCreatorCps(campaignRowWithDaily);
    // reportPeriod 2026-10-15~16(2 天)。前等长 2026-10-13~14。fixture daily 里无 10-13/14
    // → previousOrders=0 → mom undefined
    const c = await mapCampaign('c1', { startDate: '2026-10-15', endDate: '2026-10-16' });
    expect(c.insights?.mom).toBeUndefined();
  });

  it('半开 reportPeriod(只 startDate)→ MoM undefined(不回退 campaign.endDate 算错)', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRowWithDaily);
    mockCreatorCps(campaignRowWithDaily);
    const c = await mapCampaign('c1', { startDate: '2026-10-16' }); // 只 start,无 end
    expect(c.insights?.mom).toBeUndefined();
  });

  it('mapFromDaily + 前等长有数据 → mom 正确(ordersMoM/salesMoM 带 +)', async () => {
    const row = {
      ...campaignRowWithDaily,
      campaignCreators: [{
        ...campaignRowWithDaily.campaignCreators[0],
        cpsPerformances: [{
          ...(campaignRowWithDaily.campaignCreators[0].cpsPerformances[0] as any),
          daily: [
            ...(campaignRowWithDaily.campaignCreators[0].cpsPerformances[0] as any).daily,
            { date: '2026-10-13', clicks: '50', orders: '10', gmv: '1000', spend: '50', newCustomers: '3' },
          ],
        }],
      }],
    };
    prismaMock.campaign.findUnique.mockResolvedValue(row);
    mockCreatorCps(row);
    // reportPeriod 10-15~17: orders 50, gmv 5000。前等长 10-12~14: 10-12(orders 10)+10-13(orders 10) = orders 20, gmv 2000
    // ordersMoM = (50-20)/20*100 = +150%, salesMoM = (5000-2000)/2000*100 = +150%
    const c = await mapCampaign('c1', { startDate: '2026-10-15', endDate: '2026-10-17' });
    expect(c.insights?.mom).toMatchObject({
      ordersMoM: '+150%', salesMoM: '+150%',
      currentOrders: 50, previousOrders: 20,
      currentSales: 5000, previousSales: 2000,
    });
  });

  it('无 period → dataCoverage.requested 回退 campaign 起止', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRow);
    mockCreatorCps(campaignRow);
    const r = await mapCampaign('c1');
    expect(r.dataCoverage?.requested).toEqual({ start: '2026-10-12', end: '2026-11-10' });
  });

  it('有 period → dataCoverage.requested = 所选周期', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRowWithDaily);
    mockCreatorCps(campaignRowWithDaily);
    const r = await mapCampaign('c1', { startDate: '2026-10-12', endDate: '2026-10-20' });
    expect(r.dataCoverage?.requested).toEqual({ start: '2026-10-12', end: '2026-10-20' });
  });

  it('汇总 clicks=100 + orders=0 → CVR 为真实 0%(非 Metric unavailable)', async () => {
    const real = { ...campaignRow, metrics: { totalRevenue: 876360, clicks: 100, orders: 0, newCustomers: 5, aov: 0 } };
    prismaMock.campaign.findUnique.mockResolvedValue(real);
    mockCreatorCps(real);
    const r = await mapCampaign('c1');
    expect(r.kpis.find((k) => k.label === 'Conversion Rate')?.value).toBe('0%');
    expect(r.kpis.find((k) => k.label === 'Orders')?.value).toBe('0');
  });
});

// ─── 订单中间层(OrderDailyStat)口径 ─────────────────────────────────────────
// mapCampaign 在 hasPeriod 时先查 getRange(prisma.orderDailyStat.findMany);
// 第一次调用(聚合行 campaignCreatorId='')为 fallback 判定,第二次为 creator 行。
const dec = (v: string) => ({ toString: () => v });

/** mock getRange 两次 findMany:聚合行 + creator 行。 */
function mockOrderStats(totalRows: unknown[], creatorRows: unknown[]) {
  prismaMock.orderDailyStat.findMany
    .mockResolvedValueOnce(totalRows)
    .mockResolvedValueOnce(creatorRows);
}

describe('mapCampaign · 订单中间层口径', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 默认无中间层(空 → null → 走 mapFromDaily 老路)
    prismaMock.orderDailyStat.findMany.mockResolvedValue([]);
  });

  it('中间层有数据 → revenue/orders 换订单源,clicks 保持 daily', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRowWithDaily);
    mockCreatorCps(campaignRowWithDaily);
    // daily:10-15 clicks 200/orders 20/gmv 2000;中间层:10-15 orders 25/commission 300
    mockOrderStats(
      [{ statDate: '2026-10-15', campaignCreatorId: '', totalOrders: 25, approvedOrders: 25, pendingOrders: 0, otherOrders: 0, totalCommission: dec('300.00'), approvedCommission: dec('300.00'), pendingCommission: dec('0'), newCustomerOrders: 0, hasNewCustomerTag: false, topCountries: [{ country: 'Netherlands', orders: 25, commission: '300.00' }] }],
      [{ statDate: '2026-10-15', campaignCreatorId: 'cc1', totalOrders: 25, approvedOrders: 25, pendingOrders: 0, otherOrders: 0, totalCommission: dec('300.00'), approvedCommission: dec('300.00'), pendingCommission: dec('0'), newCustomerOrders: 0, hasNewCustomerTag: false }],
    );
    const c = await mapCampaign('c1', { startDate: '2026-10-15', endDate: '2026-10-16' });
    const byLabel = Object.fromEntries(c.kpis.map((k) => [k.label, k.value]));
    // ★ orders 来自订单表(25)而非 daily(20);revenue = commission 口径(300)而非 daily gmv(2000)
    expect(byLabel['Orders']).toBe('25');
    expect(byLabel['Total Revenues']).toBe('$300');
    // clicks 仍来自 daily(10-15 的 200 + 10-16 的 300)
    expect(byLabel['Clicks']).toBe('500');
    // 标签缺失 → Metric unavailable(不编造 0)
    expect(byLabel['New Customer Acquisition']).toBe('Metric unavailable');
    // status 拆分新 KPI
    expect(byLabel['Approved Orders']).toBe('25');
    // topMarket ← topCountries
    expect(c.insights?.topMarket?.[0]).toMatchObject({ country: 'Netherlands', revenue: '$300' });
    // newCustomerRate 不输出(标签不可用)
    expect(c.insights?.newCustomerRate).toBeUndefined();
    // trend:orders/revenue 从中间层,clicks 从 daily(10-15+10-16 并集)
    expect(c.trend.labels).toEqual(['2026-10-15', '2026-10-16']);
    expect(c.trend.orders).toEqual([25, 0]);
    expect(c.trend.revenue).toEqual([300, 0]);
    expect(c.trend.clicks).toEqual([200, 300]);
  });

  it('新客标签可用 → newCustomerRate 输出真值', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRowWithDaily);
    mockCreatorCps(campaignRowWithDaily);
    mockOrderStats(
      [{ statDate: '2026-10-15', campaignCreatorId: '', totalOrders: 10, approvedOrders: 10, pendingOrders: 0, otherOrders: 0, totalCommission: dec('100.00'), approvedCommission: dec('100.00'), pendingCommission: dec('0'), newCustomerOrders: 4, hasNewCustomerTag: true, topCountries: null }],
      [],
    );
    const c = await mapCampaign('c1', { startDate: '2026-10-15', endDate: '2026-10-16' });
    expect(c.kpis.find((k) => k.label === 'New Customer Acquisition')?.value).toBe('4');
    expect(c.insights?.newCustomerRate).toMatchObject({ newCount: 4, totalOrders: 10 });
  });

  it('daily coverage 为空但中间层有数据 → 仍渲染订单侧(不被 coverage 误杀)', async () => {
    // campaignRow 无 daily → cov.covered=null;中间层有行 → 走 mapFromOrderStats
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRow);
    mockCreatorCps(campaignRow);
    mockOrderStats(
      [{ statDate: '2026-10-13', campaignCreatorId: '', totalOrders: 5, approvedOrders: 5, pendingOrders: 0, otherOrders: 0, totalCommission: dec('50.00'), approvedCommission: dec('50.00'), pendingCommission: dec('0'), newCustomerOrders: 0, hasNewCustomerTag: false, topCountries: null }],
      [],
    );
    const c = await mapCampaign('c1', { startDate: '2026-10-13', endDate: '2026-10-14' });
    expect(c.kpis.find((k) => k.label === 'Orders')?.value).toBe('5');
    expect(c.kpis[0].value).not.toBe('—'); // 非空态
  });

  it('中间层无数据 → 回落 mapFromDaily(行为不变)', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRowWithDaily);
    mockCreatorCps(campaignRowWithDaily);
    prismaMock.orderDailyStat.findMany.mockResolvedValue([]);
    const c = await mapCampaign('c1', { startDate: '2026-10-15', endDate: '2026-10-17' });
    const byLabel = Object.fromEntries(c.kpis.map((k) => [k.label, k.value]));
    expect(byLabel['Orders']).toBe('50');   // daily 口径 20+30
    expect(byLabel['Total Revenues']).toBe('$5,000');
  });
});

describe('mapCampaign · clicks 缺失≠0 与设备维度', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.orderDailyStat.findMany.mockResolvedValue([]);
  });

  it('daily 无 clicks key → Clicks/CVR = Metric unavailable(不编造 0)', async () => {
    // daily 记录无 clicks key(Trivago Awin 导入通道的真实形态)
    const noClicksCamp = {
      ...campaignRowWithDaily,
      campaignCreators: [{
        ...campaignRowWithDaily.campaignCreators[0],
        cpsPerformances: [{
          ...campaignRowWithDaily.campaignCreators[0].cpsPerformances[0],
          daily: [
            { date: '2026-10-15', orders: '20', gmv: '2000' },
            { date: '2026-10-16', orders: '30', gmv: '3000' },
          ],
        }],
      }],
    };
    prismaMock.campaign.findUnique.mockResolvedValue(noClicksCamp);
    mockCreatorCps(noClicksCamp);
    const c = await mapCampaign('c1', { startDate: '2026-10-15', endDate: '2026-10-17' });
    const byLabel = Object.fromEntries(c.kpis.map((k) => [k.label, k.value]));
    expect(byLabel['Clicks']).toBe('Metric unavailable');
    expect(byLabel['Conversion Rate']).toBe('Metric unavailable');
    expect(byLabel['Orders']).toBe('50'); // orders 仍真实
  });

  it('daily 有 clicks key 值为 0 → 渲染真实 0(非 unavailable)', async () => {
    const zeroClicksCamp = {
      ...campaignRowWithDaily,
      campaignCreators: [{
        ...campaignRowWithDaily.campaignCreators[0],
        cpsPerformances: [{
          ...campaignRowWithDaily.campaignCreators[0].cpsPerformances[0],
          daily: [
            { date: '2026-10-15', clicks: '0', orders: '20', gmv: '2000' },
            { date: '2026-10-16', clicks: '0', orders: '30', gmv: '3000' },
          ],
        }],
      }],
    };
    prismaMock.campaign.findUnique.mockResolvedValue(zeroClicksCamp);
    mockCreatorCps(zeroClicksCamp);
    const c = await mapCampaign('c1', { startDate: '2026-10-15', endDate: '2026-10-17' });
    const byLabel = Object.fromEntries(c.kpis.map((k) => [k.label, k.value]));
    expect(byLabel['Clicks']).toBe('0');
    expect(byLabel['Conversion Rate']).toBe('0%');
  });

  it('中间层带 topDevices → insights.topDevices 聚合+pct', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRowWithDaily);
    mockCreatorCps(campaignRowWithDaily);
    mockOrderStats(
      [{ statDate: '2026-10-15', campaignCreatorId: '', totalOrders: 25, approvedOrders: 25, pendingOrders: 0, otherOrders: 0, totalCommission: dec('300.00'), approvedCommission: dec('300.00'), pendingCommission: dec('0'), newCustomerOrders: 0, hasNewCustomerTag: false, topCountries: null, topDevices: [{ device: 'iPhone', orders: 15 }, { device: 'Android Mobile', orders: 10 }] }],
      [],
    );
    const c = await mapCampaign('c1', { startDate: '2026-10-15', endDate: '2026-10-16' });
    expect(c.insights?.topDevices).toEqual([
      { device: 'iPhone', orders: 15, pct: 60 },
      { device: 'Android Mobile', orders: 10, pct: 40 },
    ]);
  });
});
