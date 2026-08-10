// mapper.ts
import { prisma } from '../../../../prisma';
import { ApiError } from '../../../../utils/ApiError';
import { formatMoney, formatNum, formatPct } from '../format';
import type { CampaignReportContent } from './schema';

type Any = Record<string, any>;

function metric(m: Any | null, key: string): number {
  return Number((m as Any)?.[key] ?? 0);
}

/** "2026-10-12" → "Oct 12"。 */
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}

/**
 * reportPeriod 给定且有 CPS daily 数据时,从 CpsPerformance.daily 按日期切片
 * 派生 KPI / publishers / trend / period / insights。纯函数,不查 DB。
 * 与 mapCampaign 的「汇总派生」分支隔离,可独立测试。
 */
function mapFromDaily(
  campaign: Any,
  reportPeriod: { startDate?: string; endDate?: string },
): { kpis: CampaignReportContent['kpis']; publishers: CampaignReportContent['publishers']; trend: CampaignReportContent['trend']; period: CampaignReportContent['header']['period']; insights: CampaignReportContent['insights'] } {
  const { startDate, endDate } = reportPeriod;
  const inPeriod = (d: string) => (!startDate || d >= startDate) && (!endDate || d <= endDate);
  const num = (v: unknown) => Number(v) || 0;

  // 1) 每个创作者的期内 daily 求和
  type DailySum = { clicks: number; orders: number; gmv: number; newCustomers: number };
  const perCreator: { cc: Any; sum: DailySum }[] = (campaign.campaignCreators ?? []).map((cc: Any) => {
    const sum: DailySum = { clicks: 0, orders: 0, gmv: 0, newCustomers: 0 };
    for (const p of cc.cpsPerformances ?? []) {
      for (const d of (p.daily as Any[] | null | undefined) ?? []) {
        const date = String(d.date ?? '');
        if (!date || !inPeriod(date)) continue;
        sum.clicks += num(d.clicks);
        sum.orders += num(d.orders);
        sum.gmv += num(d.gmv);
        sum.newCustomers += num(d.newCustomers);
      }
    }
    return { cc, sum };
  });

  // 2) 总量
  const total = perCreator.reduce<DailySum>(
    (a, x) => ({
      clicks: a.clicks + x.sum.clicks,
      orders: a.orders + x.sum.orders, gmv: a.gmv + x.sum.gmv,
      newCustomers: a.newCustomers + x.sum.newCustomers,
    }),
    { clicks: 0, orders: 0, gmv: 0, newCustomers: 0 },
  );
  const aov = total.orders ? total.gmv / total.orders : 0;

  // 3) KPI(结构同 mapCampaign 现有)
  const kpis = [
    { label: 'Total Revenues', value: formatMoney(total.gmv) },
    { label: 'Clicks', value: formatNum(total.clicks) },
    { label: 'Orders', value: formatNum(total.orders) },
    { label: 'New Customer Acquisition', value: formatNum(total.newCustomers), highlight: true },
    { label: 'AOV', value: formatMoney(aov) },
  ];

  // 4) publishers(同 mapCampaign 现有结构)
  const publishers = perCreator.map(({ cc, sum }) => {
    const partner = cc.creator?.partnerType ?? 'creator';
    const kind = partner === 'content_site' ? 'site' : partner === 'community' ? 'fb' : 'creator';
    const platform = cc.creator?.platform ?? campaign.platform;
    return {
      name: cc.creator?.name ?? 'Unknown',
      handle: cc.creator?.handle || undefined,
      type: { label: kind === 'creator' ? 'Creator' : kind === 'site' ? 'Site' : 'Community', kind: kind as any },
      screenshotUrl: `https://placehold.co/120x68/f5f7fa/1e1c24?text=${encodeURIComponent(platform)}`,
      revenue: formatMoney(sum.gmv),
      clicks: formatNum(sum.clicks),
      orders: formatNum(sum.orders),
      linkUrl: cc.creator?.profileUrl || undefined,
    };
  });

  // 5) trend:跨创作者按 date 分组(日粒度)
  const byDate = new Map<string, { revenue: number; clicks: number; orders: number }>();
  for (const cc of campaign.campaignCreators ?? []) {
    for (const p of cc.cpsPerformances ?? []) {
      for (const d of (p.daily as Any[] | null | undefined) ?? []) {
        const date = String(d.date ?? '');
        if (!date || !inPeriod(date)) continue;
        const entry = byDate.get(date) ?? { revenue: 0, clicks: 0, orders: 0 };
        entry.revenue += num(d.gmv);
        entry.clicks += num(d.clicks);
        entry.orders += num(d.orders);
        byDate.set(date, entry);
      }
    }
  }
  const dates = [...byDate.keys()].sort();
  const trend = {
    labels: dates,
    revenue: dates.map((d) => byDate.get(d)!.revenue),
    clicks: dates.map((d) => byDate.get(d)!.clicks),
    orders: dates.map((d) => byDate.get(d)!.orders),
  };

  // 6) period
  const start = reportPeriod.startDate ?? campaign.startDate;
  const end = reportPeriod.endDate ?? campaign.endDate;
  const period = { start, end, display: `${shortDate(start)} - ${shortDate(end)}, ${String(start).slice(0, 4)}` };

  // 7) insights(newCustomerRate 从 daily 重算)
  const rate = total.orders ? (total.newCustomers / total.orders) * 100 : 0;
  const insights = { newCustomerRate: { rate: formatPct(Math.round(rate * 10) / 10), newCount: total.newCustomers, totalOrders: total.orders } };

  return { kpis, publishers, trend, period, insights };
}

