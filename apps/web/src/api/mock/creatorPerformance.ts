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
      'Get Ready With Me | Glow Lab Barrier Serum Morning Routine',
      'Honest Review | 2 Weeks of Barrier Serum Results',
      'Sensitive Skin Holy Grail | The Serum That Changed Everything',
      'Dermatologist Reacts | Is Ceramide Serum Worth the Hype?',
      'Night Routine for Damaged Skin | Barrier Repair Edition',
      'Before & After | 14-Day Barrier Serum Challenge',
      'Why Everyone Is Talking About This Serum | Trend Analysis',
      'Sensitive Skin Savior | My Go-To Products for Calming Redness',
    ],
    creators: [
      'cre-mia', 'cre-sofia', 'cre-tom', 'cre-iris', 'cre-ava',
      'cre-jamie', 'cre-nora', 'cre-priya', 'cre-yuki', 'cre-marcus',
    ],
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
      'Luxury Skincare Worth It? Lumiere vs Drugstore Showdown',
      'My Mom Tried It | 60-Year-Old Skin Transformation',
      'Eye Cream That Actually Works | 3-Week Test Results',
      'Anti-Aging Routine | Productivity Meets Self-Care',
      'The Retinol Alternative | Gentle Anti-Aging That Delivers',
      'Professional Facial at Home | Lumiere Night Routine',
      'How to Look 5 Years Younger | Honest Cream Review',
      'Collagen Cream Science | What Actually Works for Firming',
    ],
    creators: [
      'cre-jamie', 'cre-mia', 'cre-sofia', 'cre-nora', 'cre-iris',
      'cre-ava', 'cre-kenji', 'cre-priya', 'cre-marcus', 'cre-yuki',
    ],
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
      'Apartment Tour 2026 | Cozy Minimalist Home Reveal',
      'Amazon Home Haul | What Is Actually Worth Buying',
      'Dorm Room Upgrade | Budget Decor That Looks Expensive',
      'Before & After | Living Room Makeover Under $500',
      'Home Organization Reset | KonMari Meets Real Life',
      'Aesthetic Desk Setup | Productivity Meets Style',
      'Cozy Bedroom Makeover | Hygge on a Budget',
      'Decorating Mistakes to Avoid | Interior Design Tips',
    ],
    creators: [
      'cre-ava', 'cre-nora', 'cre-sofia', 'cre-iris', 'cre-yuki',
      'cre-mia', 'cre-tom', 'cre-priya', 'cre-jamie', 'cre-kenji',
    ],
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
      'My Marathon Training Essentials | Gear That Actually Helps',
      'Budget Home Gym Build | Under $200 Full Body Setup',
      'Yoga Flow for Beginners | 15-Min Morning Routine',
      'Athleisure Haul | Activewear That Passes the Squat Test',
      'Crossfit vs Calisthenics | Which Gets Better Results',
      'Running Shoes Buying Guide | How to Choose the Right Pair',
      'Post-Workout Recovery Routine | Stretching & Foam Rolling',
      'Body Transformation Journey | Honest 90-Day Progress',
    ],
    creators: [
      'cre-leo', 'cre-mia', 'cre-tom', 'cre-marcus', 'cre-ava',
      'cre-kenji', 'cre-priya', 'cre-yuki', 'cre-jamie', 'cre-nora',
    ],
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
      'Black Friday Haul | Tech Gadgets Worth the Hype',
      'Luxury Gift Guide Under $100 | Looks Expensive, Is Not',
      'Stocking Stuffer Ideas | Small Gifts With Big Impact',
      'Gifts That Keep Giving | Subscription Box Recommendations',
      'What I Got My Partner | Holiday Gift Haul 2026',
      'Hostess Gift Ideas | Thoughtful Presents for Every Occasion',
      'Self-Gifting Season | Treat Yourself This Black Friday',
      'Tech Gift Guide | Best Gadgets Under $200',
    ],
    creators: [
      'cre-mia', 'cre-sofia', 'cre-tom', 'cre-nora', 'cre-leo',
      'cre-ava', 'cre-jamie', 'cre-iris', 'cre-marcus', 'cre-priya',
      'cre-kenji', 'cre-yuki',
    ],
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
      'Solo Female Travel Safety Tips | Lessons Learned',
      'Budget Travel Hacks | How I Traveled for $30 a Day',
      'Hidden Gems | Underrated Destinations You Must Visit',
      'Travel Photography Tips | Phone-Only Gear Guide',
      'What Is in My Carry-On | Essential Travel Kit',
      'Japan Travel Vlog | 10-Day Itinerary From Tokyo to Kyoto',
      'Camping Essentials | First-Time Camper Packing List',
      'How to Travel Like a Local | Cultural Immersion Guide',
    ],
    creators: [
      'cre-leo', 'cre-ava', 'cre-nora', 'cre-marcus', 'cre-yuki',
      'cre-mia', 'cre-priya', 'cre-tom', 'cre-iris', 'cre-kenji',
    ],
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
  const numPosts = cr.tier === 'mega' ? 6 : cr.tier === 'macro' ? 5 : cr.tier === 'micro' ? 4 : 3;

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
 * 通用 fallback Campaign Profile：用于未预定义的 campaignId。
 * 从 campaignId 派生确定性参数（intensity/commission/aov）+ 全达人花名册。
 */
