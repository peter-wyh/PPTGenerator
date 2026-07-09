import type { PublisherPerformance, GeoPerformance, PlacementWideRow } from '@mediakit/shared';

/**
 * 联盟营销（Affiliate）上游接口（demo 中 mock）。
 * 提供 Publisher / GEO / Placement(宽表) 三个维度的联盟营销数据。
 *
 * 数值由「campaign 强度 × publisher/geo 权重」确定性生成，贴近真实量级；
 * 无随机数（同样输入 → 同样输出），便于回归与截图。
 * 与 creatorPerformance.ts 共享 campaign 强度语义，但 publisher 维度独立建模。
 */

/* ------------------------------ campaign profile ------------------------------ */

/** 各 campaign 的联盟营销配置（intensity 与 creatorPerformance.ts 对齐）。 */
interface AffiliateProfile {
  /** campaign 强度系数（反映预算 / 大盘表现）。 */
  intensity: number;
  /** CPS 佣金比例（小数，0.12 = 12%）。 */
  commissionPct: number;
  /** 客单价（元）。 */
  aov: number;
}

const AFFILIATE_PROFILE: Record<string, AffiliateProfile> = {
  'camp-glowlab-q4': { intensity: 1.0, commissionPct: 0.12, aov: 189 },
  'camp-lumiere-launch': { intensity: 0.85, commissionPct: 0.15, aov: 359 },
  'camp-nova-home-618': { intensity: 1.25, commissionPct: 0.08, aov: 129 },
  'camp-motion-spring': { intensity: 0.6, commissionPct: 0.1, aov: 159 },
  'camp-everyday-bf': { intensity: 1.3, commissionPct: 0.1, aov: 249 },
  'camp-wander-summer': { intensity: 0.7, commissionPct: 0.06, aov: 899 },
};

/** 默认 profile（未知 campaign 兜底）。 */
const DEFAULT_PROFILE: AffiliateProfile = { intensity: 1.0, commissionPct: 0.1, aov: 200 };

function profileOf(campaignId: string): AffiliateProfile {
  return AFFILIATE_PROFILE[campaignId] ?? DEFAULT_PROFILE;
}

/* ------------------------------ publisher roster ------------------------------ */

/** Publisher 花名册（10 家联盟媒体，确定性顺序）。 */
const PUBLISHERS = [
  'GlamourBlog',
  'BeautyHub',
  'TrendyDaily',
  'StyleMaven',
  'ViralVogue',
  'ChicWeekly',
  'GlowGuide',
  'FashionPulse',
  'UrbanMirror',
  'TrendFlow',
] as const;

/**
 * 各 publisher 的流量权重（求和≈1）：头部媒体贡献更多点击。
 * 与 publisher 序号一一对应，确定性。
 */
const PUBLISHER_WEIGHT = [0.18, 0.15, 0.13, 0.11, 0.09, 0.085, 0.075, 0.07, 0.06, 0.05];

/**
 * 各 publisher 的转化质量系数（>1 = 高质量流量，转化率优于均值；<1 = 低质）。
 * 驱动 CVR / EPC 差异。
 */
const QUALITY_FACTOR = [1.35, 1.18, 1.05, 0.95, 1.22, 0.82, 0.88, 1.1, 0.72, 0.6];

/**
 * 各 publisher 的 ROAS 基线（确定性，按 publisher 序号）。
 * 设计为跨越 good(≥3) / warn(2-2.99) / bad(<2) 三档，配合 intensity 轻微调制。
 */
const PUBLISHER_ROAS = [5.4, 4.2, 3.6, 3.1, 2.8, 2.4, 2.1, 1.8, 1.5, 1.2];

/** 确定性抖动系数（按 publisher 序号取，避免各 publisher 数值成等比数列）。 */
const JITTER = [1.0, 0.88, 1.12, 0.94, 1.06, 0.82, 1.15, 0.9, 1.03, 0.77];

