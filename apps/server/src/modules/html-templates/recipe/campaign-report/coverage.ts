// coverage.ts
/**
 * 「宁缺勿假」覆盖计算:从 campaign 行(campaignCreators[].cpsPerformances[].daily)
 * 计算请求区间的 daily 覆盖。纯函数,mapper 与 ai-generate.service 共用。
 * 口径:区间内「每一天都有记录」才 complete;covered 是交集的 min/max 日期。
 */
type Any = Record<string, any>;

export interface DailyCoverage {
  /** daily 与请求区间交集的 min/max;无任何交集 → null */
  covered: { start: string; end: string } | null;
  /** 请求区间内无数据的天数(无 daily → 全区间天数) */
  missingDays: number;
  /** missingDays === 0。注意:无请求区间且无 daily 时为 true(「无请求即无缺失」);下游判断数据可用性应以 covered !== null 为准 */
  complete: boolean;
}

/** 枚举 [start, end] 的每个 ISO 日期(含端点)。 */
function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  const e = new Date(`${end}T00:00:00Z`).getTime();
  for (let t = new Date(`${start}T00:00:00Z`).getTime(); !isNaN(t) && t <= e; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

export function computeCoverage(
  campaign: Any,
  requested: { start?: string; end?: string } | undefined,
  /** 半开区间兜底用的 campaign.endDate(与 mapper MoM guard 同口径)。 */
  campaignEndFallback?: string,
): DailyCoverage {
  // 1) 收集全部 daily 日期集合(仅匹配 ISO YYYY-MM-DD;非 ISO 日期视为缺失(计入 missingDays))
  //    ★ 真源切换(cps-daily 废弃)：日期集合来自 LinkPerformance.daily（旧 CpsPerformance.daily
  //      已全部复制/重建进 LP——migratedFromCpsId 溯源，无遗漏);成交侧日期不进覆盖判定
  //      (报告 trend 的 revenue/orders 由订单表现算，与流量覆盖正交)。
  const dailyDates = new Set<string>();
  for (const lp of campaign?.linkPerformances ?? []) {
    for (const d of (lp?.daily as Any[] | null | undefined) ?? []) {
      const date = String(d?.date ?? '');
      if (date) dailyDates.add(date);
    }
  }

  // 2) 请求区间(无 → daily 全集即"请求",全集必全覆盖)
  if (!requested?.start && !requested?.end) {
    if (dailyDates.size === 0) return { covered: null, missingDays: 0, complete: true };
    const sorted = [...dailyDates].sort();
    return { covered: { start: sorted[0], end: sorted[sorted.length - 1] }, missingDays: 0, complete: true };
  }
  let start = requested?.start;
  let end = requested?.end;
  start = start || [...dailyDates].sort()[0] || campaign?.startDate;
  end = end || campaignEndFallback || campaign?.endDate || start;
  if (!start || !end) return { covered: null, missingDays: 0, complete: true };

  // 垃圾/反转日期不伪造覆盖:任一端解析失败或 start>end → 视为不可用
  const s = new Date(`${start}T00:00:00Z`).getTime();
  const e = new Date(`${end}T00:00:00Z`).getTime();
  if (isNaN(s) || isNaN(e) || s > e) return { covered: null, missingDays: 0, complete: false };

  // 3) 交集 + 缺失天数
  const days = eachDay(start, end);
  const inRange = days.filter((d) => dailyDates.has(d));
  if (days.length === 0 || inRange.length === 0) {
    return { covered: null, missingDays: days.length, complete: false };
  }
  return {
    covered: { start: inRange[0], end: inRange[inRange.length - 1] },
    missingDays: days.length - inRange.length,
    complete: days.length === inRange.length,
  };
}
