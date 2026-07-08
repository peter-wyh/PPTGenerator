import type { Campaign, CampaignMetric } from '@mediakit/shared';

/**
 * 上游 Campaign 接口（demo 中 mock）。
 * 真实环境对接投放系统/CRM；这里返回固定 mock 列表，带模拟延迟。
 * campaign 类型场景（报告/提报）从本接口选择具体 campaign。
 */

/** 构造指标项，省去重复字段名。 */
const m = (label: string, value: string, compare: string): CampaignMetric => ({
  label,
  value,
  compare,
});

/** 标准 6 项投放表现指标（顺序即看板行序）。 */
const STANDARD_METRICS: Record<string, CampaignMetric[]> = {
  'camp-glowlab-q4': [
    m('花费', '¥312,400', '+18%'),
    m('展示', '2,840,000', '+12%'),
    m('点击', '89,500', '+9%'),
    m('转化', '5,420', '+22%'),
    m('点击率 (CTR)', '3.15%', '+0.3%'),
    m('投资回报率 (ROAS)', '4.2', '+0.5'),
  ],
  'camp-lumiere-launch': [
    m('花费', '¥498,700', '+6%'),
    m('展示', '1,920,000', '-4%'),
    m('点击', '61,200', '+3%'),
    m('转化', '3,880', '-8%'),
    m('点击率 (CTR)', '3.19%', '+0.2%'),
    m('投资回报率 (ROAS)', '3.4', '-0.2'),
  ],
  'camp-nova-home-618': [
    m('花费', '¥762,000', '+24%'),
    m('展示', '4,310,000', '+15%'),
    m('点击', '142,800', '+18%'),
    m('转化', '8,960', '+31%'),
    m('点击率 (CTR)', '3.31%', '+0.4%'),
    m('投资回报率 (ROAS)', '5.1', '+0.8'),
  ],
  'camp-motion-spring': [
    m('花费', '¥241,300', '-5%'),
    m('展示', '1,180,000', '+2%'),
    m('点击', '28,600', '-6%'),
    m('转化', '1,540', '-9%'),
    m('点击率 (CTR)', '2.42%', '-0.1%'),
    m('投资回报率 (ROAS)', '2.9', '-0.3'),
  ],
  'camp-everyday-bf': [
    m('花费', '¥125,000', '+40%'),
    m('展示', '980,000', '+35%'),
    m('点击', '32,400', '+28%'),
    m('转化', '1,820', '+33%'),
    m('点击率 (CTR)', '3.31%', '+0.5%'),
    m('投资回报率 (ROAS)', '3.6', '+0.4'),
  ],
  'camp-wander-summer': [
    m('花费', '¥358,200', '+11%'),
    m('展示', '1,540,000', '+7%'),
    m('点击', '41,300', '+13%'),
    m('转化', '2,260', '+16%'),
    m('点击率 (CTR)', '2.68%', '+0.2%'),
    m('投资回报率 (ROAS)', '3.9', '+0.3'),
  ],
};

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
    metrics: STANDARD_METRICS['camp-glowlab-q4'],
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
    metrics: STANDARD_METRICS['camp-lumiere-launch'],
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
    metrics: STANDARD_METRICS['camp-nova-home-618'],
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
    metrics: STANDARD_METRICS['camp-motion-spring'],
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
    metrics: STANDARD_METRICS['camp-everyday-bf'],
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
    metrics: STANDARD_METRICS['camp-wander-summer'],
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
