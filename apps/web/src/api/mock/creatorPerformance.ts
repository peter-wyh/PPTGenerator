import type {
  CampaignMetric,
  CreatorCampaignPerformance,
  CreatorCps,
  CreatorDaily,
  PlacementPerformance,
  PlacementTypeSummary,
  PlacementTrendPoint,
  PostEffect,
  PostFormat,
  WorkScreenshotItem,
} from '@mediakit/shared';
import { formatMoney, DEFAULT_FORMAT } from '@mediakit/shared';
import { CREATOR_META, type Tier } from './creators';

/**
 * Upstream "Creator Performance" API (mock for demo).
 * Returns each creator's execution performance under a given campaign:
 * post metrics + CPS (affiliate sales) data.
 *
 * Values are deterministically derived from "creator tier baseline × campaign intensity",
 * approximating real-world magnitudes. No RNG (same input → same output), ideal for regression & screenshots.
 *
 * **Multi-platform support**: each campaign profile declares an array of platforms
 * with their collaboration types. Each creator's posts are spread across platforms
 * proportionally, enabling realistic multi-platform campaign scenarios.
 */

/** Creator roster (id / name / handle / tier), aligned with creators.ts. */
interface CreatorRoster {
  id: string;
  name: string;
  handle: string;
  tier: Tier;
}

const ROSTER: Record<string, CreatorRoster> = {};
for (const c of CREATOR_META) {
  ROSTER[c.id] = { id: c.id, name: c.name, handle: c.handle, tier: c.tier as Tier };
}

/** Tier baseline: single-post impressions / avg engagement rate / per-campaign GMV potential. */
const TIER_BASE: Record<Tier, { impr: number; er: number; gmv: number }> = {
  mega: { impr: 850_000, er: 8.4, gmv: 240_000 },
  macro: { impr: 360_000, er: 6.8, gmv: 70_000 },
  micro: { impr: 90_000, er: 10.5, gmv: 16_000 },
};

/** Single-post impression jitter (deterministic, avoids identical per-post values). */
const POST_JITTER = [1.0, 0.72, 1.28, 0.86];

/** Video platforms (have play counts; others treated as image). */
const VIDEO_PLATFORMS = new Set(['TikTok', 'Douyin', 'Bilibili', 'YouTube']);

/** A single platform entry within a campaign (platform + collaboration type). */
interface CampaignPlatformEntry {
  platform: string;
  collaborationType: string;
}

interface CampaignProfile {
  startDate: string;
  /** Campaign intensity coefficient (reflects budget / overall performance). */
  intensity: number;
  /** CPS commission rate (decimal, 0.12 = 12%). */
  commissionPct: number;
  /** Average order value (in CNY). */
  aov: number;
  /** Post title pool (creators draw from this in order). */
  titles: string[];
  /** Participating creator IDs (order determines title assignment). */
  creators: string[];
  /** Multi-platform configuration with collaboration types. */
  platforms: CampaignPlatformEntry[];
}