/** 各 publisher 的典型投放位类型（确定性，publisher → placement 映射）。 */
const PUBLISHER_PLACEMENTS: Record<string, string[]> = {
  GlamourBlog: ['Banner 728x90', 'Sidebar Widget'],
  BeautyHub: ['In-Article Native', 'Newsletter'],
  TrendyDaily: ['Banner 300x250', 'Pop-under'],
  StyleMaven: ['Content Recommendation', 'Sticky Footer'],
  ViralVogue: ['Interstitial', 'Push Notification'],
  ChicWeekly: ['Sidebar Widget', 'Banner 728x90'],
  GlowGuide: ['In-Article Native', 'Banner 300x250'],
  FashionPulse: ['Content Recommendation', 'Newsletter'],
  UrbanMirror: ['Pop-under', 'Sticky Footer'],
  TrendFlow: ['Push Notification', 'Banner 300x250'],
};

/** 默认投放位（兜底）。 */
const DEFAULT_PLACEMENTS = ['Banner 300x250'];

/* ------------------------------ GEO roster ------------------------------ */

/** GEO 国家花名册（与 defaults.ts geo-map 默认数据对齐）。 */
const GEO_COUNTRIES = [
  { code: 'US', name: 'United States', share: 32.5 },
  { code: 'GB', name: 'United Kingdom', share: 13.6 },
  { code: 'DE', name: 'Germany', share: 10.2 },
  { code: 'CA', name: 'Canada', share: 8.3 },
  { code: 'AU', name: 'Australia', share: 7.1 },
  { code: 'FR', name: 'France', share: 5.3 },
  { code: 'JP', name: 'Japan', share: 4.4 },
  { code: 'BR', name: 'Brazil', share: 3.0 },
];

/* ------------------------------ 格式化工具 ------------------------------ */

const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');
const money = (n: number): string => `¥${fmt(n)}`;
const money2 = (n: number): string => `¥${n.toFixed(2)}`;
const pct2 = (n: number): string => `${n.toFixed(2)}%`;

/** ROAS → 状态色（good / warn / bad）。 */
function roasStatus(roas: number): 'good' | 'warn' | 'bad' {
  if (roas >= 3.0) return 'good';
  if (roas >= 2.0) return 'warn';
  return 'bad';
}

/** campaign intensity → ROAS 调制系数（强 campaign ROAS 略升，弱 campaign 略降）。 */
function roasModulator(intensity: number): number {
  return 0.85 + 0.2 * intensity;
}

/* ------------------------------ Publisher ------------------------------ */

/** campaign 级大盘点击基线（与 creatorPerformance 量级自洽）。 */
const BASE_CLICKS = 48_000;
/** 平均 CTR（%），各 publisher 在此基础上波动。 */
const BASE_CTR = 3.2;
/** 平均 CVR（%），各 publisher 在此基础上 × QUALITY_FACTOR。 */
const BASE_CVR = 2.4;

/**
 * 生成某 campaign 下 10 家 publisher 的联盟营销数据（12 列宽表）。
 * clicks / impressions / ctr / conversions / cvr / revenue / commission /
 * epc / roas / aov 全确定性生成，无随机数。
 */
export function getPublishers(campaignId: string): PublisherPerformance[] {
  const profile = profileOf(campaignId);
  const k = profile.intensity;
  const baseClicks = Math.round(BASE_CLICKS * k);
  const roasMod = roasModulator(k);

  return PUBLISHERS.map((publisher, i) => {
    const jit = JITTER[i % JITTER.length];
    const clicks = Math.round(baseClicks * PUBLISHER_WEIGHT[i] * jit);
    const ctr = BASE_CTR * (0.7 + 0.12 * (i % 4));
    const impressions = Math.round(clicks / (ctr / 100));

    const cvr = BASE_CVR * QUALITY_FACTOR[i] * (0.9 + 0.04 * (i % 3));
    const conversions = Math.round(clicks * (cvr / 100));

    const revenue = Math.round(conversions * profile.aov);
    const commission = Math.round(revenue * profile.commissionPct);
    const epc = revenue / clicks;
    const roas = PUBLISHER_ROAS[i] * roasMod;
    const aov = conversions ? revenue / conversions : profile.aov;

    return {
      publisher,
      clicks: fmt(clicks),
      impressions: fmt(impressions),
      ctr: pct2(ctr),
      conversions: fmt(conversions),
      cvr: pct2(cvr),
      revenue: money(revenue),
      commission: money(commission),
      epc: money2(epc),
      roas: roas.toFixed(2),
      aov: money(aov),
      status: roasStatus(roas),
    };
  });
}

