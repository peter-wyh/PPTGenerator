# 基础信息组件（meta-strip）样式变体 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 `meta-strip`（基础信息）组件补齐 variant 系统，新增 4 种版式（divider/list/cards/stat），加上作为默认的现有 inline 样式共 5 个变体。

**Architecture:** 复用项目现有 variant 机制——`registry` 声明 `variants` → 属性面板自动渲染 chip 选择器写 `data.variant` → 渲染层按 variant 分支到独立子组件，缺省回退 `inline` 保证老数据零视觉变化。数据复用现有 `[图标, 标签, 文本]`，不新增字段；`ComponentType` 不变。

**Tech Stack:** React 18 + TypeScript + Tailwind（主题 token）+ vitest + @testing-library/react。

**Spec:** `docs/superpowers/specs/2026-07-08-meta-strip-variants-design.md`

**约定:**
- 测试遵循 [[web-chart-test-convention]]：本组件无图表，断言 shell 文本 + 结构 class。
- `'meta-strip'` type id 不变（[[component-type-is-persisted-schema]]）。
- 每个任务结束 commit。命令在仓库根目录执行。

---

### Task 1: 数据模型——新增 `MetaStripVariant` 类型

**Files:**
- Modify: `packages/shared/src/index.ts:774-780`（`MetaStripData` 定义处）

- [ ] **Step 1: 给 `MetaStripData` 加 `variant` 字段并新增变体类型**

把 `packages/shared/src/index.ts` 中（约 774 行）现有的：

```ts
/** 基础信息横排卡组（达人画像页 BASE/TYPE/TIER）。复用 TableData 形态。 */
export interface MetaStripData {
  /** 约定 ['图标', '标签', '文本']。 */
  headers: string[];
  /** 每行 [iconKey?, label, text]；iconKey 为 catalog key，空串=无图标。 */
  rows: string[][];
}
```

替换为：

```ts
/** 基础信息横排卡组（达人画像页 BASE/TYPE/TIER）。复用 TableData 形态。 */
export type MetaStripVariant = 'inline' | 'divider' | 'list' | 'cards' | 'stat';

export interface MetaStripData {
  /** 样式变体；缺省按 'inline'（向后兼容老数据）。 */
  variant?: MetaStripVariant;
  /** 约定 ['图标', '标签', '文本']。 */
  headers: string[];
  /** 每行 [iconKey?, label, text]；iconKey 为 catalog key，空串=无图标。 */
  rows: string[][];
}
```

- [ ] **Step 2: typecheck 通过**

