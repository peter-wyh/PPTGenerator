/**
 * Product mock data (demo) — deterministic CPS engine.
 *
 * 商品 CPS 数据从 campaign 引擎推导（campaignRawTotals），保持与达人投放数据自洽：
 *   - Campaign GMV / Clicks / Orders 按商品权重分配到每个商品
 *   - Commission = GMV × campaign commissionPct
 *   - Spend = Commission × 1.08（平台服务费 8%）
 *   - ROAS / CVR 由分配后的数值确定性算出
 *
 * 商品权重（GMV share）由 ProductSeed.gmvWeight 决定（确定性，无 RNG）。
 * 同输入 → 同输出，便于回归与截图。
 */
import type { Product } from '@mediaket/shared';
import { formatMoney, DEFAULT_FORMAT } from '@mediaket/shared';
import { campaignRawTotals, type CampaignRawTotals } from './creatorPerformance';

/* ------------------------------ Product seeds (static catalog) ------------------------------ */

/** 商品静态信息（不含 CPS 数据，CPS 由引擎推导）。 */
interface ProductSeed {
  id: string;
  name: string;
  image: string;
  price: string;
  originalPrice?: string;
  advertiser: string;
  businessLine: string;
  category: string;
  /**
   * GMV 权重（相对值）：决定该商品在 Campaign 总 GMV 中占多少份额。
   * 爆款 > 主力 > 长尾。同一 advertiser 下所有商品的权重和无需归一化（引擎自动归一）。
   */
  gmvWeight: number;
  /** 点击吸引率（相对值）：高曝光低价品点击多。影响 clicks 分配。 */
  clickWeight: number;
  /** 状态：部分商品可能售罄。 */
  status?: 'active' | 'paused' | 'sold-out';
}

/** Campaign → advertiser 映射（与 campaigns.ts 一致）。 */
const CAMPAIGN_ADVERTISER: Record<string, string> = {
  'camp-glowlab-q4': 'GlowLab',
  'camp-lumiere-launch': 'LUMIÈRE',
  'camp-nova-home-618': 'NOVA Home',
  'camp-motion-spring': 'MOTION',
  'camp-everyday-bf': 'EVERYDAY',
  'camp-wander-summer': 'WANDER',
};

/** 颜色映射（placehold.co 图片用）。 */
const ADVERTISER_COLOR: Record<string, string> = {
  GlowLab: '2563eb',
  'LUMIÈRE': '1e293b',
  'NOVA Home': '475569',
  MOTION: 'dc2626',
  EVERYDAY: '65a30d',
  WANDER: '0d9488',
};

const ph = (advertiser: string, text: string): string =>
  `https://placehold.co/200x200/${ADVERTISER_COLOR[advertiser] ?? '666666'}/ffffff?text=${text}`;

