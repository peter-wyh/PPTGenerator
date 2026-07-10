/**
 * 主题 / 报告 / 渐变 工具函数。
 * 类型来自 ../types/* 与 ../theme/presets。
 */
import type { ProjectTheme, ThemeDensity, ThemeRadius, ProjectMeta, ThemeShadow, ThemeFormat } from '../types/theme';
import type { PageGradient, GradientStop } from '../types/page';
import { FONT_OPTIONS, DEFAULT_THEME, DEFAULT_FORMAT } from './presets';

/** 按 key 查找 FontOption.stack；找不到时回退到默认 stack。 */
export function getFontStack(key: string | undefined, fallbackKey: string): string {
  if (key) {
    const opt = FONT_OPTIONS.find((f) => f.key === key);
    if (opt) return opt.stack;
  }
  const fb = FONT_OPTIONS.find((f) => f.key === fallbackKey);
  return fb?.stack ?? fallbackKey;
}

/** structuredClone 容错（部分环境无此 API）。 */
function structuredCloneSafe<T>(v: T): T {
  if (typeof structuredClone === 'function') return structuredClone(v);
  return JSON.parse(JSON.stringify(v));
}

/**
 * 把任意形状（旧扁平 / 新结构化 / 空）归一为标准 ProjectTheme。
 * - 旧字段 primary→color.primary、secondary→color.secondary、fontFamily→font.text（按 stack 反查 key）
 * - 缺失字段用 DEFAULT_THEME 补齐
 * - 不抛错，容错所有边界
 */
