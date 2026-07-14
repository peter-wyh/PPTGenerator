# 数据管理(Campaign + 达人库,支持导入)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `/data` 的 Mock 数据预览改造为数据管理页,服务端新增 `DataRecord` 表 + CRUD/导入 API,前端切换编辑器数据源到该库,支持 CSV/XLSX/JSON 导入 + 手动新增;**并支持 Campaign→达人 下钻**(campaign 记录带 `creatorIds`,Campaign Tab 行可展开看合作达人)。Part A(Task 1–9)= 库管理;Part B(B2/B6/B7/B8/B9)= 下钻增量,见 spec `2026-07-14-data-management-drill-down-design.md`。

**Architecture:** 服务端一行一记录的 `DataRecord { id, kind, ownerId, data: Json }` 表(复用 opaque-JSON 模式,per-record 粒度),新 `data` 模块(mirrors templates 模块)。前端新 `dataLibrary` client 打 `/api/v1/data`;`listCampaigns()`/`listCreators()` 改读该库(签名不变)。数据管理页 Tab(Campaign/达人库)+ 表格 + 导入预览 + 行编辑/删除。mock 数据保留为种子 payload,显式按钮灌入(upsert-by-id 幂等)。绑定仍快照进 `projectMeta.reportData`(不变)。

**Tech Stack:** Express + Prisma(MySQL 8)+ Zod(server);React + React Router + axios + vitest/jsdom(web);`@mediakit/shared` 纯 TS 类型。

**基线与隔离:** 实现须在隔离 worktree 中进行(superpowers:using-git-worktrees,从 main 分支)。worktree 树干净,每个 task 用 `git add <task files> && git commit -m "..."` 原子提交。若被迫在脏树(`design/template-project-linking`)上执行,改用 `git add <files> && git commit -m "..." -- <files>`(pathspec only-mode,避免卷入已暂存的无关文件,见 memory [[ide-resets-git-index]])。

**命令速查:**
- 服务端测试:`pnpm --filter @mediakit/server exec vitest run <path>`
- 服务端 typecheck:`pnpm --filter @mediakit/server typecheck`
- 服务端迁移:`pnpm --filter @mediakit/server exec prisma migrate deploy` 然后 `pnpm --filter @mediakit/server exec prisma generate`
- Web 测试:`pnpm --filter @mediakit/web exec vitest run <path>`
- Web typecheck:`pnpm --filter @mediakit/web exec tsc --noEmit`

**v1 已知限制(设计已定,见 spec §3):** 性能明细数据(creator performance / placements / GEO / funnel / timeline / products / summary)不导入,保持 mock 生成器;导入的真实 campaign 走 `DEFAULT_PROFILE` 生成 demo 数。**Part B 后**:`listCampaignCreators(campaignId)` 行为不变(perf 派生,demo 用);新增 `listCampaignCollaborators(campaignId)` 按 `creatorIds` 解析合作达人(导入 campaign 可下钻);执行效果明细仍不导入,demo campaign 的二级展开效果走 `listCreatorPerformance` mock 生成器。CSV 导入只带核心字段(无 metrics/platforms);JSON 导入可带完整结构。

---

## File Structure

**服务端(新建 `apps/server/src/modules/data/`)**
- `data.schema.ts` — Zod:`campaignRecordDataSchema` / `creatorRecordDataSchema` / `kindSchema` / `createDataSchema` / `importDataSchema` / `updateDataSchema` / `listQuerySchema` / `clearQuerySchema`。
- `data.service.ts` — `dataService` 对象:list / getOrThrow / create / importMany / update / remove / clear。用 `prisma.dataRecord.*`。
- `data.controller.ts` — `dataController` 对象(asyncHandler 包裹,读 `owner(req)`)。
- `data.routes.ts` — Router,`router.use(authenticate)`,挂 6 个端点。
- `data.schema.test.ts` / `data.service.test.ts` / `data.routes.test.ts` — 测试。
- 改 `apps/server/src/routes/index.ts` — 注册 `apiRouter.use('/data', dataRoutes)`。
- 改 `apps/server/prisma/schema.prisma` — 加 `DataRecord` + `DataRecordKind`。
- 新 `apps/server/prisma/migrations/20260714000001_data_record/migration.sql` — 手写建表 SQL。

**Shared**
- 改 `packages/shared/src/types/campaign.ts` — 加 `Creator` interface(从 web 搬入)。

**Web**
- 新 `apps/web/src/api/dataLibrary.ts` — `dataApi` client。
- 改 `apps/web/src/api/campaigns.ts` / `creators.ts` — 切换数据源。
- 新 `apps/web/src/components/DataTable.tsx` — 从 MockData 抽出。
- 新 `apps/web/src/editor/dataImport.ts` — 字段定义 + `buildPreviewFromRows` / `buildPreviewFromObjects` / `downloadTemplate`。
- 新 `apps/web/src/editor/components/ImportPreviewModal.tsx` — 导入预览弹窗。
- 新 `apps/web/src/editor/components/RecordFormModal.tsx` — 新增/编辑表单弹窗。
- 新 `apps/web/src/routes/DataManagement.tsx` — 数据管理页(替换 MockData)。
- 改 `apps/web/src/App.tsx` — `/data` 懒加载指向 DataManagement。
- 改 `apps/web/src/components/Layout.tsx` — 导航文案「Mock 数据」→「数据管理」。
- 删 `apps/web/src/routes/MockData.tsx`。
- 新测试:`dataLibrary.test.ts` / `campaigns.test.ts` / `dataImport.test.ts` / `DataManagement.test.tsx`。

---

## Task 1: Prisma `DataRecord` 模型 + 迁移 + generate

**Files:**
- Modify: `apps/server/prisma/schema.prisma`(末尾追加)
- Create: `apps/server/prisma/migrations/20260714000001_data_record/migration.sql`

- [ ] **Step 1: 在 schema.prisma 末尾追加模型与枚举**

在 `apps/server/prisma/schema.prisma` 末尾(`enum TemplateStatus` 块之后)追加:

```prisma
/// 数据管理库记录:Campaign / 达人库(Creator)统一存储,opaque JSON payload。全员可管,ownerId 标记创建者。
model DataRecord {
  id        String          @id
  kind      DataRecordKind
  ownerId   String
  data      Json
  owner     User            @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt

  @@index([kind])
  @@index([ownerId])
}

/// 数据记录类型。
enum DataRecordKind {
  CAMPAIGN
  CREATOR
}
```

注意:`id String @id`(无 `@default(cuid())`)——记录主键 = 数据自带 id(如 `camp-glowlab-q4`),便于 upsert-by-id 幂等导入。手动新增时由前端生成 id。

- [ ] **Step 2: 手写迁移 SQL**

创建 `apps/server/prisma/migrations/20260714000001_data_record/migration.sql`(对齐 init 迁移的 DDL 约定:`VARCHAR(30)` id、`DATETIME(3)`、`ENUM` 内联、`JSON` 列、FK `ON DELETE CASCADE ON UPDATE CASCADE`、`utf8mb4_unicode_ci`):

```sql
-- 数据管理库记录:Campaign / 达人库(Creator),opaque JSON。
CREATE TABLE `DataRecord` (
    `id`        VARCHAR(30) NOT NULL,
    `kind`      ENUM('CAMPAIGN', 'CREATOR') NOT NULL,
    `ownerId`   VARCHAR(30) NOT NULL,
    `data`      JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `DataRecord_kind_idx`(`kind`),
    INDEX `DataRecord_ownerId_idx`(`ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DataRecord` ADD CONSTRAINT `DataRecord_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3: 应用迁移 + 重新生成 client**

Run:
```bash
pnpm --filter @mediakit/server exec prisma migrate deploy && pnpm --filter @mediakit/server exec prisma generate
```
Expected: `migrate deploy` 输出 `Applied migration 20260714000001_data_record`;`generate` 输出 `Generated Prisma Client`。遵循 memory [[prisma-migrate-dev-needs-shadow-db]]——用 `migrate deploy`(不碰 shadow DB),不用 `migrate dev`。

- [ ] **Step 4: 验证 client 已含 DataRecord 类型**

Run:
```bash
pnpm --filter @mediakit/server typecheck
```
Expected: 无错误(此时还没引用 `prisma.dataRecord`,仅确认 schema 合法、client 生成成功)。

- [ ] **Step 5: Commit**

```bash
git add apps/server/prisma/schema.prisma apps/server/prisma/migrations/20260714000001_data_record/migration.sql
git commit -m "feat(server): add DataRecord model + migration"
```

---

## Task 2: `data.schema.ts`(Zod)+ 测试

**Files:**
- Create: `apps/server/src/modules/data/data.schema.ts`
- Test: `apps/server/src/modules/data/data.schema.test.ts`

镜像 shared `Campaign`(`packages/shared/src/types/campaign.ts`)与 web `Creator`(`apps/web/src/api/creators.ts`)。遵循 memory [[zod-strips-undeclared-meta-keys]]——服务端 Zod 必须镜像 shared 类型。

- [ ] **Step 1: 写失败测试**

创建 `apps/server/src/modules/data/data.schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  campaignRecordDataSchema,
  creatorRecordDataSchema,
  kindSchema,
  createDataSchema,
  importDataSchema,
  updateDataSchema,
} from './data.schema';

const validCampaign = {
  id: 'camp-x',
  name: 'Campaign X',
  advertiser: 'GlowLab',
  businessLine: 'FT',
  platform: 'TikTok',
  startDate: '2026-01-01',
  endDate: '2026-01-31',
  budget: '$100K',
};
const validCreator = {
  id: 'cre-x',
  name: 'Mia',
  handle: '@mia',
  platform: 'TikTok',
  tier: 'mega',
  followers: '1.28M',
  engagement: '8.7%',
  category: 'Beauty',
  region: 'US',
};

describe('data.schema · kindSchema', () => {
  it('接受 campaign / creator,拒绝其它', () => {
    expect(kindSchema.parse('campaign')).toBe('campaign');
    expect(kindSchema.parse('creator')).toBe('creator');
    expect(() => kindSchema.parse('product')).toThrow();
  });
});

describe('data.schema · campaignRecordDataSchema(镜像 Campaign)', () => {
  it('合法 campaign(含可选 metrics/platforms)通过', () => {
    const c = { ...validCampaign, status: 'Active', owner: 'alex', metrics: [{ label: 'GMV', value: '$1', compare: '+1%' }], platforms: [{ platform: 'TikTok', collaborationType: 'Content' }] };
    expect(campaignRecordDataSchema.parse(c)).toEqual(c);
  });
  it('缺必填 name → 报错', () => {
    const { name, ...bad } = validCampaign;
    expect(() => campaignRecordDataSchema.parse(bad)).toThrow();
  });
  it('metrics 项缺 compare → 报错(CampaignMetric 三字段必填)', () => {
    const c = { ...validCampaign, metrics: [{ label: 'GMV', value: '$1' }] };
    expect(() => campaignRecordDataSchema.parse(c)).toThrow();
  });
});

describe('data.schema · creatorRecordDataSchema(镜像 Creator)', () => {
  it('合法 creator(含 avatar + metrics[])通过', () => {
    const cr = { ...validCreator, avatar: 'https://x', metrics: [{ label: 'Avg Reach', value: '1M', compare: '' }] };
    expect(creatorRecordDataSchema.parse(cr)).toEqual(cr);
  });
  it('缺 metrics → 报错(Creator.metrics 必填)', () => {
    const { metrics, ...bad } = { ...validCreator, metrics: [] } as Record<string, unknown>;
    void metrics;
    expect(() => creatorRecordDataSchema.parse(bad)).toThrow();
  });
  it('缺必填 tier → 报错', () => {
    const { tier, ...bad } = validCreator;
    expect(() => creatorRecordDataSchema.parse(bad)).toThrow();
  });
});

describe('data.schema · 端点入参 schema', () => {
  it('createDataSchema: kind + data(unknown)通过', () => {
    expect(createDataSchema.parse({ kind: 'campaign', data: validCampaign })).toEqual({ kind: 'campaign', data: validCampaign });
  });
  it('importDataSchema: kind + items[] 通过', () => {
    const r = importDataSchema.parse({ kind: 'creator', items: [validCreator] });
    expect(r.items).toHaveLength(1);
  });
  it('importDataSchema: items 非数组 → 报错', () => {
    expect(() => importDataSchema.parse({ kind: 'creator', items: {} })).toThrow();
  });
  it('updateDataSchema: { data } 通过', () => {
    expect(updateDataSchema.parse({ data: validCampaign })).toEqual({ data: validCampaign });
  });
});
```

- [ ] **Step 2: 运行测试,确认失败**

Run:
```bash
pnpm --filter @mediakit/server exec vitest run src/modules/data/data.schema.test.ts
```
Expected: FAIL(模块不存在)。

- [ ] **Step 3: 实现 schema**

创建 `apps/server/src/modules/data/data.schema.ts`:

