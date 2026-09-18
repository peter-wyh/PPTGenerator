// analytics-derive.service.ts
// 分析数据读时派生：从订单中间层（OrderDailyStat）与订单商品行（CampaignOrderItem）
// 实时计算 analytics JSON 中可机器派生的块，与手录值合并（手录优先）。
//
// ★ 设计原则（与生成链 0911 裁决同源）：
//   1. 不落快照——派生值每次 GET 现算，订单再导入数字自动更新，不产生第二数据源。
//   2. 手录优先——analytics JSON 中已有非空手录值的块保持不动（宁存手录勿覆盖）。
//   3. 口径标注——每个派生块带 caliber 注记，消费方（编辑器/报告）可展示来源口径。
//   4. 数字真源 = OrderDailyStat（recomputeOrderStats 从订单表物化；
//      Revenue 口径 = commission，Lead 模式 saleAmount 恒为占位值不作为收入）。
//   5. 不可派生块（promotionOffers / competitors / mediaPlacements / insights 手录部分）
//      不在派生范围——库内无真源，保持手录或留白（宁缺勿假）。
import { prisma } from '../../prisma';
import { orderStatsService } from './order-stats.service';
import type {
  CampaignTrendPoint,
  CampaignWeeklyTrendPoint,
  CategoryPerformance,
  ProductPerformance,
  MarketPerformance,
} from '@mediakit/shared';

/** 派生块字段名（与 CampaignAnalytics 手录键一致）。 */
export const DERIVABLE_KEYS = [
  'trend', 'weeklyTrend', 'customerSplit', 'newCustomers',
  'topMarkets', 'topProducts', 'topCategories', 'aov',
] as const;
export type DerivableKey = (typeof DERIVABLE_KEYS)[number];

/** 派生结果：键 → 值 + 口径注记。 */
export interface DerivedBlock {
  value: CampaignTrendPoint[] | CampaignWeeklyTrendPoint[] | CampaignAnalyticsDeriveSplit | number | string | CategoryPerformance[] | ProductPerformance[] | MarketPerformance[] | undefined;
  caliber: string;
}

