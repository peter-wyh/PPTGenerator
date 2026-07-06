import type { KpiColorToken } from '@mediakit/shared';

/**
 * kpi-board 数值主题色映射。
 * fg   = 数值文字色 + 图标前景色
 * softBg = 图标圆形底色（同色 ~12% 透明）
 * primary 走深色近似设计 token；后续可接 CSS 变量做主题联动。
 */
export const KPI_COLOR_TOKENS: Record<KpiColorToken, { fg: string; softBg: string }> = {
  primary: { fg: '#111827', softBg: '#9CA3AF1F' },
  success: { fg: '#22C55E', softBg: '#22C55E1F' },
  warning: { fg: '#F59E0B', softBg: '#F59E0B1F' },
  danger: { fg: '#EF4444', softBg: '#EF44441F' },
  info: { fg: '#3B82F6', softBg: '#3B82F61F' },
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
