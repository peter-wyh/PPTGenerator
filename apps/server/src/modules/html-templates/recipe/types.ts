// recipe/types.ts
import type { ManifestOverrides } from './campaign-report/manifest';

export type RecipeId = 'campaign-report';

export interface RenderInput {
  campaignId: string;
  theme?: 'light' | 'dark';
  designMd?: string; // v1 保留未用
  manifestOverrides?: ManifestOverrides; // 结构编辑:组件顺序/隐藏
}

export interface Recipe {
  id: RecipeId;
  render(input: RenderInput): Promise<string>;
}
