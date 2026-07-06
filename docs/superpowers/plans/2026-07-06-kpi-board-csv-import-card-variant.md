# kpi-board CSV 导入 + 卡片指标变体 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给业绩看板组件 `kpi-board` 加：CSV/Excel 直接导入、新增 `card` 卡片指标变体（图标可配）、每行数值主题色块、去掉现有 grid/row 的边框与内 padding。

**Architecture:** 数据 schema 最小侵入扩展（`headers/rows` 不动，新增可选 `icons?/valueColors?/iconWeight?`），导入复用已就绪的 `parseFile` + `setComponentData`，图标复用已就绪的 `catalog.ts`（`findIcon` 直接拿 phosphor `Comp`），新建一个通用 `IconPickerOverlay` + kpi-board 专属的 `KpiImportButton` / `KpiRowStyleField` 挂在 PropertyPanel。颜色走 `KpiColorToken` 枚举（5 色）集中映射，跟随设计 token。

**Tech Stack:** React 18 · TypeScript · Tailwind · Zustand · vitest + @testing-library · `@phosphor-icons/react` · `xlsx`(parseFile)

**关联 spec:** [`docs/superpowers/specs/2026-07-06-kpi-board-csv-import-card-variant-design.md`](../specs/2026-07-06-kpi-board-csv-import-card-variant-design.md)

---

## 文件结构总览

| 文件 | 责任 | 动作 |
|---|---|---|
| `packages/shared/src/index.ts` | 类型契约：`KpiBoardVariant`+`card`、`KpiColorToken`、`KpiBoardData` 新字段 | Modify (667-672) |
| `apps/web/src/editor/kpiTokens.ts` | 色板映射 `KPI_COLOR_TOKENS` + 选项 `KPI_COLOR_OPTIONS` + `resolveKpiColor` | Create |
| `apps/web/src/editor/components/ReportComponents.tsx` | `KpiBoard` 渲染：新增 `card` 分支；grid/row 去边框；valueColors 着色 | Modify (25-79) |
| `apps/web/src/editor/registry.tsx` | `'kpi-board'` variants 加 `card` | Modify (262-272) |
| `apps/web/src/editor/defaults.ts` | `DEFAULT_SIZES['kpi-board']` 加高；kpi-board 默认补 `icons/valueColors` 示例 | Modify (21, 164-176) |
| `apps/web/src/editor/components/IconPickerOverlay.tsx` | 通用图标选择器（分类 + 搜索） | Create |
| `apps/web/src/editor/PropertyPanel.tsx` | 新增 `KpiImportButton` + `KpiRowStyleField`；按 comp.type 挂载 | Modify |
| `apps/web/tests/editor.kpi-board.test.tsx` | KpiBoard 渲染 + 导入 + 每行样式 集成测试 | Create |
| `apps/web/tests/kpi-tokens.test.ts` | 色板纯函数测试 | Create |

**不动：** `apps/server/*`、`datasource/parse.ts`、`store.ts`、其他业务组件、`VariantSelector`/`TableField` 现有逻辑。

---

## Task 1: shared 类型扩展

**Files:**
- Modify: `packages/shared/src/index.ts:667-672`

- [ ] **Step 1: 扩展类型定义**

把 `packages/shared/src/index.ts:667-672` 当前的：

```ts
export type KpiBoardVariant = 'grid' | 'row' | 'compact';
export interface KpiBoardData {
  variant: KpiBoardVariant;
  headers: string[];
  rows: string[][];
}
```

改为：

```ts
export type KpiBoardVariant = 'grid' | 'row' | 'compact' | 'card';
export type KpiColorToken = 'primary' | 'success' | 'warning' | 'danger' | 'info';

export interface KpiBoardData {
  variant: KpiBoardVariant;
  headers: string[];
  rows: string[][];
  /** 每行图标 catalog key（按 rows 索引对齐）；null/缺省=不显示。仅 card 变体消费。 */
  icons?: (string | null)[];
  /** 每行数值主题色 token（按 rows 索引对齐）；缺省/null=默认前景。 */
  valueColors?: (KpiColorToken | null)[];
  /** 图标 weight，缺省 'regular'。 */
  iconWeight?: IconWeight;
}
```

