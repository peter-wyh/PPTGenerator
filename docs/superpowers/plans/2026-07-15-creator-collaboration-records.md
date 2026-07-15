# 达人合作（Collaboration）记录 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在数据管理模块新增 `COLLABORATION` 记录类型，持久化「一次合作 = (campaign, creator) + 多种作品类型，每种带截图/效果/画像/词云」，并在「达人合作详情」抽屉里展示与编辑。

**Architecture:** 沿用 opaque-JSON `DataRecord` 模式，加第三个 `DataRecordKind`：`COLLABORATION`。确定性 id `collab:{campaignId}:{creatorId}` 便于直接 get 与幂等导入。Server Zod 按 kind 校验；service 仅扩展 kind 映射。Web 侧新增 collaboration API helper + 抽屉内的 `CollaborationDetail` 编辑器（替换 mock `CreatorPerfDetail`）。

**Tech Stack:** React + TypeScript + Tailwind + Vitest（web, jsdom）/ Vitest（server, 纯 schema 测试）/ Prisma + MySQL / Zod。共享类型在 `packages/shared`。

**Context — 执行环境：** 主分支 `main`（用户当前在此直接提交）。每任务独立提交。Prisma 迁移走「手写 SQL + `migrate deploy`」（记忆 `prisma-migrate-dev-needs-shadow-db`：`migrate dev` 因 shadow DB 权限 P3014 失败）。Task 4（迁移）需要 dev DB 在运行。web 测试遵循 `web-chart-test-convention`（recharts 在 jsdom 被 mock，只断言外壳）。

---

## File Structure

- **Create** `packages/shared/src/types/collaboration.ts` — `ContentType` / `CollaborationDeliverable` / `CollaborationData` 类型 + `collaborationId` / `collaborationLabel` helper。
- **Modify** `packages/shared/src/index.ts` — re-export collaboration 类型。
- **Modify** `apps/server/src/modules/data/data.schema.ts` — `collaborationRecordDataSchema` + 扩 `kindSchema` / `dataSchemaForKind`。
- **Create** `apps/server/src/modules/data/data.schema.test.ts` — Zod 接受/拒绝测试（纯函数，无 DB）。
- **Modify** `apps/server/src/modules/data/data.service.ts` — 导出并扩展 `kindToDb`；`update` 的 kind 推断加 `collaboration`。
- **Modify** `apps/server/prisma/schema.prisma` — `DataRecordKind` 枚举加 `COLLABORATION`。
- **Create** `apps/server/prisma/migrations/20260715000000_collaboration_kind/migration.sql` — MySQL `ALTER ... MODIFY COLUMN kind ENUM(...)`。
- **Modify** `apps/web/src/api/dataLibrary.ts` — `DataKind` + `DataRecordDTO.kind` 加 `collaboration`/`COLLABORATION`。
- **Create** `apps/web/src/api/collaborations.ts` — `getCollaboration` / `saveCollaboration` / `removeCollaboration`。
- **Create** `apps/web/src/components/CollaborationDetail.tsx` — 抽屉内的合作详情读+编辑器。
- **Modify** `apps/web/src/routes/DataManagement.tsx` — 展开行改用 `CollaborationDetail`，移除 mock `CreatorPerfDetail`/perf 取数。
- **Create** `apps/web/src/api/mock/collaborationSeed.ts` — 从 `creatorPerformance` mock 生成演示 `CollaborationData[]`（种子导入用）。
- 测试：`apps/server/src/modules/data/data.schema.test.ts`、`apps/web/tests/collaboration-detail.test.tsx`、`apps/web/tests/collaborations-api.test.ts`。

---

## Task 1: 共享类型 collaboration.ts

**Files:**
- Create: `packages/shared/src/types/collaboration.ts`
- Modify: `packages/shared/src/index.ts:16`（在 editor re-export 后加一行）

- [ ] **Step 1: 新建 collaboration.ts**

```ts
import type {
  CommentWordItem,
  WorkAudienceInsight,
  WorkMetricItem,
  WorkScreenshotItem,
} from './editor';

/** 作品类型（合作方式的构成单元）。 */
export type ContentType = 'post' | 'reels' | 'video' | 'image' | 'live' | 'story';

/** 一次合作中的一种作品类型 + 它的四类数据（均可选，按需填充）。 */
export interface CollaborationDeliverable {
  contentType: ContentType;
  /** 作品截图（captionHidden 为渲染开关，存储层忽略）。 */
  screenshots?: WorkScreenshotItem[];
  /** 效果数据。 */
  metrics?: WorkMetricItem[];
  /** 受众画像。 */
  audience?: WorkAudienceInsight;
  /** 评论词云。 */
  wordcloud?: CommentWordItem[];
}

/** 一条合作记录的 data 载荷。id 作 DataRecord 主键 = collaborationId(campaignId, creatorId)。 */
export interface CollaborationData {
  id: string;
  campaignId: string;
  creatorId: string;
  deliverables: CollaborationDeliverable[];
}

/** 确定性记录 id，便于直接 get 与幂等导入 upsert。 */
export function collaborationId(campaignId: string, creatorId: string): string {
  return `collab:${campaignId}:${creatorId}`;
}

/** 合作方式展示标签（由 contentType 组合派生，不单独存储）。 */
export function collaborationLabel(data: { deliverables: CollaborationDeliverable[] }): string {
  return data.deliverables.map((d) => d.contentType).join(' + ') || '未设置';
}
```

