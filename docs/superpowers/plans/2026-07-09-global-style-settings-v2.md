# 全局样式设置 v2 实现计划（行高 / 币种 / 数字格式 / 图表 / 阴影 / 背景 + 安全距离默认值）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `ProjectTheme` 上扩展 6 个全局风格维度（行高 / 币种+数字格式 / 图表样式 / 卡片阴影 / 页面背景）并把安全距离默认值从 48 改为 24，全部经「全局样式设置」浮层配置、CSS 变量/Context 下发、服务端 Zod 校验、老项目零迁移。

**Architecture:** 扁平扩展 `ProjectTheme`（每个新维度一个可选子对象/标量），与既有 `color/font/density/radius/layout` 同构。数据流：`shared`（类型 + 常量 + `normalizeTheme` + `formatNumber/formatMoney`）→ `server`（Zod `projectThemeSchema`）→ `web/theme.tsx`（CSS 变量 `--line-height/--shadow-card/--page-bg` + `resolveChartStyle`）→ `store.setTheme`（深合并）→ 消费者（TextComponent/卡壳/recharts/页面背景）+ 浮层 UI。纯函数走单测（vitest），UI/接线走 tsc + 手动回归（沿用 `2026-07-08-global-style-settings-design.md` §8 既有约定）。

**Tech Stack:** TypeScript · Zod（server）· React 18 + Zustand + recharts（web）· vitest（web/server；shared 无 test 脚本，shared 函数从 `apps/web/tests/` 测）。

**Spec:** [`docs/superpowers/specs/2026-07-09-global-style-settings-v2-design.md`](../specs/2026-07-09-global-style-settings-v2-design.md)

---

## 文件结构（创建 / 修改清单）

**shared（`packages/shared/src/index.ts`）— 单一 schema 源**
- Modify `ProjectTheme` 接口（+5 可选字段）
- Modify `DEFAULT_THEME`（safeMargin 48→24 + 5 新字段）
- Modify `STYLE_PRESETS`（4 套各补 5 字段）
- Modify `normalizeTheme`（5 新字段容错）
- Create `formatNumber` / `formatMoney` 纯函数 + 导出类型/常量
- Modify `CREATOR_METRIC_CATALOG` 占位 `¥`→`$`

**server（`apps/server/src/modules/projects/projects.schema.ts`）**
- Modify `projectThemeSchema`（+5 字段 Zod 校验）

**web theme（`apps/web/src/editor/theme.tsx`）**
- Modify `themeToCssVars`（+`--line-height`/`--shadow-card`/`--page-bg`，+`SHADOW_MAP`）
- Create `resolveChartStyle` 纯函数 + `useChartStyle` hook

**web store（`apps/web/src/editor/store.ts`）**
- Modify `ThemePatch`（+5 字段）+ `setTheme`（深合并新字段）+ `applyPreset` 透传

**web 消费者**
- Modify `apps/web/src/editor/components/BasicComponents.tsx`（TextComponent 行高；Bar/Line/Pie 接 useChartStyle）
- Modify `apps/web/src/editor/business/shared.tsx`（`Base` 阴影）
- Modify `apps/web/src/editor/components/CreatorComponents.tsx`（`CreatorChartShell` 阴影；fan 图接 useChartStyle）
- Modify `apps/web/src/editor/background.ts`（页面背景兜底 `var(--page-bg)`）

**web 数据（¥→$ 替换）**
- Modify `apps/web/src/editor/defaults.ts`、`templates.ts`、`business/render.tsx`、`business/catalog.ts`
- Modify `apps/web/src/api/creatorPerformance.ts`、`campaigns.ts`
- Modify `apps/web/src/projectsMeta.ts`

**web UI（`apps/web/src/editor/components/ReportSettingsOverlay.tsx`）**
- Modify（+5 分区 ⑦–⑪）

**测试**
- Modify `apps/web/tests/theme-layout.test.ts`（safeMargin 48→24 + 新字段默认/容错断言）
- Create `apps/web/tests/format.test.ts`（formatNumber/formatMoney 矩阵）
- Create `apps/web/tests/theme-style-v2.test.ts`（themeToCssVars 新变量 + resolveChartStyle）
- Create `apps/server/test/projectTheme.schema.test.ts`（Zod 新字段）
- Modify `apps/web/tests/editor.store.test.ts`（setTheme 深合并新字段）

---

## 约定

- **测试命令**：web 单测 `pnpm --filter web test`（或 `pnpm --filter web test -- <file>`）；server 单测 `pnpm --filter server test`；全量类型 `pnpm -r typecheck`。
- **recharts 在 jsdom 中被整体 mock**（见仓库记忆）：图表相关测试只断言外壳/纯函数，不断言 recharts 内部。
- **提交**：每个 Task 末尾原子 `git add <具体文件> && git commit`（IDE 会重置暂存区，必须单条命令完成 add+commit）。
- **新字段一律可选 + normalize 兜底**，老项目零迁移。

---

## Task 1：`ProjectTheme` 类型 + `DEFAULT_THEME`（safeMargin 24）+ 新默认常量

**Files:**
- Modify: `packages/shared/src/index.ts`（`ProjectTheme` 接口 ~399-423；`DEFAULT_CHART_PALETTE` 区 ~478-486；`DEFAULT_THEME` ~489-506）
- Test: `apps/web/tests/theme-layout.test.ts`

- [ ] **Step 1: 先改测试（红）—— safeMargin 默认改 24 + 新字段默认断言**

把 `apps/web/tests/theme-layout.test.ts` 的第一个 `it` 改为：

```ts
  it('DEFAULT_THEME.layout has expected defaults', () => {
    expect(DEFAULT_THEME.layout).toBeDefined();
    expect(DEFAULT_THEME.layout!.safeMargin).toBe(24);
    expect(DEFAULT_THEME.layout!.gridSize).toBe(10);
    expect(DEFAULT_THEME.layout!.showGrid).toBe(true);
    expect(DEFAULT_THEME.layout!.showSafeArea).toBe(true);
  });

  it('DEFAULT_THEME 携带 v2 新维度默认值', () => {
    expect(DEFAULT_THEME.lineHeight).toEqual({ mode: 'ratio', value: 1.5 });
    expect(DEFAULT_THEME.format).toEqual({
      currencySymbol: '$',
      currencyPosition: 'before',
      thousandsSep: true,
      decimals: 0,
      compact: 'none',
    });
    expect(DEFAULT_THEME.chart).toEqual({
      showAxis: true,
      showGrid: true,
      legendPosition: 'bottom',
      barRadius: 4,
    });
    expect(DEFAULT_THEME.shadow).toBe('soft');
    expect(DEFAULT_THEME.background).toEqual({ color: '#FFFFFF' });
  });
```

- [ ] **Step 2: 跑测试确认红**

Run: `pnpm --filter web test -- theme-layout.test.ts`
Expected: FAIL（`safeMargin` 仍是 48；`lineHeight` 等为 undefined）。

- [ ] **Step 3: 在 `ProjectTheme` 接口插入 5 个可选字段**

在 `packages/shared/src/index.ts` 的 `ProjectTheme` 接口中，`layout?: {...};`（~421 行）之后、`preset?: string;`（~422 行）之前插入：

```ts
  /** 行高规则：ratio=字号×n；fixed=字号+Npx。仅作用于用户「文本」组件 + 基础 CSS 变量。 */
  lineHeight?: {
    mode: 'ratio' | 'fixed';
    value: number;
  };
  /** 币种 + 数字格式（成对）。 */
  format?: {
    currencySymbol: string;
    currencyPosition: 'before' | 'after';
    thousandsSep: boolean;
    decimals: 0 | 1 | 2;
    compact: 'none' | 'auto';
  };
  /** 图表统一样式：经 ThemeContext 下发，recharts 组件消费。 */
  chart?: {
    showAxis: boolean;
    showGrid: boolean;
    legendPosition: 'none' | 'top' | 'bottom' | 'right';
    barRadius: number;
  };
  /** 卡片阴影档位 → --shadow-card。 */
  shadow?: 'none' | 'subtle' | 'soft' | 'strong';
  /** 全局页面背景兜底（页面无自有背景时生效）；gradient 复用 PageGradient 形状。 */
  background?: {
    color: string;
    gradient?: PageGradient;
  };
```

