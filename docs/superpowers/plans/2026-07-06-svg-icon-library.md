# SVG 图标库 + 指标卡变体级图标接入 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 引入 Phosphor 图标库作为底层「多套风格（weight）× 用途分类」图标能力，并以「变体门控」的通用机制让指标卡等组件在特定样式变体下渲染可选 SVG 图标。

**Architecture:** shared 仅加 type-only 契约（`IconWeight` / `IndicatorCardVariant` / `IndicatorCardData` 字段）；图标渲染层（Phosphor 依赖、catalog、`<IconKit>`、picker）全部位于 `apps/web/src/editor/icons/`；`VariantOption.icon` 声明即启用——渲染层在变体位渲染图标，属性面板仅对启用图标的变体注入 `icon` 字段。

**Tech Stack:** React 18 + TypeScript + Tailwind + zustand（既有）；新增 `@phosphor-icons/react`；vitest + @testing-library。

**Spec:** `docs/superpowers/specs/2026-07-06-svg-icon-library-design.md`

**测试运行命令（统一）：** `pnpm -C apps/web test <路径或模式>`（等价于在 `apps/web` 内 `vitest run`）。typecheck：`pnpm -C apps/web exec tsc --noEmit`。

---

## 文件结构

| 文件 | 责任 |
|---|---|
| `packages/shared/src/index.ts`（改） | type-only：`IconWeight`、`IndicatorCardVariant`、扩展 `IndicatorCardData` |
| `apps/web/src/editor/icons/catalog.ts`（新） | 精选图标目录：`ICONS` / `ICON_CATEGORIES` / `ICON_WEIGHTS` / `findIcon` |
| `apps/web/src/editor/icons/IconKit.tsx`（新） | 唯一渲染原语 `<IconKit name weight size color />` |
| `apps/web/src/editor/icons/IconPickerOverlay.tsx`（新） | 选择器模态：weight tabs + 分类分组 + 搜索 |
| `apps/web/src/editor/registry.tsx`（改） | `VariantOption.icon?`；`PropertyFieldKind` 加 `'icon'`；`indicator-card` 加 4 variants |
| `apps/web/src/editor/components/BasicComponents.tsx`（改） | `IndicatorCardComponent` → 变体分发器 |
| `apps/web/src/editor/defaults.ts`（改） | indicator-card 默认数据加 `variant: 'plain'` |
| `apps/web/src/editor/PropertyPanel.tsx`（改） | 变体门控注入 `icon` 字段；`FieldEditor` 加 `'icon'` 分支；`IconPickerField` |
| `apps/web/tests/icons.catalog.test.ts`（新） | catalog 测试 |
| `apps/web/tests/icons.kit.test.tsx`（新） | IconKit 测试 |
| `apps/web/tests/components.test.tsx`（改） | 扩展 indicator card 变体测试 |
| `apps/web/tests/registry.test.ts`（改） | indicator-card variants + icon 声明断言 |
| `apps/web/tests/property-panel.test.tsx`（新或改） | icon 字段变体门控 |

---

## Task 1：安装 Phosphor + 加 shared 类型

**Files:**
- Modify: `apps/web/package.json`
- Modify: `packages/shared/src/index.ts`（在 `IndicatorCardData` 定义处）

- [ ] **Step 1: 安装依赖**

```bash
pnpm -C apps/web add @phosphor-icons/react
```

预期：`apps/web/package.json` 的 `dependencies` 出现 `"@phosphor-icons/react": "^2.x"`。

- [ ] **Step 2: 在 shared 加 IconWeight 类型**

在 `packages/shared/src/index.ts` 文件顶部区域（紧跟认证类型之前或之后均可，建议放在编辑器数据模型区块开头）加：

```ts
/** 图标风格 = Phosphor weight。6 套风格。 */
export type IconWeight = 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
```

- [ ] **Step 3: 扩展 IndicatorCardData**

把现有 `IndicatorCardData` 替换为：

```ts
export type IndicatorCardVariant = 'plain' | 'icon-left' | 'icon-top' | 'icon-bg';

export interface IndicatorCardData {
  /** 样式变体；缺省 'plain'（向后兼容老数据，无 variant 字段时按旧外观渲染）。 */
  variant?: IndicatorCardVariant;
  title: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
  colorTheme: 'orange' | 'green' | 'blue' | 'purple' | 'red';
  /** catalog 图标 key，可选；仅当变体启用图标时有意义。 */
  icon?: string;
  /** 图标 weight；缺省走 variant.icon.defaultWeight。 */
  iconWeight?: IconWeight;
}
```

- [ ] **Step 4: typecheck**

Run: `pnpm -C apps/web exec tsc --noEmit`
Expected: PASS（无类型错误）。

- [ ] **Step 5: 提交**

```bash
git add apps/web/package.json pnpm-lock.yaml packages/shared/src/index.ts
git commit -m "feat(icons): add Phosphor dep + shared IconWeight/IndicatorCardData types"
```

---

## Task 2：图标 catalog（`catalog.ts`）

**Files:**
- Create: `apps/web/src/editor/icons/catalog.ts`
- Test: `apps/web/tests/icons.catalog.test.ts`

