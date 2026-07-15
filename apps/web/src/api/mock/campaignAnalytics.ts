/**
 * Campaign 分析数据生成器（demo，确定性）。
 * 组合已有 getRevenueTimeline / getCampaignSummary + 洞察推导引擎。
 */
import type {
  CampaignAnalytics,
  CampaignInsight,
  CampaignTrendPoint,
  CampaignWeeklyTrendPoint,
} from '@mediakit/shared';
import { getRevenueTimeline, getCampaignSummary } from './affiliate';
import { getCreatorPerformances, getPlacementTypeSummaries, rollupCampaignMetrics } from './creatorPerformance';

/* 可调阈值 */
const LOW_CVR = 2; // % ：低于此且高曝光 → 高流量低转化
const LOW_ROAS = 2; // roasStatus bad 下界
const LOW_SHARE = 15; // % ：收入占比低于此且高 ROAS → 扩量机会
const TOP_PCT = 0.3; // 曝光前 30% 视为高流量

const num = (s: string): number => Number.parseFloat(String(s).replace(/[$,%]/g, '')) || 0;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** 每日趋势按 7 天滚动分桶为周趋势。 */
export function rollupWeekly(trend: CampaignTrendPoint[]): CampaignWeeklyTrendPoint[] {
  const weeks: CampaignWeeklyTrendPoint[] = [];
  for (let i = 0; i < trend.length; i += 7) {
    const bucket = trend.slice(i, i + 7);
    const revenue = bucket.reduce((s, p) => s + p.revenue, 0);
    const spend = bucket.reduce((s, p) => s + p.spend, 0);
    const orders = bucket.reduce((s, p) => s + p.orders, 0);
    weeks.push({
      week: `W${weeks.length + 1}`,
      start: bucket[0].date,
      revenue: round2(revenue),
      spend: round2(spend),
      orders,
      roas: spend > 0 ? round2(revenue / spend) : 0,
    });
  }
  return weeks;
}

