# 达人合作详情 · 受众画像编辑器 — 设计

- 日期：2026-07-15
- 状态：已批准（待实现）
- 范围：`apps/web/src/components/CollaborationDetail.tsx`

## 背景

上一期实现的 `CollaborationDetail`（达人合作详情抽屉的编辑器）中，`DeliverableEditor` 的「画像」部分是**只读概要**（`画像：N 城 / N 性别 / N 年龄`， CollaborationDetail.tsx:233-239）。截图/效果数据/评论词云三类已可编辑，唯独受众画像（`WorkAudienceInsight`）无法在 UI 里录入或修改——只能靠种子或直接 API 写入。

## 目标

把 `DeliverableEditor` 的画像部分从只读概要改为**可编辑的四个子列表 + trendLabel**，与已有的截图/效果/词云编辑器一致的交互（仅 `editing` 模式可编辑，复用既有 `Section` + 行编辑模式）。

## 数据模型（既有，不改）

`WorkAudienceInsight`（editor.ts:477-488）：
- `topCities?: { label, value:number, color? }[]`
- `genderSplit?: { label, value:number, color? }[]`
- `ageRange?: { label, value:number, color? }[]`
- `trend?: WorkTrendPoint[]`（`WorkTrendPoint = { label:string, value:number }`）
- `trendLabel?: string`

value 为数字（城市/性别/年龄为百分比；趋势为原始数值）。

## 方案

### 替换只读画像概要

把 `DeliverableEditor` 中第 233-239 行的只读 `<div>画像：…</div>` 替换为：

1. 一个 `setAudience(patch: Partial<WorkAudienceInsight>)` 辅助：`patch({ audience: { ...(deliverable.audience ?? {}), ...patch } })`（与 screenshots/metrics/wordcloud setter 同模式）。
2. 四个 `Section`（复用既有组件），每个子列表一行编辑器（label 文本输入 + value 数字输入 + 「✕」移除，「+ 添加」在 editing 模式）：
   - 受众·城市 → `topCities`
   - 受众·性别 → `genderSplit`
   - 受众·年龄 → `ageRange`
   - 受众·趋势 → `trend`
3. 一个 `trendLabel` 文本输入（在 trend Section 内或紧跟）。
4. audience 全空且非 editing → 显示「暂无画像」；editing 下各 Section 显示「+ 添加」。

### 颜色

不编辑 color 字段——类型里 color 可选，画像图表（CreatorFanGender/City/Age）按调色板自动上色（与效果数据编辑器一致，跳过 color）。

### 仅 editing 模式可编辑

与既有 Section 一致：非 editing 模式下输入框 `disabled`、不显示「+ 添加」/「✕」。

## 不在本期范围

- color 编辑（自动上色已够用；如需可后续加）。
- 抽屉里其它三类（截图/效果/词云）已可编辑，不动。
- live 绑定。

## 测试

- **editing 写入**：渲染 `CollaborationDetail`，进 editing（点「编辑合作」），在「受众·城市」加一行（label「上海」/value「28」），断言 store 中该 deliverable 的 `audience.topCities` 含 `{label:'上海', value:28}`。
- **非 editing 只读**：给定带 audience 的 deliverable，非 editing 下画像 Section 显示既有行（disabled 输入框），无「+ 添加」按钮。
- 遵循 `web-chart-test-convention`。
