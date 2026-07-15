import { describe, it, expect } from 'vitest';
import { KPI_COLOR_TOKENS, KPI_COLOR_OPTIONS, resolveKpiColor } from '@/editor/kpiTokens';

describe('kpiTokens', () => {
  it('旧 token 仍有 fg 与 softBg（历史数据继续渲染，不再出现在拾色器）', () => {
    for (const token of ['primary', 'success', 'warning', 'danger', 'info'] as const) {
      const c = KPI_COLOR_TOKENS[token];
      expect(typeof c.fg).toBe('string');
      expect(c.fg.length).toBeGreaterThan(0);
      expect(c.softBg).toMatch(/color-mix|^#/);
    }
  });

  it('黑/白/品牌色 token 映射到既有约定的 CSS 值', () => {
    expect(KPI_COLOR_TOKENS.black.fg).toBe('#000000');
    expect(KPI_COLOR_TOKENS.white.fg).toBe('#fff');
    expect(KPI_COLOR_TOKENS.brand.fg).toBe('var(--color-primary)');
    for (const token of ['black', 'white', 'brand'] as const) {
      expect(KPI_COLOR_TOKENS[token].softBg).toMatch(/color-mix/);
    }
  });

  it('resolveKpiColor 缺省/null 回退 primary', () => {
    expect(resolveKpiColor(undefined)).toEqual(KPI_COLOR_TOKENS.primary);
    expect(resolveKpiColor(null)).toEqual(KPI_COLOR_TOKENS.primary);
    expect(resolveKpiColor('success')).toEqual(KPI_COLOR_TOKENS.success);
  });

  it('KPI_COLOR_OPTIONS 仅露出 黑/白/品牌色', () => {
    expect(KPI_COLOR_OPTIONS.map((o) => o.token)).toEqual(['black', 'white', 'brand']);
  });
});