```ts
import { z } from 'zod';
import { idParamSchema } from '../projects/projects.schema';

/** 数据记录类型(与 Prisma DataRecordKind 对齐:DB 存大写,API 用小写)。 */
export const kindSchema = z.enum(['campaign', 'creator']);

/** CampaignMetric:Campaign 与 Creator 共用,三字段必填。 */
const campaignMetricSchema = z.object({
  label: z.string(),
  value: z.string(),
  compare: z.string(),
});

/** CampaignPlatform:多平台合作形式。 */
const campaignPlatformSchema = z.object({
  platform: z.string(),
  collaborationType: z.string(),
});

/** Campaign 记录数据(镜像 shared Campaign)。 */
export const campaignRecordDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  advertiser: z.string(),
  businessLine: z.string(),
  platform: z.string(),
  platforms: z.array(campaignPlatformSchema).optional(),
  startDate: z.string(),
  endDate: z.string(),
  budget: z.string(),
  status: z.string().optional(),
  owner: z.string().optional(),
  metrics: z.array(campaignMetricSchema).optional(),
});

/** Creator 记录数据(镜像 web Creator;metrics 必填)。 */
export const creatorRecordDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  handle: z.string(),
  platform: z.string(),
  tier: z.string(),
  followers: z.string(),
  engagement: z.string(),
  category: z.string(),
  region: z.string(),
  avatar: z.string().max(2048).optional(),
  metrics: z.array(campaignMetricSchema),
});

/** 按 kind 取对应数据 schema。 */
export function dataSchemaForKind(kind: 'campaign' | 'creator') {
  return kind === 'campaign' ? campaignRecordDataSchema : creatorRecordDataSchema;
}

/** POST /api/v1/data — kind + data(data 在 service 按 kind 校验)。 */
export const createDataSchema = z.object({
  kind: kindSchema,
  data: z.unknown(),
});

/** POST /api/v1/data/import — kind + items[]。 */
export const importDataSchema = z.object({
  kind: kindSchema,
  items: z.array(z.unknown()),
});

/** PATCH /api/v1/data/:id — data(data 在 service 按记录既有 kind 校验)。 */
export const updateDataSchema = z.object({
  data: z.unknown(),
});

/** GET /api/v1/data?kind=... — kind 必填。 */
export const listQuerySchema = z.object({ kind: kindSchema });

/** DELETE /api/v1/data?kind=... — kind 必填。 */
export const clearQuerySchema = z.object({ kind: kindSchema });

export { idParamSchema };
```

- [ ] **Step 4: 运行测试,确认通过**

Run:
```bash
pnpm --filter @mediakit/server exec vitest run src/modules/data/data.schema.test.ts
```
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/data/data.schema.ts apps/server/src/modules/data/data.schema.test.ts
git commit -m "feat(server): data module Zod schemas"
```

---

## Task 3: `data.service.ts` + 测试

**Files:**
- Create: `apps/server/src/modules/data/data.service.ts`
- Test: `apps/server/src/modules/data/data.service.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `apps/server/src/modules/data/data.service.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  dataRecord: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock('../../prisma', () => ({ prisma: prismaMock }));

import { dataService } from './data.service';
import { ApiError } from '../../utils/ApiError';

const validCampaign = {
  id: 'camp-x',
  name: 'Campaign X',
  advertiser: 'GlowLab',
  businessLine: 'FT',
  platform: 'TikTok',
  startDate: '2026-01-01',
  endDate: '2026-01-31',
  budget: '$100K',
};
function makeRecord(over: Record<string, unknown> = {}) {
  return {
    id: 'camp-x',
    kind: 'CAMPAIGN',
    ownerId: 'u1',
    data: validCampaign,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...over,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('dataService · list', () => {
  it('按 kind 查询,createdAt desc', async () => {
    prismaMock.dataRecord.findMany.mockResolvedValue([makeRecord()]);
    const r = await dataService.list('campaign');
    expect(r).toHaveLength(1);
    expect(prismaMock.dataRecord.findMany).toHaveBeenCalledWith({
      where: { kind: 'CAMPAIGN' },
      orderBy: { createdAt: 'desc' },
    });
  });
});

describe('dataService · getOrThrow', () => {
  it('不存在 → 404', async () => {
    prismaMock.dataRecord.findUnique.mockResolvedValue(null);
    await expect(dataService.getOrThrow('nope')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('dataService · create', () => {
  it('合法 data → 创建,kind 大写、data 透传', async () => {
    prismaMock.dataRecord.create.mockImplementation(({ data }) => Promise.resolve(makeRecord({ data: data.data })));
    await dataService.create('u1', 'campaign', validCampaign);
    const { data } = prismaMock.dataRecord.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data.kind).toBe('CAMPAIGN');
    expect(data.ownerId).toBe('u1');
    expect((data.data as { id: string }).id).toBe('camp-x');
  });
  it('非法 data(缺 name)→ 400', async () => {
    const { name, ...bad } = validCampaign;
    await expect(dataService.create('u1', 'campaign', bad)).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.dataRecord.create).not.toHaveBeenCalled();
  });
});

describe('dataService · importMany', () => {
  it('新 id → created;已存在 → updated;非法 → skipped', async () => {
    prismaMock.dataRecord.findUnique
      .mockResolvedValueOnce(null) // camp-x 不存在 → create
      .mockResolvedValueOnce(makeRecord()); // camp-y 存在 → update
    const r = await dataService.importMany('u1', 'campaign', [
      validCampaign, // valid, new
      { ...validCampaign, id: 'camp-y' }, // valid, exists
      { id: 'camp-bad' }, // invalid (缺 name) → skipped
    ]);
    expect(r).toEqual({ created: 1, updated: 1, skipped: 1 });
    expect(prismaMock.dataRecord.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.dataRecord.update).toHaveBeenCalledTimes(1);
  });
  it('id 缺失 → skipped', async () => {
    const r = await dataService.importMany('u1', 'campaign', [{ name: 'no id' }]);
    expect(r.skipped).toBe(1);
  });
  it('重复导入同 id 幂等:第二次走 update', async () => {
    prismaMock.dataRecord.findUnique.mockResolvedValue(makeRecord());
    const r = await dataService.importMany('u1', 'campaign', [validCampaign]);
    expect(r).toEqual({ created: 0, updated: 1, skipped: 0 });
  });
});

describe('dataService · update', () => {
  it('记录不存在 → 404', async () => {
    prismaMock.dataRecord.findUnique.mockResolvedValue(null);
    await expect(dataService.update('nope', validCampaign)).rejects.toMatchObject({ statusCode: 404 });
  });
  it('按记录既有 kind 校验 data 后更新', async () => {
    prismaMock.dataRecord.findUnique.mockResolvedValue(makeRecord());
    prismaMock.dataRecord.update.mockResolvedValue(makeRecord({ data: { ...validCampaign, name: '改名' } }));
    await dataService.update('camp-x', { ...validCampaign, name: '改名' });
    const arg = prismaMock.dataRecord.update.mock.calls[0][0] as { where: { id: string }; data: { data: { name: string } } };
    expect(arg.where.id).toBe('camp-x');
    expect(arg.data.data.name).toBe('改名');
  });
  it('data 与记录 kind 不符(creator 数据塞 campaign 记录)→ 400', async () => {
    prismaMock.dataRecord.findUnique.mockResolvedValue(makeRecord()); // kind CAMPAIGN
    await expect(dataService.update('camp-x', { id: 'x', name: 'Mia', handle: '@m', platform: 'TikTok', tier: 'mega', followers: '1M', engagement: '8%', category: 'Beauty', region: 'US', metrics: [] })).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('dataService · remove / clear', () => {
  it('remove: 不存在 → 404', async () => {
    prismaMock.dataRecord.findUnique.mockResolvedValue(null);
    await expect(dataService.remove('nope')).rejects.toMatchObject({ statusCode: 404 });
  });
  it('remove: 存在 → delete', async () => {
    prismaMock.dataRecord.findUnique.mockResolvedValue(makeRecord());
    prismaMock.dataRecord.delete.mockResolvedValue(makeRecord());
    await dataService.remove('camp-x');
    expect(prismaMock.dataRecord.delete).toHaveBeenCalledWith({ where: { id: 'camp-x' } });
  });
  it('clear: deleteMany by kind,返回 count', async () => {
    prismaMock.dataRecord.deleteMany.mockResolvedValue({ count: 5 });
    const r = await dataService.clear('campaign');
    expect(prismaMock.dataRecord.deleteMany).toHaveBeenCalledWith({ where: { kind: 'CAMPAIGN' } });
    expect(r).toEqual({ deleted: 5 });
  });
});
```

- [ ] **Step 2: 运行测试,确认失败**

Run:
```bash
pnpm --filter @mediakit/server exec vitest run src/modules/data/data.service.test.ts
```
Expected: FAIL(模块不存在)。

- [ ] **Step 3: 实现 service**

创建 `apps/server/src/modules/data/data.service.ts`:

```ts
import { prisma } from '../../prisma';
import { ApiError } from '../../utils/ApiError';
import type { Prisma } from '@prisma/client';
import { dataSchemaForKind, type kindSchema } from './data.schema';

type Kind = z.infer<typeof kindSchema>;
import type { z } from 'zod';

/** API 小写 kind → Prisma 大写枚举。 */
function kindToDb(kind: Kind): 'CAMPAIGN' | 'CREATOR' {
  return kind === 'campaign' ? 'CAMPAIGN' : 'CREATOR';
}

export const dataService = {
  async list(kind: Kind) {
    return prisma.dataRecord.findMany({
      where: { kind: kindToDb(kind) },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getOrThrow(id: string) {
    const rec = await prisma.dataRecord.findUnique({ where: { id } });
    if (!rec) throw ApiError.notFound('Data record not found');
    return rec;
  },

  /** 按 kind 校验 data;失败抛 400。 */
  validateData(kind: Kind, data: unknown) {
    const schema = dataSchemaForKind(kind);
    const res = schema.safeParse(data);
    if (!res.success) throw ApiError.badRequest('Invalid record data', res.error.flatten());
    return res.data;
  },

  async create(ownerId: string, kind: Kind, data: unknown) {
    const valid = this.validateData(kind, data);
    return prisma.dataRecord.create({
      data: {
        id: (valid as { id: string }).id,
        kind: kindToDb(kind),
        ownerId,
        data: valid as unknown as Prisma.InputJsonValue,
      },
    });
  },

  /** 批量 upsert-by-id(幂等);逐条校验,非法行计入 skipped。 */
  async importMany(ownerId: string, kind: Kind, items: unknown[]) {
    const schema = dataSchemaForKind(kind);
    let created = 0;
    let updated = 0;
    let skipped = 0;
    for (const item of items) {
      const res = schema.safeParse(item);
      if (!res.success) {
        skipped++;
        continue;
      }
      const valid = res.data as { id: string };
      if (!valid.id) {
        skipped++;
        continue;
      }
      const existing = await prisma.dataRecord.findUnique({ where: { id: valid.id } });
      if (existing) {
        await prisma.dataRecord.update({
          where: { id: valid.id },
          data: { data: valid as unknown as Prisma.InputJsonValue },
        });
        updated++;
      } else {
        await prisma.dataRecord.create({
          data: {
            id: valid.id,
            kind: kindToDb(kind),
            ownerId,
            data: valid as unknown as Prisma.InputJsonValue,
          },
        });
        created++;
      }
    }
    return { created, updated, skipped };
  },

  async update(id: string, data: unknown) {
    const rec = await this.getOrThrow(id);
    const kind: Kind = rec.kind === 'CAMPAIGN' ? 'campaign' : 'creator';
    const valid = this.validateData(kind, data);
    return prisma.dataRecord.update({
      where: { id },
      data: { data: valid as unknown as Prisma.InputJsonValue },
    });
  },

  async remove(id: string) {
    await this.getOrThrow(id);
    await prisma.dataRecord.delete({ where: { id } });
  },

  async clear(kind: Kind) {
    const r = await prisma.dataRecord.deleteMany({ where: { kind: kindToDb(kind) } });
    return { deleted: r.count };
  },
};
```

- [ ] **Step 4: 运行测试,确认通过**

Run:
```bash
pnpm --filter @mediakit/server exec vitest run src/modules/data/data.service.test.ts
```
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/data/data.service.ts apps/server/src/modules/data/data.service.test.ts
git commit -m "feat(server): data module service (CRUD + import upsert)"
```

---

## Task 4: `data.controller.ts` + `data.routes.ts` + 注册 + 路由冒烟测试

**Files:**
- Create: `apps/server/src/modules/data/data.controller.ts`
- Create: `apps/server/src/modules/data/data.routes.ts`
- Create: `apps/server/src/modules/data/data.routes.test.ts`
- Modify: `apps/server/src/routes/index.ts`

- [ ] **Step 1: 写失败测试(路由挂载 + 鉴权)**

创建 `apps/server/src/modules/data/data.routes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';

