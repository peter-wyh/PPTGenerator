# 报告按 reportPeriod 重算(recipe 路径)— 设计

- **日期**: 2026-08-07
- **状态**: 设计已确认,待评审 → 转 writing-plans
- **范围**: 「调报告时间段→快速重生成」整体方案的报告层(子项目 1,后行)
- **依赖**: 子项目 2(`CpsDaily` 已含 `spend`/`newCustomers`)—— 已合 main(`39cacda`),未推送

## 背景

`mapCampaign(campaignId)` 当前**不按时间段过滤**:KPI 取 `campaign.metrics` 汇总、创作者取 `CpsPerformance` 汇总、趋势取 `analytics.trend`、`header.period` 取 `campaign.startDate/endDate`。`reportPeriod`(报告实际时间段,`project.meta.reportPeriod`)在 recipe 路径**根本没被透传**——controller 的 recipe 分支 `render({ campaignId, theme, designMd })` 直接丢了它(只有 AI 模式的 `buildCampaignContext` 用它重打日期标签,且也不过滤数据)。

结果:用户在 `DataPanel` 调起止日期后点「重新生成」,得到的还是整个 campaign 的全周期数据,只是(AI 模式下)日期标签变了。本设计让 recipe 路径按 `reportPeriod` 真正重算数据,秒级、不调 LLM。

## 目标 / 非目标

**目标**: recipe 路径串通 `reportPeriod`,有 period 且 campaign 有 CPS daily 数据时,`mapCampaign` 从 `CpsPerformance.daily`(含子项目 2 的 `spend`/`newCustomers`)按日期切片重算 KPI / 创作者表 / 趋势 / `header.period`。无 period 或无 daily 数据时,行为与现状完全一致。

**非目标**:
- 不改 AI 模式(用户决策:只做 recipe 快路径;AI 模式维持现状——慢、且只重打日期标签)。
- 不改编辑器 `reportContent` 重渲染路径(`render.ts:33` 的 `reportContent ?? mapCampaign`——编辑器编辑的是已成型快照,不在本范围)。
- 不改 `DataPanel` UI(它已收集 `startDate`/`endDate` 并调 `generate({mode:'recipe', reportPeriod})`;修好 controller 透传后即生效)。
- 不做趋势重采样(日→周);period 趋势就是 CPS daily 的**日粒度**(见下)。

## 架构

### 1. 透传 `reportPeriod`
- **`apps/server/src/modules/html-templates/recipe/types.ts`**:`RenderInput` 加 `reportPeriod?: { startDate?: string; endDate?: string }`。
- **`apps/server/src/modules/html-templates/html-templates.controller.ts`** `generate` 的 recipe 分支:`render({ campaignId, theme, designMd: req.body.designMd, reportPeriod })`。(controller 已解构 `reportPeriod`,且 `generateHtmlSchema` 已允许它——AI 模式在用。**无需改 schema/路由**,纯补一个透传字段。)
- **`apps/server/src/modules/html-templates/recipe/campaign-report/render.ts`**:`const content = input.reportContent ?? await mapCampaign(input.campaignId!, input.reportPeriod)`。

### 2. `mapCampaign` 分支 + 抽取纯 helper
**`apps/server/src/modules/html-templates/recipe/campaign-report/mapper.ts`**:
- 签名变 `mapCampaign(campaignId, reportPeriod?)`。
- 取数不变(`prisma.campaign.findUnique` 同现有 include)。
- **分支**:`const hasDaily = campaign.campaignCreators.some(cc => cc.cpsPerformances.some(p => Array.isArray(p.daily) && p.daily.length))`。
  - `reportPeriod && hasDaily` → 用新 helper `mapFromDaily(campaign, reportPeriod)` 派生 `{ kpis, publishers, trend, period }`。
  - 否则 → 现有逻辑(汇总 + analytics.trend)。若 `reportPeriod` 给了但 `!hasDaily` → `console.warn('[mapCampaign] reportPeriod given but no CPS daily data; falling back to aggregate')`,按现状渲染。
- 抽取 `mapFromDaily` 为**纯函数**(同文件 `mapper.ts`):入参 `campaign`(已查)+ `reportPeriod`,出 `{ kpis, publishers, trend, period }`。理由:把「按 daily 派生」与「按汇总派生」隔离成两个可独立理解/测试的单元,`mapCampaign` 只负责分支与组装。(同文件——mapper.ts 现 ~80 行,加 ~40 行 helper 仍在合理体量,不必拆文件。)