- [ ] **Step 2: re-export**

在 `packages/shared/src/index.ts` 的 `export * from './types/editor';` 行之后加：
```ts
export * from './types/collaboration';
```

- [ ] **Step 3: 类型检查**

Run: `pnpm --filter @mediakit/web run typecheck`
Expected: PASS（无新增错误）。

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/collaboration.ts packages/shared/src/index.ts
git commit -m "feat(shared): add CollaborationData types + helpers"
```

---

## Task 2: Server Zod — collaborationRecordDataSchema

**Files:**
- Modify: `apps/server/src/modules/data/data.schema.ts`
- Create: `apps/server/src/modules/data/data.schema.test.ts`

- [ ] **Step 1: 写失败测试（纯 schema，无 DB）**

`apps/server/src/modules/data/data.schema.test.ts`：
```ts
import { describe, it, expect } from 'vitest';
import {
  collaborationRecordDataSchema,
  dataSchemaForKind,
  kindSchema,
} from './data.schema';

const validCollab = {
  id: 'collab:c1:cr1',
  campaignId: 'c1',
  creatorId: 'cr1',
  deliverables: [
    { contentType: 'post', screenshots: [{ src: 'a.jpg' }], metrics: [{ label: '播放', value: '1.2M' }] },
    { contentType: 'reels', wordcloud: [{ text: '种草', weight: 80, sentiment: 'pos' }] },
  ],
};

