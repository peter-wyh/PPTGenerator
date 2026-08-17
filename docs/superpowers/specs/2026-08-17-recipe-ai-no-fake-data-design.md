# recipe/AI 报告数据链路「宁缺勿假」改造 — Design

- **Date:** 2026-08-17
- **Principle:** 数据宁缺勿假——任何数字只有真实来源(daily 切片或明示口径的汇总)才渲染;没有就显式空态 + 提醒,覆盖不完整就明示实际区间。**永不硬拒**(入口不拦),**永不假数据**(无 analytics 兜底、无 `?? 0` 假零、无合成 seed)。

## 1. 背景与问题

recipe/AI 两条报告链路目前有三处「静默不准」:

| # | 位置 | 行为 |
|---|---|---|
| 1 | `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.ts:212-214` | reportPeriod 给了但无 daily → console.warn 后**悄悄走 Branch B** 读过期 `campaign.analytics` blob |
| 2 | Branch B 自身(`mapper.ts:247-251`) | `metrics`/`summary` 缺字段 `?? 0` 兜底渲染假零 |
| 3 | `apps/server/src/modules/html-templates/ai-generate.service.ts:712-720` | `buildCampaignContext` 同样喂 analytics blob 旧口径数字给 AI,AI 按其生成报告 |

另有 `apps/server/prisma/seed-cps-daily.ts` 生成合成演示数据冒充真实数据。

**决策记录**(与用户确认):
- 所有场景都是**提醒,不是硬拒**;但不能用假数据。
- 覆盖不完整:出数(真实日内累加)+ 明示实际区间(推荐方案,已确认「按你推荐」)。
- AI 模式无周期首次生成:metrics 有什么用什么 + `dataGaps` 让 AI 画空态(推荐方案,已确认)。
- 删除 seed-cps-daily.ts;验证链路改用 `POST /campaigns/import/cps-daily` 灌真实数。

## 2. 架构:数据层单一真源

`mapFromDaily`(daily 切片)成为**唯一数据路径**;Branch B(analytics 兜底)整段删除。

### 2.1 mapper.ts 改造

`mapCampaign(campaignId, reportPeriod?)` 返回 `CampaignReportContent` 扩展:

```ts
// schema.ts 的 CampaignReportContent 增加可选字段:
dataCoverage?: {
  requested: { start: string; end: string };   // 请求周期(无 reportPeriod 时 = campaign 起止)
  covered: { start: string; end: string } | null; // daily 实际覆盖(无任何 daily → null)
  missingDays: number;                          // 请求区间内无数据的天数
  complete: boolean;                            // missingDays === 0
};
```

**分支逻辑(单路径 + 显式降级呈现):**

1. **有 daily 记录**(不论覆盖完整与否)→ 全部走 `mapFromDaily` 切片。数字都是真实期内累加。
   - `complete === true` → 正常渲染,无标注。
   - 覆盖不完整 → 正常出数,header period 下方渲染 coverage 提示条:"Data coverage: {covered.start} – {covered.end} ({missingDays} days missing)"。
   - 请求区间内**零天有数据**(daily 存在但都在区间外)→ KPI/trend/publishers 渲染空态卡,coverage 条提示实际可用区间。
2. **无任何 daily 记录 + 有 reportPeriod** → KPI/trend/publishers 全部渲染「No data for this period」空态卡;不再读 analytics;header 仍出(品牌/商家/周期是配置非数据)。
3. **无 reportPeriod(首次生成/汇总口径)** → 走现有汇总分支,但 `metrics`/`summary` **有值才渲染**:缺字段的 KPI 卡换成「Metric unavailable」占位(不是 0);trend 为空数组时 trend 区块渲染空态。汇总分支的 cpsPerformances 顶层 gmv/clicks/orders(CPS 表真实列)保持可用——那是导入的真实汇总,不是 analytics blob。

**空态卡视觉**(recipe 模板):虚线边框灰底、居中"No data for this period / Metric unavailable",绝不渲染 0。

### 2.2 ai-generate.service.ts 改造(buildCampaignContext)

- 入口计算同一套覆盖信息(抽共享 helper,见 2.3)。
- **有 reportPeriod 且有任何 daily** → 上下文只含期内切片:`periodKpis`(真实切片)、daily 切片 trend、期内 creator CPS;`analytics` blob 的数字字段(trend/weeklyTrend/topProducts/topMarkets/insights/customerSplit)**不再进 prompt**。
- **有 reportPeriod 但零覆盖**(daily 全在区间外或无 daily) → 上下文不含任何数字维度,附 `dataCoverage`(含实际可用区间)。
- **无 reportPeriod** → 上下文带 `metrics` 有值字段 + `dataGaps: string[]`(缺的维度名);analytics 数字字段同样移除。
- 上下文保留:campaign 基本信息(name/platform/budget/status/businessLine/advertiser 及 logoUrl)、creators 档案(不含数字)。

