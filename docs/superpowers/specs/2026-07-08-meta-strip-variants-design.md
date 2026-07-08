# 基础信息组件（meta-strip）样式变体设计

> 日期：2026-07-08
> 范围：为现有 `meta-strip`（组件面板标签「基础信息」）组件补齐 variant 系统，新增 4 种互补版式，加上作为默认的现有样式共 5 个变体。复用现有 `[图标, 标签, 文本]` 数据，不新增数据字段。

## 1. 背景与目标

`meta-strip` 定位是达人画像页 BASE/TYPE/TIER 这类**横排信息标签组**，数据复用 `TableData` 形态（约定列 `['图标', '标签', '文本']`，每行 `[iconKey?, label, text]`）。

当前**只有一种样式**：圆角灰底小胶囊，`flex-wrap` 横排，每项 `图标? + 大写label + 文本`（`apps/web/src/editor/components/ReportComponents.tsx:247`）。它是项目里少数还没有 variant 的组件——同类组件（`kpi-board` 4 变体、`creator-stats-strip` 3 变体、`brand-wall` 3 变体…）均已支持样式切换。

目标：补齐 variant，提供 5 个覆盖主流版式方向的变体，让用户按场景切换：横向轻量、纵向列表、卡片网格、强调数值。

## 2. 关键决策（已与用户确认）

1. **复用现有 variant 机制**：`registry` 声明 `variants` → 属性面板自动渲染 chip 选择器 → 写入 `data.variant` → 渲染层按 variant 分支。与项目其他组件完全一致，不引入新机制。
2. **变体规模：聚焦 5 个**（每个方向 1 个，含默认）：
   - `inline`（默认 = 现有横排胶囊，零视觉变化）
   - `divider`（竖线分隔纯文本，横向轻量）
   - `list`（键值对竖排，纵向列表）
   - `cards`（图标+标签+文本卡片网格，卡片网格）
   - `stat`（label 小标签 + text 大字号，强调数值）
3. **复用现有数据**：所有变体消费同一份 `items = rows.map(r => ({ iconKey, label, text }))`，不新增字段。图标在所有变体中可选（有 iconKey 才渲染）。
4. **`stat` 布局**：label 小标签在上 + text 大字号粗体在下（常规 KPI 布局）。

## 3. 数据模型（`packages/shared/src/index.ts`）