describe('data routes · 挂载与鉴权', () => {
  it('未登录 GET /api/v1/data → 401(不是 404)', async () => {
    const res = await request(createApp()).get('/api/v1/data');
    expect(res.status).toBe(401);
  });
  it('未登录 POST /api/v1/data/import → 401', async () => {
    const res = await request(createApp()).post('/api/v1/data/import').send({ kind: 'campaign', items: [] });
    expect(res.status).toBe(401);
  });
  it('未登录 DELETE /api/v1/data?kind=campaign → 401', async () => {
    const res = await request(createApp()).delete('/api/v1/data?kind=campaign');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: 运行测试,确认失败(404)**

Run:
```bash
pnpm --filter @mediakit/server exec vitest run src/modules/data/data.routes.test.ts
```
Expected: FAIL(路由未注册 → 404,期望 401)。

- [ ] **Step 3: 实现 controller**

创建 `apps/server/src/modules/data/data.controller.ts`:

```ts
import type { Request, Response } from 'express';
import { dataService } from './data.service';
import { asyncHandler } from '../../utils/asyncHandler';
import type { AuthPayload } from '../../types/express';
import type { kindSchema } from './data.schema';
import type { z } from 'zod';

type Kind = z.infer<typeof kindSchema>;

function owner(req: Request): string {
  return (req.user as AuthPayload).id;
}

export const dataController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const kind = (req.query as { kind: Kind }).kind;
    res.json({ records: await dataService.list(kind) });
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    res.json({ record: await dataService.getOrThrow(req.params.id) });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const { kind, data } = req.body as { kind: Kind; data: unknown };
    res.status(201).json({ record: await dataService.create(owner(req), kind, data) });
  }),

  import: asyncHandler(async (req: Request, res: Response) => {
    const { kind, items } = req.body as { kind: Kind; items: unknown[] };
    res.json(await dataService.importMany(owner(req), kind, items));
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const { data } = req.body as { data: unknown };
    res.json({ record: await dataService.update(req.params.id, data) });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await dataService.remove(req.params.id);
    res.status(204).end();
  }),

  clear: asyncHandler(async (req: Request, res: Response) => {
    const kind = (req.query as { kind: Kind }).kind;
    res.json(await dataService.clear(kind));
  }),
};
```

- [ ] **Step 4: 实现 routes**

创建 `apps/server/src/modules/data/data.routes.ts`:

```ts
import { Router } from 'express';
import { dataController } from './data.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  idParamSchema,
  createDataSchema,
  importDataSchema,
  updateDataSchema,
  listQuerySchema,
  clearQuerySchema,
} from './data.schema';

const router = Router();

// 所有数据管理操作均需登录(全员可管,无角色门槛)。
router.use(authenticate);

router.get('/', validate({ query: listQuerySchema }), dataController.list);
router.get('/:id', validate({ params: idParamSchema }), dataController.get);
router.post('/', validate({ body: createDataSchema }), dataController.create);
router.post('/import', validate({ body: importDataSchema }), dataController.import);
router.patch('/:id', validate({ params: idParamSchema, body: updateDataSchema }), dataController.update);
router.delete('/:id', validate({ params: idParamSchema }), dataController.remove);
router.delete('/', validate({ query: clearQuerySchema }), dataController.clear);

export const dataRoutes = router;
```

- [ ] **Step 5: 注册路由**

在 `apps/server/src/routes/index.ts` 顶部 import 区加一行,并在 `apiRouter.use('/templates', templatesRoutes);` 之后加一行:

import 区追加:
```ts
import { dataRoutes } from '../modules/data/data.routes';
```
注册块(在 `apiRouter.use('/templates', templatesRoutes);` 之后)追加:
```ts
apiRouter.use('/data', dataRoutes);
```

- [ ] **Step 6: 运行测试,确认通过**

Run:
```bash
pnpm --filter @mediakit/server exec vitest run src/modules/data/data.routes.test.ts
```
Expected: PASS(三个 401)。再跑全量服务端测试确认无回归:
```bash
pnpm --filter @mediakit/server test
```
Expected: 全绿。

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/modules/data/data.controller.ts apps/server/src/modules/data/data.routes.ts apps/server/src/modules/data/data.routes.test.ts apps/server/src/routes/index.ts
git commit -m "feat(server): data module routes + mount at /api/v1/data"
```

---

## Task 5: `dataLibrary.ts` client + 测试

**Files:**
- Create: `apps/web/src/api/dataLibrary.ts`
- Test: `apps/web/tests/dataLibrary.test.ts`

镜像 `apps/web/src/api/projects.ts` 的 `projectsApi` 模式(用 `apps/web/src/api/client.ts` 的 axios 单例 `api`,baseURL `/api/v1`,鉴权/401-refresh 已在 client 内处理)。

- [ ] **Step 1: 写失败测试**

创建 `apps/web/tests/dataLibrary.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock('@/api/client', () => ({ api: apiMock }));

import { dataApi } from '@/api/dataLibrary';

beforeEach(() => vi.clearAllMocks());

describe('dataApi · list', () => {
  it('GET /data?kind=campaign → 返回 records[]', async () => {
    apiMock.get.mockResolvedValue({ data: { records: [{ id: 'c1', kind: 'campaign', ownerId: 'u', data: { id: 'c1', name: 'C' }, createdAt: '', updatedAt: '' }] } });
    const r = await dataApi.list('campaign');
    expect(apiMock.get).toHaveBeenCalledWith('/data', { params: { kind: 'campaign' } });
    expect(r).toHaveLength(1);
    expect(r[0].data.id).toBe('c1');
  });
});

describe('dataApi · create / importMany / update / remove / clear', () => {
  it('create → POST /data { kind, data }', async () => {
    apiMock.post.mockResolvedValue({ data: { record: { id: 'c1' } } });
    const r = await dataApi.create('campaign', { id: 'c1', name: 'C' });
    expect(apiMock.post).toHaveBeenCalledWith('/data', { kind: 'campaign', data: { id: 'c1', name: 'C' } });
    expect(r.id).toBe('c1');
  });
  it('importMany → POST /data/import,返回 {created,updated,skipped}', async () => {
    apiMock.post.mockResolvedValue({ data: { created: 1, updated: 2, skipped: 3 } });
    const r = await dataApi.importMany('creator', [{ id: 'x' }]);
    expect(apiMock.post).toHaveBeenCalledWith('/data/import', { kind: 'creator', items: [{ id: 'x' }] });
    expect(r).toEqual({ created: 1, updated: 2, skipped: 3 });
  });
  it('update → PATCH /data/:id { data }', async () => {
    apiMock.patch.mockResolvedValue({ data: { record: { id: 'c1' } } });
    await dataApi.update('c1', { name: '新' });
    expect(apiMock.patch).toHaveBeenCalledWith('/data/c1', { data: { name: '新' } });
  });
  it('remove → DELETE /data/:id(无 body)', async () => {
    apiMock.delete.mockResolvedValue({ data: undefined });
    await dataApi.remove('c1');
    expect(apiMock.delete).toHaveBeenCalledWith('/data/c1');
  });
  it('clear → DELETE /data?kind=...,返回 {deleted}', async () => {
    apiMock.delete.mockResolvedValue({ data: { deleted: 5 } });
    const r = await dataApi.clear('campaign');
    expect(apiMock.delete).toHaveBeenCalledWith('/data', { params: { kind: 'campaign' } });
    expect(r).toEqual({ deleted: 5 });
  });
});
```

- [ ] **Step 2: 运行测试,确认失败**

Run:
```bash
pnpm --filter @mediakit/web exec vitest run tests/dataLibrary.test.ts
```
Expected: FAIL(模块不存在)。

- [ ] **Step 3: 实现 client**

创建 `apps/web/src/api/dataLibrary.ts`:

```ts
import { api } from './client';

export type DataKind = 'campaign' | 'creator';

export interface DataRecordDTO<T = unknown> {
  id: string;
  kind: 'CAMPAIGN' | 'CREATOR';
  ownerId: string;
  data: T;
  createdAt: string;
  updatedAt: string;
}

export const dataApi = {
  list: <T>(kind: DataKind) =>
    api.get<{ records: DataRecordDTO<T>[] }>('/data', { params: { kind } }).then((r) => r.data.records),
  get: <T>(id: string) =>
    api.get<{ record: DataRecordDTO<T> }>(`/data/${id}`).then((r) => r.data.record),
  create: (kind: DataKind, data: unknown) =>
    api.post<{ record: DataRecordDTO }>('/data', { kind, data }).then((r) => r.data.record),
  importMany: (kind: DataKind, items: unknown[]) =>
    api
      .post<{ created: number; updated: number; skipped: number }>('/data/import', { kind, items })
      .then((r) => r.data),
  update: (id: string, data: unknown) =>
    api.patch<{ record: DataRecordDTO }>(`/data/${id}`, { data }).then((r) => r.data.record),
  remove: (id: string) => api.delete(`/data/${id}`),
  clear: (kind: DataKind) =>
    api.delete<{ deleted: number }>('/data', { params: { kind } }).then((r) => r.data),
};
```

- [ ] **Step 4: 运行测试,确认通过**

Run:
```bash
pnpm --filter @mediakit/web exec vitest run tests/dataLibrary.test.ts
```
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/api/dataLibrary.ts apps/web/tests/dataLibrary.test.ts
git commit -m "feat(web): dataLibrary API client"
```

---

## Task 6: 把 `Creator` 类型搬入 shared + 切换 campaigns/creators 数据源

**Files:**
- Modify: `packages/shared/src/types/campaign.ts`(加 `Creator`)
- Modify: `apps/web/src/api/creators.ts`(去掉本地 interface,re-export + 切换 `listCreators`)
- Modify: `apps/web/src/api/campaigns.ts`(切换 `listCampaigns`/`getCampaign`)
- Test: `apps/web/tests/campaigns.test.ts`

`Creator` 当前定义在 `apps/web/src/api/creators.ts`(web-only)。搬到 shared 让服务端 Zod(Task 2 的 `creatorRecordDataSchema`)与 web 共一份真源(遵循 [[zod-strips-undeclared-meta-keys]])。Campaign 已在 shared。

- [ ] **Step 1: 写失败测试(campaigns 改读 dataLibrary)**

创建 `apps/web/tests/campaigns.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { listMock, getMock } = vi.hoisted(() => ({ listMock: vi.fn(), getMock: vi.fn() }));

vi.mock('@/api/dataLibrary', () => ({
  dataApi: {
    list: (k: string) => listMock(k),
    get: (id: string) => getMock(id),
  },
}));

import { listCampaigns, getCampaign } from '@/api/campaigns';

beforeEach(() => vi.clearAllMocks());

it('listCampaigns → dataApi.list("campaign") 并取 .data', async () => {
  listMock.mockResolvedValue([
    { id: 'c1', kind: 'CAMPAIGN', ownerId: 'u', data: { id: 'c1', name: 'Campaign X' }, createdAt: '', updatedAt: '' },
  ]);
  const r = await listCampaigns();
  expect(listMock).toHaveBeenCalledWith('campaign');
  expect(r).toEqual([{ id: 'c1', name: 'Campaign X' }]);
});

it('getCampaign → 命中返回 data;404/异常返回 undefined', async () => {
  getMock.mockResolvedValue({ id: 'c1', kind: 'CAMPAIGN', ownerId: 'u', data: { id: 'c1', name: 'X' }, createdAt: '', updatedAt: '' });
  expect((await getCampaign('c1'))?.id).toBe('c1');
  getMock.mockRejectedValue(new Error('404'));
  expect(await getCampaign('missing')).toBeUndefined();
});
```

- [ ] **Step 2: 运行测试,确认失败**

Run:
```bash
pnpm --filter @mediakit/web exec vitest run tests/campaigns.test.ts
```
Expected: FAIL(`listCampaigns` 仍读 mock)。

- [ ] **Step 3: 在 shared 加 `Creator`**

在 `packages/shared/src/types/campaign.ts` 的 `Campaign` interface 之后追加(字段与 web 现有 `Creator` 完全一致):

```ts
/** 上游达人(Creator / Influencer)实体(demo 中 mock;数据管理库管理)。 */
export interface Creator {
  id: string;
  name: string;
  handle: string;
  platform: string;
  /** 层级:mega / macro / micro。 */
  tier: string;
  followers: string;
  engagement: string;
  category: string;
  region: string;
  /** 达人头像 URL。 */
  avatar?: string;
  /** 达人自身频道 KPI 指标(Avg Reach/Impressions/Follower Growth/CPM)。 */
  metrics: CampaignMetric[];
}
```

`CampaignMetric` 已在该文件定义;`packages/shared/src/index.ts` 已 `export * from './types/campaign'`,故 `Creator` 自动导出。

- [ ] **Step 4: 改 `apps/web/src/api/creators.ts`**

把整个文件替换为(去掉本地 `interface Creator`,改为从 shared re-export;`listCreators` 改读 `dataApi`;`listCampaignCreators` 保持不变——仍从 creatorPerformance mock 派生,v1 限制):

```ts
/**
 * 上游达人(Creator / Influencer)接口。
 * 真实环境对接达人库/CRM;数据管理库(`/api/v1/data`)提供可导入的达人库。
 * metrics 为达人自身频道 KPI(Avg Reach/Impressions/Follower Growth/CPM)。
 */
import type { Creator } from '@mediakit/shared';
import { dataApi } from './dataLibrary';
import { listCreatorPerformance } from './creatorPerformance';
import { creatorAvatarUrl } from './creatorAvatar';

export type { Creator };

/** 从数据管理库拉取达人列表。 */
export async function listCreators(): Promise<Creator[]> {
  const records = await dataApi.list<Creator>('creator');
  return records.map((r) => r.data);
}

/**
 * 获取 Campaign 下参与合作的达人列表(从 campaign performance 数据提取)。
 * 返回的 Creator 仅含基本信息,不含 channel KPI。
 * v1 限制:对导入的 campaign 返回空(无 campaign↔达人合作明细)。
 */
export async function listCampaignCreators(campaignId: string): Promise<Creator[]> {
  const perfs = await listCreatorPerformance(campaignId);
  return perfs.map((p) => ({
    id: p.creatorId,
    name: p.creatorName,
    handle: p.handle ?? `@${p.creatorName.toLowerCase().replace(/\s+/g, '')}`,
    platform: p.platform,
    tier: p.tier,
    followers: p.summary.totalImpressions,
    engagement: p.summary.avgEngagementRate,
    category: '',
    region: '',
    avatar: creatorAvatarUrl(p.creatorName),
    metrics: [],
  }));
}
```

- [ ] **Step 5: 改 `apps/web/src/api/campaigns.ts`**

替换整个文件:

```ts
import type { Campaign } from '@mediakit/shared';
import { dataApi } from './dataLibrary';

/**
 * 上游 Campaign 接口。
 * 真实环境对接投放系统/CRM;数据管理库(`/api/v1/data`)提供可导入的 campaign 库。
 */

/** 从数据管理库拉取 campaign 列表。 */
export async function listCampaigns(): Promise<Campaign[]> {
  const records = await dataApi.list<Campaign>('campaign');
  return records.map((r) => r.data);
}

/** 按 id 取单个 campaign;不存在返回 undefined。 */
export async function getCampaign(id: string): Promise<Campaign | undefined> {
  try {
    const record = await dataApi.get<Campaign>(id);
    return record.data;
  } catch {
    return undefined;
  }
}
```

- [ ] **Step 6: 确认 mock/creators.ts 仍能 import Creator(re-export 生效)**

`apps/web/src/api/mock/creators.ts:9` 现为 `import type { Creator } from '../creators';`——经 re-export 仍解析到 shared,无需改动。运行:

Run:
```bash
pnpm --filter @mediakit/web exec vitest run tests/campaigns.test.ts && pnpm --filter @mediakit/web exec tsc --noEmit
```
Expected:测试 PASS;typecheck 无错误。

- [ ] **Step 7: 跑全量 web 测试确认无回归**

Run:
```bash
pnpm --filter @mediakit/web test
```
Expected:全绿(现有 `projects.page.test.tsx` 用 `vi.mock('@/api/campaigns')`,签名不变,不受影响)。

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/types/campaign.ts apps/web/src/api/creators.ts apps/web/src/api/campaigns.ts apps/web/tests/campaigns.test.ts
git commit -m "feat(web): move Creator to shared; listCampaigns/listCreators read data library"
```

---

## Task 7: 抽出 `DataTable` + `dataImport.ts` 工具

**Files:**
- Create: `apps/web/src/components/DataTable.tsx`(从 `MockData.tsx` 抽出,导出)
- Create: `apps/web/src/editor/dataImport.ts`(字段定义 + 预览构造 + 模板下载)
- Test: `apps/web/tests/dataImport.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `apps/web/tests/dataImport.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { buildPreviewFromRows, buildPreviewFromObjects, CAMPAIGN_REQUIRED, CREATOR_REQUIRED } from '@/editor/dataImport';

describe('dataImport · 字段定义', () => {
  it('Campaign 必填含 id/name/advertiser/businessLine/platform/startDate/endDate/budget', () => {
    expect(CAMPAIGN_REQUIRED).toEqual(['id', 'name', 'advertiser', 'businessLine', 'platform', 'startDate', 'endDate', 'budget']);
  });
  it('Creator 必填含 id/name/handle/platform/tier/followers/engagement/category/region', () => {
    expect(CREATOR_REQUIRED).toEqual(['id', 'name', 'handle', 'platform', 'tier', 'followers', 'engagement', 'category', 'region']);
  });
});

describe('dataImport · buildPreviewFromRows(CSV/XLSX)', () => {
  it('必填齐全 → valid', () => {
    const rows = [{ id: 'c1', name: 'C', advertiser: 'A', businessLine: 'FT', platform: 'TikTok', startDate: '2026-01-01', endDate: '2026-01-31', budget: '$100K' }];
    const r = buildPreviewFromRows('campaign', rows);
    expect(r[0].valid).toBe(true);
    expect(r[0].data.id).toBe('c1');
  });
  it('缺 budget → invalid,error 列出缺失字段', () => {
    const rows = [{ id: 'c1', name: 'C', advertiser: 'A', businessLine: 'FT', platform: 'TikTok', startDate: '2026-01-01', endDate: '2026-01-31' }];
    const r = buildPreviewFromRows('campaign', rows);
    expect(r[0].valid).toBe(false);
    expect(r[0].error).toContain('budget');
  });
  it('空行(无必填)→ invalid', () => {
    expect(buildPreviewFromRows('creator', [{}])[0].valid).toBe(false);
  });
});

describe('dataImport · buildPreviewFromObjects(JSON)', () => {
  it('保留完整对象(含 metrics/platforms),只校验必填', () => {
    const items = [{ id: 'c1', name: 'C', advertiser: 'A', businessLine: 'FT', platform: 'TikTok', startDate: '2026-01-01', endDate: '2026-01-31', budget: '$100K', metrics: [{ label: 'GMV', value: '$1', compare: '+1%' }] }];
    const r = buildPreviewFromObjects('campaign', items);
    expect(r[0].valid).toBe(true);
    expect((r[0].data as { metrics: unknown[] }).metrics).toHaveLength(1);
  });
  it('非对象项 → invalid', () => {
    expect(buildPreviewFromObjects('campaign', [null])[0].valid).toBe(false);
  });
});

describe('dataImport · downloadTemplate', () => {
  it('触发 Blob 下载(生成 csv 文件名)', () => {
    const urlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { downloadTemplate } = require('@/editor/dataImport');
    downloadTemplate('campaign');
    expect(urlSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    urlSpy.mockRestore(); revokeSpy.mockRestore(); clickSpy.mockRestore();
  });
});
```

- [ ] **Step 2: 运行测试,确认失败**

Run:
```bash
pnpm --filter @mediakit/web exec vitest run tests/dataImport.test.ts
```
Expected: FAIL(模块不存在)。

- [ ] **Step 3: 抽出 `DataTable`**

创建 `apps/web/src/components/DataTable.tsx`(从 `apps/web/src/routes/MockData.tsx:520-568` 原样搬出并 `export`):

```tsx
import type { ReactNode } from 'react';

interface DataTableProps {
  loading: boolean;
  headers: string[];
  rows: ReactNode[][];
}

/** 通用数据表:loading/空态占位 + 首列强调 + 行 hover。 */
export function DataTable({ loading, headers, rows }: DataTableProps) {
  if (loading) {
    return <p className="rounded-lg border border-border-default bg-surface-primary px-4 py-6 text-sm text-foreground-muted">Loading…</p>;
  }
  if (rows.length === 0) {
    return <p className="rounded-lg border border-border-default bg-surface-primary px-4 py-6 text-sm text-foreground-muted">No data</p>;
  }
  return (
    <div className="overflow-auto rounded-lg border border-border-default">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="bg-surface-hover text-left text-xs text-foreground-muted">
            {headers.map((h, i) => (
              <th key={i} className={`px-3 py-2 font-medium ${i === 0 ? '' : 'whitespace-nowrap'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-t border-border-subtle hover:bg-surface-hover/50">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`px-3 py-2 ${
                    ci === 0
                      ? 'font-medium text-foreground-primary'
                      : 'whitespace-nowrap text-foreground-secondary'
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: 实现 `dataImport.ts`**

创建 `apps/web/src/editor/dataImport.ts`:

```ts
/** 数据管理导入工具:字段定义、预览构造、模板下载。 */

export const CAMPAIGN_FIELDS = ['id', 'name', 'advertiser', 'businessLine', 'platform', 'startDate', 'endDate', 'budget', 'status', 'owner'] as const;
export const CAMPAIGN_REQUIRED = ['id', 'name', 'advertiser', 'businessLine', 'platform', 'startDate', 'endDate', 'budget'];
export const CREATOR_FIELDS = ['id', 'name', 'handle', 'platform', 'tier', 'followers', 'engagement', 'category', 'region', 'avatar'] as const;
export const CREATOR_REQUIRED = ['id', 'name', 'handle', 'platform', 'tier', 'followers', 'engagement', 'category', 'region'];

export type DataKind = 'campaign' | 'creator';

const FIELDS: Record<DataKind, readonly string[]> = { campaign: CAMPAIGN_FIELDS, creator: CREATOR_FIELDS };
const REQUIRED: Record<DataKind, string[]> = { campaign: CAMPAIGN_REQUIRED, creator: CREATOR_REQUIRED };

export interface PreviewItem {
  data: Record<string, unknown>;
  valid: boolean;
  error?: string;
}

/** 预览表格展示的列(不含 owner/avatar 等次要字段)。 */
export const PREVIEW_COLUMNS: Record<DataKind, string[]> = {
  campaign: ['id', 'name', 'advertiser', 'businessLine', 'platform', 'startDate', 'endDate', 'budget', 'status'],
  creator: ['id', 'name', 'handle', 'platform', 'tier', 'followers', 'engagement', 'category', 'region'],
};

function checkRequired(kind: DataKind, data: Record<string, unknown>): string[] {
  return REQUIRED[kind].filter((f) => data[f] === undefined || data[f] === '');
}

/** CSV/XLSX 行(Record<string,string>)→ 按表头取核心字段,校验必填。 */
export function buildPreviewFromRows(kind: DataKind, rows: Record<string, string>[]): PreviewItem[] {
  const fields = FIELDS[kind];
  return rows.map((row) => {
    const data: Record<string, unknown> = {};
    for (const f of fields) {
      const v = row[f];
      if (v !== undefined && v !== '') data[f] = v;
    }
    const missing = checkRequired(kind, data);
    return missing.length ? { data, valid: false, error: `缺字段: ${missing.join(', ')}` } : { data, valid: true };
  });
}

/** JSON 项(已是完整对象,可能含 metrics/platforms)→ 只校验必填,保留完整对象。 */
export function buildPreviewFromObjects(kind: DataKind, items: unknown[]): PreviewItem[] {
  return items.map((item) => {
    const data = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const missing = checkRequired(kind, data);
    return missing.length ? { data, valid: false, error: `缺字段: ${missing.join(', ')}` } : { data, valid: true };
  });
}

/** 下载 CSV 模板(表头对齐字段 + 一行示例)。 */
export function downloadTemplate(kind: DataKind): void {
  const fields = FIELDS[kind];
  const header = fields.join(',');
  const example =
    kind === 'campaign'
      ? 'camp-example,示例 Campaign,GlowLab,FT,TikTok,2026-01-01,2026-01-31,$100K,Active,alex'
      : 'cre-example,Mia Chen,@mia,TikTok,mega,1.28M,8.7%,Beauty,US,';
  const csv = `${header}\n${example}\n`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${kind}-template.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 5: 运行测试,确认通过**

Run:
```bash
pnpm --filter @mediakit/web exec vitest run tests/dataImport.test.ts
```
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/DataTable.tsx apps/web/src/editor/dataImport.ts apps/web/tests/dataImport.test.ts
git commit -m "feat(web): extract DataTable + dataImport util (preview/template)"
```

---

## Task 8: `ImportPreviewModal` + `RecordFormModal`

**Files:**
- Create: `apps/web/src/editor/components/ImportPreviewModal.tsx`
- Create: `apps/web/src/editor/components/RecordFormModal.tsx`
- Test: `apps/web/tests/ImportPreviewModal.test.tsx`

复用 `ImportDataModal.tsx` 的 modal chrome(`fixed inset-0 z-50 ... bg-black/40` + `max-h-[90vh] w-[...] rounded-xl bg-surface-primary p-5 shadow-xl` + 点击遮罩取消 + `e.stopPropagation()`)。

- [ ] **Step 1: 写失败测试(ImportPreviewModal)**

创建 `apps/web/tests/ImportPreviewModal.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportPreviewModal } from '@/editor/components/ImportPreviewModal';
import type { PreviewItem } from '@/editor/dataImport';

const items: PreviewItem[] = [
  { data: { id: 'c1', name: 'C1', advertiser: 'A', businessLine: 'FT', platform: 'TikTok', startDate: '2026-01-01', endDate: '2026-01-31', budget: '$100K' }, valid: true },
  { data: { id: 'c2', name: 'C2' }, valid: false, error: '缺字段: advertiser, businessLine, ...' },
];

describe('ImportPreviewModal', () => {
  it('展示行数与有效数;有效行可确认', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ImportPreviewModal kind="campaign" items={items} onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByText(/共 2 行/)).toBeInTheDocument();
    expect(screen.getByText(/有效 1/)).toBeInTheDocument();
    expect(screen.getByText('C1')).toBeInTheDocument();
    await userEvent.click(screen.getByText(/确认导入/));
    expect(onConfirm).toHaveBeenCalledWith([items[0].data]);
  });
  it('点击遮罩 → onCancel', async () => {
    const onCancel = vi.fn();
    const { container } = render(<ImportPreviewModal kind="campaign" items={items} onConfirm={vi.fn()} onCancel={onCancel} />);
    await userEvent.click(container.firstChild as Element);
    expect(onCancel).toHaveBeenCalled();
  });
  it('全无效时确认按钮 disabled', () => {
    render(<ImportPreviewModal kind="campaign" items={[items[1]]} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/确认导入/)).toBeDisabled();
  });
});
```

- [ ] **Step 2: 运行测试,确认失败**

Run:
```bash
pnpm --filter @mediakit/web exec vitest run tests/ImportPreviewModal.test.tsx
```
Expected: FAIL(组件不存在)。

- [ ] **Step 3: 实现 `ImportPreviewModal`**

创建 `apps/web/src/editor/components/ImportPreviewModal.tsx`:

```tsx
import type { DataKind, PreviewItem } from '../dataImport';
import { PREVIEW_COLUMNS } from '../dataImport';

interface Props {
  kind: DataKind;
  items: PreviewItem[];
  onConfirm: (validItems: Record<string, unknown>[]) => void;
  onCancel: () => void;
}

/** 导入预览弹窗:展示解析行 + 逐行必填校验,确认后只回传有效行。 */
export function ImportPreviewModal({ kind, items, onConfirm, onCancel }: Props) {
  const valid = items.filter((i) => i.valid);
  const columns = PREVIEW_COLUMNS[kind];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        className="flex max-h-[90vh] w-[860px] flex-col gap-3 overflow-auto rounded-xl bg-surface-primary p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-headings text-sm font-semibold text-foreground-primary">
          导入预览 · {kind === 'campaign' ? 'Campaign' : '达人库'} · 共 {items.length} 行(有效 {valid.length})
        </div>
        <div className="overflow-auto rounded-lg border border-border-default">
          <table className="w-full min-w-[640px] border-collapse text-xs">
            <thead>
              <tr className="bg-surface-hover text-left text-foreground-muted">
                {columns.map((c) => (
                  <th key={c} className="whitespace-nowrap px-2 py-1.5 font-medium">{c}</th>
                ))}
                <th className="px-2 py-1.5 font-medium">校验</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-t border-border-subtle">
                  {columns.map((c) => (
                    <td key={c} className="whitespace-nowrap px-2 py-1 text-foreground-secondary">
                      {String(it.data[c] ?? '')}
                    </td>
                  ))}
                  <td className={`px-2 py-1 ${it.valid ? 'text-accent-primary' : 'text-red'}`}>
                    {it.valid ? '✓' : it.error}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
          >
            取消
          </button>
          <button
            disabled={valid.length === 0}
            onClick={() => onConfirm(valid.map((v) => v.data))}
            className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary disabled:opacity-50"
          >
            确认导入({valid.length})
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 实现 `RecordFormModal`(新增/编辑表单)**

创建 `apps/web/src/editor/components/RecordFormModal.tsx`:

```tsx
import { useState } from 'react';
import { dataApi, type DataRecordDTO } from '@/api/dataLibrary';
import type { DataKind } from '../dataImport';

interface Props {
  kind: DataKind;
  record: DataRecordDTO | null;
  onSaved: () => void;
  onCancel: () => void;
}

interface FieldDef {
  key: string;
  label: string;
}

const CAMPAIGN_FORM_FIELDS: FieldDef[] = [
  { key: 'id', label: 'Campaign ID' },
  { key: 'name', label: '名称' },
  { key: 'advertiser', label: '广告主' },
  { key: 'businessLine', label: '业务线' },
  { key: 'platform', label: '平台' },
  { key: 'startDate', label: '开始日期' },
  { key: 'endDate', label: '结束日期' },
  { key: 'budget', label: '预算' },
  { key: 'status', label: '状态' },
  { key: 'owner', label: 'Owner' },
];
const CREATOR_FORM_FIELDS: FieldDef[] = [
  { key: 'id', label: '达人 ID' },
  { key: 'name', label: '名称' },
  { key: 'handle', label: 'Handle' },
  { key: 'platform', label: '平台' },
  { key: 'tier', label: '层级' },
  { key: 'followers', label: '粉丝' },
  { key: 'engagement', label: '互动率' },
  { key: 'category', label: '品类' },
  { key: 'region', label: '地区' },
  { key: 'avatar', label: '头像 URL' },
];

/** 新增/编辑记录表单。新增时自动生成 id(只读)。CSV 导入不到的 metrics/platforms 在此可后续 JSON 导入。 */
export function RecordFormModal({ kind, record, onSaved, onCancel }: Props) {
  const fields = kind === 'campaign' ? CAMPAIGN_FORM_FIELDS : CREATOR_FORM_FIELDS;
  const initial = (record?.data ?? {}) as Record<string, string>;
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const f of fields) o[f.key] = initial[f.key] ?? '';
    if (!record) {
      const prefix = kind === 'campaign' ? 'camp-' : 'cre-';
      o.id = `${prefix}${crypto.randomUUID().slice(0, 8)}`;
    }
    return o;
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const data: Record<string, unknown> = {};
      for (const f of fields) {
        const v = vals[f.key];
        if (v !== '') data[f.key] = v;
      }
      if (record) await dataApi.update(record.id, data);
      else await dataApi.create(kind, data);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        className="flex max-h-[90vh] w-[560px] flex-col gap-3 overflow-auto rounded-xl bg-surface-primary p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-headings text-sm font-semibold text-foreground-primary">
          {record ? '编辑' : '新增'} · {kind === 'campaign' ? 'Campaign' : '达人库'}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {fields.map((f) => {
            const autoId = f.key === 'id' && !record;
            return (
              <label key={f.key} className="flex flex-col gap-1 text-xs text-foreground-secondary">
                {f.label}{autoId ? '(自动)' : ''}
                <input
                  value={vals[f.key] ?? ''}
                  disabled={autoId}
                  onChange={(e) => setVals((p) => ({ ...p, [f.key]: e.target.value }))}
                  className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary disabled:opacity-50"
                />
              </label>
            );
          })}
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
          >
            取消
          </button>
          <button
            disabled={busy}
            onClick={() => void save()}
            className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary disabled:opacity-50"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 运行测试,确认通过**

Run:
```bash
pnpm --filter @mediakit/web exec vitest run tests/ImportPreviewModal.test.tsx && pnpm --filter @mediakit/web exec tsc --noEmit
```
Expected:测试 PASS;typecheck 无错误。

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/editor/components/ImportPreviewModal.tsx apps/web/src/editor/components/RecordFormModal.tsx apps/web/tests/ImportPreviewModal.test.tsx
git commit -m "feat(web): ImportPreviewModal + RecordFormModal"
```

---

## Task 9: `DataManagement.tsx` 页面 + 接线 + 删除 MockData

**Files:**
- Create: `apps/web/src/routes/DataManagement.tsx`
- Modify: `apps/web/src/App.tsx`(`/data` 懒加载指向 DataManagement)
- Modify: `apps/web/src/components/Layout.tsx`(导航文案「Mock 数据」→「数据管理」)
- Delete: `apps/web/src/routes/MockData.tsx`
- Test: `apps/web/tests/DataManagement.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `apps/web/tests/DataManagement.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { DataManagement } from '@/routes/DataManagement';

const { listMock, removeMock, importManyMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  removeMock: vi.fn(),
  importManyMock: vi.fn(),
}));

vi.mock('@/api/dataLibrary', () => ({
  dataApi: {
    list: (k: string) => listMock(k),
    remove: (id: string) => removeMock(id),
    importMany: (k: string, items: unknown[]) => importManyMock(k, items),
    create: vi.fn(),
    update: vi.fn(),
    get: vi.fn(),
    clear: vi.fn(),
  },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <DataManagement />
    </MemoryRouter>,
  );
}

const campaign = {
  id: 'camp-x',
  name: 'Campaign X',
  advertiser: 'GlowLab',
  businessLine: 'FT',
  platform: 'TikTok',
  startDate: '2026-01-01',
  endDate: '2026-01-31',
  budget: '$100K',
  status: 'Active',
};

describe('DataManagement page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockResolvedValue([]);
    removeMock.mockResolvedValue(undefined);
    importManyMock.mockResolvedValue({ created: 1, updated: 0, skipped: 0 });
  });

  it('渲染标题 + 两个 Tab;Campaign Tab 列表来自 dataApi.list("campaign")', async () => {
    listMock.mockResolvedValue([{ id: 'camp-x', kind: 'CAMPAIGN', ownerId: 'u', data: campaign, createdAt: '', updatedAt: '' }]);
    renderPage();
    expect(await screen.findByText('Campaign X')).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledWith('campaign');
    expect(screen.getByText('达人库')).toBeInTheDocument();
  });

  it('空库显示「导入示例数据」按钮;非空显示「清空」', async () => {
    renderPage();
    expect(await screen.findByText('导入示例数据')).toBeInTheDocument();
    expect(screen.queryByText('清空')).not.toBeInTheDocument();
  });

  it('切到达人库 Tab → list("creator")', async () => {
    listMock.mockResolvedValue([]);
    renderPage();
    await screen.findByText('导入示例数据');
    await userEvent.click(screen.getByText('达人库'));
    await waitFor(() => expect(listMock).toHaveBeenCalledWith('creator'));
  });

  it('删除按钮二次确认后调用 dataApi.remove', async () => {
    listMock.mockResolvedValue([{ id: 'camp-x', kind: 'CAMPAIGN', ownerId: 'u', data: campaign, createdAt: '', updatedAt: '' }]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    await screen.findByText('Campaign X');
    await userEvent.click(screen.getByText('删除'));
    await waitFor(() => expect(removeMock).toHaveBeenCalledWith('camp-x'));
    confirmSpy.mockRestore();
  });
});
```

- [ ] **Step 2: 运行测试,确认失败**

Run:
```bash
pnpm --filter @mediakit/web exec vitest run tests/DataManagement.test.tsx
```
Expected: FAIL(页面不存在)。

- [ ] **Step 3: 实现 `DataManagement.tsx`**

创建 `apps/web/src/routes/DataManagement.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState, type ReactNode, type ChangeEvent } from 'react';
import type { Campaign, Creator } from '@mediakit/shared';
import { MOCK_CAMPAIGNS } from '@/api/mock/campaigns';
import { MOCK_CREATORS } from '@/api/mock/creators';
import { dataApi, type DataRecordDTO } from '@/api/dataLibrary';
import { DataTable } from '@/components/DataTable';
import { ImportPreviewModal } from '@/editor/components/ImportPreviewModal';
import { RecordFormModal } from '@/editor/components/RecordFormModal';
import {
  buildPreviewFromRows,
  buildPreviewFromObjects,
  downloadTemplate,
  type DataKind,
  type PreviewItem,
} from '@/editor/dataImport';
import { parseFile } from '@/editor/datasource/parse';

export function DataManagement() {
  const [tab, setTab] = useState<DataKind>('campaign');
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="font-headings text-xl font-semibold text-foreground-primary">数据管理</h1>
      <p className="mt-1 text-sm text-foreground-secondary">
        管理 Campaign 与达人库数据,支持导入。编辑器从本库读取。
      </p>
      <div className="mt-4 flex gap-2 border-b border-border-default">
        {(['campaign', 'creator'] as DataKind[]).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm ${
              tab === k
                ? 'border-accent-primary text-foreground-primary'
                : 'border-transparent text-foreground-secondary hover:text-foreground-primary'
            }`}
          >
            {k === 'campaign' ? 'Campaign' : '达人库'}
          </button>
        ))}
      </div>
      <div className="mt-6">{tab === 'campaign' ? <DataPanel kind="campaign" /> : <DataPanel kind="creator" />}</div>
    </div>
  );
}

