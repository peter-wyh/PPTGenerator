# PSD 报告 A 类 gap 补齐 — recipe MoM/CVR/AOV + Creator Contribution prompt

- 日期:2026-08-14
- 状态:设计已批准(Approach 1),待实现
- 范围:recipe(campaign-report)+ AI prompt(ai-generate.service)
- 关联:Obsidian「报告数据gap分析-PSD_Performance_Report-20260814」、recipe Insight 四维度(2026-08-14 已完成)

## 背景与问题

PSD × DIGCHIC Performance Report(July 2026)暴露 **A 类 gap**(数据管理已有,可直接做):

- **CVR / AOV**:KPI 派生,recipe kpis 应有(确认/补齐)。PSD 报告 CVR 2.55%、AOV $87.35。
- **MoM 月环比**:报告核心指标(orders +276.8%、sales +298.9%),recipe 完全没有。
- **Creator Contribution**:每达人归因叙事(content role / why converted),是 AI 文案,当前 prompt 无引导。

B 类 gap(Multi-item baskets / Qty / Premium Placement)需订单级 + 站内版位数据源,后置。

## 目标

recipe 报告补齐 A 类:MoM 月环比组件 + CVR/AOV 派生 KPI + Creator Contribution AI 归因叙事。数据全有(`CpsPerformance.daily` / clicks / orders / gmv / `Creator` / `Collaboration.deliverables`),不需补数据。

## 决策记录(brainstorming)

| 决策点 | 选择 |
|---|---|
| 方案 | Approach 1:recipe 派生组件 + AI prompt(非全 recipe / 非 全 AI) |
| MoM 语义 | `reportPeriod` vs **前等长期间**(通用;PSD "自然月 July vs June" 是 reportPeriod=自然月时的特例) |
| Creator Contribution | **AI prompt**(buildCampaignContext + SYSTEM_PROMPT 模板),非 recipe narrative(因 "why converted" 是文案) |
| B 类 | 后置(需订单级 + 站内版位数据源) |

## 组件设计

### 1. CVR + AOV 派生 KPI(recipe,trivial)

`mapFromDaily` 和汇总分支的 `kpis` 数组,在现有 KPI(Revenues/Clicks/Orders/NewCust/AOV/ROAS)基础上:
- `CVR = orders / clicks × 100`(PSD 2.55%)
- `AOV = gmv / orders`(PSD $87.35;mapper 已算 aov,确认进 kpis 数组)
- 除零:clicks=0 → CVR 0;orders=0 → AOV 0

### 2. MoM 月环比组件(recipe,中等)

- **前等长期间计算**:`reportPeriod = [start, end]`(含,天数 `len = end - start + 1`)。`prePeriod = [start - len, start - 1]`(同天数,紧邻 reportPeriod 之前)。例:reportPeriod 8/1–8/11(11 天)→ prePeriod 7/21–7/31(11 天)。
- **实现**:daily 全在内存(`campaign.campaignCreators.cpsPerformances.daily`),mapper **不需新 DB 查询**,只加一段过滤逻辑 —— 算 prePeriod 内的 orders/gmv,对比 reportPeriod 算 `% 变化`。
- **产出**:
  ```ts
  insights.mom = {
    ordersMoM: '+276.8%',     // (cur-prev)/prev × 100,带正负号
    salesMoM: '+298.9%',
    currentOrders, previousOrders,
    currentSales, previousSales,
  }
  ```
- `schema.ts` 的 `insights` 加 `mom` optional;新增 `partials/_mom.hbs` 或并入 KPI 区显示 MoM %;template.hbs `{{#if insights.mom}}` 守卫。
- **降级**:前等长期间无 daily(新 campaign 或 daily 不覆盖 prePeriod)→ `previousOrders/previousSales = 0` → MoM 算不出有意义的 %(分母 0)→ 返回 undefined,组件隐藏。

### 3. Creator Contribution 归因叙事(AI prompt,中等)

`ai-generate.service.ts` 的 SYSTEM_PROMPT 加 **Creator Contribution 模板引导**:
- 给 AI 每个达人的 `allocated orders`(`CpsPerformance.orders`)+ `Creator` 定位(category / follower)+ `Collaboration.deliverables`(内容形式/素材)
- 让 AI 写 "content role + why converted" 叙事(PSD 报告风格:达人定位 → 内容形式 → 为何转化)
- buildCampaignContext 已传 creators 数据(含 cps / performance / deliverables),**纯 prompt 改动,不改数据层**

## 数据流

- **CVR/AOV**:`mapFromDaily` / 汇总 → `kpis` → template KPI 区
- **MoM**:`mapFromDaily` → `insights.mom` → template MoM 组件
- **Contribution**:`buildCampaignContext`(creators)→ SYSTEM_PROMPT 引导 → AI 写 narrative

## 错误处理

- CVR/AOV 除零 → 0(不 NaN)
- MoM 前等长无 daily / previousOrders=0 → mom undefined,组件 `{{#if}}` 隐藏
- Contribution:AI 失败/降级 → 无 narrative,不影响其他模块(报告其余部分仍渲染)

## 测试(TDD)

- `mapper.test.ts`:
  - CVR/AOV 派生正确(orders/clicks、gmv/orders)+ 除零(clicks=0 / orders=0)
  - MoM:reportPeriod vs 前等长计算(prePeriod 正确)+ % 变化 + previousOrders=0 → mom undefined 降级
- AI prompt 改动:确认现有 ai-generate.service.test.ts 不破坏(prompt 加模板,buildCampaignContext 不变)

## 不做(YAGNI)

B 类(需数据源,后置):Multi-item baskets(订单级 item)、Qty(件数)、Premium Placement(站内版位)。

## 验收标准

1. recipe KPI 含 CVR + AOV(派生,除零安全)
2. recipe `insights.mom` 正确(前等长 vs reportPeriod,% 变化,无 pre 数据降级)
3. AI 报告 Creator Contribution 有归因叙事(SYSTEM_PROMPT 模板引导)
4. `mapper.test.ts` 全绿,server `tsc --noEmit` clean

## 关键文件

- `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.ts`(CVR/AOV kpis + MoM 计算)
- `apps/server/src/modules/html-templates/recipe/campaign-report/schema.ts`(`mom` optional)
- `apps/server/src/modules/html-templates/recipe/campaign-report/partials/_mom.hbs` 或 `template.hbs`(MoM 组件)
- `apps/server/src/modules/html-templates/recipe/campaign-report/manifest.ts`(注册 mom 组件,如用 partial)
- `apps/server/src/modules/html-templates/ai-generate.service.ts`(SYSTEM_PROMPT Contribution 模板)
- `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.test.ts`
