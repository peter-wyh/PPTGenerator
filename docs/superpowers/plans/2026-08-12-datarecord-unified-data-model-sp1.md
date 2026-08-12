# DataRecord 统一数据模型 SP1 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 per-creator 每日业绩纳入 `DataRecord(COLLABORATION)` 的 schema,加 `scopeCampaignId` 列让 recipe 后续能按 campaign 查,为「全面统一到 DataRecord」打数据模型地基。

**Architecture:** Zod 加 `deliverable.performance.daily`(per-contentType CPS 每日点);`DataRecord` 加普通列 `scopeCampaignId`(由 `data.service.ts` 唯一写入入口同步)+ 复合索引;`CAMPAIGN.analytics` 标 deprecated(保留读旧记录)。纯数据模型层,不碰 recipe/AI 消费(SP3/SP4)、不搬存量(SP5)。

**Tech Stack:** Prisma 5.x + MySQL、Zod、vitest。migration 手写 SQL 走 `prisma migrate deploy`(dev DB 无 CREATE DATABASE 权限,`migrate dev` 会 P3014)。

**Spec:** `docs/superpowers/specs/2026-08-12-datarecord-unified-data-model-sp1-design.md`

---

## 文件结构

| 文件 | 责任 | 本计划改动 |
|---|---|---|
| `apps/server/src/modules/data/data.schema.ts` | DataRecord 各 kind 的 Zod schema | 加 `cpsDailyPointSchema`/`deliverablePerformanceSchema`;`deliverableSchema` 加 `performance`;`analytics` 标 deprecated |
| `apps/server/src/modules/data/data.schema.test.ts` | schema 单测 | 加 5 个用例(performance 合法/非法 + analytics 向后兼容) |
| `apps/server/prisma/schema.prisma` | Prisma 模型 | `DataRecord` 加 `scopeCampaignId String?` + 复合索引 |
| `apps/server/src/modules/data/data.service.ts` | DataRecord CRUD/import 唯一入口 | 加 `scopeFor()` helper;`create`/`update`/`importMany` 同步 `scopeCampaignId` |
| `apps/server/src/modules/data/data.service.test.ts` | service 单测 | 加 4 个用例(三处写入同步 scopeCampaignId) |
| `apps/server/prisma/migrations/<ts>_datarecord_scope_campaign/migration.sql` | DB 迁移 | 新增列 + 索引 + 回填 |

所有改动集中在 `data` 模块 + `prisma`,与用户并发 dirty 文件(`projects.*`/`DuplicateProjectDialog` 等)完全不相交,无需 worktree。

---

## Task 1: Zod schema —— deliverable.performance.daily + analytics deprecated

**Files:**
- Modify: `apps/server/src/modules/data/data.schema.ts`
- Test: `apps/server/src/modules/data/data.schema.test.ts`

- [ ] **Step 1: 写失败测试**(追加到 `data.schema.test.ts` 的 `describe('data.schema · collaborationRecordDataSchema', ...)` 块末尾,即该 `describe` 闭合 `});` 之前 —— 紧接现有「未知 contentType → 报错」用例之后):

```ts
  it('deliverable.performance.daily 合法 → 通过', () => {
    const c = {
      ...validCollab,
      deliverables: [{
        contentType: 'post',
        performance: {
          daily: [{ date: '2026-08-01', clicks: 100, orders: 5, gmv: 500, newCustomers: 2, spend: 90, impressions: 8000, commission: 50 }],
        },
      }],
    };
    expect(collaborationRecordDataSchema.parse(c)).toEqual(c);
  });
  it('performance.daily 点缺必填 clicks → 报错', () => {
    const c = {
      ...validCollab,
      deliverables: [{
        contentType: 'post',
        performance: { daily: [{ date: '2026-08-01', orders: 5, gmv: 500, newCustomers: 2, spend: 90 }] },
      }],
    };
    expect(() => collaborationRecordDataSchema.parse(c)).toThrow();
  });
  it('performance.daily 日期非字符串 → 报错', () => {
    const c = {
      ...validCollab,
      deliverables: [{
        contentType: 'post',
        performance: { daily: [{ date: 20260801, clicks: 100, orders: 5, gmv: 500, newCustomers: 2, spend: 90 }] },
      }],
    };
    expect(() => collaborationRecordDataSchema.parse(c)).toThrow();
  });
  it('deliverable 无 performance(旧记录)→ 仍通过', () => {
    expect(collaborationRecordDataSchema.parse(validCollab)).toEqual(validCollab);
  });
  it('CAMPAIGN 旧记录带 analytics → 仍通过(deprecated 不拒)', () => {
    const c = {
      ...validCampaign,
      analytics: {
        trend: [{ date: '2026-08-01', revenue: 500, spend: 90, commission: 50, orders: 5, roas: 5.5 }],
        weeklyTrend: [],
        insights: [],
      },
    };
    expect(campaignRecordDataSchema.parse(c)).toEqual(c);
  });
```