export async function mapCampaign(campaignId: string, reportPeriod?: { startDate?: string; endDate?: string }): Promise<CampaignReportContent> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      campaignCreators: { include: { creator: true, performance: true, cpsPerformances: true } },
      businessLine: true, advertiser: true,
    },
  });
  if (!campaign) throw ApiError.notFound('Campaign 不存在');

  // ★ reportPeriod + 有 CPS daily → 从 daily 派生;否则走下方现有汇总逻辑
  const hasDaily = (campaign.campaignCreators ?? []).some((cc: Any) =>
    (cc.cpsPerformances ?? []).some((p: Any) => Array.isArray(p.daily) && p.daily.length > 0));
  if (reportPeriod && hasDaily) {
    const { kpis, publishers, trend, period, insights } = mapFromDaily(campaign, reportPeriod);
    return {
      header: {
        brand: { name: campaign.businessLine?.name ?? campaign.businessLineCode ?? 'Brand', logoText: (campaign.businessLine?.name ?? campaign.businessLineCode ?? 'brand').toLowerCase() },
        merchant: { name: campaign.advertiser?.name ?? campaign.advertiserName ?? 'Merchant', logoText: (campaign.advertiser?.name ?? campaign.advertiserName ?? 'M').slice(0, 2).toUpperCase() },
        period,
      },
      kpis, trend, publishers,
      insights,
      actionable: [], // 由 narrative 填(与现有路径一致)
    };
  }
  if (reportPeriod && !hasDaily) {
    console.warn('[mapCampaign] reportPeriod given but no CPS daily data; falling back to aggregate');
  }

  const m = (campaign.metrics ?? {}) as Any;
  const analytics = (campaign.analytics ?? {}) as Any;
  const trendSrc = analytics.trend ?? {};

  const totalRevenue = metric(m, 'totalRevenue');
  const clicks = metric(m, 'clicks');
  const orders = metric(m, 'orders');
  const newCustomers = metric(m, 'newCustomers');
  const aov = metric(m, 'aov') || (orders ? totalRevenue / orders : 0);

  const publishers = campaign.campaignCreators.map((cc) => {
    const cps = cc.cpsPerformances.reduce(
      (a, p) => ({ clicks: a.clicks + p.clicks, orders: a.orders + p.orders, gmv: a.gmv + Number(p.gmv) }),
      { clicks: 0, orders: 0, gmv: 0 },
    );
    const partner = cc.creator?.partnerType ?? 'creator';
    const kind = partner === 'content_site' ? 'site' : partner === 'community' ? 'fb' : 'creator';
    const platform = cc.creator?.platform ?? campaign.platform;
    return {
      name: cc.creator?.name ?? 'Unknown',
      handle: cc.creator?.handle || undefined,
      type: { label: kind === 'creator' ? 'Creator' : kind === 'site' ? 'Site' : 'Community', kind: kind as any },
      screenshotUrl: `https://placehold.co/120x68/f5f7fa/1e1c24?text=${encodeURIComponent(platform)}`,
      revenue: formatMoney(cps.gmv),
      clicks: formatNum(cps.clicks),
      orders: formatNum(cps.orders),
      linkUrl: cc.creator?.profileUrl || undefined,
    };
  });

  const newCustomerRate = metric(m, 'newCustomerRate');
  const insights = newCustomerRate
    ? {
        newCustomerRate: {
          rate: formatPct(Math.round(newCustomerRate * 10) / 10),
          newCount: newCustomers,
          totalOrders: orders,
          deltaPct: m.newCustomerDelta ? formatPct(Math.round(Number(m.newCustomerDelta) * 10) / 10) : undefined,
        },
      }
    : {};

  return {
    header: {
      brand: { name: campaign.businessLine?.name ?? campaign.businessLineCode ?? 'Brand', logoText: (campaign.businessLine?.name ?? campaign.businessLineCode ?? 'brand').toLowerCase() },
      merchant: { name: campaign.advertiser?.name ?? campaign.advertiserName ?? 'Merchant', logoText: (campaign.advertiser?.name ?? campaign.advertiserName ?? 'M').slice(0, 2).toUpperCase() },
      period: { start: campaign.startDate, end: campaign.endDate, display: `${shortDate(campaign.startDate)} - ${shortDate(campaign.endDate)}, ${campaign.startDate.slice(0, 4)}` },
    },
    kpis: [
      { label: 'Total Revenues', value: formatMoney(totalRevenue) },
      { label: 'Clicks', value: formatNum(clicks) },
      { label: 'Orders', value: formatNum(orders) },
      { label: 'New Customer Acquisition', value: formatNum(newCustomers), highlight: true },
      { label: 'AOV', value: formatMoney(aov) },
    ],
    trend: {
      labels: trendSrc.labels ?? [],
      revenue: trendSrc.revenue ?? [],
      clicks: trendSrc.clicks ?? [],
      orders: trendSrc.orders ?? [],
    },
    publishers,
    insights: Object.keys(insights).length ? insights : undefined,
    actionable: [], // 由 narrative 填
  };
}