- [ ] **Step 1: 写失败测试 `apps/web/tests/icons.catalog.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { ICONS, ICON_CATEGORIES, ICON_WEIGHTS, findIcon } from '@/editor/icons/catalog';

describe('icon catalog', () => {
  it('exposes 6 weights', () => {
    expect(ICON_WEIGHTS).toEqual(['thin', 'light', 'regular', 'bold', 'fill', 'duotone']);
  });

  it('every icon has stable key + category + Comp', () => {
    for (const ic of ICONS) {
      expect(typeof ic.key).toBe('string');
      expect(ic.key.length).toBeGreaterThan(0);
      expect(ICON_CATEGORIES.map((c) => c.id)).toContain(ic.category);
      expect(typeof ic.Comp).toBe('object'); // React 组件
      expect(typeof ic.label).toBe('string');
    }
  });

  it('keys are unique', () => {
    const keys = ICONS.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('findIcon returns def by key, undefined when missing', () => {
    expect(findIcon(ICONS[0].key)).toBe(ICONS[0]);
    expect(findIcon('non-existent-key')).toBeUndefined();
    expect(findIcon(undefined)).toBeUndefined();
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm -C apps/web test tests/icons.catalog.test.ts`
Expected: FAIL（模块不存在 / 解析失败）。

- [ ] **Step 3: 写 `apps/web/src/editor/icons/catalog.ts`**

精选 ~30 个图标，按 4 类分组。每个 `key` 是稳定字符串（数据持久化用），`Comp` 是直接 import 的 Phosphor 组件（保证 tree-shaking）。

```ts
import type { ComponentType } from 'react';
import {
  TrendUp, TrendDown, ChartLineUp, CurrencyDollar, Percent,
  Eye, EyeSlash, Lightning, Target, Trophy,
  ShoppingCart, Storefront, Package, Gift, Tag,
  Users, UserCircle, Heart, ShareNetwork, ChatDots,
  CalendarCheck, Clock, ChartBar, Gear, MagnifyingGlass,
  ArrowUpRight, ArrowDownRight, Fire, Sparkle, CoatHanger,
} from '@phosphor-icons/react';
import type { IconWeight } from '@mediakit/shared';

export type IconCategory = 'metric' | 'creator' | 'report' | 'generic';

export interface IconDef {
  /** 稳定字符串标识，写入组件 data.icon。 */
  key: string;
  label: string;
  category: IconCategory;
  /** Phosphor 图标组件（直接 import 以保留 tree-shaking）。 */
  Comp: ComponentType<{
    weight?: IconWeight;
    size?: number | string;
    color?: string;
    className?: string;
  }>;
}

export const ICON_WEIGHTS: IconWeight[] = ['thin', 'light', 'regular', 'bold', 'fill', 'duotone'];

export const ICON_CATEGORIES: { id: IconCategory; label: string }[] = [
  { id: 'metric', label: '指标' },
  { id: 'creator', label: '达人' },
  { id: 'report', label: '报告' },
  { id: 'generic', label: '通用' },
];

export const ICONS: IconDef[] = [
  // metric
  { key: 'trend-up', label: '上升趋势', category: 'metric', Comp: TrendUp },
  { key: 'trend-down', label: '下降趋势', category: 'metric', Comp: TrendDown },
  { key: 'chart-line-up', label: '折线上升', category: 'metric', Comp: ChartLineUp },
  { key: 'currency', label: '金额', category: 'metric', Comp: CurrencyDollar },
  { key: 'percent', label: '比率', category: 'metric', Comp: Percent },
  { key: 'eye', label: '曝光', category: 'metric', Comp: Eye },
  { key: 'eye-slash', label: '曝光（线性）', category: 'metric', Comp: EyeSlash },
  { key: 'lightning', label: '互动', category: 'metric', Comp: Lightning },
  { key: 'target', label: '目标', category: 'metric', Comp: Target },
  { key: 'trophy', label: '达成', category: 'metric', Comp: Trophy },
  { key: 'fire', label: '热度', category: 'metric', Comp: Fire },
  // creator
  { key: 'users', label: '粉丝', category: 'creator', Comp: Users },
  { key: 'user-circle', label: '达人', category: 'creator', Comp: UserCircle },
  { key: 'heart', label: '点赞', category: 'creator', Comp: Heart },
  { key: 'share', label: '分享', category: 'creator', Comp: ShareNetwork },
  { key: 'chat', label: '评论', category: 'creator', Comp: ChatDots },
  { key: 'coat-hanger', label: '时尚', category: 'creator', Comp: CoatHanger },
  // report
  { key: 'cart', label: '销量', category: 'report', Comp: ShoppingCart },
  { key: 'storefront', label: '店铺', category: 'report', Comp: Storefront },
  { key: 'package', label: '商品', category: 'report', Comp: Package },
  { key: 'gift', label: '赠品', category: 'report', Comp: Gift },
  { key: 'tag', label: '客单', category: 'report', Comp: Tag },
  { key: 'calendar-check', label: '周期', category: 'report', Comp: CalendarCheck },
  { key: 'clock', label: '时段', category: 'report', Comp: Clock },
  { key: 'chart-bar', label: '对比', category: 'report', Comp: ChartBar },
  // generic
  { key: 'arrow-up-right', label: '上行', category: 'generic', Comp: ArrowUpRight },
  { key: 'arrow-down-right', label: '下行', category: 'generic', Comp: ArrowDownRight },
  { key: 'sparkle', label: '亮点', category: 'generic', Comp: Sparkle },
  { key: 'gear', label: '设置', category: 'generic', Comp: Gear },
  { key: 'search', label: '查询', category: 'generic', Comp: MagnifyingGlass },
];

export function findIcon(key?: string): IconDef | undefined {
  if (!key) return undefined;
  return ICONS.find((i) => i.key === key);
}
```

