import type {
  CampaignSummary,
  ContentTopicPerformance,
  ConversionFunnelStep,
  DeviceBreakdown,
  GeoPerformance,
  HourlyPerformance,
  PlacementWideRow,
  PublisherPerformance,
  RevenueTimelinePoint,
  SearchTermPerformance,
} from '@mediakit/shared';

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

/* ------------------------------ Campaign Summary ------------------------------ */

/** Campaign display name (for report title page, aligned with campaign names). */
const CAMPAIGN_NAMES: Record<string, string> = {
  'camp-glowlab-q4': 'GlowLab Q4 Sensitive Skin Repair Campaign',
  'camp-lumiere-launch': 'LUMIÈRE Anti-Aging Launch',
  'camp-nova-home-618': 'NOVA HOME 618 Home Refresh',
  'camp-motion-spring': 'MOTION Spring Sports Campaign',
  'camp-everyday-bf': 'EVERYDAY Black Friday Global Sale',
  'camp-wander-summer': 'WANDER Summer Travel Campaign',
};

/** Campaign 周期天数（与 creatorPerformance startDate 语义对齐，约 30~45 天）。 */
const CAMPAIGN_PERIOD_DAYS = 31;

/** Campaign 起始日期（YYYY-MM-DD）。 */
const CAMPAIGN_START: Record<string, string> = {
  'camp-glowlab-q4': '2026-10-12',
  'camp-lumiere-launch': '2026-09-01',
  'camp-nova-home-618': '2026-05-20',
  'camp-motion-spring': '2026-03-15',
  'camp-everyday-bf': '2026-11-20',
  'camp-wander-summer': '2026-06-25',
};

