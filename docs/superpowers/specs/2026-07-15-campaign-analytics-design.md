# Campaign 分析数据（大盘趋势 + 新老客 + 洞察引擎） — 设计

- 日期：2026-07-15
- 状态：已批准（待写实现计划）
- 范围：`packages/shared/src/types/campaign.ts`、`apps/web/src/api/mock/`（新文件 + affiliate/creatorPerformance）、`apps/server/src/modules/data/data.schema.ts`、`apps/web/src/editor/components/DataConfigOverlay.tsx` 及相邻测试

## 1. 背景

报告导出的 `ReportDataContext` 缺三个分析维度（用户反馈）：

1. **Campaign 大盘时间线**：只有单达人单版位的粗粒度 `[W1..W6]` 假斜坡（`creatorPerformance.ts` 的 `trendPoints`），缺整个 campaign 每日/每周 GMV+ROAS 的确切序列。
2. **洞察与行动建议**：数据全是裸数字，缺预计算结论（如「高流量低转化」「最佳版位」「ROAS 预警」）与行动清单。
3. **新老客占比**：缺 campaign 级 New vs Returning。

**关键架构事实**：分析数据其实大部分**已存在**于 mock 上游生成器（`affiliate.ts`），只是从未进 `ReportDataContext`、也未进 DataManagement 持久层：

- `getRevenueTimeline(campaignId, days=31)`（`affiliate.ts:466`）已返回每日 `{date, revenue, spend, commission, orders}`（数字）→ 每日 ROAS = revenue/spend 可直接算。
- `getCampaignSummary(campaignId)`（`affiliate.ts:336`）返回的 `CampaignSummary` 已带 `newCustomers/returningCustomers/newCustomerRate`（`campaign.ts:347-354`）。
- 洞察的**原料**齐全：`CreatorCps`（`gmv/cvr/roas/clicks`，`campaign.ts:230`）、`PlacementTypeSummary`（`revenue/revenueShare/cvr/roas`，`campaign.ts:286`）、`roasStatus(roas)`（good≥3 / warn≥2 / bad<2，`affiliate.ts:128`）。

DataManagement 持久层（`DataRecord { kind, data: Json }`，`campaignRecordDataSchema` `data.schema.ts:21`）目前只存 campaign **身份/花名册**（id/name/advertiser/.../metrics/creatorIds），无任何分析字段。

## 2. 目标

把「大盘趋势 + 新老客 + 结构化洞察」作为 **`CampaignAnalytics`** 数据包：① 接到 `ReportCampaign`（→ 自动进 `ReportDataContext` 与导出）；② 写进 `campaignRecordDataSchema`（→ 可随 campaign 导入/导出/持久化，即「进数据管理」）。其中趋势/新老客**搬运已有生成器**，洞察引擎为**新推导逻辑**。

## 3. 关键决策（评审已定）

| 决策点 | 结论 | 理由 |
|---|---|---|
| 加法机制 | 扩 Campaign 模型 + `campaignRecordDataSchema`，加可选 `analytics?`，由确定性生成器填充 | 用户确认；1:1 随 campaign，免新增 kind/迁移；出现在 ReportContext/导出且可导入导出 |
| 洞察类型 | 5 类：`high-traffic-low-cvr` / `scale-opportunity` / `best-placement` / `best-creator` / `roas-warning` | 用户确认全做 |
| 趋势粒度 | 每日（trend）+ 每周 rollup（weeklyTrend） | 日序列已有；周聚合是滚动求和 |
| 同步性 | 生成器**同步**（避免 selectCampaign 异步改造） | 必要时为 mock 数据补 sync getter |
| DataManagement UI | 不新增 tab（本期只让 analytics 进记录 schema + ReportContext/导出） | 控制范围；UI 展示留后续 |

## 4. 不在本次范围

- ❌ **买家画像**（购买者性别/年龄/城市）——无数据源、不可从粉丝画像推导，属 P2 独立工作。
- ❌ **素材文案风格分析 / 行动清单编辑**（Testimonial 等 taxonomy）——偏编辑性，P3。
- ❌ **DataManagement 新 UI/tab 展示 analytics**——schema 允许即可，展示留后续。
- ❌ 改 `getRevenueTimeline` 现有签名/编辑器 `revenue-timeline` 组件接线（`pageBinding.ts:136` 截断 14 天保持不动）——本期只在 campaign analytics 包里用全量序列。

## 5. 方案

### Part A · 数据模型（`packages/shared/src/types/campaign.ts` 新增）