- [ ] **Step 4: 在 `DEFAULT_CHART_PALETTE` 之后新增导出类型 + 默认常量**

在 `packages/shared/src/index.ts` 的 `DEFAULT_CHART_PALETTE` 数组（~486 行）之后、`DEFAULT_THEME`（~489 行）之前插入：

```ts
/** v2 派生类型（供 theme.tsx / 测试引用）。 */
export type LineHeightMode = 'ratio' | 'fixed';
export type CurrencyPosition = 'before' | 'after';
export type NumberCompact = 'none' | 'auto';
export type ThemeShadow = 'none' | 'subtle' | 'soft' | 'strong';
export type ChartLegendPosition = 'none' | 'top' | 'bottom' | 'right';
export type ThemeFormat = NonNullable<ProjectTheme['format']>;

/** v2 各维度默认常量（DEFAULT_THEME 与 normalizeTheme 共用）。 */
export const DEFAULT_LINE_HEIGHT: NonNullable<ProjectTheme['lineHeight']> = { mode: 'ratio', value: 1.5 };
export const DEFAULT_FORMAT: ThemeFormat = {
  currencySymbol: '$',
  currencyPosition: 'before',
  thousandsSep: true,
  decimals: 0,
  compact: 'none',
};
export const DEFAULT_CHART_CFG: NonNullable<ProjectTheme['chart']> = {
  showAxis: true,
  showGrid: true,
  legendPosition: 'bottom',
  barRadius: 4,
};
export const DEFAULT_SHADOW: ThemeShadow = 'soft';
export const DEFAULT_BACKGROUND: NonNullable<ProjectTheme['background']> = { color: '#FFFFFF' };
```

> 命名用 `DEFAULT_CHART_CFG` 避免与既有的 `DEFAULT_CHART_PALETTE` 混淆。

- [ ] **Step 5: 更新 `DEFAULT_THEME`（safeMargin 48→24 + 5 新字段）**

把 `packages/shared/src/index.ts` 的 `DEFAULT_THEME`（~489-506）整体替换为：

```ts
export const DEFAULT_THEME: ProjectTheme = {
  color: {
    primary: '#FF5C00',
    secondary: '#FF8533',
    chartPalette: [...DEFAULT_CHART_PALETTE],
    neutralText: '#1A1A1A',
    neutralBg: '#FFFFFF',
  },
  font: {
    text: 'noto-sans-sc',
    number: 'inter',
    heading: undefined,
  },
  density: 'standard',
  radius: 'small',
  layout: { safeMargin: 24, gridSize: 10, showGrid: true, showSafeArea: true },
  lineHeight: { ...DEFAULT_LINE_HEIGHT },
  format: { ...DEFAULT_FORMAT },
  chart: { ...DEFAULT_CHART_CFG },
  shadow: DEFAULT_SHADOW,
  background: { ...DEFAULT_BACKGROUND },
  preset: 'business-sober',
};
```

- [ ] **Step 6: 跑测试确认绿**

Run: `pnpm --filter web test -- theme-layout.test.ts`
Expected: PASS（2 个 `it` 全过）。

- [ ] **Step 7: 类型检查**

Run: `pnpm --filter shared typecheck && pnpm --filter web typecheck`
Expected: 通过（`ProjectTheme` 新字段为可选，不破坏既有引用）。

- [ ] **Step 8: 提交**

```bash
git add packages/shared/src/index.ts apps/web/tests/theme-layout.test.ts && git commit -m "feat(shared): ProjectTheme 扩展 v2 维度 + safeMargin 默认 24

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2：`STYLE_PRESETS` 补 v2 字段 + `normalizeTheme` 容错

**Files:**
- Modify: `packages/shared/src/index.ts`（`STYLE_PRESETS` ~509-586；`normalizeTheme` ~614-693）
- Test: `apps/web/tests/theme-layout.test.ts`

- [ ] **Step 1: 先加 normalizeTheme 容错断言（红）**

在 `apps/web/tests/theme-layout.test.ts` 末尾追加：

```ts
describe('normalizeTheme v2 tolerance', () => {
  it('老 theme（无 v2 字段）补齐 v2 默认', () => {
    const t = normalizeTheme({ color: { primary: '#FF5C00' }, font: { text: 'inter', number: 'inter' } });
    expect(t.lineHeight).toEqual({ mode: 'ratio', value: 1.5 });
    expect(t.format!.currencySymbol).toBe('$');
    expect(t.format!.currencyPosition).toBe('before');
    expect(t.chart!.showGrid).toBe(true);
    expect(t.chart!.barRadius).toBe(4);
    expect(t.shadow).toBe('soft');
    expect(t.background!.color).toBe('#FFFFFF');
  });

  it('保留已提供的 v2 字段，非法值回退默认', () => {
    const t = normalizeTheme({
      lineHeight: { mode: 'fixed', value: 8 },
      format: { currencySymbol: '€', currencyPosition: 'after', thousandsSep: false, decimals: 2, compact: 'auto' },
      chart: { showAxis: false, showGrid: false, legendPosition: 'top', barRadius: 99 },
      shadow: 'strong',
      background: { color: '#F00' },
    });
    expect(t.lineHeight).toEqual({ mode: 'fixed', value: 8 });
    expect(t.format!.currencySymbol).toBe('€');
    expect(t.format!.currencyPosition).toBe('after');
    expect(t.format!.decimals).toBe(2);
    expect(t.chart!.showAxis).toBe(false);
    expect(t.chart!.legendPosition).toBe('top');
    expect(t.chart!.barRadius).toBe(4); // 99 越界 → 默认 4
    expect(t.shadow).toBe('strong');
    expect(t.background!.color).toBe('#F00');
  });

  it('非法 mode/position/compact 回退默认', () => {
    const t = normalizeTheme({
      lineHeight: { mode: 'bogus', value: -1 },
      format: { currencySymbol: '', currencyPosition: 'side', thousandsSep: 'x' as unknown, decimals: 9, compact: 'yes' },
    });
    expect(t.lineHeight).toEqual({ mode: 'ratio', value: 1.5 });
    expect(t.format!.currencyPosition).toBe('before');
    expect(t.format!.currencySymbol).toBe('$');
    expect(t.format!.decimals).toBe(0);
    expect(t.format!.compact).toBe('none');
  });
});
```

- [ ] **Step 2: 跑测试确认红**

Run: `pnpm --filter web test -- theme-layout.test.ts`
Expected: FAIL（新 `describe` 块的断言失败：normalizeTheme 尚未输出 v2 字段）。

- [ ] **Step 3: 在 `normalizeTheme` 的 layout 解析之后、return 之前插入 v2 解析**

在 `packages/shared/src/index.ts` 的 `normalizeTheme` 内，`layout` 对象构造完（~673 行 `};`）之后、`return {`（~675 行）之前插入：

```ts
  // ---- 行高 / 格式 / 图表 / 阴影 / 背景：缺对象补默认；部分缺字段补；非法回退 ----
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
      typeof cRaw?.barRadius === 'number' &&
      Number.isFinite(cRaw.barRadius) &&
      cRaw.barRadius >= 0 &&
      cRaw.barRadius <= 16
        ? Math.round(cRaw.barRadius)
        : d.chart!.barRadius,
  };

  const shadow: ThemeShadow = ['none', 'subtle', 'soft', 'strong'].includes(obj.shadow as string)
    ? (obj.shadow as ThemeShadow)
    : d.shadow!;

  const bgRaw = obj.background as Record<string, unknown> | undefined;
  const background = {
    color:
      typeof bgRaw?.color === 'string' && bgRaw.color.length > 0 ? bgRaw.color : d.background!.color,
    ...(bgRaw && bgRaw.gradient ? { gradient: bgRaw.gradient } : {}),
  };
