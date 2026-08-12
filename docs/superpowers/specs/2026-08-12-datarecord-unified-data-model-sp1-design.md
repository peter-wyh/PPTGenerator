# DataRecord 统一数据模型 — SP1 设计

- **日期**: 2026-08-12
- **状态**: 设计已确认,待评审 → 转 writing-plans
- **范围**: 把 HTML 报告所需的「per-creator 每日业绩」纳入数据管理模块(`DataRecord`)的数据模型,作为「全面统一到 DataRecord」的第一步(数据模型层)。

## 背景

当前两套数据消费路径不对账:

| 消费方 | 读源 |
|---|---|
| PPT 编辑器(`pageBinding.ts`) | `DataRecord`(数据管理模块) |
| HTML 报告(recipe / AI) | `Campaign.analytics`(opaque JSON blob)+ `CpsPerformance` 表 |

报告完全没读 `DataRecord`。用户原则:**所有数据建立在数据管理模块,且存储在数据库中** → 全面统一到 `DataRecord`,报告与 PPT 共享单一数据源。

该目标过大,拆成 5 个子项目:**SP1 数据模型(本 spec)→ SP2 数据入口 → SP3 recipe 读 DataRecord → SP4 AI 读 DataRecord → SP5 存量搬迁 + 下线**。本 spec 只覆盖 SP1。

### 现状关键事实(已勘查)
- `DataRecord(CAMPAIGN)` 已有 6 条(每 campaign 一条),`DataRecord(CREATOR)` 12 条,`DataRecord(COLLABORATION)` **0 条**。
- `DataRecord(CAMPAIGN).data` 有 `metrics`(周期无关 KPI 卡片:GMV $1,167,992 等),但 **没有 `analytics.trend`**(`analyticsKeys: NULL`)。
- `Campaign.analytics`(blob)存 trend/summary/topProducts…;`CpsPerformance.daily` 存 per-creator 每日明细。两者数字与 `metrics` 卡片互不对账。

## 目标 / 非目标

**目标**:
1. `DataRecord(COLLABORATION)` 的 schema 能承载 per-contentType 每日业绩(daily),作为 per-creator 业绩的原子真现。
2. campaign 级 KPI/trend **统一从 COLLABORATION daily 派生**(决策 X),不再独立存储;`CAMPAIGN.analytics` 标 deprecated。
3. `DataRecord` 支持按 `(kind, campaignId)` 高效查 COLLABORATION(生成列 + 索引)。
4. 提供 Prisma 迁移 + Zod 校验 + 单测。

**非目标(SP1 明确不做)**:
- recipe / AI 改读 DataRecord → **SP3 / SP4**。
- 数据管理模块 import/CRUD 写入新字段 + DataManagement UI → **SP2**。
- PPT KPI 卡片改成周期派生 → **后续单独子项目**(SP1 不动 `CAMPAIGN.metrics`,PPT 继续读)。
- 存量 `CpsPerformance` / `Campaign.analytics` 搬进 DataRecord → **SP5**。
- `Campaign.analytics` blob 彻底下线(删读写入口)→ **SP5**。

## 关键决策(已确认)

1. **per-creator 业绩放 `DataRecord(COLLABORATION)`**(非 CAMPAIGN 内嵌、非 CREATOR)。契合既有 `collaborationRecordDataSchema`(已有 `campaignId`+`creatorId`+`deliverables`)与 DataManagement `/data/campaign-collabs`,且 PPT 编辑器已绑合作数据。
2. **campaign KPI/trend 统一从 daily 派生**(决策 X)。per-creator daily 是唯一原子真现;campaign 级一律按 reportPeriod 切片求和。现有点周期无关 KPI 卡片(`metrics`)与 X 冲突,SP1 不动卡片但 **recipe 不得读 `metrics`**,卡片周期化留给后续子项目。
3. **daily 放 `deliverable` 下**(contentType 粒度),与 `CpsPerformance` 的 `(campaignCreator, contentType)` 唯一键一一对应;一条合作多 contentType 各自独立 daily。
4. **canonical 字段名用 `gmv`**(对齐 `CpsPerformance`/recipe),不用 legacy `analytics.trend.revenue`。
5. **索引方案:MySQL 生成列 + 复合索引**(`(kind, scopeCampaignId)`),recipe 按 campaignId 查走索引。

