import type { Scenario, ScenarioSub } from '@mediakit/shared';

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

export const SCENARIO_LABELS: Record<Scenario, string> = {
  'campaign-report': 'Campaign Report',
  'campaign-proposal': 'Campaign Proposal',
  'media-kit': 'Media Kit',
};

export const SCENARIO_SUB_LABELS: Record<ScenarioSub, string> = {
  weekly: 'Weekly',
  biweekly: 'Biweekly',
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
    ['biweekly', '双周报'],
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
