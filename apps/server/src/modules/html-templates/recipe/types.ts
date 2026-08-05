// recipe/types.ts
export type RecipeId = 'campaign-report';

export interface RenderInput {
  campaignId: string;
  theme?: 'light' | 'dark';
  designMd?: string; // v1 保留未用
}

export interface Recipe {
  id: RecipeId;
  render(input: RenderInput): Promise<string>;
}