/** 将 YYYY-MM-DD 增加 n 天，返回 YYYY-MM-DD（确定性，无时区漂移）。 */
function addDaysISO(start: string, days: number): string {
  const [y, m, d] = start.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** Campaign 花费基线（intensity=1.0 时约 revenue/3.4，自洽且贴近真实 DTC 目标 ROAS）。 */
const BASE_SPEND = 64_000;

/**
 * 生成某 campaign 的首页汇总概要。
 * 所有大数从 publisher 维度的基线推导，保证与 getPublishers/getGeoPerformance 量级自洽。
 * Deterministic：相同 campaignId → 相同输出。
 */
export function getCampaignSummary(campaignId: string): CampaignSummary {
  const profile = profileOf(campaignId);
  const k = profile.intensity;

  const totalClicks = Math.round(BASE_CLICKS * k);
  const avgCtr = BASE_CTR; // % 与 publisher 基线一致
  const totalImpressions = Math.round(totalClicks / (avgCtr / 100));
  const avgCvr = BASE_CVR;
  const totalConversions = Math.round(totalClicks * (avgCvr / 100));

  const totalRevenue = Math.round(totalConversions * profile.aov);
  const totalCommission = Math.round(totalRevenue * profile.commissionPct);
  const totalSpend = Math.round(BASE_SPEND * k);
  const roas = totalRevenue / totalSpend;
  const avgEpc = totalRevenue / totalClicks;

  // 新客占比随 campaign 强度轻微浮动（弱 campaign 拉新更多），确定性。
  const newRate = 30 + ((hashStr(campaignId) % 13) - 6); // 24~36
  const newCustomers = Math.round(totalConversions * (newRate / 100));
  const returningCustomers = totalConversions - newCustomers;

  const start = CAMPAIGN_START[campaignId] ?? '2026-10-12';
  const end = addDaysISO(start, CAMPAIGN_PERIOD_DAYS - 1);

  return {
    campaignId,
    campaignName: CAMPAIGN_NAMES[campaignId] ?? campaignId,
    period: `${start} ~ ${end}`,
    totalSpend: money(totalSpend),
    totalRevenue: money(totalRevenue),
    totalCommission: money(totalCommission),
    roas: roas.toFixed(2),
    totalClicks: fmt(totalClicks),
    totalImpressions: fmt(totalImpressions),
    totalConversions: fmt(totalConversions),
    avgCtr: pct2(avgCtr),
    avgCvr: pct2(avgCvr),
    avgEpc: money2(avgEpc),
    newCustomers,
    returningCustomers,
    newCustomerRate: `${newRate.toFixed(1)}%`,
  };
}

/* ------------------------------ Device Breakdown ------------------------------ */

/** 设备分布基线（Mobile 主导，符合 DTC 电商真实分布）。 */
const DEVICE_BASE = [
  { device: 'Mobile', share: 64.8, trend: '+8.3%' },
  { device: 'Desktop', share: 26.1, trend: '-3.2%' },
  { device: 'Tablet', share: 9.1, trend: '+1.4%' },
] as const;

/** campaign 级总会话数基线（与 clicks 同量级，略高于 clicks）。 */
const BASE_SESSIONS = 62_000;

/**
 * 生成设备分布。Mobile/Desktop/Tablet 三档，share 总和约 100%。
 * Deterministic。
 */
export function getDeviceBreakdown(campaignId: string): DeviceBreakdown[] {
  const profile = profileOf(campaignId);
  const totalSessions = Math.round(BASE_SESSIONS * profile.intensity);
  const totalRevenue = Math.round(
    BASE_CLICKS * profile.intensity * (BASE_CVR / 100) * profile.aov,
  );

  return DEVICE_BASE.map((d) => {
    const sessions = Math.round((totalSessions * d.share) / 100);
    const revenue = Math.round((totalRevenue * d.share) / 100);
    return {
      device: d.device,
      sessions: fmt(sessions),
      revenue: money(revenue),
      share: `${d.share.toFixed(1)}%`,
      trend: d.trend,
    };
  });
}

/* ------------------------------ Content Topics ------------------------------ */

/** Content topic pools (aligned with skincare/beauty/home etc campaign categories). */
const CONTENT_TOPICS = [
  { topic: 'Skincare Routine', basePosts: 8, baseImpr: 1_240_000, roasBase: 4.2 },
  { topic: 'Ingredient Science', basePosts: 6, baseImpr: 860_000, roasBase: 5.1 },
  { topic: 'Product Review', basePosts: 7, baseImpr: 1_080_000, roasBase: 3.6 },
  { topic: 'Lifestyle Vlog', basePosts: 5, baseImpr: 720_000, roasBase: 2.4 },
  { topic: 'Recommendation', basePosts: 6, baseImpr: 540_000, roasBase: 2.9 },
  { topic: 'Seasonal Special', basePosts: 4, baseImpr: 410_000, roasBase: 2.1 },
] as const;

/**
 * 生成内容主题表现（6 个主题）。
 * impressions / engagement / revenue 用 modulo 抖动避免雷同；roas 驱动 status。
 * Deterministic。
 */
export function getContentTopics(campaignId: string): ContentTopicPerformance[] {
  const profile = profileOf(campaignId);
  const k = profile.intensity;
  const roasMod = roasModulator(k);
  const cid = hashStr(campaignId);

  return CONTENT_TOPICS.map((t, i) => {
    const jit = 1 + ((cid + i) % 5 - 2) * 0.1; // ±0.2 确定性抖动
    const posts = t.basePosts + ((cid + i) % 3);
    const impressions = Math.round(t.baseImpr * k * jit);
    const engagement = `${(t.roasBase * 1.6 * jit).toFixed(1)}%`;
    const revenue = Math.round(impressions * (BASE_CVR / 100) * 0.4 * profile.aov * jit);
    const roas = t.roasBase * roasMod * jit;

    return {
      topic: t.topic,
      posts,
      impressions: fmt(impressions),
      engagement,
      revenue: money(revenue),
      roas: roas.toFixed(2),
      status: roasStatus(roas),
    };
  });
}

/* ------------------------------ Revenue Timeline ------------------------------ */

/**
 * 生成日维度收入时间线。
 * 用正弦波叠加 weekday 效应模拟真实波动（周末略低），确定性。
 * @param days 天数（默认 31）。
 */
export function getRevenueTimeline(
  campaignId: string,
  days = 31,
): RevenueTimelinePoint[] {
  const profile = profileOf(campaignId);
  const k = profile.intensity;
  const start = CAMPAIGN_START[campaignId] ?? '2026-10-12';

  // campaign 级日均 revenue 基线（总 revenue / days，自洽）。
  const dailyBase =
    (BASE_CLICKS * k * (BASE_CVR / 100) * profile.aov) / CAMPAIGN_PERIOD_DAYS;
  const dailySpendBase = (BASE_SPEND * k) / CAMPAIGN_PERIOD_DAYS;
  const cid = hashStr(campaignId);

  const out: RevenueTimelinePoint[] = [];
  for (let d = 0; d < days; d++) {
    const date = addDaysISO(start, d);
    // weekday 效应（周日=0 → 0.85，周六=6 → 0.9），中段峰值。
    const [y, m, dd] = date.split('-').map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, dd)).getUTCDay();
    const wFactor = weekday === 0 || weekday === 6 ? 0.88 : 1.0;
    // 正弦波周期 ~7 天，振幅 0.18。
    const wave = 1 + 0.18 * Math.sin((d / 7) * Math.PI * 2 + (cid % 7));
    const jit = 1 + ((cid + d) % 5 - 2) * 0.05;
    const factor = wFactor * wave * jit;

    const revenue = Math.round(dailyBase * factor);
    const spend = Math.round(dailySpendBase * (0.92 + 0.16 * (1 - wave * 0.5)));
    const commission = Math.round(revenue * profile.commissionPct);
    const orders = Math.max(1, Math.round((revenue / profile.aov) * factor));

    out.push({ date, revenue, spend, commission, orders });
  }
  return out;
}