```

- [ ] **Step 4: 把 v2 字段加入 `normalizeTheme` 的返回对象**

把 `normalizeTheme` 的 `return { ... }`（~675-692）中、`preset,` 之后、`layout,` 之后，追加 5 个字段。最终 return 体为：

```ts
  return {
    color: {
      primary: (colorRaw?.primary as string) || legacyPrimary || d.color.primary,
      secondary: (colorRaw?.secondary as string) || legacySecondary || d.color.secondary,
      chartPalette,
      neutralText: (colorRaw?.neutralText as string) || d.color.neutralText,
      neutralBg: (colorRaw?.neutralBg as string) || d.color.neutralBg,
    },
    font: { text: textKey, number: numberKey, heading: headingKey },
    density: ['compact', 'standard', 'spacious'].includes(density) ? density : d.density,
    radius: ['sharp', 'small', 'large'].includes(radius) ? radius : d.radius,
    preset,
    layout,
    lineHeight,
    format,
    chart,
    shadow,
    background,
  };
```

> 注：`ThemeShadow` 类型已由 Task 1 导出；`normalizeTheme` 文件即 `index.ts` 自身，类型在作用域内。

- [ ] **Step 5: 给 4 套 `STYLE_PRESETS` 各补 v2 字段**

在 `packages/shared/src/index.ts` 的 `STYLE_PRESETS`（~509-586）中，给**每一套** `theme: { ... }` 内、`layout: {...}` 之后、`preset: ...` 之前，插入相同的 3 个默认字段 + 各自的 shadow/background：

business-sober（`neutralBg` #FFFFFF）：

```ts
      lineHeight: { ...DEFAULT_LINE_HEIGHT },
      format: { ...DEFAULT_FORMAT },
      chart: { ...DEFAULT_CHART_CFG },
      shadow: 'soft',
      background: { color: '#FFFFFF' },
```

tech-minimal（`neutralBg` #F8FAFC）：同上 3 行 + `shadow: 'subtle',` + `background: { color: '#F8FAFC' },`

vibrant-trendy（`neutralBg` #FFFFFF）：同上 3 行 + `shadow: 'strong',` + `background: { color: '#FFFFFF' },`

minimal-elegant（`neutralBg` #FAFAFA）：同上 3 行 + `shadow: 'none',` + `background: { color: '#FAFAFA' },`

> 4 套的 lineHeight/format/chart 完全相同（=默认），仅 shadow 与 background.color 随风格变化。

- [ ] **Step 6: 跑测试确认绿**

Run: `pnpm --filter web test -- theme-layout.test.ts`
Expected: PASS（含新 `normalizeTheme v2 tolerance` 块）。

- [ ] **Step 7: 类型检查 + 提交**

Run: `pnpm --filter shared typecheck`

```bash
git add packages/shared/src/index.ts apps/web/tests/theme-layout.test.ts && git commit -m "feat(shared): normalizeTheme 容错 v2 字段 + 4 套预设补 v2

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3：`formatNumber` / `formatMoney` 共享格式化器

**Files:**
- Modify: `packages/shared/src/index.ts`（在 `gradientToCss` 之后 ~1346）
- Test: `apps/web/tests/format.test.ts`（新建）

- [ ] **Step 1: 写测试（红）**

新建 `apps/web/tests/format.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { formatNumber, formatMoney, DEFAULT_FORMAT } from '@mediakit/shared';
import type { ThemeFormat } from '@mediakit/shared';

const fmt = (over: Partial<ThemeFormat>): ThemeFormat => ({ ...DEFAULT_FORMAT, ...over });

describe('formatNumber', () => {
  it('默认：千分位 + 0 小数', () => {
    expect(formatNumber(1240000)).toBe('1,240,000');
    expect(formatNumber(0)).toBe('0');
  });
  it('decimals 控制小数位', () => {
    expect(formatNumber(72.5, fmt({ decimals: 1 }))).toBe('72.5');
    expect(formatNumber(72.567, fmt({ decimals: 2 }))).toBe('72.57');
  });
  it('thousandsSep=false 去千分位', () => {
    expect(formatNumber(1240000, fmt({ thousandsSep: false }))).toBe('1240000');
  });
  it('compact=auto：≥1e6→M，≥1e3→K（1 位小数，覆盖 decimals）', () => {
    expect(formatNumber(1240000, fmt({ compact: 'auto', decimals: 0 }))).toBe('1.2M');
    expect(formatNumber(98000, fmt({ compact: 'auto' }))).toBe('98.0K');
    expect(formatNumber(500, fmt({ compact: 'auto' }))).toBe('500');
  });
  it('负数保留 -', () => {
    expect(formatNumber(-1240)).toBe('-1,240');
    expect(formatNumber(-1240000, fmt({ compact: 'auto' }))).toBe('-1.2M');
  });
  it('非法输入返回空串', () => {
    expect(formatNumber(NaN)).toBe('');
    expect(formatNumber(undefined)).toBe('');
    expect(formatNumber('abc')).toBe(''); // string 是合法 unknown，运行时非有限数 → ''
  });
});

describe('formatMoney', () => {
  it('before（默认 $）', () => {
    expect(formatMoney(1240000)).toBe('$1,240,000');
    expect(formatMoney(1240000, fmt({ compact: 'auto' }))).toBe('$1.2M');
  });
  it('after 位置 + 自定义符号', () => {
    expect(formatMoney(1240000, fmt({ currencySymbol: '€', currencyPosition: 'after' }))).toBe('1,240,000€');
  });
  it('非法输入返回空串（不加符号）', () => {
    expect(formatMoney(NaN)).toBe('');
  });
});
```

- [ ] **Step 2: 跑测试确认红**

Run: `pnpm --filter web test -- format.test.ts`
Expected: FAIL（`formatNumber`/`formatMoney` 未导出）。

- [ ] **Step 3: 在 `gradientToCss` 之后实现两个格式化器**

在 `packages/shared/src/index.ts` 文件末尾（`gradientToCss` 函数 ~1346 之后）追加：

```ts
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
```

- [ ] **Step 4: 跑测试确认绿**

Run: `pnpm --filter web test -- format.test.ts`
Expected: PASS。

- [ ] **Step 5: 类型检查 + 提交**

Run: `pnpm --filter shared typecheck`

```bash
git add packages/shared/src/index.ts apps/web/tests/format.test.ts && git commit -m "feat(shared): formatNumber/formatMoney 数字+币种格式化器

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4：服务端 Zod `projectThemeSchema` 增 v2 字段

**Files:**
- Modify: `apps/server/src/modules/projects/projects.schema.ts`（`projectThemeSchema` ~34-64）
- Test: `apps/server/test/projectTheme.schema.test.ts`（新建）

- [ ] **Step 1: 写测试（红）**

新建 `apps/server/test/projectTheme.schema.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { createProjectSchema } from '../src/modules/projects/projects.schema';

const meta = (theme: object) => ({ name: 't', meta: { theme } });