describe('collaborationRecordDataSchema', () => {
  it('accepts a valid collaboration payload', () => {
    expect(collaborationRecordDataSchema.safeParse(validCollab).success).toBe(true);
  });
  it('rejects missing campaignId / creatorId / id', () => {
    const { id, ...noId } = validCollab;
    expect(collaborationRecordDataSchema.safeParse(noId).success).toBe(false);
    expect(collaborationRecordDataSchema.safeParse({ ...validCollab, campaignId: '' }).success).toBe(false);
    expect(collaborationRecordDataSchema.safeParse({ ...validCollab, creatorId: '' }).success).toBe(false);
  });
  it('rejects empty deliverables', () => {
    expect(collaborationRecordDataSchema.safeParse({ ...validCollab, deliverables: [] }).success).toBe(false);
  });
  it('rejects unknown contentType', () => {
    expect(
      collaborationRecordDataSchema.safeParse({
        ...validCollab,
        deliverables: [{ contentType: 'bogus' }],
      }).success,
    ).toBe(false);
  });
  it('kindSchema + dataSchemaForKind route collaboration', () => {
    expect(kindSchema.safeParse('collaboration').success).toBe(true);
    expect(dataSchemaForKind('collaboration')).toBe(collaborationRecordDataSchema);
  });
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `pnpm --filter @mediakit/server exec vitest run src/modules/data/data.schema.test.ts`
Expected: FAIL（`collaborationRecordDataSchema` 未导出；`kindSchema` 不含 'collaboration'）。

- [ ] **Step 3: 实现 schema**

在 `data.schema.ts` 顶部 `kindSchema` 之前加子 schema，并改 `kindSchema` / `dataSchemaForKind`：

把
```ts
/** 数据记录类型(与 Prisma DataRecordKind 对齐:DB 存大写,API 用小写)。 */
export const kindSchema = z.enum(['campaign', 'creator']);
```
改为
```ts
/** 数据记录类型(与 Prisma DataRecordKind 对齐:DB 存大写,API 用小写)。 */
export const kindSchema = z.enum(['campaign', 'creator', 'collaboration']);
```

在 `creatorRecordDataSchema` 定义之后、`dataSchemaForKind` 之前，插入：
```ts
/** Collaboration 子 schema（镜像 shared CollaborationData）。 */
const contentTypeSchema = z.enum(['post', 'reels', 'video', 'image', 'live', 'story']);
const screenshotItemSchema = z.object({
  src: z.string(),
  caption: z.string().optional(),
  captionHidden: z.boolean().optional(),
});
const collaborationMetricSchema = z.object({
  label: z.string(),
  value: z.string(),
  color: z.string().optional(),
});
const namedValueSchema = z.object({ label: z.string(), value: z.number(), color: z.string().optional() });
const trendPointSchema = z.object({ label: z.string(), value: z.number() });
const audienceInsightSchema = z.object({
  topCities: z.array(namedValueSchema).optional(),
  genderSplit: z.array(namedValueSchema).optional(),
  ageRange: z.array(namedValueSchema).optional(),
  trend: z.array(trendPointSchema).optional(),
  trendLabel: z.string().optional(),
});
const wordItemSchema = z.object({
  text: z.string(),
  weight: z.number(),
  sentiment: z.enum(['pos', 'neg', 'neutral']),
});
const deliverableSchema = z.object({
  contentType: contentTypeSchema,
  screenshots: z.array(screenshotItemSchema).optional(),
  metrics: z.array(collaborationMetricSchema).optional(),
  audience: audienceInsightSchema.optional(),
  wordcloud: z.array(wordItemSchema).optional(),
});

/** Collaboration 记录数据(镜像 shared CollaborationData)。 */
export const collaborationRecordDataSchema = z.object({
  id: z.string().min(1),
  campaignId: z.string().min(1),
  creatorId: z.string().min(1),
  deliverables: z.array(deliverableSchema).min(1),
});
```

把
```ts
export function dataSchemaForKind(kind: 'campaign' | 'creator') {
  return kind === 'campaign' ? campaignRecordDataSchema : creatorRecordDataSchema;
}
```
改为
```ts
export function dataSchemaForKind(kind: 'campaign' | 'creator' | 'collaboration') {
  if (kind === 'campaign') return campaignRecordDataSchema;
  if (kind === 'collaboration') return collaborationRecordDataSchema;
  return creatorRecordDataSchema;
}
```

- [ ] **Step 4: 运行，确认通过**

Run: `pnpm --filter @mediakit/server exec vitest run src/modules/data/data.schema.test.ts`
Expected: PASS（6 tests）。

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/data/data.schema.ts apps/server/src/modules/data/data.schema.test.ts
git commit -m "feat(server): collaboration Zod schema + kind routing"
```

---

## Task 3: Server service — kind 映射扩展

**Files:**
- Modify: `apps/server/src/modules/data/data.service.ts:10-12`（kindToDb）与 `:92-100`（update）

- [ ] **Step 1: 写失败测试（导出 kindToDb 后测映射）**

在 `data.schema.test.ts` 末尾追加一个 describe（或新建 `data.service.test.ts`）：
```ts
import { kindToDb } from './data.service';

describe('kindToDb', () => {
  it('maps all three kinds to uppercase Prisma enum', () => {
    expect(kindToDb('campaign')).toBe('CAMPAIGN');
    expect(kindToDb('creator')).toBe('CREATOR');
    expect(kindToDb('collaboration')).toBe('COLLABORATION');
  });
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `pnpm --filter @mediakit/server exec vitest run src/modules/data/data.schema.test.ts`
Expected: FAIL（`kindToDb` 未导出；不识别 'collaboration'）。

- [ ] **Step 3: 导出并扩展 kindToDb**

把 `data.service.ts` 的
```ts
/** API 小写 kind → Prisma 大写枚举。 */
function kindToDb(kind: Kind): 'CAMPAIGN' | 'CREATOR' {
  return kind === 'campaign' ? 'CAMPAIGN' : 'CREATOR';
}
```
改为
```ts
/** API 小写 kind → Prisma 大写枚举。 */
export function kindToDb(kind: Kind): 'CAMPAIGN' | 'CREATOR' | 'COLLABORATION' {
  if (kind === 'campaign') return 'CAMPAIGN';
  if (kind === 'collaboration') return 'COLLABORATION';
  return 'CREATOR';
}
```

- [ ] **Step 4: 扩展 update 的 kind 推断**

把 `update` 里的
```ts
    const kind: Kind = rec.kind === 'CAMPAIGN' ? 'campaign' : 'creator';
```
改为
```ts
    const kind: Kind =
      rec.kind === 'CAMPAIGN' ? 'campaign' : rec.kind === 'COLLABORATION' ? 'collaboration' : 'creator';
```

- [ ] **Step 5: 运行，确认通过**

Run: `pnpm --filter @mediakit/server exec vitest run src/modules/data/data.schema.test.ts`
Expected: PASS。

- [ ] **Step 6: 类型检查**

Run: `pnpm --filter @mediakit/server run typecheck`
Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/modules/data/data.service.ts apps/server/src/modules/data/data.schema.test.ts
git commit -m "feat(server): route collaboration kind in dataService"
```

---

## Task 4: Prisma 枚举 + 迁移（需 dev DB 运行）

**Files:**
- Modify: `apps/server/prisma/schema.prisma:91-95`（DataRecordKind 枚举）
- Create: `apps/server/prisma/migrations/20260715000000_collaboration_kind/migration.sql`

- [ ] **Step 1: 改 schema 枚举**

把
```prisma
/// 数据记录类型。
enum DataRecordKind {
  CAMPAIGN
  CREATOR
}
```
改为
```prisma
/// 数据记录类型。
enum DataRecordKind {
  CAMPAIGN
  CREATOR
  COLLABORATION
}
```

- [ ] **Step 2: 手写迁移 SQL**

创建 `apps/server/prisma/migrations/20260715000000_collaboration_kind/migration.sql`：
```sql
-- 数据记录类型新增 COLLABORATION（达人合作：合作方式 + 每种作品类型的截图/效果/画像/词云）。
ALTER TABLE `DataRecord` MODIFY COLUMN `kind` ENUM('CAMPAIGN', 'CREATOR', 'COLLABORATION') NOT NULL;
```

- [ ] **Step 3: 应用迁移（migrate deploy，不用 migrate dev）**

Run: `pnpm --filter @mediakit/server exec prisma migrate deploy`
Expected: `Applied migration 20260715000000_collaboration_kind`（需 dev DB 在运行；若 DB 未起，先起 DB 再跑）。

- [ ] **Step 4: 重新生成 client**

Run: `pnpm --filter @mediakit/server exec prisma generate`
Expected: 生成成功（`DataRecordKind` 含 `COLLABORATION`）。

- [ ] **Step 5: Commit**

```bash
git add apps/server/prisma/schema.prisma apps/server/prisma/migrations/20260715000000_collaboration_kind/migration.sql
git commit -m "feat(server): add COLLABORATION to DataRecordKind + migration"
```

---

## Task 5: Web API — DataKind + collaboration helpers

**Files:**
- Modify: `apps/web/src/api/dataLibrary.ts:3,7`
- Create: `apps/web/src/api/collaborations.ts`
- Create: `apps/web/tests/collaborations-api.test.ts`

- [ ] **Step 1: 扩 DataKind + DTO kind 联合**

`dataLibrary.ts`：
```ts
export type DataKind = 'campaign' | 'creator' | 'collaboration';

export interface DataRecordDTO<T = unknown> {
  id: string;
  kind: 'CAMPAIGN' | 'CREATOR' | 'COLLABORATION';
  ownerId: string;
  data: T;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: 写失败测试**

`apps/web/tests/collaborations-api.test.ts`：
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CollaborationData } from '@mediakit/shared';
import { collaborationId } from '@mediakit/shared';

vi.mock('@/api/dataLibrary', () => ({
  dataApi: {
    get: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
  },
}));

import { dataApi } from '@/api/dataLibrary';
import { getCollaboration, saveCollaboration } from '@/api/collaborations';

const collab: CollaborationData = {
  id: collaborationId('c1', 'cr1'),
  campaignId: 'c1',
  creatorId: 'cr1',
  deliverables: [{ contentType: 'post' }],
};

beforeEach(() => vi.clearAllMocks());

describe('collaboration api helpers', () => {
  it('getCollaboration returns data on hit, null on miss', async () => {
    vi.mocked(dataApi.get).mockResolvedValueOnce({ ...({} as never), data: collab });
    await expect(getCollaboration('c1', 'cr1')).resolves.toEqual(collab);
    vi.mocked(dataApi.get).mockRejectedValueOnce(new Error('404'));
    await expect(getCollaboration('c1', 'cr1')).resolves.toBeNull();
  });
  it('saveCollaboration updates when record exists, creates on miss', async () => {
    vi.mocked(dataApi.update).mockResolvedValueOnce({} as never);
    await saveCollaboration(collab);
    expect(dataApi.update).toHaveBeenCalledWith(collab.id, collab);
    expect(dataApi.create).not.toHaveBeenCalled();

    vi.mocked(dataApi.update).mockRejectedValueOnce(new Error('404'));
    vi.mocked(dataApi.create).mockResolvedValueOnce({} as never);
    await saveCollaboration(collab);
    expect(dataApi.create).toHaveBeenCalledWith('collaboration', collab);
  });
});
```

- [ ] **Step 3: 运行，确认失败**

Run: `pnpm --filter @mediakit/web exec vitest run tests/collaborations-api.test.ts`
Expected: FAIL（`@/api/collaborations` 不存在）。

- [ ] **Step 4: 实现 collaborations.ts**

`apps/web/src/api/collaborations.ts`：
```ts
import { dataApi } from './dataLibrary';
import { collaborationId, type CollaborationData } from '@mediakit/shared';

/** 读取一个 (campaign, creator) 的合作记录；不存在返回 null。 */
export async function getCollaboration(
  campaignId: string,
  creatorId: string,
): Promise<CollaborationData | null> {
  try {
    const r = await dataApi.get<CollaborationData>(collaborationId(campaignId, creatorId));
    return r.data;
  } catch {
    return null;
  }
}

/** 保存合作记录：先 update，不存在（404）则 create。data.id 强制为确定性 id。 */
export async function saveCollaboration(data: CollaborationData): Promise<void> {
  const id = collaborationId(data.campaignId, data.creatorId);
  const payload: CollaborationData = { ...data, id };
  try {
    await dataApi.update(id, payload);
  } catch {
    await dataApi.create('collaboration', payload);
  }
}

/** 删除合作记录；不存在静默忽略。 */
export async function removeCollaboration(campaignId: string, creatorId: string): Promise<void> {
  await dataApi.remove(collaborationId(campaignId, creatorId)).catch(() => {});
}
```

- [ ] **Step 5: 运行，确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run tests/collaborations-api.test.ts`
Expected: PASS（2 tests）。

- [ ] **Step 6: 类型检查**

Run: `pnpm --filter @mediakit/web run typecheck`
Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/api/dataLibrary.ts apps/web/src/api/collaborations.ts apps/web/tests/collaborations-api.test.ts
git commit -m "feat(web): collaboration API helpers (get/save/remove)"
```

---

## Task 6: CollaborationDetail 组件 + 接入抽屉

**Files:**
- Create: `apps/web/src/components/CollaborationDetail.tsx`
- Modify: `apps/web/src/routes/DataManagement.tsx`（展开行；移除 `CreatorPerfDetail` 与 perf 取数）
- Create: `apps/web/tests/collaboration-detail.test.tsx`

- [ ] **Step 1: 写失败测试**

`apps/web/tests/collaboration-detail.test.tsx`：
```ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CollaborationDetail } from '@/components/CollaborationDetail';
import type { CollaborationData } from '@mediakit/shared';
import { collaborationId } from '@mediakit/shared';

vi.mock('@/api/collaborations', () => ({
  getCollaboration: vi.fn(),
  saveCollaboration: vi.fn().mockResolvedValue(undefined),
  removeCollaboration: vi.fn().mockResolvedValue(undefined),
}));

import { getCollaboration } from '@/api/collaborations';

const collab: CollaborationData = {
  id: collaborationId('c1', 'cr1'),
  campaignId: 'c1',
  creatorId: 'cr1',
  deliverables: [
    { contentType: 'post', metrics: [{ label: '播放', value: '1.2M' }] },
    { contentType: 'reels', screenshots: [{ src: 'r.jpg' }] },
  ],
};

describe('CollaborationDetail', () => {
  it('renders 合作方式 label derived from deliverables', async () => {
    vi.mocked(getCollaboration).mockResolvedValueOnce(collab);
    render(<CollaborationDetail campaignId="c1" creatorId="cr1" creatorName="Mia" onChange={() => {}} />);
    await waitFor(() => expect(screen.getByText(/合作方式/)).toBeInTheDocument());
    expect(screen.getByText('post + reels')).toBeInTheDocument();
    expect(screen.getByText('post')).toBeInTheDocument();
    expect(screen.getByText('reels')).toBeInTheDocument();
  });

  it('shows empty state when no collaboration record', async () => {
    vi.mocked(getCollaboration).mockResolvedValueOnce(null);
    render(<CollaborationDetail campaignId="c1" creatorId="cr1" creatorName="Mia" onChange={() => {}} />);
    await waitFor(() => expect(screen.getByText(/未设置/)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `pnpm --filter @mediakit/web exec vitest run tests/collaboration-detail.test.tsx`
Expected: FAIL（`@/components/CollaborationDetail` 不存在）。

- [ ] **Step 3: 实现 CollaborationDetail.tsx**

`apps/web/src/components/CollaborationDetail.tsx`：
```tsx
import { useEffect, useState } from 'react';
import type {
  CollaborationData,
  CollaborationDeliverable,
  ContentType,
  WorkScreenshotItem,
  WorkMetricItem,
  CommentWordItem,
} from '@mediakit/shared';
import { collaborationId, collaborationLabel } from '@mediakit/shared';
import { ImageInput } from '@/components/ImageInput';
import { getCollaboration, saveCollaboration, removeCollaboration } from '@/api/collaborations';

const CONTENT_TYPES: ContentType[] = ['post', 'reels', 'video', 'image', 'live', 'story'];

const EMPTY: CollaborationData = { id: '', campaignId: '', creatorId: '', deliverables: [] };

/** 抽屉内：一个达人的合作详情——合作方式 + 每种作品类型的四类数据编辑器。 */
export function CollaborationDetail({
  campaignId,
  creatorId,
  creatorName,
  onChange,
}: {
  campaignId: string;
  creatorId: string;
  creatorName: string;
  onChange?: () => void;
}) {
  const [data, setData] = useState<CollaborationData | null>(null); // null = 加载中
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCollaboration(campaignId, creatorId).then((c) => {
      if (!cancelled) setData(c ?? { ...EMPTY, id: collaborationId(campaignId, creatorId), campaignId, creatorId });
    });
    return () => {
      cancelled = true;
    };
  }, [campaignId, creatorId]);

  if (!data) return <div className="text-xs text-foreground-muted">加载合作…</div>;

  const label = collaborationLabel(data);

  async function save() {
    await saveCollaboration(data!);
    setEditing(false);
    onChange?.();
  }
  async function remove() {
    await removeCollaboration(campaignId, creatorId);
    setData({ ...EMPTY, id: collaborationId(campaignId, creatorId), campaignId, creatorId });
    setEditing(false);
    onChange?.();
  }

  function patch(fn: (d: CollaborationData) => CollaborationData) {
    setData((prev) => (prev ? fn(prev) : prev));
  }
  const addDeliverable = () =>
    patch((d) => ({ ...d, deliverables: [...d.deliverables, { contentType: 'post' }] }));
  const setDeliverable = (i: number, del: CollaborationDeliverable) =>
    patch((d) => ({ ...d, deliverables: d.deliverables.map((x, idx) => (idx === i ? del : x)) }));
  const removeDeliverable = (i: number) =>
    patch((d) => ({ ...d, deliverables: d.deliverables.filter((_, idx) => idx !== i) }));

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-foreground-muted">合作方式：<b className="text-foreground-primary">{label}</b></span>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button onClick={() => void save()} className="text-accent-primary hover:underline">保存</button>
              <button onClick={() => setEditing(false)} className="text-foreground-secondary hover:underline">取消</button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="text-accent-primary hover:underline">编辑合作</button>
          )}
          {data.deliverables.length > 0 && (
            <button onClick={() => void remove()} className="text-red hover:underline">删除</button>
          )}
        </div>
      </div>

      {data.deliverables.length === 0 && !editing ? (
        <p className="text-foreground-muted">未设置合作。点「编辑合作」添加作品类型。</p>
      ) : (
        data.deliverables.map((del, i) => (
          <DeliverableEditor
            key={i}
            deliverable={del}
            editing={editing}
            onChange={(d) => setDeliverable(i, d)}
            onRemove={() => removeDeliverable(i)}
          />
        ))
      )}

      {editing && (
        <button onClick={addDeliverable} className="text-accent-primary hover:underline">+ 添加作品类型</button>
      )}
    </div>
  );
}

/** 单个作品类型的四类数据编辑/展示。 */
function DeliverableEditor({
  deliverable,
  editing,
  onChange,
  onRemove,
}: {
  deliverable: CollaborationDeliverable;
  editing: boolean;
  onChange: (d: CollaborationDeliverable) => void;
  onRemove: () => void;
}) {
  const { contentType, screenshots = [], metrics = [], audience, wordcloud = [] } = deliverable;
  const patch = (p: Partial<CollaborationDeliverable>) => onChange({ ...deliverable, ...p });

  const setScreenshots = (s: WorkScreenshotItem[]) => patch({ screenshots: s });
  const setMetrics = (m: WorkMetricItem[]) => patch({ metrics: m });
  const setWords = (w: CommentWordItem[]) => patch({ wordcloud: w });

  return (
    <div className="rounded border border-border-subtle p-2">
      <div className="mb-1 flex items-center gap-2">
        {editing ? (
          <select
            value={contentType}
            onChange={(e) => patch({ contentType: e.target.value as ContentType })}
            className="rounded border border-border-default px-1 py-0.5"
          >
            {CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        ) : (
          <span className="font-medium text-foreground-primary">{contentType}</span>
        )}
        {editing && (
          <button onClick={onRemove} className="ml-auto text-red hover:underline">移除</button>
        )}
      </div>

      {/* 作品截图 */}
      <Section title="作品截图" editing={editing} onAdd={() => setScreenshots([...screenshots, { src: '' }])}>
        {screenshots.map((s, i) => (
          <div key={i} className="flex items-center gap-1">
            <ImageInput value={s.src} onChange={(url) => setScreenshots(screenshots.map((x, idx) => (idx === i ? { ...x, src: url } : x)))} />
            <input
              value={s.caption ?? ''}
              placeholder="说明"
              disabled={!editing}
              onChange={(e) => setScreenshots(screenshots.map((x, idx) => (idx === i ? { ...x, caption: e.target.value } : x)))}
              className="w-24 rounded border border-border-default px-1 py-0.5 disabled:bg-transparent"
            />
            {editing && <button onClick={() => setScreenshots(screenshots.filter((_, idx) => idx !== i))} className="text-red">✕</button>}
          </div>
        ))}
      </Section>

      {/* 效果数据 */}
      <Section title="效果数据" editing={editing} onAdd={() => setMetrics([...metrics, { label: '', value: '' }])}>
        {metrics.map((m, i) => (
          <div key={i} className="flex items-center gap-1">
            <input value={m.label} placeholder="指标" disabled={!editing}
              onChange={(e) => setMetrics(metrics.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))}
              className="w-20 rounded border border-border-default px-1 py-0.5 disabled:bg-transparent" />
            <input value={m.value} placeholder="数值" disabled={!editing}
              onChange={(e) => setMetrics(metrics.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)))}
              className="w-24 rounded border border-border-default px-1 py-0.5 disabled:bg-transparent" />
            {editing && <button onClick={() => setMetrics(metrics.filter((_, idx) => idx !== i))} className="text-red">✕</button>}
          </div>
        ))}
      </Section>

      {/* 评论词云 */}
      <Section title="评论词云" editing={editing} onAdd={() => setWords([...wordcloud, { text: '', weight: 50, sentiment: 'neutral' }])}>
        {wordcloud.map((w, i) => (
          <div key={i} className="flex items-center gap-1">
            <input value={w.text} placeholder="词" disabled={!editing}
              onChange={(e) => setWords(wordcloud.map((x, idx) => (idx === i ? { ...x, text: e.target.value } : x)))}
              className="w-20 rounded border border-border-default px-1 py-0.5 disabled:bg-transparent" />
            <input type="number" value={w.weight} disabled={!editing}
              onChange={(e) => setWords(wordcloud.map((x, idx) => (idx === i ? { ...x, weight: Number(e.target.value) } : x)))}
              className="w-14 rounded border border-border-default px-1 py-0.5 disabled:bg-transparent" />
            <select value={w.sentiment} disabled={!editing}
              onChange={(e) => setWords(wordcloud.map((x, idx) => (idx === i ? { ...x, sentiment: e.target.value as CommentWordItem['sentiment'] } : x)))}
              className="rounded border border-border-default px-1 py-0.5 disabled:bg-transparent">
              <option value="pos">pos</option><option value="neg">neg</option><option value="neutral">neutral</option>
            </select>
            {editing && <button onClick={() => setWords(wordcloud.filter((_, idx) => idx !== i))} className="text-red">✕</button>}
          </div>
        ))}
      </Section>

      {/* 画像（v1 只读展示概要；编辑留后续，避免表单爆炸） */}
      <div className="text-foreground-muted">
        画像：{audience ? `${(audience.topCities ?? []).length} 城 / ${(audience.genderSplit ?? []).length} 性别 / ${(audience.ageRange ?? []).length} 年龄` : '暂无'}
      </div>
    </div>
  );
}

function Section({ title, editing, onAdd, children }: { title: string; editing: boolean; onAdd: () => void; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <div className="flex items-center gap-2 text-foreground-secondary">
        <span>{title}</span>
        {editing && <button onClick={onAdd} className="text-accent-primary hover:underline">+ 添加</button>}
      </div>
      <div className="ml-2 space-y-0.5">{children}</div>
    </div>
  );
}
```

> 画像（audience）v1 只做概要只读，避免一个抽屉塞 9 个输入列表；后续可补全编辑器（与本任务正交）。

- [ ] **Step 4: 运行，确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run tests/collaboration-detail.test.tsx`
Expected: PASS（2 tests）。

- [ ] **Step 5: 接入抽屉 — 改 DataManagement.tsx**

在 `DataManagement.tsx` 顶部 import 加：
```ts
import { CollaborationDetail } from '@/components/CollaborationDetail';
```

把 `CollaboratorPanel` 展开行的内容从 mock perf 改为 collaboration 详情。把
```tsx
                    {open && cp && (
                      <tr>
                        <td colSpan={6} className="bg-surface-primary px-3 py-2">
                          <CreatorPerfDetail perf={cp} />
                        </td>
                      </tr>
                    )}
```
改为
```tsx
                    {open && (
                      <tr>
                        <td colSpan={6} className="bg-surface-primary px-3 py-2">
                          <CollaborationDetail
                            campaignId={campaignId}
                            creatorId={c.id}
                            creatorName={c.name}
                            onChange={() => setTick((t) => t + 1)}
                          />
                        </td>
                      </tr>
                    )}
```

并把展开按钮的条件从「需要 mock perf」改为「始终可展开」。把
```tsx
                        {hasPerf && cp ? (
                          <button className="hover:underline" onClick={() => setExpandedCreator(open ? null : c.id)}>
                            {open ? '▾' : '▸'} {c.name}
                          </button>
                        ) : (
                          c.name
                        )}
```
改为
```tsx
                        <button className="hover:underline" onClick={() => setExpandedCreator(open ? null : c.id)}>
                          {open ? '▾' : '▸'} {c.name}
                        </button>
```

删除不再使用的 `CreatorPerfDetail` 函数（约 `:451-462`）。若 `listCreatorPerformance` / `perf` / `hasPerf` / `CreatorCampaignPerformance` 在此文件其它处不再使用，一并删除（`rg "listCreatorPerformance\|CreatorCampaignPerformance\|hasPerf\|perfByCreator" apps/web/src/routes/DataManagement.tsx` 确认无残留引用；保留 import 会触发 lint unused）。

- [ ] **Step 6: 类型检查 + 相关测试**

Run: `pnpm --filter @mediakit/web run typecheck && pnpm --filter @mediakit/web exec vitest run tests/collaboration-detail.test.tsx`
Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/CollaborationDetail.tsx apps/web/src/routes/DataManagement.tsx apps/web/tests/collaboration-detail.test.tsx
git commit -m "feat(web): CollaborationDetail editor in 达人合作详情 drawer"
```

---

## Task 7: 演示种子导入

**Files:**
- Create: `apps/web/src/api/mock/collaborationSeed.ts`
- Modify: `apps/web/src/routes/DataManagement.tsx`（CollaboratorPanel 加「导入演示数据」按钮）

- [ ] **Step 1: 实现种子生成器**

`apps/web/src/api/mock/collaborationSeed.ts`：
```ts
import type { CollaborationData, CollaborationDeliverable, ContentType } from '@mediakit/shared';
import { collaborationId } from '@mediakit/shared';
import { campaignCreatorWorks } from './creatorPerformance';
import { dataApi } from '../dataLibrary';

/** 从 creatorPerformance mock 为 (campaign, creator) 组装一条合作记录（演示用）。 */
export function buildSeedCollaboration(campaignId: string, creatorId: string): CollaborationData {
  const works = campaignCreatorWorks(campaignId).find((w) => w.creatorId === creatorId);
  const deliverables: CollaborationDeliverable[] = [];
  for (const p of works?.posts ?? []) {
    // 粗略按 platform 推断 contentType（demo）
    const contentType: ContentType = /video|reel/i.test(p.platform) ? 'reels' : 'post';
    deliverables.push({
      contentType,
      screenshots: [{ src: p.cover, caption: p.title }],
      metrics: [
        { label: '曝光', value: p.impressions },
        { label: '点赞', value: p.likes },
        { label: '评论', value: p.comments },
      ],
    });
  }
  if (deliverables.length === 0) deliverables.push({ contentType: 'post' });
  return { id: collaborationId(campaignId, creatorId), campaignId, creatorId, deliverables };
}

/** 幂等导入一个 campaign 所有合作达人的演示合作记录。 */
export async function importSeedCollaborations(campaignId: string, creatorIds: string[]) {
  const items = creatorIds.map((cid) => buildSeedCollaboration(campaignId, cid));
  return dataApi.importMany('collaboration', items);
}
```

> 注：`campaignCreatorWorks` 的返回项字段名（`posts[].cover/impressions/likes/comments/platform/title`）需与 `apps/web/src/api/mock/creatorPerformance.ts` 实际导出的 `CreatorWorkPost` 形状对齐；实现时以该文件为准（若字段名不同，按实际改）。

- [ ] **Step 2: 抽屉加「导入演示数据」按钮**

在 `CollaboratorPanel` 的「管理合作达人」按钮旁加：
```tsx
<button
  onClick={() => void importSeedCollaborations(campaignId, collaborators.map((c) => c.id)).then(() => setTick((t) => t + 1))}
  className="text-xs text-accent-primary hover:underline"
>
  导入演示数据
</button>
```
并在 `DataManagement.tsx` 顶部 import：`import { importSeedCollaborations } from '@/api/mock/collaborationSeed';`

- [ ] **Step 3: 类型检查 + 全量 web 测试**

Run: `pnpm --filter @mediakit/web run typecheck && pnpm --filter @mediakit/web exec vitest run tests/collaboration-detail.test.tsx tests/collaborations-api.test.ts`
Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/api/mock/collaborationSeed.ts apps/web/src/routes/DataManagement.tsx
git commit -m "feat(web): demo seed importer for collaboration records"
```

---

## Task 8: 全量验证

**Files:** 无（只跑检查）

- [ ] **Step 1: server 测试**

Run: `pnpm --filter @mediakit/server test`
Expected: PASS（含 data.schema.test.ts）。

- [ ] **Step 2: web 全量测试**

Run: `pnpm --filter @mediakit/web test`
Expected: PASS。

- [ ] **Step 3: 全量类型检查**

Run: `pnpm -r run typecheck`
Expected: PASS。

---

## Self-Review

- **Spec coverage:** 新 COLLABORATION kind（Task 4）✓；共享类型 +确定性 id（Task 1）✓；Server Zod（Task 2）✓；service kind 映射（Task 3，**纠正 spec 漏说的 kindToDb/update 改动**）✓；Web API helper（Task 5）✓；抽屉展示/编辑（Task 6）✓；CRUD（Task 5/6 save/remove）✓；导入/种子（Task 7）✓；合作方式派生标签（Task 1 `collaborationLabel` + Task 6 展示）✓；报告绑定明确不在本期（spec 已声明）✓。
- **Placeholder scan:** 无 TBD；每步含完整代码与确切命令。Task 7 Step 1 注明种子字段名以 `creatorPerformance.ts` 实际为准（低风险对齐说明，非占位）。
- **Type consistency:** `CollaborationData.id`（Task 1）↔ Zod `id`（Task 2）↔ service `valid.id` 主键（既有）↔ `saveCollaboration` payload（Task 5）一致；`collaborationId` 在 shared（Task 1）被 web api（Task 5）、组件（Task 6）、种子（Task 7）共用；`kindToDb`（Task 3 导出）与 schema kindSchema（Task 2）三值一致；`ContentType` 六值在 shared（Task 1）/Zod（Task 2）/组件 select（Task 6）一致。
- **已知风险：** Task 4 需 dev DB 运行（记忆 `prisma-migrate-dev-needs-shadow-db`，走 `migrate deploy`）；Task 6 画像编辑 v1 只读（spec 范围内可接受）；Task 7 种子字段名需对齐 mock（已注明）。