/** 商品目录（6 advertisers × 3-4 products each = 20 products）。 */
const PRODUCT_SEEDS: ProductSeed[] = [
  // ── GlowLab (FT) ──
  { id: 'p-gl-001', name: 'GlowLab Sensitive Skin Serum 30ml', image: ph('GlowLab', 'Serum'), price: '$48.00', originalPrice: '$68.00', advertiser: 'GlowLab', businessLine: 'FT', category: 'Skincare', gmvWeight: 0.42, clickWeight: 0.38, status: 'active' },
  { id: 'p-gl-002', name: 'GlowLab Gentle Cleanser 150ml', image: ph('GlowLab', 'Cleanser'), price: '$28.00', advertiser: 'GlowLab', businessLine: 'FT', category: 'Skincare', gmvWeight: 0.30, clickWeight: 0.34, status: 'active' },
  { id: 'p-gl-003', name: 'GlowLab Vitamin C Brightening Mask', image: ph('GlowLab', 'Mask'), price: '$35.00', originalPrice: '$45.00', advertiser: 'GlowLab', businessLine: 'FT', category: 'Skincare', gmvWeight: 0.18, clickWeight: 0.18, status: 'active' },
  { id: 'p-gl-004', name: 'GlowLab Sunscreen SPF50+ 50ml', image: ph('GlowLab', 'SPF'), price: '$32.00', advertiser: 'GlowLab', businessLine: 'FT', category: 'Skincare', gmvWeight: 0.10, clickWeight: 0.10, status: 'active' },

  // ── LUMIÈRE (SM) ──
  { id: 'p-lu-001', name: 'LUMIÈRE Anti-Aging Cream 50ml', image: ph('LUMIÈRE', 'Cream'), price: '$128.00', originalPrice: '$168.00', advertiser: 'LUMIÈRE', businessLine: 'SM', category: 'Skincare', gmvWeight: 0.48, clickWeight: 0.32, status: 'active' },
  { id: 'p-lu-002', name: 'LUMIÈRE Rose Essence Toner 200ml', image: ph('LUMIÈRE', 'Toner'), price: '$78.00', advertiser: 'LUMIÈRE', businessLine: 'SM', category: 'Skincare', gmvWeight: 0.26, clickWeight: 0.30, status: 'active' },
  { id: 'p-lu-003', name: 'LUMIÈRE Eye Lift Serum 15ml', image: ph('LUMIÈRE', 'Eye'), price: '$95.00', originalPrice: '$120.00', advertiser: 'LUMIÈRE', businessLine: 'SM', category: 'Skincare', gmvWeight: 0.16, clickWeight: 0.20, status: 'active' },
  { id: 'p-lu-004', name: 'LUMIÈRE Luxury Gift Set', image: ph('LUMIÈRE', 'Gift'), price: '$220.00', advertiser: 'LUMIÈRE', businessLine: 'SM', category: 'Gift Set', gmvWeight: 0.10, clickWeight: 0.18, status: 'paused' },

  // ── NOVA Home (CX) ──
  { id: 'p-nv-001', name: 'NOVA Aroma Diffuser Pro', image: ph('NOVA Home', 'Diffuser'), price: '$59.00', originalPrice: '$79.00', advertiser: 'NOVA Home', businessLine: 'CX', category: 'Home Goods', gmvWeight: 0.40, clickWeight: 0.30, status: 'active' },
  { id: 'p-nv-002', name: 'NOVA LED Strip Light 5m', image: ph('NOVA Home', 'LED'), price: '$32.00', advertiser: 'NOVA Home', businessLine: 'CX', category: 'Home Goods', gmvWeight: 0.28, clickWeight: 0.38, status: 'active' },
  { id: 'p-nv-003', name: 'NOVA Minimalist Desk Lamp', image: ph('NOVA Home', 'Lamp'), price: '$45.00', advertiser: 'NOVA Home', businessLine: 'CX', category: 'Home Goods', gmvWeight: 0.20, clickWeight: 0.18, status: 'active' },
  { id: 'p-nv-004', name: 'NOVA Smart Plant Pot', image: ph('NOVA Home', 'Pot'), price: '$28.00', advertiser: 'NOVA Home', businessLine: 'CX', category: 'Home Goods', gmvWeight: 0.12, clickWeight: 0.14, status: 'sold-out' },

  // ── MOTION (DG) ──
  { id: 'p-mo-001', name: 'MOTION Pro Running Shoes', image: ph('MOTION', 'Shoes'), price: '$89.00', originalPrice: '$120.00', advertiser: 'MOTION', businessLine: 'DG', category: 'Sports Gear', gmvWeight: 0.46, clickWeight: 0.30, status: 'active' },
  { id: 'p-mo-002', name: 'MOTION Quick-Dry Sports T-Shirt', image: ph('MOTION', 'Tee'), price: '$24.00', advertiser: 'MOTION', businessLine: 'DG', category: 'Sports Apparel', gmvWeight: 0.24, clickWeight: 0.36, status: 'active' },
  { id: 'p-mo-003', name: 'MOTION Wireless Sport Earbuds', image: ph('MOTION', 'Earbuds'), price: '$59.00', originalPrice: '$79.00', advertiser: 'MOTION', businessLine: 'DG', category: 'Sports Gear', gmvWeight: 0.18, clickWeight: 0.20, status: 'active' },
  { id: 'p-mo-004', name: 'MOTION Yoga Mat Premium', image: ph('MOTION', 'Yoga'), price: '$35.00', advertiser: 'MOTION', businessLine: 'DG', category: 'Sports Gear', gmvWeight: 0.12, clickWeight: 0.14, status: 'active' },

  // ── EVERYDAY (KN) ──
  { id: 'p-ev-001', name: 'EVERYDAY Ceramic Mug Set (4-pack)', image: ph('EVERYDAY', 'Mugs'), price: '$36.00', originalPrice: '$48.00', advertiser: 'EVERYDAY', businessLine: 'KN', category: 'Kitchen', gmvWeight: 0.38, clickWeight: 0.28, status: 'active' },
  { id: 'p-ev-002', name: 'EVERYDAY Bamboo Cutting Board', image: ph('EVERYDAY', 'Board'), price: '$22.00', advertiser: 'EVERYDAY', businessLine: 'KN', category: 'Kitchen', gmvWeight: 0.26, clickWeight: 0.34, status: 'active' },
  { id: 'p-ev-003', name: 'EVERYDAY Stainless Steel Lunch Box', image: ph('EVERYDAY', 'Lunch'), price: '$28.00', advertiser: 'EVERYDAY', businessLine: 'KN', category: 'Kitchen', gmvWeight: 0.22, clickWeight: 0.22, status: 'active' },
  { id: 'p-ev-004', name: 'EVERYDAY French Press Coffee Maker', image: ph('EVERYDAY', 'Press'), price: '$32.00', originalPrice: '$42.00', advertiser: 'EVERYDAY', businessLine: 'KN', category: 'Kitchen', gmvWeight: 0.14, clickWeight: 0.16, status: 'active' },

  // ── WANDER (DM) ──
  { id: 'p-wa-001', name: 'WANDER Travel Backpack 40L', image: ph('WANDER', 'Backpack'), price: '$75.00', originalPrice: '$99.00', advertiser: 'WANDER', businessLine: 'DM', category: 'Travel Gear', gmvWeight: 0.44, clickWeight: 0.28, status: 'active' },
  { id: 'p-wa-002', name: 'WANDER Portable Water Filter', image: ph('WANDER', 'Filter'), price: '$45.00', advertiser: 'WANDER', businessLine: 'DM', category: 'Outdoor', gmvWeight: 0.24, clickWeight: 0.22, status: 'sold-out' },
  { id: 'p-wa-003', name: 'WANDER Packing Cubes Set (5pcs)', image: ph('WANDER', 'Cubes'), price: '$32.00', advertiser: 'WANDER', businessLine: 'DM', category: 'Travel Gear', gmvWeight: 0.18, clickWeight: 0.28, status: 'active' },
  { id: 'p-wa-004', name: 'WANDER Neck Pillow Memory Foam', image: ph('WANDER', 'Pillow'), price: '$25.00', originalPrice: '$35.00', advertiser: 'WANDER', businessLine: 'DM', category: 'Travel Gear', gmvWeight: 0.14, clickWeight: 0.22, status: 'active' },
];

