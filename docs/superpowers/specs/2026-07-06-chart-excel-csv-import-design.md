# 图表数据 Excel/CSV 直接导入 — 设计

日期：2026-07-06
状态：已确认，待写实施计划

## 背景

当前 MediaKit 编辑器已有三种数据图（`bar-chart` / `line-chart` / `pie-chart`）和一套「数据源绑定」流程：用户在顶部 `DatasourceMenu` 上传 CSV/Excel 生成会话级「数据源」，再到图表属性面板的 `BindingEditor` 里选「标签列/数值列」绑定。该流程存在三个问题：

1. **概念重**：用户要先理解「数据源」再理解「绑定」，两步操作。
2. **会话级不持久化**：`datasources` 只存在内存，刷新即丢（`store.ts` 注释明确标注「未持久化」）。
3. **折线图只能单系列**：`resolve.ts` 的 line 绑定硬编码产出单条系列，且 `line-chart` 连手动编辑器都没有。

## 目标

让「**所有数据图的数据添加都支持 Excel/CSV 表格导入**」成为**直接、直觉**的操作：在图表属性面板点「导入」→ 选文件 → 映射列 → 数据直接灌进**当前**这个图表。不再引入「数据源」中间概念。

## 范围

**适用组件：** `bar-chart` / `line-chart` / `pie-chart`（"数据图"）。

**不在范围：** `table` 组件（已有手动 `TableField`，本次不加导入）；后端 Excel 解析；PDF/分享页渲染（仍走 `comp.data`，导入后自动受益，无需额外改动）。

## 交互设计

### 入口

在 `PropertyPanel.tsx` 中，为 `bar-chart` / `line-chart` / `pie-chart` 三种图表，在属性面板顶部、手动行编辑器之上，新增一个 **「导入 Excel/CSV」** 按钮。点击触发隐藏的 `<input type="file" accept=".csv,.xlsx,.xls">`，单选。选中文件后打开**映射弹框**。

### 映射弹框（核心）

新组件 `apps/web/src/editor/components/ImportDataModal.tsx`，步骤：

1. **解析文件**
   - CSV：复用 `datasource/parse.ts` 的 `parseCSV`（已有手写解析器）。
   - Excel：复用 `parseExcel`，但**改为返回所有 sheet**（当前实现只取 `wb.SheetNames[0]`）。多 sheet 时弹框顶部显示 sheet 切换下拉；单 sheet 则不显示。
   - 统一解析结果结构：`{ columns: string[], rows: Record<string, string>[] }`。

2. **映射控件（按图表类型不同）**
   - **柱状图 / 饼图**：两个单选下拉 ——「标签列」「数值列」。
   - **折线图**：「标签列」单选 + 「数值列」**多选**（每选一列 = 一条系列），支持多系列。
   - **默认值**：第一列 = 标签；柱状/饼图第二列 = 数值；折线图第二列起全部 = 系列。

3. **预览**：弹框下方用 recharts 渲染一个小预览图，实时反映当前映射结果，用户在确认前可见效果。

4. **确认** → 调用新 helper `buildChartData(type, columns, rows, mapping)` 生成对应 `BarChartData` / `LineChartData` / `PieChartData`，写回 `comp.data`。颜色按 `DEFAULT_CHART_PALETTE` 轮询（复用 `resolve.ts` 现有调色逻辑，抽成公共函数）。

### 数据写入

确认后调用 `store.updateComponentData(compId, data)`，直接覆盖当前 `comp.data`。因 `comp.data` 已在现有 autosave 持久化路径内（`useAutosave.ts` 发送 `pages`，其中含每个 `EditorComponent.data`），**导入后自动持久化，无需后端/DB 改动**。

## 移除清单

为简化 UI、消除重复入口，移除「数据源绑定」整套机制：

