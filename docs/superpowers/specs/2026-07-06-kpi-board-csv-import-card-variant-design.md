# 业绩看板（kpi-board）CSV 导入 + 卡片指标变体 设计

| 项目 | 内容 |
|---|---|
| 文档 | kpi-board 支持表格数据 CSV/Excel 导入；新增「卡片指标」布局变体（图标可配）；数值主题色块；去掉现有 grid/row 的边框与内 padding |
| 日期 | 2026-07-06 |
| 状态 | 设计（待评审） |
| 关联 | `packages/shared/src/index.ts`（`KpiBoardData`）；`apps/web/src/editor/components/ReportComponents.tsx`（`KpiBoard`）；`apps/web/src/editor/registry.tsx`；`apps/web/src/editor/PropertyPanel.tsx`；`apps/web/src/editor/icons/catalog.ts`；`apps/web/src/editor/datasource/parse.ts`（`parseFile`）；`apps/web/src/editor/store.ts`（`updateComponentData`）；spec [`2026-07-06-chart-excel-csv-import-design`](./2026-07-06-chart-excel-csv-import-design.md)、[`2026-07-06-svg-icon-library-design`](./2026-07-06-svg-icon-library-design.md) |

---

## 1. 背景 / 目标

业绩看板 `kpi-board` 是 Campaign 报告域的核心业务组件，数据形状复用 `TableData`（`{variant, headers, rows}`，约定列顺序 `[指标, 数值, 对比]`）。当前能力短板：

1. **数据只能手动编辑**：通过 `TableField` 逐格敲，无法从 CSV/Excel 灌入。图表三件套已支持直接导入（见 chart-excel-csv-import spec），kpi-board 同为表格形态却没接入。
2. **样式不可配**：版式只有 grid/row/compact 三种硬编码布局；数值颜色固定为 `text-foreground-primary`；无图标能力。无法表达「卡片指标」这种常见看板样式。
3. **grid/row 视觉偏重**：Card 带 `border + px-3 py-2`，外层容器又有 `border + p-2`，双层边框/padding 显得拥挤。

目标：

- **CSV/Excel 导入**：复用已就绪的 `parseFile` + `updateComponentData`，属性面板一键导入，直接灌 `headers/rows`。
- **新增 `card` 变体**：复刻参考图的「卡片指标」样式——左侧 label+value、右侧圆形彩色图标块，每行一张卡，网格自适应。
- **每行数值主题色**：预设 5 个 token 色块，按行配置；`card` 变体下同时驱动数值文字色 + 图标前景/底色（一个旋钮联动，对齐 svg-icon-library spec 的 `colorTheme` 着色哲学）。
- **每行图标可配**：复用 `catalog.ts` 图标目录，面板内每行选图标。
- **grid/row 去边框/padding**：扁平纯文字，更干净。
- **样式跟随全局主题**：颜色全部走设计 token / Tailwind 标准色，不硬编码业务色（对比列 `+/-` 红绿为既有规则，保留）。

---

## 2. 数据模型（`packages/shared/src/index.ts`）

```ts
// IconWeight 已在本文件（packages/shared/src/index.ts）导出，直接复用

export type KpiBoardVariant = 'grid' | 'row' | 'compact' | 'card';      // +card
export type KpiColorToken = 'primary' | 'success' | 'warning' | 'danger' | 'info';

export interface KpiBoardData {
  variant?: KpiBoardVariant;                        // 缺省 'grid'（向后兼容）
  headers: string[];                                // 不变：[指标, 数值, 对比]
  rows: string[][];                                 // 不变：CSV/Excel 直接灌入
  icons?: (string | null)[];                        // 新增·每行图标 catalog key；null/缺省=不显示
  valueColors?: (KpiColorToken | null)[];           // 新增·每行数值主题色；缺省=默认前景
  iconWeight?: IconWeight;                          // 新增·图标 weight，缺省 'regular'
}
```

设计要点：

- `headers/rows` **完全不动** → CSV/Excel 直接映射、零数据迁移、旧数据兼容。
- 新增字段**全部可选、按行、null 友好** → 任何老 `comp.data` 不需迁移即可渲染。
- 颜色用 `KpiColorToken`（语义 key）而非 hex → 「部分样式收全局样式影响」的实现方式：token → 实际色映射集中在渲染层一处，主题变更只改映射表。
- `icons`/`valueColors` 按 rows 索引对应；长度不匹配时按 `rows` 实际长度对齐（超出丢弃、不足视为 `null`），由渲染层兜底，不在数据层强约束。

