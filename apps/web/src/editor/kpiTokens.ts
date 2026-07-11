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
};

export const KPI_COLOR_OPTIONS: { token: KpiColorToken; label: string }[] = [
  { token: 'primary', label: '默认' },
  { token: 'success', label: '绿' },
  { token: 'warning', label: '橙' },
  { token: 'danger', label: '红' },
  { token: 'info', label: '蓝' },
];

export function resolveKpiColor(token?: KpiColorToken | null) {
  return KPI_COLOR_TOKENS[token ?? 'primary'];
}