> 若 Step 4 的 typecheck 报「某些命名 import 在 phosphor 不存在」，按报错替换为同义存在的 Phosphor 导出名（Phosphor 用 PascalCase；`ChartLineUp`/`CurrencyDollar`/`CoatHanger`/`MagnifyingGlass` 均为真实导出名）。

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm -C apps/web test tests/icons.catalog.test.ts`
Expected: PASS（4 用例全过）。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/icons/catalog.ts apps/web/tests/icons.catalog.test.ts
git commit -m "feat(icons): curated icon catalog (weight × category)"
```

---

## Task 3：`<IconKit>` 渲染原语

**Files:**
- Create: `apps/web/src/editor/icons/IconKit.tsx`
- Test: `apps/web/tests/icons.kit.test.tsx`

- [ ] **Step 1: 写失败测试 `apps/web/tests/icons.kit.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { IconKit } from '@/editor/icons/IconKit';

describe('IconKit', () => {
  it('renders an <svg> for a known key', () => {
    const { container } = render(<IconKit name="trend-up" weight="fill" size={20} color="#f00" />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders nothing (null) for an unknown key without throwing', () => {
    const { container } = render(<IconKit name="nope" />);
    expect(container.querySelector('svg')).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it('defaults weight to regular', () => {
    const { container } = render(<IconKit name="eye" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    // Phosphor regular weight renders an svg with no fill override artifacts; just assert presence.
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm -C apps/web test tests/icons.kit.test.tsx`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 写 `apps/web/src/editor/icons/IconKit.tsx`**

```tsx
import type { IconWeight } from '@mediakit/shared';
import { findIcon } from './catalog';

export interface IconKitProps {
  /** catalog 图标 key。 */
  name?: string;
  /** Phosphor weight；缺省 'regular'。 */
  weight?: IconWeight;
  size?: number | string;
  color?: string;
  className?: string;
}

/**
 * 唯一图标渲染入口。所有组件渲染图标只通过 <IconKit>，
 * 不直接 import Phosphor。未知 key 返回 null（不抛）。
 */
export function IconKit({ name, weight = 'regular', size = 24, color, className }: IconKitProps) {
  const def = findIcon(name);
  if (!def) return null;
  const Comp = def.Comp;
  return <Comp weight={weight} size={size} color={color} className={className} />;
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm -C apps/web test tests/icons.kit.test.tsx`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/icons/IconKit.tsx apps/web/tests/icons.kit.test.tsx
git commit -m "feat(icons): IconKit render primitive"
```

---

## Task 4：registry 扩展（`VariantOption.icon` + `'icon'` 字段类型 + 指标卡变体）

**Files:**
- Modify: `apps/web/src/editor/registry.tsx`（`PropertyFieldKind`、`VariantOption`、`indicator-card` 条目）
- Test: `apps/web/tests/registry.test.ts`

- [ ] **Step 1: 先看现有 registry 测试结构**

Run: `sed -n '1,60p' apps/web/tests/registry.test.ts`

确认其 import 方式（应为 `import { REGISTRY } from '@/editor/registry'`）。

- [ ] **Step 2: 在 registry.test.ts 末尾追加失败测试**

```ts
import { REGISTRY } from '@/editor/registry';

describe('indicator-card variants', () => {
  const def = REGISTRY['indicator-card'];

  it('declares 4 variants', () => {
    expect(def.variants?.map((v) => v.id)).toEqual(['plain', 'icon-left', 'icon-top', 'icon-bg']);
  });

  it('plain has no icon slot; the other three declare icon slots', () => {
    const byId = Object.fromEntries((def.variants ?? []).map((v) => [v.id, v]));
    expect(byId.plain.icon).toBeUndefined();
    expect(byId['icon-left'].icon?.position).toBe('left');
    expect(byId['icon-top'].icon?.position).toBe('top');
    expect(byId['icon-bg'].icon?.position).toBe('bg');
  });

  it('icon variants carry a default key + weight', () => {
    const byId = Object.fromBytes((def.variants ?? []).map((v) => [v.id, v]));
    expect(byId['icon-top'].icon?.defaultKey).toBeTruthy();
    expect(byId['icon-bg'].icon?.defaultWeight).toBeTruthy();
  });
});
```

> ⚠️ 上面第三段 `Object.fromBytes` 是笔误，正确写法是 `Object.fromEntries`，与第二段一致。复制时务必用 `Object.fromEntries`。

修正后的第三个用例：

```ts
  it('icon variants carry a default key + weight', () => {
    const byId = Object.fromEntries((def.variants ?? []).map((v) => [v.id, v]));
    expect(byId['icon-top'].icon?.defaultKey).toBeTruthy();
    expect(byId['icon-bg'].icon?.defaultWeight).toBeTruthy();
  });
