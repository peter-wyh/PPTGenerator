// report-insights.ts
// ★ 0921 月报迭代（spec docs/superpowers/specs/2026-09-21-monthly-report-iteration-design.md）：
//   趋势对比前窗 / 峰值 / Executive Summary 候选的确定性派生——纯函数，不查 DB。
//   契约：数字全部在此算好注入 AI 上下文，AI 只做挑选与叙述（narrative.ts 同哲学，宁缺勿假）。

export interface DailyPoint {
  date: string;
  revenue: number;
  orders: number;
  clicks?: number;
}

export interface TrendPeak {
  date: string;
  revenue: number;
  orders: number;
  clicks?: number;
  /** 峰日 revenue ÷ 期内日均（数据日口径），1 位小数 */
  vsAvgMultiple: number;
  /** 峰日贡献最大达人（gmv 口径）；仅非中间层路径可导出（口径门控见 spec §1.2） */
  topCreator?: { name: string; sharePct: number };
}

const pad = (n: number) => String(n).padStart(2, '0');
const isoUtc = (y: number, m0: number, d: number) => `${y}-${pad(m0 + 1)}-${pad(d)}`;

/**
 * 前期窗口解析（spec §1.1）：
 * - 报告期 = 整自然月（start=当月1日 且 end=当月最后一天）→ 上一自然月全月。
 *   （等长前窗口在 30/28 天月会截断上月——如 9 月报等长窗口从 8/2 起，故整月改自然月口径。）
 * - 否则 → 等长前窗口（与 buildCampaignContext 现行 MoM 口径保持兼容）。
 * UTC 算术，与现行 `new Date('YYYY-MM-DD')` + `toISOString()` 约定一致。
 */
export function resolvePriorWindow(period: { startDate: string; endDate: string }): { pStart: string; pEnd: string } {
  const dayMs = 86_400_000;
  const s = new Date(period.startDate);
  const e = new Date(period.endDate);
  const sY = s.getUTCFullYear(), sM = s.getUTCMonth(), sD = s.getUTCDate();
  const lastDay = new Date(Date.UTC(sY, sM + 1, 0)).getUTCDate();
  if (sD === 1 && e.getUTCFullYear() === sY && e.getUTCMonth() === sM && e.getUTCDate() === lastDay) {
    const py = sM === 0 ? sY - 1 : sY;
    const pm = sM === 0 ? 11 : sM - 1;
    const pLast = new Date(Date.UTC(py, pm + 1, 0)).getUTCDate();
    return { pStart: isoUtc(py, pm, 1), pEnd: isoUtc(py, pm, pLast) };
  }
  const len = Math.max(e.getTime() - s.getTime() + dayMs, dayMs);
  return {
    pStart: new Date(s.getTime() - len).toISOString().slice(0, 10),
    pEnd: new Date(s.getTime() - dayMs).toISOString().slice(0, 10),
  };
}

/** 峰值事实（spec §1.2）：series 的 revenue 最大日。空序列 / revenue 全 0 → null。 */
export function buildTrendPeak(
  series: DailyPoint[],
  opts?: { topCreator?: { name: string; sharePct: number } | null },
): TrendPeak | null {
  if (!series.length) return null;
  let peakIdx = -1;
  let sum = 0;
  for (let i = 0; i < series.length; i++) {
    sum += series[i].revenue;
    if (peakIdx < 0 || series[i].revenue > series[peakIdx].revenue) peakIdx = i;
  }
  const peak = series[peakIdx];
  if (peak.revenue <= 0) return null;
  const avg = sum / series.length;
  // clicks 仅在整条序列都有值时才携带（任一天缺源 → 字段整体不注入，宁缺勿假）
  const hasClicks = series.every((p) => p.clicks !== undefined);
  const out: TrendPeak = {
    date: peak.date,
    revenue: Math.round(peak.revenue * 100) / 100,
    orders: peak.orders,
    ...(hasClicks && peak.clicks !== undefined ? { clicks: peak.clicks } : {}),
    vsAvgMultiple: Math.round((peak.revenue / avg) * 10) / 10,
  };
  // 份额 < 20% 的"峰日最大达人"无叙事价值 → 不注入（与 execSummary topCreator 同阈值）
  if (opts?.topCreator && opts.topCreator.sharePct >= 20) out.topCreator = opts.topCreator;
  return out;
}

/**
 * 峰日贡献最大达人（spec §1.2 口径门控）：share = 该达人峰日 gmv ÷ 全 campaign 峰日 gmv。
 * 仅非中间层路径调用（OrderDailyStat 无「达人×日」维度，commission 与 gmv 口径不符——宁缺勿假）。
 */
export function peakDayTopCreator(
  byCreatorDaily: { name: string; daily: Map<string, number> }[],
  peakDate: string,
): { name: string; sharePct: number } | null {
  const campaignGmv = byCreatorDaily.reduce((s, c) => s + (c.daily.get(peakDate) ?? 0), 0);
  if (campaignGmv <= 0) return null;
  let top: { name: string; gmv: number } | null = null;
  for (const c of byCreatorDaily) {
    const g = c.daily.get(peakDate) ?? 0;
    if (!top || g > top.gmv) top = { name: c.name, gmv: g };
  }
  if (!top || top.gmv <= 0) return null;
  return { name: top.name, sharePct: Math.round((top.gmv / campaignGmv) * 1000) / 10 };
}
