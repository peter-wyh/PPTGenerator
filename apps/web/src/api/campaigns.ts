import type { Campaign } from '@mediakit/shared';

/**
 * 上游 Campaign 接口（demo 中 mock）。
 * 真实环境对接投放系统/CRM；这里返回固定 mock 列表，带模拟延迟。
 * campaign 类型场景（报告/提报）从本接口选择具体 campaign。
 */

const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: 'camp-glowlab-q4',
    name: 'GlowLab Q4 敏感肌精华上市',
    advertiser: 'GlowLab',
    businessLine: 'FT',
    platform: 'TikTok',
    startDate: '2026-10-12',
    endDate: '2026-11-10',
    budget: '¥300K',
    status: '投放中',
    owner: 'alex',
  },
  {
    id: 'camp-lumiere-launch',
    name: 'LUMIÈRE 抗老面霜新品首发',
    advertiser: 'LUMIÈRE',
    businessLine: 'SM',
    platform: '抖音',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    budget: '¥520K',
    status: '已结案',
    owner: 'stella',
  },
  {
    id: 'camp-nova-home-618',
    name: 'NOVA Home 618 家居大促',
    advertiser: 'NOVA Home',
    businessLine: 'CX',
    platform: '小红书',
    startDate: '2026-05-20',
    endDate: '2026-06-20',
    budget: '¥780K',
    status: '已结案',
    owner: 'reese',
  },
  {
    id: 'camp-motion-spring',
    name: 'MOTION 春季运动场景种草',
    advertiser: 'MOTION',
    businessLine: 'DG',
    platform: 'B站',
    startDate: '2026-03-01',
    endDate: '2026-04-15',
    budget: '¥260K',
    status: '已结案',
    owner: 'stacey',
  },
  {
    id: 'camp-everyday-bf',
    name: 'EVERYDAY 黑五礼赠爆发',
    advertiser: 'EVERYDAY',
    businessLine: 'KN',
    platform: 'TikTok',
    startDate: '2026-11-20',
    endDate: '2026-12-25',
    budget: '¥440K',
    status: '筹备中',
    owner: 'alex',
  },
  {
    id: 'camp-wander-summer',
    name: 'WANDER 暑期旅游内容营销',
    advertiser: 'WANDER',
    businessLine: 'DM',
    platform: '微信',
    startDate: '2026-07-01',
    endDate: '2026-08-31',
    budget: '¥360K',
    status: '投放中',
    owner: 'stella',
  },
];

/** 模拟上游拉取 campaign 列表。 */
export function listCampaigns(): Promise<Campaign[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(MOCK_CAMPAIGNS.map((c) => ({ ...c }))), 300);
  });
}

/** 按 id 取单个 campaign。 */
export function getCampaign(id: string): Promise<Campaign | undefined> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(MOCK_CAMPAIGNS.find((c) => c.id === id)), 50);
  });
}