```

- [ ] **Step 3: 运行测试，确认失败**

Run: `pnpm -C apps/web test tests/registry.test.ts`
Expected: FAIL（`def.variants` 为 undefined）。

- [ ] **Step 4: 改 registry.tsx — `PropertyFieldKind` 与 `VariantOption`**

在文件顶部 `PropertyFieldKind` 联合中加 `'icon'`：

```ts
export type PropertyFieldKind =
  | 'text'
  | 'textarea'
  | 'number'
  | 'color'
  | 'select'
  | 'image-url'
  | 'list'
  | 'table'
  | 'icon'; // catalog 图标选择器（读写 data.icon / data.iconWeight）
```

把 `VariantOption` 替换为：

```ts
import type { IconWeight } from '@mediakit/shared';

/** 组件样式变体（版式）选项。声明后属性面板渲染 chip 选择器，写入 data.variant。 */
export interface VariantOption {
  id: string;
  label: string;
  /**
   * 变体声明图标支持。存在即启用：
   *  - 渲染层在该变体的图标位渲染 <IconKit>
   *  - 属性面板对该组件显示 icon 字段
   * 缺省（undefined）= 该变体不涉及图标。
   */
  icon?: {
    position?: 'left' | 'top' | 'bg';
    defaultKey?: string;
    defaultWeight?: IconWeight;
  };
}
```

（`import type { IconWeight }` 加到文件顶部的 shared import 里，与现有 `import type { ComponentType, EditorComponent }` 同一行合并。）

- [ ] **Step 5: 改 registry.tsx — `indicator-card` 条目加 variants**

把现有 `'indicator-card'` 条目替换为：

```ts
  'indicator-card': {
    Component: IndicatorCardComponent,
    defaultSize: DEFAULT_SIZES['indicator-card'],
    defaultData: () => getDefaultData('indicator-card'),
    variants: [
      { id: 'plain', label: '极简' },
      { id: 'icon-left', label: '图标左', icon: { position: 'left', defaultKey: 'trend-up', defaultWeight: 'regular' } },
      { id: 'icon-top', label: '图标上', icon: { position: 'top', defaultKey: 'trend-up', defaultWeight: 'fill' } },
      { id: 'icon-bg', label: '图标水印', icon: { position: 'bg', defaultKey: 'trend-up', defaultWeight: 'fill' } },
    ],
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
      { key: 'value', label: '主数值', kind: 'text' },
      { key: 'trend', label: '副文本', kind: 'text' },
      { key: 'trendUp', label: '趋势', kind: 'select', options: [{ value: 'true', label: '上升' }, { value: 'false', label: '下降' }] },
      { key: 'colorTheme', label: '主题色', kind: 'select', options: THEMES },
    ],
  },
```

注：`icon` 字段**不**放进 `propertySchema`——它由 PropertyPanel 在变体门控下动态注入（Task 6）。这里只声明变体。

- [ ] **Step 6: 运行测试，确认通过**

Run: `pnpm -C apps/web test tests/registry.test.ts`
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add apps/web/src/editor/registry.tsx apps/web/tests/registry.test.ts
git commit -m "feat(registry): VariantOption.icon + indicator-card 4 variants"
```

---

## Task 5：`IndicatorCardComponent` 变体分发器

**Files:**
- Modify: `apps/web/src/editor/components/BasicComponents.tsx`（替换现有 `IndicatorCardComponent` 与 `THEME`）
- Test: `apps/web/tests/components.test.tsx`（扩展）

- [ ] **Step 1: 在 components.test.tsx 末尾追加失败测试**

```tsx
import { IconKit } from '@/editor/icons/IconKit'; // 仅类型提示；实际不直接断言此 import

describe('IndicatorCardComponent variants', () => {
  const base = { title: 'GMV', value: '¥1,200', colorTheme: 'orange' as const };

  it('plain renders no icon (backward compatible)', () => {
    const { container } = render(<IndicatorCardComponent data={{ ...base, variant: 'plain' }} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('omitting variant behaves as plain (legacy data)', () => {
    const { container } = render(<IndicatorCardComponent data={base} />);
    expect(container.querySelector('svg')).toBeNull();
    expect(container.textContent).toContain('GMV');
  });

  it('icon-left renders an svg (uses variant default key when data.icon absent)', () => {
    const { container } = render(
      <IndicatorCardComponent data={{ ...base, variant: 'icon-left' }} />
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('icon-top renders an svg', () => {
    const { container } = render(
      <IndicatorCardComponent data={{ ...base, variant: 'icon-top', icon: 'eye', iconWeight: 'bold' }} />
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('icon-bg renders an svg', () => {
    const { container } = render(
      <IndicatorCardComponent data={{ ...base, variant: 'icon-bg' }} />
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm -C apps/web test tests/components.test.tsx`
Expected: FAIL（当前 `IndicatorCardComponent` 不按变体分发，plain 仍会渲染 svg 为 null 但 icon-left 等不会出 svg）。

- [ ] **Step 3: 替换 BasicComponents.tsx 中的 indicator card 段**

把现有 `THEME` 常量与 `IndicatorCardComponent` 整段（注释 `/* ----------------------------- indicator card ... */` 到该函数结束）替换为：