- [ ] **Step 2: 运行测试,确认失败**

Run: `cd apps/server && npx vitest run src/modules/data/data.schema.test.ts`
Expected: 5 个新用例 FAIL(`performance` / `analytics` 相关;Zod 未知键被 strip 或字段未定义)。

- [ ] **Step 3: 加 cpsDailyPointSchema + deliverablePerformanceSchema**

在 `apps/server/src/modules/data/data.schema.ts` 中,找到 `const deliverableSchema = z.object({`(约 181 行),在它**之前**插入:

```ts
/** CPS 每日明细点(per-contentType)。recipe 按此切片求和派生 KPI/trend。必填为 recipe 必需字段,impressions/commission 可选。 */
const cpsDailyPointSchema = z.object({
  date: z.string(),
  clicks: z.number(),
  orders: z.number(),
  gmv: z.number(),
  newCustomers: z.number(),
  spend: z.number(),
  impressions: z.number().optional(),
  commission: z.number().optional(),
});

/** deliverable 级 CPS 业绩(per-contentType 每日序列)。 */
const deliverablePerformanceSchema = z.object({
  daily: z.array(cpsDailyPointSchema),
});

```

- [ ] **Step 4: deliverableSchema 加 performance 字段**

把 `deliverableSchema` 改为(在 `wordcloud` 字段后加 `performance`):

```ts
const deliverableSchema = z.object({
  contentType: contentTypeSchema,
  /// 作品原始链接（帖子/视频/直播 URL）。
  postUrl: z.string().max(2048).optional(),
  /// 作品形式：短视频/图文/直播切片/合集/UGC...
  contentFormat: z.string().max(64).optional(),
  screenshots: z.array(screenshotItemSchema).optional(),
  metrics: z.array(collaborationMetricSchema).optional(),
  audience: audienceInsightSchema.optional(),
  wordcloud: z.array(wordItemSchema).optional(),
  /// CPS 每日业绩(per-contentType)。SP1 新增;recipe 据此派生 campaign KPI/trend。
  performance: deliverablePerformanceSchema.optional(),
});
```

- [ ] **Step 5: campaignRecordDataSchema.analytics 标 deprecated**

把 `campaignRecordDataSchema` 里的 `analytics: campaignAnalyticsSchema.optional(),`(约 64 行)替换为:

```ts
  /**
   * @deprecated SP1 后 campaign KPI/trend 统一从 DataRecord(COLLABORATION).deliverables[].performance.daily 派生。
   * 此字段仅保留读旧记录;recipe/AI 不得读。彻底下线见 SP5。
   */
  analytics: campaignAnalyticsSchema.optional(),
```

- [ ] **Step 6: 运行测试,确认通过**

Run: `cd apps/server && npx vitest run src/modules/data/data.schema.test.ts`
Expected: 全部 PASS(含 5 个新用例)。

- [ ] **Step 7: 类型检查**

Run: `cd apps/server && npx tsc --noEmit`
Expected: exit 0(无错误)。

- [ ] **Step 8: 提交**

```bash
cd /Users/ap/Desktop/PPTGenerator
git add apps/server/src/modules/data/data.schema.ts apps/server/src/modules/data/data.schema.test.ts
git commit -m "feat(data): COLLABORATION deliverable 加 performance.daily + analytics deprecated(SP1)"
```

---