interface CampaignAnalyticsDeriveSplit {
  newCustomers: number;
  returningCustomers: number;
  newCustomerRate: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** 周趋势 rollup：7 天滚动分桶（对齐 web demo rollupWeekly 同口径）。 */
function rollupWeekly(trend: CampaignTrendPoint[]): CampaignWeeklyTrendPoint[] {
  const weeks: CampaignWeeklyTrendPoint[] = [];
  for (let i = 0; i < trend.length; i += 7) {
    const bucket = trend.slice(i, i + 7);
    const revenue = bucket.reduce((s, p) => s + p.revenue, 0);
    const spend = bucket.reduce((s: number, p) => s + p.spend, 0);
    const orders = bucket.reduce((s, p) => s + p.orders, 0);
    weeks.push({
      week: `W${weeks.length + 1}`,
      start: bucket[0].date,
      revenue: r2(revenue),
      spend: r2(spend),
      orders,
      roas: spend > 0 ? r2(revenue / spend) : 0,
    });
  }
  return weeks;
}

/** 格式化货币（整数千分位，无小数尾——报告展示口径）。 */
function fmtCurrency(n: number, cur = '$'): string {
  return cur + Math.round(n).toLocaleString('en-US');
}

/**
 * 派生可机器计算的 analytics 块。
 * 返回 null = 无订单中间层数据（未导入订单 / 未 recompute）——消费侧全部回落手录/留白。
 */
export async function deriveAnalytics(campaignId: string): Promise<Record<DerivableKey, DerivedBlock> | null> {
  const stats = await orderStatsService.getRange(campaignId);
  if (!stats || !stats.days.length) return null;

  // Campaign 币种（AOV/货币展示用；订单表无币种列，取 Campaign 级默认）
  const camp = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { name: true } });
  void camp; // 币种字段暂用 $（schema 无 campaign 级 currency；Trivago GBP 场景手录覆盖）

  // ── trend（日序列：revenue=commission 口径）──
  const trend: CampaignTrendPoint[] = stats.days.map((d) => ({
    date: d.date,
    revenue: d.commission,
    spend: d.commission, // CPS 口径：花费=佣金（无广告费维度）
    commission: d.commission,
    orders: d.orders,
    roas: 0,
  }));
  // roas = revenue / spend；CPS 口径下 spend=revenue → roas=1 恒定，对齐生成链（dailyTrend 仅 commission 维度）
  for (const p of trend) p.roas = p.spend > 0 ? r2(p.revenue / p.spend) : 0;

  // ── weeklyTrend ──
  const weeklyTrend = rollupWeekly(trend);

  // ── customerSplit / newCustomers ──
  // hasNewCustomerTag=false → 标签缺失（如 Awin 无该字段），newCustomers=N/A 而非 0
  const hasTag = stats.totals.hasNewCustomerTag;
  const split: CampaignAnalyticsDeriveSplit | null = hasTag
    ? {
        newCustomers: stats.totals.newCustomers,
        returningCustomers: stats.totals.orders - stats.totals.newCustomers,
        newCustomerRate: stats.totals.orders > 0
          ? `${Math.round((stats.totals.newCustomers / stats.totals.orders) * 1000) / 10}%`
          : '0%',
      }
    : null;

  // ── topMarkets（OrderDailyStat.topCountries 逐日 Top5 聚合为全期排行）──
  const byCountry = new Map<string, { orders: number; revenue: number }>();
  for (const d of stats.days) {
    for (const c of d.topCountries ?? []) {
      const cur = byCountry.get(c.country) ?? { orders: 0, revenue: 0 };
      cur.orders += c.orders;
      // ★ 真实行只有 {country, orders}（0917+ 落库版本无 commission 字段）——按全 campaign 日佣金比例分摊
      cur.revenue += Number(c.commission ?? 0);
      byCountry.set(c.country, cur);
    }
  }
  const countryOrders = [...byCountry.values()].reduce((s, v) => s + v.orders, 0);
  const perOrder = countryOrders > 0 ? stats.totals.commission / countryOrders : 0;
  const topMarkets: MarketPerformance[] = [...byCountry.entries()]
    .map(([name, v]) => {
      const revenue = v.revenue > 0 ? v.revenue : v.orders * perOrder; // 无 commission 字段时按单均佣金分摊
      return { name, revenue: fmtCurrency(revenue), share: countryOrders ? Math.round((v.orders / countryOrders) * 100) : 0 };
    })
    .sort((a, b) => (b.share ?? 0) - (a.share ?? 0))
    .slice(0, 10);

  // ── topProducts / topCategories（订单商品行聚合，全期）──
  const itemRows = await prisma.campaignOrderItem.findMany({
    where: { order: { campaignId } },
    select: { productName: true, category: true, qty: true, lineTotal: true, product: { select: { category: true } } },
  });
  const byProduct = new Map<string, { orders: number; qty: number; revenue: number; category?: string }>();
  const byCategory = new Map<string, { qty: number; revenue: number }>();
  for (const it of itemRows) {
    const cat = it.category ?? it.product?.category ?? undefined;
    const p = byProduct.get(it.productName) ?? { orders: 0, qty: 0, revenue: 0, category: cat };
    p.qty += it.qty;
    p.revenue += Number(it.lineTotal);
    if (!p.category && cat) p.category = cat;
    byProduct.set(it.productName, p);
    if (cat) {
      const c = byCategory.get(cat) ?? { qty: 0, revenue: 0 };
      c.qty += it.qty;
      c.revenue += Number(it.lineTotal);
      byCategory.set(cat, c);
    }
  }
  const catTotalRev = [...byCategory.values()].reduce((s, v) => s + v.revenue, 0);
  const topCategories: CategoryPerformance[] = [...byCategory.entries()]
    .map(([name, v]) => ({ name, revenue: fmtCurrency(v.revenue), share: catTotalRev ? Math.round((v.revenue / catTotalRev) * 1000) / 10 : 0 }))
    .sort((a, b) => (b.share ?? 0) - (a.share ?? 0))
    .slice(0, 10);
  const topProducts: ProductPerformance[] = [...byProduct.entries()]
    .map(([name, v]) => ({
      name,
      revenue: fmtCurrency(v.revenue),
      orders: String(v.qty),
      category: v.category,
    }))
    .sort((a, b) => Number(String(b.revenue).replace(/[$,]/g, '')) - Number(String(a.revenue).replace(/[$,]/g, '')))
    .slice(0, 10);

  // ── aov ──
  // 口径：Revenue=commission / 订单数。GMV 口径（saleAmount）Lead 模式为占位值不可用。
  const aov = stats.totals.orders > 0 ? fmtCurrency(stats.totals.commission / stats.totals.orders) : undefined;

  return {
    trend: { value: trend, caliber: '订单中间层按日聚合（revenue=佣金口径，UTC 日）' },
    weeklyTrend: { value: weeklyTrend, caliber: '日趋势 7 天分桶 rollup' },
    customerSplit: split
      ? { value: split, caliber: '订单 customerAcquisition=New 标签聚合；无标签期不入列' }
      : { value: undefined, caliber: '订单无新客标签（如 Awin 导出）——不可派生' },
    newCustomers: hasTag
      ? { value: stats.totals.newCustomers, caliber: '订单 customerAcquisition=New 单量合计' }
      : { value: undefined, caliber: '订单无新客标签——不可派生' },
    topMarkets: { value: topMarkets, caliber: '订单 customerCountry 聚合（佣金口径收入）' },
    topProducts: { value: topProducts, caliber: '订单商品行 qty×单价聚合（含未挂主档商品）' },
    topCategories: { value: topCategories, caliber: '商品行品类聚合（行级 category 优先，回落 Product 主档）' },
    aov: { value: aov, caliber: 'Σ佣金 / 订单数（Lead 模式 saleAmount 为占位值不用）' },
  } as Record<DerivableKey, DerivedBlock>;
}
