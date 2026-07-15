# 页面绑定级联填充（Page-Binding Cascade Fill）

- 日期：2026-07-13
- 状态：设计已确认，待实现计划
- 作者：peter.wan + Claude

## 背景

编辑器里页面（`Page`）可绑定 `campaignId` / `creatorId`，但当前这些绑定**不流入组件**：

- 组件是**纯数据驱动**的——渲染器只读 `comp.data`，不读 store / 不读页面绑定。
- 组件唯一的数据源概念是 `comp.data._dataSource`（`'manual' | 'url' | 'project'`）。**「项目」只是弹出导入器**，用户必须手动点「导入」才会把数据拷进 `comp.data`。
- `page.campaignId` / `page.creatorId` 今天只用于：页面类型自动绑定、PageProperties 下拉、以及导入器里 `usePageCreator()` 对达人的**预选**（仅 UI 便利，不进组件数据）。
- `CampaignReportImporter` 甚至忽略 `page.campaignId`，只用全局 `reportData.campaign`。

结果：在一个已绑定 campaign+达人的「达人合作详情」页，用户每加一个数据组件，都得手动切「项目」源、选同一个达人、点导入——重复且易错。

## 目标

页面绑定 campaign / 达人后，该页的数据组件**自动**用对应绑定数据填充，`_dataSource='项目'`，无需手动导入；切换页面达人时，跟随页面的组件自动更新。

## 非目标

- 不改组件渲染契约（渲染器仍只读 `comp.data`）。
- 不做实时双向绑定（页面 ↔ 组件）。
- 不改后端 / API（campaign 实际只有全局一个，creator 数据已在 `reportData` 内）。

## 行为规格

1. **触发条件**：页面有 `campaignId` **或** `creatorId` 绑定（任一）。不限于 creator-collab；creator-case 页（仅达人）与 campaign-report 页（仅 campaign）同样适用。
2. **新增组件**：往已绑定页面加数据型组件时，立即用页面绑定数据填充，并置 `_dataSource='项目'`。
3. **改页面绑定**：`page.campaignId` / `page.creatorId` 变化后，页面上所有 `_dataSource==='项目'` 的数据型组件按新绑定重填。
4. **手动脱离**：把组件源切到「手动 / URL」即脱离跟随，不再被页面变化覆盖；切回「项目」立即按当前绑定重填。
5. **未绑定页面 / 非数据型组件**（text / shape / table / image 等）：保持现状（占位数据，manual）。

### 手动覆盖判定（确认采用「简」模型）

- 「跟随页面」≡ `_dataSource==='项目'`。源状态本身就是跟随标记，**不新增持久化字段**。
- 脱离 = 用户显式把源切到「手动 / URL」。
- 源为「项目」时若用户手动编辑了内容字段，**仍视为跟随**（下次页面达人变化会重填）；要锁定手改数据，需切到「手动」。（「严」模型 —— 内容编辑即自动脱离 —— 暂不实现，可作为后续增强。）

## 组件分类映射

集中一张映射表，复用现有 importer 归属（不新发明分类）：

- **creator 型**（取 `page.creatorId`，从 `allReportCreators(reportData)` 解析）：creator-avatar-card、creator-stats-strip、creator-fan-age、creator-fan-gender、creator-fan-city、creator-fan-interest、creator-works-list、creator-list、work-screenshot、work-metrics
- **campaign 型**（取 `page.campaignId`，解析到 `reportData.campaign`）：campaign-summary、kpi-board、funnel-chart、publisher-table、geo-distribution、placement-wide-table、placement-type-summary、device-breakdown、content-topic-performance、search-term-table、hourly-heatmap、product-performance
- 其余类型不参与

> 实现时以现有 importer 的 `projectImporter` / `CampaignReportImporter` 归属为准对齐这张表；若发现归类不一致，以 importer 实际行为为准并在此表登记。

## 数据模型

- 复用 `comp.data._dataSource`（已存在，见 `packages/shared/src/types/editor.ts:81` `DataSourceMode`）。
- 填充 = 调用纯函数生成 patch，写入 `comp.data` 的**内容字段**（与现有 importer `apply()` 写入的字段完全一致）；不动 `x/y/w/h` 及样式字段。
- 渲染器**零改动**。

## 实现架构

### 新模块 `apps/web/src/editor/pageBinding.ts`（纯函数，无 React）

把现有 importer 内嵌的 `apply()` 逻辑提成可复用函数：