/** 洞察推导：从已有 CPS / 版位汇总算出结构化结论（每类至多 1 条）。 */
export function getCampaignInsights(campaignId: string): CampaignInsight[] {
  const out: CampaignInsight[] = [];
  const creators = getCreatorPerformances(campaignId);
  const placements = getPlacementTypeSummaries(campaignId);

  if (creators.length) {
    const best = [...creators].sort((a, b) => num(b.cps.gmv) - num(a.cps.gmv))[0];
    out.push({
      kind: 'best-creator', severity: 'good', subjectType: 'creator',
      subjectId: best.creatorId, subjectName: best.creatorName,
      metrics: [
        { label: 'GMV', value: best.cps.gmv },
        { label: 'ROAS', value: best.cps.roas },
        { label: 'Orders', value: best.cps.orders },
      ],
      rationale: `${best.creatorName} 带来 ${best.cps.gmv} GMV，为全场最高。`,
      action: '加大该达人预算、复用其内容模板。',
    });

    const byImp = [...creators].sort((a, b) => num(b.summary.totalImpressions) - num(a.summary.totalImpressions));
    const cutoff = Math.max(1, Math.ceil(byImp.length * TOP_PCT));
    const lowCvr = byImp.slice(0, cutoff).find((c) => num(c.cps.cvr) < LOW_CVR);
    if (lowCvr) {
      out.push({
        kind: 'high-traffic-low-cvr', severity: 'warn', subjectType: 'creator',
        subjectId: lowCvr.creatorId, subjectName: lowCvr.creatorName,
        metrics: [
          { label: 'Impressions', value: lowCvr.summary.totalImpressions },
          { label: 'CVR', value: lowCvr.cps.cvr },
          { label: 'GMV', value: lowCvr.cps.gmv },
        ],
        rationale: `${lowCvr.creatorName} 曝光 ${lowCvr.summary.totalImpressions} 居前 ${Math.round(TOP_PCT * 100)}%，但 CVR 仅 ${lowCvr.cps.cvr}（< ${LOW_CVR}%）。`,
        action: '优化落地页与素材承接，提升转化。',
      });
    }
  }

  if (placements.length) {
    const byRev = [...placements].sort((a, b) => num(b.revenue) - num(a.revenue));
    const best = byRev[0];
    out.push({
      kind: 'best-placement', severity: 'good', subjectType: 'placement',
      subjectName: best.type,
      metrics: [
        { label: 'Revenue', value: best.revenue },
        { label: 'Share', value: best.revenueShare },
        { label: 'ROAS', value: best.roas },
      ],
      rationale: `${best.type} 创收 ${best.revenue}（占 ${best.revenueShare}），为最佳版位。`,
      action: '向该版位倾斜投放。',
    });

    const bad = byRev.find((p) => num(p.roas) < LOW_ROAS);
    if (bad) {
      out.push({
        kind: 'roas-warning', severity: 'warn', subjectType: 'placement',
        subjectName: bad.type,
        metrics: [
          { label: 'ROAS', value: bad.roas },
          { label: 'Revenue', value: bad.revenue },
          { label: 'Share', value: bad.revenueShare },
        ],
        rationale: `${bad.type} ROAS 仅 ${bad.roas}（< ${LOW_ROAS}），效益偏低。`,
        action: '压降低效版位、调整出价。',
      });
    }

    const roasVals = placements.map((p) => num(p.roas)).sort((a, b) => a - b);
    const median = roasVals.length ? roasVals[Math.floor(roasVals.length / 2)] : 0;
    const scale = byRev.find((p) => num(p.roas) > median && num(p.revenueShare) < LOW_SHARE);
    if (scale) {
      out.push({
        kind: 'scale-opportunity', severity: 'opportunity', subjectType: 'placement',
        subjectName: scale.type,
        metrics: [
          { label: 'ROAS', value: scale.roas },
          { label: 'Share', value: scale.revenueShare },
          { label: 'Revenue', value: scale.revenue },
        ],
        rationale: `${scale.type} ROAS ${scale.roas} 高于中位（${round2(median)}），但收入占比仅 ${scale.revenueShare}，有扩量空间。`,
        action: '扩量该高效版位。',
      });
    }
  }

  return out;
}

/** 组合：每日趋势 + 周趋势 + 新老客 + 洞察。 */
export function getCampaignAnalytics(campaignId: string): CampaignAnalytics {
  // 日序列形状来自 affiliate 时间线（weekday/正弦波），但口径归一到 campaign 的 CPS 合并值：
  // Σrevenue = campaign GMV、Σspend = campaign Spend，使 ROAS 与 KPI 看板（rollupCampaignMetrics）同口径。
  const raw = getRevenueTimeline(campaignId);
  const metrics = rollupCampaignMetrics(campaignId);
  const targetGmv = num(metrics.find((m) => m.label === 'GMV')?.value ?? '0');
  const targetSpend = num(metrics.find((m) => m.label === 'Spend')?.value ?? '0');
  const sumRev = raw.reduce((s, p) => s + p.revenue, 0) || 1;
  const sumSpend = raw.reduce((s, p) => s + p.spend, 0) || 1;
  const fr = targetGmv / sumRev; // revenue 口径缩放
  const fs = targetSpend / sumSpend; // spend 口径缩放
  const trend: CampaignTrendPoint[] = raw.map((p) => {
    const revenue = Math.round(p.revenue * fr);
    const spend = Math.round(p.spend * fs);
    return {
      date: p.date,
      revenue,
      spend,
      commission: Math.round(p.commission * fr),
      orders: Math.max(1, Math.round(p.orders * fr)),
      roas: spend > 0 ? round2(revenue / spend) : 0,
    };
  });
  const summary = getCampaignSummary(campaignId);
  return {
    trend,
    weeklyTrend: rollupWeekly(trend),
    customerSplit: {
      newCustomers: summary.newCustomers,
      returningCustomers: summary.returningCustomers,
      newCustomerRate: summary.newCustomerRate,
    },
    insights: getCampaignInsights(campaignId),
  };
}
