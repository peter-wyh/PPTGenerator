/** 报告周期。空串表示未选。所有日期为本地 YYYY-MM-DD。 */
export type Period = { startDate: string; endDate: string };

export interface ValidationResult {
  ok: boolean;
  error: string | null;
}

/**
 * ISO YYYY-MM-DD 字符串词法比较即等价于 chronological（定宽格式）。
 * 空串视为"无界"：与无界比较返回另一侧非空值。
 */
export function earlierDate(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

export function laterDate(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

/** 把起止各自夹进 [min,max]；空 min/max 表示该侧无界。 */
export function clampPeriod(v: Period, min: string, max: string): Period {
  let { startDate, endDate } = v;
  if (min) {
    if (startDate && startDate < min) startDate = min;
    if (endDate && endDate < min) endDate = min;
  }
  if (max) {
    if (startDate && startDate > max) startDate = max;
    if (endDate && endDate > max) endDate = max;
  }
  return { startDate, endDate };
}

/** 校验周期。max 应由调用方预先夹今天（未来日期无数据）。 */
export function validatePeriod(
  v: Period,
  opts: { min?: string; max?: string; required?: boolean } = {},
): ValidationResult {
  const { min = '', max = '', required = false } = opts;
  if (required && (!v.startDate || !v.endDate)) {
    return { ok: false, error: '请选择起止日期' };
  }
  if (v.startDate && v.endDate && v.startDate > v.endDate) {
    return { ok: false, error: '起始日期不能晚于结束日期' };
  }
  if (v.startDate && min && v.startDate < min) {
    return { ok: false, error: `起始日期不能早于 ${min}` };
  }
  if (v.endDate && max && v.endDate > max) {
    return { ok: false, error: `结束日期不能晚于 ${max}` };
  }
  return { ok: true, error: null };
}
