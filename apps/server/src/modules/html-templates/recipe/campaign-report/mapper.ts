// mapper.ts
import { prisma } from '../../../../prisma';
import { ApiError } from '../../../../utils/ApiError';
import { formatMoney, formatNum, formatPct, formatRatio } from '../format';
import { aggregateDimensions, type DimLink, PALETTE } from './dimensions';
import { computeCoverage } from './coverage';
import { getRange, type OrderStatsRange } from '../../../campaigns/order-stats.service';
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
  // ★ clicks 缺失判定:期内 daily 记录从未出现 clicks key = 数据源缺失(渲染 Metric unavailable);
  //   有 key 值 0 = 真实 0。宁缺勿假。
  let clicksKeySeen = false;
  const perCreator: { cc: Any; sum: DailySum }[] = (campaign.campaignCreators ?? []).map((cc: Any) => {
    const sum: DailySum = { clicks: 0, orders: 0, gmv: 0, newCustomers: 0 };
    for (const p of cc.cpsPerformances ?? []) {
      for (const d of (p.daily as Any[] | null | undefined) ?? []) {
        const date = String(d.date ?? '');
        if (!date || !inPeriod(date)) continue;
        if ('clicks' in d) clicksKeySeen = true;
        sum.clicks += num(d.clicks);
        sum.orders += num(d.orders);
        sum.gmv += num(d.gmv);
        sum.newCustomers += num(d.newCustomers);
      }
    }
    return { cc, sum };
  });
  // ★ clicks 回退聚合列:daily 无 clicks 键 + 报告周期完整覆盖 campaign 周期(口径一致才回退,全 0 不回退)
  let clicksFallback = false;
  if (!clicksKeySeen) {
    const coversAll = (!startDate || !campaign.startDate || startDate <= campaign.startDate)
      && (!endDate || !campaign.endDate || endDate >= campaign.endDate);
    if (coversAll) {
      let aggTotal = 0;
      for (const e of perCreator) {
        const agg = (e.cc.cpsPerformances ?? []).reduce((s: number, p: Any) => s + num(p.clicks), 0);
        if (agg > 0) { e.sum.clicks = agg; aggTotal += agg; }
      }
      if (aggTotal > 0) clicksFallback = true;
    }
  }

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
    // ★ clicks 数据源缺失 → Metric unavailable(不编造 0);CVR 同理不可算。
    //   clicksFallback=true 时聚合列回退生效,正常出数(真源:链接全周期汇总)。
    { label: 'Clicks', value: (clicksKeySeen || clicksFallback) ? formatNum(total.clicks) : 'Metric unavailable' },
    { label: 'Orders', value: formatNum(total.orders) },
    { label: 'Conversion Rate', value: (clicksKeySeen || clicksFallback) ? formatPct(Math.round(cvr * 10) / 10) : 'Metric unavailable' },
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
    // ★ 回退聚合列时只有全周期总量、无日级分布——趋势图同样不画 Clicks 线(不编造日级形状)
    hasClicks: clicksKeySeen,
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

/**
 * ★ 订单中间层口径(OrderDailyStat 为真源):revenue/orders 来自订单表日级统计,
 * clicks 保持 daily(中间层无此维度);newCustomers 仅当 customerAcquisition 有标签
 * (hasNewCustomerTag)才输出,否则 'Metric unavailable' 且不输出 newCustomerRate。
 * 结构与 mapFromDaily 同构,可独立测试。纯函数,不查 DB。
 */