function fallbackProfile(campaignId: string): CampaignProfile {
  let hash = 0;
  for (let i = 0; i < campaignId.length; i++) hash = (hash * 31 + campaignId.charCodeAt(i)) & 0x7fffffff;
  const titles = [
    'Campaign Highlight Reel | Top Moments',
    'Product Showcase | Behind the Scenes',
    'Creator Spotlight | Authentic Review',
    'Trending Now | What Everyone\u2019s Talking About',
    'How-To Guide | Step-by-Step Tutorial',
    'Before & After | Real Results',
    'My Honest Opinion | 30-Day Review',
    'Must-Have | Top Picks This Season',
  ];
  return {
    startDate: '2026-01-15',
    intensity: 0.7 + (hash % 30) / 100, // 0.70–0.99
    commissionPct: 0.08 + (hash % 10) / 100, // 0.08–0.17
    aov: 120 + (hash % 200),
    titles,
    creators: CREATOR_META.map((c) => c.id),
    platforms: [
      { platform: 'TikTok', collaborationType: 'Content' },
      { platform: 'Instagram', collaborationType: 'Affiliate' },
      { platform: 'YouTube', collaborationType: 'Long-form Review' },
    ],
  };
}

/** 为任意 campaignId 生成确定性 performance 列表（fallback 缓存）。 */
const FALLBACK_CACHE = new Map<string, CreatorCampaignPerformance[]>();
function getOrBuildFallback(campaignId: string): CreatorCampaignPerformance[] {
  let cached = FALLBACK_CACHE.get(campaignId);
  if (!cached) {
    const profile = fallbackProfile(campaignId);
    const raws = profile.creators.map((creatorId, idx) =>
      buildPerformance(profile, campaignId, creatorId, idx),
    );
    cached = raws.map((r) => r.perf);
    FALLBACK_CACHE.set(campaignId, cached);
  }
  return cached;
}

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
    setTimeout(() => resolve(clone(MOCK_PERFORMANCE[campaignId] ?? getOrBuildFallback(campaignId))), 250);
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

/** 同步获取 campaign 下达人性能（旁路 listCreatorPerformance 的 250ms 延迟，供分析生成器用）。 */
export function getCreatorPerformances(campaignId: string): CreatorCampaignPerformance[] {
  return clone(MOCK_PERFORMANCE[campaignId] ?? getOrBuildFallback(campaignId));
}

/** 同步获取 campaign 版位类型汇总（旁路 listPlacementTypeSummary 的延迟）。 */
export function getPlacementTypeSummaries(campaignId: string): PlacementTypeSummary[] {
  return clone(MOCK_PLACEMENT_SUMMARY[campaignId] ?? []);
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
  const perfs = MOCK_PERFORMANCE[campaignId] ?? getOrBuildFallback(campaignId);
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
  impressions: string;
  likes: string;
  comments: string;
  shares: string;
  engagementRate: string;
}

