// mapper.ts
import { prisma } from '../../../../prisma';
import { ApiError } from '../../../../utils/ApiError';
import { formatMoney, formatNum, formatPct, formatRatio } from '../format';
import { aggregateDimensions, type DimLink } from './dimensions';
import { computeCoverage } from './coverage';
import type { CampaignReportContent } from './schema';

type Any = Record<string, any>;

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
  const cvr = total.clicks ? (total.orders / total.clicks) * 100 : 0;

  // 3) KPI(结构同 mapCampaign 现有)
  const kpis = [
    { label: 'Total Revenues', value: formatMoney(total.gmv) },
    { label: 'Clicks', value: formatNum(total.clicks) },
    { label: 'Orders', value: formatNum(total.orders) },
    { label: 'Conversion Rate', value: formatPct(Math.round(cvr * 10) / 10) },
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
  // 7b) MoM:reportPeriod vs 前等长期间(仅当 reportPeriod 完整时算,否则 undefined)
  //     半开(只 startDate)时若回退 campaign.endDate 会让前等长窗口不对称→语义错,故 guard。
  let mom: { ordersMoM: string; salesMoM: string; currentOrders: number; previousOrders: number; currentSales: number; previousSales: number } | undefined;
  if (reportPeriod.startDate && reportPeriod.endDate) {
    const startD = new Date(reportPeriod.startDate);
    const endD = new Date(reportPeriod.endDate);
    const lenDays = Math.round((endD.getTime() - startD.getTime()) / 86_400_000) + 1; // 含,天数
    const preEndD = new Date(startD); preEndD.setDate(preEndD.getDate() - 1);
    const preStartD = new Date(preEndD); preStartD.setDate(preStartD.getDate() - (lenDays - 1));
    const pad = (n: number) => String(n).padStart(2, '0');
    const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const preStart = iso(preStartD);
    const preEnd = iso(preEndD);
    const inPre = (d: string) => d >= preStart && d <= preEnd;
    let preOrders = 0, preGmv = 0;
    for (const cc of campaign.campaignCreators ?? []) {
      for (const p of cc.cpsPerformances ?? []) {
        for (const d of (p.daily as Any[] | null | undefined) ?? []) {
          const date = String(d.date ?? '');
          if (!date || !inPre(date)) continue;
          preOrders += num(d.orders);
          preGmv += num(d.gmv);
        }
      }
    }
    const signedPct = (cur: number, prev: number) => {
      const v = Math.round(((cur - prev) / prev) * 1000) / 10;
      return `${v > 0 ? '+' : ''}${formatPct(v)}`;
    };
    mom = preOrders > 0 ? {
      ordersMoM: signedPct(total.orders, preOrders),
      salesMoM: signedPct(total.gmv, preGmv),
      currentOrders: total.orders, previousOrders: preOrders,
      currentSales: total.gmv, previousSales: preGmv,
    } : undefined;
  } else {
    mom = undefined;
  }

  const rate = total.orders ? (total.newCustomers / total.orders) * 100 : 0;
  const insights = {
    ...aggregateDimensions(dimLinks),
    ...(mom ? { mom } : {}),
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

  const header = {
    brand: { name: campaign.businessLine?.name ?? campaign.businessLineCode ?? 'Brand', logoText: (campaign.businessLine?.name ?? campaign.businessLineCode ?? 'brand').toLowerCase() },
    merchant: { name: campaign.advertiser?.name ?? campaign.advertiserName ?? 'Merchant', logoText: (campaign.advertiser?.name ?? campaign.advertiserName ?? 'M').slice(0, 2).toUpperCase() },
  };

  // ★ 宁缺勿假:daily 是唯一数字真源。coverage 决定呈现形态。
  const hasPeriod = !!(reportPeriod && (reportPeriod.startDate || reportPeriod.endDate));
  const cov = computeCoverage(campaign, hasPeriod ? { start: reportPeriod!.startDate, end: reportPeriod!.endDate } : undefined, campaign.endDate);
  const requested = {
    start: reportPeriod?.startDate ?? campaign.startDate,
    end: reportPeriod?.endDate ?? campaign.endDate,
  };
  const dataCoverage = { requested, ...cov };

  const emptyKpis = [{ label: 'No data for this period', value: '\u2014', highlight: false }];
  const emptyTrend = { labels: [] as string[], revenue: [] as number[], clicks: [] as number[], orders: [] as number[] };

  // 有 reportPeriod → 一律 daily 切片(有交集出真数,零交集空态;不再读 analytics 兜底)
  if (hasPeriod) {
    if (!cov.covered) {
      return {
        header: { ...header, period: { start: requested.start, end: requested.end, display: `${shortDate(requested.start)} - ${shortDate(requested.end)}, ${String(requested.start).slice(0, 4)}` } },
        kpis: emptyKpis, trend: emptyTrend, publishers: [], insights: undefined, actionable: [],
        dataCoverage,
      };
    }
    const { kpis, publishers, trend, period, insights } = mapFromDaily(campaign, reportPeriod!);
    return {
      header: { ...header, period }, kpis, trend, publishers,
      insights, actionable: [], dataCoverage,
    };
  }

  // 无 reportPeriod(汇总口径)→ metrics 有值才渲染(缺 → Metric unavailable);CPS 顶层真实汇总列保留。
  const m = (campaign.metrics ?? {}) as Any;
  const hasVal = (v: unknown) => v !== undefined && v !== null && v !== '' && !Number.isNaN(Number(v));
  const totalRevenue = hasVal(m.totalRevenue) ? Number(m.totalRevenue) : null;
  const clicks = hasVal(m.clicks) ? Number(m.clicks) : null;
  const orders = hasVal(m.orders) ? Number(m.orders) : null;
  const newCustomers = hasVal(m.newCustomers) ? Number(m.newCustomers) : null;
  const aov = hasVal(m.aov) ? Number(m.aov) : (orders && totalRevenue !== null ? totalRevenue / orders : null);
  const cvr = clicks && orders ? (orders / clicks) * 100 : null;

  const kpi = (label: string, v: number | null) => {
    if (v === null) return { label, value: 'Metric unavailable', highlight: false };
    const value =
      label === 'Total Revenues' || label === 'AOV' ? formatMoney(v) :
      label === 'Conversion Rate' ? formatPct(Math.round(v * 10) / 10) :
      formatNum(v);
    return { label, value, highlight: label === 'New Customer Acquisition' };
  };
  const kpis = [
    kpi('Total Revenues', totalRevenue),
    kpi('Clicks', clicks),
    kpi('Orders', orders),
    kpi('Conversion Rate', cvr),
    kpi('New Customer Acquisition', newCustomers),
    kpi('AOV', aov),
  ];

  // publishers + ROAS + 维度聚合:CPS 表顶层真实列(非 analytics)
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

  const totalSpend = campaign.campaignCreators.reduce(
    (s, cc) => s + cc.cpsPerformances.reduce((a, p) => a + Number(p.spend), 0), 0);
  if (totalSpend > 0 && totalRevenue !== null) {
    kpis.push({ label: 'ROAS', value: formatRatio(totalRevenue / totalSpend), highlight: false });
  }

  const dimLinks: DimLink[] = (campaign.campaignCreators ?? []).flatMap((cc: Any) =>
    (cc.cpsPerformances ?? []).map((p: Any) => ({
      productName: p.productName, category: p.category, market: p.market,
      promoName: p.promoName, promoType: p.promoType,
      gmv: Number(p.gmv) || 0, orders: Number(p.orders) || 0,
    })),
  );
  const dimInsights = dimLinks.length ? aggregateDimensions(dimLinks) : undefined;
  // newCustomerRate:metrics 有真实数值才算(不解析 analytics 字符串)
  const ncrRaw = hasVal(m.newCustomerRate) ? Number(m.newCustomerRate) : null;
  const insights = {
    ...(dimInsights ?? {}),
    ...(ncrRaw !== null && orders
      ? { newCustomerRate: { rate: formatPct(Math.round(ncrRaw * 10) / 10), newCount: newCustomers ?? 0, totalOrders: orders,
          ...(hasVal(m.newCustomerDelta) ? { deltaPct: formatPct(Math.round(Number(m.newCustomerDelta) * 10) / 10) } : {}) } }
      : {}),
  };

  return {
    header: { ...header, period: { start: campaign.startDate, end: campaign.endDate, display: `${shortDate(campaign.startDate)} - ${shortDate(campaign.endDate)}, ${String(campaign.startDate).slice(0, 4)}` } },
    kpis, trend: emptyTrend, publishers,
    insights: Object.keys(insights).length ? insights : undefined,
    actionable: [], dataCoverage,
  };
}
