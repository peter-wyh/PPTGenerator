import type { KpiColorToken } from '@mediakit/shared';

/**
 * kpi-board 数值主题色映射。
 * fg   = 数值文字色 + 图标前景色
 * softBg = 图标圆形底色（同色 ~12% 透明）
 * primary 走深色近似设计 token；后续可接 CSS 变量做主题联动。
 */
export const KPI_COLOR_TOKENS: Record<KpiColorToken, { fg: string; softBg: string }> = {
  primary: { fg: 'var(--foreground-primary)', softBg: 'color-mix(in srgb, var(--foreground-muted) 12%, transparent)' },
  success: { fg: 'var(--green)', softBg: 'color-mix(in srgb, var(--green) 12%, transparent)' },
  warning: { fg: 'var(--yellow)', softBg: 'color-mix(in srgb, var(--yellow) 12%, transparent)' },
  danger: { fg: 'var(--red)', softBg: 'color-mix(in srgb, var(--red) 12%, transparent)' },
  info: { fg: 'var(--blue)', softBg: 'color-mix(in srgb, var(--blue) 12%, transparent)' },
  black: { fg: '#000000', softBg: 'color-mix(in srgb, #000000 12%, transparent)' },
  white: { fg: '#fff', softBg: 'color-mix(in srgb, #fff 12%, transparent)' },
  brand: { fg: 'var(--color-primary)', softBg: 'color-mix(in srgb, var(--color-primary) 12%, transparent)' },
};

export const KPI_COLOR_OPTIONS: { token: KpiColorToken; label: string }[] = [
  { token: 'black', label: '黑色' },
  { token: 'white', label: '白色' },
  { token: 'brand', label: '品牌色' },
];

export function resolveKpiColor(token?: KpiColorToken | null) {
  return KPI_COLOR_TOKENS[token ?? 'primary'];
}
