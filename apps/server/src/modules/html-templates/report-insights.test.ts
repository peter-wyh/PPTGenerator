import { describe, expect, it } from 'vitest';
import { buildExecSummary, buildTrendPeak, peakDayTopCreator, resolvePriorWindow } from './report-insights';

describe('report-insights · resolvePriorWindow', () => {
  it('整自然月（31 天月）→ 上一自然月全月', () => {
    expect(resolvePriorWindow({ startDate: '2026-08-01', endDate: '2026-08-31' }))
      .toEqual({ pStart: '2026-07-01', pEnd: '2026-07-31' });
  });

  it('★30 天月：等长窗口会截断上月（09-01~09-30 等长=08-02 起）→ 修正为 8 月全月', () => {
    expect(resolvePriorWindow({ startDate: '2026-09-01', endDate: '2026-09-30' }))
      .toEqual({ pStart: '2026-08-01', pEnd: '2026-08-31' });
  });

  it('★2 月边 case：3 月整月 → 2 月全月（1-28/29），不截断 1 月', () => {
    expect(resolvePriorWindow({ startDate: '2026-03-01', endDate: '2026-03-31' }))
      .toEqual({ pStart: '2026-02-01', pEnd: '2026-02-28' });
    expect(resolvePriorWindow({ startDate: '2028-03-01', endDate: '2028-03-31' }))
      .toEqual({ pStart: '2028-02-01', pEnd: '2028-02-29' }); // 闰年
  });

  it('★1 月整月 → 上一年 12 月', () => {
    expect(resolvePriorWindow({ startDate: '2026-01-01', endDate: '2026-01-31' }))
      .toEqual({ pStart: '2025-12-01', pEnd: '2025-12-31' });
  });

  it('非整月自定义区间 → 等长前窗口（与现行 MoM 口径一致）', () => {
    expect(resolvePriorWindow({ startDate: '2026-08-05', endDate: '2026-08-10' }))
      .toEqual({ pStart: '2026-07-30', pEnd: '2026-08-04' });
  });

  it('单日区间 → 前一天', () => {
    expect(resolvePriorWindow({ startDate: '2026-08-01', endDate: '2026-08-01' }))
      .toEqual({ pStart: '2026-07-31', pEnd: '2026-07-31' });
  });
});

describe('report-insights · buildTrendPeak', () => {
  const series = [
    { date: '2026-08-01', revenue: 100, orders: 2, clicks: 10 },
    { date: '2026-08-02', revenue: 500, orders: 1, clicks: 5 },
    { date: '2026-08-03', revenue: 300, orders: 3 }, // 无 clicks 字段（clicks 缺源场景）
  ];

  it('峰值日 = revenue 最大日；vsAvgMultiple = 峰值/日均（1 位小数）；clicks 缺省不带', () => {
    expect(buildTrendPeak(series)).toEqual({
      date: '2026-08-02', revenue: 500, orders: 1, vsAvgMultiple: 1.7,
    });
  });

  it('topCreator 传入且 sharePct ≥ 20 → 附带；< 20 → 不附带', () => {
    expect(buildTrendPeak(series, { topCreator: { name: 'Mia', sharePct: 55 } }))
      .toMatchObject({ topCreator: { name: 'Mia', sharePct: 55 } });
    expect(buildTrendPeak(series, { topCreator: { name: 'Mia', sharePct: 10 } }))
      .not.toHaveProperty('topCreator');
  });

  it('空序列 / revenue 全 0 → null（宁缺勿假）', () => {
    expect(buildTrendPeak([])).toBeNull();
    expect(buildTrendPeak([{ date: '2026-08-01', revenue: 0, orders: 0 }])).toBeNull();
  });
});

