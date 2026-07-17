/**
 * Creator mock data (demo) — the 达人库 (creator library), the master roster.
 * metrics are creator-level channel KPIs (Avg Reach / Impressions / Follower Growth / CPM),
 * deterministically derived from tier × platform — NOT from any campaign.
 * Campaign-collaboration creator data lives in creatorPerformance.ts and references these ids.
 */
import { formatMoney, DEFAULT_FORMAT } from '@mediakit/shared';
import type { CampaignMetric } from '@mediaket/shared';
import type { PostDaily } from '@mediaket/shared';
import type { Creator } from '../creators';
import { creatorAvatarUrl, creatorProfileUrl } from '../creatorAvatar';

/** Creator tier（与 creatorPerformance.ts 共享）。 */
export type Tier = 'mega' | 'macro' | 'micro';

/** Creator metadata (roster); channel metrics injected at export time by buildChannelMetrics. */
export const CREATOR_META: Omit<Creator, 'metrics'>[] = [
  {
    id: 'cre-mia',
    name: 'Mia Chen',
    handle: '@miaglowup',
    platform: 'TikTok',
    tier: 'mega',
    followers: '1.28M',
    engagement: '8.7%',
    category: 'Beauty',
    region: 'US / UK',
  },
  {
    id: 'cre-sofia',
    name: 'Sofia Lane',
    handle: '@sofialane',
    platform: 'TikTok',
    tier: 'macro',
    followers: '684K',
    engagement: '6.2%',
    category: 'Skincare',
    region: 'US',
  },
  {
    id: 'cre-ava',
    name: 'Ava Park',
    handle: '@avapark.daily',
    platform: 'Instagram',
    tier: 'macro',
    followers: '312K',
    engagement: '7.8%',
    category: 'Lifestyle',
    region: 'CN',
  },
  {
    id: 'cre-jamie',
    name: 'Jamie Wu',
    handle: '@jamiewu',
    platform: 'Douyin',
    tier: 'micro',
    followers: '86K',
    engagement: '11.4%',
    category: 'Beauty',
    region: 'CN',
  },
  {
    id: 'cre-leo',
    name: 'Leo Sato',
    handle: '@leosato',
    platform: 'YouTube',
    tier: 'mega',
    followers: '2.10M',
    engagement: '5.1%',
    category: 'Tech',
    region: 'JP',
  },
  {
    id: 'cre-nora',
    name: 'Nora Kim',
    handle: '@nora.kim',
    platform: 'Instagram',
    tier: 'macro',
    followers: '458K',
    engagement: '6.9%',
    category: 'Fashion',
    region: 'KR',
  },
  {
    id: 'cre-tom',
    name: 'Tom Reyes',
    handle: '@tomreyes',
    platform: 'TikTok',
    tier: 'micro',
    followers: '54K',
    engagement: '12.1%',
    category: 'Food',
    region: 'US',
  },
  {
    id: 'cre-iris',
    name: 'Iris Lin',
    handle: '@iris.lin',
    platform: 'Xiaohongshu',
    tier: 'macro',
    followers: '398K',
    engagement: '9.1%',
    category: 'Skincare',
    region: 'CN',
  },
  {
    id: 'cre-kenji',
    name: 'Kenji Mori',
    handle: '@kenjimori',
    platform: 'Bilibili',
    tier: 'mega',
    followers: '1.74M',
    engagement: '6.4%',
    category: 'Tech',
    region: 'CN',
  },
  {
    id: 'cre-priya',
    name: 'Priya Rao',
    handle: '@priya.rao',
    platform: 'Instagram',
    tier: 'micro',
    followers: '62K',
    engagement: '10.8%',
    category: 'Food',
    region: 'IN',
  },
  {
    id: 'cre-marcus',
    name: 'Marcus Bell',
    handle: '@marcusbell',
    platform: 'YouTube',
    tier: 'macro',
    followers: '521K',
    engagement: '5.8%',
    category: 'Fitness',
    region: 'US',
  },
  {
    id: 'cre-yuki',
    name: 'Yuki Tanaka',
    handle: '@yuki.tanaka',
    platform: 'Xiaohongshu',
    tier: 'micro',
    followers: '48K',
    engagement: '11.9%',
    category: 'Fashion',
    region: 'JP',
  },
];

/* ------------------------------ Channel metrics ------------------------------ */

/** Tier 频道基线（确定性量级，mega > macro > micro）。 */
const TIER_CHANNEL_BASE: Record<
  Tier,
  { reach: number; impressions: number; growth: number; cpm: number }
> = {
  mega: { reach: 2_400_000, impressions: 18_000_000, growth: 38_000, cpm: 120 },
  macro: { reach: 720_000, impressions: 5_400_000, growth: 11_000, cpm: 98 },
  micro: { reach: 180_000, impressions: 1_150_000, growth: 3_000, cpm: 74 },
};

/** 视频平台 reach/impressions 上浮（相对图文平台）。 */
const VIDEO_PLATFORMS = new Set(['TikTok', 'Douyin', 'Bilibili', 'YouTube']);