/* ------------------------------ Formatting ------------------------------ */

const money = (n: number): string => formatMoney(n, DEFAULT_FORMAT);
const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');
const pct2 = (n: number): string => `${n.toFixed(2)}%`;

/** 从价格字符串提取数值（"$48.00" → 48）。 */
function priceToNum(price: string): number {
  return parseFloat(price.replace(/[^0-9.]/g, '')) || 0;
}

/* ------------------------------ CPS engine ------------------------------ */

/**
 * 从 Campaign 原始汇总推导商品 CPS 数据。
 *
 * 分配逻辑：
 *   GMV_share = product.gmvWeight / Σ(all products' gmvWeight)
 *   GMV_i = campaign.gmv × GMV_share_i
 *   Clicks_i = campaign.clicks × (product.clickWeight / Σ clickWeights)
 *   Orders_i = round(GMV_i / price_i)   ← 用商品实际价格反推订单数
 *   Commission_i = GMV_i × campaign.commissionPct
 *   Spend_i = Commission_i × 1.08
 *   ROAS_i = GMV_i / Spend_i
 *   CVR_i = Orders_i / Clicks_i
 */
function buildProductCps(seed: ProductSeed, totals: CampaignRawTotals): Product {
  const gmv = Math.round(totals.gmv * seed.gmvWeight);
  const clicks = Math.round(totals.clicks * seed.clickWeight);
  const priceNum = priceToNum(seed.price);
  const orders = priceNum > 0 ? Math.round(gmv / priceNum) : Math.round(gmv / totals.aov);
  const commission = Math.round(gmv * totals.commissionPct);
  const spend = Math.round(commission * 1.08);
  const roas = spend > 0 ? gmv / spend : 0;
  const cvr = clicks > 0 ? (orders / clicks) * 100 : 0;

  return {
    id: seed.id,
    name: seed.name,
    image: seed.image,
    price: seed.price,
    ...(seed.originalPrice ? { originalPrice: seed.originalPrice } : {}),
    advertiser: seed.advertiser,
    businessLine: seed.businessLine,
    category: seed.category,
    gmv: money(gmv),
    orders: fmt(orders),
    clicks: fmt(clicks),
    cvr: pct2(cvr),
    roas: `${roas.toFixed(2)}x`,
    commission: money(commission),
    spend: money(spend),
    status: seed.status ?? 'active',
  };
}