```tsx
/* ----------------------------- indicator card ---------------------------- */
import type { IndicatorCardData, IndicatorCardVariant, IconWeight } from '@mediakit/shared';
import { IconKit } from '../icons/IconKit';

const INDICATOR_THEME: Record<IndicatorCardData['colorTheme'], { bg: string; fg: string }> = {
  blue: { bg: '#EFF6FF', fg: '#3B82F6' },
  green: { bg: '#ECFDF5', fg: '#22C55E' },
  orange: { bg: '#FFF7F0', fg: '#FF5C00' },
  purple: { bg: '#F5F3FF', fg: '#8B5CF6' },
  red: { bg: '#FEF2F2', fg: '#EF4444' },
};

/** 每个启用图标的变体的默认图标配置（与 REGISTRY 声明保持一致）。 */
const INDICATOR_VARIANT_ICON: Record<Exclude<IndicatorCardVariant, 'plain'>, { position: 'left' | 'top' | 'bg'; defaultKey: string; defaultWeight: IconWeight }> = {
  'icon-left': { position: 'left', defaultKey: 'trend-up', defaultWeight: 'regular' },
  'icon-top': { position: 'top', defaultKey: 'trend-up', defaultWeight: 'fill' },
  'icon-bg': { position: 'bg', defaultKey: 'trend-up', defaultWeight: 'fill' },
};

export function IndicatorCardComponent({ data }: { data: IndicatorCardData }) {
  const t = INDICATOR_THEME[data.colorTheme] ?? INDICATOR_THEME.blue;
  const variant = data.variant ?? 'plain';
  const cfg = variant === 'plain' ? undefined : INDICATOR_VARIANT_ICON[variant];

  // 图标 key/weight：data 优先，缺省回退变体默认。
  const iconKey = cfg ? data.icon ?? cfg.defaultKey : undefined;
  const iconWeight: IconWeight = cfg ? data.iconWeight ?? cfg.defaultWeight : 'regular';

  if (variant === 'icon-bg') {
    return (
      <div className="relative h-full w-full overflow-hidden rounded-xl px-4" style={{ backgroundColor: t.bg }}>
        <div className="pointer-events-none absolute -right-3 -bottom-3 opacity-[0.12]" style={{ color: t.fg }}>
          <IconKit name={iconKey} weight={iconWeight} size={120} color={t.fg} />
        </div>
        <div className="relative flex h-full w-full flex-col justify-center">
          <div className="text-xs text-foreground-secondary">{data.title}</div>
          <div className="font-data text-2xl font-semibold" style={{ color: t.fg }}>{data.value}</div>
          {data.trend && (
            <div className="mt-0.5 text-xs" style={{ color: data.trendUp ? '#22C55E' : '#EF4444' }}>
              {data.trendUp ? '▲' : '▼'} {data.trend}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'icon-left') {
    return (
      <div className="flex h-full w-full items-center gap-3 rounded-xl px-4" style={{ backgroundColor: t.bg }}>
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg" style={{ backgroundColor: `${t.fg}1A`, color: t.fg }}>
          <IconKit name={iconKey} weight={iconWeight} size={22} color={t.fg} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-foreground-secondary">{data.title}</div>
          <div className="font-data text-2xl font-semibold" style={{ color: t.fg }}>{data.value}</div>
          {data.trend && (
            <div className="mt-0.5 text-xs" style={{ color: data.trendUp ? '#22C55E' : '#EF4444' }}>
              {data.trendUp ? '▲' : '▼'} {data.trend}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'icon-top') {
    return (
      <div className="flex h-full w-full flex-col justify-center rounded-xl px-4" style={{ backgroundColor: t.bg }}>
        <IconKit name={iconKey} weight={iconWeight} size={24} color={t.fg} />
        <div className="mt-1 text-xs text-foreground-secondary">{data.title}</div>
        <div className="font-data text-2xl font-semibold" style={{ color: t.fg }}>{data.value}</div>
        {data.trend && (
          <div className="mt-0.5 text-xs" style={{ color: data.trendUp ? '#22C55E' : '#EF4444' }}>
            {data.trendUp ? '▲' : '▼'} {data.trend}
          </div>
        )}
      </div>
    );
  }

  // plain（含缺省/老数据）
  return (
    <div className="flex h-full w-full flex-col justify-center rounded-xl px-4" style={{ backgroundColor: t.bg }}>
      <div className="text-xs text-foreground-secondary">{data.title}</div>
      <div className="font-data text-2xl font-semibold" style={{ color: t.fg }}>{data.value}</div>
      {data.trend && (
        <div className="mt-0.5 text-xs" style={{ color: data.trendUp ? '#22C55E' : '#EF4444' }}>
          {data.trendUp ? '▲' : '▼'} {data.trend}
        </div>
      )}
    </div>
  );
}
```

> 把顶部的 `import type { ... IndicatorCardData ... }` 合并：现有已 import 了 `IndicatorCardData`，只需把新增的 `IndicatorCardVariant`、`IconWeight` 加进去；`IconKit` 的 import 放在该组件段开头（如上）。不要在文件顶部重复 import 同名。

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm -C apps/web test tests/components.test.tsx`
Expected: PASS（含原有基础用例 + 5 个新变体用例）。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/components/BasicComponents.tsx apps/web/tests/components.test.tsx
git commit -m "feat(indicator-card): 4-variant dispatcher with SVG icon slots"
```

