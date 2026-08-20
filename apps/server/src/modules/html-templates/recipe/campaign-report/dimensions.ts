// dimensions.ts
// recipe Insight & Analysis 四维度聚合:把 CpsPerformance 链接级维度标签
// 聚合成 schema 定义的 insights.topCategories/topProducts/topMarket/topPromotion。
// 纯函数,不查 DB,不依赖 tokens(颜色用固定调色板)。
import { formatMoney, formatNum } from '../format';

export type DimLink = {
  productName?: string | null;
  category?: string | null;
  market?: string | null;
  promoName?: string | null;
  promoType?: string | null;
  gmv: number;
  orders: number;
};

export type DimInsights = {
  topCategories?: { label: string; pct: number; color: string }[];
  topProducts?: { name: string; revenue: string }[];
  topMarket?: { country: string; revenue: string; pct: number; color: string }[];
  topPromotion?: { name: string; type: string; revenue: string; usage: string; tagKind: string }[];
};

/** 固定调色板(第一色对齐默认 brandPrimary #ff099e;不足循环)。 */
export const PALETTE = ['#ff099e', '#4f46e5', '#16a34a', '#d97706', '#0ea5e9', '#8b5cf6'];

/** promoType → 模板 tag CSS 后缀(对应 template.hbs 的 .tag-xxx)。 */
function mapTagKind(promoType?: string | null): string {
  const t = String(promoType ?? '').toLowerCase();
  if (t.includes('coupon')) return 'coupon';
  if (t.includes('bundle')) return 'bundle';
  if (t.includes('flash') || t.includes('deal')) return 'flash';
  if (t.includes('discount') || t.includes('sale')) return 'discount';
  return 'gift';
}

/** 按某维度键 group,累加 gmv/orders,保留组内第一个非空 promoType;按 gmv 降序。 */
function groupBy<K extends 'category' | 'productName' | 'market' | 'promoName'>(links: DimLink[], key: K) {
  const m = new Map<string, { gmv: number; orders: number; promoType?: string }>();
  for (const l of links) {
    const v = String(l[key] ?? '').trim();
    if (!v) continue;
    const cur = m.get(v) ?? { gmv: 0, orders: 0 };
    cur.gmv += l.gmv;
    cur.orders += l.orders;
    if (!cur.promoType && l.promoType) cur.promoType = String(l.promoType).trim();
    m.set(v, cur);
  }
  return [...m.entries()].map(([k, v]) => ({ key: k, ...v })).sort((a, b) => b.gmv - a.gmv);
}

export function aggregateDimensions(links: DimLink[]): DimInsights {
  // topCategories
  const cats = groupBy(links, 'category');
  const catTotal = cats.reduce((s, x) => s + x.gmv, 0);
  const topCategories = cats.length
    ? cats.map((x, i) => ({ label: x.key, pct: catTotal ? Math.round((x.gmv / catTotal) * 1000) / 10 : 0, color: PALETTE[i % PALETTE.length] }))
    : undefined;

  // topProducts(前 5)
  const prods = groupBy(links, 'productName');
  const topProducts = prods.length
    ? prods.slice(0, 5).map((x) => ({ name: x.key, revenue: formatMoney(x.gmv) }))
    : undefined;

  // topMarket
  const markets = groupBy(links, 'market');
  const mktTotal = markets.reduce((s, x) => s + x.gmv, 0);
  const topMarket = markets.length
    ? markets.map((x, i) => ({ country: x.key, revenue: formatMoney(x.gmv), pct: mktTotal ? Math.round((x.gmv / mktTotal) * 1000) / 10 : 0, color: PALETTE[i % PALETTE.length] }))
    : undefined;

  // topPromotion
  const promos = groupBy(links, 'promoName');
  const topPromotion = promos.length
    ? promos.map((x) => ({ name: x.key, type: x.promoType || '—', revenue: formatMoney(x.gmv), usage: formatNum(x.orders), tagKind: mapTagKind(x.promoType) }))
    : undefined;

  return { topCategories, topProducts, topMarket, topPromotion };
}