export function normalizeTheme(raw: unknown): ProjectTheme {
  const d = DEFAULT_THEME;
  if (!raw || typeof raw !== 'object') return structuredCloneSafe(d);

  const obj = raw as Record<string, unknown>;

  // ---- 新结构：color / font / density / radius / preset ----
  const colorRaw = obj.color as Record<string, unknown> | undefined;
  const fontRaw = obj.font as Record<string, unknown> | undefined;

  // 旧扁平字段（向后兼容）
  const legacyPrimary = obj.primary as string | undefined;
  const legacySecondary = obj.secondary as string | undefined;
  const legacyFontFamily = obj.fontFamily as string | undefined;

  // 解析 font key：旧 fontFamily 是 CSS stack 值，需反查 key
  let textKey = d.font.text;
  if (fontRaw?.text && typeof fontRaw.text === 'string') {
    textKey = fontRaw.text;
  } else if (legacyFontFamily) {
    // 旧 fontFamily 是 stack，尝试反查；查不到就保留 stack 但存 'inter' 作 key
    const found = FONT_OPTIONS.find((f) => f.stack === legacyFontFamily || f.stack.includes(legacyFontFamily));
    textKey = found?.key ?? 'inter';
  }

  let numberKey = d.font.number;
  if (fontRaw?.number && typeof fontRaw.number === 'string') {
    numberKey = fontRaw.number;
  }

  let headingKey: string | undefined = d.font.heading;
  if (fontRaw && 'heading' in fontRaw) {
    headingKey = fontRaw.heading as string | undefined;
  }

  // 图表配色：6 色
  let chartPalette = [...d.color.chartPalette];
  if (Array.isArray(colorRaw?.chartPalette)) {
    chartPalette = (colorRaw!.chartPalette as unknown[]).filter((c): c is string => typeof c === 'string');
    while (chartPalette.length < 6) chartPalette.push(d.color.chartPalette[chartPalette.length % 6]);
    chartPalette = chartPalette.slice(0, 6);
  }

  const density = (obj.density as ThemeDensity) ?? d.density;
  const radius = (obj.radius as ThemeRadius) ?? d.radius;
  const preset = typeof obj.preset === 'string' ? obj.preset : obj.preset === undefined ? d.preset : undefined;

  // ---- layout：缺对象整体补默认；部分缺字段按字段补；非法值回退 ----
  const layoutRaw = obj.layout as Record<string, unknown> | undefined;
  const dLayout = d.layout!;
  const parseGridNum = (v: unknown, def: number, min: number): number => {
    const n = Number(v);
    return Number.isFinite(n) && n >= min ? Math.round(n) : def;
  };
  const layout = {
    safeMargin: parseGridNum(layoutRaw?.safeMargin, dLayout.safeMargin, 0),
    gridSize: parseGridNum(layoutRaw?.gridSize, dLayout.gridSize, 1),
    showGrid: typeof layoutRaw?.showGrid === 'boolean' ? layoutRaw.showGrid : dLayout.showGrid,
    showSafeArea: typeof layoutRaw?.showSafeArea === 'boolean' ? layoutRaw.showSafeArea : dLayout.showSafeArea,
  };

  // ---- branding：可选，部分缺字段补默认 ----
  const brandingRaw = obj.branding as Record<string, unknown> | undefined;
  const dB = d.branding!;
  const branding = brandingRaw
    ? {
        logo: typeof brandingRaw.logo === 'string' ? brandingRaw.logo : dB.logo,
        title: typeof brandingRaw.title === 'string' ? brandingRaw.title : dB.title,
        subtitle: typeof brandingRaw.subtitle === 'string' ? brandingRaw.subtitle : dB.subtitle,
        logoHeight: parseGridNum(brandingRaw.logoHeight, dB.logoHeight!, 8),
        logoRadius: parseGridNum(brandingRaw.logoRadius, dB.logoRadius!, 0),
      }
    : undefined;

  // ---- background：可选，部分缺字段补默认 ----
  const bgRaw = obj.background as Record<string, unknown> | undefined;
  const bgTypeRaw = (bgRaw?.type as string) ?? 'none';
  const bgType: 'none' | 'color' | 'gradient' | 'image' = ['none', 'color', 'gradient', 'image'].includes(bgTypeRaw)
    ? (bgTypeRaw as 'none' | 'color' | 'gradient' | 'image')
    : 'none';
  const bgGradient = bgRaw?.gradient && typeof bgRaw.gradient === 'object'
    ? (bgRaw.gradient as PageGradient)
    : undefined;
  const background = bgRaw
    ? {
        type: bgType,
        color: typeof bgRaw.color === 'string' ? bgRaw.color : undefined,
        gradient: bgGradient,
        image: typeof bgRaw.image === 'string' ? bgRaw.image : undefined,
      }
    : undefined;

  // ---- 行高 / 格式 / 图表 / 阴影：缺对象补默认；部分缺字段补；非法回退 ----
  const lhRaw = obj.lineHeight as Record<string, unknown> | undefined;
  const lineHeight = {
    mode: lhRaw?.mode === 'fixed' ? ('fixed' as const) : ('ratio' as const),
    value:
      typeof lhRaw?.value === 'number' && Number.isFinite(lhRaw.value) && lhRaw.value >= 0
        ? lhRaw.value
        : d.lineHeight!.value,
  };

  const fRaw = obj.format as Record<string, unknown> | undefined;
  const format = {
    currencySymbol:
      typeof fRaw?.currencySymbol === 'string' && fRaw.currencySymbol.length > 0
        ? fRaw.currencySymbol
        : d.format!.currencySymbol,
    currencyPosition: fRaw?.currencyPosition === 'after' ? ('after' as const) : ('before' as const),
    thousandsSep: typeof fRaw?.thousandsSep === 'boolean' ? fRaw.thousandsSep : d.format!.thousandsSep,
    decimals: [0, 1, 2].includes(fRaw?.decimals as number) ? (fRaw!.decimals as 0 | 1 | 2) : d.format!.decimals,
    compact: fRaw?.compact === 'auto' ? ('auto' as const) : ('none' as const),
  };

  const cRaw = obj.chart as Record<string, unknown> | undefined;
  const chart = {
    showAxis: typeof cRaw?.showAxis === 'boolean' ? cRaw.showAxis : d.chart!.showAxis,
    showGrid: typeof cRaw?.showGrid === 'boolean' ? cRaw.showGrid : d.chart!.showGrid,
    legendPosition: ['none', 'top', 'bottom', 'right'].includes(cRaw?.legendPosition as string)
      ? (cRaw!.legendPosition as 'none' | 'top' | 'bottom' | 'right')
      : d.chart!.legendPosition,
    barRadius:
      typeof cRaw?.barRadius === 'number' && Number.isFinite(cRaw.barRadius) && cRaw.barRadius >= 0 && cRaw.barRadius <= 16
        ? Math.round(cRaw.barRadius)
        : d.chart!.barRadius,
  };

  const shadow: ThemeShadow = ['none', 'subtle', 'soft', 'strong'].includes(obj.shadow as string)
    ? (obj.shadow as ThemeShadow)
    : d.shadow!;

  return {
    color: {
      primary: (colorRaw?.primary as string) || legacyPrimary || d.color.primary,
      secondary: (colorRaw?.secondary as string) || legacySecondary || d.color.secondary,
      chartPalette,
      neutralText: (colorRaw?.neutralText as string) || d.color.neutralText,
      neutralBg: (colorRaw?.neutralBg as string) || d.color.neutralBg,
    },
    font: {
      text: textKey,
      number: numberKey,
      heading: headingKey,
    },
    density: ['compact', 'standard', 'spacious'].includes(density) ? density : d.density,
    radius: ['sharp', 'small', 'large'].includes(radius) ? radius : d.radius,
    preset,
    layout,
    branding,
    background,
    lineHeight,
    format,
    chart,
    shadow,
  };
}

/** 把 campaign 日期 '2026-10-12' 格式化为 '2026.10.12'；非法/空返回 ''。 */
export function formatCampaignDate(iso: string | undefined): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : '';
}