## Task 2: Prisma schema —— DataRecord.scopeCampaignId 列 + 索引

**Files:**
- Modify: `apps/server/prisma/schema.prisma`

- [ ] **Step 1: 改 DataRecord 模型**

把 `model DataRecord { ... }`(约 314 行附近)改为(加 `scopeCampaignId` 列 + 新索引,其余不动):

```prisma
model DataRecord {
  /// id 由应用层生成(opaque),不使用 cuid() 默认值——便于导入按 id upsert 幂等。
  id        String          @id
  kind      DataRecordKind
  ownerId   String
  data      Json
  /// COLLABORATION 记录的 campaignId(便于按 campaign 查);其余 kind 为 null。
  /// 由 data.service 写入时同步(SP1),非 DB 生成列。
  scopeCampaignId String?
  owner     User            @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt

  @@index([kind])
  @@index([ownerId])
  @@index([kind, scopeCampaignId], map: "idx_data_kind_scope")
}
```

- [ ] **Step 2: 重新生成 Prisma client**(让 TS 认识 `scopeCampaignId` 字段)

Run: `cd apps/server && pnpm db:generate`
Expected: `✔ Generated Prisma Client`。无错误。

- [ ] **Step 3: 类型检查确认 client 已含新字段**

Run: `cd apps/server && npx tsc --noEmit`
Expected: exit 0(此时还没人用 scopeCampaignId,但 client 已含该字段)。

- [ ] **Step 4: 提交**

```bash
cd /Users/ap/Desktop/PPTGenerator
git add apps/server/prisma/schema.prisma
git commit -m "feat(data): DataRecord 加 scopeCampaignId 列 + (kind,scopeCampaignId) 索引(SP1)"
```

---

## Task 3: data.service —— scopeFor helper + 三处写入同步

**Files:**
- Modify: `apps/server/src/modules/data/data.service.ts`
- Test: `apps/server/src/modules/data/data.service.test.ts`

- [ ] **Step 1: 写失败测试**(追加到 `data.service.test.ts` 文件末尾,在最后一个 `describe('kindToDb', ...)` 块之后):

```ts
describe('dataService · scopeCampaignId 同步', () => {
  const validCollab = {
    id: 'collab:c1:cr1',
    campaignId: 'c1',
    creatorId: 'cr1',
    deliverables: [{ contentType: 'post' }],
  };

  it('create collaboration → payload.scopeCampaignId = campaignId', async () => {
    prismaMock.dataRecord.create.mockImplementation(({ data }) =>
      Promise.resolve(makeRecord({ ...(data as object) })));
    await dataService.create('u1', 'collaboration', validCollab);
    const { data } = prismaMock.dataRecord.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data.scopeCampaignId).toBe('c1');
  });

  it('create campaign → payload.scopeCampaignId = null', async () => {
    prismaMock.dataRecord.create.mockImplementation(({ data }) =>
      Promise.resolve(makeRecord({ ...(data as object) })));
    await dataService.create('u1', 'campaign', validCampaign);
    const { data } = prismaMock.dataRecord.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data.scopeCampaignId).toBeNull();
  });

  it('importMany collaboration:新建 → create 带 scope;已存在 → update 同步 scope', async () => {
    prismaMock.dataRecord.findUnique
      .mockResolvedValueOnce(null)                                    // item1 new → create
      .mockResolvedValueOnce(makeRecord({ kind: 'COLLABORATION' }));  // item2 exists → update
    await dataService.importMany('u1', 'collaboration', [
      validCollab,
      { ...validCollab, id: 'collab:c1:cr2' },
    ]);
    const createArg = prismaMock.dataRecord.create.mock.calls[0][0] as { data: Record<string, unknown> };
    const updateArg = prismaMock.dataRecord.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(createArg.data.scopeCampaignId).toBe('c1');
    expect(updateArg.data.scopeCampaignId).toBe('c1');
  });

  it('update collaboration → payload 同步 scopeCampaignId', async () => {
    prismaMock.dataRecord.findUnique.mockResolvedValue(makeRecord({ kind: 'COLLABORATION', data: validCollab }));
    prismaMock.dataRecord.update.mockImplementation(({ data }) =>
      Promise.resolve(makeRecord({ ...(data as object) })));
    await dataService.update('collab:c1:cr1', 'u1', validCollab);
    const arg = prismaMock.dataRecord.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.scopeCampaignId).toBe('c1');
  });
});
```

