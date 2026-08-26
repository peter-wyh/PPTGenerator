// mapper.ts
import { prisma } from '../../../../prisma';
import { ApiError } from '../../../../utils/ApiError';
import { formatMoney, formatNum, formatPct, formatRatio } from '../format';
import { aggregateDimensions, type DimLink, PALETTE } from './dimensions';
import { computeCoverage } from './coverage';
import { getRange, type OrderStatsRange } from '../../../campaigns/order-stats.service';
import { loadCreatorCps } from '../../cps-source';
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
async function mapFromDaily(
  campaign: Any,
  reportPeriod: { startDate?: string; endDate?: string },
  cpsSource: Awaited<ReturnType<typeof loadCreatorCps>>,
): Promise<{ kpis: CampaignReportContent['kpis']; publishers: CampaignReportContent['publishers']; trend: CampaignReportContent['trend']; period: CampaignReportContent['header']['period']; insights: CampaignReportContent['insights'] }> {
  const { startDate, endDate } = reportPeriod;
  const inPeriod = (d: string) => (!startDate || d >= startDate) && (!endDate || d <= endDate);

  // ★ 真源切换(cps-daily 废弃)：流量/成交每日来自 loadCreatorCps（LP 流量 + 订单表成交/新客）。
  //   维度标签 insights 保留读冻结的 cpsPerformances（存量标签数据 LP 无对应字段）。
  //   cpsSource 由 mapCampaign 统一加载传入（与 mapFromOrderStats 共享一次查询）。

  // 1) 每个创作者的期内 daily 求和
  type DailySum = { clicks: number; orders: number; gmv: number; newCustomers: number };
  // ★ clicks 缺失判定:期内 daily 记录从未出现 clicks key = 数据源缺失(渲染 Metric unavailable);
  //   有 key 值 0 = 真实 0。宁缺勿假。LP.daily 数组式每项都有 clicks 字段——cell.clicks>0 即真源存在;
  //   全 0 无法区分"LP 行存在但导入没带 clicks"与"没导 LP"——用行级判定兜底(dailyRowCount>0 = LP 真源在)。
  let clicksKeySeen = false;
  const perCreator: { cc: Any; sum: DailySum }[] = (campaign.campaignCreators ?? []).map((cc: Any) => {
    const sum: DailySum = { clicks: 0, orders: 0, gmv: 0, newCustomers: 0 };
    const e = cpsSource.byCc.get(cc.id);
    if (e) {
      for (const [date, cell] of e.daily) {
        if (!inPeriod(date)) continue;
        if (cell.clicks > 0 || cell.fromLp) clicksKeySeen = true;
        sum.clicks += cell.clicks;
        sum.orders += cell.orders;
        sum.gmv += cell.gmv;
        sum.newCustomers += cell.newCustomers;
      }
    }
    return { cc, sum };
  });
  // ★ clicks 回退聚合列:daily 无 clicks 键 + 报告周期完整覆盖 campaign 周期(口径一致才回退,全 0 不回退)
  let clicksFallback = false;
  if (!clicksKeySeen && cpsSource.dailyRowCount === 0) {
    const coversAll = (!startDate || !campaign.startDate || startDate <= campaign.startDate)
      && (!endDate || !campaign.endDate || endDate >= campaign.endDate);
    if (coversAll) {
      let aggTotal = 0;
      for (const e of perCreator) {
        const agg = cpsSource.byCc.get(e.cc.id)?.clicks ?? 0;
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

  // 5) trend:跨创作者按 date 分组(日粒度——campaign 级每日合并)
  const byDate = new Map<string, { revenue: number; clicks: number; orders: number }>();
  for (const [date, cell] of cpsSource.campaignDaily) {
    if (!inPeriod(date)) continue;
    byDate.set(date, { revenue: cell.gmv, clicks: cell.clicks, orders: cell.orders });
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

  // 7) insights(4 维度从冻结 cpsPerformances 链接级标签聚合——存量标签 LP 无对应字段,读旧表不丢;
  //    gmv/orders 改从 cpsSource 期内切片)
  const dimLinks: DimLink[] = [];
  for (const cc of campaign.campaignCreators ?? []) {
    const e = cpsSource.byCc.get(cc.id);
    if (!e) continue;
    let gmv = 0, orders = 0;
    for (const [date, cell] of e.daily) {
      if (!inPeriod(date)) continue;
      gmv += cell.gmv;
      orders += cell.orders;
    }
    if (gmv > 0 || orders > 0) {
      // 标签取该 creator 名下冻结 CPS 行的首个非空标签组（无标签则 undefined——维度聚合自动跳过）
      const tagged = (cc.cpsPerformances ?? []).find((p: Any) => p.productName || p.category || p.market || p.promoName || p.promoType);
      dimLinks.push({
        productName: tagged?.productName, category: tagged?.category, market: tagged?.market,
        promoName: tagged?.promoName, promoType: tagged?.promoType, gmv, orders,
      });
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
    for (const [, e] of cpsSource.byCc) {
      for (const [date, cell] of e.daily) {
        if (!inPre(date)) continue;
        preOrders += cell.orders;
        preGmv += cell.gmv;
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
  cpsSource: Awaited<ReturnType<typeof loadCreatorCps>>,
): { kpis: CampaignReportContent['kpis']; publishers: CampaignReportContent['publishers']; trend: CampaignReportContent['trend']; period: CampaignReportContent['header']['period']; insights: CampaignReportContent['insights'] } {
  const { startDate, endDate } = reportPeriod;
  const inPeriod = (d: string) => (!startDate || d >= startDate) && (!endDate || d <= endDate);

  // 1) 流量侧从 cpsSource（LP 流量 + 订单表成交/新客）；revenue/orders 以中间层为准
  const perCreatorClicks = new Map<string, number>();
  const clicksByDate = new Map<string, number>();
  let totalSpend = 0;
  let clicksKeySeen = false;
  for (const cc of campaign.campaignCreators ?? []) {
    const e = cpsSource.byCc.get(cc.id);
    let clicks = 0;
    if (e) {
      totalSpend += e.spend;
      for (const [date, cell] of e.daily) {
        if (!inPeriod(date)) continue;
        if (cell.clicks > 0) clicksKeySeen = true;
        clicks += cell.clicks;
        clicksByDate.set(date, (clicksByDate.get(date) ?? 0) + cell.clicks);
      }
    }
    perCreatorClicks.set(cc.id, clicks);
  }
  // ★ clicks 回退聚合列:daily 无 clicks 键但报告周期完整覆盖 campaign 生命周期时,
  //   回退 LP 聚合列（链接全周期汇总）。全 0 不回退。
  let clicksFallback = false;
  if (!clicksKeySeen) {
    const coversAll = (!startDate || !campaign.startDate || startDate <= campaign.startDate)
      && (!endDate || !campaign.endDate || endDate >= campaign.endDate);
    if (coversAll) {
      let aggTotal = 0;
      for (const cc of campaign.campaignCreators ?? []) {
        const agg = cpsSource.byCc.get(cc.id)?.clicks ?? 0;
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
      linkPerformances: true, // coverage 判定用（LP.daily 日期集合）
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
  // ★ 真源切换(cps-daily 废弃)：统一取数源（LP 流量 + 订单表成交/新客）
  //   （mapFromOrderStats / mapFromDaily 共享这一次查询）
  const cpsSource = await loadCreatorCps(campaignId);

  // 有 reportPeriod → 周期切片(中间层优先;有交集出真数,零交集空态;不读 analytics 兜底)
  if (hasPeriod) {
    // ★ edge:daily coverage 为空但中间层有数据 → 仍渲染订单侧(订单真源不被 daily 覆盖判定误杀)
    if (orderStats) {
      const { kpis, publishers, trend, period, insights } = mapFromOrderStats(campaign, orderStats, reportPeriod!, cpsSource);
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
    const { kpis, publishers, trend, period, insights } = await mapFromDaily(campaign, reportPeriod!, cpsSource);
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
  // ★ 汇总口径回退真源链(真源切换后=LP 聚合列/订单表现;全 0 视为无数据不回退):
  //   clicks→LP 聚合列;revenue/orders→订单表现合计(cpsSource);
  //   newCustomers 从订单表现合计(customerAcquisition='New' 计数)。
  const cpsAgg = {
    gmv: [...cpsSource.byCc.values()].reduce((s, e) => s + e.gmv, 0),
    orders: [...cpsSource.byCc.values()].reduce((s, e) => s + e.orders, 0),
    clicks: [...cpsSource.byCc.values()].reduce((s, e) => s + e.clicks, 0),
    newCustomers: [...cpsSource.byCc.values()].reduce((s, e) => s + e.newCustomers, 0),
  };
  // newCustomers daily 全覆盖判定(dates ⊇ [startDate,endDate] 才回退)
  const dailyDates = new Set(cpsSource.campaignDaily.keys());
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
  // newCustomers 回退(daily 全覆盖——口径:订单表现 New 客计数,与 daily 同源)
  if (newCustomers === null && fullCover) {
    const nc = cpsAgg.newCustomers;
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

  // publishers + ROAS + 维度聚合:数值走 cpsSource(LP 流量+订单表现);维度标签读冻结 CPS 行
  const publishers = campaign.campaignCreators.map((cc) => {
    const e = cpsSource.byCc.get(cc.id) ?? { clicks: 0, gmv: 0, orders: 0 };
    const partner = cc.creator?.partnerType ?? 'creator';
    const kind = partner === 'content_site' ? 'site' : partner === 'community' ? 'fb' : 'creator';
    const platform = cc.creator?.platform ?? campaign.platform;
    return {
      name: cc.creator?.name ?? 'Unknown',
      handle: cc.creator?.handle || undefined,
      type: { label: kind === 'creator' ? 'Creator' : kind === 'site' ? 'Site' : 'Community', kind: kind as any },
      screenshotUrl: `https://placehold.co/120x68/f5f7fa/1e1c24?text=${encodeURIComponent(platform)}`,
      revenue: formatMoney(e.gmv),
      clicks: formatNum(e.clicks),
      orders: formatNum(e.orders),
      linkUrl: cc.creator?.profileUrl || undefined,
    };
  });

  const totalSpend = [...cpsSource.byCc.values()].reduce((s, e) => s + e.spend, 0);
  if (totalSpend > 0 && totalRevenue !== null) {
    kpis.push({ label: 'ROAS', value: formatRatio(totalRevenue / totalSpend), highlight: false });
  }

  // 维度标签:冻结 CPS 行链接级标签(gmv/orders 挂 CPS 顶层存量——历史导入口径,不再更新)
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