describe('projectThemeSchema v2 字段', () => {
  it('接受合法 v2 主题', () => {
    const r = createProjectSchema.safeParse(
      meta({
        color: { primary: '#FF5C00' },
        font: { text: 'inter' },
        lineHeight: { mode: 'fixed', value: 8 },
        format: { currencySymbol: '$', currencyPosition: 'before', thousandsSep: true, decimals: 0, compact: 'none' },
        chart: { showAxis: true, showGrid: true, legendPosition: 'bottom', barRadius: 4 },
        shadow: 'soft',
        background: { color: '#FFFFFF' },
      }),
    );
    expect(r.success).toBe(true);
  });

  it('拒绝 barRadius 越界（>16）', () => {
    const r = createProjectSchema.safeParse(
      meta({ chart: { showAxis: true, showGrid: true, legendPosition: 'bottom', barRadius: 99 } }),
    );
    expect(r.success).toBe(false);
  });

  it('拒绝非法 shadow enum', () => {
    const r = createProjectSchema.safeParse(meta({ shadow: 'mega' }));
    expect(r.success).toBe(false);
  });

  it('拒绝非法 currencyPosition', () => {
    const r = createProjectSchema.safeParse(
      meta({ format: { currencySymbol: '$', currencyPosition: 'side', thousandsSep: true, decimals: 0, compact: 'none' } }),
    );
    expect(r.success).toBe(false);
  });

  it('老主题（无 v2 字段）仍合法', () => {
    const r = createProjectSchema.safeParse(meta({ color: { primary: '#FF5C00' } }));
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: 跑测试确认红**

Run: `pnpm --filter server test -- projectTheme.schema.test.ts`
Expected: FAIL（v2 字段未被 schema 识别——但注意：Zod 默认剥离未知键，越界断言可能误绿；非法 enum 断言应失败，因为字段未定义即不校验）。

- [ ] **Step 3: 在 `projectThemeSchema` 的 `layout` 之后、`preset` 之前插入 v2 字段**

在 `apps/server/src/modules/projects/projects.schema.ts` 的 `projectThemeSchema`（~34-64）中，`layout: z.object({...}).optional(),`（~54-61）之后、`preset: z.string().max(120).optional(),`（~62）之前插入：

```ts
    lineHeight: z
      .object({ mode: z.enum(['ratio', 'fixed']), value: z.number().min(0).max(100) })
      .optional(),
    format: z
      .object({
        currencySymbol: z.string().min(1).max(8),
        currencyPosition: z.enum(['before', 'after']),
        thousandsSep: z.boolean(),
        decimals: z.union([z.literal(0), z.literal(1), z.literal(2)]),
        compact: z.enum(['none', 'auto']),
      })
      .optional(),
    chart: z
      .object({
        showAxis: z.boolean(),
        showGrid: z.boolean(),
        legendPosition: z.enum(['none', 'top', 'bottom', 'right']),
        barRadius: z.number().min(0).max(16),
      })
      .optional(),
    shadow: z.enum(['none', 'subtle', 'soft', 'strong']).optional(),
    background: z
      .object({
        color: z.string().min(1).max(32),
        gradient: z
          .object({
            type: z.enum(['linear', 'radial']),
            angle: z.number().optional(),
            stops: z.array(z.object({ color: z.string().max(20), position: z.number() })).min(2).max(6),
          })
          .optional(),
      })
      .optional(),
```

- [ ] **Step 4: 跑测试确认绿**

Run: `pnpm --filter server test -- projectTheme.schema.test.ts`
Expected: PASS（5 个 `it` 全过）。

- [ ] **Step 5: 类型检查 + 提交**

Run: `pnpm --filter server typecheck`

```bash
git add apps/server/src/modules/projects/projects.schema.ts apps/server/test/projectTheme.schema.test.ts && git commit -m "feat(server): projectThemeSchema 增 v2 字段 Zod 校验

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5：`themeToCssVars` 增 `--line-height` / `--shadow-card` / `--page-bg`

**Files:**
- Modify: `apps/web/src/editor/theme.tsx`（`themeToCssVars` ~46-88；imports ~14-22）
- Test: `apps/web/tests/theme-style-v2.test.ts`（新建）

- [ ] **Step 1: 写测试（红）**

新建 `apps/web/tests/theme-style-v2.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { themeToCssVars } from '../src/editor/theme';
import { DEFAULT_THEME } from '@mediakit/shared';

const vars = (theme: object) => themeToCssVars(theme as any) as Record<string, string>;

describe('themeToCssVars v2 变量', () => {
  it('行高 ratio → 裸倍数', () => {
    expect(vars({ ...DEFAULT_THEME, lineHeight: { mode: 'ratio', value: 1.5 } })['--line-height']).toBe('1.5');
  });
  it('行高 fixed → calc(1em + Npx)', () => {
    expect(vars({ ...DEFAULT_THEME, lineHeight: { mode: 'fixed', value: 8 } })['--line-height']).toBe(
      'calc(1em + 8px)',
    );
  });
  it('shadow 各档映射 box-shadow', () => {
    expect(vars({ ...DEFAULT_THEME, shadow: 'none' })['--shadow-card']).toBe('none');
    expect(vars({ ...DEFAULT_THEME, shadow: 'soft' })['--shadow-card']).toBe('0 2px 8px rgba(0,0,0,.08)');
    expect(vars({ ...DEFAULT_THEME, shadow: 'strong' })['--shadow-card']).toBe('0 8px 24px rgba(0,0,0,.12)');
  });
  it('页面背景：纯色 → --page-bg', () => {
    expect(vars({ ...DEFAULT_THEME, background: { color: '#F00' } })['--page-bg']).toBe('#F00');
  });
  it('页面背景：渐变 → gradientToCss 串', () => {
    const v = vars({
      ...DEFAULT_THEME,
      background: {
        color: '#F00',
        gradient: { type: 'linear', angle: 90, stops: [{ color: '#FF5C00', position: 0 }, { color: '#FFFFFF', position: 100 }] },
      },
    });
    expect(v['--page-bg']).toBe('linear-gradient(90deg, #FF5C00 0%, #FFFFFF 100%)');
  });
});
```

- [ ] **Step 2: 跑测试确认红**

Run: `pnpm --filter web test -- theme-style-v2.test.ts`
Expected: FAIL（`--line-height` 等键不存在）。

- [ ] **Step 3: 给 `theme.tsx` 加 `gradientToCss` 导入 + `SHADOW_MAP`**

在 `apps/web/src/editor/theme.tsx` 的 import 块（~14-22）中，给 `@mediakit/shared` 的导入补 `gradientToCss`：

```ts
import {
  DEFAULT_CHART_PALETTE,
  DEFAULT_THEME,
  FONT_OPTIONS,
  getFontStack,
  gradientToCss,
  type ProjectTheme,
  type ThemeDensity,
  type ThemeRadius,
  type ThemeShadow,
} from '@mediakit/shared';
```

在 `RADIUS_MAP`（~36-40）之后新增：

```ts
/** 阴影档位 → box-shadow 值。 */
const SHADOW_MAP: Record<NonNullable<ThemeShadow>, string> = {
  none: 'none',
  subtle: '0 1px 2px rgba(0,0,0,.05)',
  soft: '0 2px 8px rgba(0,0,0,.08)',
  strong: '0 8px 24px rgba(0,0,0,.12)',
};
```

- [ ] **Step 4: 在 `themeToCssVars` 的 vars 对象中追加 3 个变量**

在 `apps/web/src/editor/theme.tsx` 的 `themeToCssVars` 内，`'--safe-margin': ...`（~75 行）之后（仍在 `vars` 对象字面量内、`};` 之前）追加：

```ts
    // v2：行高 / 阴影 / 页面背景
    '--line-height':
      (t.lineHeight ?? DEFAULT_THEME.lineHeight!).mode === 'fixed'
        ? `calc(1em + ${t.lineHeight?.value ?? DEFAULT_THEME.lineHeight!.value}px)`
        : String(t.lineHeight?.value ?? DEFAULT_THEME.lineHeight!.value),
    '--shadow-card': SHADOW_MAP[t.shadow ?? DEFAULT_THEME.shadow!],
    '--page-bg': t.background?.gradient
      ? gradientToCss(t.background.gradient)
      : (t.background?.color ?? DEFAULT_THEME.background!.color),
```

- [ ] **Step 5: 跑测试确认绿**

Run: `pnpm --filter web test -- theme-style-v2.test.ts`
Expected: PASS。

- [ ] **Step 6: 类型检查 + 提交**

Run: `pnpm --filter web typecheck`

```bash
git add apps/web/src/editor/theme.tsx apps/web/tests/theme-style-v2.test.ts && git commit -m "feat(web): themeToCssVars 暴露 --line-height/--shadow-card/--page-bg

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6：`resolveChartStyle` 纯函数 + `useChartStyle` hook

**Files:**
- Modify: `apps/web/src/editor/theme.tsx`（`useTheme` 之后 ~111）
- Test: `apps/web/tests/theme-style-v2.test.ts`（追加）

- [ ] **Step 1: 追加测试（红）**

先把 import 加到 `apps/web/tests/theme-style-v2.test.ts` **顶部 import 区**（紧接既有 `themeToCssVars` 那行 import 之后）：

```ts
import { themeToCssVars, resolveChartStyle } from '../src/editor/theme';
```

（即把原 `import { themeToCssVars } from '../src/editor/theme';` 改为同时引入 `resolveChartStyle`。）

然后在文件末尾追加：

```ts
describe('resolveChartStyle', () => {
  it('默认：显示轴/网格，legend=bottom，barRadius 来自入参', () => {
    expect(resolveChartStyle({ showAxis: true, showGrid: true, legendPosition: 'bottom', barRadius: 6 })).toEqual({
      showAxis: true,
      showGrid: true,
      legend: { verticalAlign: 'bottom' },
      barRadius: 6,
    });
  });
  it('legendPosition=none → legend=false', () => {
    expect(resolveChartStyle({ showAxis: true, showGrid: true, legendPosition: 'none', barRadius: 4 }).legend).toBe(false);
  });
  it('legendPosition=top/right 映射 recharts legend props', () => {
    expect(resolveChartStyle({ showAxis: true, showGrid: true, legendPosition: 'top', barRadius: 4 }).legend).toEqual({
      verticalAlign: 'top',
    });
    expect(resolveChartStyle({ showAxis: true, showGrid: true, legendPosition: 'right', barRadius: 4 }).legend).toEqual({
      verticalAlign: 'middle',
      align: 'right',
      layout: 'vertical',
    });
  });
  it('undefined 入参 → DEFAULT_CHART_CFG', () => {
    expect(resolveChartStyle(undefined).barRadius).toBe(4);
    expect(resolveChartStyle(undefined).showGrid).toBe(true);
  });
});
```

- [ ] **Step 2: 跑测试确认红**

Run: `pnpm --filter web test -- theme-style-v2.test.ts`
Expected: FAIL（`resolveChartStyle` 未导出）。

- [ ] **Step 3: 在 `useTheme` 之后实现 `resolveChartStyle` + `useChartStyle`**

先在 `apps/web/src/editor/theme.tsx` 的 `@mediakit/shared` 导入中补 `DEFAULT_CHART_CFG`（与既有导入合并）。然后在 `useTheme`（~109-111）之后追加：

```ts
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
```

- [ ] **Step 4: 跑测试确认绿**

Run: `pnpm --filter web test -- theme-style-v2.test.ts`
Expected: PASS。

- [ ] **Step 5: 类型检查 + 提交**

Run: `pnpm --filter web typecheck`

```bash
git add apps/web/src/editor/theme.tsx apps/web/tests/theme-style-v2.test.ts && git commit -m "feat(web): resolveChartStyle + useChartStyle 图表统一样式

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7：`store` 的 `ThemePatch` + `setTheme` 深合并 + `applyPreset` 透传

**Files:**
- Modify: `apps/web/src/editor/store.ts`（`ThemePatch` ~31-38；`setTheme` ~366-385）
- Modify: `apps/web/src/editor/components/ReportSettingsOverlay.tsx`（`applyPreset` ~41-53）
- Test: `apps/web/tests/editor.store.test.ts`

- [ ] **Step 1: 追加 setTheme 深合并测试（红）**

在 `apps/web/tests/editor.store.test.ts` 末尾追加（若文件不存在则新建并导入 `useEditorStore`；先 `grep -n "setTheme" apps/web/tests/editor.store.test.ts` 确认既有用法风格）：

```ts
describe('setTheme v2 深合并', () => {
  beforeEach(() => {
    useEditorStore.setState({
      projectMeta: { theme: { ...DEFAULT_THEME } },
      dirty: false,
    });
  });

  it('部分改 chart.barRadius 不清同级字段', () => {
    useEditorStore.getState().setTheme({ chart: { barRadius: 12 } });
    const t = useEditorStore.getState().projectMeta!.theme!;
    expect(t.chart!.barRadius).toBe(12);
    expect(t.chart!.showGrid).toBe(true); // 同级保留
    expect(t.chart!.legendPosition).toBe('bottom');
  });

  it('shadow 标量替换、preset 显式 undefined 清空', () => {
    useEditorStore.getState().setTheme({ shadow: 'strong', preset: undefined });
    const t = useEditorStore.getState().projectMeta!.theme!;
    expect(t.shadow).toBe('strong');
    expect(t.preset).toBeUndefined();
    expect(useEditorStore.getState().dirty).toBe(true);
  });

  it('format 部分更新保留其它 format 字段', () => {
    useEditorStore.getState().setTheme({ format: { currencySymbol: '€' } });
    const t = useEditorStore.getState().projectMeta!.theme!;
    expect(t.format!.currencySymbol).toBe('€');
    expect(t.format!.currencyPosition).toBe('before'); // 保留
  });
});
```

> 顶部需 `import { useEditorStore } from '../src/editor/store';` 与 `import { DEFAULT_THEME } from '@mediakit/shared';`（按既有 import 风格补）。

- [ ] **Step 2: 跑测试确认红**

Run: `pnpm --filter web test -- editor.store.test.ts`
Expected: FAIL（`chart` 字段经 setTheme 后 undefined 或被整体替换）。

- [ ] **Step 3: 扩展 `ThemePatch`**

把 `apps/web/src/editor/store.ts` 的 `ThemePatch`（~31-38）替换为：

```ts
/** 主题补丁：对象型字段（color/font/layout/lineHeight/format/chart/background）深合并；density/radius/shadow/preset 直接替换。 */
export type ThemePatch = {
  color?: Partial<ProjectTheme['color']>;
  font?: Partial<ProjectTheme['font']>;
  density?: ThemeDensity;
  radius?: ThemeRadius;
  layout?: Partial<NonNullable<ProjectTheme['layout']>>;
  lineHeight?: Partial<NonNullable<ProjectTheme['lineHeight']>>;
  format?: Partial<NonNullable<ProjectTheme['format']>>;
  chart?: Partial<NonNullable<ProjectTheme['chart']>>;
  background?: Partial<NonNullable<ProjectTheme['background']>>;
  shadow?: NonNullable<ProjectTheme['shadow']>;
  preset?: string;
};
```

- [ ] **Step 4: 重写 `setTheme` 深合并 5 个新对象字段**

把 `apps/web/src/editor/store.ts` 的 `setTheme`（~366-385）替换为：

```ts
    setTheme: (patch) =>
      set((s) => {
        const current = s.projectMeta?.theme ?? DEFAULT_THEME;
        // 对象型字段深合并（含 v2：lineHeight/format/chart/background）；标量直接替换。
        const merged: ProjectTheme = {
          ...current,
          color: { ...current.color, ...patch.color },
          font: { ...current.font, ...patch.font },
          layout: {
            ...(current.layout ?? DEFAULT_THEME.layout),
            ...patch.layout,
          } as NonNullable<ProjectTheme['layout']>,
          lineHeight: {
            ...(current.lineHeight ?? DEFAULT_THEME.lineHeight),
            ...patch.lineHeight,
          } as NonNullable<ProjectTheme['lineHeight']>,
          format: {
            ...(current.format ?? DEFAULT_THEME.format),
            ...patch.format,
          } as NonNullable<ProjectTheme['format']>,
          chart: {
            ...(current.chart ?? DEFAULT_THEME.chart),
            ...patch.chart,
          } as NonNullable<ProjectTheme['chart']>,
          background: {
            ...(current.background ?? DEFAULT_THEME.background),
            ...patch.background,
          } as NonNullable<ProjectTheme['background']>,
          density: patch.density ?? current.density,
          radius: patch.radius ?? current.radius,
          shadow: patch.shadow ?? current.shadow,
          // preset：patch 显式含 preset key（含 undefined=清空）则用 patch 值；否则保留当前。
          preset: 'preset' in patch ? patch.preset : current.preset,
        };
        return {
          dirty: true,
          projectMeta: { ...(s.projectMeta ?? {}), theme: merged } as ProjectMeta,
        };
      }),
```

- [ ] **Step 5: `applyPreset` 透传 v2 字段**

把 `apps/web/src/editor/components/ReportSettingsOverlay.tsx` 的 `applyPreset`（~41-53）内的 `const patch: ThemePatch = {...}` 替换为（在 `layout: {...}` 之后加 5 行、`preset` 之前）：

```ts
    const patch: ThemePatch = {
      color: { ...preset.theme.color },
      font: { ...preset.theme.font },
      density: preset.theme.density,
      radius: preset.theme.radius,
      layout: { ...preset.theme.layout },
      lineHeight: { ...preset.theme.lineHeight },
      format: { ...preset.theme.format },
      chart: { ...preset.theme.chart },
      background: { ...preset.theme.background },
      shadow: preset.theme.shadow,
      preset: preset.key,
    };
```

- [ ] **Step 6: 跑测试确认绿**

Run: `pnpm --filter web test -- editor.store.test.ts`
Expected: PASS。

- [ ] **Step 7: 类型检查 + 提交**

Run: `pnpm --filter web typecheck`

```bash
git add apps/web/src/editor/store.ts apps/web/src/editor/components/ReportSettingsOverlay.tsx apps/web/tests/editor.store.test.ts && git commit -m "feat(web): setTheme 深合并 v2 字段 + applyPreset 透传

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8：消费者——TextComponent 行高 + 卡壳阴影

**Files:**
- Modify: `apps/web/src/editor/components/BasicComponents.tsx`（`TextComponent` ~31-47）
- Modify: `apps/web/src/editor/business/shared.tsx`（`Base` ~24-52）
- Modify: `apps/web/src/editor/components/CreatorComponents.tsx`（`CreatorChartShell` ~570-586）

> 这些是外观接线，沿用项目约定：tsc + 手动回归（无纯函数新增）。

- [ ] **Step 1: TextComponent 接全局行高**

在 `apps/web/src/editor/components/BasicComponents.tsx` 的 `TextComponent`（~31-47）的 `style={{...}}` 中，在 `padding: data.padding,` 之后加一行：

```ts
        lineHeight: 'var(--line-height)',
```

- [ ] **Step 2: `Base` 卡壳走 `--shadow-card`**

在 `apps/web/src/editor/business/shared.tsx` 的 `Base`（~24-52）的 `style={{...}}` 中，把：

```ts
        boxShadow: accent ? `0 8px 22px rgba(255,92,0,.16)` : undefined,
```

替换为：

```ts
        boxShadow: accent ? `0 8px 22px rgba(255,92,0,.16)` : 'var(--shadow-card)',
```

> accent 变体保留品牌橙辉光；其余变体统一走主题阴影档（默认 soft）。

- [ ] **Step 3: `CreatorChartShell` 加阴影**

在 `apps/web/src/editor/components/CreatorComponents.tsx` 的 `CreatorChartShell`（~570-586）返回的根 `<div>` 上加内联 `style`：

```tsx
  return (
    <div
      className="flex h-full w-full flex-col rounded-xl border border-border-default bg-surface-primary p-3"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
```

- [ ] **Step 4: 类型检查**

Run: `pnpm --filter web typecheck`
Expected: 通过。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/components/BasicComponents.tsx apps/web/src/editor/business/shared.tsx apps/web/src/editor/components/CreatorComponents.tsx && git commit -m "feat(web): 文本组件接全局行高 + 卡壳接 --shadow-card

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9：recharts 图表接 `useChartStyle`

**Files:**
- Modify: `apps/web/src/editor/components/BasicComponents.tsx`（`BarChartComponent` ~213-234、`LineChartComponent` ~237-263、`PieChartComponent` ~266-292；imports ~1-27）
- Modify: `apps/web/src/editor/components/CreatorComponents.tsx`（`CreatorFanCity` ~644-671、`CreatorFanAge` ~674-697；imports 顶部）

> recharts 在 jsdom 被整体 mock，无法在单测中断言其 props；本任务走 tsc + 手动回归。

- [ ] **Step 1: `BasicComponents.tsx` 导入 `useChartStyle` + `Legend`**

在 `apps/web/src/editor/components/BasicComponents.tsx` 顶部 recharts 导入（~1-14）中加 `Legend`：

```ts
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
```

在 `import { IconKit } from '../icons/IconKit';`（~27）之后加：

```ts
import { useChartStyle } from '../theme';
```

- [ ] **Step 2: `BarChartComponent` 接样式**

把 `BarChartComponent`（~213-234）替换为：

```tsx
export function BarChartComponent({ data }: { data: BarChartData }) {
  const cs = useChartStyle();
  return (
    <div className="flex h-full w-full flex-col bg-surface-primary p-3">
      {data.title && <div className="mb-2 text-sm font-medium text-foreground-primary">{data.title}</div>}
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.bars} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            {cs.showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />}
            <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} hide={!cs.showAxis} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={32} hide={!cs.showAxis} />
            <Tooltip cursor={{ fill: '#F9FAFB' }} />
            <Bar dataKey="value" radius={[cs.barRadius, cs.barRadius, 0, 0]}>
              {data.bars.map((b, i) => (
                <Cell key={i} fill={b.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `LineChartComponent` 接样式 + 加 Legend**

把 `LineChartComponent`（~237-263）替换为（注意在 `<Tooltip />` 之后、series map 之前插入条件 `<Legend/>`）：

```tsx
export function LineChartComponent({ data }: { data: LineChartData }) {
  const cs = useChartStyle();
  const labels = data.series[0]?.points.map((p) => p.label) ?? [];
  const dataset = labels.map((label, i) => {
    const row: Record<string, string | number> = { label };
    for (const s of data.series) row[s.name] = s.points[i]?.value ?? 0;
    return row;
  });
  return (
    <div className="flex h-full w-full flex-col bg-surface-primary p-3">
      {data.title && <div className="mb-2 text-sm font-medium text-foreground-primary">{data.title}</div>}
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dataset} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            {cs.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />}
            <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} hide={!cs.showAxis} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={32} hide={!cs.showAxis} />
            <Tooltip />
            {cs.legend && <Legend {...cs.legend} />}
            {data.series.map((s) => (
              <Line key={s.name} type="monotone" dataKey={s.name} stroke={s.color} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `PieChartComponent` 接轴/网格（饼图无轴，仅条件 Tooltip 保持；不加 Legend——用 slice label）**

`PieChartComponent`（~266-292）本无 CartesianGrid/轴，且用 `label={(e)=>e.label}` 自标；本轮**不改**（饼图样式由 palette 驱动，grid/axis/barRadius 均不适用）。仅确认其行为不变。

- [ ] **Step 5: `CreatorFanCity` 接样式**

在 `apps/web/src/editor/components/CreatorComponents.tsx` 顶部 import 区加 `useChartStyle`（从 `../theme`）。把 `CreatorFanCity`（~644-671）的 recharts 内部改为读 `cs`：

```tsx
export function CreatorFanCity({ data }: { data: CreatorFanCityData }) {
  const { title, subtitle, bars = [] } = data;
  const cs = useChartStyle();
  const sorted = [...bars].sort((a, b) => b.value - a.value);
  const sum = sorted.reduce((acc, b) => acc + b.value, 0) || 1;
  const withPct = sorted.map((b) => ({ ...b, pct: Math.round((b.value / sum) * 100) }));
  return (
    <CreatorChartShell title={title} subtitle={subtitle}>
      {sorted.length === 0 ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={withPct} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            {cs.showGrid && <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />}
            <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} hide={!cs.showAxis} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={48} hide={!cs.showAxis} />
            <Tooltip cursor={{ fill: '#F9FAFB' }} />
            <Bar dataKey="value" radius={[0, cs.barRadius, cs.barRadius, 0]}>
              {withPct.map((b, i) => (
                <Cell key={i} fill={b.color} />
              ))}
              <LabelList dataKey="pct" position="right" formatter={(v: number) => `${v}%`} style={{ fontSize: 11 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </CreatorChartShell>
  );
}
```

- [ ] **Step 6: `CreatorFanAge` 接样式**

把 `CreatorFanAge`（~674-697）的 recharts 内部按同法改：函数体首行加 `const cs = useChartStyle();`，`<CartesianGrid .../>` 改 `{cs.showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />}`，两个 Axis 加 `hide={!cs.showAxis}`，`<Bar dataKey="value" radius={[4,4,0,0]}>` 改 `radius={[cs.barRadius, cs.barRadius, 0, 0]}`。

- [ ] **Step 7: 类型检查**

Run: `pnpm --filter web typecheck`
Expected: 通过。

- [ ] **Step 8: 提交**

```bash
git add apps/web/src/editor/components/BasicComponents.tsx apps/web/src/editor/components/CreatorComponents.tsx && git commit -m "feat(web): recharts 图表接入 useChartStyle（轴/网格/图例/柱圆角）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 10：页面背景兜底 `var(--page-bg)`

**Files:**
- Modify: `apps/web/src/editor/background.ts`（`resolvePageBackground` ~7-11）

- [ ] **Step 1: 把 `#fff` 兜底改为全局背景变量**

把 `apps/web/src/editor/background.ts` 的 `resolvePageBackground`（~7-11）最后一行：

```ts
  return page.bgColor ?? '#fff';
```

替换为：

```ts
  return page.bgColor ?? 'var(--page-bg)';
```

> `--page-bg` 由 `themeToCssVars` 挂在编辑器根节点（Task 5）；页面有自有 `bgImage/bgGradient/bgColor` 时仍优先于全局。`backgroundType()` 不变（仍返回 'none'，全局兜底属"无页面背景"，属性面板语义正确）。

- [ ] **Step 2: 类型检查 + 提交**

Run: `pnpm --filter web typecheck`

```bash
git add apps/web/src/editor/background.ts && git commit -m "feat(web): 无页面背景时回退全局 --page-bg

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 11：币种 `¥`→`$` 一次性替换 + mock 走 `formatMoney`

**Files:**
- Modify: `apps/web/src/api/creatorPerformance.ts`（`money`/`money2` ~168-170）
- Modify: `apps/web/src/editor/defaults.ts`（package-card `price` ~254；kpi-board rows ~269-275；timeline-compare ~307）
- Modify: `apps/web/src/editor/templates.ts`（~346-348, 391）
- Modify: `apps/web/src/api/campaigns.ts`（~23-88 多处 `budget: '¥...'`）
- Modify: `apps/web/src/projectsMeta.ts`（~79 `budget: '¥300K'`）
- Modify: `apps/web/src/editor/business/render.tsx`（~659, 725）
- Modify: `apps/web/src/editor/business/catalog.ts`（~226）
- Modify: `packages/shared/src/index.ts`（`CREATOR_METRIC_CATALOG` 占位 ~955-956）

- [ ] **Step 1: mock 格式化器走 `formatMoney`**

在 `apps/web/src/api/creatorPerformance.ts` 顶部 import 区加：

```ts
import { formatMoney, DEFAULT_FORMAT } from '@mediakit/shared';
```

把 `money`/`money2`（~168-170）替换为：

```ts
const money = (n: number): string => formatMoney(n, DEFAULT_FORMAT);
/** 小额金额 2 位小数（EPC 等个位数金额）。 */
const money2 = (n: number): string => formatMoney(n, { ...DEFAULT_FORMAT, decimals: 2 });
```

> `compact` 辅助（~161-166）不含币种，保持不变。

- [ ] **Step 2: 全量 `¥`→`$` 字面替换（逐文件确认）**

对以下每个文件执行 `grep -n "¥" <file>` 先列出命中行，再把命中行的 `¥` 改为 `$`（**仅改字面符号，不改金额数值/K-M 后缀**）：

- `apps/web/src/editor/defaults.ts`：`price: '¥80,000'`→`'$80,000'`；kpi-board rows `'¥1.24M'`→`'$1.24M'`、`'¥98K'`→`'$98K'`、`'¥72.5'`→`'$72.5'`；timeline-compare `'¥1.24M'`→`'$1.24M'`、`'¥1.08M'`→`'$1.08M'`。
- `apps/web/src/editor/templates.ts`：所有 `'¥...'` → `'$...'`。
- `apps/web/src/api/campaigns.ts`：所有 `budget: '¥...'` → `budget: '$...'`。
- `apps/web/src/projectsMeta.ts`：`budget: '¥300K'`→`'$300K'`。
- `apps/web/src/editor/business/render.tsx`：`'¥30K'/'¥80K'/'¥150K'`（~659）→ `'$30K'/'$80K'/'$150K'`；`¥{prices[i]}K`（~725）→ `${'$'}{prices[i]}K`——注意此处是 JSX 文本，把 `¥` 改为字面 `$` 即可（`{prices[i]}K` 保留）。
- `apps/web/src/editor/business/catalog.ts`：`'GMV ¥1.24M'`（~226）→`'GMV $1.24M'`。
- `packages/shared/src/index.ts`：`CREATOR_METRIC_CATALOG` 的 `placeholder: '¥120'`→`'$120'`、`'¥3.2'`→`'$3.2'`（~955-956）。

- [ ] **Step 3: 复核无遗漏（排除 icon key / 注释）**

Run: `grep -rn "¥" apps/web/src packages/shared/src apps/server/src`
Expected: 仅剩注释/文档里的 `¥`（如 `CampaignMetric.value` 的文档注释 `// 数值，如 "¥128,000"`，可保留或一并改 `$`；**不得**剩在任何会被渲染的字符串里）。把残留的渲染串补改。

> `icons/catalog.ts` 的 `currency` 图标 key 不含 `¥`（字形是 `$`），无需动。

- [ ] **Step 4: 跑相关测试（确认不破）**

Run: `pnpm --filter web test -- creator-performance.test.ts`
Expected: PASS（`num()` 用 `replace(/[^\d.]/g,'')` 剥离符号，`¥`/`$` 均被剥离；不依赖符号）。

- [ ] **Step 5: 类型检查 + 提交**

Run: `pnpm -r typecheck`

```bash
git add packages/shared/src/index.ts apps/web/src/api/creatorPerformance.ts apps/web/src/api/campaigns.ts apps/web/src/projectsMeta.ts apps/web/src/editor/defaults.ts apps/web/src/editor/templates.ts apps/web/src/editor/business/render.tsx apps/web/src/editor/business/catalog.ts && git commit -m "feat(web): 默认币种 \$（mock 走 formatMoney + 烤死 ¥→\$ 替换）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 12：「全局样式设置」浮层增 5 个分区

**Files:**
- Modify: `apps/web/src/editor/components/ReportSettingsOverlay.tsx`（分区 ⑥ 之后、⑦ 解析参考图之前插入；新增 update 辅助函数 ~86 之后）

> UI 接线，tsc + 手动回归。

- [ ] **Step 1: 在 `updateLayout` 之后新增 5 个 update 辅助**

在 `apps/web/src/editor/components/ReportSettingsOverlay.tsx` 的 `updateLayout`（~81-86）之后插入：

```ts
  /** 手改行高字段：清空 preset 高亮。 */
  function updateLineHeight<K extends keyof NonNullable<ProjectTheme['lineHeight']>>(
    field: K,
    value: NonNullable<ProjectTheme['lineHeight']>[K],
  ) {
    setTheme({ lineHeight: { [field]: value }, preset: undefined });
  }

  /** 手改数字/币种格式字段：清空 preset 高亮。 */
  function updateFormat<K extends keyof NonNullable<ProjectTheme['format']>>(
    field: K,
    value: NonNullable<ProjectTheme['format']>[K],
  ) {
    setTheme({ format: { [field]: value }, preset: undefined });
  }

  /** 手改图表样式字段：清空 preset 高亮。 */
  function updateChart<K extends keyof NonNullable<ProjectTheme['chart']>>(
    field: K,
    value: NonNullable<ProjectTheme['chart']>[K],
  ) {
    setTheme({ chart: { [field]: value }, preset: undefined });
  }

  function updateShadow(s: NonNullable<ProjectTheme['shadow']>) {
    setTheme({ shadow: s, preset: undefined });
  }

  function updateBackground(color: string) {
    setTheme({ background: { color }, preset: undefined });
  }
```

- [ ] **Step 2: 取出当前 v2 字段（带默认兜底）**

在 `ReportSettingsOverlay` 组件体内、`const layout = theme.layout ?? DEFAULT_THEME.layout!;`（~36）之后加：

```ts
  const lineHeight = theme.lineHeight ?? DEFAULT_THEME.lineHeight!;
  const format = theme.format ?? DEFAULT_THEME.format!;
  const chart = theme.chart ?? DEFAULT_THEME.chart!;
  const background = theme.background ?? DEFAULT_THEME.background!;
```

> 同时给顶部 import 的 `DEFAULT_THEME` 已在（~3）——确认已 import。

- [ ] **Step 3: 在「⑥ 布局」分区之后、「⑦ 解析参考图」之前插入 5 个新分区**

在 `apps/web/src/editor/components/ReportSettingsOverlay.tsx` 的「⑥ 布局」`</section>`（~324）之后、「⑦ 解析参考图」`<section className="border-t...">`（~327）之前插入：

```tsx
          {/* ⑦ 行高 */}
          <section className="space-y-2">
            <div className="text-xs font-semibold text-foreground-secondary">行高（文本组件）</div>
            <div className="flex gap-2">
              {(['ratio', 'fixed'] as const).map((m) => (
                <Chip key={m} active={lineHeight.mode === m} onClick={() => updateLineHeight('mode', m)}>
                  {m === 'ratio' ? '倍数 ×n' : '加法 +px'}
                </Chip>
              ))}
            </div>
            <input
              type="number"
              min={0}
              max={lineHeight.mode === 'ratio' ? 3 : 100}
              step={lineHeight.mode === 'ratio' ? 0.05 : 1}
              value={lineHeight.value}
              onChange={(e) =>
                updateLineHeight('value', Math.max(0, Number(e.target.value) || 0))
              }
              className="w-24 rounded border border-border-default px-2 py-1 text-xs text-foreground-primary"
            />
            <p className="text-[11px] text-foreground-muted">
              {lineHeight.mode === 'ratio' ? `行高 = 字号 × ${lineHeight.value}` : `行高 = 字号 + ${lineHeight.value}px`}
            </p>
          </section>

          {/* ⑧ 币种与数字 */}
          <section className="space-y-2">
            <div className="text-xs font-semibold text-foreground-secondary">币种与数字</div>
            <div className="flex items-center gap-2">
              <input
                value={format.currencySymbol}
                onChange={(e) => updateFormat('currencySymbol', e.target.value || '$')}
                className="w-16 rounded border border-border-default px-2 py-1 text-xs text-foreground-primary"
              />
              <select
                value={format.currencyPosition}
                onChange={(e) => updateFormat('currencyPosition', e.target.value as 'before' | 'after')}
                className="rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-primary"
              >
                <option value="before">符号在前</option>
                <option value="after">符号在后</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-1.5 text-xs text-foreground-secondary">
                <input
                  type="checkbox"
                  checked={format.thousandsSep}
                  onChange={(e) => updateFormat('thousandsSep', e.target.checked)}
                />
                千分位
              </label>
              <label className="flex items-center gap-1.5 text-xs text-foreground-secondary">
                小数位
                <select
                  value={format.decimals}
                  onChange={(e) => updateFormat('decimals', Number(e.target.value) as 0 | 1 | 2)}
                  className="rounded border border-border-default bg-surface-primary px-1 py-0.5 text-xs"
                >
                  <option value={0}>0</option>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-xs text-foreground-secondary">
                <input
                  type="checkbox"
                  checked={format.compact === 'auto'}
                  onChange={(e) => updateFormat('compact', e.target.checked ? 'auto' : 'none')}
                />
                K/M 缩写
              </label>
            </div>
          </section>

          {/* ⑨ 图表样式 */}
          <section className="space-y-2">
            <div className="text-xs font-semibold text-foreground-secondary">图表样式</div>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-1.5 text-xs text-foreground-secondary">
                <input
                  type="checkbox"
                  checked={chart.showAxis}
                  onChange={(e) => updateChart('showAxis', e.target.checked)}
                />
                坐标轴
              </label>
              <label className="flex items-center gap-1.5 text-xs text-foreground-secondary">
                <input
                  type="checkbox"
                  checked={chart.showGrid}
                  onChange={(e) => updateChart('showGrid', e.target.checked)}
                />
                网格线
              </label>
              <label className="flex items-center gap-1.5 text-xs text-foreground-secondary">
                图例
                <select
                  value={chart.legendPosition}
                  onChange={(e) => updateChart('legendPosition', e.target.value as 'none' | 'top' | 'bottom' | 'right')}
                  className="rounded border border-border-default bg-surface-primary px-1 py-0.5 text-xs"
                >
                  <option value="none">无</option>
                  <option value="top">上</option>
                  <option value="bottom">下</option>
                  <option value="right">右</option>
                </select>
              </label>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-foreground-secondary">
              柱圆角 {chart.barRadius}px
              <input
                type="range"
                min={0}
                max={16}
                value={chart.barRadius}
                onChange={(e) => updateChart('barRadius', Math.max(0, Math.min(16, Number(e.target.value) || 0)))}
              />
            </label>
          </section>

          {/* ⑩ 阴影 */}
          <section>
            <div className="mb-2 text-xs font-semibold text-foreground-secondary">卡片阴影</div>
            <div className="flex flex-wrap gap-2">
              {(['none', 'subtle', 'soft', 'strong'] as const).map((s) => (
                <Chip key={s} active={(theme.shadow ?? 'soft') === s} onClick={() => updateShadow(s)}>
                  {{ none: '无', subtle: '细微', soft: '柔和', strong: '强烈' }[s]}
                </Chip>
              ))}
            </div>
          </section>

          {/* ⑪ 背景 */}
          <section className="space-y-2">
            <div className="text-xs font-semibold text-foreground-secondary">全局页面背景</div>
            <ColorField label="背景色（页面无自有背景时生效）" value={background.color} onChange={updateBackground} />
          </section>
```

> 原编号「⑦ 解析参考图」可顺延为「⑫」（仅注释文案，不影响功能；可选）。

- [ ] **Step 4: 类型检查**

Run: `pnpm --filter web typecheck`
Expected: 通过。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/components/ReportSettingsOverlay.tsx && git commit -m "feat(web): 全局样式浮层增行高/币种/图表/阴影/背景 5 分区

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 13：全量验证 + 手动回归

**Files:**（无改动，仅验证）

- [ ] **Step 1: 全量类型检查**

Run: `pnpm -r typecheck`
Expected: shared / server / web 全部通过。

- [ ] **Step 2: 全量单测**

Run: `pnpm --filter web test && pnpm --filter server test`
Expected: 全绿（含新增 theme-layout / format / theme-style-v2 / projectTheme.schema / editor.store 测试）。

- [ ] **Step 3: 手动回归清单（启动 `pnpm --filter web dev`）**

1. 打开「全局样式设置」→ 新 5 分区可见，默认值正确（行高 ratio 1.5；币种 `$` 在前；图表 轴/网格开、图例下、柱圆角 4；阴影 柔和；背景 #FFFFFF）。
2. 行高：切「加法 +px」输 8 → 文本组件行距变大；业务模板（KPI 大数字）行距不变。
3. 币种：改符号 `€`、位置「在后」、开 K/M → mock 达人效果/投放位金额随之变（如 `1.2M€`）。
4. 图表：关网格/轴、图例切「右」、柱圆角 0 → bar/line/fan 图统一变化；LineChart 出现图例。
5. 阴影：切「强烈」→ 卡壳（Base/CreatorChartShell）阴影加深。
6. 背景：设背景色 `#F5F5F5` → 无自有背景的页面变灰；有自有背景的页不变。
7. 切 4 个预设 → 新维度随之变（shadow 随预设：商务 soft / 科技 subtle / 活力 strong / 极简 none）、`preset` 高亮正确；手改任一新字段 → 高亮清空。
8. 老项目（meta.theme 无 v2 字段）打开 → 渲染正常、无报错、默认值补齐。
9. 保存 → 刷新 → v2 字段往返不丢；预览/分享/导出无辅助层残留（沿用前序 spec §8）。
10. 默认金额全部 `$`（package-card `$80,000`、kpi `$1.24M`、timeline `$1.24M/$1.08M` 等）。

- [ ] **Step 4: 收尾提交（如有手动微调）**

```bash
git add -A && git commit -m "chore: v2 全局样式手动回归微调

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 风险与回退

- **图表外观变化**：统一接入 `useChartStyle` 会改变此前各自写死的轴/网格（属预期，决策已确认）；如某图刻意隐藏图例，`legendPosition='none'` 全局生效——回归时逐图目检，必要时在组件级用 `<Legend/>` 覆盖。
- **`¥`→`$` 漏改**：Task 11 Step 3 的 `grep` 复核不可跳过；用户既有项目里已存的 `¥` 串是用户数据，不动。
- **Zod 漏改**：Task 4 必须完成，否则保存丢字段。
- **`setTheme` 深合并回归**：Task 7 把 5 个新对象字段加入显式深合并；标量（density/radius/shadow/preset）仍走替换——`editor.store.test.ts` 既有用例 + 新增用例覆盖。
- **向后兼容**：老项目 theme 无 v2 字段，`normalizeTheme` 容错补默认（Task 2 测试覆盖）。
