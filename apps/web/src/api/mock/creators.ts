/**
 * Creator mock data (demo).
 * Extracted from original api/creators.ts to keep data & generation logic centralized.
 * metrics are aggregated across all campaigns the creator participated in (see creatorPerformance.rollupCreatorTotals).
 */
import { rollupCreatorTotals } from './creatorPerformance';
import type { CampaignMetric } from '@mediakit/shared';
import type { Creator } from '../creators';

/** Creator tier（与 creatorPerformance.ts 共享）。 */
export type Tier = 'mega' | 'macro' | 'micro';

/** Creator metadata (roster); metrics injected at export time by rollupCreatorTotals. */
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
];

/** Creator mock list (with aggregated metrics injected by rollupCreatorTotals). */
export const MOCK_CREATORS: Creator[] = CREATOR_META.map((c) => ({
  ...c,
  metrics: rollupCreatorTotals(c.id),
}));

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
const money = (n: number): string => `¥${Math.round(n).toLocaleString('en-US')}`;

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
