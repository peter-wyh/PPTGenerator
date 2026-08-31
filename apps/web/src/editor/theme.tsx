/**
 * Token 映射层：把 ProjectTheme 拆成两条通道下发给组件。
 *
 * ① CSS 变量（静态样式）—— themeToCssVars(theme) 返回 Record<string,string>，
 *    挂在编辑器根节点。组件用 var(--…) 或 Tailwind 任意值引用。
 * ② React Context（数组型 token）—— ThemeContext 只暴露 chartPalette: string[]。
 *    仅柱图/折线图/饼图组件用 useTheme() 取这个数组渲染 SVG 序列色。
 *
 * 字体加载：injectFontLinks(theme) 根据 font.text/number/heading 对应的
 * FontOption.loadUrl，把所需 <link rel="stylesheet"> 注入 <head>，按 key 去重。
 */
import { createContext, useContext } from 'react';
import type { CSSProperties } from 'react';
import {
  DEFAULT_CHART_PALETTE,
  DEFAULT_CHART_CFG,
  DEFAULT_THEME,
  FONT_OPTIONS,
  getFontStack,
  type ProjectTheme,
  type ThemeDensity,
  type ThemeRadius,
  type ThemeShadow,
} from '@mediakit/shared';

/* ------------------------------------------------------------------ */
/* ① CSS 变量映射                                                       */
/* ------------------------------------------------------------------ */

/**
 * 混合两个 HEX 颜色，ratio 为第二个颜色的占比（0-1）。
 * 用于从 neutralBg/neutralText 派生 surface/foreground 层次色。
 * 例：colorMix('#ffffff', '#000000', 0.03) → #f7f7f7
 */
