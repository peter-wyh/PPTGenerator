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

export interface ExecCandidate {
  key: string;
  label: string;
  /** 格式化好的锚定值（如 "+21.6%" / "28% of GMV"）——AI 只能复制，不能重算 */
  value: string;
  detail: string;
}

export interface ExecSummaryInput {
  /** 期内 per-creator 聚合（gmv 口径与 periodKpis 一致——中间层路径由调用方换 commission） */
  creators: Array<{ name: string; platform: string | null; clicks: number; orders: number; gmv: number }>;
  current?: { revenue: number; orders: number; clicks: number | null };
  prior?: { revenue: number; orders: number; clicks: number | null };
  trendPeak: TrendPeak | null;
  pendingOrders?: number;
  /** 新客率分子分母（hasNewCustomerTag=false 时不传） */
  newCustomers?: { count: number; orders: number };
  dataGaps?: string[];
  /** 订单表覆盖度 %（<80 且有口径提示时传） */
  caliberCoveragePct?: number | null;
}

const fmtNumL = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(Math.round(n)));
const fmtMoneyL = (n: number) => `$${n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toFixed(0)}`;
const pctNum = (cur: number, prev: number) => Math.round(((cur - prev) / prev) * 1000) / 10;
const pctStr = (v: number) => `${v > 0 ? '+' : ''}${v}%`;

/**
 * Executive Summary 候选块（spec §1.3）：确定性预计算，AI 只挑选 2-3 highlights + 1 concern。
 * 候选有数据才出现；highlights 与 concerns 双空 → 返回 null（AI 渲染空态卡）。
 */