```ts
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

- `MetaStripData` 已在 `ComponentData` 联合中，加可选 `variant` 字段后联合自动生效，**无需改联合**。
- `ComponentType` 的 `'meta-strip'` id **不变** → 已保存项目不受影响（[[component-type-is-persisted-schema]]）。

## 4. 变体目录（渲染规格）

统一数据预处理：`items = rows.map(r => ({ iconKey: r[0] ?? '', label: r[1] ?? '', text: r[2] ?? '' }))`，`Icon = findIcon(iconKey)?.Comp`（有才渲染）。所有变体复用现有主题 token（`bg-surface-secondary` / `text-foreground-secondary` / `text-foreground-muted` / `border-border-subtle` / `bg-surface-primary`）。

### 4.1 `inline`（默认 = 现有，零改动）
- 容器：`flex h-full w-full flex-wrap items-center gap-2 overflow-auto`
- 每项：`flex items-center gap-1.5 rounded bg-surface-secondary px-2 py-1`
  - 图标 `<Icon size={14} className="text-foreground-secondary" />`
  - label `text-[11px] uppercase tracking-wide text-foreground-secondary`
  - text `text-sm text-foreground-primary`

### 4.2 `divider`（竖线分隔·纯文本无底色）
- 容器：`flex h-full w-full flex-wrap items-center`
- 每项：`flex items-center gap-1.5 px-2 first:pl-0`，非首项加左竖线（`[&:not(:first-child)]:border-l [&:not(:first-child)]:border-border-subtle [&:not(:first-child)]:pl-2`）
  - 图标 `size={13} text-foreground-secondary`
  - label `text-[11px] uppercase tracking-wide text-foreground-muted`
  - text `text-sm text-foreground-primary`

### 4.3 `list`（键值对竖排·带分隔线）
- 容器：`flex h-full w-full flex-col divide-y divide-border-subtle`
- 每行：`flex items-baseline justify-between gap-3 py-1.5`
  - 左 `flex items-center gap-1.5`：图标? + label `text-[11px] uppercase tracking-wide text-foreground-secondary`
  - 右 text `text-sm text-foreground-primary text-right`

### 4.4 `cards`（图标+标签+文本 网格）
- 容器：`grid h-full w-full grid-cols-3 gap-2 content-start overflow-auto`
- 每项：`flex flex-col gap-1 rounded-lg border border-border-subtle bg-surface-primary p-2`
  - 顶 `flex items-center gap-1.5`：图标? + label `text-[11px] uppercase tracking-wide text-foreground-secondary`
  - text `text-sm text-foreground-primary`
- 列数固定 3（与 `kpi-board` 的 `grid` 变体一致）；项数少于 3 时留空位，可接受。

### 4.5 `stat`（label 小标签 + text 大字号）
- 容器：`flex h-full w-full flex-wrap items-end gap-x-6 gap-y-2`
- 每项：`flex flex-col`
  - label 行 `flex items-center gap-1 text-[11px] uppercase tracking-wide text-foreground-secondary`：图标? + label
  - text `font-data text-xl font-bold text-foreground-primary`

> `cards` / `stat` 视觉权重更大，适合把组件拖到更大尺寸；切换 variant 后尺寸不自动变（与 `kpi-board` 等一致，由用户手动调整）。

## 5. 接线（4 处，沿用现有模式）

| 文件 | 改动 |
|---|---|
| `packages/shared/src/index.ts` | 新增 `MetaStripVariant` 类型；`MetaStripData` 加可选 `variant?: MetaStripVariant`（注释更新） |
| `apps/web/src/editor/registry.tsx`（`'meta-strip'` 注册，~308 行） | 加 `variants: [inline/divider/list/cards/stat]`（chip 标签：横排胶囊 / 竖线分隔 / 键值列表 / 卡片网格 / 强调数值）；`propertySchema` 不变（仍是 table 字段） |
| `apps/web/src/editor/components/ReportComponents.tsx`（`MetaStripComponent`，~247 行） | 按 variant 分支：把现有 inline 渲染拆进 `MetaInline`（零视觉变化），新增 `MetaDivider` / `MetaList` / `MetaCards` / `MetaStat` 四个子组件，缺省 fall-through 到 `MetaInline` |
| `apps/web/src/editor/defaults.ts`（`getDefaultData('meta-strip')`，~185 行） | 默认数据加 `variant: 'inline'`（与新组件一致；可选，渲染层已有缺省回退） |

**属性面板交互**：无需改 `PropertyPanel.tsx`。声明 `variants` 后，现有 `VariantSelector`（`PropertyPanel.tsx:269`）自动在面板上方渲染 chip 选择器并写 `data.variant`；数据仍走下方 table 字段编辑器。

## 6. 向后兼容

- 老数据 `MetaStripData` 无 `variant` 字段 → 渲染层 `const { variant = 'inline' } = data` → 走 `MetaInline` = **原外观，视觉零变化**。
- `'meta-strip'` type id 不变 → 已保存项目正常打开（[[component-type-is-persisted-schema]]）。

## 7. 测试（vitest + jsdom）

新增 `apps/web/tests/editor.meta-strip.test.tsx`（或并入最相近的 `editor.blocks.test.tsx`），遵循 [[web-chart-test-convention]]（本组件无图表，不涉及 recharts mock，只断言 shell 文本与结构）：

- 5 个 variant 各渲染一次默认数据（BASE/TYPE/TIER），断言 label 与 text 文本出现。
- 结构标记：`divider` 不含胶囊背景 class、`list` 为纵向分隔、`cards` 含卡片 border、`stat` 含 `font-data` 大字号 class。
- 无 `variant` 字段（老数据）→ 等价 `inline` 渲染结果。

## 8. 非目标（YAGNI，本轮不做）

每个方向的二次细分变体（如描边胶囊、圆形图标徽章）、variant 专属数据字段（颜色/字号配置）、切换 variant 时自动调整组件尺寸、列数可配置。后续按需迭代。
