// coverage.test.ts
import { describe, expect, it } from 'vitest';
import { computeCoverage } from './coverage';

/** 造一个带 daily 的 campaign 行(形状对齐 mapper include 返回)。 */
function campWithDaily(dates: string[]) {
  return {
    startDate: '2026-10-01', endDate: '2026-10-31',
    campaignCreators: [{
      cpsPerformances: [{ daily: dates.map((date) => ({ date, clicks: '1', orders: '1', gmv: '1' })) }],
    }],
  };
}

describe('computeCoverage', () => {
  it('全覆盖:请求区间每天都有数据 → complete=true, missingDays=0', () => {
    const r = computeCoverage(campWithDaily(['2026-10-01', '2026-10-02', '2026-10-03']), { start: '2026-10-01', end: '2026-10-03' });
    expect(r.complete).toBe(true);
    expect(r.missingDays).toBe(0);
    expect(r.covered).toEqual({ start: '2026-10-01', end: '2026-10-03' });
  });

  it('部分覆盖:daily 在区间外还有 → complete=false,missingDays=区间天数-交集天数', () => {
    const r = computeCoverage(campWithDaily(['2026-10-02', '2026-10-03', '2026-11-01']), { start: '2026-10-01', end: '2026-10-05' });
    expect(r.complete).toBe(false);
    expect(r.missingDays).toBe(3);
    expect(r.covered).toEqual({ start: '2026-10-02', end: '2026-10-03' });
  });

  it('零交集:daily 存在但全在区间外 → covered=null,complete=false,missingDays=区间天数', () => {
    const r = computeCoverage(campWithDaily(['2026-09-15']), { start: '2026-10-01', end: '2026-10-03' });
    expect(r.covered).toBeNull();
    expect(r.complete).toBe(false);
    expect(r.missingDays).toBe(3);
  });

  it('无任何 daily → covered=null,missingDays=区间天数', () => {
    const r = computeCoverage({ campaignCreators: [{ cpsPerformances: [{ daily: null }] }] }, { start: '2026-10-01', end: '2026-10-02' });
    expect(r.covered).toBeNull();
    expect(r.missingDays).toBe(2);
    expect(r.complete).toBe(false);
  });

  it('半开区间(只 start)→ end 补 campaign.endDate(与 MoM guard 同口径)', () => {
    const r = computeCoverage(campWithDaily(['2026-10-01', '2026-10-02', '2026-10-05']), { start: '2026-10-01' }, '2026-10-05');
    expect(r.complete).toBe(false); // 10-03、10-04 缺
    expect(r.missingDays).toBe(2);
  });

  it('无请求区间 → covered=daily 全集范围,missingDays=0,complete=true(全集自身必全覆盖)', () => {
    const r = computeCoverage(campWithDaily(['2026-10-02', '2026-10-04']), undefined);
    expect(r.covered).toEqual({ start: '2026-10-02', end: '2026-10-04' });
    expect(r.complete).toBe(true);
    expect(r.missingDays).toBe(0);
  });

  it('跨月边界 10-30..11-02 → 4 天全覆盖', () => {
    const r = computeCoverage(campWithDaily(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']), { start: '2026-10-30', end: '2026-11-02' });
    expect(r.complete).toBe(true);
    expect(r.missingDays).toBe(0);
  });

  it('闰日 2028-02-28..03-01 → 3 天全覆盖', () => {
    const r = computeCoverage(campWithDaily(['2028-02-28', '2028-02-29', '2028-03-01']), { start: '2028-02-28', end: '2028-03-01' });
    expect(r.complete).toBe(true);
  });

  it('start>end(区间反转)→ complete=false,不伪造覆盖', () => {
    const r = computeCoverage(campWithDaily(['2026-10-01']), { start: '2026-10-05', end: '2026-10-01' });
    expect(r.complete).toBe(false);
    expect(r.missingDays).toBe(0);
  });
});