function colorMix(base: string, mix: string, ratio: number): string {
  const b = hexToRgb(base);
  const m = hexToRgb(mix);
  if (!b || !m) return base;
  const r = Math.round(b.r * (1 - ratio) + m.r * ratio);
  const g = Math.round(b.g * (1 - ratio) + m.g * ratio);
  const bl = Math.round(b.b * (1 - ratio) + m.b * ratio);
  return `#${[r, g, bl].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

/** HEX → {r,g,b}；无效返回 null。 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace('#', '');
  if (h.length !== 6 && h.length !== 3) return null;
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return isNaN(r) || isNaN(g) || isNaN(b) ? null : { r, g, b };
}

/** 密度→间距像素派生表。 */
const DENSITY_SPACING: Record<ThemeDensity, { sm: number; md: number; lg: number }> = {
  compact: { sm: 6, md: 10, lg: 14 },
  standard: { sm: 10, md: 16, lg: 22 },
  comfortable: { sm: 12, md: 18, lg: 25 },
  spacious: { sm: 14, md: 20, lg: 28 },
};

/** 圆角→半径像素派生表。 */
const RADIUS_MAP: Record<ThemeRadius, { card: number; pill: number }> = {
  sharp: { card: 0, pill: 0 },
  small: { card: 8, pill: 9999 },
  medium: { card: 12, pill: 9999 },
  large: { card: 16, pill: 9999 },
};

/** 阴影档位 → box-shadow 值。rgba 黑色用 var(--shadow-color)，暗色主题可覆盖。 */
const SHADOW_MAP: Record<ThemeShadow, string> = {
  none: 'none',
  subtle: '0 1px 2px var(--shadow-color, rgba(0,0,0,.05))',
  soft: '0 2px 8px var(--shadow-color, rgba(0,0,0,.08))',
  strong: '0 8px 24px var(--shadow-color, rgba(0,0,0,.12))',
};

/**
 * 把 ProjectTheme 映射成 CSS 变量键值对。
 * 返回值可直接展开到 React style 属性（key 形如 '--color-primary'）。
 */
export function themeToCssVars(theme: ProjectTheme | null | undefined): CSSProperties {
  const t = theme ?? DEFAULT_THEME;
  const spacing = DENSITY_SPACING[t.density] ?? DENSITY_SPACING.standard;
  const radius = RADIUS_MAP[t.radius] ?? RADIUS_MAP.small;
  const palette = t.color.chartPalette.length
    ? t.color.chartPalette
    : [...DEFAULT_CHART_PALETTE];
  const lh = t.lineHeight ?? DEFAULT_THEME.lineHeight!;

  const vars: Record<string, string> = {
    // 字体
    '--font-text': getFontStack(t.font.text, DEFAULT_THEME.font.text),
    '--font-number': getFontStack(t.font.number, DEFAULT_THEME.font.number),
    // 字重
    '--font-weight-heading': String(t.font.weight?.heading ?? 600),
    '--font-weight-body': String(t.font.weight?.body ?? 500),
    '--font-weight-label': String(t.font.weight?.label ?? 500),
    // 颜色（语义）
    '--color-primary': t.color.primary,
    '--color-secondary': t.color.secondary,
    '--color-neutral-text': t.color.neutralText,
    '--color-neutral-bg': t.color.neutralBg,
    // 表面色层次：主题自定义优先，缺省由 neutralBg 派生
    '--surface-primary': t.color.surface?.primary ?? t.color.neutralBg,
    '--surface-subtle': t.color.surface?.subtle ?? colorMix(t.color.neutralBg, '#000', 0.03),
    '--surface-hover': t.color.surface?.hover ?? colorMix(t.color.neutralBg, '#000', 0.06),
    // 前景色层次：主题自定义优先，缺省由 neutralText 派生
    '--foreground-primary': t.color.foreground?.primary ?? t.color.neutralText,
    '--foreground-secondary': t.color.foreground?.secondary ?? colorMix(t.color.neutralText, '#000', 0.35),
    '--foreground-muted': t.color.foreground?.muted ?? colorMix(t.color.neutralText, '#000', 0.5),
    // 边框色：主题自定义优先，缺省用固定浅灰
    '--border-default': t.color.borderColor ?? '#e5e7eb',
    '--border-subtle': t.color.borderColor ? `${t.color.borderColor}80` : '#f3f4f6',
    // 圆角
    '--radius-card': `${radius.card}px`,
    '--radius-pill': `${radius.pill}px`,
    // 间距（padding 层级）
    '--space-pad-sm': `${spacing.sm}px`,
    '--space-pad-md': `${spacing.md}px`,
    '--space-pad-lg': `${spacing.lg}px`,
    // 间距（gap 层级）：与 density 联动
    '--space-gap-xs': `${Math.round(spacing.sm * 0.4)}px`,
    '--space-gap-sm': `${Math.round(spacing.sm * 0.8)}px`,
    '--space-gap-md': `${Math.round(spacing.md * 0.75)}px`,
    '--space-gap-lg': `${spacing.md}px`,
    // 注：--accent-primary / --accent-secondary 刻意【不】在此覆盖 —— 它们是编辑器
    // chrome（选中框 / 面板高亮 / 库图标）的固定强调色，由 index.css :root 提供常量，
    // 不应随品牌色变化。品牌色统一走 --color-primary / --color-secondary（组件内容引用）。
    // 布局
    '--grid-size': `${t.layout?.gridSize ?? DEFAULT_THEME.layout!.gridSize}px`,
    '--safe-margin': `${t.layout?.safeMargin ?? DEFAULT_THEME.layout!.safeMargin}px`,
    // v2：行高 / 卡片阴影
    '--line-height': lh.mode === 'fixed' ? `calc(1em + ${lh.value}px)` : String(lh.value),
    '--shadow-card': SHADOW_MAP[t.shadow ?? DEFAULT_THEME.shadow!],
    // 阴影色：亮色主题用黑色低透明，暗色主题可覆盖为黑色更高透明
    '--shadow-color': 'rgba(0,0,0,.08)',
  };

  // 图表配色：--chart-1 … --chart-6
  for (let i = 0; i < 6; i++) {
    vars[`--chart-${i + 1}`] = palette[i % palette.length];
  }

  // v3 0831 毛玻璃升级(参考图档):玻璃=true 时注入;数值契约与 recipe 报告
  // tokens.ts 对齐(specs/2026-08-31 §2)。背景四层 bokeh 走 --page-bg,
  // 由 background.ts 缺省背景消费(Canvas 页面层)。
  // 注:glass 开关为持久化可选字段(shared schema 暂未声明),此处宽松读取。
  if ((t as { glass?: boolean }).glass === true) {
    Object.assign(vars, {
      '--card-bg': `color-mix(in srgb, ${t.color.surface?.primary ?? t.color.neutralBg} 55%, transparent)`,
      '--card-border': `color-mix(in srgb, ${t.color.foreground?.primary ?? t.color.neutralText} 10%, transparent)`,
      '--card-blur': 'blur(22px) saturate(150%)',
      '--card-glow': 'rgba(255,255,255,0.9)',
      '--card-border-top': 'rgba(255,255,255,0.85)',
      '--card-border-left': 'rgba(255,255,255,0.45)',
      '--card-border-right': 'rgba(255,255,255,0.25)',
      '--card-border-bottom': 'rgba(255,255,255,0.15)',
      '--card-sheen': 'rgba(255,255,255,0.5)',
      '--card-sheen-soft': 'rgba(255,255,255,0.18)',
      '--page-bg': [
        'radial-gradient(circle at 88% 10%, rgba(255,9,158,0.30), transparent 40%)',
        'radial-gradient(circle at 8% 30%, rgba(99,102,241,0.26), transparent 38%)',
        'radial-gradient(circle at 55% 85%, rgba(250,166,133,0.30), transparent 34%)',
        'linear-gradient(160deg, #d8dde6 0%, #e8ebf0 50%, #f6f7f9 100%)',
      ].join(', '),
    });
  }

  // 标题字体：缺省=跟随 text
  const headingKey = t.font.heading ?? t.font.text;
  vars['--font-heading'] = getFontStack(headingKey, DEFAULT_THEME.font.text);

  // 标题字号：全局 heading.fontSize（标题块组件 fontSize 缺省时取此值）
  if (typeof t.heading?.fontSize === 'number') {
    vars['--heading-font-size'] = `${t.heading.fontSize}px`;
  }

  return vars as CSSProperties;
}

/* ------------------------------------------------------------------ */
/* ② React Context（数组型 token）                                      */
/* ------------------------------------------------------------------ */

export interface ThemeContextValue {
  /** 图表配色序列（6 色），柱/折/饼组件按 index 取色。 */
  chartPalette: string[];
  /** 当前完整主题（供需要读取非 CSS 变量字段的组件使用）。 */
  theme: ProjectTheme;
}

const DEFAULT_CONTEXT: ThemeContextValue = {
  chartPalette: [...DEFAULT_CHART_PALETTE],
  theme: DEFAULT_THEME,
};

export const ThemeContext = createContext<ThemeContextValue>(DEFAULT_CONTEXT);

/** 读取主题 context：chartPalette（数组型）+ theme（完整对象）。 */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/* ------------------------------------------------------------------ */
/* 图表统一样式（recharts 消费）                                       */
/* ------------------------------------------------------------------ */

/** recharts 图表可消费的统一样式（由 theme.chart 派生）。 */
export interface ChartStyle {
  showGrid: boolean;
  showAxis: boolean;
  legend:
    | false
    | { verticalAlign: 'top' | 'bottom' | 'middle'; align?: 'center' | 'right'; layout?: 'horizontal' | 'vertical' };
  barRadius: number;
}

/** 把 theme.chart 归一为 recharts 可消费的样式（纯函数，便于单测）。 */
export function resolveChartStyle(chart: ProjectTheme['chart'] | undefined): ChartStyle {
  const c = chart ?? DEFAULT_CHART_CFG;
  const legend: ChartStyle['legend'] =
    c.legendPosition === 'none'
      ? false
      : c.legendPosition === 'top'
        ? { verticalAlign: 'top' }
        : c.legendPosition === 'right'
          ? { verticalAlign: 'middle', align: 'right', layout: 'vertical' }
          : { verticalAlign: 'bottom' };
  return { showGrid: c.showGrid, showAxis: c.showAxis, legend, barRadius: c.barRadius };
}

/** 组件内读取图表统一样式（经 ThemeContext 取 theme.chart）。 */
export function useChartStyle(): ChartStyle {
  const { theme } = useTheme();
  return resolveChartStyle(theme.chart);
}

/* ------------------------------------------------------------------ */
/* 字体 <link> 注入                                                     */
/* ------------------------------------------------------------------ */

/** 已注入的字体 key 集合（模块级去重，避免重复挂载）。 */
const injectedFontKeys = new Set<string>();

/**
 * 根据当前主题的 font.text/number/heading，把对应的 Google Fonts <link> 注入 <head>。
 * 按 FontOption.key 去重；切换字体时旧 link 保留（避免已挂载文字闪退），新增按需追加。
 * 在 SSR / 非 DOM 环境（如预览导出）安全跳过。
 */
export function injectFontLinks(theme: ProjectTheme | null | undefined): void {
  if (typeof document === 'undefined') return;
  const t = theme ?? DEFAULT_THEME;
  const keys = [t.font.text, t.font.number, t.font.heading].filter(
    (k): k is string => !!k,
  );
  for (const key of keys) {
    if (injectedFontKeys.has(key)) continue;
    const opt = FONT_OPTIONS.find((f) => f.key === key);
    if (!opt?.loadUrl) {
      injectedFontKeys.add(key); // 标记已处理（无 loadUrl 也不重试）
      continue;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = opt.loadUrl;
    link.dataset.fontKey = key;
    document.head.appendChild(link);
    injectedFontKeys.add(key);
  }
}