```ts
/** Campaign 大盘每日趋势（GMV + spend → ROAS）。 */
export interface CampaignTrendPoint {
  date: string;        // ISO 日期
  revenue: number;     // GMV
  spend: number;
  commission: number;
  orders: number;
  roas: number;        // revenue / spend
}

/** 每周 rollup 趋势点。 */
export interface CampaignWeeklyTrendPoint {
  week: string;        // 'W1' / 'W2' ...
  start: string;       // 该周起始 ISO 日期
  revenue: number;
  spend: number;
  orders: number;
  roas: number;
}

export type InsightKind =
  | 'high-traffic-low-cvr'
  | 'scale-opportunity'
  | 'best-placement'
  | 'best-creator'
  | 'roas-warning';
export type InsightSeverity = 'good' | 'warn' | 'opportunity';

/** 洞察对象范围。 */
export type InsightSubject = 'campaign' | 'creator' | 'placement';

export interface CampaignInsight {
  kind: InsightKind;
  severity: InsightSeverity;
  subjectType: InsightSubject;
  subjectId?: string;
  subjectName: string;
  metrics: { label: string; value: string }[]; // 关键指标快照
  rationale: string;   // 一句话结论依据
  action: string;      // 下一步行动建议
}

/** Campaign 分析包。 */
export interface CampaignAnalytics {
  trend: CampaignTrendPoint[];
  weeklyTrend: CampaignWeeklyTrendPoint[];
  customerSplit?: { newCustomers: number; returningCustomers: number; newCustomerRate: string };
  insights: CampaignInsight[];
}
```

`ReportCampaign`（`campaign.ts:144`）与 `Campaign`（`campaign.ts:37`）各加可选字段：

```ts
analytics?: CampaignAnalytics;
```

### Part B · 生成器（新文件 `apps/web/src/api/mock/campaignAnalytics.ts`）

**B.1 必要的 sync getter**（`creatorPerformance.ts` 新增，旁路现有 250ms 异步包装，直接返回 clone）：

```ts
export function getCreatorPerformances(campaignId: string): CreatorCampaignPerformance[] {
  return clone(MOCK_PERFORMANCE[campaignId] ?? []);
}
export function getPlacementTypeSummaries(campaignId: string): PlacementTypeSummary[] {
  return clone(MOCK_PLACEMENT_SUMMARY[campaignId] ?? []);
}
```

**B.2 `rollupWeekly(trend)`**：按 7 天滚动分桶（首桶对齐 trend[0].date），桶内 `Σ revenue/spend/orders`，`roas = Σrevenue / Σspend`，`week = 'W' + (i+1)`，`start = 桶首日期`。

**B.3 `getCampaignInsights(campaignId): CampaignInsight[]`**（纯推导，详见 Part C）。

**B.4 `getCampaignAnalytics(campaignId): CampaignAnalytics`**（组合）：

```ts
export function getCampaignAnalytics(campaignId: string): CampaignAnalytics {
  const raw = getRevenueTimeline(campaignId);          // RevenueTimelinePoint[]（数字）
  const trend: CampaignTrendPoint[] = raw.map((p) => ({
    date: p.date, revenue: p.revenue, spend: p.spend,
    commission: p.commission, orders: p.orders,
    roas: p.spend > 0 ? round2(p.revenue / p.spend) : 0,
  }));
  const summary = getCampaignSummary(campaignId);
  return {
    trend,
    weeklyTrend: rollupWeekly(trend),
    customerSplit: summary.newCustomerRate
      ? { newCustomers: summary.newCustomers, returningCustomers: summary.returningCustomers, newCustomerRate: summary.newCustomerRate }
      : undefined,
    insights: getCampaignInsights(campaignId),
  };
}
```

全部确定性（沿用 `hashStr`/jitter 模式）；`trend.revenue` 之和与 campaign GMV 同量级（与 `rollupCampaignMetrics` 自洽）。

### Part C · 洞察推导规则（`getCampaignInsights`，阈值可调）

读 `getCreatorPerformances(campaignId)` 与 `getPlacementTypeSummaries(campaignId)`。字符串数值用 `parseNum`（去 `$ , %` 后 parseFloat）。

| kind | severity | 触发（从已有字段算） | metrics 快照 | action |
|---|---|---|---|---|
| `best-creator` | good | `parseNum(cps.gmv)` 最大者 | GMV / ROAS / Orders | 「加大该达人预算、复用其内容模板」 |
| `best-placement` | good | `parseNum(revenue)` 最大的 placement 类型 | Revenue / RevenueShare / ROAS | 「向该版位倾斜投放」 |
| `high-traffic-low-cvr` | warn | 达人 `summary.totalImpressions` 进入 top 30% **且** `parseNum(cps.cvr) < 2`（%） | Impressions / CVR / GMV | 「优化落地页与素材承接，提升转化」 |
| `roas-warning` | warn | 任一 placement `parseNum(roas) < 2`（即 `roasStatus==='bad'`） | ROAS / Revenue / RevenueShare | 「压降低效版位、调整出价」 |
| `scale-opportunity` | opportunity | placement `parseNum(roas) > 中位` **且** `parseNum(revenueShare) < 15`（%） | ROAS / RevenueShare / Revenue | 「扩量该高效版位」 |

- 每个 kind 至多产出 1 条（取最极端者），保证洞察精炼。
- 无异常时也至少产出 `best-creator` + `best-placement`（恒有）。
- `rationale` 用模板字符串拼装（含具体数值），如 `"Mia Chen 带来 $192,000 GMV，为全场最高。"`。

### Part D · schema + 接线