### 2.3 共享覆盖 helper

`recipe/campaign-report/coverage.ts`(新文件,mapper 与 ai-service 共用):

```ts
export interface DailyCoverage {
  covered: { start: string; end: string } | null;
  missingDays: number;      // 请求区间内无数据天数(无区间边界时按 daily 全集与请求交集计算)
  complete: boolean;
}
/** 从 campaign(campaignCreators[].cpsPerformances[].daily)计算请求区间的覆盖。纯函数。 */
export function computeCoverage(campaign: Any, requested: { start?: string; end?: string }): DailyCoverage;
```

纯函数可独立测试;边界:半开区间(startDate only)→ endDate 取 campaign.endDate 补全(与现有 MoM guard 口径一致);无任何 daily → `covered: null, missingDays: 请求天数, complete: false`。

### 2.4 SYSTEM_PROMPT 规则(AI 模式)

中英两份 prompt 各加一条硬规则:

> If the context provides `dataGaps` or `dataCoverage` indicating missing data, you MUST render an explicit "Data Unavailable" placeholder block for that dimension. NEVER invent, estimate, or extrapolate numbers. If `dataCoverage.covered` differs from the requested period, display the actual covered date range prominently near the report header.

## 3. 前端提醒呈现

### 3.1 RecipeEditor DataPanel

- 「重新生成」完成后读版本 `reportContent.dataCoverage`:
  - `covered === null`(无任何 daily) → 红色提示条:「所选周期无数据,请先导入 CPS daily(POST /campaigns/import/cps-daily)」
  - `complete === false` 且有部分覆盖 → 黄色提示条:「实际数据区间 {covered.start} ~ {covered.end},缺 {missingDays} 天」
  - `complete === true` → 无提示
- 提示条同时 toast 一次(常驻条 + 即时反馈)。

### 3.2 报告内自说明

recipe 模板 `template.hbs` 在 header period 下渲染 coverage 提示条(数据层给什么渲染什么,AI 模式由 2.4 的 prompt 规则驱动同等呈现)。读者第一眼可见数据边界,报告脱离系统分享后仍自明。

### 3.3 HtmlStudio(AI 模式)

生成完成后若上下文曾带 dataGaps/dataCoverage → 前端 toast 提醒「部分维度无数据,报告含 Data Unavailable 区块」。前端不重复实现覆盖计算,以后端返回为准(SSE done 事件附 coverage 摘要,见 4)。

## 4. API 契约变化

- `POST /projects/:id/recipe-version`、`POST /html-versions/:id/recompute` 响应不变(reportContent 内多 `dataCoverage`,前端消费)。
- AI 生成 SSE 流(done 事件)增可选字段 `dataCoverage`(摘要),前端用于 toast。非破坏性增量。
- `POST /generate`(非流式)响应同理附 `dataCoverage`。

## 5. 清理

- 删除 `apps/server/prisma/seed-cps-daily.ts`。
- mapper/ai-service 中 analytics 数字字段读取处标 `@deprecated` 注释,防止回潮。
- 更新相关记忆(`recipe-two-data-channels` 等)反映单路径。

## 6. 测试

- **coverage.ts(新)**:全覆盖/部分覆盖/零交集/无 daily/半开区间/无区间边界 → 各断言 covered/missingDays/complete。
- **mapper**:分支 1(部分覆盖出数+dataCoverage 正确)、分支 2(无 daily → 空态卡,不读 analytics)、分支 3(无周期+缺 metrics → Metric unavailable,不渲染 0);快照断言空态卡文案。
- **ai-generate.service**:有周期+daily → prompt 不含 analytics 数字字段;零覆盖 → 无数字维度+附 dataCoverage;无周期 → dataGaps 正确;SYSTEM_PROMPT 含新规则(字符串断言)。
- **模板 render**:dataCoverage 提示条渲染快照(complete 时无条)。
- **DataPanel**:mock recompute 响应含三种 coverage 形状 → 红/黄/无提示条断言。

## 7. 边界与已知取舍

- **汇总口径与 daily 口径可能不一致**(CPS 顶层汇总列 vs daily 累加):两口径都是真实数据,来源不同;首次生成(无周期)用汇总、重算(有周期)用 daily,header/coverage 让口径可见。不强行调和(不改历史导入数据)。
- **无 daily 的老 campaign** 首次生成将看到大量空态——这是诚实呈现,替代原先的过期假数;引导文案指向真实导入接口。
- AI 模式规则依赖模型遵从(非代码强制);data-field 渲染引擎/快照替换等确定性路径不受影响。
