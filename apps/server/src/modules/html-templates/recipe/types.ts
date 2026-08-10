// recipe/types.ts
import type { ManifestOverrides } from './campaign-report/manifest';

export type RecipeId = 'campaign-report';

export interface RenderInput {
  campaignId: string;
  reportPeriod?: { startDate?: string; endDate?: string };
  theme?: 'light' | 'dark';
  designMd?: string; // v1 保留未用
  manifestOverrides?: ManifestOverrides; // 结构编辑:组件顺序/隐藏
  reportContent?: any;                    // 直接用数据快照(跳过 mapCampaign)
  tokenOverrides?: Record<string, any>;   // 风格层覆盖
}

export interface Recipe {
  id: RecipeId;
  render(input: RenderInput): Promise<string>;
}
