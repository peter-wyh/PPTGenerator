# CPS 每日明细补「花费 + 新客」字段 — 设计

- **日期**: 2026-08-07
- **状态**: 设计已确认,待评审 → 转 writing-plans
- **范围**: 「调报告时间段→快速重生成」整体方案的数据层(子项目 2,先行)
- **后续**: 子项目 1(报告层按 reportPeriod 重算),单独 spec

## 背景

报告生成支持按 `reportPeriod`(报告实际时间段)重新计算数据,但 `CpsDaily`(CPS 每日明细,创作者/内容类型/日粒度)目前只有 `clicks / impressions / orders / gmv / commission`,**缺 `spend`(花费)和 `newCustomers`(新客)**。

这两个指标当前**只有汇总、没有每日明细**:
- `spend` 只有 `CpsPerformance.spend` 汇总(走 `/import/cps`)。
- `newCustomers` 只有 `campaign.metrics.newCustomers` 汇总(裸 JSON)。

没有每日明细 → 无法按时间段切片重算 → 「调时间后重生成」时这两个 KPI 永远是全周期值。本设计给 `CpsDaily` 补这两个每日字段并打通导入,作为报告层按时间段重算的数据基础。

## 目标 / 非目标

**目标**: `CpsDaily` 增加 `spend` + `newCustomers` 两个每日字段,并打通 `/import/cps-daily` 导入 + 导入 UI,使后续报告层能按 reportPeriod 对它们求和。

**非目标**:
- 不改报告生成/渲染逻辑(子项目 1)。
- 不改 Prisma schema(`daily` 是 Json,无需迁移)。
- 不动现有汇总字段(`CpsPerformance.spend`、`campaign.metrics.newCustomers`)—— 每日是并行的更细粒度源,汇总保留。
- 不改其它导入种类(creators / audience / works / collaboration-daily / cps 汇总)。

**边界提示**:本项目是纯数据层增量 —— 在子项目 1(报告层)落地前,**没有任何代码消费**这两个新字段,单独上线**不产生用户可见变化**,只是为子项目 1 备好每日数据。(按用户决策「先数据层」接受此权衡。)

## 数据模型

`CpsPerformance.daily` 是 JSON 数组(`Prisma` 字段类型 `Json?`),每条记录**无正式 TS 类型**(代码按 `Record<string, unknown>` 处理)。形状:

```
现:  { date, clicks, impressions, orders, gmv, commission }   // 值为字符串
新增: + spend?, newCustomers?                                   // 可选,字符串,同模式
```

- 字符串值(与现有 `gmv`/`commission` 一致),消费方读取时 `Number()` 转。
- 可选:旧记录无这两个键 → 读取时 `undefined`/当 0,**向后兼容**。
- **无 Prisma 迁移**。
- **每日 = 时间段过滤的事实源(source of truth)**:汇总字段(`CpsPerformance.spend`、`campaign.metrics.newCustomers`)是旧/全周期值,与每日独立导入、可能不一致。子项目 1 按 reportPeriod 重算时**一律以每日求和为准**,汇总仅在「无每日数据」时回退。

## 改动点

### 1. 导入服务 `importCpsDaily`
**文件**: `apps/server/src/modules/campaigns/campaigns.service.ts`(方法起始 ~line 525)

照搬现有 `dailyGmv` / `dailyCommission` 的处理模式,在每日记录合并时新增两键:
- 收 `dailySpend` → `spend`(去前导 `$`,存字符串,同 `dailyGmv` 的 `replace(/^[$]/, '')`)。
- 收 `dailyNewCustomers` → `newCustomers`(存字符串)。

按 `date` 去重 merge 的主逻辑不变,每条记录只是多两个可选键。

路由 `POST /api/v1/campaigns/import/cps-daily` **无 `validate()` 中间件**、items 是裸 `req.body.items`(`campaigns.controller.ts:151`)→ **不动路由、不动 Zod schema**。

### 2. 导入 UI 字段定义
**文件**: `apps/web/src/editor/dataImport.ts`(仅此文件)

- `CPS_DAILY_FIELDS`(line 85):末尾加 `'dailySpend', 'dailyNewCustomers'`。控制解析时提取哪些列。
- `PREVIEW_COLUMNS.cpsDaily`(line 133):末尾加 `'dailySpend', 'dailyNewCustomers'`。控制预览表头列。
- `CPS_DAILY_REQUIRED`(line 90)**不动**——这两个保持非必填(与 `gmv`/`commission` 一致)。

`apps/web/src/editor/components/ImportPreviewModal.tsx` 数据驱动渲染(`const columns = PREVIEW_COLUMNS[kind]` → `columns.map`),改 `PREVIEW_COLUMNS` 即自动多两列,**无需单独改组件**。

### 3. 不动的部分
- `CpsPerformance.spend` 汇总(仍走 `/import/cps`)。
- `campaign.metrics.newCustomers` 汇总。
- 现有报告渲染、现有各类导入行为。
- `CpsDaily` 现有字段(`clicks/impressions/orders/gmv/commission`)的语义与来源。

## 测试

`importCpsDaily` 目前**无单测**(整个 campaigns 模块当前**无任何单测**)。新增测试 —— **新建** `apps/server/src/modules/campaigns/campaigns.service.test.ts`(首个):
- 带 `dailySpend` + `dailyNewCustomers` 的 item → 落库的 daily 记录含 `spend` + `newCustomers`。
- 不带这两个字段的 item → daily 记录**不含**这两个键(不留空键)、不报错(向后兼容)。
- `dailySpend` 带 `$` 前缀 → 剥离后存(与 `dailyGmv` 同行为)。
- 同 `(campaignId, creatorId, contentType, date)` 的多次导入按 date merge(不覆盖其它字段)。

## 决策记录

- **新客每日粒度 = 创作者/内容类型/日**(放 `CpsDaily`,与花费同源),非投放级 analytics 时序。理由:用户确认新客按 CPS 链路/创作者归因。
- **先做数据层(本项目),再做报告层(子项目 1)**。理由:报告层用现有每日数据已可独立跑;数据层补完后报告层自动受益。
- **不引入正式 `CpsDaily` TS 类型**——保持与现状一致的 untyped JSON,避免越界重构。

## 向前衔接:子项目 1(后续 spec,不影响本项目)

报告层 `mapCampaign`(recipe 渲染)将按 `reportPeriod` 对 `CpsPerformance.daily`(含新增 `spend`/`newCustomers`)按日期切片求和,使花费/ROAS/新客可按时间段重算。同时串通 `controller → render → mapCampaign` 的 `reportPeriod` 透传(顺带修 recipe 模式当前丢 reportPeriod 的 bug)。

⚠️ **子项目 1 的已知风险**(本项目不涉及):非周期报告当前用 `campaign.metrics`/`CpsPerformance` 汇总字段;子项目 1 改成「从每日派生」后,若每日求和与汇总对不上,报告数字可能变化。属子项目 1 范围,届时处理。
