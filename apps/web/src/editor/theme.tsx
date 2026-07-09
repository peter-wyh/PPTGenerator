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
  DEFAULT_THEME,
  FONT_OPTIONS,
  getFontStack,
  type ProjectTheme,
  type ThemeDensity,
  type ThemeRadius,
} from '@mediakit/shared';

/* ------------------------------------------------------------------ */
/* ① CSS 变量映射                                                       */
/* ------------------------------------------------------------------ */

/** 密度→间距像素派生表。 */
const DENSITY_SPACING: Record<ThemeDensity, { sm: number; md: number; lg: number }> = {
  compact: { sm: 6, md: 10, lg: 14 },
  standard: { sm: 10, md: 16, lg: 22 },
  spacious: { sm: 14, md: 20, lg: 28 },
};

/** 圆角→半径像素派生表。 */
const RADIUS_MAP: Record<ThemeRadius, { card: number; pill: number }> = {
  sharp: { card: 0, pill: 0 },
  small: { card: 8, pill: 9999 },
  large: { card: 16, pill: 9999 },
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

  const vars: Record<string, string> = {
    // 字体
    '--font-text': getFontStack(t.font.text, DEFAULT_THEME.font.text),
    '--font-number': getFontStack(t.font.number, DEFAULT_THEME.font.number),
    // 颜色（语义）
    '--color-primary': t.color.primary,
    '--color-secondary': t.color.secondary,
    '--color-neutral-text': t.color.neutralText,
    '--color-neutral-bg': t.color.neutralBg,
    // 圆角
    '--radius-card': `${radius.card}px`,
    '--radius-pill': `${radius.pill}px`,
    // 间距
    '--space-pad-sm': `${spacing.sm}px`,
    '--space-pad-md': `${spacing.md}px`,
    '--space-pad-lg': `${spacing.lg}px`,
    // 注：--accent-primary / --accent-secondary 刻意【不】在此覆盖 —— 它们是编辑器
    // chrome（选中框 / 面板高亮 / 库图标）的固定强调色，由 index.css :root 提供常量，
    // 不应随品牌色变化。品牌色统一走 --color-primary / --color-secondary（组件内容引用）。
    // 布局
    '--grid-size': `${t.layout?.gridSize ?? DEFAULT_THEME.layout!.gridSize}px`,
    '--safe-margin': `${t.layout?.safeMargin ?? DEFAULT_THEME.layout!.safeMargin}px`,
  };

  // 图表配色：--chart-1 … --chart-6
  for (let i = 0; i < 6; i++) {
    vars[`--chart-${i + 1}`] = palette[i % palette.length];
  }

  // 标题字体：缺省=跟随 text
  const headingKey = t.font.heading ?? t.font.text;
  vars['--font-heading'] = getFontStack(headingKey, DEFAULT_THEME.font.text);

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
