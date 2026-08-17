/** 报告周期。空串表示未选。所有日期为调用方保证的本地 YYYY-MM-DD（定宽、零填充）；不做运行时格式校验。 */
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

/** 校验周期。max 应由调用方预先夹今天（未来日期无数据）。start≤end 先于窗口检查，单端出窗可被下方检查捕获。 */
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
  if (v.endDate && min && v.endDate < min) {
    return { ok: false, error: `结束日期不能早于 ${min}` };
  }
  if (v.startDate && max && v.startDate > max) {
    return { ok: false, error: `起始日期不能晚于 ${max}` };
  }
  if (v.endDate && max && v.endDate > max) {
    return { ok: false, error: `结束日期不能晚于 ${max}` };
  }
  return { ok: true, error: null };
}

export type PresetId = 'thisMonth' | 'lastMonth' | 'last7' | 'last30' | 'all';
export interface Preset {
  id: PresetId;
  label: string;
}

export const PRESETS: Preset[] = [
  { id: 'thisMonth', label: '本月' },
  { id: 'lastMonth', label: '上月' },
  { id: 'last7', label: '最近7天' },
  { id: 'last30', label: '最近30天' },
  { id: 'all', label: '全部' },
];

/** 本地 YYYY-MM-DD（仅用于把已知 Date 序列化，不读系统时钟）。 */
function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** base(YYYY-MM-DD) ± days 天。基于已知字符串构造 Date，确定性强。 */
function addDays(base: string, days: number): string {
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + days);
  return iso(d);
}

/** 某年某月(month0)的 [月初, 月末]。 */
function monthBounds(year: number, month0: number): Period {
  const first = new Date(year, month0, 1);
  const last = new Date(year, month0 + 1, 0); // 下月第 0 天 = 本月最后一天
  return { startDate: iso(first), endDate: iso(last) };
}

/**
 * 按 today 算出预设目标区间，再与 [min,max] 求交。空交集返回 null（→ 禁用该预设）。
 * 预设一律相对 today，不相对 Campaign.max。
 */
export function resolvePreset(preset: PresetId, min: string, max: string, today: string): Period | null {
  const d = new Date(`${today}T00:00:00`);
  let target: Period;
  switch (preset) {
    case 'thisMonth':
      target = monthBounds(d.getFullYear(), d.getMonth());
      break;
    case 'lastMonth':
      target = monthBounds(d.getFullYear(), d.getMonth() - 1); // JS Date 自动处理 1 月回滚到上年 12 月
      break;
    case 'last7':
      target = { startDate: addDays(today, -6), endDate: today };
      break;
    case 'last30':
      target = { startDate: addDays(today, -29), endDate: today };
      break;
    case 'all':
      target = { startDate: min, endDate: max };
      break;
  }
  const start = laterDate(target.startDate, min);
  const end = earlierDate(target.endDate, max);
  if (start && end && start <= end) return { startDate: start, endDate: end };
  return null;
}

/**
 * 推荐默认：[max-29, max] ∩ [min,max]；窗口 <30 天则退化为全窗口 [min,max]。
 * max 由调用方夹今天后传入，故本函数不依赖 today，保持纯函数。
 */
export function computeDefaultPeriod(min: string, max: string): Period {
  if (!max) return { startDate: min, endDate: max };
  return { startDate: laterDate(addDays(max, -29), min), endDate: max };
}