---

## 3. CSV/Excel 导入

**入口**：`PropertyPanel` 中 kpi-board 的表格字段（`TableField`）旁，新增「**导入 CSV/Excel**」按钮（与图表导入按钮同一视觉）。

**流程**（与 chart 导入不同，kpi-board 是表格原样接收，**无列映射**）：

```
「导入」按钮
  └─ <input type=file accept=".csv,.xlsx,.xls"> 单选
       └─ parseFile(file) → ParsedSheet[]            (复用 datasource/parse.ts)
            └─ 取第一个 sheet（单 sheet 直饮；多 sheet 暂取首个，不弹选择——kpi-board 表格语义不需要）
                 └─ firstRow → headers；rest → rows
                      └─ store.updateComponentData(compId, { headers, rows })
                           └─ 现有 autosave 自动持久化 ✓
```

**覆盖语义**：导入仅覆盖 `headers/rows`，**不动** `icons/valueColors/variant/iconWeight`。若新 `rows` 比 `icons/valueColors` 长，新增行按 `null`（默认前景、无图标）；若短，多余 `icons/valueColors` 静默失效（渲染层按 rows 长度遍历）。用户导入后可在面板逐行配色/配图标。

**不接 chart 的 `ImportDataModal`**：那是图表专用的「列映射 + recharts 预览」流程，对 `{headers,rows}` 表格是过度设计。kpi-board 用一个内联按钮 + 直接灌入即可。

**错误处理**：解析失败（损坏 xlsx / 空文件 / 空表头）→ 按钮下方内联红字提示，不崩溃，可重选。空表头（首行空）→ 提示「首行需作为表头」。

---

## 4. 新增 `card` 变体（复刻参考图）

每行渲染成一张卡片，容器 `grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))` 自适应排列：

```
┌─────────────────────────────┐
│ label（小字 secondary）        │   ← text-xs text-foreground-secondary
│ $258K  +12%                  │   ← value: font-data text-2xl bold, 色=tokenFg
│                              │      compare: text-xs, 既有 +/- 自动红绿
│                    ┌────┐    │
│                    │ ✦  │    │   ← 圆形 w-12 h-12 rounded-full
│                    └────┘    │      bg = tokenSoftBg（~12% 透明）
│                              │      图标 color = tokenFg，weight = iconWeight
└─────────────────────────────┘
     bg-surface-primary rounded-2xl shadow-sm p-5
     flex items-center justify-between
```

- **左**：label + value（`valueColors[i]` → tokenFg）+ compare（保留 `compareColor`）。
- **右**：仅当 `findIcon(icons[i])` 命中时渲染圆形图标块；缺省/未命中 → 不渲染（卡片只有左侧内容，仍居中平衡）。
- **着色联动**：`valueColors[i]` 一个旋钮同时管 value 文字色 + 图标前景色 + 图标底色（softBg = 同色 ~12% 透明）。`primary` token 时 value 取默认前景、图标底取中性灰柔和色。

---

## 5. 现有 `grid` / `row` 去边框 & padding

| variant | 改动 |
|---|---|
| `grid` | 去掉 Card 的 `border border-border-subtle` + `px-3 py-2`，外层容器去掉 `border + p-2`；保留 `grid-cols-3 gap-2`。单元格变纯文字栈：label + value（+可选 valueColor）。 |
| `row` | 同上：Card 去边框/padding，外层去 `border + p-2`；保留 `flex gap-2 items-stretch flex-1`。 |
| `compact` | **不动**（内联 chip 风格，其 border 是样式语义的一部分）。 |

`valueColors[i]` 在 grid/row 同样作用于 value 文字色（如有）。去边框后单元格间靠 `gap` 分隔，视觉更轻。

---

## 6. 数值主题色板（token → 实际色）

集中映射（放 `ReportComponents.tsx` 或抽到 `apps/web/src/editor/kpiTokens.ts`）：