- [ ] **Step 2: 运行测试,确认失败**

Run: `cd apps/server && npx vitest run src/modules/data/data.service.test.ts`
Expected: 4 个新用例 FAIL(`data.scopeCampaignId` 为 `undefined`)。其余既有用例仍 PASS。

- [ ] **Step 3: 加 scopeFor helper**

在 `apps/server/src/modules/data/data.service.ts` 中,`kindToDb` 函数之后(约 14 行后)、`nextCampaignId` 之前,插入:

```ts
/**
 * 写入 DataRecord 时填 scopeCampaignId:COLLABORATION 取 data.campaignId,其余 kind 返回 null。
 * 供 recipe 后续按 (kind='COLLABORATION', scopeCampaignId) 索引查询。
 */
function scopeFor(kind: Kind, data: Record<string, unknown>): string | null {
  if (kind !== 'collaboration') return null;
  const cid = data?.campaignId;
  return typeof cid === 'string' && cid ? cid : null;
}
```

- [ ] **Step 4: create 同步 scopeCampaignId**

把 `create` 方法的 `prisma.dataRecord.create({...})`(约 68-75 行)替换为:

```ts
    return prisma.dataRecord.create({
      data: {
        id: (valid as { id: string }).id,
        kind: kindToDb(kind),
        ownerId,
        data: valid as unknown as Prisma.InputJsonValue,
        scopeCampaignId: scopeFor(kind, valid as Record<string, unknown>),
      },
    });
```

- [ ] **Step 5: importMany 两处同步**

把 `importMany` 里的 `update` 分支(约 98-101 行)替换为:

```ts
          await prisma.dataRecord.update({
            where: { id: valid.id },
            data: {
              data: valid as unknown as Prisma.InputJsonValue,
              scopeCampaignId: scopeFor(kind, valid as Record<string, unknown>),
            },
          });
```

把 `importMany` 里的 `create` 分支(约 104-111 行)替换为:

```ts
          await prisma.dataRecord.create({
            data: {
              id: valid.id,
              kind: kindToDb(kind),
              ownerId,
              data: valid as unknown as Prisma.InputJsonValue,
              scopeCampaignId: scopeFor(kind, valid as Record<string, unknown>),
            },
          });
```

- [ ] **Step 6: update 同步 scopeCampaignId**

把 `update` 方法的 `prisma.dataRecord.update({...})`(约 129-132 行)替换为:

```ts
    return prisma.dataRecord.update({
      where: { id },
      data: {
        data: valid as unknown as Prisma.InputJsonValue,
        scopeCampaignId: scopeFor(kind, valid as Record<string, unknown>),
      },
    });
```

- [ ] **Step 7: 运行测试,确认通过**

Run: `cd apps/server && npx vitest run src/modules/data/data.service.test.ts`
Expected: 全部 PASS(含 4 个新用例 + 既有用例回归)。

- [ ] **Step 8: 类型检查**

Run: `cd apps/server && npx tsc --noEmit`
Expected: exit 0。

- [ ] **Step 9: 提交**

```bash
cd /Users/ap/Desktop/PPTGenerator
git add apps/server/src/modules/data/data.service.ts apps/server/src/modules/data/data.service.test.ts
git commit -m "feat(data): data.service 三处写入同步 scopeCampaignId(SP1)"
```

---

## Task 4: DB migration —— scopeCampaignId 列 + 索引 + 回填

**Files:**
- Create: `apps/server/prisma/migrations/<timestamp>_datarecord_scope_campaign/migration.sql`

- [ ] **Step 1: 生成迁移时间戳文件夹名**

Run: `TS=$(date +%Y%m%d%H%M%S) && echo "$TS"` (用输出的值,例如 `20260812143000`)
创建文件夹:`apps/server/prisma/migrations/<TS>_datarecord_scope_campaign/`

- [ ] **Step 2: 写 migration.sql**

在新文件夹内创建 `migration.sql`,内容:

