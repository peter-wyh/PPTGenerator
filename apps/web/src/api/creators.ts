/**
 * 上游达人（Creator / Influencer）接口（demo 中 mock）。
 * 真实环境对接达人库/CRM；这里返回固定 mock 列表，带模拟延迟。
 * metrics 为跨该达人参与的所有 campaign 的汇总（见 creatorPerformance.rollupCreatorTotals）。
 */
import type { CampaignMetric } from '@mediakit/shared';
import { rollupCreatorTotals } from './creatorPerformance';

export interface Creator {
  id: string;
  name: string;
  handle: string;
  platform: string;
  tier: string; // 头部 / 腰部 / KOC
  followers: string;
  engagement: string;
  category: string;
  region: string;
  /** 跨该达人参与的所有 campaign 的汇总指标（GMV/ROAS/转化/佣金）。 */
  metrics: CampaignMetric[];
}

/** 达人元数据（花名册）；metrics 在导出时由 rollupCreatorTotals 注入。 */
const CREATOR_META: Omit<Creator, 'metrics'>[] = [
  {
    id: 'cre-mia',
    name: 'Mia Chen',
    handle: '@miaglowup',
    platform: 'TikTok',
    tier: '头部',
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
    tier: '腰部',
    followers: '684K',
    engagement: '6.2%',
    category: 'Skincare',
    region: 'US',
  },
  {
    id: 'cre-ava',
    name: 'Ava Park',
    handle: '@avapark.daily',
    platform: '小红书',
    tier: '腰部',
    followers: '312K',
    engagement: '7.8%',
    category: 'Lifestyle',
    region: 'CN',
  },
  {
    id: 'cre-jamie',
    name: 'Jamie Wu',
    handle: '@jamiewu',
    platform: '抖音',
    tier: 'KOC',
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
    tier: '头部',
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
    tier: '腰部',
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
    tier: 'KOC',
    followers: '54K',
    engagement: '12.1%',
    category: 'Food',
    region: 'US',
  },
];

const MOCK_CREATORS: Creator[] = CREATOR_META.map((c) => ({
  ...c,
  metrics: rollupCreatorTotals(c.id),
}));

/** 模拟上游拉取达人列表。 */
export function listCreators(): Promise<Creator[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(MOCK_CREATORS.map((c) => ({ ...c }))), 300);
  });
}