/** 确定性 per-index 抖动（同 creatorPerformance POST_JITTER 模式，无 RNG）。 */
const CHANNEL_JITTER = [1.0, 0.88, 1.12, 0.94, 1.06, 0.82, 1.15, 0.9, 1.03, 0.77, 1.09, 0.85];

const compact = (n: number): string => {
  const v = Math.round(n);
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(v);
};
const money = (n: number): string => formatMoney(n, DEFAULT_FORMAT);

/**
 * 生成达人的频道级 KPI 指标（确定性，**非** campaign 反推）。
 * @param meta 花名册条目（取 tier + platform）
 * @param index 该达人在达人库中的序号（驱动确定性抖动）
 */
export function buildChannelMetrics(
  meta: Omit<Creator, 'metrics'>,
  index: number,
): CampaignMetric[] {
  const base = TIER_CHANNEL_BASE[meta.tier as Tier] ?? TIER_CHANNEL_BASE.micro;
  const jit = CHANNEL_JITTER[index % CHANNEL_JITTER.length];
  const videoFactor = VIDEO_PLATFORMS.has(meta.platform) ? 1.15 : 0.9;
  return [
    { label: 'Avg Reach', value: compact(base.reach * jit * videoFactor), compare: '' },
    { label: 'Impressions', value: compact(base.impressions * jit * videoFactor), compare: '' },
    { label: 'Follower Growth', value: `+${compact(base.growth * jit)}`, compare: '' },
    { label: 'CPM', value: money(base.cpm * jit), compare: '' },
  ];
}

/* ------------------------------ Audience / Works / Stats ------------------------------ */

/** stat 配色（内联，避免 api→editor 跨层依赖）。 */
const STAT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

/** 按地区取 top 城市池。 */
const CITY_POOL: Record<string, string[]> = {
  US: ['New York', 'Los Angeles', 'Chicago', 'Houston'],
  'US / UK': ['New York', 'Los Angeles', 'Chicago', 'Houston'],
  CN: ['上海', '北京', '广州', '深圳'],
  JP: ['Tokyo', 'Osaka', 'Yokohama', 'Nagoya'],
  KR: ['Seoul', 'Busan', 'Incheon', 'Daegu'],
  IN: ['Mumbai', 'Delhi', 'Bangalore', 'Chennai'],
};
const DEFAULT_CITIES = ['New York', 'Los Angeles', 'Chicago', 'Houston'];

/**
 * 生成达人受众画像（确定性：genderSplit/ageRange/topCities）。
 * 抖动取自 CHANNEL_JITTER（与 buildChannelMetrics 同模式，无 RNG）。
 * @param meta 花名册条目（取 region）
 * @param index 该达人在达人库中的序号（驱动确定性抖动）
 */
export function buildAudience(
  meta: Omit<Creator, 'metrics'>,
  index: number,
): NonNullable<Creator['audience']> {
  // 双种子确定性哈希：name + index 确保不同达人画像差异明显
  let h1 = 0, h2 = 0;
  const src = meta.name + ':' + meta.id;
  for (let i = 0; i < src.length; i++) {
    const ch = src.charCodeAt(i);
    h1 = ((h1 << 5) - h1 + ch) | 0;
    h2 = ((h2 << 7) - h2 + ch * 31) | 0;
  }
  const s1 = Math.abs(h1), s2 = Math.abs(h2);
  const jit = CHANNEL_JITTER[index % CHANNEL_JITTER.length];

  // 性别：30%~80% 女性
  const female = Math.min(80, Math.max(30, Math.round(50 + (s1 % 35) - 17) * jit));
  // 年龄分布：基线 + hash 偏移
  const ageBases = [
    { label: '18-24', base: 15 + (s2 % 18) },
    { label: '25-34', base: 28 + (s1 % 18) },
    { label: '35-44', base: 15 + (s2 % 15) },
    { label: '45+', base: 8 + (s1 % 12) },
  ];
  const ageSum = ageBases.reduce((s, x) => s + x.base, 0) || 1;
  // 城市
  const cities = CITY_POOL[meta.region] ?? DEFAULT_CITIES;
  const cityBases = [
    25 + (s2 % 12),
    18 + (s1 % 10),
    12 + (s2 % 8),
    8 + (s1 % 7),
  ];
  const citySum = cityBases.reduce((s, x) => s + x, 0) || 1;
  return {
    genderSplit: [
      { label: 'Female', value: female },
      { label: 'Male', value: 100 - female },
    ],
    ageRange: ageBases.map((a) => ({ label: a.label, value: Math.round((a.base / ageSum) * 100) })),
    topCities: cities.map((label, i) => ({ label, value: Math.round((cityBases[i] / citySum) * 100) })),
  };
}