function useDataRecords<T>(kind: DataKind) {
  const [records, setRecords] = useState<DataRecordDTO<T>[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRecords(await dataApi.list<T>(kind));
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [kind]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { records, loading, reload };
}

function DataPanel({ kind }: { kind: DataKind }) {
  const { records, loading, reload } = useDataRecords<Campaign & Creator>(kind);
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const [editing, setEditing] = useState<DataRecordDTO | null>(null);
  const [adding, setAdding] = useState(false);
  const csvRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  const empty = !loading && records.length === 0;
  const headers: string[] =
    kind === 'campaign'
      ? ['Campaign', 'Advertiser', 'Business Line', 'Platform', 'Period', 'Budget', 'Status', 'Owner', '']
      : ['Creator', 'Handle', 'Platform', 'Tier', 'Followers', 'Engagement', 'Category', 'Region', ''];

  const actions = (r: DataRecordDTO): ReactNode => (
    <div className="flex gap-2">
      <button onClick={() => setEditing(r)} className="text-xs text-accent-primary hover:underline">编辑</button>
      <button onClick={() => void del(r.id)} className="text-xs text-red hover:underline">删除</button>
    </div>
  );

  const rows: ReactNode[][] = records.map((r) => {
    const d = r.data as Campaign & Creator;
    if (kind === 'campaign') {
      return [d.name, d.advertiser, d.businessLine, d.platform, `${d.startDate} ~ ${d.endDate}`, d.budget, d.status ?? '—', r.ownerId, actions(r)];
    }
    return [d.name, d.handle, d.platform, d.tier, d.followers, d.engagement, d.category, d.region, actions(r)];
  });

  async function del(id: string) {
    if (!window.confirm('确认删除该条记录?')) return;
    await dataApi.remove(id);
    await reload();
  }
  async function clearAll() {
    if (!window.confirm(`确认清空全部 ${kind === 'campaign' ? 'Campaign' : '达人库'} 记录?此操作不可恢复。`)) return;
    await dataApi.clear(kind);
    await reload();
  }
  async function seed() {
    const items = kind === 'campaign' ? MOCK_CAMPAIGNS : MOCK_CREATORS;
    const r = await dataApi.importMany(kind, items);
    window.alert(`导入完成:新增 ${r.created},更新 ${r.updated},跳过 ${r.skipped}`);
    await reload();
  }

  async function onCsv(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const sheets = await parseFile(f);
      setPreview(buildPreviewFromRows(kind, sheets[0]?.rows ?? []));
    } catch {
      window.alert('文件解析失败');
    }
  }
  async function onJson(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const arr = JSON.parse(await f.text());
      if (!Array.isArray(arr)) {
        window.alert('JSON 须为数组');
        return;
      }
      setPreview(buildPreviewFromObjects(kind, arr));
    } catch {
      window.alert('JSON 格式错误');
    }
  }
  async function confirmImport(validItems: Record<string, unknown>[]) {
    setPreview(null);
    const r = await dataApi.importMany(kind, validItems);
    window.alert(`导入完成:新增 ${r.created},更新 ${r.updated},跳过 ${r.skipped}`);
    await reload();
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <button onClick={() => csvRef.current?.click()} className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary">导入 CSV/XLSX</button>
        <button onClick={() => jsonRef.current?.click()} className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover">导入 JSON</button>
        <button onClick={() => downloadTemplate(kind)} className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover">下载模板</button>
        <button onClick={() => setAdding(true)} className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover">新增</button>
        {empty && (
          <button onClick={() => void seed()} className="rounded border border-accent-primary px-3 py-1 text-xs text-accent-primary hover:bg-accent-primary/10">导入示例数据</button>
        )}
        {!empty && (
          <button onClick={() => void clearAll()} className="rounded border border-border-default px-3 py-1 text-xs text-red hover:bg-surface-hover">清空</button>
        )}
        <input ref={csvRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onCsv} />
        <input ref={jsonRef} type="file" accept=".json,application/json" className="hidden" onChange={onJson} />
      </div>
      <DataTable loading={loading} headers={headers} rows={rows} />
      {preview && (
        <ImportPreviewModal kind={kind} items={preview} onConfirm={confirmImport} onCancel={() => setPreview(null)} />
      )}
      {adding && (
        <RecordFormModal kind={kind} record={null} onSaved={async () => { setAdding(false); await reload(); }} onCancel={() => setAdding(false)} />
      )}
      {editing && (
        <RecordFormModal kind={kind} record={editing} onSaved={async () => { setEditing(null); await reload(); }} onCancel={() => setEditing(null)} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: 接线 App.tsx + Layout.tsx**

改 `apps/web/src/App.tsx:12` 的懒加载:
```ts
const DataManagement = lazy(() => import('./routes/DataManagement').then((m) => ({ default: m.DataManagement })));
```
并把 `App.tsx:34` 的 `<Route path="/data" element={<MockData />} />` 改为 `<Route path="/data" element={<DataManagement />} />`。删除原 `const MockData = lazy(...)` 行。

改 `apps/web/src/components/Layout.tsx:35` 的导航文案 `Mock 数据` → `数据管理`。

- [ ] **Step 5: 删除 `apps/web/src/routes/MockData.tsx`**

确认无其它文件 import MockData(运行 `grep -rn "routes/MockData" apps/web/src`;应只剩 App.tsx 已在 Step 4 改掉)。然后:
```bash
git rm apps/web/src/routes/MockData.tsx
```

- [ ] **Step 6: 运行测试 + typecheck**

Run:
```bash
pnpm --filter @mediakit/web exec vitest run tests/DataManagement.test.tsx && pnpm --filter @mediakit/web exec tsc --noEmit
```
Expected:测试 PASS;typecheck 无错误。

- [ ] **Step 7: 跑全量 web + server 测试确认无回归**

Run:
```bash
pnpm --filter @mediakit/web test && pnpm --filter @mediakit/server test
```
Expected:全绿。

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/routes/DataManagement.tsx apps/web/src/App.tsx apps/web/src/components/Layout.tsx apps/web/tests/DataManagement.test.tsx
git rm apps/web/src/routes/MockData.tsx
git commit -m "feat(web): DataManagement page (replaces MockData) + nav rename"
```

---

## Part B — Campaign→达人 下钻(drill-down)增量

> **前置:** Part A(Task 1–9)已全部完成并提交(数据管理库 + 双 Tab + 导入 + CRUD 已可用)。本 Part 在其上追加「campaign 记录带 `creatorIds`、Campaign Tab 行可展开看合作达人」的能力,见 spec `docs/superpowers/specs/2026-07-14-data-management-drill-down-design.md`。
> **顺序:** B2 → B6 → B7 → B8 → B9(B9 依赖 B6/B7/B8)。
> **隔离与提交:** 同 Part A,worktree 内 `git add <task files> && git commit -m "..."` 原子提交;脏树上用 pathspec-only(`git commit -m "..." -- <files>`)。

---

## Task B2: `campaignRecordDataSchema` 增 `creatorIds` + 测试

**Files:**
- Modify: `apps/server/src/modules/data/data.schema.ts`(Task 2 产出)
- Modify: `apps/server/src/modules/data/data.schema.test.ts`(Task 2 产出)

- [ ] **Step 1: 写失败测试(追加到 `data.schema.test.ts` 末尾)**

```ts
describe('data.schema · campaignRecordDataSchema · creatorIds', () => {
  it('接受 creatorIds: string[]', () => {
    const c = { ...validCampaign, creatorIds: ['cre-mia', 'cre-sofia'] };
    expect(campaignRecordDataSchema.parse(c)).toEqual(c);
  });
  it('creatorIds 非数组(字符串)→ 报错', () => {
    const c = { ...validCampaign, creatorIds: 'cre-mia' };
    expect(() => campaignRecordDataSchema.parse(c)).toThrow();
  });
  it('无 creatorIds 仍通过(可选)', () => {
    expect(campaignRecordDataSchema.parse(validCampaign)).toEqual(validCampaign);
  });
});
```

- [ ] **Step 2: 运行测试,确认失败**

Run:
```bash
pnpm --filter @mediakit/server exec vitest run src/modules/data/data.schema.test.ts
```
Expected: FAIL(`creatorIds` 未被 schema 接受/未定义)。

- [ ] **Step 3: 在 `campaignRecordDataSchema` 追加 `creatorIds` 字段**

在 `apps/server/src/modules/data/data.schema.ts` 的 `campaignRecordDataSchema` 对象内(`metrics` 之后、闭合 `})` 之前)追加一行:

```ts
  creatorIds: z.array(z.string()).optional(),
```

改后该 schema 尾部应为:
```ts
  status: z.string().optional(),
  owner: z.string().optional(),
  metrics: z.array(campaignMetricSchema).optional(),
  creatorIds: z.array(z.string()).optional(),
});
```

`creatorRecordDataSchema` **不动**。`createDataSchema`/`importDataSchema`/`updateDataSchema` 入参不变(`creatorIds` 随 `data` 透传,按 kind 校验)。

- [ ] **Step 4: 运行测试,确认通过**

Run:
```bash
pnpm --filter @mediakit/server exec vitest run src/modules/data/data.schema.test.ts
```
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/data/data.schema.ts apps/server/src/modules/data/data.schema.test.ts
git commit -m "feat(server): campaignRecordDataSchema accepts creatorIds"
```