describe('report-insights · peakDayTopCreator', () => {
  const byCreatorDaily = [
    { name: 'Mia', daily: new Map([['2026-08-02', 300], ['2026-08-01', 100]]) },
    { name: 'Leo', daily: new Map([['2026-08-02', 200]]) },
  ];

  it('峰日 gmv 最大达人 + 份额（1 位小数）', () => {
    expect(peakDayTopCreator(byCreatorDaily, '2026-08-02')).toEqual({ name: 'Mia', sharePct: 60 });
  });

  it('峰日无数据 / 全 0 → null', () => {
    expect(peakDayTopCreator(byCreatorDaily, '2026-08-05')).toBeNull();
    expect(peakDayTopCreator([{ name: 'X', daily: new Map([['2026-08-02', 0]]) }], '2026-08-02')).toBeNull();
  });
});

describe('report-insights · buildExecSummary', () => {
  const creators = [
    { name: 'Mia', platform: 'Instagram', clicks: 4000, orders: 179, gmv: 1600 },
    { name: 'Leo', platform: 'TikTok', clicks: 2000, orders: 50, gmv: 600 },
    { name: 'Ash', platform: 'Instagram', clicks: 1000, orders: 30, gmv: 400 },
  ];
  const trendPeak = { date: '2026-08-14', revenue: 820, orders: 9, clicks: 120, vsAvgMultiple: 3.2 };

  it('MoM 正增长(≥+5%)入 highlights；负增长(≤-5%)入 concerns；|pct|<5 不立候选', () => {
    const out = buildExecSummary({
      creators,
      current: { revenue: 5800, orders: 1100, clicks: 34600 },
      prior: { revenue: 4770, orders: 904, clicks: 10400 },
      trendPeak,
      newCustomers: { count: 380, orders: 1100 },
      pendingOrders: 809,
    })!;
    const revMoM = out.highlights.find((h) => h.key === 'revenueMoM')!;
    expect(revMoM.value).toBe('+21.6%');
    expect(out.highlights.some((h) => h.key === 'ordersMoM')).toBe(true);
    expect(out.concerns.some((c) => c.key === 'decliningClicks')).toBe(true); // clicks 环比大跌
  });

  it('topCreator 份额≥20% / topPlatform 份额≥30% / peakDay / newCustomerRate 候选', () => {
    const out = buildExecSummary({ creators, current: undefined, prior: undefined, trendPeak, newCustomers: { count: 380, orders: 1100 } })!;
    expect(out.highlights.find((h) => h.key === 'topCreator')).toMatchObject({ value: '62% of GMV' });
    expect(out.highlights.find((h) => h.key === 'topPlatform')).toMatchObject({ value: '71% of clicks' });
    expect(out.highlights.find((h) => h.key === 'peakDay')).toMatchObject({ value: '$820 on Aug 14' });
    expect(out.highlights.find((h) => h.key === 'newCustomerRate')).toMatchObject({ value: '34.5%' });
  });

  it('集中度：≥3 活跃达人且 top 份额≥50% → concern', () => {
    const out = buildExecSummary({ creators, trendPeak })!;
    expect(out.concerns.some((c) => c.key === 'concentration')).toBe(true); // 62% ≥ 50%
  });

  it('pendingOrders>0 / dataGaps / caliberCoverage<80 → concerns；clicks 缺源(null) 不产生 MoM 候选', () => {
    const out = buildExecSummary({
      creators, trendPeak,
      current: { revenue: 5800, orders: 1100, clicks: null },
      prior: { revenue: 4770, orders: 904, clicks: null },
      pendingOrders: 809, dataGaps: ['clicks', 'newCustomers'], caliberCoveragePct: 1.8,
    })!;
    expect(out.concerns.find((c) => c.key === 'pendingOrders')).toMatchObject({ value: '809' });
    expect(out.concerns.find((c) => c.key === 'dataGaps')).toMatchObject({ value: 'clicks, newCustomers' });
    expect(out.concerns.find((c) => c.key === 'caliberCoverage')).toMatchObject({ value: '1.8% of tracked orders' });
    expect(out.concerns.some((c) => c.key === 'decliningClicks')).toBe(false);
  });

  it('全空输入 → null（AI 渲染空态卡）', () => {
    expect(buildExecSummary({ creators: [], trendPeak: null })).toBeNull();
  });
});
