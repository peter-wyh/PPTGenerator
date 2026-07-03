import type { CampaignInfo, Scenario, ScenarioSub } from '@mediakit/shared';

/** 业务线。 */
export const BUSINESS_LINES = ['FT', 'SM', 'CX', 'DG', 'KN', 'DM'];

/** 创建人。 */
export const CREATORS = ['alex', 'stella', 'reese', 'stacey'];

/** 广告主（mock）。 */
export const ADVERTISERS = ['GlowLab', 'LUMIÈRE', 'NOVA Home', 'MOTION', 'EVERYDAY', 'WANDER'];

/** 投放平台（campaign 信息）。 */
export const PLATFORMS = ['TikTok', '抖音', '小红书', '微信', 'B站', 'YouTube'];

export interface ScenarioOption {
  id: Scenario;
  label: string;
  /** Campaign 报告的子类。 */
  subs?: [ScenarioSub, string][];
}

/** 场景目录。 */
export const SCENARIOS: ScenarioOption[] = [
  {
    id: 'campaign-report',
    label: 'Campaign 报告',
    subs: [
      ['weekly', '周报'],
      ['monthly', '月报'],
      ['wrap-up', '结案报告'],
    ],
  },
  { id: 'campaign-proposal', label: 'Campaign 提报' },
  { id: 'media-kit', label: 'Media Kit' },
];

/** 场景是否属于 campaign 类型（需要 campaign 信息）。 */
export function isCampaignScenario(s?: Scenario): boolean {
  return s === 'campaign-report' || s === 'campaign-proposal';
}

/** Campaign 类型的场景选中时，预填的 mock campaign 信息。 */
export function mockCampaignInfo(): CampaignInfo {
  return {
    campaignName: 'GlowLab Q4 上市',
    platform: 'TikTok',
    startDate: '2026-10-12',
    endDate: '2026-11-10',
    budget: '¥300K',
  };
}

export const SCENARIO_LABELS: Record<Scenario, string> = {
  'campaign-report': 'Campaign 报告',
  'campaign-proposal': 'Campaign 提报',
  'media-kit': 'Media Kit',
};

export const SCENARIO_SUB_LABELS: Record<ScenarioSub, string> = {
  weekly: '周报',
  monthly: '月报',
  'wrap-up': '结案报告',
};