const CAMPAIGN_PROFILE: Record<string, CampaignProfile> = {
  'camp-glowlab-q4': {
    startDate: '2026-10-12',
    intensity: 1.0,
    commissionPct: 0.12,
    aov: 189,
    titles: [
      '7-Day Sensitive Skin Rescue Vlog | Calming Redness with Barrier Serum',
      'Ingredient Deep Dive | Does Ceramide Serum Actually Work?',
      'Seasonal Skin Crisis Survival Guide | 3-Step Barrier Repair',
      'Confident Without Makeup! How I Thickened My Skin Barrier',
    ],
    creators: ['cre-mia', 'cre-sofia', 'cre-tom'],
    platforms: [
      { platform: 'TikTok', collaborationType: 'Spark Ads' },
      { platform: 'Instagram', collaborationType: 'Content' },
      { platform: 'YouTube', collaborationType: 'Long-form Review' },
    ],
  },
  'camp-lumiere-launch': {
    startDate: '2026-09-01',
    intensity: 0.85,
    commissionPct: 0.15,
    aov: 359,
    titles: [
      '30+ Anti-Aging Diary | Real Results After Using a Full Jar',
      'Is Luxury Cream Worth It? 28-Day Challenge Comparison',
      'Fading Smile Lines? Blind Test Anti-Aging Cream Review',
      'Late-Night Recovery Rescue | Firming & Lifting Real Results',
    ],
    creators: ['cre-jamie', 'cre-mia', 'cre-sofia'],
    platforms: [
      { platform: 'TikTok', collaborationType: 'Content' },
      { platform: 'Instagram', collaborationType: 'Affiliate' },
    ],
  },
  'camp-nova-home-618': {
    startDate: '2026-05-20',
    intensity: 1.25,
    commissionPct: 0.08,
    aov: 129,
    titles: [
      'Apartment Makeover | Budget-Friendly Finds That Boost Happiness',
      '618 Shopping Guide | Home Essentials TOP 10',
      'Small Apartment Storage Hacks | Honest Review',
      'Aesthetic Home Decor Color Palette Inspiration',
    ],
    creators: ['cre-ava', 'cre-nora', 'cre-sofia'],
    platforms: [
      { platform: 'Instagram', collaborationType: 'Content' },
      { platform: 'YouTube', collaborationType: 'Long-form Review' },
    ],
  },
  'camp-motion-spring': {
    startDate: '2026-03-01',
    intensity: 0.6,
    commissionPct: 0.1,
    aov: 159,
    titles: [
      'Spring Outdoor Vlog | One Outfit for Running + Commuting',
      'Gym vs Home Workout | 30-Day Real Comparison',
      'Sweatproof Makeup Tips for Sports',
      'Running Gear Starter Guide | Beginner Pitfalls to Avoid',
    ],
    creators: ['cre-leo', 'cre-mia', 'cre-tom'],
    platforms: [
      { platform: 'YouTube', collaborationType: 'Long-form Review' },
      { platform: 'TikTok', collaborationType: 'Content' },
    ],
  },
  'camp-everyday-bf': {
    startDate: '2026-11-20',
    intensity: 1.3,
    commissionPct: 0.1,
    aov: 249,
    titles: [
      'Black Friday Gift Guide | Premium Unisex Finds',
      'Unboxing | Black Friday Treasure Gift Box Haul',
      'How to Choose Holiday Gifts? Copy This List Directly',
      'Gift Ideas for Friends & Family | Foolproof Collection',
    ],
    creators: ['cre-mia', 'cre-sofia', 'cre-tom', 'cre-nora'],
    platforms: [
      { platform: 'TikTok', collaborationType: 'Spark Ads' },
      { platform: 'Instagram', collaborationType: 'Affiliate' },
      { platform: 'YouTube', collaborationType: 'Content' },
    ],
  },
  'camp-wander-summer': {
    startDate: '2026-07-01',
    intensity: 0.7,
    commissionPct: 0.06,
    aov: 899,
    titles: [
      'Summer Travel Route | Hidden Island Travel Guide',
      '7-Day Road Trip Vlog | Stunning Scenery Along the Way',
      'Travel Packing List | Pack Light Travel Guide',
      'Family Travel Tips | Accommodation + Itinerary Guide',
    ],
    creators: ['cre-leo', 'cre-ava', 'cre-nora'],
    platforms: [
      { platform: 'YouTube', collaborationType: 'Long-form Review' },
      { platform: 'Instagram', collaborationType: 'Content' },
    ],
  },
};

/* ------------------------------ Formatting utilities ------------------------------ */

const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');

const compact = (n: number): string => {
  const v = Math.round(n);
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(v);
};

const money = (n: number): string => formatMoney(n, DEFAULT_FORMAT);
/** Small amounts with 2 decimal places (for EPC etc). */
const money2 = (n: number): string => formatMoney(n, { ...DEFAULT_FORMAT, decimals: 2 });
const pct = (n: number): string => `${n.toFixed(1)}%`;
/** Percentage with 2 decimal places (for CTR / CVR, aligned with dashboard precision). */
const pct2 = (n: number): string => `${n.toFixed(2)}%`;

/** Add days to an ISO date (YYYY-MM-DD). */
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/* ------------------------------ Placement templates ------------------------------ */

