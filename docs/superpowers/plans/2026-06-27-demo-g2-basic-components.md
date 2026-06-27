# demo.html 还原 · G2 基础组件补齐 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `apps/web/src/editor` 引入组件注册表，把画布编辑器从 text/image 两种扩到 demo.html 的 7 个基础组件（+ 指标卡 / 柱状图 / 折线图 / 饼图 / 表格），每个含默认数据、渲染、属性面板编辑、工具栏添加。

**Architecture:** `blocks/<type>.tsx` 每个导出 `{ label, defaultData, Block, propertySchema }`；`blocks/index.ts` 汇成 `REGISTRY`。`ComponentView`/`store.addComponent`/`Toolbar`/`PropertyPanel` 全部改为注册表驱动。图表用 recharts。

**Tech Stack:** React 18 · TypeScript · Zustand · TailwindCSS · **recharts** · vitest · @testing-library/react。

**对应 spec：** `docs/superpowers/specs/2026-06-27-demo-g2-basic-components-design.md`。**demo.html 参考**：`getDefaultData` `:2091`｜renderComponent `:1538`。

---

## 前置条件

- 编辑器 MVP 已交付（`apps/web/src/editor/*`：store/Canvas/ComponentView/PropertyPanel/Toolbar）。
- **建议在独立分支执行**（`git checkout -b demo-g2`），不在 `main` 写代码。

## File Structure

| 路径 | 类型 | 职责 |
|---|---|---|
| `packages/shared/src/index.ts` | 修改 | 加 `BasicComponentType` + 5 个新 Data 接口；`EditorComponent.type/data` 放宽 |
| `apps/web/package.json` | 修改 | 加 `recharts` 依赖 |
| `apps/web/src/editor/blocks/types.ts` | 新建 | `BlockDef` / `PropertyField` 注册表类型 |
| `apps/web/src/editor/blocks/{text,image,indicator-card,bar-chart,line-chart,pie-chart,table}.tsx` | 新建/迁移 | 每类型 `BlockDef`（label/defaultData/Block/propertySchema） |
| `apps/web/src/editor/blocks/index.ts` | 新建 | `REGISTRY` |
| `apps/web/src/editor/ComponentView.tsx` | 修改 | 按 `REGISTRY[type].Block` 渲染（含未知类型兜底） |
| `apps/web/src/editor/store.ts` | 修改 | `addComponent(type)` 用 `REGISTRY[type].defaultData()`；`type` 参数放宽 |
| `apps/web/src/editor/Toolbar.tsx` | 修改 | 遍历 `REGISTRY` 生成添加按钮 |
| `apps/web/src/editor/PropertyPanel.tsx` | 修改 | 按 `REGISTRY[type].propertySchema` 通用渲染（标量 + list + table） |
| `apps/web/tests/editor/{registry,blocks,propertyPanel-g2}.test.tsx` | 新建 | 测试 |

---

## Task 1: shared 类型 + recharts 依赖 + blocks 类型骨架

**Files:**
- Modify: `packages/shared/src/index.ts`、`apps/web/package.json`
- Create: `apps/web/src/editor/blocks/types.ts`
- Create: `apps/web/tests/editor/registry.test.ts`（实际在 Task 2 Step 1 创建并启用，断言 7 个类型的 def 完整性；Task 2 阶段 5 个未实现类型走 fallback 也能通过）

- [ ] **Step 1: 扩 `packages/shared/src/index.ts`**

把现有 `EditorComponent` 的类型放宽并追加新 Data 接口。把当前的：

```ts
export interface EditorComponent {
  id: string
  type: 'text' | 'image'
  x: number
  y: number
  w: number
  h: number
  data: TextData | ImageData
}
```

改为：

```ts
export type BasicComponentType =
  | 'text'
  | 'image'
  | 'indicator-card'
  | 'bar-chart'
  | 'line-chart'
  | 'pie-chart'
  | 'table'

export interface IndicatorCardData {
  title: string
  value: string
  trend: string
  trendUp: boolean
  colorTheme: 'blue' | 'green' | 'orange' | 'purple'
}

export interface BarChartDatum {
  label: string
  value: number
  color: string
}
export interface BarChartData {
  title: string
  bars: BarChartDatum[]
}

export interface LineChartPoint {
  label: string
  value: number
}
export interface LineChartData {
  title: string
  points: LineChartPoint[]
}

export interface PieChartSlice {
  label: string
  value: number
  color: string
}
export interface PieChartData {
  title: string
  slices: PieChartSlice[]
}

export interface TableData {
  headers: string[]
  rows: string[][]
}

export interface EditorComponent {
  id: string
  type: BasicComponentType
  x: number
  y: number
  w: number
  h: number
  data:
    | TextData
    | ImageData
    | IndicatorCardData
    | BarChartData
    | LineChartData
    | PieChartData
    | TableData
}
```

- [ ] **Step 2: 加 recharts 依赖**

运行：`pnpm --filter @ppt-generator/web add recharts`
预期：安装成功，`apps/web/package.json` 出现 `recharts`。

- [ ] **Step 3: 创建 `apps/web/src/editor/blocks/types.ts`**

```ts
import type { FC } from 'react'

export interface PropertyField {
  key: string
  label: string
  kind: 'text' | 'textarea' | 'number' | 'color' | 'select' | 'list' | 'table'
  options?: string[]
  itemFields?: { key: string; label: string; kind: 'text' | 'number' | 'color' }[]
}

export interface BlockDef {
  label: string
  defaultSize: { w: number; h: number }
  defaultData: () => unknown
  Block: FC<{ data: unknown }>
  propertySchema: PropertyField[]
}
```

> **spec 微调说明**：spec §3 的 `BlockDef` 没有 `defaultSize`。但 `store.addComponent` 需要按类型给出几何尺寸（图表比文本大），把 `defaultSize: {w,h}` 与 `defaultData` 一起放在 `BlockDef` 里最内聚（避免尺寸散落到 store）。这是对 spec 的最小增量，不改变消费者契约。新组件落位 `x/y` 仍由 store 给统一默认值。

