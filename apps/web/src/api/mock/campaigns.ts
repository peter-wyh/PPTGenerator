/**
 * Campaign mock 数据（demo）。
 * 从原 api/campaigns.ts 抽离，保持数据与生成逻辑集中管理。
 * metrics 不再 hardcode，而是由「其下达人执行效果」rollup 而来（campaign = Σ creators），
 * 与达人明细（creatorPerformance.cps）保持自洽。
 */
import type { Campaign } from '@mediakit/shared';
import { rollupCampaignMetrics } from './creatorPerformance';

/** 投放 campaign 静态 mock 列表。 */
export const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: 'camp-glowlab-q4',
    name: 'GlowLab Q4 敏感肌精华上市',
    advertiser: 'GlowLab',
    businessLine: 'FT',
    platform: 'TikTok',
    startDate: '2026-10-12',
    endDate: '2026-11-10',
    budget: '$300K',
    status: '投放中',
    owner: 'alex',
    metrics: rollupCampaignMetrics('camp-glowlab-q4'),
  },
  {
    id: 'camp-lumiere-launch',
    name: 'LUMIÈRE 抗老面霜新品首发',
    advertiser: 'LUMIÈRE',
    businessLine: 'SM',
    platform: '抖音',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    budget: '$520K',
    status: '已结案',
    owner: 'stella',
    metrics: rollupCampaignMetrics('camp-lumiere-launch'),
  },
  {
    id: 'camp-nova-home-618',
    name: 'NOVA Home 618 家居大促',
    advertiser: 'NOVA Home',
    businessLine: 'CX',
    platform: '小红书',
    startDate: '2026-05-20',
    endDate: '2026-06-20',
    budget: '$780K',
    status: '已结案',
    owner: 'reese',
    metrics: rollupCampaignMetrics('camp-nova-home-618'),
  },
  {
    id: 'camp-motion-spring',
    name: 'MOTION 春季运动场景种草',
    advertiser: 'MOTION',
    businessLine: 'DG',
    platform: 'B站',
    startDate: '2026-03-01',
    endDate: '2026-04-15',
    budget: '$260K',
    status: '已结案',
    owner: 'stacey',
    metrics: rollupCampaignMetrics('camp-motion-spring'),
  },
  {
    id: 'camp-everyday-bf',
    name: 'EVERYDAY 黑五礼赠爆发',
    advertiser: 'EVERYDAY',
    businessLine: 'KN',
    platform: 'TikTok',
    startDate: '2026-11-20',
    endDate: '2026-12-25',
    budget: '$440K',
    status: '筹备中',
    owner: 'alex',
    metrics: rollupCampaignMetrics('camp-everyday-bf'),
  },
  {
    id: 'camp-wander-summer',
    name: 'WANDER 暑期旅游内容营销',
    advertiser: 'WANDER',
    businessLine: 'DM',
    platform: '微信',
    startDate: '2026-07-01',
    endDate: '2026-08-31',
    budget: '$360K',
    status: '投放中',
    owner: 'stella',
    metrics: rollupCampaignMetrics('camp-wander-summer'),
  },
];