/** 合作方式枚举。 */
const COLLAB_TYPES = ['独家定制视频', '品牌种草图文', '直播带货', '产品评测', '联名款推广', 'UGC挑战赛'] as const;

/** 达人合作概要（Campaign 级别）。 */
export interface CreatorCollabInfo {
  /** 合作方式。 */
  collabType: string;
  /** 合作状态。 */
  status: '已完成' | '进行中' | '已签约';
  /** 合同金额（CNY）。 */
  contractFee: string;
  /** 投放周期。 */
  period: string;
  /** 内容形式。 */
  contentType: string;
  /** 预估曝光。 */
  estImpressions: string;
  /** 实际曝光。 */
  actualImpressions: string;
  /** 预估互动。 */
  estEngagement: string;
  /** 实际互动。 */
  actualEngagement: string;
  /** CPE（单次互动成本）。 */
  cpe: string;
  /** CPM（千次曝光成本）。 */
  cpm: string;
  /** ROI。 */
  roi: string;
  /** 品牌词提及次数。 */
  brandMentions: number;
  /** 带 link 点击。 */
  linkClicks: string;
  /** 合作评分（1-5）。 */
  rating: number;
  /** 评价。 */
  comment: string;
}

/**
 * A creator and their work list under a campaign.
 */
export interface CreatorWithWorks {
  creatorId: string;
  creatorName: string;
  platform: string;
  tier: string;
  /** 合作详情。 */
  collab?: CreatorCollabInfo;
  posts: CreatorWorkPost[];
}

/**
 * 生成达人合作概要 mock 数据（确定性，基于 creatorId + campaignId）。
 */
function buildCollabInfo(
  creatorId: string,
  campaignId: string,
  summary: { totalImpressions: string; totalEngagement: string; avgEngagementRate: string },
  tier: string,
): CreatorCollabInfo {
  // 确定性 hash
  const seed = creatorId.charCodeAt(0) + campaignId.charCodeAt(0);
  const feeBase = tier === 'mega' ? 120000 : tier === 'macro' ? 50000 : tier === 'micro' ? 15000 : 5000;
  const fee = Math.round(feeBase * (0.8 + ((seed % 7) / 10)));
  const imprNum = parseFloat(summary.totalImpressions.replace(/[KM]/, '')) * (summary.totalImpressions.includes('K') ? 1000 : 1000000);
  const engNum = parseFloat(summary.totalEngagement.replace(/[KM]/, '')) * (summary.totalEngagement.includes('K') ? 1000 : 1000000);
  const cpe = fee / Math.max(engNum, 1);
  const cpm = (fee / Math.max(imprNum, 1)) * 1000;
  const roi = (1.5 + (seed % 20) / 10).toFixed(2);
  const statusOptions: CreatorCollabInfo['status'][] = ['已完成', '进行中', '已签约'];
  const contentTypes = ['短视频', '图文笔记', '直播切片', '评测视频', '开箱视频'];
  const comments = [
    '内容质量高，粉丝互动热烈，品牌曝光超预期',
    '达人专业度高，种草效果好，转化率优秀',
    '合作顺畅，内容贴合品牌调性，推荐复投',
    '数据表现稳定，ROI 达标，性价比高',
    '创意执行到位，评论区正向反馈居多',
  ];

  return {
    collabType: COLLAB_TYPES[seed % COLLAB_TYPES.length],
    status: statusOptions[seed % statusOptions.length],
    contractFee: `¥${fee.toLocaleString()}`,
    period: '2024.12.01 - 2024.12.15',
    contentType: contentTypes[seed % contentTypes.length],
    estImpressions: `${(imprNum * 0.85).toFixed(0)}`,
    actualImpressions: summary.totalImpressions,
    estEngagement: `${(engNum * 0.9).toFixed(0)}`,
    actualEngagement: summary.totalEngagement,
    cpe: `¥${cpe.toFixed(2)}`,
    cpm: `¥${cpm.toFixed(2)}`,
    roi,
    brandMentions: 3 + (seed % 8),
    linkClicks: `${Math.round(imprNum * 0.03).toLocaleString()}`,
    rating: 3 + (seed % 3),
    comment: comments[seed % comments.length],
  };
}