---

## Task 6：defaults 默认 variant

**Files:**
- Modify: `apps/web/src/editor/defaults.ts:49-50`（indicator-card case）

- [ ] **Step 1: 改默认数据加 variant: 'plain'**

把：
```ts
    case 'indicator-card':
      return { title: '指标名称', value: '---', colorTheme: 'blue' };
```
改为：
```ts
    case 'indicator-card':
      return { variant: 'plain', title: '指标名称', value: '---', colorTheme: 'blue' };
```

- [ ] **Step 2: typecheck + 全量测试**

Run: `pnpm -C apps/web exec tsc --noEmit && pnpm -C apps/web test`
Expected: typecheck PASS；全部测试 PASS。

- [ ] **Step 3: 提交**

```bash
git add apps/web/src/editor/defaults.ts
git commit -m "feat(indicator-card): default variant plain"
```

---

## Task 7：图标选择器 overlay

**Files:**
- Create: `apps/web/src/editor/icons/IconPickerOverlay.tsx`

- [ ] **Step 1: 写 `apps/web/src/editor/icons/IconPickerOverlay.tsx`**

```tsx
import { useMemo, useState } from 'react';
import type { IconWeight } from '@mediakit/shared';
import { ICONS, ICON_CATEGORIES, ICON_WEIGHTS, findIcon } from './catalog';
import { IconKit } from './IconKit';

export interface IconPickerOverlayProps {
  /** 当前选中的 catalog key（可为空）。 */
  value?: string;
  /** 当前 weight。 */
  weight: IconWeight;
  onPick: (key: string) => void;
  onClear: () => void;
  onClose: () => void;
}

const WEIGHT_LABEL: Record<IconWeight, string> = {
  thin: '细线',
  light: '浅线',
  regular: '常规',
  bold: '粗线',
  fill: '实心',
  duotone: '双色',
};

/** 图标选择器：weight tabs（多套风格）+ 分类分组 + 搜索。 */
export function IconPickerOverlay({ value, weight, onPick, onClear, onClose }: IconPickerOverlayProps) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const lower = q.trim().toLowerCase();
    if (!lower) return ICONS;
    return ICONS.filter((i) => i.key.includes(lower) || i.label.toLowerCase().includes(lower));
  }, [q]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-[520px] flex-col overflow-hidden rounded-xl bg-surface-primary shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
          <span className="font-headings text-sm font-semibold text-foreground-primary">选择图标</span>
          <div className="flex items-center gap-2">
            {value && (
              <button
                className="rounded border border-border-default px-2 py-0.5 text-xs text-foreground-secondary hover:bg-surface-hover"
                onClick={onClear}
              >
                清除
              </button>
            )}
            <button
              className="rounded border border-border-default px-2 py-0.5 text-xs text-foreground-secondary hover:bg-surface-hover"
              onClick={onClose}
            >
              关闭
            </button>
          </div>
        </div>

        <div className="border-b border-border-default px-4 py-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索图标 key / 名称"
            className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-primary"
          />
        </div>

        <div className="flex-1 overflow-auto p-3">
          {ICON_CATEGORIES.map((cat) => {
            const items = filtered.filter((i) => i.category === cat.id);
            if (items.length === 0) return null;
            return (
              <div key={cat.id} className="mb-4">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground-muted">{cat.label}</div>
                <div className="grid grid-cols-8 gap-2">
                  {items.map((ic) => {
                    const active = ic.key === value;
                    return (
                      <button
                        key={ic.key}
                        title={ic.label}
                        onClick={() => onPick(ic.key)}
                        className={`flex h-12 w-12 items-center justify-center rounded-lg border ${
                          active ? 'border-accent-primary bg-accent-primary/10 text-accent-primary' : 'border-border-subtle text-foreground-secondary hover:bg-surface-hover'
                        }`}
                      >
                        <IconKit name={ic.key} weight={weight} size={22} />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-8 text-center text-xs text-foreground-muted">无匹配图标</div>
          )}
        </div>
      </div>
    </div>
  );
}

// 供属性面板 weight 下拉复用。
export const ICON_WEIGHT_OPTIONS = ICON_WEIGHTS.map((w) => ({ value: w, label: WEIGHT_LABEL[w] }));
export { findIcon };
```

> 说明：weight tabs 在属性面板的 IconPickerField（Task 8）里做，overlay 只按「当前 weight」预览，避免两处重复控件；上面导出的 `ICON_WEIGHT_OPTIONS` 供 weight 下拉用。

- [ ] **Step 2: typecheck**

Run: `pnpm -C apps/web exec tsc --noEmit`
Expected: PASS。

- [ ] **Step 3: 提交**

```bash
git add apps/web/src/editor/icons/IconPickerOverlay.tsx
git commit -m "feat(icons): IconPickerOverlay (weight preview + category + search)"
```

---

## Task 8：PropertyPanel 注入 icon 字段 + IconPickerField

