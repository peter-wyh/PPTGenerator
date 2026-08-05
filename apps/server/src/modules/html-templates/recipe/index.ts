// recipe/index.ts
import type { Recipe, RecipeId } from './types';
import { campaignReportRecipe } from './campaign-report';

const RECIPES: Record<RecipeId, Recipe> = {
  'campaign-report': campaignReportRecipe,
};

export function getRecipe(id?: string): Recipe {
  const recipe = RECIPES[(id ?? 'campaign-report') as RecipeId];
  if (!recipe) throw new Error(`未知 recipe: ${id}`);
  return recipe;
}

export type { Recipe, RecipeId, RenderInput } from './types';
