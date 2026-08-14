import { describe, expect, it } from 'vitest';
import { clampPeriod, computeDefaultPeriod, earlierDate, laterDate, PRESETS, resolvePreset, validatePeriod } from './periodRange';

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
  it('单侧界:仅 min 时只夹下界', () => {
    expect(clampPeriod({ startDate: '2025-06-01', endDate: '2030-06-01' }, '2026-01-01', ''))
      .toEqual({ startDate: '2026-01-01', endDate: '2030-06-01' });
  });
  it('一端未选时不被填充', () => {
    expect(clampPeriod({ startDate: '', endDate: '2030-06-01' }, '2026-01-01', '2026-12-31'))
      .toEqual({ startDate: '', endDate: '2026-12-31' });
  });
  it('起止相等时保持', () => {
    expect(clampPeriod({ startDate: '2026-06-15', endDate: '2026-06-15' }, '2026-01-01', '2026-12-31'))
      .toEqual({ startDate: '2026-06-15', endDate: '2026-06-15' });
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

describe('PRESETS', () => {
  it('包含五个标准预设,顺序固定', () => {
    expect(PRESETS.map((p) => p.id)).toEqual(['thisMonth', 'lastMonth', 'last7', 'last30', 'all']);
  });
});

describe('resolvePreset', () => {
  const min = '2026-01-01';
  const max = '2026-08-14';
  const today = '2026-08-14';
  it('全部 → 整个窗口', () => {
    expect(resolvePreset('all', min, max, today)).toEqual({ startDate: min, endDate: max });
  });
  it('最近30天 → [today-29, today] 与窗口求交', () => {
    expect(resolvePreset('last30', min, max, today)).toEqual({ startDate: '2026-07-16', endDate: '2026-08-14' });
  });
  it('本月 → 本月历月与窗口求交', () => {
    expect(resolvePreset('thisMonth', min, max, today)).toEqual({ startDate: '2026-08-01', endDate: '2026-08-14' });
  });
  it('上月 → 上月历月与窗口求交', () => {
    expect(resolvePreset('lastMonth', min, max, today)).toEqual({ startDate: '2026-07-01', endDate: '2026-07-31' });
  });
  it('目标区间在窗口外 → null(禁用)', () => {
    expect(resolvePreset('thisMonth', '2020-01-01', '2020-12-31', today)).toBeNull();
  });
});

describe('computeDefaultPeriod', () => {
  it('窗口≥30天 → [max-29, max]', () => {
    expect(computeDefaultPeriod('2026-01-01', '2026-08-14')).toEqual({ startDate: '2026-07-16', endDate: '2026-08-14' });
  });
  it('窗口<30天 → 退化为全窗口', () => {
    expect(computeDefaultPeriod('2026-08-10', '2026-08-14')).toEqual({ startDate: '2026-08-10', endDate: '2026-08-14' });
  });
});