/**
 * Placement/channel templates per platform: revW = revenue attribution weight, clkW = click attribution weight.
 * revW ≠ clkW → different EPC/conversion efficiency per placement (high-intent placements like Bio Link
 * have higher revenue share than click share). Each row's weights sum to ≈1.
 */
interface PlacementTemplate {
  type: string;
  revW: number;
  clkW: number;
  note: string;
}

const PLACEMENT_TEMPLATES: Record<string, PlacementTemplate[]> = {
  TikTok: [
    { type: 'Bio Link', revW: 0.48, clkW: 0.4, note: 'High intent traffic' },
    { type: 'Story', revW: 0.32, clkW: 0.36, note: 'Impulse convert' },
    { type: 'Live', revW: 0.2, clkW: 0.24, note: 'Repeat buyer heavy' },
  ],
  Douyin: [
    { type: 'Profile Link', revW: 0.48, clkW: 0.4, note: 'High intent traffic' },
    { type: 'Short Video Cart', revW: 0.32, clkW: 0.36, note: 'Impulse convert' },
    { type: 'Live Stream', revW: 0.2, clkW: 0.24, note: 'Repeat buyer heavy' },
  ],
  Xiaohongshu: [
    { type: 'Shoppable Post', revW: 0.5, clkW: 0.42, note: 'Strong conversion' },
    { type: 'Store Showcase', revW: 0.3, clkW: 0.34, note: 'Active browsing' },
    { type: 'Live Stream', revW: 0.2, clkW: 0.24, note: 'Repeat buyer heavy' },
  ],
  Instagram: [
    { type: 'Bio Link', revW: 0.48, clkW: 0.4, note: 'High intent traffic' },
    { type: 'Story', revW: 0.32, clkW: 0.36, note: 'Impulse convert' },
    { type: 'Reels', revW: 0.2, clkW: 0.24, note: 'Top funnel reach' },
  ],
  Bilibili: [
    { type: 'Description Link', revW: 0.46, clkW: 0.4, note: 'Deep consideration' },
    { type: 'Pinned Comment', revW: 0.32, clkW: 0.36, note: 'Engaged convert' },
    { type: 'End Card', revW: 0.22, clkW: 0.24, note: 'New customer driver' },
  ],
  YouTube: [
    { type: 'Description Link', revW: 0.46, clkW: 0.4, note: 'Deep consideration' },
    { type: 'Pinned Comment', revW: 0.32, clkW: 0.36, note: 'Engaged convert' },
    { type: 'End Card', revW: 0.22, clkW: 0.24, note: 'New customer driver' },
  ],
  WeChat: [
    { type: 'Read More', revW: 0.46, clkW: 0.4, note: 'High intent traffic' },
    { type: 'Mini Program Card', revW: 0.32, clkW: 0.36, note: 'Impulse convert' },
    { type: 'Channels Store', revW: 0.22, clkW: 0.24, note: 'New customer driver' },
  ],
};

/** CTR factor relative to mean per placement (high-intent placements have higher CTR). */
const CTR_FACTOR = [1.15, 0.92, 0.8];

/** Generate 6-week upward trend data points (deterministic, for mini trend chart). */
function trendPoints(total: number, seed: number): PlacementTrendPoint[] {
  const pts: PlacementTrendPoint[] = [];
  for (let i = 0; i < 6; i++) {
    const wave = 0.9 + 0.05 * ((seed + i) % 3);
    pts.push({ label: `W${i + 1}`, value: Math.round((total / 6) * (0.45 + 0.16 * i) * wave) });
  }
  return pts;
}

/* ------------------------------ Post / Daily utilities ------------------------------ */

/** Content hashtag pools (deterministic rotation). */
const HASHTAGS = [
  '#skincare #sensitiveskin #barrierrepair',
  '#ingredientnerd #honestreview',
  '#productrec #musthave',
  '#unboxing #realreview',
  '#dailyvlog #lifestyle',
  '#tips #tutorial',
];