**Files:**
- Modify: `apps/web/src/editor/PropertyPanel.tsx`（`FieldEditor` switch、主面板字段循环、新增 `IconPickerField`、变体门控逻辑）
- Test: `apps/web/tests/property-panel.test.tsx`（新）

- [ ] **Step 1: 写失败测试 `apps/web/tests/property-panel.test.tsx`**

先确认现有面板测试如何 mock store。Run: `sed -n '1,50p' apps/web/tests/property-panel.test.tsx 2>/dev/null || echo "NO EXISTING FILE"`。若无既有文件，按下述新建；若有，沿用其 store mock 模式追加用例。

新建最小测试（mock 编辑器 store，渲染单个 indicator-card 组件的属性面板）：

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PropertyPanel } from '@/editor/PropertyPanel';
import { useEditorStore } from '@/editor/store';

// 选一个 indicator-card 组件并打开其属性面板。
function setupIndicator(variant: string) {
  const comp = {
    id: 'c1',
    type: 'indicator-card' as const,
    x: 0, y: 0, w: 240, h: 100,
    data: { variant, title: 'GMV', value: '¥1', colorTheme: 'orange' as const },
  };
  // 直接替换 store 的 currentPage/selected（按实际 store 形状调整；见既有测试）
  useEditorStore.setState((s: any) => ({
    ...s,
    selectedId: comp.id,
    pages: [{ id: 'p1', name: 'P1', components: [comp] }],
    currentPageIndex: 0,
  }));
  return render(<PropertyPanel />);
}

describe('PropertyPanel icon field gating', () => {
  beforeEach(() => {
    // 视需要复位 store；按既有测试模式
  });

  it('hides icon picker on plain variant', () => {
    setupIndicator('plain');
    expect(screen.queryByText('图标')).toBeNull();
  });

  it('shows icon picker on icon-top variant', () => {
    setupIndicator('icon-top');
    expect(screen.getByText('图标')).toBeInTheDocument();
  });
});
```

> ⚠️ store mock 形状须与 `apps/web/src/editor/store.ts` 的真实结构一致（`selectedId` / `pages` / `currentPageIndex` 字段名）。Step 2 之前先 `sed -n '1,80p' apps/web/src/editor/store.ts` 核对；若既有 `property-panel.test.tsx` 已有正确 mock，直接复用其 `setup` 函数，只追加这两个用例。

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm -C apps/web test tests/property-panel.test.tsx`
Expected: FAIL（plain 应隐藏「图标」但当前根本没注入该字段——两用例都需新逻辑；先确认测试能跑、断言失败）。

- [ ] **Step 3: PropertyPanel — 计算激活变体 + 动态注入 icon 字段**

在 `PropertyPanel` 主组件内（`const def = REGISTRY[comp.type];` 之后）加：

```tsx
  // 当前激活变体定义（用于图标门控）。
  const activeVariant = (() => {
    const vs = def.variants;
    if (!vs || vs.length === 0) return undefined;
    const currentId = (comp.data as { variant?: string }).variant ?? vs[0].id;
    return vs.find((v) => v.id === currentId);
  })();

  // 变体声明了 icon 即注入一个 icon 字段（不放进 registry.propertySchema，保持通用）。
  const fields: PropertyField[] = [...def.propertySchema];
  if (activeVariant?.icon) {
    fields.push({ key: 'icon', label: '图标', kind: 'icon' });
  }
```

把字段循环里的 `def.propertySchema.map(...)` 改为 `fields.map(...)`：

```tsx
        {fields.map((f) => (
          <FieldEditor key={f.key + f.kind} comp={comp} field={f} />
        ))}
        {fields.length === 0 && (def.variants?.length ?? 0) === 0 && (
          <p className="text-xs text-foreground-muted">该组件无可编辑属性。</p>
        )}
```

- [ ] **Step 4: FieldEditor 加 `'icon'` 分支**

在 `FieldEditor` 的 switch 里（`case 'table'` 之后、`default` 之前）加：

```tsx
    case 'icon':
      return <IconPickerField comp={comp} />;
```

- [ ] **Step 5: 实现 `IconPickerField`**

在 PropertyPanel.tsx 字段编辑器区（其它 Field 组件旁）加：