| token | fg（文字/图标前景） | softBg（图标底，~12%） |
|---|---|---|
| `primary` | `text-foreground-primary`（#111827 系） | 中性灰 `#9CA3AF14` |
| `success` | `#22C55E` | `#22C55E1F` |
| `warning` | `#F59E0B` | `#F59E0B1F` |
| `danger` | `#EF4444` | `#EF44441F` |
| `info` | `#3B82F6` | `#3B82F61F` |

色值与项目既有用法对齐：`compareColor`（#22C55E/#EF4444）、`TimelineCompare.STATUS_STYLE`（#22C55E/#3B82F6）。`primary` 走设计 token（跟随全局主题），其余四个为 Tailwind 标准色。

```ts
export const KPI_COLOR_TOKENS: Record<KpiColorToken, { fg: string; softBg: string }> = { ... };
function resolveColor(token?: KpiColorToken | null) {
  return KPI_COLOR_TOKENS[token ?? 'primary'];
}
```

---

## 7. 属性面板编辑器（`PropertyPanel.tsx`）

kpi-board 的 `propertySchema` 扩展为三段：

1. **变体 chip**：`grid` / `row` / `compact` / **`card`**（新增「卡片」）。
2. **表格字段**（既有 `TableField`）+ 旁挂「**导入 CSV/Excel**」按钮（§3）。
3. **每行样式编辑器**（新增，kpi-board 专属子组件 `KpiRowStyleField`）：对 `rows` 每一行渲染一组
   - `[图标选择器]`：当前图标预览 +「选」/「清」按钮，点击打开图标 picker（§8），写入 `data.icons[i]`；`card` 变体下尤有意义，其余变体也可配（grid/row/compact 渲染层忽略图标，仅 card 消费）。
   - `[数值色块]`：5 个 token chip +「默认」，写入 `data.valueColors[i]`。
   - 行号与 `rows` 索引对齐；`rows` 增删时同步。

`KpiRowStyleField` 跟随 `rows` 动态渲染，本质是一个 per-row 元数据编辑器。不引入新的全局 `PropertyFieldKind`（避免过度通用化），作为 kpi-board 在 PropertyPanel 内的条件渲染块。

`registry.tsx`：`'kpi-board'` 的 `variants` 加 `{ id: 'card', label: '卡片' }`；`defaultSize` 视 card 多卡需求适当加高（如 `h: 240`）。

`defaults.ts`：`'kpi-board'` 的 card 示例数据带几个 `icons` + `valueColors`，让首次插入即见图标卡片。

---

## 8. 图标能力（依赖与复用）

**底层目录已就绪**：`apps/web/src/editor/icons/catalog.ts` 已实现——`ICONS`（~32 个，4 类分组）、`findIcon(key)` 返回 `{ key, label, category, Comp }`，`Comp` 是直接 import 的 phosphor 组件（保留 tree-shaking）。`IconWeight` 类型已在 shared。

**渲染**：kpi-board 直接用 `findIcon(icons[i])?.Comp` 渲染，**不依赖** svg-icon-library spec 中尚未实现的 `IconKit.tsx`。未命中 key → 不渲染（不抛）。

**Picker（需新建）**：svg spec 规划的 `IconPickerOverlay` 尚未实现。两条路：

- **首选**：按 svg spec 建一个最小可用的 `IconPickerOverlay`（weight tabs + 分类分组 + 搜索 + 选中回调），kpi-board 与未来的 indicator-card 共用——一处建设、两处受益。
- **退路**（若不想本轮引入完整 overlay）：kpi-board 内联一个简化 picker（分类网格 + 选中），仅满足每行选择。后续 svg spec 落地时再统一替换。

本 spec **推荐首选**：picker 是通用能力，建一次即可被 svg spec 的 indicator-card 直接复用，避免重复。`IconKit.tsx` 因 catalog 已带 `Comp`，可暂不建（kpi-board 直接用 `findIcon`）；若 svg spec 后续要求统一入口，再补 `IconKit` 包装层、kpi-board 切换过去即可（改动局部）。

---

## 9. 变更清单