## 改动

### 1. `apps/server/src/modules/data/data.schema.ts` — Zod 扩展

新增 CPS 每日点 schema(recipe 必需字段必填,其余 optional):

```ts
/** CPS 每日明细点(per-contentType)。recipe 按此切片求和派生 KPI/trend。 */
const cpsDailyPointSchema = z.object({
  date: z.string(),                 // 'YYYY-MM-DD'
  clicks: z.number(),
  orders: z.number(),
  gmv: z.number(),
  newCustomers: z.number(),
  spend: z.number(),
  impressions: z.number().optional(),
  commission: z.number().optional(),
});

/** deliverable 级 CPS 业绩。 */
const deliverablePerformanceSchema = z.object({
  daily: z.array(cpsDailyPointSchema),
});
```

`deliverableSchema` 加可选 `performance`:

```ts
const deliverableSchema = z.object({
  contentType: contentTypeSchema,
  postUrl: z.string().max(2048).optional(),
  contentFormat: z.string().max(64).optional(),
  screenshots: z.array(screenshotItemSchema).optional(),
  metrics: z.array(collaborationMetricSchema).optional(),
  audience: z.object({ ... }).optional(),
  wordcloud: z.array(wordItemSchema).optional(),
  performance: deliverablePerformanceSchema.optional(), // ★ 新增
});
```

`campaignRecordDataSchema.analytics` 标 deprecated(字段保留 optional,不破坏旧记录读取;SP5 下线):

```ts
/**
 * @deprecated SP1 后 campaign KPI/trend 统一从 DataRecord(COLLABORATION).deliverables[].performance.daily 派生。
 * 此字段仅保留用于读旧记录,recipe/AI 不得读。彻底下线见 SP5。
 */
analytics: campaignAnalyticsSchema.optional(),
```

### 2. `apps/server/prisma/schema.prisma` — DataRecord 加 scopeCampaignId 列 + 索引

用**普通列 + service 写入**(非 DB 生成列),规避 Prisma 对 generated column 的写入摩擦。`data.service.ts` 是 DataRecord 唯一写入入口(CRUD + import 都过它),COLLABORATION 写入时同步 `scopeCampaignId = data.campaignId`,零成本保一致。

```prisma
model DataRecord {
  /// id 由应用层生成(opaque),不使用 cuid() 默认值——便于导入按 id upsert 幂等。
  id        String          @id
  kind      DataRecordKind
  ownerId   String
  data      Json
  /// COLLABORATION 记录的 campaignId(便于按 campaign 查);其余 kind 为 null。
  /// 由 data.service 写入时同步,不可由外部直接赋值(非 DB 生成列)。
  scopeCampaignId String?
  owner     User            @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt

  @@index([kind])
  @@index([ownerId])
  @@index([kind, scopeCampaignId], map: "idx_data_kind_scope")
}
```
> 表名沿用手写大写 `DataRecord`(本模型无 `@@map`,DB 表即 `DataRecord`,与现状一致)。

### 3. `apps/server/src/modules/data/data.service.ts` — 写入时同步 scopeCampaignId

`create` / `update` / `importMany` 落库前,若 `kind === 'collaboration'`,从校验后的 `data.campaignId` 取值填 `scopeCampaignId`;否则置 `null`。封装一个小 helper(如 `scopeFor(kind, data)`)在三处复用。非 COLLABORATION kind 不填(查询只按 `kind='COLLABORATION'` 用此列)。

### 4. `apps/server/prisma/migrations/<ts>_datarecord_scope_campaign/migration.sql`

```sql
-- DataRecord: 加 campaignId 普通列 + 复合索引,支持按 (kind, campaignId) 查 COLLABORATION
ALTER TABLE `DataRecord`
  ADD COLUMN `scopeCampaignId` VARCHAR(191) NULL;

CREATE INDEX `idx_data_kind_scope` ON `DataRecord` (`kind`, `scopeCampaignId`);

-- 回填:既有 COLLABORATION 记录(当前 0 条,但留作幂等)
UPDATE `DataRecord`
  SET `scopeCampaignId` = JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.campaignId'))
  WHERE `kind` = 'COLLABORATION';
```