Run: `pnpm --filter @mediakit/shared typecheck && pnpm --filter @mediakit/web typecheck`
Expected: 两个包都通过，无报错（`MetaStripData` 已在 `ComponentData` 联合中，加可选字段不破坏现有代码）。

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): MetaStripData 增加 variant 字段 + MetaStripVariant 类型"
```

---

### Task 2: 重构 inline 渲染为 `MetaInline` 子组件 + 建立测试基线

**Files:**
- Modify: `apps/web/src/editor/components/ReportComponents.tsx:247-266`（`MetaStripComponent`）
- Test: `apps/web/tests/editor.meta-strip.test.tsx`（新建）

先把现有内联渲染抽成 `MetaInline` 子组件（行为不变），并建立测试基线保护重构。此时 dispatcher 还不引入 `variant`。

- [ ] **Step 1: 写测试文件（对当前旧实现应通过——建立基线）**

新建 `apps/web/tests/editor.meta-strip.test.tsx`：

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetaStripComponent } from '@/editor/components/ReportComponents';
import type { MetaStripData } from '@mediakit/shared';

const rows: string[][] = [
  ['target', 'BASE', 'The United States'],
  ['tag', 'TYPE', 'Beauty'],
  ['trophy', 'TIER', 'A'],
];

function dataFor(variant?: MetaStripData['variant']): MetaStripData {
  return { headers: ['图标', '标签', '文本'], rows, ...(variant ? { variant } : {}) };
}

describe('MetaStripComponent variants', () => {
  it('default (no variant) renders inline labels and text', () => {
    const { container } = render(<MetaStripComponent data={dataFor()} />);
    expect(screen.getByText('BASE')).toBeInTheDocument();
    expect(screen.getByText('The United States')).toBeInTheDocument();
    // inline 胶囊带灰底
    expect(container.querySelector('[class*="bg-surface-secondary"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: 跑测试，确认基线通过（旧实现即 inline 行为）**

Run: `pnpm --filter @mediakit/web test tests/editor.meta-strip`
Expected: PASS（1 个测试通过——旧实现本身就是横排胶囊）。

- [ ] **Step 3: 把现有 `MetaStripComponent`（247-266 行）替换为 `MetaInline` 子组件 + dispatcher**

把 `apps/web/src/editor/components/ReportComponents.tsx` 中（247-266 行）现有的：

```tsx
export function MetaStripComponent({ data }: { data: MetaStripData }) {
  const rows = data.rows ?? [];
  return (
    <div className="flex h-full w-full flex-wrap items-center gap-2 overflow-auto">
      {rows.map((r, i) => {
        const iconKey = r[0] ?? '';
        const label = r[1] ?? '';
        const text = r[2] ?? '';
        const Icon = findIcon(iconKey)?.Comp;
        return (
          <div key={i} className="flex items-center gap-1.5 rounded bg-surface-secondary px-2 py-1">
            {Icon && <Icon size={14} className="text-foreground-secondary" />}
            <span className="text-[11px] uppercase tracking-wide text-foreground-secondary">{label}</span>
            <span className="text-sm text-foreground-primary">{text}</span>
          </div>
        );
      })}
    </div>
  );
}
```

替换为：

```tsx
type MetaItem = { iconKey: string; label: string; text: string };

function MetaInline({ items }: { items: MetaItem[] }) {
  return (
    <div className="flex h-full w-full flex-wrap items-center gap-2 overflow-auto">
      {items.map((it, i) => {
        const Icon = findIcon(it.iconKey)?.Comp;
        return (
          <div key={i} className="flex items-center gap-1.5 rounded bg-surface-secondary px-2 py-1">
            {Icon && <Icon size={14} className="text-foreground-secondary" />}
            <span className="text-[11px] uppercase tracking-wide text-foreground-secondary">{it.label}</span>
            <span className="text-sm text-foreground-primary">{it.text}</span>
          </div>
        );
      })}
    </div>
  );
}

export function MetaStripComponent({ data }: { data: MetaStripData }) {
  const rows = data.rows ?? [];
  const items: MetaItem[] = rows.map((r) => ({ iconKey: r[0] ?? '', label: r[1] ?? '', text: r[2] ?? '' }));
  return <MetaInline items={items} />;
}
```

- [ ] **Step 4: 跑测试，确认重构后仍通过**

Run: `pnpm --filter @mediakit/web test tests/editor.meta-strip`
Expected: PASS（行为不变）。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/editor/components/ReportComponents.tsx apps/web/tests/editor.meta-strip.test.tsx
git commit -m "refactor(web): MetaStripComponent 抽出 MetaInline 子组件 + 测试基线"
```

---

### Task 3: `divider` 变体（竖线分隔·纯文本）

**Files:**
- Modify: `apps/web/src/editor/components/ReportComponents.tsx`（dispatcher + 新增 `MetaDivider`）
- Test: `apps/web/tests/editor.meta-strip.test.tsx`（追加用例）

- [ ] **Step 1: 在测试文件 `describe` 块内追加失败测试**

在 `apps/web/tests/editor.meta-strip.test.tsx` 的 `describe('MetaStripComponent variants', ...)` 内追加：

