import { describe, it, expect } from 'vitest';
import { KPI_COLOR_TOKENS, KPI_COLOR_OPTIONS, resolveKpiColor } from '@/editor/kpiTokens';

describe('kpiTokens', () => {
  it('5 个 token 各有 fg 与 softBg', () => {
    for (const token of ['primary', 'success', 'warning', 'danger', 'info'] as const) {
      const c = KPI_COLOR_TOKENS[token];
      expect(typeof c.fg).toBe('string');
      expect(c.fg.length).toBeGreaterThan(0);
      expect(c.softBg).toMatch(/color-mix|^#/);
    }
  });

  it('resolveKpiColor 缺省/null 回退 primary', () => {
    expect(resolveKpiColor(undefined)).toEqual(KPI_COLOR_TOKENS.primary);
    expect(resolveKpiColor(null)).toEqual(KPI_COLOR_TOKENS.primary);
    expect(resolveKpiColor('success')).toEqual(KPI_COLOR_TOKENS.success);
  });

  it('KPI_COLOR_OPTIONS 覆盖 5 个 token', () => {
    expect(KPI_COLOR_OPTIONS.map((o) => o.token)).toEqual([
      'primary', 'success', 'warning', 'danger', 'info',
    ]);
  });
});