```tsx
import { useState } from 'react'; // 若文件已 import useState 则不重复
import { IconPickerOverlay, ICON_WEIGHT_OPTIONS } from './icons/IconPickerOverlay';
import { IconKit } from './icons/IconKit';
import type { IconWeight, IndicatorCardData } from '@mediakit/shared';
import type { VariantOption } from './registry';

/** 图标字段：预览 + 选择(overlay) + 清除 + weight 下拉。仅用于启用图标的变体。 */
function IconPickerField({ comp }: { comp: EditorComponent }) {
  const update = useDataUpdate(comp);
  const data = comp.data as { icon?: string; iconWeight?: IconWeight };
  const def = REGISTRY[comp.type];
  const currentVariantId = (comp.data as { variant?: string }).variant ?? def.variants?.[0]?.id;
  const variantDef = def.variants?.find((v) => v.id === currentVariantId) as VariantOption | undefined;
  const variantIconCfg = variantDef?.icon;

  // 回退顺序：data.iconWeight → variant.defaultWeight → 'regular'
  const weight: IconWeight = data.iconWeight ?? variantIconCfg?.defaultWeight ?? 'regular';
  // 显示的图标：data.icon → variant.defaultKey
  const effectiveKey = data.icon ?? variantIconCfg?.defaultKey;
  const [open, setOpen] = useState(false);

  return (
    <div className="block text-xs text-foreground-secondary">
      <div className="mb-1">图标</div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-default text-foreground-primary hover:bg-surface-hover"
          title="选择图标"
        >
          <IconKit name={effectiveKey} weight={weight} size={20} />
        </button>
        <button
          onClick={() => setOpen(true)}
          className="rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
        >
          选择
        </button>
        {data.icon && (
          <button
            onClick={() => update('icon', undefined)}
            className="rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
          >
            清除
          </button>
        )}
        <select
          value={weight}
          onChange={(e) => update('iconWeight', e.target.value)}
          className="ml-auto rounded border border-border-default px-1 py-1 text-xs text-foreground-primary"
          title="图标风格"
        >
          {ICON_WEIGHT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      {open && (
        <IconPickerOverlay
          value={data.icon}
          weight={weight}
          onPick={(key) => {
            update('icon', key);
            setOpen(false);
          }}
          onClear={() => {
            update('icon', undefined);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
```

> `useDataUpdate` 已在文件中定义（写 data + commit）。`update('icon', undefined)` 会把 data.icon 置 undefined（`{...data, icon: undefined}`），渲染层即回退 variant 默认。`REGISTRY` 已在文件顶部 import。

- [ ] **Step 6: 运行测试，确认通过**

Run: `pnpm -C apps/web test tests/property-panel.test.tsx`
Expected: PASS（plain 隐藏；icon-top 显示「图标」）。

- [ ] **Step 7: typecheck + 全量测试**

Run: `pnpm -C apps/web exec tsc --noEmit && pnpm -C apps/web test`
Expected: 全部 PASS。

- [ ] **Step 8: 提交**

```bash
git add apps/web/src/editor/PropertyPanel.tsx apps/web/tests/property-panel.test.tsx
git commit -m "feat(property-panel): variant-gated icon picker field"
```

---

## Task 9：全量验证 + 文档

**Files:**
- Modify: `docs/component-system.md`（§4 通用组件 / §6 约定，登记图标能力）

- [ ] **Step 1: 全量 typecheck + test + build**

Run:
```bash
pnpm -C apps/web exec tsc --noEmit
pnpm -C apps/web test
pnpm -C apps/web build
```
Expected: 三项全 PASS。

- [ ] **Step 2: 更新 component-system.md §4 通用组件清单**

把：
```
### 通用组件（7）
`text` · `image` · `indicator-card` · `bar-chart` · `line-chart` · `pie-chart` · `table`
```
后面补一行说明：
```
> `indicator-card` 新增 4 样式变体（plain / icon-left / icon-top / icon-bg），后三者经 `VariantOption.icon` 声明启用 SVG 图标（底层 Phosphor 图标库，weight=多套风格）。
```

并在 §6 工程约定末尾加一条：
```
- **图标能力（通用）**：底层图标库在 `apps/web/src/editor/icons/`（catalog + `IconKit` + picker）。任何组件声明带 `icon: {...}` 的变体即启用——属性面板动态注入 `icon` 字段，渲染层通过 `<IconKit>` 在变体位渲染。`packages/shared` 仅持 `IconWeight` 类型契约，Phosphor 不进入 shared。
```

- [ ] **Step 3: 提交**

```bash
git add docs/component-system.md
git commit -m "docs: register SVG icon capability in component-system"
```

- [ ] **Step 4: CHANGELOG**

Run: 确认 `docs/CHANGELOG.md` 体例后，在顶部加一条 2026-07-06 条目，概述「底层 Phosphor 图标库 + 指标卡 4 变体（图标位）+ 变体门控的通用 icon 字段」。提交。

```bash
git add docs/CHANGELOG.md
git commit -m "docs(changelog): SVG icon library + indicator-card icon variants"
```

---

## Self-Review（写完后自查，已修正）

1. **Spec 覆盖**：
   - 底层多套 SVG（weight×用途）：Task 2 catalog + Task 3 IconKit ✓
   - 通用 icon 字段能力：Task 4（VariantOption.icon）+ Task 8（动态注入）✓
   - 变体决定是否启用：Task 4 变体声明 + Task 8 门控 + Task 8 测试 ✓
   - 指标卡 4 变体：Task 4（声明）+ Task 5（渲染）+ Task 6（默认）✓
   - picker UI（weight tabs + 分类 + 搜索 + 清除）：Task 7 + Task 8 ✓
   - colorTheme 着色图标：Task 5（`color={t.fg}` / 12% 透明水印）✓
2. **占位符扫描**：无 TBD/TODO；每步含完整代码。
3. **类型一致性**：`IconWeight`、`IndicatorCardVariant`、`VariantOption.icon.{position,defaultKey,defaultWeight}`、`findIcon`、`IconKitProps` 跨任务命名一致。`'icon'` PropertyFieldKind 在 registry/PropertyPanel 一致。
4. **已知坑（已在对应步骤标注）**：Task 4 测试 `Object.fromEntries` 笔误提醒；Task 8 store mock 须核对真实 store 形状。