```tsx
  it('divider renders text without capsule background', () => {
    const { container } = render(<MetaStripComponent data={dataFor('divider')} />);
    expect(screen.getByText('BASE')).toBeInTheDocument();
    expect(screen.getByText('Beauty')).toBeInTheDocument();
    // divider 无胶囊灰底
    expect(container.querySelector('[class*="bg-surface-secondary"]')).toBeNull();
  });
```

- [ ] **Step 2: 跑测试，确认失败（dispatcher 还无 divider 分支 → 走 inline → 有灰底 → 断言失败）**

Run: `pnpm --filter @mediakit/web test tests/editor.meta-strip`
Expected: FAIL（divider 用例失败：期望无 `bg-surface-secondary`，实际 inline 渲染了胶囊）。

- [ ] **Step 3: dispatcher 引入 `variant` 并加 divider 分支 + 新增 `MetaDivider` 子组件**

把 Task 2 写入的 dispatcher：

```tsx
export function MetaStripComponent({ data }: { data: MetaStripData }) {
  const rows = data.rows ?? [];
  const items: MetaItem[] = rows.map((r) => ({ iconKey: r[0] ?? '', label: r[1] ?? '', text: r[2] ?? '' }));
  return <MetaInline items={items} />;
}
```

替换为：

```tsx
export function MetaStripComponent({ data }: { data: MetaStripData }) {
  const { variant = 'inline', rows = [] } = data;
  const items: MetaItem[] = rows.map((r) => ({ iconKey: r[0] ?? '', label: r[1] ?? '', text: r[2] ?? '' }));
  if (variant === 'divider') return <MetaDivider items={items} />;
  return <MetaInline items={items} />;
}
```

并在 `MetaInline` 函数之后、`MetaStripComponent` 之前，插入 `MetaDivider`：

```tsx
function MetaDivider({ items }: { items: MetaItem[] }) {
  return (
    <div className="flex h-full w-full flex-wrap items-center">
      {items.map((it, i) => {
        const Icon = findIcon(it.iconKey)?.Comp;
        return (
          <div
            key={i}
            className={`flex items-center gap-1.5 ${i === 0 ? 'pl-0' : 'border-l border-border-subtle pl-2'}`}
          >
            {Icon && <Icon size={13} className="text-foreground-secondary" />}
            <span className="text-[11px] uppercase tracking-wide text-foreground-muted">{it.label}</span>
            <span className="text-sm text-foreground-primary">{it.text}</span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: 跑测试，确认通过**

Run: `pnpm --filter @mediakit/web test tests/editor.meta-strip`
Expected: PASS（2 个用例：default inline + divider）。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/editor/components/ReportComponents.tsx apps/web/tests/editor.meta-strip.test.tsx
git commit -m "feat(web): meta-strip 新增 divider 变体（竖线分隔纯文本）"
```

---

### Task 4: `list` 变体（键值对竖排·带分隔线）

**Files:**
- Modify: `apps/web/src/editor/components/ReportComponents.tsx`（dispatcher + 新增 `MetaList`）
- Test: `apps/web/tests/editor.meta-strip.test.tsx`（追加用例）

- [ ] **Step 1: 在 `describe` 块内追加失败测试**

```tsx
  it('list renders vertical rows', () => {
    const { container } = render(<MetaStripComponent data={dataFor('list')} />);
    expect(screen.getByText('BASE')).toBeInTheDocument();
    expect(screen.getByText('The United States')).toBeInTheDocument();
    // list 容器纵向排列
    expect(container.querySelector('[class*="flex-col"]')).toBeTruthy();
  });
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `pnpm --filter @mediakit/web test tests/editor.meta-strip`
Expected: FAIL（list 用例失败：当前 list 走 inline，无 `flex-col` 容器）。

- [ ] **Step 3: dispatcher 加 list 分支 + 新增 `MetaList`**

把 dispatcher 中的：

```tsx
  if (variant === 'divider') return <MetaDivider items={items} />;
  return <MetaInline items={items} />;
```

替换为：

```tsx
  if (variant === 'divider') return <MetaDivider items={items} />;
  if (variant === 'list') return <MetaList items={items} />;
  return <MetaInline items={items} />;