**D.1 服务端 schema**（`apps/server/src/modules/data/data.schema.ts`）— 在 `campaignRecordDataSchema` 加可选 `analytics`：

```ts
const campaignTrendPointSchema = z.object({
  date: z.string(), revenue: z.number(), spend: z.number(),
  commission: z.number(), orders: z.number(), roas: z.number(),
});
const campaignWeeklyTrendPointSchema = z.object({
  week: z.string(), start: z.string(), revenue: z.number(),
  spend: z.number(), orders: z.number(), roas: z.number(),
});
const campaignInsightSchema = z.object({
  kind: z.string(), severity: z.string(), subjectType: z.string(),
  subjectId: z.string().optional(), subjectName: z.string(),
  metrics: z.array(z.object({ label: z.string(), value: z.string() })),
  rationale: z.string(), action: z.string(),
});
const campaignAnalyticsSchema = z.object({
  trend: z.array(campaignTrendPointSchema),
  weeklyTrend: z.array(campaignWeeklyTrendPointSchema),
  customerSplit: z.object({
    newCustomers: z.number(), returningCustomers: z.number(), newCustomerRate: z.string(),
  }).optional(),
  insights: z.array(campaignInsightSchema),
});
// campaignRecordDataSchema 末尾加：
analytics: campaignAnalyticsSchema.optional(),
```

**D.2 接线 ReportContext**（`apps/web/src/editor/components/DataConfigOverlay.tsx` 的 `selectCampaign`，约 `:112-127`）— 构建 `ReportCampaign` 时填 analytics：

```ts
import { getCampaignAnalytics } from '@/api/mock/campaignAnalytics';
// ...
const rc: ReportCampaign = { /* 现有字段... */ };
setReportData({ ...reportData, campaign: { ...rc, analytics: getCampaignAnalytics(c.id) }, campaignCreators: [] });
```

> 编辑器消费 analytics 留后续（本期只让数据到位 + 进导出）；接线只确保选 campaign 时填充。

## 6. 涉及文件

- `packages/shared/src/types/campaign.ts` — 新增 `CampaignAnalytics` 等 4 接口 + 2 类型别名；`Campaign`/`ReportCampaign` 加 `analytics?`。
- `apps/web/src/api/mock/campaignAnalytics.ts`（新）— `getCampaignAnalytics` / `getCampaignInsights` / `rollupWeekly`。
- `apps/web/src/api/mock/creatorPerformance.ts` — 新增 sync `getCreatorPerformances` / `getPlacementTypeSummaries`。
- `apps/server/src/modules/data/data.schema.ts` — `campaignRecordDataSchema` 加 `analytics?`（+ 子 schema）。
- `apps/web/src/editor/components/DataConfigOverlay.tsx` — `selectCampaign` 填 analytics。
- 测试：`apps/web/tests/campaign-analytics.test.ts`（新）、`apps/server/tests/data.schema.test.ts`（或就近）。

## 7. 兼容性

- `analytics?` 全部可选 + 加法字段；旧 Campaign 记录/旧 `ReportCampaign` 不受影响。
- 不改 `getRevenueTimeline` / `getCampaignSummary` / `revenue-timeline` 组件现有行为。
- 服务端 schema 加法；无 Prisma 迁移（仍是 `data` JSON blob）。
- sync getter 与现有 async `list*` 并存，互不影响。

## 8. 风险

- **阈值主观**：cvr<2% / roas<2.0 / share<15% / top 30% 为初版经验值，需可调（集中常量）。mock 数据下 `roas-warning`/`scale-opportunity` 是否触发取决于生成值——若 mock 普遍高 ROAS，`roas-warning` 可能不触发，测试需构造 fixture 或断言「无 warn 时仍有 best-*」。
- **同步 getter 暴露 MOCK 内部**：`getCreatorPerformances`/`getPlacementTypeSummaries` 直接 clone 内部 map，等于公开 mock 结构；可接受（mock 本就是 demo 数据层）。
- **导出体积**：trend（~28-31 点）+ insights 进 ReportContext 后导出 JSON 变大；可接受。

## 9. 测试策略

生成器为纯数据函数，无需 recharts mock（遵循 web-chart-test 约定只断言数据形状/数值）。

- **getCampaignAnalytics**：`camp-glowlab-q4` 返回 `trend.length` ≥ 28、`weeklyTrend` 各点 `roas = round2(revenue/spend)`、`customerSplit` 三字段齐全、`insights` 至少含 `best-creator`+`best-placement`；`Σ trend.revenue` 与 `getCampaignSummary`/campaign GMV 同量级（±容差）；确定性（同 id 两次调用 deep-equal）。
- **rollupWeekly**：给定 14 天 fixture → 2 个周点，桶内求和正确。
- **getCampaignInsights**：构造高曝光低 cvr 的 creator 性能 fixture → 产出 `high-traffic-low-cvr`（severity warn、subjectType creator）；`best-creator.subjectId` == gmv 最大者 id；无低 roas 时不出 `roas-warning`。
- **schema round-trip**：`campaignRecordDataSchema.parse({...campaign, analytics})` 保留 analytics；无 analytics 的旧记录仍通过。