/* ------------------------------ Conversion Funnel ------------------------------ */

/** 漏斗各步基准转化率（相对上一步）。 */
const FUNNEL_RATES = [1.0, 0.032, 0.41, 0.62, 0.78]; // impr→click→cart→checkout→purchase

/**
 * 生成 5 步转化漏斗：Impressions / Clicks / Add to Cart / Checkout / Purchase。
 * rate 为相对上一步的转化率。Deterministic。
 */
export function getConversionFunnel(campaignId: string): ConversionFunnelStep[] {
  const profile = profileOf(campaignId);
  const k = profile.intensity;
  const cid = hashStr(campaignId);

  const baseImpr = Math.round((BASE_CLICKS / (BASE_CTR / 100)) * k);
  const roasMod = roasModulator(k);

  const steps = ['Impressions', 'Clicks', 'Add to Cart', 'Checkout', 'Purchase'];
  return steps.map((step, i) => {
    // 从 impressions 起逐级衰减。
    let value = baseImpr;
    for (let j = 1; j <= i; j++) {
      // 漏斗率随 campaign 强度轻微调制（强 campaign cvr 略高）。
      const mod = j === 1 ? 1.0 : 0.85 + 0.2 * (roasMod - 1) + (1 - roasMod) * 0.0;
      const rate = FUNNEL_RATES[j] * mod * (1 + ((cid + j) % 3 - 1) * 0.04);
      value = Math.round(value * Math.max(0.01, Math.min(1, rate)));
    }
    const ratePct =
      i === 0 ? 100 : FUNNEL_RATES[i] * 100 * (1 + ((cid + i) % 3 - 1) * 0.03);
    return {
      step,
      value,
      rate: `${ratePct.toFixed(1)}%`,
    };
  });
}

/* ------------------------------ Hourly Performance ------------------------------ */

/** 24 小时分布权重（凌晨低、午间小峰、晚间大峰，符合真实电商流量曲线）。 */
const HOUR_WEIGHT = [
  0.3, 0.25, 0.2, 0.18, 0.16, 0.2, // 00-05
  0.4, 0.7, 1.0, 1.2, 1.3, 1.25,   // 06-11
  1.4, 1.5, 1.35, 1.2, 1.1, 1.15,  // 12-17
  1.4, 1.8, 2.0, 1.9, 1.3, 0.7,    // 18-23
];
const HOUR_SUM = HOUR_WEIGHT.reduce((a, b) => a + b, 0);