export function buildExecSummary(input: ExecSummaryInput): { highlights: ExecCandidate[]; concerns: ExecCandidate[] } | null {
  const highlights: ExecCandidate[] = [];
  const concerns: ExecCandidate[] = [];

  // ── MoM（|pct| ≥ 5 才立候选；正→highlight，负→concern）──
  if (input.current && input.prior) {
    if (input.prior.revenue > 0 && input.current.revenue > 0) {
      const p = pctNum(input.current.revenue, input.prior.revenue);
      const detail = `${fmtMoneyL(input.current.revenue)} this month vs ${fmtMoneyL(input.prior.revenue)} last month`;
      if (p >= 5) highlights.push({ key: 'revenueMoM', label: 'Revenue MoM', value: pctStr(p), detail });
      if (p <= -5) concerns.push({ key: 'decliningRevenue', label: 'Revenue MoM', value: pctStr(p), detail });
    }
    if (input.prior.orders > 0 && input.current.orders > 0) {
      const p = pctNum(input.current.orders, input.prior.orders);
      const detail = `${fmtNumL(input.current.orders)} orders this month vs ${fmtNumL(input.prior.orders)} last month`;
      if (p >= 5) highlights.push({ key: 'ordersMoM', label: 'Orders MoM', value: pctStr(p), detail });
      if (p <= -5) concerns.push({ key: 'decliningOrders', label: 'Orders MoM', value: pctStr(p), detail });
    }
    if (
      input.current.clicks !== null && input.prior.clicks !== null &&
      input.prior.clicks > 0 && input.current.clicks > 0
    ) {
      const p = pctNum(input.current.clicks, input.prior.clicks);
      if (p <= -5) {
        concerns.push({
          key: 'decliningClicks', label: 'Clicks MoM', value: pctStr(p),
          detail: `${fmtNumL(input.current.clicks)} this month vs ${fmtNumL(input.prior.clicks)} last month`,
        });
      }
    }
  }

  // ── 期内达人 / 渠道份额 ──
  const totalGmv = input.creators.reduce((s, c) => s + c.gmv, 0);
  const totalClicks = input.creators.reduce((s, c) => s + c.clicks, 0);
  const active = input.creators.filter((c) => c.gmv > 0 || c.orders > 0 || c.clicks > 0);
  let topCreator: { name: string; share: number } | null = null;
  if (totalGmv > 0) {
    for (const c of input.creators) {
      const share = c.gmv / totalGmv;
      if (!topCreator || share > topCreator.share) topCreator = { name: c.name, share };
    }
    if (topCreator && topCreator.share >= 0.2) {
      const c = input.creators.find((x) => x.name === topCreator!.name)!;
      highlights.push({
        key: 'topCreator', label: 'Top Creator',
        value: `${Math.round(topCreator.share * 100)}% of GMV`,
        detail: `${c.name} — ${fmtMoneyL(c.gmv)} GMV, ${fmtNumL(c.orders)} orders`,
      });
    }
    // 集中度（≥3 活跃达人且 top 份额 ≥ 50%）
    if (active.length >= 3 && topCreator && topCreator.share >= 0.5) {
      concerns.push({
        key: 'concentration', label: 'Creator Concentration',
        value: `${Math.round(topCreator.share * 100)}% of GMV`,
        detail: `top creator of ${active.length} active creators`,
      });
    }
  }
  // topPlatform：clicks 口径优先；无 clicks（全 0）降级 gmv 口径
  if (totalClicks > 0 || totalGmv > 0) {
    const useClicks = totalClicks > 0;
    const byPlat = new Map<string, number>();
    for (const c of input.creators) {
      if (!c.platform) continue;
      byPlat.set(c.platform, (byPlat.get(c.platform) ?? 0) + (useClicks ? c.clicks : c.gmv));
    }
    const denom = useClicks ? totalClicks : totalGmv;
    const unit = useClicks ? 'clicks' : 'GMV';
    let topPlat: { name: string; v: number } | null = null;
    for (const [name, v] of byPlat) if (!topPlat || v > topPlat.v) topPlat = { name, v };
    if (topPlat && topPlat.v / denom >= 0.3) {
      highlights.push({
        key: 'topPlatform', label: 'Top Channel',
        value: `${Math.round((topPlat.v / denom) * 100)}% of ${unit}`,
        detail: `${topPlat.name} — ${fmtNumL(topPlat.v)} of ${fmtNumL(denom)} ${unit}`,
      });
    }
  }

  // ── 峰值日 ──
  if (input.trendPeak) {
    const label = new Date(input.trendPeak.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    highlights.push({
      key: 'peakDay', label: 'Peak Day',
      value: `${fmtMoneyL(input.trendPeak.revenue)} on ${label}`,
      detail: `${input.trendPeak.vsAvgMultiple}× the daily average`,
    });
  }

  // ── 新客率 ──
  if (input.newCustomers && input.newCustomers.orders > 0 && input.newCustomers.count > 0) {
    highlights.push({
      key: 'newCustomerRate', label: 'New-Customer Rate',
      value: `${Math.round((input.newCustomers.count / input.newCustomers.orders) * 1000) / 10}%`,
      detail: `${fmtNumL(input.newCustomers.count)} new customers across ${fmtNumL(input.newCustomers.orders)} orders`,
    });
  }

  // ── pending orders ──
  if (input.pendingOrders && input.pendingOrders > 0) {
    concerns.push({ key: 'pendingOrders', label: 'Pending Orders', value: fmtNumL(input.pendingOrders), detail: 'awaiting approval in the order table' });
  }

  // ── 数据缺口 ──
  if (input.dataGaps && input.dataGaps.length) {
    concerns.push({ key: 'dataGaps', label: 'Data Gaps', value: input.dataGaps.join(', '), detail: 'no source data — shown as N/A in this report' });
  }

  // ── 订单表口径覆盖度 ──
  if (input.caliberCoveragePct !== null && input.caliberCoveragePct !== undefined && input.caliberCoveragePct < 80) {
    concerns.push({
      key: 'caliberCoverage', label: 'Order-Table Coverage',
      value: `${input.caliberCoveragePct.toFixed(1)}% of tracked orders`,
      detail: 'order table covers only part of tracked orders — KPI caliber noted in report',
    });
  }

  if (!highlights.length && !concerns.length) return null;
  return { highlights, concerns };
}
