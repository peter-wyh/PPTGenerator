// mapper.ts
import { prisma } from '../../../../prisma';
import { ApiError } from '../../../../utils/ApiError';
import { formatMoney, formatNum, formatPct, formatRatio } from '../format';
import { aggregateDimensions, type DimLink } from './dimensions';
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

  // 7) insights(4 维度从 cpsPerformances 链接级标签聚合 + newCustomerRate 从 daily 重算)
  const dimLinks: DimLink[] = [];
  for (const cc of campaign.campaignCreators ?? []) {
    for (const p of cc.cpsPerformances ?? []) {
      let gmv = 0, orders = 0;
      for (const d of (p.daily as Any[] | null | undefined) ?? []) {
        const date = String(d.date ?? '');
        if (!date || !inPeriod(date)) continue;
        gmv += num(d.gmv);
        orders += num(d.orders);
      }
      if (gmv > 0 || orders > 0) {
        dimLinks.push({
          productName: p.productName, category: p.category, market: p.market,
          promoName: p.promoName, promoType: p.promoType, gmv, orders,
        });
      }
    }
  }
  const rate = total.orders ? (total.newCustomers / total.orders) * 100 : 0;
  const insights = {
    ...aggregateDimensions(dimLinks),
    newCustomerRate: { rate: formatPct(Math.round(rate * 10) / 10), newCount: total.newCustomers, totalOrders: total.orders },
  };

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
  const summary = ((analytics.summary as Any | undefined) ?? {}) as Any;

  // trend 兼容两种存储形状:
  //   生产:每日数组 [{date,clicks,orders,revenue,impressions}, …](camp-wander-summer 等)
  //   旧合成/测试:预透视对象 {labels,revenue,clicks,orders}
  const trendSrc = analytics.trend;
  let trendLabels: string[] = [];
  let trendRevenue: number[] = [];
  let trendClicks: number[] = [];
  let trendOrders: number[] = [];
  if (Array.isArray(trendSrc)) {
    const rows = trendSrc as Any[];
    const sorted = [...rows].sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')));
    trendLabels = sorted.map((r) => String(r.date ?? ''));
    trendRevenue = sorted.map((r) => Number(r.revenue) || 0);
    trendClicks = sorted.map((r) => Number(r.clicks) || 0);
    trendOrders = sorted.map((r) => Number(r.orders) || 0);
  } else if (trendSrc && typeof trendSrc === 'object') {
    const o = trendSrc as Any;
    trendLabels = o.labels ?? [];
    trendRevenue = o.revenue ?? [];
    trendClicks = o.clicks ?? [];
    trendOrders = o.orders ?? [];
  }
  const trend = { labels: trendLabels, revenue: trendRevenue, clicks: trendClicks, orders: trendOrders };

  // KPI 总量:优先 analytics.summary(total* 前缀),其次 campaign.metrics。
  // 注:KPI 与 trend 是独立数据源——trend 只是图表序列,不反推 KPI 总量(保持 "metrics 缺字段→兜底 0" 契约)。
  // 注:summary 里 aov/newCustomerRate 是预格式化字符串("$81.86"/"42%"),这里统一从原始数值重算,避免解析。
  const totalRevenue = metric(summary, 'totalRevenue') || metric(m, 'totalRevenue');
  const clicks = metric(summary, 'totalClicks') || metric(m, 'clicks');
  const orders = metric(summary, 'totalOrders') || metric(m, 'orders');
  const newCustomers = metric(summary, 'newCustomers') || metric(m, 'newCustomers');
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

  // 维度聚合(汇总路径:用 cpsPerformance 链接顶层 gmv/orders,不切日期)
  const dimLinks: DimLink[] = (campaign.campaignCreators ?? []).flatMap((cc: Any) =>
    (cc.cpsPerformances ?? []).map((p: Any) => ({
      productName: p.productName, category: p.category, market: p.market,
      promoName: p.promoName, promoType: p.promoType,
      gmv: Number(p.gmv) || 0, orders: Number(p.orders) || 0,
    })),
  );
  const dimInsights = aggregateDimensions(dimLinks);

  // newCustomerRate:metrics 优先(数值),否则从已读到的 newCustomers/orders 重算(summary 里是 "42%" 字符串,不解析)。
  const newCustomerRate = metric(m, 'newCustomerRate') || (newCustomers && orders ? (newCustomers / orders) * 100 : 0);
  const insights = {
    ...dimInsights,
    ...(newCustomerRate
      ? {
          newCustomerRate: {
            rate: formatPct(Math.round(newCustomerRate * 10) / 10),
            newCount: newCustomers,
            totalOrders: orders,
            deltaPct: m.newCustomerDelta ? formatPct(Math.round(Number(m.newCustomerDelta) * 10) / 10) : undefined,
          },
        }
      : {}),
  };

  const totalSpend = campaign.campaignCreators.reduce(
    (s, cc) => s + cc.cpsPerformances.reduce((a, p) => a + Number(p.spend), 0),
    0,
  );
  const kpis = [
    { label: 'Total Revenues', value: formatMoney(totalRevenue) },
    { label: 'Clicks', value: formatNum(clicks) },
    { label: 'Orders', value: formatNum(orders) },
    { label: 'New Customer Acquisition', value: formatNum(newCustomers), highlight: true },
    { label: 'AOV', value: formatMoney(aov) },
    ...(totalSpend > 0 ? [{ label: 'ROAS', value: formatRatio(totalRevenue / totalSpend) }] : []),
  ];

  return {
    header: {
      brand: { name: campaign.businessLine?.name ?? campaign.businessLineCode ?? 'Brand', logoText: (campaign.businessLine?.name ?? campaign.businessLineCode ?? 'brand').toLowerCase() },
      merchant: { name: campaign.advertiser?.name ?? campaign.advertiserName ?? 'Merchant', logoText: (campaign.advertiser?.name ?? campaign.advertiserName ?? 'M').slice(0, 2).toUpperCase() },
      period: { start: campaign.startDate, end: campaign.endDate, display: `${shortDate(campaign.startDate)} - ${shortDate(campaign.endDate)}, ${campaign.startDate.slice(0, 4)}` },
    },
    kpis,
    trend,
    publishers,
    insights: Object.keys(insights).length ? insights : undefined,
    actionable: [], // 由 narrative 填
  };
}