/**
 * Fetch each creator and their works under a campaign (mock, synchronous, deterministic).
 * For work-screenshot component's "select creator works" UI.
 */
export function campaignCreatorWorks(campaignId: string): CreatorWithWorks[] {
  const perfs = MOCK_PERFORMANCE[campaignId] ?? getOrBuildFallback(campaignId);
  return perfs.map((p) => ({
    creatorId: p.creatorId,
    creatorName: p.creatorName,
    platform: p.platform,
    tier: p.tier,
    collab: buildCollabInfo(p.creatorId, campaignId, p.summary, p.tier),
    posts: p.posts.map((post) => ({
      postId: post.id,
      creatorId: p.creatorId,
      creatorName: p.creatorName,
      title: post.title,
      cover: post.cover ?? '',
      platform: post.platform,
      publishedAt: post.publishedAt,
      impressions: post.impressions,
      likes: post.likes,
      comments: post.comments,
      shares: post.shares,
      engagementRate: post.engagementRate,
    })),
  }));
}

/**
 * 跨 Campaign 聚合所有达人作品（去重 by postId）。
 * 供「未绑定 Campaign」场景下的作品截图导入使用——不需要先绑定 Campaign。
 */
export function allCreatorWorks(): CreatorWithWorks[] {
  const seen = new Map<string, CreatorWithWorks>();
  for (const campaignId of Object.keys(MOCK_PERFORMANCE)) {
    for (const cw of campaignCreatorWorks(campaignId)) {
      const existing = seen.get(cw.creatorId);
      if (existing) {
        // 合并 posts（按 postId 去重）
        const existingPostIds = new Set(existing.posts.map((p) => p.postId));
        for (const post of cw.posts) {
          if (!existingPostIds.has(post.postId)) {
            existing.posts.push(post);
          }
        }
      } else {
        seen.set(cw.creatorId, { ...cw, posts: [...cw.posts] });
      }
    }
  }
  return [...seen.values()];
}

/* ------------------------------ Campaign raw exports (for product CPS engine) ------------------------------ */

/** Campaign 级原始汇总（数值，未格式化）。供 products.ts 推导商品 CPS。 */
export interface CampaignRawTotals {
  gmv: number;
  orders: number;
  clicks: number;
  impressions: number;
  commission: number;
  cpsSpend: number;
  commissionPct: number;
  aov: number;
}

/**
 * 取一个 campaign 的原始汇总数值（= Σ all creators' raw totals）。
 * 与 rollupCampaignMetrics 使用同一数据源（MOCK_RAW），保证自洽。
 */
export function campaignRawTotals(campaignId: string): CampaignRawTotals {
  const raws = MOCK_RAW[campaignId] ?? [];
  const sum = raws.reduce(
    (a, r) => ({
      gmv: a.gmv + r.totals.gmv,
      orders: a.orders + r.totals.orders,
      clicks: a.clicks + r.totals.clicks,
      impressions: a.impressions + r.totals.impressions,
      commission: a.commission + r.totals.commission,
      cpsSpend: a.cpsSpend + r.totals.cpsSpend,
    }),
    { gmv: 0, orders: 0, clicks: 0, impressions: 0, commission: 0, cpsSpend: 0 },
  );
  const profile = CAMPAIGN_PROFILE[campaignId];
  return {
    ...sum,
    commissionPct: profile?.commissionPct ?? 0.1,
    aov: profile?.aov ?? 200,
  };
}

/** 取 campaign 的多平台配置（供 products 引擎推导跨平台商品表现）。 */
export function campaignProfilePlatforms(campaignId: string): CampaignPlatformEntry[] {
  return CAMPAIGN_PROFILE[campaignId]?.platforms ?? [];
}
