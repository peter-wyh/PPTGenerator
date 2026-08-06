// overrides.ts
import { dgTokens } from './campaign-report/tokens';

/** 合并默认 tokens + 用户覆盖(只覆盖提供的 key)。 */
export function mergeTokens(overrides?: Record<string, any>): Record<string, any> {
  return { ...dgTokens, ...(overrides ?? {}) };
}