> `IconWeight` 已在本文件第 444 行定义，直接引用，无需 import。

- [ ] **Step 2: typecheck 验证**

Run: `pnpm typecheck`
Expected: 全部通过（shared type-only，下游 web/server 类型同步刷新无报错）。

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): kpi-board 加 card 变体/图标/数值主题色类型"
```

---

## Task 2: 色板映射（kpiTokens.ts）

**Files:**
- Create: `apps/web/src/editor/kpiTokens.ts`
- Test: `apps/web/tests/kpi-tokens.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `apps/web/tests/kpi-tokens.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { KPI_COLOR_TOKENS, KPI_COLOR_OPTIONS, resolveKpiColor } from '@/editor/kpiTokens';

describe('kpiTokens', () => {
  it('5 个 token 各有 fg 与 softBg', () => {
    for (const token of ['primary', 'success', 'warning', 'danger', 'info'] as const) {
      const c = KPI_COLOR_TOKENS[token];
      expect(typeof c.fg).toBe('string');
      expect(c.fg.length).toBeGreaterThan(0);
      expect(c.softBg).toMatch(/^#/);
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
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm --filter @mediakit/web test -- kpi-tokens`
Expected: FAIL — `Cannot find module '@/editor/kpiTokens'`。

- [ ] **Step 3: 实现 kpiTokens.ts**

创建 `apps/web/src/editor/kpiTokens.ts`：

```ts
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
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm --filter @mediakit/web test -- kpi-tokens`
Expected: PASS（3 个用例全过）。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/editor/kpiTokens.ts apps/web/tests/kpi-tokens.test.ts
git commit -m "feat(web): kpi-board 色板映射 KPI_COLOR_TOKENS"
```

---

## Task 3: KpiBoard `card` 变体渲染

**Files:**
- Modify: `apps/web/src/editor/components/ReportComponents.tsx:25-79`
- Test: `apps/web/tests/editor.kpi-board.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `apps/web/tests/editor.kpi-board.test.tsx`：

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KpiBoard } from '@/editor/components/ReportComponents';
import type { KpiBoardData } from '@mediakit/shared';