### 3. `mapFromDaily` 算法(按日期切片,全从 CPS daily)
- **`inPeriod(dateStr)`** = `(!startDate || dateStr >= startDate) && (!endDate || dateStr <= endDate)`(YYYY-MM-DD 字符串比较即可)。
- 每个 `campaignCreator`:收集其所有 `cpsPerformances[].daily` 记录 → 按 `inPeriod` 过滤 → 求和得 `{ clicks, impressions, orders, gmv, spend, newCustomers }`(daily 值是字符串,`Number(x)`,缺失键当 `0`——`Number(undefined)||0` 防NaN)。
- **KPI**(各创作者求和的总量):Revenue=sum(gmv)、Clicks、Orders、NewCustomers、AOV=gmv/orders、(spend>0 时 ROAS=gmv/spend)。复用现有 `formatMoney/formatNum/formatPct`,KPI 卡结构与现有一致(`{label, value, highlight?}`)。
- **publishers**:每个创作者的求和值 → 同现有 `{name, handle, type, revenue, clicks, orders, linkUrl}` 结构;无 daily 的创作者显示 0(不省略行,与「null 显示 —」精神一致)。
- **trend**:把**所有** in-period daily 记录(跨创作者)按 `date` 分组求和 → 按 date 升序 → `{labels: dates, revenue: gmvSums, clicks, orders}`。**日粒度**(若 period 跨数月,点会密;重采样到周属后续,不在本范围)。
- **period**:`{ start: reportPeriod.startDate ?? campaign.startDate, end: reportPeriod.endDate ?? campaign.endDate, display: <用 shortDate 格式化 reportPeriod> }`。

## 关键决策(已确认)
1. **一致性策略**:无 period → 不动(现状汇总 + analytics.trend,零风险);有 period → 从 daily 派生。非「永远 daily 派生」(避免现有报告数字漂移)。
2. **趋势来源**:有 period 时从 CPS daily 构建(与 KPI 同源,满足「趋势和=总量」);不从 `analytics.trend` 切片。
3. **无 daily 数据**:优雅降级——忽略 period、按现状渲染全周期 + console.warn,不报错。

## 边界情形
- period 半开(只 `startDate` 或只 `endDate`)→ `inPeriod` 按给出的一边过滤。
- daily 缺 `spend`/`newCustomers`(子项目 2 之前的旧数据)→ 当 0。
- period 范围内某天无 daily → 该天不出现在 trend(不补零)。
- period 完全无 daily 落在范围内 → trend 空(`{labels:[],...}`),KPI 全 0(仍渲染,不报错)。

## 测试(扩 `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.test.ts`)
新增 fixture(带 `daily`)与用例:
- **有 period → KPI/publishers/trend 只含期内 daily**;`header.period` 用 reportPeriod;期外 daily 被排除。
- **无 period → 与现状一致**(现有 6 个用例即回归保护,需仍全绿)。
- **无 daily 数据 + period → 降级为汇总**(不报错,KPI 来自 metrics)。
- **period 半开** → 单边过滤。
- **旧 daily(无 spend/newCustomers)+ period** → 当 0,不 NaN。

## 文件改动
| 文件 | 动作 |
|---|---|
| `apps/server/src/modules/html-templates/recipe/types.ts` | `RenderInput` += `reportPeriod?` |
| `apps/server/src/modules/html-templates/html-templates.controller.ts` | recipe 分支透传 `reportPeriod` |
| `apps/server/src/modules/html-templates/recipe/campaign-report/render.ts` | 传 `reportPeriod` 给 `mapCampaign` |
| `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.ts` | `mapCampaign(campaignId, reportPeriod?)` + 抽取 `mapFromDaily` |
| `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.test.ts` | 扩 period 用例 + 带 daily fixture |

(均为 server 侧;无 web 改动——`DataPanel` 已就绪。)

## 决策记录
- **只做 recipe**(用户决策):AI 模式慢且在避开,维持现状。
- **抽 `mapFromDaily` 纯函数**:隔离两种派生逻辑,可独立测试。
- **趋势日粒度**:从 daily 构建必然日粒度;周重采样为后续。

## 风险
- ⚠️ **数据一致性**:period 派生依赖 CPS daily 完整准确。已知 gotcha(见 [[cps-daily-spend-newcustomers-done]]):`importCpsDaily` 同 date 是**整记录覆盖**、非字段 merge——若用户分批导入同一 date 的不同字段,后者会清掉前者。子项目 1 派生时若发现 daily 疑似不完整,根因多半在此(数据导入侧),非本报告层 bug。
- ⚠️ **趋势变密**:长 period 下日粒度 trend 点多;视觉上比旧 analytics.trend 密。可接受,必要时后续加重采样。