/**
 * 生成一天 24 小时分布（impressions / clicks / conversions）。
 * Deterministic。
 */
export function getHourlyPerformance(campaignId: string): HourlyPerformance[] {
  const profile = profileOf(campaignId);
  const k = profile.intensity;
  const cid = hashStr(campaignId);

  const dailyImpr = Math.round((BASE_CLICKS / (BASE_CTR / 100)) * k) / CAMPAIGN_PERIOD_DAYS;
  const dailyClicks = Math.round(BASE_CLICKS * k) / CAMPAIGN_PERIOD_DAYS;
  const dailyConv = Math.round(BASE_CLICKS * k * (BASE_CVR / 100)) / CAMPAIGN_PERIOD_DAYS;

  return Array.from({ length: 24 }, (_, h) => {
    const w = HOUR_WEIGHT[h] / HOUR_SUM;
    const jit = 1 + ((cid + h) % 5 - 2) * 0.06;
    return {
      hour: String(h).padStart(2, '0'),
      impressions: Math.round(dailyImpr * w * 24 * jit),
      clicks: Math.round(dailyClicks * w * 24 * jit),
      conversions: Math.round(dailyConv * w * 24 * jit),
    };
  });
}

/* ------------------------------ Search Terms ------------------------------ */

/** 搜索词池（品牌词 / 品类词 / 长尾词混合，贴近 affiliate SEM 真实结构）。 */
const SEARCH_TERMS = [
  { term: 'glowlab serum', clicksBase: 4200, cvrBase: 4.2, roasBase: 5.8 },
  { term: 'ceramide moisturizer', clicksBase: 3800, cvrBase: 3.6, roasBase: 4.4 },
  { term: 'sensitive skin cream', clicksBase: 2900, cvrBase: 3.1, roasBase: 3.2 },
  { term: 'niacinamide 10%', clicksBase: 2400, cvrBase: 2.8, roasBase: 2.9 },
  { term: 'barrier repair', clicksBase: 1800, cvrBase: 2.4, roasBase: 2.3 },
  { term: 'anti-aging routine', clicksBase: 1600, cvrBase: 2.1, roasBase: 1.9 },
  { term: 'best vitamin c serum', clicksBase: 1300, cvrBase: 1.9, roasBase: 1.6 },
  { term: 'gentle cleanser', clicksBase: 1100, cvrBase: 1.7, roasBase: 1.4 },
  { term: 'redness relief', clicksBase: 860, cvrBase: 1.5, roasBase: 1.2 },
  { term: 'hydration booster', clicksBase: 720, cvrBase: 1.3, roasBase: 1.05 },
];

/**
 * 生成 10 个搜索词的表现。roas 驱动 status。
 * Deterministic。
 */
export function getSearchTerms(campaignId: string): SearchTermPerformance[] {
  const profile = profileOf(campaignId);
  const k = profile.intensity;
  const roasMod = roasModulator(k);
  const cid = hashStr(campaignId);

  return SEARCH_TERMS.map((s, i) => {
    const jit = 1 + ((cid + i) % 5 - 2) * 0.1;
    const clicks = Math.round(s.clicksBase * k * jit);
    const ctr = BASE_CTR * (0.7 + 0.1 * (i % 4));
    const conversions = Math.round(clicks * (s.cvrBase / 100) * jit);
    const revenue = Math.round(conversions * profile.aov);
    const roas = s.roasBase * roasMod * jit;

    return {
      term: s.term,
      clicks: fmt(clicks),
      conversions: fmt(conversions),
      ctr: pct2(ctr),
      revenue: money(revenue),
      status: roasStatus(roas),
    };
  });
}

/* ------------------------------ 内部工具 ------------------------------ */

/** 字符串 → 确定性正整数（djb2 变体，无随机）。 */
function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