/** 结案周期：两端齐全 → '2026.10.12–2026.11.10'；否则回落 '结案报告'。 */
export function buildWrapUpPeriod(meta: ProjectMeta): string {
  const start = formatCampaignDate(meta.campaignInfo?.startDate);
  const end = formatCampaignDate(meta.campaignInfo?.endDate);
  return start && end ? `${start}–${end}` : '结案报告';
}

/**
 * 投放报告页默认标题。
 *   周报 → "{advertiser}'s MEDIA REPORT · 上周"
 *   月报 → "{advertiser}'s MEDIA REPORT · 上月"
 *   结案 → "{advertiser}'s MEDIA REPORT · {campaign 起止}"
 * 兜底：advertiser 空 → 'MEDIA REPORT'；无 scenarioSub → 不带周期。
 */
export function buildReportTitle(meta: ProjectMeta): string {
  const advertiser = meta.advertiser?.trim();
  const base = advertiser ? `${advertiser}'s MEDIA REPORT` : 'MEDIA REPORT';
  let period = '';
  if (meta.scenarioSub === 'weekly') period = '上周';
  else if (meta.scenarioSub === 'monthly') period = '上月';
  else if (meta.scenarioSub === 'wrap-up') period = buildWrapUpPeriod(meta);
  return period ? `${base} · ${period}` : base;
}

function clampNum(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function validHex(c: unknown): string {
  return typeof c === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c) ? c : '#FFFFFF';
}

/**
 * 把 PageGradient 对象转成 CSS 渐变字符串。防御式归一（渲染层最后一道防线）：
 * - position clamp 到 0–100 并按升序排序；
 * - 色标少于 2 → 补齐到 2；多于 6 → 截断到 6；
 * - 非法颜色回退 #FFFFFF；
 * - angle 缺省 180、clamp 到 0–360；type 非 radial 一律按 linear。
 * 输入为空 / 异常时不抛错，返回纯白线性渐变。
 */
export function gradientToCss(g: unknown): string {
  const raw = (g && typeof g === 'object' ? g : {}) as Partial<PageGradient>;
  const type: 'linear' | 'radial' = raw.type === 'radial' ? 'radial' : 'linear';

  let stops = (Array.isArray(raw.stops) ? raw.stops : [])
    .filter((s): s is GradientStop => !!s && typeof s === 'object')
    .map((s) => ({
      color: validHex(s.color),
      position: clampNum(Math.round(Number(s.position) || 0), 0, 100),
    }))
    .sort((a, b) => a.position - b.position);

  if (stops.length === 0) {
    stops = [
      { color: '#FFFFFF', position: 0 },
      { color: '#FFFFFF', position: 100 },
    ];
  } else if (stops.length === 1) {
    const c = stops[0].color;
    stops = [
      { color: c, position: 0 },
      { color: c, position: 100 },
    ];
  }
  if (stops.length > 6) stops = stops.slice(0, 6);

  const stopStr = stops.map((s) => `${s.color} ${s.position}%`).join(', ');
  if (type === 'radial') return `radial-gradient(circle at center, ${stopStr})`;
  const angle = clampNum(Math.round(Number(raw.angle ?? 180)), 0, 360);
  return `linear-gradient(${angle}deg, ${stopStr})`;
}

/**
 * 按主题数字格式化纯数字。
 * - compact='auto'：≥1e6→M、≥1e3→K（K/M 固定 1 位小数，覆盖 decimals）；否则按 decimals + thousandsSep。
 * - NaN/undefined 等非法输入 → ''；负数保留 '-'。
 */
export function formatNumber(n: unknown, f?: ThemeFormat): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '';
  const fmt = f ?? DEFAULT_FORMAT;
  const neg = n < 0;
  const abs = Math.abs(n);
  let body: string;
  if (fmt.compact === 'auto') {
    if (abs >= 1e6) body = `${(abs / 1e6).toFixed(1)}M`;
    else if (abs >= 1e3) body = `${(abs / 1e3).toFixed(1)}K`;
    else body = abs.toFixed(fmt.decimals);
  } else {
    body = abs.toLocaleString('en-US', {
      minimumFractionDigits: fmt.decimals,
      maximumFractionDigits: fmt.decimals,
    });
    if (!fmt.thousandsSep) body = body.replace(/,/g, '');
  }
  return (neg ? '-' : '') + body;
}

/**
 * 带币种符号格式化：position='before' → '$1.2M'；'after' → '1.2M$'。
 * 非法数值（空串）不加符号，返回 ''。
 */
export function formatMoney(n: unknown, f?: ThemeFormat): string {
  const num = formatNumber(n, f);
  if (num === '') return '';
  const fmt = f ?? DEFAULT_FORMAT;
  return fmt.currencyPosition === 'after' ? `${num}${fmt.currencySymbol}` : `${fmt.currencySymbol}${num}`;
}
