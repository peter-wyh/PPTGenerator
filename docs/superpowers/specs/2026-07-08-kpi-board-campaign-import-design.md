# 业绩看板 Campaign 数据导入设计

> 日期：2026-07-08
> 范围：在业绩看板（`kpi-board`）组件的属性面板新增第二条数据导入路径——「从 Campaign 导入」按钮 + 模态框，选择某个 campaign 后，将其投放表现指标导入看板的 `headers`/`rows`，与现有 Excel/CSV 导入并列。

## 1. 背景与目标

`kpi-board` 现有一条数据导入路径：`KpiImportButton`（`apps/web/src/editor/PropertyPanel.tsx:973-1021`）解析 Excel/CSV，覆盖 `headers`/`rows`。本项目已存在 Campaign 概念——前端 mock（`apps/web/src/api/campaigns.ts`，含 6 个 `MOCK_CAMPAIGNS`、`listCampaigns()`、`getCampaign(id)`），设计上未来对接投放系统/CRM；项目级 campaign 选择已存在于 `CreateProjectDialog.tsx`，`projectMeta.campaignId` 运行时可得（`store.ts:50`）。

但 `Campaign` 类型（`packages/shared/src/index.ts:112-124`）当前只有元信息（广告主/业务线/平台/预算/周期…），**没有投放表现指标**，而业绩看板行格式是 `[指标, 数值, 对比]`。

目标：让用户在业绩看板里「选一个 campaign → 导入它的投放表现指标」，作为 Excel 导入之外的第二条路径。

## 2. 关键决策（已与用户确认）

1. **导入内容 = 投放表现指标**（花费/展示/点击/转化/CTR/ROAS），不是 campaign 元信息。
2. **交互 = 按钮 + 模态框**：在「数据导入」分组加「从 Campaign 导入」按钮，弹模态框选 campaign + 预览 + 确认（仿 `ImportDataModal.tsx`）。
3. **指标建模 = 扩展 Campaign 类型**：给 `Campaign` 加 `metrics?: CampaignMetric[]`，`CampaignMetric` 与 kpi-board 行同构，导入零转换。mock 给每个 campaign 填指标；未来真实接口提供同形状即可，调用点不变。
4. **覆盖语义**：覆盖 `headers`/`rows`（与 Excel 导入一致），保留 `variant`；`icons`/`valueColors` 重置为与新行数匹配的 `null[]`。

## 3. 数据模型（`packages/shared/src/index.ts`）

```ts
/** Campaign 投放表现指标项；与 kpi-board 行 [指标, 数值, 对比] 同构。 */
export interface CampaignMetric {
  label: string;   // 指标名，如 "花费"
  value: string;   // 数值，如 "¥128,000"
  compare: string; // 对比文本，如 "+15%"（kpi-board 渲染器按首字符 +/- 自动着色）
}

export interface Campaign {
  id: string;
  name: string;
  advertiser: string;
  businessLine: string;
  platform: string;
  startDate: string;
  endDate: string;
  budget: string;
  status?: string;
  owner?: string;
  metrics?: CampaignMetric[]; // 新增：投放表现指标
}
```

**为什么同构**：`CampaignMetric { label, value, compare }` 刻意等于 kpi-board 一行 `[m.label, m.value, m.compare]`，导入即 `metrics.map(m => [m.label, m.value, m.compare])`，无需转换层。

**约束**：`Campaign` 类型不进 `Project.pages` JSON 持久化（campaign 数据是外部数据源，仅 `campaignId`/`campaignInfo` 写入 `Project.meta`），故新增 `metrics` 字段不影响已存项目（[[component-type-is-persisted-schema]] 不涉及此处）。

## 4. Mock 数据源（`apps/web/src/api/campaigns.ts`）

给现有 6 个 `MOCK_CAMPAIGNS` 各填一组标准投放指标。**指标集合（6 项）**：

| 指标 | 数值示例 | 对比示例 |
|---|---|---|
| 花费 | ¥128,000 | +15% |
| 展示 | 1,240,000 | +8% |
| 点击 | 38,500 | +12% |
| 转化 | 2,180 | -3% |
| 点击率 (CTR) | 3.1% | +0.2% |
| 投资回报率 (ROAS) | 3.8 | +0.4 |

每个 campaign 数值各异并带合理 +/- 对比（按 +/- 首字符自然产生红绿）。无需新增 API 函数——`listCampaigns()`/`getCampaign(id)` 已返回完整 `Campaign`，`metrics` 随附返回。

> 演进：未来接入真实投放系统时，同一 `metrics` 形状由真实接口提供，仅 `apps/web/src/api/campaigns.ts` 内部实现切换，调用点零改动。

## 5. UI / 交互

### 5.1 新模态 `apps/web/src/editor/components/ImportCampaignModal.tsx`

仿 `ImportDataModal.tsx` 结构（标题 + 内容 + 底部操作）：

