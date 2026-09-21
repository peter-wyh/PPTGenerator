import { describe, expect, it } from 'vitest';
import { buildTrendPeak, peakDayTopCreator, resolvePriorWindow } from './report-insights';

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