- `apps/web/src/editor/components/DatasourceMenu.tsx`（顶部数据源上传下拉）
- `apps/web/src/editor/PropertyPanel.tsx` 中的 `BindingEditor`
- `apps/web/src/editor/store.ts` 中的 `datasources` 状态、`addDatasource` / `removeDatasource` / `bindComponent` action
- `apps/web/src/editor/components/ComponentRenderer.tsx` 中对 `resolveData` 的调用（直接用 `comp.data`）
- `apps/web/src/editor/ComponentPanel.tsx` 中对 `DatasourceMenu` 的挂载

**保留手动行编辑器**（`ListField` 用于 bar/pie，`TableField` 用于 table 及业务块）：导入后用户仍可微调单行。

**保留 `packages/shared/src/index.ts` 中的 `Datasource` / `ComponentBinding` 类型定义**：避免破坏已序列化数据的反序列化兼容；只是 UI 不再使用。

## 数据流

```
PropertyPanel 「导入」按钮
  └─ <input type=file> 选文件
       └─ ImportDataModal 打开
            ├─ parseFile() → { columns, rows }   (复用 parse.ts; parseExcel 改返回全部 sheet)
            ├─ 用户选 sheet + 映射列（实时预览）
            └─ confirm → buildChartData() → store.updateComponentData(compId, data)
                                              └─ 写入 comp.data → 现有 autosave 自动持久化 ✓
```

## 文件改动

| 文件 | 改动 |
|---|---|
| `apps/web/src/editor/components/ImportDataModal.tsx` | **新建**：文件解析、sheet 切换、列映射、预览、确认 |
| `apps/web/src/editor/datasource/parse.ts` | `parseExcel` 改为返回全部 sheet；抽出统一 `parseFile` 入口 |
| `apps/web/src/editor/datasource/resolve.ts` | 抽出 `buildChartData(type, columns, rows, mapping)` 公共 helper（颜色轮询、bar 20 条上限）；删除 `resolveData` |
| `apps/web/src/editor/PropertyPanel.tsx` | 加「导入」按钮 + 挂载 `ImportDataModal`；移除 `BindingEditor` |
| `apps/web/src/editor/ComponentPanel.tsx` | 移除 `DatasourceMenu` 挂载 |
| `apps/web/src/editor/components/ComponentRenderer.tsx` | 去掉 `resolveData` 调用，直接用 `comp.data` |
| `apps/web/src/editor/store.ts` | 移除 `datasources` 状态与 `addDatasource` / `removeDatasource` / `bindComponent`；新增 `updateComponentData(compId, data)` |
| `apps/web/src/editor/components/DatasourceMenu.tsx` | **删除** |

**不动：** `apps/server/*`、`apps/server/prisma/schema.prisma`、`packages/shared/src/index.ts`（类型保留）。

## 边界与错误处理

- **解析失败**（损坏的 xlsx、空文件、空表头）→ 弹框内提示错误信息，不崩溃，可重新选文件。
- **数值列含非数字** → 非数值单元格按 `0` 计；预览区显示角标「N 行含非数值，已按 0 计算」。
- **行数上限**：柱状图 > 20 条按现有逻辑截断并提示；折线/饼图不截断，但 > 50 条提示「图表会比较密集」。
- **覆盖语义**：导入确认会**覆盖**当前 `comp.data`；用户在弹框预览中可见结果，点取消则不动。无撤销栈依赖（编辑器现有撤销机制若存在则顺其自然，不在本次新增）。
- **空映射**：标签列或数值列未选时，「确认」按钮禁用。

## 测试

- `parseFile` / `parseExcel`（多 sheet）/ `buildChartData` 为纯函数，写单元测试覆盖：单/多 sheet、CSV 与 xlsx、各图表类型的映射输出、非数值容错、bar 20 条截断。
- `ImportDataModal` 组件测试：打开 → 选文件 → 映射 → 确认后 `updateComponentData` 被调用且 `comp.data` 正确；取消则 store 不变。