/* ------------------------------ GEO ------------------------------ */

/** campaign 级总 revenue 基线（美元，与 defaults geo-map 量级自洽）。 */
const BASE_GEO_REVENUE = 139_000;

/**
 * 生成某 campaign 下 GEO 国家维度的收入分布（与 defaults geo-map 默认数据对齐）。
 * 8 个国家，US 主导（~32%），share 总和约 84.4%（剩余归「其他」未列出国家）。
 */
export function getGeoPerformance(campaignId: string): GeoPerformance[] {
  const profile = profileOf(campaignId);
  const totalRevenue = Math.round(BASE_GEO_REVENUE * profile.intensity);

  return GEO_COUNTRIES.map((c) => {
    const revenue = Math.round((totalRevenue * c.share) / 100);
    const displayK = revenue / 1000;
    return {
      code: c.code,
      name: c.name,
      revenue,
      display: `$${displayK.toFixed(1)}K`,
      share: `${c.share.toFixed(1)}%`,
    };
  });
}

/* ------------------------------ Placement 宽表 ------------------------------ */

/** 投放位原始数值（供排序，避免从格式化字符串反解析）。 */
interface RawPlacementRow {
  placement: string;
  publisher: string;
  clicks: number;
  ctr: number;
  conversions: number;
  cvr: number;
  revenue: number;
  epc: number;
  roas: number;
  status: 'good' | 'warn' | 'bad';
}

/**
 * 生成某 campaign 下 Placement 宽表行（9 列：placement / publisher / clicks /
 * ctr / conversions / cvr / revenue / epc / status）。
 * 把每个 publisher 的主力投放位拍平，按 revenue 降序排列。
 */
export function getPlacementWideRows(campaignId: string): PlacementWideRow[] {
  const profile = profileOf(campaignId);
  const k = profile.intensity;
  const baseClicks = Math.round(BASE_CLICKS * k);
  const roasMod = roasModulator(k);

  const raws: RawPlacementRow[] = [];

  PUBLISHERS.forEach((publisher, i) => {
    const jit = JITTER[i % JITTER.length];
    const placements = PUBLISHER_PLACEMENTS[publisher] ?? DEFAULT_PLACEMENTS;
    placements.forEach((placement, p) => {
      // 每个投放位分摊该 publisher 流量的一部分（首个为主力位，占 60%）。
      const slotW = p === 0 ? 0.6 : 0.4;
      const clicks = Math.round(baseClicks * PUBLISHER_WEIGHT[i] * jit * slotW);
      const ctr = BASE_CTR * (0.7 + 0.12 * ((i + p) % 4));
      const cvr =
        BASE_CVR * QUALITY_FACTOR[i] * (0.9 + 0.04 * ((i + p) % 3));
      const conversions = Math.round(clicks * (cvr / 100));
      const revenue = Math.round(conversions * profile.aov);
      const epc = revenue / clicks;
      // 投放位 ROAS 在 publisher 基线基础上按 slot 轻微波动（主力位略优）。
      const roas = PUBLISHER_ROAS[i] * roasMod * (p === 0 ? 1.05 : 0.92);

      raws.push({
        placement,
        publisher,
        clicks,
        ctr,
        conversions,
        cvr,
        revenue,
        epc,
        roas,
        status: roasStatus(roas),
      });
    });
  });

  // 按 revenue 降序排列后格式化。
  raws.sort((a, b) => b.revenue - a.revenue);
  return raws.map((r) => ({
    placement: r.placement,
    publisher: r.publisher,
    clicks: fmt(r.clicks),
    ctr: pct2(r.ctr),
    conversions: fmt(r.conversions),
    cvr: pct2(r.cvr),
    revenue: money(r.revenue),
    epc: money2(r.epc),
    status: r.status,
  }));
}