- [ ] **Step 4: typecheck 确认编译**

运行：`pnpm --filter @ppt-generator/web typecheck`
预期：可能因为 `EditorComponent.type` 放宽导致 store/ComponentView 的 `'text'|'image'` 处报错——记下，**Task 2 会修复**。**允许此步出现与 type 放宽相关的报错**；若报 `recharts` 找不到则 Step 2 未成功，重装。

> Task 1 暂不提交，与 Task 2（注册表骨架）一起提交。

---

## Task 2: 注册表骨架 + text/image 迁移 + store/ComponentView 注册表驱动

**目标**：建立 `REGISTRY`（7 个 key，text/image 为真实 def，其余 5 个先用 `fallback`），把 `store.addComponent` 与 `ComponentView` 改为注册表驱动，删除旧的 `TextBlock.tsx`/`ImageBlock.tsx`。此 task 含 Task 1 的全部改动，一起提交。现有 `store.test`/`canvas.test`/`propertyPanel.test` 必须保持绿。

**Files:**
- Create: `apps/web/src/editor/blocks/text.tsx`、`apps/web/src/editor/blocks/image.tsx`、`apps/web/src/editor/blocks/fallback.tsx`、`apps/web/src/editor/blocks/index.ts`
- Delete: `apps/web/src/editor/blocks/TextBlock.tsx`、`apps/web/src/editor/blocks/ImageBlock.tsx`
- Modify: `apps/web/src/editor/store.ts:16-38,50,83-90`、`apps/web/src/editor/ComponentView.tsx:1-7,65-83`
- Create: `apps/web/tests/editor/registry.test.ts`

- [ ] **Step 1: 写失败测试 `apps/web/tests/editor/registry.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { REGISTRY, fallbackBlock } from '../../src/editor/blocks'
import type { BasicComponentType } from '@ppt-generator/shared'

const TYPES: BasicComponentType[] = [
  'text', 'image', 'indicator-card', 'bar-chart', 'line-chart', 'pie-chart', 'table',
]

describe('component registry', () => {
  it.each(TYPES)('has a complete def for %s', (t) => {
    const def = REGISTRY[t]
    expect(def).toBeTruthy()
    expect(typeof def.label).toBe('string')
    expect(typeof def.defaultData).toBe('function')
    expect(typeof def.Block).toBe('function')
    expect(Array.isArray(def.propertySchema)).toBe(true)
    expect(def.defaultSize).toBeTruthy()
    expect(def.defaultSize.w).toBeGreaterThan(0)
    expect(def.defaultSize.h).toBeGreaterThan(0)
  })

  it('exposes a fallback def for unknown types', () => {
    expect(fallbackBlock.label).toBe('未知组件')
    expect(typeof fallbackBlock.Block).toBe('function')
  })

  it('text defaultData yields editable content', () => {
    const d = REGISTRY.text.defaultData() as { content: string }
    expect(typeof d.content).toBe('string')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @ppt-generator/web test registry`
Expected: FAIL（`Cannot find module '../../src/editor/blocks'`）

- [ ] **Step 3: 创建 `apps/web/src/editor/blocks/text.tsx`**

```tsx
import type { FC } from 'react'
import type { TextData } from '@ppt-generator/shared'
import type { BlockDef } from './types'

const TextBlock: FC<{ data: unknown }> = ({ data }) => {
  const d = data as TextData
  return (
    <div
      className="h-full w-full overflow-hidden whitespace-pre-wrap break-words"
      style={{
        fontSize: d.fontSize,
        fontWeight: d.fontWeight ?? 400,
        color: d.color ?? '#222',
        background: d.bgColor ?? 'transparent',
        padding: 4,
      }}
    >
      {d.content || '双击编辑文本'}
    </div>
  )
}

export const textBlock: BlockDef = {
  label: '文本',
  defaultSize: { w: 240, h: 60 },
  defaultData: () => ({ content: '双击编辑文本', fontSize: 18, color: '#222', bgColor: '#fff' }),
  Block: TextBlock,
  propertySchema: [
    { key: 'content', label: '文本', kind: 'textarea' },
    { key: 'fontSize', label: '字号', kind: 'number' },
    { key: 'color', label: '颜色', kind: 'color' },
  ],
}
```

> `defaultSize.w = 240` 必须保留：`store.test` 的 resize 断言依赖 `240 + 100 = 340`。`defaultData` 沿用旧 `store.defaultText()` 的字段值，行为不变。

- [ ] **Step 4: 创建 `apps/web/src/editor/blocks/image.tsx`**

```tsx
import { useState, type FC } from 'react'
import type { ImageData } from '@ppt-generator/shared'
import type { BlockDef } from './types'

const ImageBlock: FC<{ data: unknown }> = ({ data }) => {
  const d = data as ImageData
  const [broken, setBroken] = useState(false)
  if (!d.src || broken) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-neutral-200 text-xs text-neutral-500">
        图片
      </div>
    )
  }
  return <img src={d.src} alt="" className="h-full w-full object-contain" onError={() => setBroken(true)} />
}

export const imageBlock: BlockDef = {
  label: '图片',
  defaultSize: { w: 240, h: 160 },
  defaultData: () => ({ src: '' }),
  Block: ImageBlock,
  propertySchema: [{ key: 'src', label: '图片 URL', kind: 'text' }],
}
```

- [ ] **Step 5: 创建 `apps/web/src/editor/blocks/fallback.tsx`**

未知类型兜底（spec §7）。也作为 Task 2 注册表中尚未实现的 5 个类型的占位 def。