| 文件 | 变更 |
|---|---|
| `packages/shared/src/index.ts` | `KpiBoardVariant` 加 `'card'`；新增 `KpiColorToken`；`KpiBoardData` 加 `icons?` / `valueColors?` / `iconWeight?` |
| `apps/web/src/editor/components/ReportComponents.tsx` | `KpiBoard` 加 `card` 分支；grid/row 去边框/padding；value 应用 `valueColors`；色板映射 `KPI_COLOR_TOKENS` + `resolveColor` |
| `apps/web/src/editor/registry.tsx` | `'kpi-board'` variants 加 `card`；`defaultSize` 调整 |
| `apps/web/src/editor/defaults.ts` | `'kpi-board'` 默认补 `icons` / `valueColors` 示例 |
| `apps/web/src/editor/PropertyPanel.tsx` | kpi-board 表格字段旁加「导入 CSV/Excel」按钮 + parseFile 调用；挂载 `KpiRowStyleField`（每行图标 + 色块） |
| `apps/web/src/editor/components/KpiRowStyleField.tsx` ✱new | per-row 图标按钮 + 色块 chip 编辑器 |
| `apps/web/src/editor/icons/IconPickerOverlay.tsx` ✱new | 通用图标选择器（weight tabs + 分类 + 搜索），kpi-board 与 indicator-card 共用 |
| `apps/web/tests/` ✱new/扩展 | KpiBoard 各 variant 渲染、导入写入、去边框、IconPickerOverlay 选用 |

**不动**：`apps/server/*`、`prisma/schema.prisma`、`datasource/parse.ts`（已就绪直接复用）、`store.ts`（`updateComponentData` 已存在）、其他业务组件。

---

## 10. 分阶段交付（因图标 picker 依赖）

- **阶段 1（核心，无 picker 依赖，可独立交付）**：shared 类型、CSV/Excel 导入、grid/row 去边框、`card` 布局骨架 + valueColors 着色 + 图标位渲染（用 `findIcon`，数据手填图标 key 即可生效）、PropertyPanel 导入按钮 + variant chip + 色块编辑器。
- **阶段 2（picker）**：`IconPickerOverlay` 建设 + `KpiRowStyleField` 的图标选择入口接入。

阶段 1 落地后，用户已能：导入数据、用 card 布局、配色块、（通过手填或后续 picker）配图标。阶段 2 补齐图标 picker 的图形化选择体验。

---

## 11. 范围外（YAGNI，显式）

- **多 sheet 选择**：kpi-board 导入暂取首个 sheet（表格语义无需选）。
- **CSV 带图标列 / 带颜色列**：图标与颜色是行级视觉配置，导入后面板配，不在表格数据里携带。
- **全局 datasource binding 接入 kpi-board**：直接导入已足够，不复活已删的 BindingEditor。
- **其他业务组件（timeline-compare / product-performance / …）的导入或图标**：逐个采纳是后续工作。
- **`IconKit.tsx` 统一渲染入口**：catalog 已带 `Comp`，本轮不强制包装；留给 svg spec 统一。
- **服务端 / PDF 渲染适配**：`comp.data` 形态兼容，导出路径自动受益，无需改动。

---

## 12. 测试方案（vitest + @testing-library，对齐 `tests/`）

遵循 [[web-chart-test-convention]]：recharts 不涉及，但同样只断言 DOM 结构/shell 文本，不断言内部细节。

1. **KpiBoard 渲染**：
   - `card` 变体：有 `icons[i]` → 渲染圆形图标块（含 `<svg>`）；无 → 不渲染图标块；`valueColors[i]` → value 文字与图标块着色生效；`compare` 列保留 +/- 红绿。
   - `grid`/`row`：断言无 `border-border-default` / `border-border-subtle` class；value 应用 `valueColors`。
   - `compact`：外观不变（回归保护）。
   - 老数据（无 `variant`/`icons`/`valueColors`）→ 按 `grid` 默认渲染，不崩。
2. **CSV/Excel 导入**：mock `parseFile`（参照 chart 导入测试的 mock 模式），点击「导入」→ 选文件 → `updateComponentData` 被调用，`headers/rows` 写入正确，`icons/valueColors` 保持不变。
3. **KpiRowStyleField**：每行渲染图标按钮 + 色块；选图标 → 写 `data.icons[i]`；选色块 → 写 `data.valueColors[i]`；`rows` 增删时编辑器同步。
4. **IconPickerOverlay**（阶段 2）：打开 → 分类/搜索 → 选中 → 回调写入 key。