```sql
-- DataRecord: 加 scopeCampaignId 普通列 + 复合索引,支持按 (kind, campaignId) 查 COLLABORATION。
-- SP1 of DataRecord 统一数据模型。详见 docs/superpowers/specs/2026-08-12-datarecord-unified-data-model-sp1-design.md
ALTER TABLE `DataRecord`
  ADD COLUMN `scopeCampaignId` VARCHAR(191) NULL;

CREATE INDEX `idx_data_kind_scope` ON `DataRecord` (`kind`, `scopeCampaignId`);

-- 回填既有 COLLABORATION 记录的 scopeCampaignId(当前 0 条,幂等,留作安全网)
UPDATE `DataRecord`
  SET `scopeCampaignId` = JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.campaignId'))
  WHERE `kind` = 'COLLABORATION';
```

- [ ] **Step 3: 应用迁移**(`migrate deploy` 不需要 shadow DB;不要用 `migrate dev`,会 P3014)

Run: `cd apps/server && pnpm db:migrate:deploy`
Expected: 输出 `Applied migration(s): <...>_datarecord_scope_campaign`,无错误。

- [ ] **Step 4: 验证列与索引已建**

Run:
```bash
docker exec mediakit-mysql-1 mysql -umediakit -pmediakit_pw mediakit -e "SHOW INDEX FROM DataRecord WHERE Key_name='idx_data_kind_scope';" 2>&1 | grep -v Warning
docker exec mediakit-mysql-1 mysql -umediakit -pmediakit_pw mediakit -e "SHOW COLUMNS FROM DataRecord LIKE 'scopeCampaignId';" 2>&1 | grep -v Warning
```
Expected: 第一条返回 1 行索引(`idx_data_kind_scope`,2 列 `kind`/`scopeCampaignId`);第二条返回 `scopeCampaignId | varchar(191) | YES`。

- [ ] **Step 5: 提交**

```bash
cd /Users/ap/Desktop/PPTGenerator
git add apps/server/prisma/migrations/
git commit -m "feat(data): migration 加 DataRecord.scopeCampaignId 列 + 索引(SP1)"
```

---

## Task 5: 全量回归 + spec 归档提交

**Files:** 无新改动,仅验证。

- [ ] **Step 1: data 模块全量测试**

Run: `cd apps/server && npx vitest run src/modules/data`
Expected: 全部 PASS(schema + service 两套测试)。

- [ ] **Step 2: server 全量类型检查**

Run: `cd apps/server && npx tsc --noEmit`
Expected: exit 0。

- [ ] **Step 3: 确认 recipe 测试未被波及**(SP1 不改 recipe,应全绿)

Run: `cd apps/server && npx vitest run src/modules/html-templates/recipe`
Expected: 38 PASS(既有,无回归)。

- [ ] **Step 4: 提交 spec + plan**(若尚未提交)

```bash
cd /Users/ap/Desktop/PPTGenerator
git add docs/superpowers/specs/2026-08-12-datarecord-unified-data-model-sp1-design.md docs/superpowers/plans/2026-08-12-datarecord-unified-data-model-sp1.md
git commit -m "docs(data): SP1 设计 + 实施计划(DataRecord 统一数据模型)"
```

---

## 完成标准(DoD)

- `data.schema.ts`:`deliverable.performance.daily` 可校验;`analytics` 标 deprecated 且旧记录仍通过。
- `schema.prisma` + 迁移:`DataRecord.scopeCampaignId` 列 + `idx_data_kind_scope` 索引已落库。
- `data.service.ts`:`create`/`update`/`importMany` 三处写入均同步 `scopeCampaignId`,COLLABORATION = campaignId,其余 = null。
- 所有 data 测试 + recipe 测试(回归)+ tsc 全绿。
- 5 个 commit(schema、prisma、service、migration、docs)各自独立、可回滚。

## 非目标(留给后续 SP)

- recipe/AI 改读 DataRecord → SP3/SP4。
- 数据管理模块 import/CRUD UI 写入 `performance.daily` → SP2。
- 存量 CpsPerformance / Campaign.analytics 搬迁 → SP5。
- PPT KPI 卡片周期化 → 后续单独子项目。