```tsx
import type { FC } from 'react'
import type { BlockDef } from './types'

const FallbackBlock: FC = () => (
  <div className="flex h-full w-full items-center justify-center rounded border border-dashed border-neutral-300 bg-neutral-100 text-xs text-neutral-400">
    未知组件
  </div>
)

export const fallbackBlock: BlockDef = {
  label: '未知组件',
  defaultSize: { w: 200, h: 120 },
  defaultData: () => ({}),
  Block: FallbackBlock,
  propertySchema: [],
}
```

- [ ] **Step 6: 创建 `apps/web/src/editor/blocks/index.ts`**

`index.ts` 不含 JSX（兜底的 JSX 留在 `fallback.tsx`），与 File Structure 表一致。

```ts
import type { BasicComponentType } from '@ppt-generator/shared'
import type { BlockDef } from './types'
import { textBlock } from './text'
import { imageBlock } from './image'
import { indicatorCardBlock } from './indicator-card'
import { barChartBlock } from './bar-chart'
import { lineChartBlock } from './line-chart'
import { pieChartBlock } from './pie-chart'
import { tableBlock } from './table'
import { fallbackBlock } from './fallback'

export { fallbackBlock }

export const REGISTRY: Record<BasicComponentType, BlockDef> = {
  text: textBlock,
  image: imageBlock,
  'indicator-card': indicatorCardBlock,
  'bar-chart': barChartBlock,
  'line-chart': lineChartBlock,
  'pie-chart': pieChartBlock,
  table: tableBlock,
}

export function getBlock(type: string): BlockDef {
  return (REGISTRY as Record<string, BlockDef>)[type] ?? fallbackBlock
}
```

> Task 2 阶段 `indicator-card/bar-chart/line-chart/pie-chart/table` 文件尚不存在——这一步会编译失败。Step 7 先用临时桩文件让编译通过，Task 3-5 再替换为真实实现。

- [ ] **Step 7: 为未实现的 5 个类型创建临时桩文件**

每个文件导出 `fallbackBlock` 的别名，使 `index.ts` 编译通过且 `registry.test`（断言 7 个 key 有完整 def）绿：

`apps/web/src/editor/blocks/indicator-card.tsx`、`bar-chart.tsx`、`line-chart.tsx`、`pie-chart.tsx`、`table.tsx` 各写入：

```tsx
import { fallbackBlock } from './fallback'
// 临时桩：Task 3-5 替换为真实 def
export const indicatorCardBlock = fallbackBlock
```

> 五个文件分别把导出名改为对应：`indicatorCardBlock` / `barChartBlock` / `lineChartBlock` / `pieChartBlock` / `tableBlock`。其余内容完全相同（都 re-export `fallbackBlock`）。

- [ ] **Step 8: 改 `apps/web/src/editor/store.ts` 为注册表驱动**

删除 `defaultText()`（`:16-26`）与 `defaultImage()`（`:28-38`）两个函数，新增 `import { REGISTRY, fallbackBlock } from './blocks'` 与 `BasicComponentType` 类型；把 `addComponent` 改为：

```ts
  addComponent: (type) =>
    set((s) => {
      const def = (REGISTRY as Record<string, typeof fallbackBlock>)[type] ?? fallbackBlock
      const comp: EditorComponent = {
        id: newId(),
        type,
        x: 140,
        y: 140,
        w: def.defaultSize.w,
        h: def.defaultSize.h,
        data: def.defaultData(),
      }
      const pages = s.pages.map((p) =>
        p.id === s.currentPageId ? { ...p, components: [...p.components, comp] } : p,
      )
      return { pages, selectedIds: [comp.id] }
    }),
```

接口签名（`:50`）放宽为 `addComponent: (type: BasicComponentType) => void`。`import` 顶部追加 `BasicComponentType`。

- [ ] **Step 9: 改 `apps/web/src/editor/ComponentView.tsx` 为注册表驱动**

替换 import（`:6-7`）：

```tsx
import { getBlock } from './blocks'
```

在组件内 `return` 之前加 `const Block = getBlock(comp.type).Block`，并把渲染行（`:71`）替换为：

```tsx
      <Block data={comp.data} />
```

（删除 `comp.type === 'text' ? <TextBlock ...> : <ImageBlock ...>` 整行。）

- [ ] **Step 10: 删除旧文件**

```bash
rm apps/web/src/editor/blocks/TextBlock.tsx apps/web/src/editor/blocks/ImageBlock.tsx
```

- [ ] **Step 11: 运行测试确认通过**

Run: `pnpm --filter @ppt-generator/web test`
Expected: PASS —— `registry`、`store`、`canvas`、`propertyPanel`、`interaction`、`editor`、`autosave` 全绿。

- [ ] **Step 12: typecheck**

Run: `pnpm --filter @ppt-generator/web typecheck`
Expected: PASS（无报错）。

- [ ] **Step 13: 提交（含 Task 1）**

```bash
git add packages/shared/src/index.ts apps/web/package.json pnpm-lock.yaml \
  apps/web/src/editor/blocks/ apps/web/src/editor/store.ts apps/web/src/editor/ComponentView.tsx \
  apps/web/tests/editor/registry.test.ts
git commit -m "feat(web): component registry + registry-driven store/ComponentView (G2)"
```

---

## Task 3: 指标卡（indicator-card）

**Files:**
- Modify: `apps/web/src/editor/blocks/indicator-card.tsx`（桩 → 真实）
- Create: `apps/web/tests/editor/blocks.test.tsx`

- [ ] **Step 1: 写失败测试 `apps/web/tests/editor/blocks.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import { REGISTRY } from '../../src/editor/blocks'

// recharts 在 jsdom 无布局，图表 task 再加图表用例；此处提前 mock 以免引入图表时漏配。
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>()
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) =>
      React.cloneElement(children, { width: 320, height: 200 }),
  }
})

function renderBlock(type: keyof typeof REGISTRY, data?: unknown) {
  const def = REGISTRY[type]
  return render(React.createElement(def.Block, { data: data ?? def.defaultData() }))
}

describe('indicator-card block', () => {
  it('renders title and value from default data', () => {
    const { getByText } = renderBlock('indicator-card')
    expect(getByText('指标名称')).toBeInTheDocument()
    expect(getByText('---')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @ppt-generator/web test blocks`