describe('KpiBoard · card 变体', () => {
  it('渲染 label/value/compare 与图标', () => {
    const data: KpiBoardData = {
      variant: 'card',
      headers: ['指标', '数值', '对比'],
      rows: [['Sales', '¥1.24M', '+15%']],
      icons: ['currency'],
      valueColors: ['success'],
    };
    const { container } = render(<KpiBoard data={data} />);
    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.getByText('¥1.24M')).toBeInTheDocument();
    expect(screen.getByText('+15%')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeTruthy(); // 图标渲染出 svg
  });

  it('无图标时不渲染图标块（无 svg）', () => {
    const { container } = render(
      <KpiBoard data={{ variant: 'card', headers: ['指标', '数值', '对比'], rows: [['Sales', '¥1.24M', '']] }} />,
    );
    expect(screen.getByText('¥1.24M')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('valueColors 非 primary 时给 value 上 inline 色', () => {
    const { container } = render(
      <KpiBoard data={{
        variant: 'card', headers: ['指标', '数值', '对比'],
        rows: [['A', '10', '']], valueColors: ['danger'],
      }} />,
    );
    const valueEl = container.querySelector('.font-data') as HTMLElement;
    expect(valueEl.style.color).toBe('rgb(239, 68, 68)'); // #EF4444
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm --filter @mediakit/web test -- editor.kpi-board`
Expected: FAIL — `card` 分支不存在（默认走 grid，渲染出的结构不匹配 / svg 断言失败）。

- [ ] **Step 3: 实现 card 分支**

在 `apps/web/src/editor/components/ReportComponents.tsx`：

**3a. 顶部加 import**（与现有 `import type { ... }` 同一段，第 9-15 行附近）：

```tsx
import { findIcon } from '../icons/catalog';
import { KPI_COLOR_TOKENS } from '../kpiTokens';
```

**3b. 在 `KpiBoard` 函数内，`row` 分支（第 59-69 行）之后、默认 `grid` return（第 72 行）之前，插入 `card` 分支**：

```tsx
  if (variant === 'card') {
    return (
      <div
        className="grid h-full w-full gap-3 overflow-auto p-1"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}
      >
        {items.map((it, i) => {
          const token = data.valueColors?.[i] ?? null;
          const isPrimary = !token || token === 'primary';
          const c = KPI_COLOR_TOKENS[token ?? 'primary'];
          const Icon = findIcon(data.icons?.[i] ?? undefined)?.Comp;
          const weight = data.iconWeight ?? 'regular';
          return (
            <div
              key={i}
              className="flex items-center justify-between rounded-2xl bg-surface-primary p-5 shadow-sm"
            >
              <div className="flex flex-col gap-1">
                <div className="text-xs text-foreground-secondary">{it.label}</div>
                <div
                  className="font-data text-2xl font-bold text-foreground-primary"
                  style={isPrimary ? undefined : { color: c.fg }}
                >
                  {it.value}
                </div>
                {it.compare && (
                  <div className="text-xs font-medium" style={{ color: compareColor(it.compare) }}>
                    {it.compare}
                  </div>
                )}
              </div>
              {Icon && (
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: c.softBg }}
                >
                  <Icon size={22} weight={weight} color={isPrimary ? undefined : c.fg} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm --filter @mediakit/web test -- editor.kpi-board`
Expected: PASS（3 个用例全过）。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/editor/components/ReportComponents.tsx apps/web/tests/editor.kpi-board.test.tsx
git commit -m "feat(web): kpi-board 新增 card 卡片指标变体"
```

---

## Task 4: grid/row 去边框 + valueColors 着色

**Files:**
- Modify: `apps/web/src/editor/components/ReportComponents.tsx:25-79`
- Test: `apps/web/tests/editor.kpi-board.test.tsx`

- [ ] **Step 1: 追加失败测试**

在 `apps/web/tests/editor.kpi-board.test.tsx` 末尾追加：

```tsx
describe('KpiBoard · grid/row 去边框', () => {
  it('grid 无 border class、无外层 padding', () => {
    const { container } = render(
      <KpiBoard data={{ variant: 'grid', headers: ['指标', '数值', '对比'], rows: [['A', '1', '']] }} />,
    );
    expect(container.querySelector('.border-border-default')).toBeNull();
    expect(container.querySelector('.border-border-subtle')).toBeNull();
    expect(container.querySelector('.bg-surface-primary')).toBeNull();
  });

  it('row 无 border class', () => {
    const { container } = render(
      <KpiBoard data={{ variant: 'row', headers: ['指标', '数值', '对比'], rows: [['A', '1', '']] }} />,
    );
    expect(container.querySelector('.border-border-default')).toBeNull();
    expect(container.querySelector('.border-border-subtle')).toBeNull();
  });

  it('grid valueColors 非 primary 上 inline 色', () => {
    const { container } = render(
      <KpiBoard data={{
        variant: 'grid', headers: ['指标', '数值', '对比'],
        rows: [['A', '1', '']], valueColors: ['info'],
      }} />,
    );
    const valueEl = container.querySelector('.font-data') as HTMLElement;
    expect(valueEl.style.color).toBe('rgb(59, 130, 246)'); // #3B82F6
  });

  it('compact 保持有外层 border（回归保护）', () => {
    const { container } = render(
      <KpiBoard data={{ variant: 'compact', headers: ['指标', '数值', '对比'], rows: [['A', '1', '']] }} />,
    );
    expect(container.querySelector('.border-border-default')).toBeTruthy();
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm --filter @mediakit/web test -- editor.kpi-board`
Expected: FAIL — grid/row 仍带 `border-border-default`。

- [ ] **Step 3: 改 grid/row/Card**

在 `apps/web/src/editor/components/ReportComponents.tsx` 的 `KpiBoard` 函数内：

**3a. items 映射加 color 解析**（替换第 27 行的 `const items = rows.map(...)`）：

```tsx
  const items = rows.map((r, i) => {
    const token = data.valueColors?.[i] ?? null;
    const color = token && token !== 'primary' ? KPI_COLOR_TOKENS[token].fg : undefined;
    return { label: r[0] ?? '', value: r[1] ?? '', compare: r[2] ?? '', color };
  });
```

**3b. Card 去边框/padding + 接收 color**（替换第 29-39 行的 `Card`）：

```tsx
  const Card = ({
    label, value, compare, color,
  }: { label: string; value: string; compare: string; color?: string }) => (
    <div className="flex flex-col justify-center">
      <div className="text-[11px] text-foreground-secondary">{label}</div>
      <div
        className="font-data text-xl font-bold text-foreground-primary"
        style={color ? { color } : undefined}
      >
        {value}
      </div>
      {compare && (
        <div className="text-[11px] font-medium" style={{ color: compareColor(compare) }}>
          {compare}
        </div>
      )}
    </div>
  );
```

**3c. grid 容器去 border/bg/padding**（替换第 72-78 行的默认 return）：

```tsx
  // grid（默认 3 列）
  return (
    <div className="grid h-full w-full grid-cols-3 gap-2 overflow-auto">
      {items.map((it, i) => (
        <Card key={i} {...it} />
      ))}
    </div>
  );
```

**3d. row 容器去 border/bg/padding**（替换第 59-69 行的 `row` 分支）：

```tsx
  if (variant === 'row') {
    return (
      <div className="flex h-full w-full items-stretch gap-2">
        {items.map((it, i) => (
          <div key={i} className="flex-1">
            <Card {...it} />
          </div>
        ))}
      </div>
    );
  }
```

> `compact` 分支（第 41-57 行）**不改**。

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm --filter @mediakit/web test -- editor.kpi-board`
Expected: PASS（全部用例，含新 4 条 + Task 3 的 3 条）。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/editor/components/ReportComponents.tsx apps/web/tests/editor.kpi-board.test.tsx
git commit -m "refactor(web): kpi-board grid/row 去边框 padding + 数值主题色"
```

---

## Task 5: registry 暴露 card 变体 + defaults 示例数据

**Files:**
- Modify: `apps/web/src/editor/registry.tsx:262-272`
- Modify: `apps/web/src/editor/defaults.ts:21, 164-176`
- Test: `apps/web/tests/editor.kpi-board.test.tsx`

- [ ] **Step 1: 追加失败测试**

在 `apps/web/tests/editor.kpi-board.test.tsx` 顶部加 import：

```tsx
import { REGISTRY } from '@/editor/registry';
import { getDefaultData } from '@/editor/defaults';
```

末尾追加：

```tsx
describe('kpi-board 注册与默认数据', () => {
  it('REGISTRY 暴露 4 个 variant（含 card）', () => {
    const def = REGISTRY['kpi-board'];
    const ids = def.variants?.map((v) => v.id);
    expect(ids).toEqual(['grid', 'row', 'compact', 'card']);
  });

  it('默认数据含 icons 与 valueColors 示例', () => {
    const data = getDefaultData('kpi-board') as KpiBoardData;
    expect(data.icons?.length).toBeGreaterThan(0);
    expect(data.valueColors?.length).toBeGreaterThan(0);
    expect(data.icons?.length).toBe(data.rows.length);
    expect(data.valueColors?.length).toBe(data.rows.length);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm --filter @mediakit/web test -- editor.kpi-board`
Expected: FAIL — variants 只有 3 个、默认数据无 icons/valueColors。

- [ ] **Step 3a: registry 加 card 变体**

`apps/web/src/editor/registry.tsx` 第 266-270 行的 `'kpi-board'` variants，追加 card：

```tsx
  variants: [
    { id: 'grid', label: '网格' },
    { id: 'row', label: '横排' },
    { id: 'compact', label: '紧凑' },
    { id: 'card', label: '卡片' },
  ],
```

- [ ] **Step 3b: defaults 调高 + 补示例**

`apps/web/src/editor/defaults.ts`：

第 21 行 defaultSize 加高：

```ts
  'kpi-board': { w: 900, h: 240 },
```

第 164-176 行 `case 'kpi-board'` 补 `icons/valueColors`（按 6 行 rows 对齐）：

```ts
    case 'kpi-board':
      return {
        variant: 'grid',
        headers: ['指标', '数值', '对比'],
        rows: [
          ['Sales', '¥1.24M', '+15%'],
          ['Commission', '¥98K', '+12%'],
          ['CVR', '3.8%', '+0.4%'],
          ['New Customer', '62%', '+5%'],
          ['Clicks', '120K', '-3%'],
          ['Orders', '8.4K', '+9%'],
        ],
        icons: ['currency', 'percent', 'percent', 'users', 'eye', 'cart'],
        valueColors: ['success', 'success', 'info', 'info', 'warning', 'success'],
      };
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm --filter @mediakit/web test -- editor.kpi-board`
Expected: PASS（含新 2 条）。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/editor/registry.tsx apps/web/src/editor/defaults.ts apps/web/tests/editor.kpi-board.test.tsx
git commit -m "feat(web): kpi-board registry 暴露 card 变体 + 默认示例数据"
```

---

## Task 6: IconPickerOverlay（通用图标选择器）

**Files:**
- Create: `apps/web/src/editor/components/IconPickerOverlay.tsx`
- Test: `apps/web/tests/editor.icon-picker.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `apps/web/tests/editor.icon-picker.test.tsx`：

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IconPickerOverlay } from '@/editor/components/IconPickerOverlay';

describe('IconPickerOverlay', () => {
  it('按分类渲染图标按钮', () => {
    render(<IconPickerOverlay onPick={() => {}} onClose={() => {}} />);
    // catalog 里 metric 分类含「上升趋势」
    expect(screen.getByText('上升趋势')).toBeInTheDocument();
    expect(screen.getByText('选择图标')).toBeInTheDocument();
  });

  it('点击图标触发 onPick 并关闭', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<IconPickerOverlay onPick={onPick} onClose={onClose} />);
    fireEvent.click(screen.getByText('金额'));
    expect(onPick).toHaveBeenCalledWith('currency');
    expect(onClose).toHaveBeenCalled();
  });

  it('搜索过滤图标', () => {
    render(<IconPickerOverlay onPick={() => {}} onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/搜索/), { target: { value: '粉丝' } });
    expect(screen.getByText('粉丝')).toBeInTheDocument();
    expect(screen.queryByText('上升趋势')).toBeNull();
  });

  it('current 图标高亮', () => {
    render(<IconPickerOverlay current="currency" onPick={() => {}} onClose={() => {}} />);
    const btn = screen.getByText('金额').closest('button');
    expect(btn?.className).toContain('border-accent-primary');
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm --filter @mediakit/web test -- editor.icon-picker`
Expected: FAIL — 模块不存在。

- [ ] **Step 3: 实现 IconPickerOverlay**

创建 `apps/web/src/editor/components/IconPickerOverlay.tsx`：

```tsx
import { useState } from 'react';
import { ICON_CATEGORIES, ICONS, type IconDef } from '../icons/catalog';

interface Props {
  /** 当前已选 icon key（高亮） */
  current?: string;
  onPick: (iconKey: string) => void;
  onClose: () => void;
}

export function IconPickerOverlay({ current, onPick, onClose }: Props) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const list = q
    ? ICONS.filter((i) => i.label.includes(query.trim()) || i.key.toLowerCase().includes(q))
    : ICONS;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[80vh] w-[480px] flex-col rounded-xl bg-surface-primary p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-3 font-headings text-sm font-semibold text-foreground-primary">选择图标</div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索图标..."
          className="mb-3 rounded border border-border-default px-2 py-1 text-sm"
        />
        <div className="-mr-2 flex-1 overflow-y-auto pr-2">
          {q ? (
            <div className="grid grid-cols-6 gap-2">
              {list.map((ic) => (
                <IconCell key={ic.key} ic={ic} current={current} onPick={onPick} onClose={onClose} />
              ))}
            </div>
          ) : (
            ICON_CATEGORIES.map((cat) => (
              <section key={cat.id} className="mb-3">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
                  {cat.label}
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {ICONS.filter((i) => i.category === cat.id).map((ic) => (
                    <IconCell key={ic.key} ic={ic} current={current} onPick={onPick} onClose={onClose} />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
        <div className="mt-3 flex justify-end border-t border-border-subtle pt-3">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-foreground-secondary hover:bg-surface-hover"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

function IconCell({
  ic, current, onPick, onClose,
}: { ic: IconDef; current?: string; onPick: (k: string) => void; onClose: () => void }) {
  return (
    <button
      onClick={() => { onPick(ic.key); onClose(); }}
      title={ic.label}
      className={`flex flex-col items-center gap-1 rounded-lg border p-2 ${
        current === ic.key
          ? 'border-accent-primary bg-accent-primary/10'
          : 'border-border-default hover:bg-surface-hover'
      }`}
    >
      <ic.Comp size={22} />
      <span className="text-[10px] text-foreground-secondary">{ic.label}</span>
    </button>
  );
}
```

> `IconDef` 已在 `catalog.ts` export；`IconCategory` 字段是其成员。

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm --filter @mediakit/web test -- editor.icon-picker`
Expected: PASS（4 条全过）。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/editor/components/IconPickerOverlay.tsx apps/web/tests/editor.icon-picker.test.tsx
git commit -m "feat(web): 新建通用 IconPickerOverlay 图标选择器"
```

---

## Task 7: KpiImportButton（CSV/Excel 导入）

**Files:**
- Modify: `apps/web/src/editor/PropertyPanel.tsx`
- Test: `apps/web/tests/editor.kpi-board.test.tsx`

- [ ] **Step 1: 追加失败测试**

在 `apps/web/tests/editor.kpi-board.test.tsx` 顶部加 import：

```tsx
import { vi, beforeEach } from 'vitest';
import { fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PropertyPanel } from '@/editor/PropertyPanel';
import { useEditorStore } from '@/editor/store';
import type { ProjectDetail } from '@mediakit/shared';

vi.mock('@/editor/datasource/parse', () => ({
  parseFile: vi.fn().mockResolvedValue([
    {
      name: 'sheet1',
      columns: ['指标', '数值', '对比'],
      rows: [{ '指标': 'GMV', '数值': '999', '对比': '+1%' }],
    },
  ]),
}));

const emptyProject: ProjectDetail = {
  id: 'p', name: 'p', width: 1280, height: 720,
  pages: [{ id: 'pg', name: '第 1 页', components: [] }],
  createdAt: '', updatedAt: '',
};
```

末尾追加：

```tsx
describe('KpiImportButton', () => {
  beforeEach(() => {
    useEditorStore.getState().loadProject(emptyProject, 'p');
  });

  it('导入 CSV 覆盖 headers/rows，保留 variant', async () => {
    const store = useEditorStore.getState();
    store.addComponent('kpi-board');
    const id = store.currentComponents()[0].id;
    store.select(id);

    render(
      <MemoryRouter>
        <PropertyPanel />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: '导入 Excel/CSV' }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 't.csv')] } });

    await waitFor(() => {
      const data = useEditorStore.getState().currentComponents()[0].data as KpiBoardData;
      expect(data.headers).toEqual(['指标', '数值', '对比']);
      expect(data.rows).toEqual([['GMV', '999', '+1%']]);
      expect(data.variant).toBe('grid'); // 保留
    });
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm --filter @mediakit/web test -- editor.kpi-board`
Expected: FAIL — 找不到「导入 Excel/CSV」按钮。

- [ ] **Step 3a: 实现 KpiImportButton 组件**

在 `apps/web/src/editor/PropertyPanel.tsx`，顶部 import 区补：

```tsx
import { useRef, useState } from 'react'; // 若已 import 则不重复
import { parseFile } from './datasource/parse';
```

在文件内（紧邻现有 `ChartImportButton` 函数，约第 818 行后）新增：

```tsx
/** kpi-board：导入 Excel/CSV → 首行表头、其余数据行，直接覆盖 headers/rows。 */
function KpiImportButton({ comp }: { comp: EditorComponent }) {
  const setComponentData = useEditorStore((s) => s.setComponentData);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    try {
      const sheets = await parseFile(file);
      const sheet = sheets[0];
      if (!sheet || sheet.columns.length === 0) {
        setError('文件为空或无表头');
        return;
      }
      const headers = sheet.columns;
      const rows = sheet.rows.map((r) => headers.map((h) => r[h] ?? ''));
      setComponentData(comp.id, { ...comp.data, headers, rows });
    } catch {
      setError('解析失败，请检查文件格式');
    }
  }

  return (
    <FieldGroup title="数据导入">
      <button
        onClick={() => fileRef.current?.click()}
        className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
      >
        导入 Excel/CSV
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          if (fileRef.current) fileRef.current.value = '';
        }}
      />
      {error && <div className="text-xs text-red-500">{error}</div>}
      <div className="text-[11px] text-foreground-muted">
        首行作为表头，其余作为数据行；仅覆盖表格内容。
      </div>
    </FieldGroup>
  );
}
```

- [ ] **Step 3b: 挂载到 PropertyPanel**

在 `PropertyPanel` 函数内，紧邻第 50-52 行 `ChartImportButton` 的条件渲染，追加一行：

```tsx
      {comp.type === 'kpi-board' && <KpiImportButton comp={comp} />}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm --filter @mediakit/web test -- editor.kpi-board`
Expected: PASS（含新导入用例）。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/editor/PropertyPanel.tsx apps/web/tests/editor.kpi-board.test.tsx
git commit -m "feat(web): kpi-board 支持 CSV/Excel 导入"
```

---

## Task 8: KpiRowStyleField（每行图标 + 色块）

**Files:**
- Modify: `apps/web/src/editor/PropertyPanel.tsx`
- Test: `apps/web/tests/editor.kpi-board.test.tsx`

- [ ] **Step 1: 追加失败测试**

在 `apps/web/tests/editor.kpi-board.test.tsx` 末尾追加：

```tsx
describe('KpiRowStyleField', () => {
  beforeEach(() => {
    useEditorStore.getState().loadProject(emptyProject, 'p');
  });

  it('按 rows 行数渲染每行样式编辑器', () => {
    const store = useEditorStore.getState();
    store.addComponent('kpi-board');
    const id = store.currentComponents()[0].id;
    store.select(id);
    render(
      <MemoryRouter>
        <PropertyPanel />
      </MemoryRouter>,
    );
    // 默认 6 行，第一行 label 是 'Sales'
    expect(screen.getByText('Sales')).toBeInTheDocument();
    // 每行 5 个色块，title='红' 每行一个 → 6 行共 6 个
    expect(screen.getAllByTitle('红').length).toBe(6);
  });

  it('点色块写入 valueColors[i]', () => {
    const store = useEditorStore.getState();
    store.addComponent('kpi-board');
    const id = store.currentComponents()[0].id;
    store.select(id);
    render(
      <MemoryRouter>
        <PropertyPanel />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getAllByTitle('红')[0]);
    const data = useEditorStore.getState().currentComponents()[0].data as KpiBoardData;
    expect(data.valueColors?.[0]).toBe('danger');
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm --filter @mediakit/web test -- editor.kpi-board`
Expected: FAIL — 找不到 `title="选图标"` 元素。

- [ ] **Step 3a: 实现 KpiRowStyleField**

在 `apps/web/src/editor/PropertyPanel.tsx` 顶部 import 区补：

```tsx
import { findIcon } from './icons/catalog';
import { KPI_COLOR_OPTIONS, KPI_COLOR_TOKENS } from './kpiTokens';
import { IconPickerOverlay } from './components/IconPickerOverlay';
import type { KpiBoardData, KpiColorToken } from '@mediakit/shared';
```

在 `KpiImportButton` 函数后新增：

```tsx
/** kpi-board：每行配图标 + 数值主题色（写 data.icons / data.valueColors）。 */
function KpiRowStyleField({ comp }: { comp: EditorComponent }) {
  const update = useDataUpdate(comp);
  const data = comp.data as KpiBoardData;
  const rows = data.rows ?? [];
  const icons = data.icons ?? [];
  const valueColors = data.valueColors ?? [];
  const [pickingRow, setPickingRow] = useState<number | null>(null);

  function ensureLen<T>(arr: T[]): T[] {
    const next = [...arr];
    while (next.length < rows.length) next.push(null as unknown as T);
    return next;
  }
  function setIcon(i: number, key: string | null) {
    update('icons', withAt(ensureLen(icons), i, key));
  }
  function setColor(i: number, token: KpiColorToken | null) {
    update('valueColors', withAt(ensureLen(valueColors), i, token));
  }

  return (
    <FieldGroup title="卡片样式（每行）">
      <div className="text-[11px] text-foreground-muted">图标仅在「卡片」变体下显示。</div>
      {rows.map((r, i) => {
        const iconKey = icons[i] ?? null;
        const Icon = findIcon(iconKey ?? undefined)?.Comp;
        const color = valueColors[i] ?? null;
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="w-20 truncate text-[11px] text-foreground-secondary">{r[0] ?? `行${i + 1}`}</span>
            <button
              onClick={() => setPickingRow(i)}
              title={iconKey ? (findIcon(iconKey)?.label ?? '选图标') : '选图标'}
              className="flex h-7 w-7 items-center justify-center rounded border border-border-default hover:bg-surface-hover"
            >
              {Icon ? <Icon size={16} /> : <span className="text-[10px] text-foreground-muted">+</span>}
            </button>
            {iconKey && (
              <button
                onClick={() => setIcon(i, null)}
                className="text-[10px] text-foreground-muted hover:text-foreground-primary"
              >
                清除
              </button>
            )}
            <div className="ml-auto flex gap-1">
              {KPI_COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.token}
                  title={opt.label}
                  onClick={() => setColor(i, color === opt.token ? null : opt.token)}
                  className={`h-4 w-4 rounded-full border ${
                    color === opt.token ? 'border-foreground-primary' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: KPI_COLOR_TOKENS[opt.token].fg }}
                />
              ))}
            </div>
          </div>
        );
      })}
      {pickingRow !== null && (
        <IconPickerOverlay
          current={icons[pickingRow] ?? undefined}
          onPick={(key) => setIcon(pickingRow, key)}
          onClose={() => setPickingRow(null)}
        />
      )}
    </FieldGroup>
  );
}

/** 不可变写入：返回新数组，index i 置为 v。 */
function withAt<T>(arr: T[], i: number, v: T): T[] {
  const next = [...arr];
  next[i] = v;
  return next;
}
```

- [ ] **Step 3b: 挂载到 PropertyPanel**

在 `PropertyPanel` 函数内「属性」FieldGroup 之后（约第 78 行，`BusinessFields` 挂载点附近）追加：

```tsx
      {comp.type === 'kpi-board' && <KpiRowStyleField comp={comp} />}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm --filter @mediakit/web test -- editor.kpi-board`
Expected: PASS（含新 2 条）。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/editor/PropertyPanel.tsx apps/web/tests/editor.kpi-board.test.tsx
git commit -m "feat(web): kpi-board 每行图标 + 数值主题色编辑器"
```

---

## Task 9: 全量门禁验证

**Files:** 无（仅验证）

- [ ] **Step 1: 全量 typecheck**

Run: `pnpm typecheck`
Expected: 两端 tsc --noEmit 通过，无报错。

- [ ] **Step 2: 全量 test**

Run: `pnpm test`
Expected: server + web 全部通过（新增的 kpi-tokens / editor.kpi-board / editor.icon-picker + 既有用例无回归）。

- [ ] **Step 3: 全量 build**

Run: `pnpm build`
Expected: web vite build 成功。

- [ ] **Step 4: 手动验证（dev）**

```
pnpm dev  →  http://localhost:5173  →  admin@mediakit.local / admin123
```

- 新建/选中一个 kpi-board 组件 → 属性面板「卡片样式（每行）」出现，每行可选图标 + 色。
- variant 切「卡片」→ 见参考图样式（左 label/value、右圆形图标），数值色块生效。
- variant 切「网格/横排」→ 无边框、扁平纯文字。
- 「导入 Excel/CSV」→ 选一个 csv → 表格内容被覆盖。
- 导入后 rows 变长 → 每行样式编辑器行数同步。

---

## 范围外（YAGNI，本计划不做）

- 多 sheet 选择弹框（kpi-board 取首个 sheet）。
- CSV 携带图标列 / 颜色列。
- `IconKit.tsx` 统一渲染入口（catalog 已带 Comp，kpi-board 直接 findIcon）。
- 图标 weight tabs（`iconWeight` 字段已留，默认 regular；picker 不含 weight 切换）。
- 其他业务组件（timeline-compare 等）的导入或图标。
- 服务端 / PDF 渲染适配（comp.data 形态兼容，自动受益）。