/* ------------------------------ Public API ------------------------------ */

/** 所有商品（CPS 数据使用默认 campaign 推导，无 campaign 时用 advertiser 匹配）。 */
export const MOCK_PRODUCTS: Product[] = [];

/** 按 campaignId 获取关联商品（确定性 CPS 数据，与达人投放自洽）。 */
export function productsByCampaign(campaignId: string): Product[] {
  const advertiser = CAMPAIGN_ADVERTISER[campaignId];
  if (!advertiser) return [];
  const seeds = PRODUCT_SEEDS.filter((s) => s.advertiser === advertiser);
  if (seeds.length === 0) return [];

  // 归一化权重
  const totalGmvW = seeds.reduce((a, s) => a + s.gmvWeight, 0) || 1;
  const totalClkW = seeds.reduce((a, s) => a + s.clickWeight, 0) || 1;
  const normalized = seeds.map((s) => ({
    ...s,
    gmvWeight: s.gmvWeight / totalGmvW,
    clickWeight: s.clickWeight / totalClkW,
  }));

  const totals = campaignRawTotals(campaignId);
  return normalized.map((seed) => buildProductCps(seed, totals));
}

/** 按 advertiser 获取商品（使用默认 campaign 的 CPS 数据）。 */
export function productsByAdvertiser(advertiser: string): Product[] {
  const cid = Object.entries(CAMPAIGN_ADVERTISER).find(([, a]) => a === advertiser)?.[0];
  if (!cid) return [];
  return productsByCampaign(cid);
}

// 初始化：为每个 campaign 预生成商品列表
for (const campaignId of Object.keys(CAMPAIGN_ADVERTISER)) {
  MOCK_PRODUCTS.push(...productsByCampaign(campaignId));
}
// 去重（同一商品只保留一份）
const _seen = new Set<string>();
const _deduped: Product[] = [];
for (const p of MOCK_PRODUCTS) {
  if (!_seen.has(p.id)) {
    _seen.add(p.id);
    _deduped.push(p);
  }
}
MOCK_PRODUCTS.length = 0;
MOCK_PRODUCTS.push(..._deduped);