Expected: FAIL（桩 def 渲染「未知组件」，找不到「指标名称」）

- [ ] **Step 3: 实现真实 `apps/web/src/editor/blocks/indicator-card.tsx`**

```tsx
import type { FC } from 'react'
import type { IndicatorCardData } from '@ppt-generator/shared'
import type { BlockDef } from './types'

const THEME: Record<IndicatorCardData['colorTheme'], string> = {
  blue: '#3B82F6',
  green: '#22C55E',
  orange: '#FF5C00',
  purple: '#8B5CF6',
}

const IndicatorCard: FC<{ data: unknown }> = ({ data }) => {
  const d = data as IndicatorCardData
  const accent = THEME[d.colorTheme ?? 'blue'] ?? THEME.blue
  return (
    <div
      className="flex h-full w-full flex-col gap-0.5 rounded-lg border border-neutral-200 bg-white p-3"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div className="text-[10px] font-medium text-neutral-400">{d.title || '指标'}</div>
      <div className="font-mono text-lg font-semibold text-neutral-800">{d.value || '---'}</div>
      {d.trend ? (
        <div className="text-[10px] font-semibold" style={{ color: d.trendUp ? '#16a34a' : '#dc2626' }}>
          <span>{d.trendUp ? '↑' : '↓'}</span> {d.trend}
        </div>
      ) : null}
    </div>
  )
}

export const indicatorCardBlock: BlockDef = {
  label: '指标卡',
  defaultSize: { w: 200, h: 110 },
  defaultData: () => ({ title: '指标名称', value: '---', trend: '', trendUp: false, colorTheme: 'blue' }),
  Block: IndicatorCard,
  propertySchema: [
    { key: 'title', label: '标题', kind: 'text' },
    { key: 'value', label: '数值', kind: 'text' },
    { key: 'trend', label: '趋势', kind: 'text' },
    { key: 'trendUp', label: '趋势方向', kind: 'select', options: ['↑', '↓'] },
    { key: 'colorTheme', label: '配色', kind: 'select', options: ['blue', 'green', 'orange', 'purple'] },
  ],
}
```

> `trendUp` 为 boolean：select 的「↑」=true、「↓」=false，由 Task 7 的通用 select 渲染按当前值是否布尔做映射。

- [ ] **Step 4: 运行确认通过**