- **Campaign 下拉**：`<select>`，选项来自 `listCampaigns()`；**默认预选** `projectMeta.campaignId`（若已绑定，取自 `useEditorStore(s => s.projectMeta?.campaignId)`）。
- **实时预览**：只读小表，展示选中 campaign 的 `metrics` 为 `[指标, 数值, 对比]` 行——所见即所导入。对比单元格沿用看板渲染约定（+ 绿 / - 红）。
- **确认 / 取消**：确认时调用 `onConfirm(metrics)` 回调（传入选中 campaign 的 `CampaignMetric[]`）。映射与写入由按钮侧负责，模态只负责「选哪个 campaign」。
- **状态**：
  - 列表加载中 → spinner（沿用现有加载态风格）。
  - 选中 campaign 无 `metrics`（空数组/缺失）→ 确认按钮禁用 + 文案「该 Campaign 暂无可导入的指标」。
  - 加载失败 → 错误提示 + 重试。

### 5.2 新按钮 `ImportCampaignButton`（`apps/web/src/editor/PropertyPanel.tsx`）

在「数据导入」`FieldGroup` 内、`KpiImportButton` 旁加一个「从 Campaign 导入」按钮（kpi-board 分支，约 `PropertyPanel.tsx:84`）。点击打开 `ImportCampaignModal`，确认回调里用纯函数 `metricsToRows` 映射后写入：

```ts
// 纯函数：CampaignMetric[] → kpi-board 数据补丁（保留 variant/iconWeight 由调用处展开）
function metricsToRows(metrics: CampaignMetric[]) {
  const rows = metrics.map(m => [m.label, m.value, m.compare]);
  return {
    headers: ['指标', '数值', '对比'],
    rows,
    icons: rows.map(() => null),
    valueColors: rows.map(() => null),
  };
}

// 按钮确认回调
const patch = metricsToRows(metrics);
setComponentData(comp.id, { ...comp.data, ...patch });
```

`metricsToRows` 独立可测，且模态与写入解耦。

## 6. 导入语义

- **覆盖** `headers` + `rows`（与 `KpiImportButton` 一致），**保留** `variant` / `iconWeight`。
- **重置** `icons`/`valueColors` 为与新行数匹配的 `null[]`（干净起点；看板渲染器已按对比单元格首字符 +/- 自动着色，不依赖 `valueColors`）。
- 行数变化安全：`KpiRowStyleField.ensureLen`（`PropertyPanel.tsx:1033-1037`）本就按行数 pad/truncate，即使不重置也不会崩；重置仅为止「残留旧图标」。
- 写入走 `setComponentData`（`store.ts:760-765`，全量替换 `data` + `mutateAndCommit` 自动入历史）。

## 7. 涉及文件

| 文件 | 改动 |
|---|---|
| `packages/shared/src/index.ts` | 新增 `CampaignMetric`；`Campaign` 加 `metrics?: CampaignMetric[]` |
| `apps/web/src/api/campaigns.ts` | 6 个 `MOCK_CAMPAIGNS` 各填 6 项 `metrics` |
| `apps/web/src/editor/components/ImportCampaignModal.tsx`（新） | campaign 下拉 + 预览 + 确认/取消 + 加载/错误/空态 |
| `apps/web/src/editor/PropertyPanel.tsx` | 新增 `ImportCampaignButton`，挂到 kpi-board「数据导入」分组（`KpiImportButton` 旁） |
| `apps/web/tests/` | metrics→rows 映射单测；模态外壳渲染测试 |

## 8. 测试（vitest + jsdom）

- **映射逻辑**：纯函数 `metricsToRows(metrics)` → `{ headers, rows, icons, valueColors }`（`[label, value, compare]` 顺序、headers 固定、icons/valueColors 长度 = rows 长度且全为 null）。
- **模态渲染**（遵循 [[web-chart-test-convention]]：断言 shell 文本，本组件无图表，不涉及 recharts mock）：
  - 加载完 → 渲染下拉选项（campaign 名）。
  - 选中带 metrics 的 campaign → 预览出现对应指标名。
  - 选中无 metrics 的 campaign → 确认按钮禁用 + 空态文案。
- **写入**：确认后 `setComponentData` 被以正确的 `headers`/`rows`/`icons`/`valueColors` 调用（mock store 断言）。

## 9. 非目标（YAGNI，本轮不做）

- 不加后端 campaign 模块（mock 保留；真实接口落地时仅换 `campaigns.ts` 内部）。
- 不做时间范围/漏斗/分渠道指标（仅单点快照）——演进时按方案 B（独立 `getCampaignMetrics(id)`）拆分。
- 不接 `EditorComponent.binding` 活绑定（覆盖模型，与现有 Excel 导入一致；不随 campaign 数据变化自动刷新）。
- 不改写 `projectMeta.campaignId`（组件级数据导入，非项目重绑）。
- 不做指标集合可配置（固定 6 项；如需可配置后续再加）。