> ⚠️ dev DB 用户无 CREATE DATABASE 权限,`prisma migrate dev` 会 P3014(见 memory `prisma-migrate-dev-needs-shadow-db`)。**手写 migration.sql,用 `prisma migrate deploy`/`resolve` 落库**,不走 migrate dev。
> 备选(若后续要求"DB 强一致、不靠 service"):改 STORED generated column + 索引,但需处理 Prisma 写入排除;plan 阶段再评估,默认走普通列。

## 派生路径(验证模型自洽,SP3 实现)

recipe 给定 `(campaignId, reportPeriod)`:
1. `prisma.dataRecord.findMany({ where: { kind: 'COLLABORATION', scopeCampaignId: campaignId } })`(走索引)。
2. 遍历每条记录的 `data.deliverables[].performance.daily`,按 reportPeriod 切片求和 → per-creator 业绩(module 04)+ campaign KPI(module 02)+ campaign trend(module 03)。

与现有 `mapFromDaily` 算法等价,数据源从 `CpsPerformance` 换成 `DataRecord(COLLABORATION)`。

## 测试(扩 `apps/server/src/modules/data/data.schema.test.ts`)

- **COLLABORATION 带 performance**:完整 `deliverables:[{contentType:'post', performance:{daily:[{date,clicks,orders,gmv,newCustomers,spend}]}]}]` → 校验通过。
- **daily 点缺必填字段**(如无 `clicks`)→ 校验失败。
- **向后兼容**:旧 COLLABORATION 记录(无 `performance`)→ 仍校验通过。
- **CAMPAIGN 旧记录**(带 `analytics`)→ 仍校验通过(deprecated 不拒绝)。
- **`dataSchemaForKind('collaboration')`** 返回的 schema 含 `performance`。

## 文件改动

| 文件 | 改动 |
|---|---|
| `apps/server/src/modules/data/data.schema.ts` | 加 `cpsDailyPointSchema`/`deliverablePerformanceSchema`;`deliverableSchema` 加 `performance`;`analytics` 标 deprecated |
| `apps/server/prisma/schema.prisma` | `DataRecord` 加 `scopeCampaignId String?` + `@@index([kind, scopeCampaignId])` |
| `apps/server/src/modules/data/data.service.ts` | 加 `scopeFor(kind, data)` helper;`create`/`update`/`importMany` 写入时同步 `scopeCampaignId` |
| `apps/server/prisma/migrations/<ts>_datarecord_scope_campaign/migration.sql` | 新增:普通列 + 索引 + 既有回填 |
| `apps/server/src/modules/data/data.schema.test.ts` | 加 4 个用例 |

## 风险

- ⚠️ **scopeCampaignId 一致性靠 service**:`data.service.ts` 是 DataRecord 唯一写入入口,三处(create/update/importMany)都必须调 `scopeFor` 同步。若后续有人绕过 service 直接 `prisma.dataRecord.create`,列会漏填。用单测断言「写 COLLABORATION 必有 scopeCampaignId」兜底。
- ⚠️ **`migrate dev` P3014**:dev DB 用户无 CREATE DATABASE,须手写 migration + `migrate deploy`/`resolve`(见 memory `prisma-migrate-dev-needs-shadow-db`)。
- ⚠️ **SP1 不产生用户可见效果**:`COLLABORATION` 现在 0 条,recipe 也还没改读(SP3)。SP1 只是地基,要 SP1+SP2+SP3 都做完报告才真正从 DataRecord 出。验收以 schema/service 单测 + 迁移落库为准,不以报告效果为准。
- ⚠️ **`metrics` 卡片与派生值不对账**:SP1 后 `CAMPAIGN.metrics`(周期无关)与派生 KPI(周期相关)会继续并存且数字不一致。靠「recipe 不读 metrics」隔离;PPT 卡片周期化是后续子项目。需在 SP5 前明确卡片去留。
