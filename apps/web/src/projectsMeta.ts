import type { Advertiser, BusinessLine, CampaignInfo, Merchant, Scenario, ScenarioSub } from '@mediakit/shared';

/** 业务线。 */
export const BUSINESS_LINES = ['FT', 'SM', 'CX', 'DG', 'KN', 'DM'];

/** 创建人。 */
export const CREATORS = ['alex', 'stella', 'reese', 'stacey'];

/** 广告主（mock）。 */
export const ADVERTISERS = ['GlowLab', 'LUMIÈRE', 'NOVA Home', 'MOTION', 'EVERYDAY', 'WANDER'];

/** 业务线结构化数据（key 与 BUSINESS_LINES 一一对应）。 */
export const BUSINESS_LINE_META: Record<string, BusinessLine> = {
  FT: { code: 'FT', name: 'FineTech 芯科',    logo: 'https://placehold.co/120x120/2563eb/ffffff?text=FT' },
  SM: { code: 'SM', name: 'SocialMove 社动',  logo: 'https://placehold.co/120x120/16a34a/ffffff?text=SM' },
  CX: { code: 'CX', name: 'CosmeX 珂研',      logo: 'https://placehold.co/120x120/db2777/ffffff?text=CX' },
  DG: { code: 'DG', name: 'DigitalGo 数行',   logo: 'https://placehold.co/120x120/ea580c/ffffff?text=DG' },
  KN: { code: 'KN', name: 'KitchenNest 巢厨', logo: 'https://placehold.co/120x120/9333ea/ffffff?text=KN' },
  DM: { code: 'DM', name: 'DreamMart 梦集',   logo: 'https://placehold.co/120x120/0891b2/ffffff?text=DM' },
};

/** 商家列表（广告主通过 merchantId 引用）。 */
export const MERCHANTS: Merchant[] = [
  { id: 'm1', name: 'GlowLab 官方旗舰店',    logo: 'https://placehold.co/120x120/2563eb/ffffff?text=M1' },
  { id: 'm2', name: 'LUMIÈRE 海外旗舰店',    logo: 'https://placehold.co/120x120/1e293b/ffffff?text=M2' },
  { id: 'm3', name: 'NOVA Home 居家旗舰店',  logo: 'https://placehold.co/120x120/475569/ffffff?text=M3' },
  { id: 'm4', name: 'MOTION 运动专营店',      logo: 'https://placehold.co/120x120/dc2626/ffffff?text=M4' },
  { id: 'm5', name: 'EVERYDAY 日用品旗舰店', logo: 'https://placehold.co/120x120/65a30d/ffffff?text=M5' },
  { id: 'm6', name: 'WANDER 户外旗舰店',      logo: 'https://placehold.co/120x120/0d9488/ffffff?text=M6' },
];

/** 广告主结构化数据（key 与 ADVERTISERS 一一对应）。 */
export const ADVERTISER_META: Record<string, Advertiser> = {
  GlowLab:     { name: 'GlowLab',    merchantId: 'm1', logo: 'https://placehold.co/120x120/2563eb/ffffff?text=GL' },
  'LUMIÈRE':   { name: 'LUMIÈRE',    merchantId: 'm2', logo: 'https://placehold.co/120x120/1e293b/ffffff?text=LU' },
  'NOVA Home': { name: 'NOVA Home',  merchantId: 'm3', logo: 'https://placehold.co/120x120/475569/ffffff?text=NV' },
  MOTION:      { name: 'MOTION',     merchantId: 'm4', logo: 'https://placehold.co/120x120/dc2626/ffffff?text=MO' },
  EVERYDAY:    { name: 'EVERYDAY',   merchantId: 'm5', logo: 'https://placehold.co/120x120/65a30d/ffffff?text=EV' },
  WANDER:      { name: 'WANDER',     merchantId: 'm6', logo: 'https://placehold.co/120x120/0d9488/ffffff?text=WA' },
};

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
    budget: '$300K',
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