/** Platform-specific post URL (mock, deterministic). */
function postUrl(platform: string, handle: string, id: string): string {
  const tail = id.replace(/[^a-z0-9]/gi, '').slice(-8);
  switch (platform) {
    case 'TikTok': return `https://www.tiktok.com/${handle}/video/${tail}`;
    case 'Douyin': return `https://www.douyin.com/video/${tail}`;
    case 'Xiaohongshu': return `https://www.xiaohongshu.com/explore/${tail}`;
    case 'Bilibili': return `https://www.bilibili.com/video/BV${tail.slice(0, 6)}`;
    case 'YouTube': return `https://www.youtube.com/watch?v=${tail}`;
    case 'Instagram': return `https://www.instagram.com/p/${tail}`;
    case 'WeChat': return `https://mp.weixin.qq.com/s/${tail}`;
    default: return `https://example.com/${handle.replace('@', '')}/${tail}`;
  }
}

/** Video duration ("M:SS"), deterministic. */
function videoDuration(seed: number): string {
  const total = 18 + (seed % 7) * 11; // 18~84s
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Generate daily performance over the campaign cycle (deterministic S-curve, mid-cycle peak).
 * Weights sum to 1, so daily totals ≈ passed-in totals (self-consistent with summary/cps).
 */
function buildDaily(
  startDate: string,
  totals: { impressions: number; engagement: number; clicks: number; gmv: number; orders: number },
): CreatorDaily[] {
  const DAYS = 28;
  const weights = Array.from({ length: DAYS }, (_, i) => {
    const t = i / (DAYS - 1);
    return Math.sin(t * Math.PI) * 0.9 + 0.15 + 0.08 * ((i * 7) % 3);
  });
  const wSum = weights.reduce((a, b) => a + b, 0) || 1;
  return weights.map((w, i) => ({
    date: addDays(startDate, i),
    impressions: fmt((totals.impressions * w) / wSum),
    engagement: fmt((totals.engagement * w) / wSum),
    clicks: fmt((totals.clicks * w) / wSum),
    gmv: money((totals.gmv * w) / wSum),
    orders: fmt((totals.orders * w) / wSum),
  }));
}

/* ------------------------------ Build single creator performance ------------------------------ */

/** Placement raw values (for campaign-level rollup, avoids parsing formatted strings). */
interface RawPlacement {
  type: string;
  revenue: number;
  clicks: number;
  conversions: number;
  impressions: number;
  commission: number;
}

/** Single creator's aggregated raw totals (for campaign/creator rollup, avoids parsing formatted strings). */
interface RawCreatorTotals {
  gmv: number;
  orders: number;
  commission: number;
  clicks: number;
  impressions: number;
  cpsSpend: number;
}

interface RawPerformance {
  perf: CreatorCampaignPerformance;
  rawPlacements: RawPlacement[];
  totals: RawCreatorTotals;
}

/**
 * Determine the platform for a given post index.
 * Posts are distributed across platforms proportionally (round-robin with platform weighting).
 */
function platformForPost(profile: CampaignProfile, postIdx: number): string {
  return profile.platforms[postIdx % profile.platforms.length].platform;
}

function buildPerformance(
  profile: CampaignProfile,
  campaignId: string,
  creatorId: string,
  cIdx: number,
): RawPerformance {
  const cr = ROSTER[creatorId];
  const base = TIER_BASE[cr.tier];
  const k = profile.intensity;
  const numPosts = cr.tier === 'mega' ? 4 : cr.tier === 'macro' ? 3 : 2;

  const posts: PostEffect[] = [];
  let totalImpr = 0;
  let totalEng = 0;

  for (let p = 0; p < numPosts; p++) {
    const platform = platformForPost(profile, p);
    const isVideo = VIDEO_PLATFORMS.has(platform);
    const format: PostFormat = isVideo ? 'video' : 'image';
    const impr = Math.round(base.impr * k * POST_JITTER[(cIdx + p) % POST_JITTER.length]);
    const er = base.er * (0.85 + 0.12 * p); // slight per-post engagement variance
    const eng = impr * (er / 100);
    totalImpr += impr;
    totalEng += eng;

    const pid = `${campaignId}-${creatorId}-p${p + 1}`;
    posts.push({
      id: pid,
      title: profile.titles[(cIdx + p) % profile.titles.length],
      cover: `https://picsum.photos/seed/${pid}/640/360`,
      url: postUrl(platform, cr.handle, pid),
      publishedAt: addDays(profile.startDate, 2 + cIdx * 4 + p * 6),
      platform,
      format,
      ...(isVideo ? { duration: videoDuration(cIdx + p), plays: compact(Math.round(impr * 0.82)) } : {}),
      hashtags: HASHTAGS[(cIdx + p) % HASHTAGS.length],
      impressions: compact(impr),
      likes: fmt(eng * 0.56),
      comments: fmt(eng * 0.11),
      shares: fmt(eng * 0.18),
      saves: fmt(eng * 0.15),
      engagementRate: pct(er),
    });
  }

  // CPS (affiliate): GMV driven by tier potential × intensity, commission by campaign rate.
  const gmv = Math.round(base.gmv * k * (0.8 + 0.18 * cIdx));
  const orders = Math.round(gmv / profile.aov);
  const commission = Math.round(gmv * profile.commissionPct);
  const cpsSpend = Math.round(commission * 1.08); // commission + 8% platform service fee
  const clicks = Math.round(totalImpr * 0.038);
  const ctrOverall = (clicks / totalImpr) * 100;
  const cvr = (orders / clicks) * 100;
  const roas = gmv / cpsSpend;
  const epc = gmv / clicks;

  const cps: CreatorCps = {
    gmv: money(gmv),
    orders: fmt(orders),
    aov: money(profile.aov),
    cvr: pct2(cvr),
    commission: money(commission),
    cpsSpend: money(cpsSpend),
    roas: roas.toFixed(2),
    clicks: fmt(clicks),
    ctr: pct2(ctrOverall),
    epc: money2(epc),
    refundRate: pct(1.8 + (cIdx % 3) * 0.7),
  };

  // Placement details (affiliate dimension): split creator's GMV/clicks/conversions by placement weights.
  // Use the primary platform's placement template.
  const primaryPlatform = profile.platforms[0].platform;
  const templates = PLACEMENT_TEMPLATES[primaryPlatform] ?? PLACEMENT_TEMPLATES.TikTok;
  const placements: PlacementPerformance[] = [];
  const rawPlacements: RawPlacement[] = [];

  templates.forEach((tpl, i) => {
    const revP = Math.round(gmv * tpl.revW);
    const clkP = Math.round(clicks * tpl.clkW);
    const convP = Math.round(orders * tpl.revW);
    const commP = Math.round(revP * profile.commissionPct);
    const ctrP = ctrOverall * CTR_FACTOR[i % CTR_FACTOR.length];
    const imprP = Math.round(clkP / (ctrP / 100));
    const cvrP = (convP / clkP) * 100;
    const epcP = revP / clkP;
    const roasP = revP / (commP * 1.08);

    rawPlacements.push({
      type: tpl.type,
      revenue: revP,
      clicks: clkP,
      conversions: convP,
      impressions: imprP,
      commission: commP,
    });

    placements.push({
      type: tpl.type,
      screenshot: '',
      revenue: money(revP),
      revenueShare: pct(tpl.revW * 100),
      clicks: fmt(clkP),
      ctr: pct2(ctrP),
      conversions: fmt(convP),
      cvr: pct2(cvrP),
      epc: money2(epcP),
      commission: money(commP),
      roas: roasP.toFixed(2),
      trend: trendPoints(revP, cIdx + i),
      notes: tpl.note,
    });
  });

  return {
    perf: {
      campaignId,
      creatorId,
      creatorName: cr.name,
      handle: cr.handle,
      platform: primaryPlatform,
      tier: cr.tier,
      summary: {
        posts: numPosts,
        totalImpressions: compact(totalImpr),
        totalEngagement: compact(Math.round(totalEng)),
        avgEngagementRate: pct((totalEng / totalImpr) * 100),
      },
      posts,
      daily: buildDaily(profile.startDate, {
        impressions: totalImpr,
        engagement: Math.round(totalEng),
        clicks,
        gmv,
        orders,
      }),
      placements,
      cps,
    },
    rawPlacements,
    totals: { gmv, orders, commission, clicks, impressions: totalImpr, cpsSpend },
  };
}

/* ------------------------------ Campaign-level rollup ------------------------------ */

/** Aggregate multiple creators' placement raw data by type → placement-type summary (aligned with dashboard). */
function rollupPlacementTypes(raws: RawPlacement[]): PlacementTypeSummary[] {
  const byType = new Map<
    string,
    { revenue: number; clicks: number; conversions: number; impressions: number; commission: number }
  >();
  for (const r of raws) {
    const cur =
      byType.get(r.type) ?? { revenue: 0, clicks: 0, conversions: 0, impressions: 0, commission: 0 };
    cur.revenue += r.revenue;
    cur.clicks += r.clicks;
    cur.conversions += r.conversions;
    cur.impressions += r.impressions;
    cur.commission += r.commission;
    byType.set(r.type, cur);
  }
  const total = [...byType.values()].reduce((a, b) => a + b.revenue, 0) || 1;
  return [...byType.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .map(([type, v], idx) => ({
      type,
      revenue: money(v.revenue),
      revenueShare: pct((v.revenue / total) * 100),
      clicks: fmt(v.clicks),
      ctr: pct2((v.clicks / (v.impressions || 1)) * 100),
      conversions: fmt(v.conversions),
      cvr: pct2((v.conversions / (v.clicks || 1)) * 100),
      epc: money2(v.revenue / (v.clicks || 1)),
      roas: (v.revenue / ((v.commission || 0) * 1.08)).toFixed(2),
      trend: trendPoints(v.revenue, idx + type.length),
    }));
}

/* ------------------------------ Mock dataset ------------------------------ */

const { MOCK_PERFORMANCE, MOCK_PLACEMENT_SUMMARY, MOCK_RAW } = (() => {
  const perf: Record<string, CreatorCampaignPerformance[]> = {};
  const summary: Record<string, PlacementTypeSummary[]> = {};
  const raw: Record<string, RawPerformance[]> = {};
  for (const [cid, profile] of Object.entries(CAMPAIGN_PROFILE)) {
    const raws = profile.creators.map((creatorId, idx) =>
      buildPerformance(profile, cid, creatorId, idx),
    );
    raw[cid] = raws;
    perf[cid] = raws.map((r) => r.perf);
    summary[cid] = rollupPlacementTypes(raws.flatMap((r) => r.rawPlacements));
  }
  return { MOCK_PERFORMANCE: perf, MOCK_PLACEMENT_SUMMARY: summary, MOCK_RAW: raw };
})();

/**
 * Deterministic "period-over-period" text: uses campaign intensity as the main signal
 * (strong campaign → positive growth), with per-metric-index jitter.
 * Mock has no real prior-period data; this is a simulated value for dashboard display only.
 */
function mockCompare(campaignId: string, idx: number): string {
  const profile = CAMPAIGN_PROFILE[campaignId];
  const base = ((profile?.intensity ?? 1) - 0.85) * 100; // intensity 1.0→+15, 0.6→-25
  const delta = base + ((idx % 5) - 2) * 3; // ±6% jitter, prevents all metrics moving in lockstep
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}%`;
}

/**
 * Campaign-level aggregate: sum of all creators' totals → 9 merged metrics
 * (GMV/Commission/ROAS/Clicks/Conversions/CVR/AOV/Spend/Impressions, default English labels).
 * campaign = Σ creators, ensuring dashboard totals are self-consistent with creator details.
 */
export function rollupCampaignMetrics(campaignId: string): CampaignMetric[] {
  const raws = MOCK_RAW[campaignId] ?? [];
  const sum = raws.reduce(
    (a, r) => ({
      gmv: a.gmv + r.totals.gmv,
      orders: a.orders + r.totals.orders,
      commission: a.commission + r.totals.commission,
      clicks: a.clicks + r.totals.clicks,
      impressions: a.impressions + r.totals.impressions,
      cpsSpend: a.cpsSpend + r.totals.cpsSpend,
    }),
    { gmv: 0, orders: 0, commission: 0, clicks: 0, impressions: 0, cpsSpend: 0 },
  );
  const roas = sum.cpsSpend ? sum.gmv / sum.cpsSpend : 0;
  const cvr = sum.clicks ? (sum.orders / sum.clicks) * 100 : 0;
  const aov = sum.orders ? sum.gmv / sum.orders : 0;
  return [
    { label: 'GMV', value: money(sum.gmv), compare: mockCompare(campaignId, 0) },
    { label: 'Commission', value: money(sum.commission), compare: mockCompare(campaignId, 1) },
    { label: 'ROAS', value: roas.toFixed(2), compare: mockCompare(campaignId, 2) },
    { label: 'Clicks', value: fmt(sum.clicks), compare: mockCompare(campaignId, 3) },
    { label: 'Conversions', value: fmt(sum.orders), compare: mockCompare(campaignId, 4) },
    { label: 'CVR', value: pct2(cvr), compare: mockCompare(campaignId, 5) },
    { label: 'AOV', value: money(aov), compare: mockCompare(campaignId, 6) },
    { label: 'Spend', value: money(sum.cpsSpend), compare: mockCompare(campaignId, 7) },
    { label: 'Impressions', value: compact(sum.impressions), compare: mockCompare(campaignId, 8) },
  ];
}

/**
 * 所有参与过至少一个 campaign 的达人 id 并集（campaign 合作达人对达人库的子集视图）。
 * 供达人库一致性测试与「库内有、未合作」判定使用。
 */
export function campaignParticipantIds(): string[] {
  const ids = new Set<string>();
  for (const profile of Object.values(CAMPAIGN_PROFILE)) {
    for (const id of profile.creators) ids.add(id);
  }
  return [...ids];
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/** Simulate upstream fetch of creator performance under a campaign (posts + placements + CPS). With mock latency. */
export function listCreatorPerformance(
  campaignId: string,
): Promise<CreatorCampaignPerformance[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(clone(MOCK_PERFORMANCE[campaignId] ?? [])), 250);
  });
}

/** Simulate upstream fetch of placement type summary for a campaign (aligned with dashboard placement-type table). With mock latency. */
export function listPlacementTypeSummary(
  campaignId: string,
): Promise<PlacementTypeSummary[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(clone(MOCK_PLACEMENT_SUMMARY[campaignId] ?? [])), 250);
  });
}

/** Export the multi-platform configuration for a campaign (for UI display). */
export function campaignPlatforms(campaignId: string): CampaignPlatformEntry[] {
  return CAMPAIGN_PROFILE[campaignId]?.platforms ?? [];
}

/**
 * Fetch screenshots of creator works under a campaign (mock, synchronous, deterministic).
 * Flattens each creator's posts' covers from MOCK_PERFORMANCE into { src, caption },
 * for work-screenshot component default seeding / import reuse.
 */
export function campaignWorkScreenshots(campaignId: string): WorkScreenshotItem[] {
  const perfs = MOCK_PERFORMANCE[campaignId] ?? [];
  const out: WorkScreenshotItem[] = [];
  for (const p of perfs) {
    for (const post of p.posts) {
      out.push({ src: post.cover ?? '', caption: `${p.creatorName} · ${post.title}` });
    }
  }
  return out;
}

/**
 * Single creator's single work post fragment (for the select-to-import UI).
 */
export interface CreatorWorkPost {
  postId: string;
  creatorId: string;
  creatorName: string;
  title: string;
  cover: string;
  platform: string;
  publishedAt: string;
}

/**
 * A creator and their work list under a campaign.
 */
export interface CreatorWithWorks {
  creatorId: string;
  creatorName: string;
  platform: string;
  tier: string;
  posts: CreatorWorkPost[];
}

/**
 * Fetch each creator and their works under a campaign (mock, synchronous, deterministic).
 * For work-screenshot component's "select creator works" UI.
 */
export function campaignCreatorWorks(campaignId: string): CreatorWithWorks[] {
  const perfs = MOCK_PERFORMANCE[campaignId] ?? [];
  return perfs.map((p) => ({
    creatorId: p.creatorId,
    creatorName: p.creatorName,
    platform: p.platform,
    tier: p.tier,
    posts: p.posts.map((post) => ({
      postId: post.id,
      creatorId: p.creatorId,
      creatorName: p.creatorName,
      title: post.title,
      cover: post.cover ?? '',
      platform: post.platform,
      publishedAt: post.publishedAt,
    })),
  }));
}