```

并在 `MetaDivider` 之后插入 `MetaList`：

```tsx
function MetaList({ items }: { items: MetaItem[] }) {
  return (
    <div className="flex h-full w-full flex-col divide-y divide-border-subtle">
      {items.map((it, i) => {
        const Icon = findIcon(it.iconKey)?.Comp;
        return (
          <div key={i} className="flex items-baseline justify-between gap-3 py-1.5">
            <span className="flex items-center gap-1.5">
              {Icon && <Icon size={13} className="text-foreground-secondary" />}
              <span className="text-[11px] uppercase tracking-wide text-foreground-secondary">{it.label}</span>
            </span>
            <span className="text-right text-sm text-foreground-primary">{it.text}</span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: 跑测试，确认通过**

Run: `pnpm --filter @mediakit/web test tests/editor.meta-strip`
Expected: PASS（3 个用例）。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/editor/components/ReportComponents.tsx apps/web/tests/editor.meta-strip.test.tsx
git commit -m "feat(web): meta-strip 新增 list 变体（键值对竖排）"
```

---

### Task 5: `cards` 变体（图标+标签+文本 网格）

**Files:**
- Modify: `apps/web/src/editor/components/ReportComponents.tsx`（dispatcher + 新增 `MetaCards`）
- Test: `apps/web/tests/editor.meta-strip.test.tsx`（追加用例）

- [ ] **Step 1: 在 `describe` 块内追加失败测试**

```tsx
  it('cards renders a grid of cards', () => {
    const { container } = render(<MetaStripComponent data={dataFor('cards')} />);
    expect(screen.getByText('BASE')).toBeInTheDocument();
    expect(screen.getByText('Beauty')).toBeInTheDocument();
    // cards 容器是 grid
    expect(container.querySelector('[class*="grid"]')).toBeTruthy();
  });
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `pnpm --filter @mediakit/web test tests/editor.meta-strip`
Expected: FAIL（cards 用例失败：当前 cards 走 inline，无 `grid` 容器）。

- [ ] **Step 3: dispatcher 加 cards 分支 + 新增 `MetaCards`**

把 dispatcher 中的：

```tsx
  if (variant === 'list') return <MetaList items={items} />;
  return <MetaInline items={items} />;
```

替换为：

```tsx
  if (variant === 'list') return <MetaList items={items} />;
  if (variant === 'cards') return <MetaCards items={items} />;
  return <MetaInline items={items} />;
```

并在 `MetaList` 之后插入 `MetaCards`：

```tsx
function MetaCards({ items }: { items: MetaItem[] }) {
  return (
    <div className="grid h-full w-full grid-cols-3 content-start gap-2 overflow-auto">
      {items.map((it, i) => {
        const Icon = findIcon(it.iconKey)?.Comp;
        return (
          <div key={i} className="flex flex-col gap-1 rounded-lg border border-border-subtle bg-surface-primary p-2">
            <span className="flex items-center gap-1.5">
              {Icon && <Icon size={14} className="text-foreground-secondary" />}
              <span className="text-[11px] uppercase tracking-wide text-foreground-secondary">{it.label}</span>
            </span>
            <span className="text-sm text-foreground-primary">{it.text}</span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: 跑测试，确认通过**

Run: `pnpm --filter @mediakit/web test tests/editor.meta-strip`
Expected: PASS（4 个用例）。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/editor/components/ReportComponents.tsx apps/web/tests/editor.meta-strip.test.tsx
git commit -m "feat(web): meta-strip 新增 cards 变体（图标+标签+文本网格）"
```

---

### Task 6: `stat` 变体（label 小标签 + text 大字号）

**Files:**
- Modify: `apps/web/src/editor/components/ReportComponents.tsx`（dispatcher + 新增 `MetaStat`）
- Test: `apps/web/tests/editor.meta-strip.test.tsx`（追加用例）

- [ ] **Step 1: 在 `describe` 块内追加失败测试**

```tsx
  it('stat renders large data text', () => {
    const { container } = render(<MetaStripComponent data={dataFor('stat')} />);
    expect(screen.getByText('The United States')).toBeInTheDocument();
    expect(screen.getByText('BASE')).toBeInTheDocument();
    // stat 的 text 用大号数据字体
    expect(container.querySelector('[class*="font-data"]')).toBeTruthy();
  });
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `pnpm --filter @mediakit/web test tests/editor.meta-strip`
Expected: FAIL（stat 用例失败：当前 stat 走 inline，无 `font-data`）。

- [ ] **Step 3: dispatcher 加 stat 分支 + 新增 `MetaStat`**

把 dispatcher 中的：

```tsx
  if (variant === 'cards') return <MetaCards items={items} />;
  return <MetaInline items={items} />;
```

替换为：

```tsx
  if (variant === 'cards') return <MetaCards items={items} />;
  if (variant === 'stat') return <MetaStat items={items} />;
  return <MetaInline items={items} />;
```

并在 `MetaCards` 之后插入 `MetaStat`：

```tsx
function MetaStat({ items }: { items: MetaItem[] }) {
  return (
    <div className="flex h-full w-full flex-wrap items-end gap-x-6 gap-y-2">
      {items.map((it, i) => {
        const Icon = findIcon(it.iconKey)?.Comp;
        return (
          <div key={i} className="flex flex-col">
            <span className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-foreground-secondary">
              {Icon && <Icon size={13} className="text-foreground-secondary" />}
              {it.label}
            </span>
            <span className="font-data text-xl font-bold text-foreground-primary">{it.text}</span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: 跑测试，确认通过**

Run: `pnpm --filter @mediakit/web test tests/editor.meta-strip`
Expected: PASS（5 个用例：inline 默认 + divider + list + cards + stat）。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/editor/components/ReportComponents.tsx apps/web/tests/editor.meta-strip.test.tsx
git commit -m "feat(web): meta-strip 新增 stat 变体（大字号强调数值）"
```

---

### Task 7: registry 注册 variants + defaults 默认值

**Files:**
- Modify: `apps/web/src/editor/registry.tsx:308-313`（`'meta-strip'` 注册）
- Modify: `apps/web/src/editor/defaults.ts:186-194`（`getDefaultData('meta-strip')`）
- Test: `apps/web/tests/editor.meta-strip.test.tsx`（追加 registry 用例）

- [ ] **Step 1: 在测试文件追加 registry 用例（先在顶部补 import，再加 describe）**

在 `apps/web/tests/editor.meta-strip.test.tsx` 顶部 import 区追加：

```tsx
import { REGISTRY } from '@/editor/registry';
```

在文件末尾追加：

```tsx
describe('meta-strip registry', () => {
  it('declares 5 variants in order', () => {
    const ids = REGISTRY['meta-strip'].variants?.map((v) => v.id);
    expect(ids).toEqual(['inline', 'divider', 'list', 'cards', 'stat']);
  });
});
```

- [ ] **Step 2: 跑测试，确认失败（registry 还没声明 variants）**

Run: `pnpm --filter @mediakit/web test tests/editor.meta-strip`
Expected: FAIL（registry 用例失败：`variants` 为 undefined）。

- [ ] **Step 3: registry 的 `'meta-strip'` 加 `variants`**

把 `apps/web/src/editor/registry.tsx` 中（308-313 行）现有的：

```tsx
  'meta-strip': {
    Component: MetaStripComponent,
    defaultSize: DEFAULT_SIZES['meta-strip'],
    defaultData: () => getDefaultData('meta-strip'),
    propertySchema: [{ key: '', label: '信息项', kind: 'table' }],
  },
```

替换为：

```tsx
  'meta-strip': {
    Component: MetaStripComponent,
    defaultSize: DEFAULT_SIZES['meta-strip'],
    defaultData: () => getDefaultData('meta-strip'),
    variants: [
      { id: 'inline', label: '横排胶囊' },
      { id: 'divider', label: '竖线分隔' },
      { id: 'list', label: '键值列表' },
      { id: 'cards', label: '卡片网格' },
      { id: 'stat', label: '强调数值' },
    ],
    propertySchema: [{ key: '', label: '信息项', kind: 'table' }],
  },
```

- [ ] **Step 4: defaults 的 `meta-strip` 默认数据加 `variant: 'inline'`**

把 `apps/web/src/editor/defaults.ts` 中（186-194 行）现有的：

```ts
    case 'meta-strip':
      return {
        headers: ['图标', '标签', '文本'],
        rows: [
          ['target', 'BASE', 'The United States'],
          ['tag', 'TYPE', 'Beauty'],
          ['trophy', 'TIER', 'A'],
        ],
      };
```

替换为：

```ts
    case 'meta-strip':
      return {
        variant: 'inline',
        headers: ['图标', '标签', '文本'],
        rows: [
          ['target', 'BASE', 'The United States'],
          ['tag', 'TYPE', 'Beauty'],
          ['trophy', 'TIER', 'A'],
        ],
      };
```

- [ ] **Step 5: 跑测试，确认通过**

Run: `pnpm --filter @mediakit/web test tests/editor.meta-strip`
Expected: PASS（6 个用例：5 渲染 + 1 registry）。

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/editor/registry.tsx apps/web/src/editor/defaults.ts apps/web/tests/editor.meta-strip.test.tsx
git commit -m "feat(web): meta-strip 注册 5 个 variant + 默认 variant:inline"
```

---

### Task 8: 全量验证

**Files:** 无（仅验证）

- [ ] **Step 1: 全量 typecheck**

Run: `pnpm --filter @mediakit/web typecheck`
Expected: PASS，无报错。

- [ ] **Step 2: 全量 web 测试**

Run: `pnpm --filter @mediakit/web test`
Expected: PASS，所有测试通过（含新增 6 个 meta-strip 用例，且未破坏现有测试）。

- [ ] **Step 3: 构建（确保产线构建无碍）**

Run: `pnpm --filter @mediakit/web build`
Expected: PASS（`tsc -b && vite build` 成功）。

> 全部通过即完成。属性面板的 chip 选择器由现有 `VariantSelector`（`PropertyPanel.tsx:269`）在声明 `variants` 后自动渲染，无需额外改动；可手动启动 `pnpm --filter @mediakit/web dev` 在编辑器里拖入「基础信息」组件、切换 5 个 chip 验证视觉效果。

---

## Self-Review 结果

**1. Spec 覆盖:**
- §3 数据模型（MetaStripVariant + variant 字段）→ Task 1 ✓
- §4.1 inline → Task 2 ✓
- §4.2 divider → Task 3 ✓
- §4.3 list → Task 4 ✓
- §4.4 cards → Task 5 ✓
- §4.5 stat → Task 6 ✓
- §5 接线（registry variants / defaults / ReportComponents 分支）→ Task 2-7 ✓；`PropertyPanel` 无需改（声明 variants 后 VariantSelector 自动生效）✓
- §6 向后兼容（variant 缺省 → inline）→ Task 2 dispatcher + Task 3 引入 `variant = 'inline'` 缺省 ✓
- §7 测试（5 变体渲染 + 老数据等价 inline）→ Task 2-7 ✓（default 用例即老数据等价 inline）

**2. 占位符扫描:** 无 TBD/TODO；每个代码 step 含完整代码，命令含预期输出。

**3. 类型一致性:** `MetaItem`（Task 2 定义）在 Task 3-6 一致使用；`MetaStripVariant`（Task 1）在 defaults（Task 7）、测试（Task 2/7）一致；dispatcher 分支 id（divider/list/cards/stat）与 registry variants id（Task 7）、测试 variant 入参一一对应。✓