---

## Task B6: shared `Campaign.creatorIds` + `listCampaignCollaborators` + 测试

**Files:**
- Modify: `packages/shared/src/types/campaign.ts`(在已有 `Campaign` interface 追加字段)
- Modify: `apps/web/src/api/creators.ts`(Task 6 产出,追加函数)
- Create: `apps/web/tests/creators.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `apps/web/tests/creators.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getCampaignMock, getMock } = vi.hoisted(() => ({
  getCampaignMock: vi.fn(),
  getMock: vi.fn(),
}));

vi.mock('@/api/campaigns', () => ({ getCampaign: (id: string) => getCampaignMock(id) }));
vi.mock('@/api/dataLibrary', () => ({ dataApi: { get: (id: string) => getMock(id), list: vi.fn() } }));

import { listCampaignCollaborators } from '@/api/creators';

const mia = { id: 'cre-mia', kind: 'CREATOR', ownerId: 'u', data: { id: 'cre-mia', name: 'Mia', handle: '@mia', platform: 'TikTok', tier: 'mega', followers: '1M', engagement: '8%', category: 'Beauty', region: 'US', metrics: [] }, createdAt: '', updatedAt: '' };

beforeEach(() => vi.clearAllMocks());

describe('listCampaignCollaborators', () => {
  it('按 campaign.creatorIds 从达人库解析;孤儿 id(404)跳过', async () => {
    getCampaignMock.mockResolvedValue({ id: 'camp-x', creatorIds: ['cre-mia', 'cre-gone'] });
    getMock.mockImplementation((id: string) =>
      id === 'cre-mia' ? Promise.resolve(mia) : Promise.reject(new Error('404')),
    );
    const r = await listCampaignCollaborators('camp-x');
    expect(getMock).toHaveBeenCalledWith('cre-mia');
    expect(getMock).toHaveBeenCalledWith('cre-gone');
    expect(r).toEqual([mia.data]);
  });
  it('campaign 无 creatorIds → 空数组(不调 get)', async () => {
    getCampaignMock.mockResolvedValue({ id: 'camp-x' });
    const r = await listCampaignCollaborators('camp-x');
    expect(r).toEqual([]);
    expect(getMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行测试,确认失败**

Run:
```bash
pnpm --filter @mediakit/web exec vitest run tests/creators.test.ts
```
Expected: FAIL(`listCampaignCollaborators` 不存在)。

- [ ] **Step 3a: shared `Campaign` 追加 `creatorIds`**

在 `packages/shared/src/types/campaign.ts` 的 `Campaign` interface 末尾(`metrics?: CampaignMetric[];` 之后)追加:

```ts
  /** 参与 campaign 合作的达人 id 列表(数据管理库 Creator 记录 id;下钻解析用)。 */
  creatorIds?: string[];
```

- [ ] **Step 3b: 在 `apps/web/src/api/creators.ts` 追加 `listCampaignCollaborators`**

在文件顶部 import 区追加:
```ts
import { getCampaign } from './campaigns';
import { dataApi, type DataRecordDTO } from './dataLibrary';
```
(`getCampaign` 来自 Task 6 的 `campaigns.ts`;`dataApi`/`DataRecordDTO` 来自 Task 5 的 `dataLibrary.ts`。若已 import 则不重复。)

在文件末尾追加函数:

```ts
/**
 * 取某 campaign 的合作达人列表(按 campaign.creatorIds 从达人库解析)。
 * 孤儿 id(达人已删 / 404)静默跳过。导入 campaign 无 creatorIds → 返回空。
 * 与 listCampaignCreators(creatorPerformance mock 派生,服务 demo 效果展开)解耦。
 */
export async function listCampaignCollaborators(campaignId: string): Promise<Creator[]> {
  const campaign = await getCampaign(campaignId);
  const ids = campaign?.creatorIds ?? [];
  if (ids.length === 0) return [];
  const settled = await Promise.allSettled(ids.map((id) => dataApi.get<Creator>(id)));
  return settled
    .filter((r): r is PromiseFulfilledResult<DataRecordDTO<Creator>> => r.status === 'fulfilled')
    .map((r) => r.value.data);
}
```

- [ ] **Step 4: 运行测试 + typecheck**

Run:
```bash
pnpm --filter @mediakit/web exec vitest run tests/creators.test.ts && pnpm --filter @mediakit/web exec tsc --noEmit
```
Expected:测试 PASS;typecheck 无错误。

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types/campaign.ts apps/web/src/api/creators.ts apps/web/tests/creators.test.ts
git commit -m "feat(web): Campaign.creatorIds + listCampaignCollaborators"
```

---

## Task B7: dataImport `creatorIds` 字段 + CSV 列解析 + 测试

**Files:**
- Modify: `apps/web/src/editor/dataImport.ts`(Task 7 产出)
- Modify: `apps/web/tests/dataImport.test.ts`(Task 7 产出)

- [ ] **Step 1: 写失败测试(追加到 `dataImport.test.ts`;并在顶部 import 追加 `CAMPAIGN_FIELDS`)**

顶部 import 改为:
```ts
import { buildPreviewFromRows, buildPreviewFromObjects, CAMPAIGN_REQUIRED, CREATOR_REQUIRED, CAMPAIGN_FIELDS } from '@/editor/dataImport';
```
末尾追加:
```ts
describe('dataImport · creatorIds', () => {
  it('CAMPAIGN_FIELDS 含 creatorIds', () => {
    expect(CAMPAIGN_FIELDS).toContain('creatorIds');
  });
  it('buildPreviewFromRows: creatorIds 列分号分隔 → 拆数组', () => {
    const rows = [{ id: 'c1', name: 'C', advertiser: 'A', businessLine: 'FT', platform: 'TikTok', startDate: '2026-01-01', endDate: '2026-01-31', budget: '$100K', creatorIds: 'cre-mia;cre-sofia' }];
    const r = buildPreviewFromRows('campaign', rows);
    expect(r[0].valid).toBe(true);
    expect(r[0].data.creatorIds).toEqual(['cre-mia', 'cre-sofia']);
  });
  it('buildPreviewFromRows: creatorIds 空段过滤', () => {
    const rows = [{ id: 'c1', name: 'C', advertiser: 'A', businessLine: 'FT', platform: 'TikTok', startDate: '2026-01-01', endDate: '2026-01-31', budget: '$100K', creatorIds: 'cre-mia;' }];
    expect(buildPreviewFromRows('campaign', rows)[0].data.creatorIds).toEqual(['cre-mia']);
  });
  it('buildPreviewFromObjects: creatorIds 数组原样保留', () => {
    const items = [{ id: 'c1', name: 'C', advertiser: 'A', businessLine: 'FT', platform: 'TikTok', startDate: '2026-01-01', endDate: '2026-01-31', budget: '$100K', creatorIds: ['cre-mia'] }];
    expect(buildPreviewFromObjects('campaign', items)[0].data.creatorIds).toEqual(['cre-mia']);
  });
});
```

- [ ] **Step 2: 运行测试,确认失败**

Run:
```bash
pnpm --filter @mediakit/web exec vitest run tests/dataImport.test.ts
```
Expected: FAIL(`CAMPAIGN_FIELDS` 不含 `creatorIds`)。

- [ ] **Step 3: 改 `dataImport.ts`**

(a) `CAMPAIGN_FIELDS` 末尾追加 `'creatorIds'`:
```ts
export const CAMPAIGN_FIELDS = ['id', 'name', 'advertiser', 'businessLine', 'platform', 'startDate', 'endDate', 'budget', 'status', 'owner', 'creatorIds'] as const;
```
(`CAMPAIGN_REQUIRED` **不动**——`creatorIds` 非必填。)

(b) `buildPreviewFromRows` 的字段拷贝循环改为对 `creatorIds` 特殊处理(分号拆分、空段过滤):
```ts
export function buildPreviewFromRows(kind: DataKind, rows: Record<string, string>[]): PreviewItem[] {
  const fields = FIELDS[kind];
  return rows.map((row) => {
    const data: Record<string, unknown> = {};
    for (const f of fields) {
      const v = row[f];
      if (v === undefined || v === '') continue;
      if (f === 'creatorIds') {
        const ids = String(v).split(';').map((s) => s.trim()).filter(Boolean);
        if (ids.length) data.creatorIds = ids;
      } else {
        data[f] = v;
      }
    }
    const missing = checkRequired(kind, data);
    return missing.length ? { data, valid: false, error: `缺字段: ${missing.join(', ')}` } : { data, valid: true };
  });
}
```
(`buildPreviewFromObjects` 不动——对象原样保留,`creatorIds` 数组天然透传。)

(c) `downloadTemplate` 的 campaign 示例行追加 `creatorIds` 列值(与 11 个字段对齐):
```ts
  const example =
    kind === 'campaign'
      ? 'camp-example,示例 Campaign,GlowLab,FT,TikTok,2026-01-01,2026-01-31,$100K,Active,alex,cre-mia;cre-sofia'
      : 'cre-example,Mia Chen,@mia,TikTok,mega,1.28M,8.7%,Beauty,US,';
```

- [ ] **Step 4: 运行测试,确认通过**

Run:
```bash
pnpm --filter @mediakit/web exec vitest run tests/dataImport.test.ts
```
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/editor/dataImport.ts apps/web/tests/dataImport.test.ts
git commit -m "feat(web): dataImport supports creatorIds column (CSV split / JSON passthrough)"
```

---

## Task B8: `CreatorMultiSelect` 组件 + `RecordFormModal` campaign 达人多选 + 测试

**Files:**
- Create: `apps/web/src/editor/components/CreatorMultiSelect.tsx`
- Modify: `apps/web/src/editor/components/RecordFormModal.tsx`(Task 8 产出)
- Create: `apps/web/tests/CreatorMultiSelect.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `apps/web/tests/CreatorMultiSelect.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreatorMultiSelect } from '@/editor/components/CreatorMultiSelect';
import type { Creator } from '@mediakit/shared';

const creators: Creator[] = [
  { id: 'cre-mia', name: 'Mia', handle: '@mia', platform: 'TikTok', tier: 'mega', followers: '1M', engagement: '8%', category: 'Beauty', region: 'US', metrics: [] },
  { id: 'cre-sofia', name: 'Sofia', handle: '@sofia', platform: 'TikTok', tier: 'macro', followers: '500K', engagement: '7%', category: 'Beauty', region: 'US', metrics: [] },
];

describe('CreatorMultiSelect', () => {
  it('列出全部达人;勾选 → onChange 回传 id 数组', async () => {
    const onChange = vi.fn();
    render(<CreatorMultiSelect creators={creators} selected={[]} onChange={onChange} />);
    expect(screen.getByText('Mia')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/Mia/));
    expect(onChange).toHaveBeenCalledWith(['cre-mia']);
  });
  it('selected 预勾选', () => {
    render(<CreatorMultiSelect creators={creators.slice(0, 1)} selected={['cre-mia']} onChange={() => {}} />);
    expect((screen.getByLabelText(/Mia/) as HTMLInputElement).checked).toBe(true);
  });
  it('空达人库显示占位', () => {
    render(<CreatorMultiSelect creators={[]} selected={[]} onChange={() => {}} />);
    expect(screen.getByText('达人库为空')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试,确认失败**

Run:
```bash
pnpm --filter @mediakit/web exec vitest run tests/CreatorMultiSelect.test.tsx
```
Expected: FAIL(组件不存在)。

- [ ] **Step 3: 实现 `CreatorMultiSelect`**

创建 `apps/web/src/editor/components/CreatorMultiSelect.tsx`:

```tsx
import type { Creator } from '@mediakit/shared';

interface Props {
  creators: Creator[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

/** 达人多选复选框组(数据管理:campaign 关联合作达人;新增/编辑表单与「管理合作达人」共用)。 */
export function CreatorMultiSelect({ creators, selected, onChange }: Props) {
  const set = new Set(selected);
  function toggle(id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  }
  return (
    <div className="flex max-h-40 flex-col gap-1 overflow-auto rounded border border-border-default p-2">
      {creators.length === 0 && (
        <span className="text-xs text-foreground-muted">达人库为空</span>
      )}
      {creators.map((c) => (
        <label key={c.id} className="flex items-center gap-2 text-xs text-foreground-secondary">
          <input type="checkbox" checked={set.has(c.id)} onChange={() => toggle(c.id)} />
          <span className="text-foreground-primary">{c.name}</span>
          <span className="text-foreground-muted">{c.handle}</span>
        </label>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: 运行测试,确认通过**

Run:
```bash
pnpm --filter @mediakit/web exec vitest run tests/CreatorMultiSelect.test.tsx
```
Expected: PASS。

- [ ] **Step 5: 把多选接入 `RecordFormModal`(campaign kind)**

把 `apps/web/src/editor/components/RecordFormModal.tsx` 整文件替换为(在 Task 8 版本上:增 `creatorIds` state + 加载达人库 + 表单内多选 + 保存带 `creatorIds`):

```tsx
import { useState, useEffect } from 'react';
import { dataApi, type DataRecordDTO } from '@/api/dataLibrary';
import { listCreators } from '@/api/creators';
import type { Creator } from '@mediakit/shared';
import { CreatorMultiSelect } from './CreatorMultiSelect';
import type { DataKind } from '../dataImport';

interface Props {
  kind: DataKind;
  record: DataRecordDTO | null;
  onSaved: () => void;
  onCancel: () => void;
}

interface FieldDef {
  key: string;
  label: string;
}

const CAMPAIGN_FORM_FIELDS: FieldDef[] = [
  { key: 'id', label: 'Campaign ID' },
  { key: 'name', label: '名称' },
  { key: 'advertiser', label: '广告主' },
  { key: 'businessLine', label: '业务线' },
  { key: 'platform', label: '平台' },
  { key: 'startDate', label: '开始日期' },
  { key: 'endDate', label: '结束日期' },
  { key: 'budget', label: '预算' },
  { key: 'status', label: '状态' },
  { key: 'owner', label: 'Owner' },
];
const CREATOR_FORM_FIELDS: FieldDef[] = [
  { key: 'id', label: '达人 ID' },
  { key: 'name', label: '名称' },
  { key: 'handle', label: 'Handle' },
  { key: 'platform', label: '平台' },
  { key: 'tier', label: '层级' },
  { key: 'followers', label: '粉丝' },
  { key: 'engagement', label: '互动率' },
  { key: 'category', label: '品类' },
  { key: 'region', label: '地区' },
  { key: 'avatar', label: '头像 URL' },
];

/** 新增/编辑记录表单。campaign 额外可勾选合作达人(creatorIds)。 */
export function RecordFormModal({ kind, record, onSaved, onCancel }: Props) {
  const fields = kind === 'campaign' ? CAMPAIGN_FORM_FIELDS : CREATOR_FORM_FIELDS;
  const initial = (record?.data ?? {}) as Record<string, unknown>;
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const f of fields) o[f.key] = (initial[f.key] as string) ?? '';
    if (!record) {
      const prefix = kind === 'campaign' ? 'camp-' : 'cre-';
      o.id = `${prefix}${crypto.randomUUID().slice(0, 8)}`;
    }
    return o;
  });
  const [creatorIds, setCreatorIds] = useState<string[]>(
    kind === 'campaign' ? (initial.creatorIds as string[]) ?? [] : [],
  );
  const [creators, setCreators] = useState<Creator[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (kind === 'campaign') listCreators().then(setCreators).catch(() => setCreators([]));
  }, [kind]);

  async function save() {
    setBusy(true);
    try {
      const data: Record<string, unknown> = {};
      for (const f of fields) {
        const v = vals[f.key];
        if (v !== '') data[f.key] = v;
      }
      if (kind === 'campaign') data.creatorIds = creatorIds;
      if (record) await dataApi.update(record.id, data);
      else await dataApi.create(kind, data);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        className="flex max-h-[90vh] w-[560px] flex-col gap-3 overflow-auto rounded-xl bg-surface-primary p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-headings text-sm font-semibold text-foreground-primary">
          {record ? '编辑' : '新增'} · {kind === 'campaign' ? 'Campaign' : '达人库'}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {fields.map((f) => {
            const autoId = f.key === 'id' && !record;
            return (
              <label key={f.key} className="flex flex-col gap-1 text-xs text-foreground-secondary">
                {f.label}{autoId ? '(自动)' : ''}
                <input
                  value={vals[f.key] ?? ''}
                  disabled={autoId}
                  onChange={(e) => setVals((p) => ({ ...p, [f.key]: e.target.value }))}
                  className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary disabled:opacity-50"
                />
              </label>
            );
          })}
        </div>
        {kind === 'campaign' && (
          <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
            合作达人
            <CreatorMultiSelect creators={creators} selected={creatorIds} onChange={setCreatorIds} />
          </label>
        )}
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
          >
            取消
          </button>
          <button
            disabled={busy}
            onClick={() => void save()}
            className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary disabled:opacity-50"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: 运行测试 + typecheck**

Run:
```bash
pnpm --filter @mediakit/web exec vitest run tests/CreatorMultiSelect.test.tsx tests/ImportPreviewModal.test.tsx && pnpm --filter @mediakit/web exec tsc --noEmit
```
Expected:测试 PASS;typecheck 无错误。

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/editor/components/CreatorMultiSelect.tsx apps/web/src/editor/components/RecordFormModal.tsx apps/web/tests/CreatorMultiSelect.test.tsx
git commit -m "feat(web): CreatorMultiSelect + RecordFormModal campaign collaborator picker"
```

---

## Task B9: DataManagement Campaign 可展开行 + 合作达人子表 + demo 效果二级展开 + 管理合作达人 + seed 派生 creatorIds + 测试

**Files:**
- Modify: `apps/web/src/routes/DataManagement.tsx`(Task 9 产出)
- Modify: `apps/web/tests/DataManagement.test.tsx`(Task 9 产出)

> 设计要点(见 spec §4/§5/§6):Campaign Tab 用 `CampaignList`(可展开行)替 flat `DataTable`;展开行渲染 `CollaboratorPanel`——按 `creatorIds` 调 `listCampaignCollaborators` 解析合作达人,demo campaign(命中 mock)额外调 `listCreatorPerformance` 给达人行二级展开效果;「管理合作达人」用 `ManageCollaboratorsModal`(复用 `CreatorMultiSelect`)整记录重写 `creatorIds`(`dataApi.update(id, {...fullData, creatorIds})`)。`seed()` 为 demo campaign 派生 `creatorIds`。

- [ ] **Step 1: 写失败测试**

(a) 在 `apps/web/tests/DataManagement.test.tsx` 顶部 hoisted mock 区追加:
```ts
const { collaboratorsMock, listCreatorsMock, listCampaignCreatorsMock, perfMock } = vi.hoisted(() => ({
  collaboratorsMock: vi.fn(),
  listCreatorsMock: vi.fn(),
  listCampaignCreatorsMock: vi.fn(),
  perfMock: vi.fn(),
}));
vi.mock('@/api/creators', () => ({
  listCampaignCollaborators: (id: string) => collaboratorsMock(id),
  listCreators: () => listCreatorsMock(),
  listCampaignCreators: (id: string) => listCampaignCreatorsMock(id),
}));
vi.mock('@/api/creatorPerformance', () => ({
  listCreatorPerformance: (id: string) => perfMock(id),
}));
```

(b) 在文件末尾追加测试块:
```ts
describe('DataManagement · Campaign drill-down', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockResolvedValue([{ id: 'camp-x', kind: 'CAMPAIGN', ownerId: 'u', data: campaign, createdAt: '', updatedAt: '' }]);
    removeMock.mockResolvedValue(undefined);
    importManyMock.mockResolvedValue({ created: 1, updated: 0, skipped: 0 });
    updateMock.mockResolvedValue({ id: 'camp-x' });
    collaboratorsMock.mockResolvedValue([]);
    listCreatorsMock.mockResolvedValue([]);
    listCampaignCreatorsMock.mockResolvedValue([]);
    perfMock.mockResolvedValue([]);
  });

  it('展开 campaign 行 → 调 listCampaignCollaborators 并渲染合作达人', async () => {
    collaboratorsMock.mockResolvedValue([{ id: 'cre-mia', name: 'Mia', handle: '@mia', platform: 'TikTok', tier: 'mega', followers: '1M', engagement: '8%', category: 'Beauty', region: 'US', metrics: [] }]);
    renderPage();
    await screen.findByText('Campaign X');
    await userEvent.click(screen.getByRole('button', { name: /Campaign X/ }));
    await waitFor(() => expect(collaboratorsMock).toHaveBeenCalledWith('camp-x'));
    expect(await screen.findByText('@mia')).toBeInTheDocument();
  });

  it('管理合作达人:勾选 + 保存 → dataApi.update 带 creatorIds(整记录重写)', async () => {
    listCreatorsMock.mockResolvedValue([{ id: 'cre-mia', name: 'Mia', handle: '@mia', platform: 'TikTok', tier: 'mega', followers: '1M', engagement: '8%', category: 'Beauty', region: 'US', metrics: [] }]);
    renderPage();
    await screen.findByText('Campaign X');
    await userEvent.click(screen.getByRole('button', { name: /Campaign X/ }));
    await screen.findByText('管理合作达人');
    await userEvent.click(screen.getByText('管理合作达人'));
    await userEvent.click(screen.getByLabelText(/Mia/));
    await userEvent.click(screen.getByText('保存'));
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith('camp-x', { ...campaign, creatorIds: ['cre-mia'] }));
  });

  it('导入示例数据:Campaign 派生 creatorIds', async () => {
    listMock.mockResolvedValue([]); // 空库才显示「导入示例数据」
    listCampaignCreatorsMock.mockResolvedValue([{ id: 'cre-mia', name: 'Mia', handle: '@m', platform: 'TikTok', tier: 'mega', followers: '1M', engagement: '8%', category: '', region: '', metrics: [] }]);
    renderPage();
    await screen.findByText('导入示例数据');
    await userEvent.click(screen.getByText('导入示例数据'));
    await waitFor(() => expect(importManyMock).toHaveBeenCalled());
    const [, itemsArg] = importManyMock.mock.calls[0] as [string, unknown[]];
    expect((itemsArg[0] as { creatorIds: string[] }).creatorIds).toEqual(['cre-mia']);
  });
});
```

- [ ] **Step 2: 运行测试,确认失败**

Run:
```bash
pnpm --filter @mediakit/web exec vitest run tests/DataManagement.test.tsx
```
Expected: FAIL(Campaign 行不可展开 / `listCampaignCollaborators` 未被调用)。

- [ ] **Step 3: 改 `DataManagement.tsx`**

(a) 顶部 import 增补(在已有 import 区追加;`Fragment` 加入 react import):
```ts
import { useCallback, useEffect, useRef, useState, Fragment, type ReactNode, type ChangeEvent } from 'react';
import type { Campaign, Creator } from '@mediakit/shared';
import { MOCK_CAMPAIGNS } from '@/api/mock/campaigns';
import { MOCK_CREATORS } from '@/api/mock/creators';
import { dataApi, type DataRecordDTO } from '@/api/dataLibrary';
import { listCampaignCollaborators, listCreators, listCampaignCreators } from '@/api/creators';
import { listCreatorPerformance, type CreatorCampaignPerformance } from '@/api/creatorPerformance';
import { DataTable } from '@/components/DataTable';
import { ImportPreviewModal } from '@/editor/components/ImportPreviewModal';
import { RecordFormModal } from '@/editor/components/RecordFormModal';
import { CreatorMultiSelect } from '@/editor/components/CreatorMultiSelect';
import { buildPreviewFromRows, buildPreviewFromObjects, downloadTemplate, type DataKind, type PreviewItem } from '@/editor/dataImport';
import { parseFile } from '@/editor/datasource/parse';
```

(b) `seed()` 改为 campaign 派生 `creatorIds`:
```ts
  async function seed() {
    const items =
      kind === 'campaign'
        ? await Promise.all(
            MOCK_CAMPAIGNS.map(async (c) => ({
              ...c,
              creatorIds: (await listCampaignCreators(c.id)).map((cr) => cr.id),
            })),
          )
        : MOCK_CREATORS;
    const r = await dataApi.importMany(kind, items);
    window.alert(`导入完成:新增 ${r.created},更新 ${r.updated},跳过 ${r.skipped}`);
    await reload();
  }
```

(c) `DataPanel` 的 return 把 campaign 分支换成 `CampaignList`(creator 分支保持 `DataTable`):
```tsx
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {/* …工具栏按钮(导入/模板/新增/导入示例数据/清空 + 两个 file input)保持 Task 9 原样… */}
      </div>
      {kind === 'campaign' ? (
        <CampaignList
          records={records as DataRecordDTO<Campaign>[]}
          loading={loading}
          onEdit={setEditing}
          onDelete={(id) => void del(id)}
        />
      ) : (
        <DataTable loading={loading} headers={headers} rows={rows} />
      )}
      {/* …preview/adding/editing 三个 modal 保持 Task 9 原样… */}
    </div>
  );
```
> 注:`headers`/`rows`/`actions` 仍按 Task 9 计算(creator 分支用);campaign 分支改由 `CampaignList` 自绘,不再消费 `rows`。

(d) 在文件末尾(`DataPanel` 之后)追加四个新组件 `CampaignList` / `CollaboratorPanel` / `ManageCollaboratorsModal` / `CreatorPerfDetail`:

```tsx
/** Campaign 可展开列表:行展开 → 合作达人子表;每行带 编辑/删除。 */
function CampaignList({
  records,
  loading,
  onEdit,
  onDelete,
}: {
  records: DataRecordDTO<Campaign>[];
  loading: boolean;
  onEdit: (r: DataRecordDTO) => void;
  onDelete: (id: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (loading) {
    return <p className="rounded-lg border border-border-default bg-surface-primary px-4 py-6 text-sm text-foreground-muted">Loading…</p>;
  }
  if (records.length === 0) {
    return <p className="rounded-lg border border-border-default bg-surface-primary px-4 py-6 text-sm text-foreground-muted">No data</p>;
  }
  const heads = ['Campaign', 'Advertiser', 'Business Line', 'Platform', 'Period', 'Budget', 'Status', 'Owner', ''];
  return (
    <div className="overflow-auto rounded-lg border border-border-default">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="bg-surface-hover text-left text-xs text-foreground-muted">
            {heads.map((h, i) => (
              <th key={i} className={`px-3 py-2 font-medium ${i === 0 ? '' : 'whitespace-nowrap'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => {
            const d = r.data;
            const open = expandedId === r.id;
            return (
              <Fragment key={r.id}>
                <tr className="border-t border-border-subtle hover:bg-surface-hover/50">
                  <td className="px-3 py-2 font-medium text-foreground-primary">
                    <button className="text-left hover:underline" onClick={() => setExpandedId(open ? null : r.id)}>
                      {open ? '▾' : '▸'} {d.name}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{d.advertiser}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{d.businessLine}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{d.platform}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{d.startDate} ~ {d.endDate}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{d.budget}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{d.status ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{r.ownerId}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button onClick={() => onEdit(r)} className="text-xs text-accent-primary hover:underline">编辑</button>
                      <button onClick={() => onDelete(r.id)} className="text-xs text-red hover:underline">删除</button>
                    </div>
                  </td>
                </tr>
                {open && (
                  <tr>
                    <td colSpan={heads.length} className="bg-surface-secondary px-4 py-3">
                      <CollaboratorPanel record={r} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** 展开面板:合作达人子表 + 「管理合作达人」;demo campaign 命中 mock 时达人行二级展开效果。 */
function CollaboratorPanel({ record }: { record: DataRecordDTO<Campaign> }) {
  const campaignId = record.id;
  const [collaborators, setCollaborators] = useState<Creator[]>([]);
  const [perf, setPerf] = useState<CreatorCampaignPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCreator, setExpandedCreator] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [cols, perfs] = await Promise.all([
          listCampaignCollaborators(campaignId),
          listCreatorPerformance(campaignId).catch(() => []),
        ]);
        if (cancelled) return;
        setCollaborators(cols);
        setPerf(perfs);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campaignId, tick]);

  const perfByCreator = new Map(perf.map((p) => [p.creatorId, p]));
  const hasPerf = perf.length > 0;

  if (loading) return <p className="text-xs text-foreground-muted">加载合作达人…</p>;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-foreground-secondary">合作达人 · {collaborators.length}</span>
        <button onClick={() => setManaging(true)} className="text-xs text-accent-primary hover:underline">管理合作达人</button>
      </div>
      {collaborators.length === 0 ? (
        <p className="text-xs text-foreground-muted">暂无合作达人。点「管理合作达人」添加。</p>
      ) : (
        <div className="overflow-auto rounded-lg border border-border-default">
          <table className="w-full min-w-[560px] border-collapse text-xs">
            <thead>
              <tr className="bg-surface-hover text-left text-foreground-muted">
                {['Creator', 'Handle', 'Platform', 'Tier', 'Followers', 'Engagement'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-2 py-1 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {collaborators.map((c) => {
                const cp = perfByCreator.get(c.id);
                const open = expandedCreator === c.id;
                return (
                  <Fragment key={c.id}>
                    <tr className="border-t border-border-subtle">
                      <td className="px-2 py-1 font-medium text-foreground-primary">
                        {hasPerf && cp ? (
                          <button className="hover:underline" onClick={() => setExpandedCreator(open ? null : c.id)}>
                            {open ? '▾' : '▸'} {c.name}
                          </button>
                        ) : (
                          c.name
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1 text-foreground-secondary">{c.handle}</td>
                      <td className="whitespace-nowrap px-2 py-1 text-foreground-secondary">{c.platform}</td>
                      <td className="whitespace-nowrap px-2 py-1 text-foreground-secondary">{c.tier}</td>
                      <td className="whitespace-nowrap px-2 py-1 text-foreground-secondary">{c.followers}</td>
                      <td className="whitespace-nowrap px-2 py-1 text-foreground-secondary">{c.engagement}</td>
                    </tr>
                    {open && cp && (
                      <tr>
                        <td colSpan={6} className="bg-surface-primary px-3 py-2">
                          <CreatorPerfDetail perf={cp} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {managing && (
        <ManageCollaboratorsModal
          campaignId={campaignId}
          campaignData={record.data}
          currentIds={collaborators.map((c) => c.id)}
          onClose={() => setManaging(false)}
          onSaved={() => {
            setManaging(false);
            setTick((t) => t + 1);
          }}
        />
      )}
    </div>
  );
}

/** 管理合作达人:多选达人库 → 整记录重写 creatorIds(服务端 update 校验全量 data)。 */
function ManageCollaboratorsModal({
  campaignId,
  campaignData,
  currentIds,
  onClose,
  onSaved,
}: {
  campaignId: string;
  campaignData: Campaign;
  currentIds: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [selected, setSelected] = useState<string[]>(currentIds);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    listCreators().then(setCreators).catch(() => setCreators([]));
  }, []);
  async function save() {
    setBusy(true);
    try {
      await dataApi.update(campaignId, { ...campaignData, creatorIds: selected });
      onSaved();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-[480px] flex-col gap-3 overflow-auto rounded-xl bg-surface-primary p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-headings text-sm font-semibold text-foreground-primary">管理合作达人</div>
        <CreatorMultiSelect creators={creators} selected={selected} onChange={setSelected} />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover">取消</button>
          <button disabled={busy} onClick={() => void save()} className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary disabled:opacity-50">保存</button>
        </div>
      </div>
    </div>
  );
}

/** demo campaign 二级展开:达人执行效果摘要(mock 生成器,字段 summary.*)。 */
function CreatorPerfDetail({ perf }: { perf: CreatorCampaignPerformance }) {
  const s = perf.summary;
  return (
    <div className="flex flex-wrap gap-3 text-xs text-foreground-secondary">
      <span>帖数 <b className="text-foreground-primary">{s.posts}</b></span>
      <span>曝光 <b className="text-foreground-primary">{s.totalImpressions}</b></span>
      <span>互动 <b className="text-foreground-primary">{s.totalEngagement}</b></span>
      <span>互动率 <b className="text-foreground-primary">{s.avgEngagementRate}</b></span>
      <span className="text-foreground-muted">demo 数据(mock 生成器)</span>
    </div>
  );
}
```

- [ ] **Step 4: 运行测试 + typecheck**

Run:
```bash
pnpm --filter @mediakit/web exec vitest run tests/DataManagement.test.tsx && pnpm --filter @mediakit/web exec tsc --noEmit
```
Expected:测试 PASS(含三个 drill-down 用例);typecheck 无错误。

- [ ] **Step 5: 跑全量 web + server 测试确认无回归**

Run:
```bash
pnpm --filter @mediakit/web test && pnpm --filter @mediakit/server test
```
Expected:全绿。

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/routes/DataManagement.tsx apps/web/tests/DataManagement.test.tsx
git commit -m "feat(web): Campaign drill-down — expandable rows + collaborator sub-table + manage collaborators + seed creatorIds"
```

---

## Self-Review(写计划后自检)

**1. Spec 覆盖:**
- §4 Schema + 迁移 → Task 1 ✓
- §5 API(7 端点)+ Zod → Task 2(schema)+ Task 3(service)+ Task 4(controller/routes)✓;`GET /:id` 已在 routes(Task 4 `router.get('/:id')`)✓
- §6 种子策略(显式按钮 + upsert 幂等)→ Task 9 `seed()` + Task 3 `importMany` 幂等测试 ✓
- §7.1 dataLibrary client → Task 5 ✓
- §7.2 编辑器数据源切换 → Task 6 ✓
- §7.3 数据管理页(Tab/表格/工具栏/行操作)→ Task 9 ✓
- §7.4 导入流程(CSV/XLSX/JSON/手动新增/模板下载/预览)→ Task 7(util)+ Task 8(modal)+ Task 9(接线)✓
- §7.5 导航改名 → Task 9 ✓
- §8 编辑器集成(快照不变)→ 无需改动,Task 6 仅切数据源 ✓
- §9 错误处理(预览逐行校验/服务端 Zod/解析失败)→ Task 7 `buildPreview*` + Task 3 Zod + Task 9 `onCsv`/`onJson` catch ✓
- §10 测试策略 → 每 task 含 TDD 测试 ✓
- §3 v1 限制(不导入性能明细)→ Task 6 `listCampaignCreators` 注释 + 计划头部声明 ✓

**Part B / drill-down spec(`2026-07-14-data-management-drill-down-design.md`)覆盖:**
- §3 数据模型(`Campaign.creatorIds` + 服务端 Zod)→ Task B2(server Zod)+ Task B6(shared Campaign)✓
- §4 下钻 UX(可展开行 + 合作达人子表 + demo 二级展开 + 管理合作达人)→ Task B9(`CampaignList`/`CollaboratorPanel`/`ManageCollaboratorsModal`/`CreatorPerfDetail`)✓
- §5 `listCampaignCollaborators`(孤儿容忍、空 creatorIds、不改 `listCampaignCreators`)→ Task B6 ✓
- §6 creatorIds 三来源(种子派生 / CSV·JSON 导入 / 链接 UI)→ Task B9(seed)+ Task B7(import)+ Task B8/B9(链接 UI)✓
- §7 向后兼容(可选字段、无 Project/Page schema 改、无新迁移)→ 无服务端结构改动 ✓
- §9 测试(creatorIds schema / collaborators 解析 / CSV 拆分 / 多选 / 下钻渲染 / seed 派生)→ B2/B6/B7/B8/B9 各含 TDD 测试 ✓
- §12 不在范围(执行效果仍 mock、无批量端点、不改 `listCampaignCreators`/绑定模型)→ 计划头部 v1 + 各 task 注释声明 ✓

**2. Placeholder 扫描:** 无 TBD/TODO;每步含完整代码或确切命令。✓

**3. 类型一致性:**
- `DataKind` 在 `dataImport.ts`、`dataLibrary.ts`(`DataKind`)、`DataManagement.tsx` 一致 ✓
- `kindSchema`/`kind` 大小写:API 用小写(`campaign`/`creator`),DB 存大写(`CAMPAIGN`/`CREATOR`),`kindToDb` 转换 ✓;`DataRecordDTO.kind` 为大写 ✓
- `dataApi.list/create/importMany/update/remove/clear` 在 client(Task 5)与消费方(Task 6/9)签名一致 ✓
- `buildPreviewFromRows`/`buildPreviewFromObjects`/`downloadTemplate`/`PREVIEW_COLUMNS` 在 dataImport(Task 7)与 modal/page(Task 8/9)一致 ✓
- `DataRecord.id` = 数据自带 id(schema 无 `@default`),`create` 用 `valid.id` ✓;`importMany` upsert-by-id ✓
- 服务端 `validateData` 在 `create`/`update`/`importMany` 复用 ✓
- Part B:`creatorIds?: string[]` 在 shared `Campaign`(B6)↔ 服务端 `campaignRecordDataSchema`(B2)↔ `RecordFormModal`/`ManageCollaboratorsModal` 写入(B8/B9)↔ `listCampaignCollaborators` 读取(B6)签名一致;`CampaignList`/`CollaboratorPanel`/`ManageCollaboratorsModal`/`CreatorPerfDetail` props 自洽 ✓

**4. 范围检查:** 单一 feature,9 个 task 顺序依赖(server → shared → web client → web UI)。每 task 独立可测、可提交。✓

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-14-data-management.md`. Two execution options:

**1. Subagent-Driven(推荐)** — 每个 task 派一个 fresh subagent,task 间两阶段 review,迭代快。**顺序:** 先 Part A(Task 1→9),再 Part B(B2→B6→B7→B8→B9)。

**2. Inline Execution** — 在本 session 内用 executing-plans 批量执行,带 checkpoint review。同样先 Part A 后 Part B。

选哪种?