- `resolvePageCreator(page, reportData) → ReportCreator | undefined`：把 `usePageCreator()`（`importers.tsx:32-40`）提成纯函数。
- `resolvePageCampaign(page, reportData) → ReportCampaign | undefined`：`page.campaignId` → `reportData.campaign`（全局唯一）。
- `fillFromCreator(compType, creator) → Partial<ComponentData> | null`：对 creator 型组件返回内容 patch（提取自各 creator importer 的 `apply()`）。
- `fillFromCampaign(compType, campaign) → Partial<ComponentData> | null`：复用现有 `campaignDataPatch(compType, campaignId)`（`importers.tsx:869`）。
- `COMPONENT_BINDING_KIND: Record<ComponentType, 'creator' | 'campaign' | undefined>`：组件分类表。
- `applyPageBinding(pages, pageId, reportData) → pages`：纯 reducer——找到该页，遍历组件，对「数据型 + (`_dataSource==='project'` 或本次为新增)」的组件，按分类调上面两个 filler，合并 patch 返回新 `pages`。

### store 改动 `apps/web/src/editor/store.ts`

- 新增 action `applyPageBinding(pageId)`：调纯函数 `applyPageBinding` 并 `set` 新 pages（经 `mutateAndCommit` 以入 history / 标脏）。
- 调用时机：
  - `addComponent` / `addComponentAt`：加完后若当前页已绑定，对**新组件**填充（即调用一个只针对新组件的轻量版本，或调用 `applyPageBinding` 并依赖「新增组件必填」规则）。
  - `addPageWithComponents` / `addPagesBatch`：创建并自动绑定 campaign 后（`store.ts:700-703, 723-726`），调 `applyPageBinding`，让新报告页落地即有真实数据。
  - `setPageType` 自动绑定 campaign 后（`store.ts:887-894` `patchCampaign`）。

### 属性面板改动 `apps/web/src/editor/property-panel/PageProperties.tsx`

- `set({ campaignId })` / `set({ creatorId })`（`:407, :428, :453`）后，调 `applyPageBinding(page.id)` 触发跟随组件重填。
- （「项目」源的 UI 含义不变；用户切源仍走 `DataSourceSection`。）

### 关键约束

- 现有 creator importer 的 `apply()` 逻辑散落在多个 React 组件内（`importers.tsx` 各 `apply()` 函数）。提取为纯函数时需逐一对照，确保填充字段与现有手动导入**逐字段一致**（避免自动填充与手动导入结果不同）。
- `CampaignReportImporter` 当前忽略 `page.campaignId`；本次不修该 importer，而是让 `fillFromCampaign` 直接用 `reportData.campaign`（= `page.campaignId` 解析结果）。
- 新增组件是否「本次新增」的判定：在 `addComponent` 内对刚创建的组件直接填充（不走「源=项目」判定），避免新组件因默认无 `_dataSource` 而被漏填。

## 边界与异常

- 绑定的 creator 不在 `reportData`（已删）→ 跳过该组件，保留现有数据。
- 组件类型在映射表中无登记 → 不动。
- 重填只覆盖**数据内容字段**，不动位置 / 尺寸 / 样式 / 主题。
- `page.campaignId` 实际唯一取值 = 全局 `reportData.campaign.id`。
- 页面无任何绑定 → 不触发任何填充。

## 测试

### 单元测试（vitest）

- `fillFromCreator` / `fillFromCampaign` 对代表性 creator 型 / campaign 型组件返回正确 patch（字段与现有 importer `apply()` 一致）。
- `resolvePageCreator` / `resolvePageCampaign` 解析正确，缺失时返回 `undefined`。
- `applyPageBinding` 纯函数：只填 `_dataSource==='项目'` 或新增的数据型组件；`manual` / `url` 源组件不动；非数据型组件不动；无绑定时返回原 pages。

### 集成测试（vitest + jsdom）

- 场景 A：页面绑 creator → `addComponent('creator-avatar-card')` → 断言其 `data` 已填该 creator 数据且 `_dataSource==='项目'`。
- 场景 B：跟随组件已填 → 改 `page.creatorId` → 跟随组件更新为新 creator；同时把某组件源置 manual，断言其不被覆盖。
- 场景 C：campaign-report 页（仅 campaign 绑定）→ 新增 kpi-board → 断言填入 campaign 数据。
- 沿用既有约定：recharts 在 jsdom 中被 mock，只断言 shell / 数据层，不断言 chart 内部标签。

## 影响面

- 新增：`apps/web/src/editor/pageBinding.ts`、其单测。
- 修改：`store.ts`（新 action + 4 处调用点）、`PageProperties.tsx`（2 处调用点）、可能微调 `defaults.ts`（若需统一默认源）。
- 不动：所有渲染器、`packages/shared` 类型（`_dataSource` 已存在）、后端。