function mapFromOrderStats(
  campaign: Any,
  orderStats: OrderStatsRange,
  reportPeriod: { startDate?: string; endDate?: string },
): { kpis: CampaignReportContent['kpis']; publishers: CampaignReportContent['publishers']; trend: CampaignReportContent['trend']; period: CampaignReportContent['header']['period']; insights: CampaignReportContent['insights'] } {
  const { startDate, endDate } = reportPeriod;
  const inPeriod = (d: string) => (!startDate || d >= startDate) && (!endDate || d <= endDate);
  const num = (v: unknown) => Number(v) || 0;

  // 1) daily 侧只取 clicks / spend / 维度标签(revenue/orders 以中间层为准)
  const perCreatorClicks = new Map<string, number>();
  const clicksByDate = new Map<string, number>();
  let totalSpend = 0;
  // ★ clicks 缺失判定:期内 daily 从未出现 clicks key = 数据源缺失
  let clicksKeySeen = false;
  for (const cc of campaign.campaignCreators ?? []) {
    let clicks = 0;
    for (const p of cc.cpsPerformances ?? []) {
      totalSpend += num(p.spend);
      for (const d of (p.daily as Any[] | null | undefined) ?? []) {
        const date = String(d.date ?? '');
        if (!date || !inPeriod(date)) continue;
        if ('clicks' in d) clicksKeySeen = true;
        clicks += num(d.clicks);
        clicksByDate.set(date, (clicksByDate.get(date) ?? 0) + num(d.clicks));
      }
    }
    perCreatorClicks.set(cc.id, clicks);
  }
  // ★ clicks 回退聚合列:daily 无 clicks 键(日级导入通道未写入)但报告周期完整覆盖
  //   campaign 生命周期时,回退 CpsPerformance 顶层聚合列(importCpsPerformance 导入的
  //   链接全周期汇总,真源为 Awin Click References 等)。聚合列是全周期口径——
  //   周期切片不满足全覆盖时口径不符,不回退;全 0 视为无数据,不回退。
  let clicksFallback = false;
  if (!clicksKeySeen) {
    const coversAll = (!startDate || !campaign.startDate || startDate <= campaign.startDate)
      && (!endDate || !campaign.endDate || endDate >= campaign.endDate);
    if (coversAll) {
      let aggTotal = 0;
      for (const cc of campaign.campaignCreators ?? []) {
        const agg = (cc.cpsPerformances ?? []).reduce((s: number, p: Any) => s + num(p.clicks), 0);
        if (agg > 0) { perCreatorClicks.set(cc.id, agg); aggTotal += agg; }
      }
      if (aggTotal > 0) clicksFallback = true;
    }
  }
  const totalClicks = [...perCreatorClicks.values()].reduce((s, x) => s + x, 0);

  // 2) KPI:中间层 totals + daily clicks
  const ot = orderStats.totals;
  const aov = ot.orders ? ot.commission / ot.orders : 0;
  const cvr = totalClicks ? (ot.orders / totalClicks) * 100 : 0;
  const kpis = [
    { label: 'Total Revenues', value: formatMoney(ot.commission) },
    // ★ clicks 数据源缺失 → Metric unavailable(不编造 0);CVR 同理不可算。
    //   clicksFallback=true 时聚合列回退生效,clicks/CVR 正常出数(真源:链接汇总)。
    { label: 'Clicks', value: (clicksKeySeen || clicksFallback) ? formatNum(totalClicks) : 'Metric unavailable' },
    { label: 'Orders', value: formatNum(ot.orders) },
    { label: 'Conversion Rate', value: (clicksKeySeen || clicksFallback) ? formatPct(Math.round(cvr * 10) / 10) : 'Metric unavailable' },
    // ★ 标签缺失 = 概念不适用 → 'Metric unavailable'(沿用 mapCampaign 汇总分支先例),不编造 0
    { label: 'New Customer Acquisition', value: ot.hasNewCustomerTag ? formatNum(ot.newCustomers) : 'Metric unavailable', highlight: true },
    { label: 'AOV', value: formatMoney(aov) },
    ...(ot.approvedOrders > 0 ? [{ label: 'Approved Orders', value: formatNum(ot.approvedOrders), highlight: false }] : []),
    ...(ot.pendingOrders > 0 ? [{ label: 'Pending Orders', value: formatNum(ot.pendingOrders), highlight: false }] : []),
    ...(totalSpend > 0 ? [{ label: 'ROAS', value: formatRatio(ot.commission / totalSpend), highlight: false }] : []),
  ];

  // 3) publishers:revenue/orders 从 byCreator,clicks 从 daily
  const publishers = (campaign.campaignCreators ?? []).map((cc: Any) => {
    const oc = orderStats.byCreator.get(cc.id) ?? { orders: 0, commission: 0 };
    const partner = cc.creator?.partnerType ?? 'creator';
    const kind = partner === 'content_site' ? 'site' : partner === 'community' ? 'fb' : 'creator';
    const platform = cc.creator?.platform ?? campaign.platform;
    return {
      name: cc.creator?.name ?? 'Unknown',
      handle: cc.creator?.handle || undefined,
      type: { label: kind === 'creator' ? 'Creator' : kind === 'site' ? 'Site' : 'Community', kind: kind as any },
      screenshotUrl: `https://placehold.co/120x68/f5f7fa/1e1c24?text=${encodeURIComponent(platform)}`,
      revenue: formatMoney(oc.commission),
      clicks: formatNum(perCreatorClicks.get(cc.id) ?? 0),
      orders: formatNum(oc.orders),
      linkUrl: cc.creator?.profileUrl || undefined,
    };
  }).filter((p: any) => p.revenue !== '$0' || p.orders !== '0' || p.clicks !== '0');

  // 4) trend:revenue/orders 从中间层 days,clicks 从 daily(日期并集,缺侧 0)
  //    ★ clicks 无数据源(clicksKeySeen=false 且聚合列回退不满足)→ hasClicks=false,
  //      模板不渲染 Clicks 折线——0 序列会画成贴地零线,与 KPI 总量自相矛盾。
  const dates = [...new Set([...orderStats.days.map((d) => d.date), ...clicksByDate.keys()])].sort();
  const trend = {
    labels: dates,
    revenue: dates.map((d) => orderStats.days.find((x) => x.date === d)?.commission ?? 0),
    clicks: dates.map((d) => clicksByDate.get(d) ?? 0),
    orders: dates.map((d) => orderStats.days.find((x) => x.date === d)?.orders ?? 0),
    // ★ 回退聚合列时只有全周期总量、无日级分布——趋势图同样不画 Clicks 线(不编造日级形状)
    hasClicks: clicksKeySeen,
  };

  // 5) period
  const start = reportPeriod.startDate ?? campaign.startDate;
  const end = reportPeriod.endDate ?? campaign.endDate;
  const period = { start, end, display: `${shortDate(start)} - ${shortDate(end)}, ${String(start).slice(0, 4)}` };

  // 6) insights:topMarket ← 中间层 topCountries(区间合并 Top5);newCustomerRate 仅标签可用时输出
  const byCountry = new Map<string, { orders: number; commission: number }>();
  for (const d of orderStats.days) {
    for (const c of d.topCountries) {
      const cur = byCountry.get(c.country) ?? { orders: 0, commission: 0 };
      cur.orders += c.orders;
      cur.commission += Number(c.commission) || 0;
      byCountry.set(c.country, cur);
    }
  }
  const ctyTotal = [...byCountry.values()].reduce((s, x) => s + x.orders, 0);
  const topMarket = byCountry.size
    ? [...byCountry.entries()]
        .map(([country, v], i) => ({ country, revenue: formatMoney(v.commission), pct: ctyTotal ? Math.round((v.orders / ctyTotal) * 1000) / 10 : 0, color: PALETTE[i % PALETTE.length] }))
        .sort((a, b) => b.pct - a.pct)
    : undefined;

  // 6b) 设备维度:clickDevice 订单分布(区间合并 Top5,pct = 占订单比)
  const byDevice = new Map<string, number>();
  for (const d of orderStats.days) {
    for (const dv of d.topDevices) {
      byDevice.set(dv.device, (byDevice.get(dv.device) ?? 0) + dv.orders);
    }
  }
  const devTotal = [...byDevice.values()].reduce((s, x) => s + x, 0);
  const topDevices = byDevice.size
    ? [...byDevice.entries()]
        .map(([device, orders]) => ({ device, orders, pct: devTotal ? Math.round((orders / devTotal) * 1000) / 10 : 0 }))
        .sort((a, b) => b.orders - a.orders)
    : undefined;

  const insights = {
    ...(topMarket ? { topMarket } : {}),
    ...(topDevices ? { topDevices } : {}),
    ...(ot.hasNewCustomerTag
      ? { newCustomerRate: { rate: formatPct(Math.round((ot.newCustomers / Math.max(ot.orders, 1)) * 1000) / 10), newCount: ot.newCustomers, totalOrders: ot.orders } }
      : {}),
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
    brand: { name: campaign.businessLine?.title || campaign.businessLine?.code || campaign.businessLineCode || 'Brand', logoText: (campaign.businessLine?.title || campaign.businessLine?.code || campaign.businessLineCode || 'brand').toLowerCase() },
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

  // ★ 订单中间层(OrderDailyStat):订单表为真源。有行 → revenue/orders 换中间层,
  //   clicks 保持 daily;无行(null)→ 走 mapFromDaily 老路(旧 campaign 降级)。
  let orderStats: OrderStatsRange | null = null;
  try {
    orderStats = await getRange(campaignId, reportPeriod?.startDate, reportPeriod?.endDate);
  } catch {
    orderStats = null;
  }

  // 有 reportPeriod → 周期切片(中间层优先;有交集出真数,零交集空态;不读 analytics 兜底)
  if (hasPeriod) {
    // ★ edge:daily coverage 为空但中间层有数据 → 仍渲染订单侧(订单真源不被 daily 覆盖判定误杀)
    if (orderStats) {
      const { kpis, publishers, trend, period, insights } = mapFromOrderStats(campaign, orderStats, reportPeriod!);
      return {
        header: { ...header, period }, kpis, trend, publishers,
        insights, actionable: [], dataCoverage,
      };
    }
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

  // 无 reportPeriod(汇总口径)→ metrics 有值才渲染(缺 → 回退真源,仍缺 → Metric unavailable)。
  const m = (campaign.metrics ?? {}) as Any;
  const hasVal = (v: unknown) => v !== undefined && v !== null && v !== '' && !Number.isNaN(Number(v));
  let totalRevenue = hasVal(m.totalRevenue) ? Number(m.totalRevenue) : null;
  let clicks = hasVal(m.clicks) ? Number(m.clicks) : null;
  let orders = hasVal(m.orders) ? Number(m.orders) : null;
  let newCustomers = hasVal(m.newCustomers) ? Number(m.newCustomers) : null;
  let cvr = clicks !== null && orders !== null && clicks > 0 ? (orders / clicks) * 100 : null;
  let aov = hasVal(m.aov) ? Number(m.aov) : null;
  // ★ 汇总口径回退真源链(聚合列=链接全周期汇总,口径天然一致;全 0 视为无数据不回退):
  //   revenue→gmv, orders→orders, clicks→clicks;newCustomers 只从 daily 合计且回退前须 100% 日期覆盖
  //   (聚合列无 newCustomers 维度,daily 部分覆盖时合计非全周期真值——宁缺勿假)。
  const cpsAgg = (campaign.campaignCreators ?? []).reduce(
    (s: { gmv: number; orders: number; clicks: number }, cc: Any) => {
      const r = (cc.cpsPerformances ?? []).reduce(
        (a: { gmv: number; orders: number; clicks: number }, p: Any) => ({
          gmv: a.gmv + (Number(p.gmv) || 0), orders: a.orders + (Number(p.orders) || 0), clicks: a.clicks + (Number(p.clicks) || 0),
        }), { gmv: 0, orders: 0, clicks: 0 });
      return { gmv: s.gmv + r.gmv, orders: s.orders + r.orders, clicks: s.clicks + r.clicks };
    }, { gmv: 0, orders: 0, clicks: 0 });
  // newCustomers daily 全覆盖判定(dates ⊇ [startDate,endDate] 才回退)
  const dailyAll = (campaign.campaignCreators ?? []).flatMap((cc: Any) => (cc.cpsPerformances ?? []).flatMap((p: Any) => (p.daily as Any[]) ?? []));
  const dailyDates = new Set(dailyAll.map((d: Any) => String(d.date ?? '')));
  const fullCover = (() => {
    if (!campaign.startDate || !campaign.endDate) return false;
    const days = Math.round((new Date(campaign.endDate).getTime() - new Date(campaign.startDate).getTime()) / 86400000) + 1;
    if (days <= 0 || dailyDates.size < days) return false;
    for (let t = new Date(campaign.startDate).getTime(); t <= new Date(campaign.endDate).getTime(); t += 86400000) {
      if (!dailyDates.has(new Date(t).toISOString().slice(0, 10))) return false;
    }
    return true;
  })();
  // clicks 回退(聚合列)
  if (clicks === null && cpsAgg.clicks > 0) clicks = cpsAgg.clicks;
  // ★ metrics 全空 + 聚合列有值 → revenue/orders 同步回退(同一次导入的完整镜像)
  if (totalRevenue === null && cpsAgg.gmv > 0) totalRevenue = cpsAgg.gmv;
  if (orders === null && cpsAgg.orders > 0) orders = cpsAgg.orders;
  // newCustomers 回退(daily 全覆盖)
  if (newCustomers === null && fullCover) {
    const nc = dailyAll.reduce((s: number, d: Any) => s + (Number(d.newCustomers) || 0), 0);
    if (nc > 0) newCustomers = nc;
  }
  // 回退后重算派生指标(aov/cvr)
  if (aov === null && orders !== null && orders > 0 && totalRevenue !== null) aov = totalRevenue / orders;
  cvr = clicks !== null && orders !== null && clicks > 0 ? (orders / clicks) * 100 : null;

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
      (a, p) => ({ clicks: a.clicks + (Number(p.clicks) || 0), orders: a.orders + (Number(p.orders) || 0), gmv: a.gmv + (Number(p.gmv) || 0) }),
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
    (s, cc) => s + cc.cpsPerformances.reduce((a, p) => a + (Number(p.spend) || 0), 0), 0);
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
