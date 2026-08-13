# recipe 报告 Insight & Analysis 四维度数据补齐

- 日期:2026-08-13
- 状态:设计已批准,待实现
- 范围:recipe 模式 HTML 报告(recipe/campaign-report)

## 背景与问题

recipe 模式报告的 "Insight & Analysis" 区块(`partials/_insights.hbs`)设计有 5 张数据卡:

1. Top-Selling Categories(品类饼图)
2. Top-Selling Products(产品收入表)
3. Top Market(市场条形图)
4. Top Promotion Offer(促销表)
5. New Customer Rate(新客率)

当前只有第 5 张(新客率)有内容,前 4 张恒空。

根因(两层):

- **数据层**:产品/品类/市场/促销这 4 个维度在整个系统没有数据源。
  - 数据管控表(Prisma)无相关表/字段。
  - `CpsPerformance` 只有 clicks/orders/gmv/spend/commission/daily,无维度列。
  - 前端 analytics blob(`getCampaignAnalytics`)只产 trend/weeklyTrend/customerSplit/insights(文本洞察)。
  - 计划中的 `products.ts` 商品引擎从未实现,且其原料 `campaignRawTotals` 也只是 campaign 级总量。
- **代码层**:recipe mapper(`mapper.ts` mapFromDaily / 汇总分支)派生 `insights` 时只算 newCustomerRate,不映射另 4 个维度。
  - `schema.ts:27-32` 早已定义 4 维度 optional,`_insights.hbs` 已有 `{{#if}}` 守卫,但数据链路断裂。

## 目标

让 recipe 报告的 4 张维度卡显示真实数据,数据全部来自数据管控表(`CpsPerformance`),并支持 reportPeriod 换周期重算。

## 决策记录(brainstorming 澄清结果)

| 决策点 | 选择 |
|---|---|
| 修复方向 | 补数据源 + 完整映射(非隐藏空卡) |
| 数据来源约束 | 从数据管控相关表获取或构建 |
| 数据形式 | CPS 链接打维度标签后聚合 |
| 打标粒度 | CPS 链接级(CpsPerformance 加维度列) |
| 值存储 | 字符串列(自由文本),不建主数据表 |
| 实施范围 | 只补 recipe 闭环,AI 模式不动 |

## 数据模型

`CpsPerformance` 加 5 个可选维度列(链接级,一条跟踪链接一组维度):

- `productName String?`
- `category String?`
- `market String?`
- `promoName String?`
- `promoType String?`

映射到 4 张卡:`category`→topCategories、`productName`→topProducts、`market`→topMarket、(`promoName`+`promoType`)→topPromotion。

migration:手写 `ALTER TABLE cps_performance ADD COLUMN ...`(dev DB 跑不了 `migrate dev`,沿用现有手写 SQL + `migrate deploy` 流程)。不加索引(聚合是按 campaign 全表扫,数据量小)。

## 录入改动(数据管控 import 链路)

- `campaigns.schema.ts`:CPS import item schema 加 5 个 `z.string().optional()`
- `campaigns.service.ts` `importCpsPerformance`:从 item 读 5 字段(空→null),写进 upsert 的 create/update
- `dataImport.ts`:`CPS_FIELDS` 加 5 列 + CSV 模板示例值
- 前端 `ImportPreviewModal`:跟随 `CPS_FIELDS`(实现时核对是否硬编码列)

## 聚合逻辑

新增纯函数 `aggregateDimensions(campaignCreators, gmvOfCc)`,两条路径共用:

- `mapFromDaily`(reportPeriod + hasDaily):传「期内 daily gmv」(切 reportPeriod)
- 汇总分支(else):传「链接 `cpsPerformance.gmv`」(不切日期)

聚合规则:

- **topCategories**:按 `category` group sum gmv → `[{label, pct=gmv/总·100, color}]`
- **topProducts**:按 `productName` group sum gmv,降序取前 5 → `[{name, revenue=formatMoney}]`
- **topMarket**:按 `market` group sum gmv → `[{country, revenue, pct, color}]`
- **topPromotion**:按 `promoName` group,sum gmv + sum orders(=usage)+ 取 `promoType` → `[{name, type, revenue, usage=formatNum(orders), tagKind=mapTagKind(promoType)}]`
- **color**:固定调色板按值降序分配(`brandPrimary` 打头),不足循环复用
- **tagKind**:`promoType` → 模板 `tag-xxx` 类(实现时核对 `_insights.hbs` CSS 定义)
- **usage 语义**:促销使用次数 = 该促销组链接的 orders 之和

## 渐进降级

`schema.ts` 这 4 维度早已 optional,`_insights.hbs` 早有 `{{#if}}` 守卫。某维度全空 → mapper 返回 `undefined` → 该卡自动隐藏。所以:全打标=5 张卡;部分打标=打标的+新客率;全不打标=只新客率(=现状)。模板/schema 零改动。

## 错误处理

- 录入:维度空/非法 → null,不阻塞(`importCpsPerformance` 现有 try/catch 保留)
- 聚合:总 gmv=0 → pct=0(除零保护);链接无 daily 或 gmv=0 → 跳过;调色板长度 < 值数量 → 循环复用

## 测试(TDD,先红后绿)

- `mapper.test.ts`:4 维度各自聚合正确、reportPeriod 切片、promo usage=orders + tagKind 映射、空维度→undefined 降级、除零保护、两条路径(mapFromDaily + 汇总)都覆盖
- `campaigns.service.test.ts`:导入带维度字段 → 落库到 CpsPerformance 列

## 不做(YAGNI)

- AI 模式补强(`buildCampaignContext` 仍读 analytics blob,topProducts/topMarkets 恒 null)
- 主数据表(Product / Category / Market / Promotion)
- 订单级粒度

## 验收标准

1. `CpsPerformance` 有 5 个新维度列,migration 在 dev DB 跑通(`migrate deploy`)
2. CPS 导入(CSV/JSON)能带这 5 个维度字段并落库
3. recipe mapper 对打标数据正确聚合出 4 维度,随 reportPeriod 重算
4. 4 张卡在数据齐全时显示、部分时按 `{{#if}}` 降级、全空时回退到只新客率
5. `mapper.test.ts` / `campaigns.service.test.ts` 全绿,server `tsc --noEmit` clean

## 关键文件

- `apps/server/prisma/schema.prisma`(CpsPerformance 模型)
- `apps/server/prisma/migrations/`(新 migration SQL)
- `apps/server/src/modules/campaigns/campaigns.service.ts`(`importCpsPerformance`)
- `apps/server/src/modules/campaigns/campaigns.schema.ts`
- `apps/web/src/editor/dataImport.ts`(`CPS_FIELDS`)
- `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.ts`(`aggregateDimensions`)
- `apps/server/src/modules/html-templates/recipe/campaign-report/mapper.test.ts`
- `apps/server/src/modules/campaigns/campaigns.service.test.ts`