/** 作品标题池（按 category 取，内联确定性）。 */
const WORK_TITLE_POOL: Record<string, string[]> = {
  Beauty: ['Summer Glow Routine', 'Sensitive Skin Review', 'Get Ready With Me'],
  Skincare: ['AM Skincare Routine', 'Vitamin C Review', 'Skin Barrier Tips'],
  Lifestyle: ['Day in My Life', 'Apartment Tour', 'Weekend Vlog'],
  Tech: ['Unboxing & First Look', 'Hands-on Review', 'Setup Tour'],
  Fashion: ['Outfit Ideas', 'Seasonal Lookbook', 'Styling Tips'],
  Fitness: ['Full Body Workout', 'Meal Prep', 'Form Check'],
  Food: ['Easy Recipe', 'Restaurant Review', 'Grocery Haul'],
};
const DEFAULT_TITLES = ['Brand Collab', 'Product Review', 'Daily Vlog'];

/**
 * 生成达人作品列表（内联确定性；不依赖 creatorPerformance，避免循环依赖）。
 * creatorPerformance.ts 已 import CREATOR_META，若此处反向 import 会形成循环
 * 且 MOCK_CREATORS 在模块顶层急切求值 → 循环会破坏。
 */
export function buildWorks(
  meta: Omit<Creator, 'metrics'>,
  index: number,
): NonNullable<Creator['works']> {
  const pool = WORK_TITLE_POOL[meta.category] ?? DEFAULT_TITLES;
  return pool.map((title, i) => {
    const jit = CHANNEL_JITTER[(index + i) % CHANNEL_JITTER.length];
    const base = (TIER_CHANNEL_BASE[meta.tier as Tier] ?? TIER_CHANNEL_BASE.micro).impressions / 10;
    const impressions = Math.round(base * jit);
    const likes = Math.round(impressions * 0.08);
    const comments = Math.round(impressions * 0.005);
    const shares = Math.round(impressions * 0.012);
    const saves = Math.round(impressions * 0.02);
    const pubDate = new Date(`2026-0${(i % 6) + 1}-${String(((index + i) % 28) + 1).padStart(2, '0')}`);

    // 确定性 S 曲线权重（14天）
    const weights = [0.01, 0.015, 0.025, 0.04, 0.06, 0.08, 0.1, 0.11, 0.1, 0.09, 0.08, 0.06, 0.04, 0.035];
    const sumW = weights.reduce((a, b) => a + b, 0);
    const daily: PostDaily[] = weights.map((w, di) => {
      const date = new Date(pubDate.getTime() + di * 86400000);
      return {
        date: date.toISOString().slice(0, 10),
        impressions: Math.round(impressions * w / sumW).toLocaleString(),
        likes: Math.round(likes * w / sumW).toLocaleString(),
        comments: Math.round(comments * w / sumW).toLocaleString(),
        shares: Math.round(shares * w / sumW).toLocaleString(),
        saves: Math.round(saves * w / sumW).toLocaleString(),
      };
    });

    return {
      id: `${meta.id}-work-${i + 1}`,
      title,
      cover: `https://picsum.photos/seed/${encodeURIComponent(meta.name + '-' + i)}/400/400`,
      platform: meta.platform,
      publishedAt: `2026-0${(i % 6) + 1}-${String(((index + i) % 28) + 1).padStart(2, '0')}`,
      impressions: compact(base * jit),
      likes: compact(base * jit * 0.08),
      comments: compact(base * jit * 0.005),
      shares: compact(base * jit * 0.012),
      saves: compact(base * jit * 0.02),
      engagementRate: `${(8 * jit).toFixed(1)}%`,
      daily,
    };
  });
}

/**
 * 生成频道 stat 项（Followers/Engagement/Avg Reach/Impressions）。
 * 后两项复用 buildChannelMetrics 的确定性量级，前两项取 meta 原文。
 */
export function buildStats(
  meta: Omit<Creator, 'metrics'>,
  index: number,
): NonNullable<Creator['stats']> {
  const m = buildChannelMetrics(meta, index); // [Avg Reach, Impressions, Follower Growth, CPM]
  return [
    { key: 'followers', label: 'Followers', value: meta.followers, color: STAT_COLORS[0] },
    { key: 'engagement', label: 'Engagement', value: meta.engagement, color: STAT_COLORS[1] },
    { key: 'reach', label: 'Avg Reach', value: m[0].value, color: STAT_COLORS[2] },
    { key: 'impressions', label: 'Impressions', value: m[1].value, color: STAT_COLORS[3] },
  ];
}

/** Creator mock list (the 达人库) with channel-level metrics + audience/works/stats injected. */
export const MOCK_CREATORS: Creator[] = CREATOR_META.map((c, i) => ({
  ...c,
  profileUrl: creatorProfileUrl(c.handle, c.platform),
  avatar: creatorAvatarUrl(c.name),
  recentPostsCount: 12 + (i % 8) * 3,
  engagementMedian: `${(3 + (i % 5) * 0.7).toFixed(1)}%`,
  metrics: buildChannelMetrics(c, i),
  audience: buildAudience(c, i),
  works: buildWorks(c, i),
  stats: buildStats(c, i),
}));
