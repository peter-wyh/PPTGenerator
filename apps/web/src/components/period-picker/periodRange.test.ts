import { describe, expect, it } from 'vitest';
import { clampPeriod, earlierDate, laterDate, validatePeriod } from './periodRange';

describe('earlierDate / laterDate', () => {
  it('返回较早/较晚者；空串视为无界', () => {
    expect(earlierDate('2026-01-01', '2026-02-01')).toBe('2026-01-01');
    expect(laterDate('2026-01-01', '2026-02-01')).toBe('2026-02-01');
    expect(earlierDate('', '2026-02-01')).toBe('2026-02-01');
    expect(laterDate('', '2026-02-01')).toBe('2026-02-01');
    expect(earlierDate('', '')).toBe('');
  });
});

describe('clampPeriod', () => {
  it('把越界起止夹进 [min,max]', () => {
    expect(clampPeriod({ startDate: '2025-01-01', endDate: '2030-01-01' }, '2026-01-01', '2026-12-31'))
      .toEqual({ startDate: '2026-01-01', endDate: '2026-12-31' });
  });
  it('区间内保持不变', () => {
    expect(clampPeriod({ startDate: '2026-06-01', endDate: '2026-06-30' }, '2026-01-01', '2026-12-31'))
      .toEqual({ startDate: '2026-06-01', endDate: '2026-06-30' });
  });
});

describe('validatePeriod', () => {
  const ok = { ok: true, error: null };
  it('required 且空 → 不通过', () => {
    expect(validatePeriod({ startDate: '', endDate: '' }, { required: true }))
      .toEqual({ ok: false, error: '请选择起止日期' });
  });
  it('非 required 空值 → 通过', () => {
    expect(validatePeriod({ startDate: '', endDate: '' }, {})).toEqual(ok);
  });
  it('起始晚于结束 → 不通过', () => {
    expect(validatePeriod({ startDate: '2026-06-10', endDate: '2026-06-01' }, {}))
      .toEqual({ ok: false, error: '起始日期不能晚于结束日期' });
  });
  it('起始早于 min → 不通过', () => {
    expect(validatePeriod({ startDate: '2025-12-31', endDate: '2026-06-01' }, { min: '2026-01-01' }))
      .toEqual({ ok: false, error: '起始日期不能早于 2026-01-01' });
  });
  it('结束晚于 max(含未来) → 不通过', () => {
    expect(validatePeriod({ startDate: '2026-06-01', endDate: '2027-01-01' }, { max: '2026-12-31' }))
      .toEqual({ ok: false, error: '结束日期不能晚于 2026-12-31' });
  });
  it('合法区间 → 通过', () => {
    expect(validatePeriod({ startDate: '2026-06-01', endDate: '2026-06-30' }, { min: '2026-01-01', max: '2026-12-31', required: true }))
      .toEqual(ok);
  });
});