Run: `pnpm --filter @ppt-generator/web test blocks`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/blocks/indicator-card.tsx apps/web/tests/editor/blocks.test.tsx
git commit -m "feat(web): indicator-card block (G2)"
```

---

## Task 4: 表格（table）

**Files:**
- Modify: `apps/web/src/editor/blocks/table.tsx`（桩 → 真实）
- Modify: `apps/web/tests/editor/blocks.test.tsx`（追加用例）

- [ ] **Step 1: 追加失败测试**

在 `apps/web/tests/editor/blocks.test.tsx` 末尾追加：

```tsx
describe('table block', () => {
  it('renders one <th> per header', () => {
    const { container } = renderBlock('table')
    expect(container.querySelectorAll('th')).toHaveLength(3)
  })

  it('renders a <td> per cell across all rows', () => {
    const { container } = renderBlock('table')
    // 默认 2 行 × 3 列
    expect(container.querySelectorAll('td')).toHaveLength(6)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @ppt-generator/web test blocks`
Expected: FAIL（桩不渲染 `<th>`）

- [ ] **Step 3: 实现真实 `apps/web/src/editor/blocks/table.tsx`**

```tsx
import type { FC } from 'react'
import type { TableData } from '@ppt-generator/shared'
import type { BlockDef } from './types'

const TableBlock: FC<{ data: unknown }> = ({ data }) => {
  const d = data as TableData
  const headers = d.headers ?? []
  const rows = d.rows ?? []
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <table className="h-full w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-neutral-50">
            {headers.map((h, i) => (
              <th
                key={i}
                className={`border-b border-neutral-200 px-3 py-2 font-semibold text-neutral-500 ${i === 0 ? 'text-left' : 'text-right'}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 1 ? 'bg-neutral-50' : ''}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`border-b border-neutral-100 px-3 py-2 ${ci === 0 ? 'text-left font-medium' : 'text-right font-mono'}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const tableBlock: BlockDef = {
  label: '表格',
  defaultSize: { w: 420, h: 200 },
  defaultData: () => ({ headers: ['列1', '列2', '列3'], rows: [['--', '--', '--'], ['--', '--', '--']] }),
  Block: TableBlock,
  propertySchema: [{ key: 'table', label: '表格', kind: 'table' }],
}
```

> headers/rows 长度不一致时各自渲染（spec §7），不强制对齐。

- [ ] **Step 4: 运行确认通过**

Run: `pnpm --filter @ppt-generator/web test blocks`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/blocks/table.tsx apps/web/tests/editor/blocks.test.tsx
git commit -m "feat(web): table block (G2)"
```

---

## Task 5: 图表（bar / line / pie，recharts）

**Files:**
- Modify: `apps/web/src/editor/blocks/bar-chart.tsx`、`line-chart.tsx`、`pie-chart.tsx`（桩 → 真实）
- Modify: `apps/web/tests/setup.ts`（加 `ResizeObserver` 桩）
- Modify: `apps/web/tests/editor/blocks.test.tsx`（追加图表用例）

- [ ] **Step 1: 给 `apps/web/tests/setup.ts` 加 `ResizeObserver` 桩**

把整个文件改为：

```ts
import { vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub)
```

- [ ] **Step 2: 追加失败测试（bar/line/pie）**

在 `apps/web/tests/editor/blocks.test.tsx` 末尾追加：

```tsx
describe('bar-chart block', () => {
  it('renders a recharts chart with default data', () => {
    const { container, getByText } = renderBlock('bar-chart')
    expect(getByText('柱状图')).toBeInTheDocument()
    expect(container.querySelector('.recharts-wrapper')).toBeTruthy()
  })
  it('shows 无数据 when bars is empty', () => {
    const { getByText } = renderBlock('bar-chart', { title: '柱状图', bars: [] })
    expect(getByText('无数据')).toBeInTheDocument()
  })
})

describe('line-chart block', () => {
  it('renders a recharts chart with default data', () => {
    const { container } = renderBlock('line-chart')
    expect(container.querySelector('.recharts-wrapper')).toBeTruthy()
  })
})

describe('pie-chart block', () => {
  it('renders a recharts chart with default data', () => {
    const { container } = renderBlock('pie-chart')
    expect(container.querySelector('.recharts-wrapper')).toBeTruthy()
  })
})
```

- [ ] **Step 3: 运行确认失败**

Run: `pnpm --filter @ppt-generator/web test blocks`
Expected: FAIL（桩无 `.recharts-wrapper`）

- [ ] **Step 4: 实现 `apps/web/src/editor/blocks/bar-chart.tsx`**

```tsx
import type { FC } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts'
import type { BarChartData } from '@ppt-generator/shared'
import type { BlockDef } from './types'

const BarChartBlock: FC<{ data: unknown }> = ({ data }) => {
  const d = data as BarChartData
  const bars = d.bars ?? []
  return (
    <div className="flex h-full w-full flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3">
      <div className="text-[13px] font-semibold text-neutral-800">{d.title || '柱状图'}</div>
      {bars.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-xs text-neutral-400">无数据</div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {bars.map((b, i) => (
                <Cell key={i} fill={b.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export const barChartBlock: BlockDef = {
  label: '柱状图',
  defaultSize: { w: 360, h: 240 },
  defaultData: () => ({
    title: '柱状图',
    bars: [
      { label: 'A', value: 80, color: '#FF5C00' },
      { label: 'B', value: 60, color: '#3B82F6' },
      { label: 'C', value: 40, color: '#22C55E' },
    ],
  }),
  Block: BarChartBlock,
  propertySchema: [
    { key: 'title', label: '标题', kind: 'text' },
    {
      key: 'bars',
      label: '数据',
      kind: 'list',
      itemFields: [
        { key: 'label', label: '标签', kind: 'text' },
        { key: 'value', label: '数值', kind: 'number' },
        { key: 'color', label: '颜色', kind: 'color' },
      ],
    },
  ],
}
```

- [ ] **Step 5: 实现 `apps/web/src/editor/blocks/line-chart.tsx`**

```tsx
import type { FC } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts'
import type { LineChartData } from '@ppt-generator/shared'
import type { BlockDef } from './types'

const LineChartBlock: FC<{ data: unknown }> = ({ data }) => {
  const d = data as LineChartData
  const points = d.points ?? []
  return (
    <div className="flex h-full w-full flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3">
      <div className="text-[13px] font-semibold text-neutral-800">{d.title || '折线图'}</div>
      {points.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-xs text-neutral-400">无数据</div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Line type="monotone" dataKey="value" stroke="#FF5C00" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export const lineChartBlock: BlockDef = {
  label: '折线图',
  defaultSize: { w: 360, h: 240 },
  defaultData: () => ({
    title: '折线图',
    points: [
      { label: 'Q1', value: 30 },
      { label: 'Q2', value: 55 },
      { label: 'Q3', value: 42 },
      { label: 'Q4', value: 70 },
    ],
  }),
  Block: LineChartBlock,
  propertySchema: [
    { key: 'title', label: '标题', kind: 'text' },
    {
      key: 'points',
      label: '数据',
      kind: 'list',
      itemFields: [
        { key: 'label', label: '标签', kind: 'text' },
        { key: 'value', label: '数值', kind: 'number' },
      ],
    },
  ],
}
```

- [ ] **Step 6: 实现 `apps/web/src/editor/blocks/pie-chart.tsx`**

```tsx
import type { FC } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import type { PieChartData } from '@ppt-generator/shared'
import type { BlockDef } from './types'

const PieChartBlock: FC<{ data: unknown }> = ({ data }) => {
  const d = data as PieChartData
  const slices = d.slices ?? []
  return (
    <div className="flex h-full w-full flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3">
      <div className="text-[13px] font-semibold text-neutral-800">{d.title || '饼图'}</div>
      {slices.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-xs text-neutral-400">无数据</div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius="70%" label>
              {slices.map((s, i) => (
                <Cell key={i} fill={s.color} />
              ))}
            </Pie>
            <Legend wrapperStyle={{ fontSize: 10 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export const pieChartBlock: BlockDef = {
  label: '饼图',
  defaultSize: { w: 320, h: 240 },
  defaultData: () => ({
    title: '饼图',
    slices: [
      { label: 'A', value: 40, color: '#FF5C00' },
      { label: 'B', value: 35, color: '#3B82F6' },
      { label: 'C', value: 25, color: '#22C55E' },
    ],
  }),
  Block: PieChartBlock,
  propertySchema: [
    { key: 'title', label: '标题', kind: 'text' },
    {
      key: 'slices',
      label: '数据',
      kind: 'list',
      itemFields: [
        { key: 'label', label: '标签', kind: 'text' },
        { key: 'value', label: '数值', kind: 'number' },
        { key: 'color', label: '颜色', kind: 'color' },
      ],
    },
  ],
}
```

- [ ] **Step 7: 运行确认通过**

Run: `pnpm --filter @ppt-generator/web test blocks`
Expected: PASS（bar/line/pie 均渲染 `.recharts-wrapper`，空数据显示「无数据」）

- [ ] **Step 8: typecheck**

Run: `pnpm --filter @ppt-generator/web typecheck`
Expected: PASS

- [ ] **Step 9: 提交**

```bash
git add apps/web/src/editor/blocks/bar-chart.tsx apps/web/src/editor/blocks/line-chart.tsx \
  apps/web/src/editor/blocks/pie-chart.tsx apps/web/tests/setup.ts apps/web/tests/editor/blocks.test.tsx
git commit -m "feat(web): bar/line/pie chart blocks via recharts (G2)"
```

---

## Task 6: Toolbar 注册表驱动

**Files:**
- Modify: `apps/web/src/editor/Toolbar.tsx:1-25`
- Create: `apps/web/tests/editor/toolbar.test.tsx`

- [ ] **Step 1: 写失败测试 `apps/web/tests/editor/toolbar.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useEditorStore } from '../../src/editor/store'
import { Toolbar } from '../../src/editor/Toolbar'
import { REGISTRY } from '../../src/editor/blocks'

describe('Toolbar', () => {
  beforeEach(() => {
    useEditorStore.setState({
      projectId: 'p', canvasWidth: 1280, canvasHeight: 720, zoom: 1,
      pages: [{ id: 'pg', name: '封面', components: [] }],
      currentPageId: 'pg', selectedIds: [], saveStatus: 'idle',
    })
  })

  it('renders one add button per registry entry', () => {
    render(<MemoryRouter><Toolbar /></MemoryRouter>)
    for (const def of Object.values(REGISTRY)) {
      expect(screen.getByText(`+ ${def.label}`)).toBeInTheDocument()
    }
  })

  it('adds a bar-chart component on click', () => {
    render(<MemoryRouter><Toolbar /></MemoryRouter>)
    fireEvent.click(screen.getByText('+ 柱状图'))
    const c = useEditorStore.getState().pages[0].components[0]
    expect(c.type).toBe('bar-chart')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @ppt-generator/web test toolbar`
Expected: FAIL（旧 Toolbar 只有「+ 文本」「+ 图片」，无「+ 柱状图」）

- [ ] **Step 3: 改 `apps/web/src/editor/Toolbar.tsx` 为注册表驱动**

```tsx
import { useNavigate } from 'react-router-dom'
import { useEditorStore } from './store'
import { Button } from '../components/Button'
import { REGISTRY } from './blocks'
import type { BasicComponentType } from '@ppt-generator/shared'

export function Toolbar() {
  const navigate = useNavigate()
  const addComponent = useEditorStore((s) => s.addComponent)
  const saveStatus = useEditorStore((s) => s.saveStatus)
  const label = saveStatus === 'saving' ? '保存中…' : saveStatus === 'error' ? '保存失败' : saveStatus === 'saved' ? '已保存' : ''
  return (
    <header className="flex items-center justify-between border-b border-edge bg-surface px-4 py-2">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => navigate('/projects')}>← 返回</Button>
        <span className="text-lg font-extrabold text-primary">MediaKit</span>
      </div>
      <div className="flex items-center gap-2">
        {(Object.entries(REGISTRY) as [BasicComponentType, (typeof REGISTRY)[BasicComponentType]][]).map(
          ([type, def]) => (
            <Button key={type} variant="ghost" onClick={() => addComponent(type)}>
              + {def.label}
            </Button>
          ),
        )}
        <Button variant="ghost" disabled>撤销</Button>
        <Button variant="ghost" disabled>重做</Button>
        <span className="w-20 text-xs text-neutral-500">{label}</span>
      </div>
    </header>
  )
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm --filter @ppt-generator/web test toolbar`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/Toolbar.tsx apps/web/tests/editor/toolbar.test.tsx
git commit -m "feat(web): toolbar enumerates add buttons from registry (G2)"
```

---

## Task 7: PropertyPanel schema 驱动

**目标**：把按 `comp.type` 特判的属性编辑改为按 `REGISTRY[type].propertySchema` 通用渲染（text/textarea/number/color/select/list/table）。现有 `propertyPanel.test` 必须保持绿（文本「文本」textarea、删除「删除组件」、占位「未选中组件」）。

**Files:**
- Modify: `apps/web/src/editor/PropertyPanel.tsx`（整体重写）
- Create: `apps/web/tests/editor/propertyPanel-g2.test.tsx`

- [ ] **Step 1: 写失败测试 `apps/web/tests/editor/propertyPanel-g2.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useEditorStore } from '../../src/editor/store'
import { PropertyPanel } from '../../src/editor/PropertyPanel'
import { REGISTRY } from '../../src/editor/blocks'
import type { BasicComponentType, EditorComponent } from '@ppt-generator/shared'

function renderPanelWith(type: BasicComponentType) {
  const comp: EditorComponent = {
    id: 'c1', type, x: 0, y: 0, w: 200, h: 120,
    data: REGISTRY[type].defaultData() as never,
  }
  useEditorStore.setState({
    projectId: 'p', canvasWidth: 1280, canvasHeight: 720, zoom: 1,
    pages: [{ id: 'pg', name: '封面', components: [comp] }],
    currentPageId: 'pg', selectedIds: ['c1'], saveStatus: 'idle',
  })
  return render(<MemoryRouter><PropertyPanel /></MemoryRouter>)
}

describe('PropertyPanel (G2 schema-driven)', () => {
  it('edits indicator-card value', () => {
    renderPanelWith('indicator-card')
    fireEvent.change(screen.getByLabelText('数值'), { target: { value: '12.6M' } })
    expect((useEditorStore.getState().pages[0].components[0].data as { value: string }).value).toBe('12.6M')
  })

  it('adds a bar to the bar-chart list', () => {
    renderPanelWith('bar-chart')
    const before = (useEditorStore.getState().pages[0].components[0].data as { bars: unknown[] }).bars.length
    fireEvent.click(screen.getByText('+ 添加'))
    const after = (useEditorStore.getState().pages[0].components[0].data as { bars: unknown[] }).bars.length
    expect(after).toBe(before + 1)
  })

  it('adds a column to the table', () => {
    renderPanelWith('table')
    const before = (useEditorStore.getState().pages[0].components[0].data as { headers: string[] }).headers.length
    fireEvent.click(screen.getByText('+ 列'))
    const after = (useEditorStore.getState().pages[0].components[0].data as { headers: string[] }).headers.length
    expect(after).toBe(before + 1)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @ppt-generator/web test propertyPanel-g2`
Expected: FAIL（旧 PropertyPanel 对 indicator-card 无「数值」字段）

- [ ] **Step 3: 重写 `apps/web/src/editor/PropertyPanel.tsx`**

```tsx
import type { PropertyField } from './blocks/types'
import { useEditorStore } from './store'
import { Input } from '../components/Input'
import { REGISTRY, fallbackBlock } from './blocks'

export function PropertyPanel() {
  const page = useEditorStore((s) => s.pages.find((p) => p.id === s.currentPageId))
  const selectedId = useEditorStore((s) => s.selectedIds[0])
  const comp = page?.components.find((c) => c.id === selectedId)
  const update = useEditorStore((s) => s.updateComponent)
  const remove = useEditorStore((s) => s.removeComponent)
  if (!comp) return <div className="w-64 border-l border-edge bg-surface p-4 text-sm text-neutral-400">未选中组件</div>

  const def = REGISTRY[comp.type] ?? fallbackBlock
  const setData = (key: string, value: unknown) => update(comp.id, { data: { [key]: value } as never })

  return (
    <div className="w-64 shrink-0 space-y-3 border-l border-edge bg-surface p-4">
      <div className="text-xs font-bold text-primary">属性</div>
      {def.propertySchema.map((field) => (
        <FieldEditor key={field.key} field={field} data={comp.data} onChange={setData} />
      ))}
      <div className="grid grid-cols-2 gap-2">
        <Input label="X" type="number" value={comp.x} onChange={(e) => update(comp.id, { x: Number(e.target.value) })} />
        <Input label="Y" type="number" value={comp.y} onChange={(e) => update(comp.id, { y: Number(e.target.value) })} />
        <Input label="宽" type="number" value={comp.w} onChange={(e) => update(comp.id, { w: Number(e.target.value) })} />
        <Input label="高" type="number" value={comp.h} onChange={(e) => update(comp.id, { h: Number(e.target.value) })} />
      </div>
      <button className="rounded bg-red-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-red-700" onClick={() => remove(comp.id)}>删除组件</button>
    </div>
  )
}

type DataMap = Record<string, unknown>

function FieldEditor({
  field,
  data,
  onChange,
}: {
  field: PropertyField
  data: unknown
  onChange: (key: string, value: unknown) => void
}) {
  const d = (data as DataMap) ?? {}
  switch (field.kind) {
    case 'textarea':
      return (
        <label className="block">
          <span className="mb-1 block text-xs text-neutral-500">{field.label}</span>
          <textarea
            className="w-full rounded border border-neutral-300 p-2 text-sm"
            rows={3}
            value={(d[field.key] as string) ?? ''}
            onChange={(e) => onChange(field.key, e.target.value)}
          />
        </label>
      )
    case 'number':
      return (
        <Input
          label={field.label}
          type="number"
          value={(d[field.key] as number) ?? 0}
          onChange={(e) => onChange(field.key, Number(e.target.value))}
        />
      )
    case 'color':
      return (
        <Input
          label={field.label}
          type="color"
          value={(d[field.key] as string) ?? '#000000'}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      )
    case 'select': {
      const options = field.options ?? []
      const val = d[field.key]
      const isBool = typeof val === 'boolean'
      const current = isBool ? (val ? options[0] : options[1]) : String(val ?? '')
      return (
        <label className="block">
          <span className="mb-1 block text-xs text-neutral-500">{field.label}</span>
          <select
            className="w-full rounded border border-neutral-300 bg-white px-2 py-2 text-sm"
            value={current}
            onChange={(e) => onChange(field.key, isBool ? e.target.value === options[0] : e.target.value)}
          >
            {options.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </label>
      )
    }
    case 'list':
      return <ListEditor field={field} data={d} onChange={onChange} />
    case 'table':
      return <TableEditor data={d} onChange={onChange} />
    case 'text':
    default:
      return (
        <Input
          label={field.label}
          value={(d[field.key] as string) ?? ''}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      )
  }
}

function ListEditor({
  field,
  data,
  onChange,
}: {
  field: PropertyField
  data: DataMap
  onChange: (key: string, value: unknown) => void
}) {
  const items = (Array.isArray(data[field.key]) ? data[field.key] : []) as DataMap[]
  const itemFields = field.itemFields ?? []
  const setItem = (i: number, key: string, value: unknown) =>
    onChange(field.key, items.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)))
  const addItem = () => {
    const blank: DataMap = {}
    itemFields.forEach((f) => {
      blank[f.key] = f.kind === 'number' ? 0 : f.kind === 'color' ? '#FF5C00' : ''
    })
    onChange(field.key, [...items, blank])
  }
  const removeItem = (i: number) => onChange(field.key, items.filter((_, idx) => idx !== i))
  return (
    <div className="space-y-2">
      <div className="text-xs text-neutral-500">{field.label}</div>
      {items.map((it, i) => (
        <div key={i} className="space-y-1 rounded border border-neutral-200 p-2">
          {itemFields.map((f) => (
            <FieldEditor key={f.key} field={f as PropertyField} data={it} onChange={(k, v) => setItem(i, k, v)} />
          ))}
          <button className="text-xs text-red-600" onClick={() => removeItem(i)}>删除</button>
        </div>
      ))}
      <button className="text-xs font-bold text-primary" onClick={addItem}>+ 添加</button>
    </div>
  )
}

function TableEditor({ data, onChange }: { data: DataMap; onChange: (key: string, value: unknown) => void }) {
  const headers = (Array.isArray(data.headers) ? data.headers : []) as string[]
  const rows = (Array.isArray(data.rows) ? data.rows : []) as string[][]
  const setHeader = (i: number, v: string) => onChange('headers', headers.map((h, idx) => (idx === i ? v : h)))
  const addColumn = () => {
    onChange('headers', [...headers, '新列'])
    onChange('rows', rows.map((r) => [...r, '']))
  }
  const removeColumn = (i: number) => {
    onChange('headers', headers.filter((_, idx) => idx !== i))
    onChange('rows', rows.map((r) => r.filter((_, idx) => idx !== i)))
  }
  const setCell = (ri: number, ci: number, v: string) =>
    onChange('rows', rows.map((r, idx) => (idx === ri ? r.map((c, j) => (j === ci ? v : c)) : r)))
  const addRow = () => onChange('rows', [...rows, headers.map(() => '')])
  const removeRow = (ri: number) => onChange('rows', rows.filter((_, idx) => idx !== ri))
  return (
    <div className="space-y-2">
      <div className="text-xs text-neutral-500">表格</div>
      <div className="flex flex-wrap items-center gap-1">
        {headers.map((h, i) => (
          <input key={i} className="w-16 rounded border border-neutral-300 px-1 py-1 text-xs" value={h} onChange={(e) => setHeader(i, e.target.value)} />
        ))}
        <button className="text-xs text-primary" onClick={addColumn}>+ 列</button>
        {headers.length > 0 && <button className="text-xs text-red-600" onClick={() => removeColumn(headers.length - 1)}>删列</button>}
      </div>
      {rows.map((row, ri) => (
        <div key={ri} className="flex flex-wrap items-center gap-1">
          {row.map((cell, ci) => (
            <input key={ci} className="w-16 rounded border border-neutral-300 px-1 py-1 text-xs" value={cell} onChange={(e) => setCell(ri, ci, e.target.value)} />
          ))}
          <button className="text-xs text-red-600" onClick={() => removeRow(ri)}>删除行</button>
        </div>
      ))}
      <button className="text-xs font-bold text-primary" onClick={addRow}>+ 行</button>
    </div>
  )
}
```

> text 内容字段 schema 为 `{ key:'content', label:'文本', kind:'textarea' }`——`getByLabelText('文本')` 仍命中（与旧测试一致）。

- [ ] **Step 4: 运行确认通过（新 + 旧）**

Run: `pnpm --filter @ppt-generator/web test propertyPanel`
Expected: PASS（`propertyPanel.test` 旧用例 + `propertyPanel-g2.test` 新用例全绿）

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/PropertyPanel.tsx apps/web/tests/editor/propertyPanel-g2.test.tsx
git commit -m "feat(web): schema-driven property panel (G2)"
```

---

## Task 8: 全量验证 + 文档

- [ ] **Step 1: 全量 typecheck**

Run: `pnpm --filter @ppt-generator/web typecheck`
Expected: PASS

- [ ] **Step 2: 全量测试**

Run: `pnpm --filter @ppt-generator/web test`
Expected: 全绿（新增 registry/blocks/toolbar/propertyPanel-g2 + 原有全部）

- [ ] **Step 3: 构建**

Run: `pnpm --filter @ppt-generator/web build`
Expected: PASS（`tsc --noEmit` + `vite build` 通过）

- [ ] **Step 4: 更新 `docs/PROJECT.md`「当前状态」「后续计划」**

「当前状态」追加一行：G2 基础组件补齐完成（7 类组件 + 注册表，recharts 图表）。
「后续计划」把 G2 标记为已完成，剩余顺序 G4→G1→G3→G5→G6。

- [ ] **Step 5: 追加 `docs/CHANGELOG.md`（当日 `## 2026-06-27`，`### 新增`）**

- 引入组件注册表 `REGISTRY`，画布编辑器从 text/image 扩到 7 类基础组件（指标卡/柱状/折线/饼图/表格）`apps/web/src/editor/blocks/index.ts`
- 新增 5 个组件块（含 recharts 真图表 + 空数据占位）`apps/web/src/editor/blocks/{indicator-card,bar-chart,line-chart,pie-chart,table}.tsx`
- store/ComponentView/Toolbar/PropertyPanel 改为注册表/schema 驱动 `apps/web/src/editor/{store,ComponentView,Toolbar,PropertyPanel}.tsx`
- shared 类型放宽 + 5 个 Data 接口 `packages/shared/src/index.ts`
- 测试新增 registry/blocks/toolbar/propertyPanel-g2 `apps/web/tests/editor/`

- [ ] **Step 6: 提交文档**

```bash
git add docs/PROJECT.md docs/CHANGELOG.md
git commit -m "docs: G2 basic components restore — changelog + PROJECT status"
```

---

## 自检（plan 写完后过一遍 spec）

- spec §2 数据模型 → Task 1 Step 1 ✓
- spec §3 注册表（`REGISTRY` + 4 消费方）→ Task 2（store/ComponentView）、Task 6（Toolbar）、Task 7（PropertyPanel）✓
- spec §4 渲染（7 类，图表 ResponsiveContainer + 空数据占位）→ Task 2/3/4/5 ✓
- spec §5 schema 驱动属性面板（含 list/table）→ Task 7 ✓
- spec §6 工具栏遍历注册表 → Task 6 ✓
- spec §7 错误处理（空数据「无数据」、headers/rows 各自长度、未知类型兜底）→ Task 2 `fallback` + Task 5 空数据 ✓
- spec §8 测试（注册表完整/各 Block 渲染/addComponent/PropertyPanel/Toolbar）→ Task 2/3/4/5/6/7 ✓
- 已知约束保活：text `w=240`（store resize）、`'文本'`/`'删除组件'`/`'未选中组件'`（propertyPanel.test）✓

