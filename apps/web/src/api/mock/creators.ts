/**
 * Creator mock data (demo).
 * Extracted from original api/creators.ts to keep data & generation logic centralized.
 * metrics are aggregated across all campaigns the creator participated in (see creatorPerformance.rollupCreatorTotals).
 */
import { rollupCreatorTotals } from './creatorPerformance';
import type { Creator } from '../creators';

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
