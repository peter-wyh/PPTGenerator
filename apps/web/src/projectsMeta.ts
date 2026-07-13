import type { Advertiser, BusinessLine, CampaignInfo, Merchant, Scenario, ScenarioSub } from '@mediakit/shared';

/** Business lines. */
export const BUSINESS_LINES = ['FT', 'SM', 'CX', 'DG', 'KN', 'DM'];

/** Project owners. */
export const CREATORS = ['alex', 'stella', 'reese', 'stacey'];

/** Advertisers (mock). */
export const ADVERTISERS = ['GlowLab', 'LUMIÈRE', 'NOVA Home', 'MOTION', 'EVERYDAY', 'WANDER'];

/** Business line structured data (key corresponds 1:1 with BUSINESS_LINES). */
export const BUSINESS_LINE_META: Record<string, BusinessLine> = {
  FT: { code: 'FT', name: 'FineTech',    logo: 'https://placehold.co/120x120/2563eb/ffffff?text=FT' },
  SM: { code: 'SM', name: 'SocialMove',  logo: 'https://placehold.co/120x120/16a34a/ffffff?text=SM' },
  CX: { code: 'CX', name: 'CosmeX',      logo: 'https://placehold.co/120x120/db2777/ffffff?text=CX' },
  DG: { code: 'DG', name: 'DigitalGo',   logo: 'https://placehold.co/120x120/ea580c/ffffff?text=DG' },
  KN: { code: 'KN', name: 'KitchenNest', logo: 'https://placehold.co/120x120/9333ea/ffffff?text=KN' },
  DM: { code: 'DM', name: 'DreamMart',   logo: 'https://placehold.co/120x120/0891b2/ffffff?text=DM' },
};

/** Merchant list (advertisers reference via merchantId). */
export const MERCHANTS: Merchant[] = [
  { id: 'm1', name: 'GlowLab Flagship Store',       logo: 'https://placehold.co/120x120/2563eb/ffffff?text=M1' },
  { id: 'm2', name: 'LUMIÈRE Global Store',          logo: 'https://placehold.co/120x120/1e293b/ffffff?text=M2' },
  { id: 'm3', name: 'NOVA Home Living Store',        logo: 'https://placehold.co/120x120/475569/ffffff?text=M3' },
  { id: 'm4', name: 'MOTION Sports Gear',             logo: 'https://placehold.co/120x120/dc2626/ffffff?text=M4' },
  { id: 'm5', name: 'EVERYDAY Essentials Store',     logo: 'https://placehold.co/120x120/65a30d/ffffff?text=M5' },
  { id: 'm6', name: 'WANDER Outdoor Store',           logo: 'https://placehold.co/120x120/0d9488/ffffff?text=M6' },
];

/** Advertiser structured data (key corresponds 1:1 with ADVERTISERS). */
export const ADVERTISER_META: Record<string, Advertiser> = {
  GlowLab:     { name: 'GlowLab',    merchantId: 'm1', logo: 'https://placehold.co/120x120/2563eb/ffffff?text=GL' },
  'LUMIÈRE':   { name: 'LUMIÈRE',    merchantId: 'm2', logo: 'https://placehold.co/120x120/1e293b/ffffff?text=LU' },
  'NOVA Home': { name: 'NOVA Home',  merchantId: 'm3', logo: 'https://placehold.co/120x120/475569/ffffff?text=NV' },
  MOTION:      { name: 'MOTION',     merchantId: 'm4', logo: 'https://placehold.co/120x120/dc2626/ffffff?text=MO' },
  EVERYDAY:    { name: 'EVERYDAY',   merchantId: 'm5', logo: 'https://placehold.co/120x120/65a30d/ffffff?text=EV' },
  WANDER:      { name: 'WANDER',     merchantId: 'm6', logo: 'https://placehold.co/120x120/0d9488/ffffff?text=WA' },
};

/** Campaign platforms. */
export const PLATFORMS = ['TikTok', 'Douyin', 'Xiaohongshu', 'WeChat', 'Bilibili', 'YouTube', 'Instagram'];

export interface ScenarioOption {
  id: Scenario;
  label: string;
  /** Campaign report sub-types. */
  subs?: [ScenarioSub, string][];
}

/** Scenario catalog. */
export const SCENARIOS: ScenarioOption[] = [
  {
    id: 'campaign-report',
    label: 'Campaign Report',
    subs: [
      ['weekly', 'Weekly'],
      ['monthly', 'Monthly'],
      ['wrap-up', 'Wrap-Up'],
    ],
  },
  { id: 'campaign-proposal', label: 'Campaign Proposal' },
  { id: 'media-kit', label: 'Media Kit' },
];

/** Whether a scenario is campaign-type (requires campaign info). */
export function isCampaignScenario(s?: Scenario): boolean {
  return s === 'campaign-report' || s === 'campaign-proposal';
}

/** Pre-filled mock campaign info for campaign-type scenarios. */
export function mockCampaignInfo(): CampaignInfo {
  return {
    campaignName: 'GlowLab Q4 Launch',
    platform: 'TikTok',
    startDate: '2026-10-12',
    endDate: '2026-11-10',
    budget: '$300K',
  };
}

export const SCENARIO_LABELS: Record<Scenario, string> = {
  'campaign-report': 'Campaign Report',
  'campaign-proposal': 'Campaign Proposal',
  'media-kit': 'Media Kit',
};

export const SCENARIO_SUB_LABELS: Record<ScenarioSub, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  'wrap-up': 'Wrap-Up',
};

/**
 * 模版类型:每个场景下的细分取值,与模板对应。
 * 前端下拉据此级联;后端只存字符串,改值不动 schema。
 * 本表为模版类型的唯一真源;SCENARIOS[].subs(campaign-report 的英文标签)为历史遗留,新代码用 TEMPLATE_TYPES。
 */
export const TEMPLATE_TYPES: Record<Scenario, [string, string][]> = {
  'campaign-report': [
    ['weekly', '周报'],
    ['monthly', '月报'],
    ['wrap-up', '总结'],
  ],
  'campaign-proposal': [
    ['lite', '简版'],
    ['standard', '标准版'],
    ['full', '完整版'],
  ],
  'media-kit': [
    ['brand', '品牌版'],
    ['creator', '达人版'],
    ['platform', '平台版'],
  ],
};

/** 模版类型标签（扁平查找，供列表/徽标用）。 */
export const TEMPLATE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  (['campaign-report', 'campaign-proposal', 'media-kit'] as Scenario[]).flatMap((s) =>
    TEMPLATE_TYPES[s].map(([id, label]) => [id, label]),
  ),
);
