# 业务线账号与数据权限隔离 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 每个业务线一个用户账号（seed 自动生成），沿用 ownerId 机制实现业务线级数据可见性隔离，存量数据按业务线字段一次性划归。

**Architecture:** User 加 `businessLineCode` 列（存 code 不存 FK，与 `Campaign.businessLineCode` 等既有约定一致）→ JWT 带 `bl` claim → `req.user` 带 `businessLineCode` → 服务端按 viewer（ADMIN 全量 / USER 按 ownerId）过滤。存量划归放在 seed 脚本（tsx + `$executeRaw`）而非 migration SQL，消除"先建账号才能跑 UPDATE JOIN"的顺序依赖；migration 只做 DDL。Creator 是共享字典：读放开（所有登录用户），写保持 owner-or-ADMIN。

**Tech Stack:** Express + jose(JWT) + Prisma(MySQL) + scrypt + vitest/supertest(server) / zustand + RTL(jsdom)(web)。

**Spec:** `docs/superpowers/specs/2026-08-17-business-line-user-accounts-design.md`

**关键背景（工程师必读）：**
- 仓库为 pnpm monorepo：`apps/server`（Express API）、`apps/web`（React）、`packages/shared`（前后端共享类型，直引 src 无构建步骤）。
- 测试命令：server 用 `pnpm --filter @mediakit/server exec vitest run <路径>`；web 用 `pnpm --filter @mediakit/web exec vitest run <路径>`（根目录没有 vitest binary）。
- web 类型门禁是 `tsc -b --force`（vite dev 不查类型）。
- **不要用 `prisma migrate dev`**（dev DB 用户无 CREATE DATABASE 权限会 P3014）：手写 migration 文件夹 + `prisma migrate deploy`。
- server 单测全部 mock prisma（`vi.mock('../../prisma')`），不碰真库；真库验证在 Task 10。
- 现存 DB 数据：admin 拥有全部 6 Campaign / 26 Project / 18 DataRecord / 21 Creator；另有 2 个历史测试账号 `db@x.com`、`cascade@x.com`（USER、无业务线）。
- 登录有限流（10 次/5 分钟），手动验证多账号登录时注意。

---

### Task 1: shared User 类型 + spec 修正

**Files:**
- Modify: `packages/shared/src/types/auth.ts`
- Modify: `docs/superpowers/specs/2026-08-17-business-line-user-accounts-design.md`

- [ ] **Step 1: User 类型加可选字段**

`packages/shared/src/types/auth.ts` 的 `User` interface 改为（加最后一行字段）：

```typescript
export interface User {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: string;
  updatedAt: string;
  /** 归属业务线 code（如 'DG'）。ADMIN 为 null = 不限；可选以兼容旧 fixture。 */
  businessLineCode?: string | null;
}
```

用**可选**字段（`?:`）：web/server 现有测试 fixture 构造 User 对象时不带该字段也能编译。

- [ ] **Step 2: spec 修正（孤儿账号策略）**

spec §1 账号生成一节中「业务线被删时同步清理孤儿账号」改为「业务线被删时仅告警不删账号——User 删除会级联删除其名下 Campaign/Project 等数据，自动清理有毁数据风险」。（实现见 Task 5。）

- [ ] **Step 3: 类型检查**

Run: `pnpm --filter @mediakit/shared exec tsc --noEmit`
Expected: 无输出（通过）

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/auth.ts docs/superpowers/specs/2026-08-17-business-line-user-accounts-design.md
git commit -m "feat(shared): User 类型加 businessLineCode 可选字段"
```

---

### Task 2: Prisma schema + DDL migration

**Files:**
- Modify: `apps/server/prisma/schema.prisma:19-36`（User model）
- Create: `apps/server/prisma/migrations/20260817000000_user_business_line/migration.sql`

- [ ] **Step 1: User model 加列**

`schema.prisma` User model 中，`role Role @default(USER)` 一行后加：

```prisma
  /// 归属业务线 code（如 'DG'）。ADMIN 为 NULL = 不限。存 code 不存 FK，
  /// 与 Campaign.businessLineCode / ReportScheme.businessLineCode 约定一致。
  businessLineCode String?
```

并在 `@@index([email])` 后加一行：

```prisma
  @@index([businessLineCode])
```

- [ ] **Step 2: 手写 migration 文件**

创建 `apps/server/prisma/migrations/20260817000000_user_business_line/migration.sql`：

```sql
-- User: 加 businessLineCode 列（业务线账号权限隔离）。
-- 语义: ADMIN 为 NULL = 不受限; USER 填 BusinessLine.code（如 'DG'）。
-- 注: 存量数据划归不在本 migration（依赖业务线账号先存在），
-- 见 prisma/seed-users.ts 的 reassignOwnersToBusinessLines()。
ALTER TABLE `User`
  ADD COLUMN `businessLineCode` VARCHAR(191) NULL;

CREATE INDEX `idx_user_business_line` ON `User` (`businessLineCode`);
```

- [ ] **Step 3: 重新生成 Prisma Client（类型层，后面任务的 `u.businessLineCode` 依赖它）**

Run: `pnpm --filter @mediakit/server exec prisma generate`
Expected: `Generated Prisma Client (v...)` 成功输出

- [ ] **Step 4: Commit**

```bash
git add apps/server/prisma/schema.prisma apps/server/prisma/migrations/20260817000000_user_business_line/migration.sql
git commit -m "feat(db): User 加 businessLineCode 列 + 索引（DDL migration）"
```

（真库 `migrate deploy` 在 Task 10 统一执行。）

---

### Task 3: JWT bl claim

**Files:**
- Modify: `apps/server/src/modules/auth/token.ts`
- Test: `apps/server/src/modules/auth/token.test.ts`（新建）

- [ ] **Step 1: 写失败测试**

创建 `apps/server/src/modules/auth/token.test.ts`：

```typescript
import { describe, expect, it, vi } from 'vitest';

// token.ts 顶层 import config/redis，mock 掉避免读 env / 连 Redis。
vi.mock('../../config', () => ({
  config: {
    jwt: {
      accessSecret: 'test-access-secret-at-least-32-chars!!',
      refreshSecret: 'test-refresh-secret-at-least-32-chars!!',
      accessTtlSec: 900,
      refreshTtlSec: 604800,
    },
  },
}));
vi.mock('../../redis', () => ({ redis: {} }));

import { signAccessToken, verifyAccessToken } from './token';

describe('signAccessToken · businessLineCode claim', () => {
  it('带 bl: 签发后验签可读回', async () => {
    const token = await signAccessToken('user-1', 'USER', 'DG');
    const payload = await verifyAccessToken(token);
    expect(payload.sub).toBe('user-1');
    expect(payload.role).toBe('USER');
    expect(payload.bl).toBe('DG');
    expect(payload.type).toBe('access');
  });

  it('不带 bl: 验签后 bl 为 null（不抛错，兼容显式传 null）', async () => {
    const token = await signAccessToken('user-2', 'ADMIN', null);
    const payload = await verifyAccessToken(token);
    expect(payload.bl).toBeNull();
  });

  it('旧签名（无第三参）: bl 为 undefined，验签不炸', async () => {
    const token = await signAccessToken('user-3', 'ADMIN');
    const payload = await verifyAccessToken(token);
    expect(payload.bl).toBeUndefined();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @mediakit/server exec vitest run src/modules/auth/token.test.ts`
Expected: FAIL —— TypeScript/运行时报 `signAccessToken` 只接受 2 个参数（或断言 bl 失败）

- [ ] **Step 3: 实现**

`apps/server/src/modules/auth/token.ts` 两处修改：

`AccessTokenPayload`（L9-13）加字段：

```typescript
export interface AccessTokenPayload extends JWTPayload {
  sub: string;
  role: Role;
  /** 归属业务线 code；ADMIN / 旧 token 无此约束时为 null 或缺失。 */
  bl?: string | null;
  type: 'access';
}
```

`signAccessToken`（L34-41）改为：

```typescript
export async function signAccessToken(
  userId: string,
  role: Role,
  businessLineCode?: string | null,
): Promise<string> {
  return new SignJWT({ role, bl: businessLineCode ?? null, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${config.jwt.accessTtlSec}s`)
    .sign(secret('access'));
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @mediakit/server exec vitest run src/modules/auth/token.test.ts`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/auth/token.ts apps/server/src/modules/auth/token.test.ts
git commit -m "feat(auth): access token 加 bl(业务线) claim + 测试"
```

---

### Task 4: 鉴权链路打通（req.user / toPublicUser / users 模块）

**Files:**
- Modify: `apps/server/src/types/express.d.ts`
- Modify: `apps/server/src/middleware/auth.ts:15`
- Modify: `apps/server/src/modules/auth/auth.service.ts`（toPublicUser L15-24、issueSession L38）
- Modify: `apps/server/src/modules/users/users.schema.ts`
- Modify: `apps/server/src/modules/users/users.service.ts`

- [ ] **Step 1: AuthPayload 加字段**

`apps/server/src/types/express.d.ts` 整体替换为：

```typescript
import type { Role } from '@mediakit/shared';

/** 认证后挂到 req.user 的载荷。 */
export interface AuthPayload {
  id: string;
  role: Role;
  /** 归属业务线 code；ADMIN / 无归属为 null。 */
  businessLineCode: string | null;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthPayload;
  }
}
```

- [ ] **Step 2: authenticate 中间件透传**

`apps/server/src/middleware/auth.ts` L15 改为：

```typescript
    req.user = { id: payload.sub!, role: payload.role, businessLineCode: payload.bl ?? null };
```

- [ ] **Step 3: auth.service 透传**

`apps/server/src/modules/auth/auth.service.ts` 的 `toPublicUser`（L15-24）加返回字段：

```typescript
function toPublicUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    businessLineCode: u.businessLineCode,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}
```

`issueSession` 中（L38）改为：

```typescript
    signAccessToken(user.id, user.role, user.businessLineCode),
```

- [ ] **Step 4: users 模块支持 businessLineCode**

`apps/server/src/modules/users/users.schema.ts`：`createUserSchema` 加 `businessLineCode: z.string().nullable().optional(),`；`updateUserSchema` 的 object 里加同一行（`.refine` 之前）。

`apps/server/src/modules/users/users.service.ts` 三处：

`toPublicUser` 加 `businessLineCode: u.businessLineCode,`（role 行后）。

`create` 的 data 构造加：

```typescript
      ...(input.businessLineCode !== undefined ? { businessLineCode: input.businessLineCode } : {}),
```

`create`/`update` 的 input 类型签名各加 `businessLineCode?: string | null`（`role?: 'ADMIN' | 'USER'` 后面）。`update` 的 data 构造加：

```typescript
    if (input.businessLineCode !== undefined) data.businessLineCode = input.businessLineCode;
```

- [ ] **Step 5: 全量类型检查 + server 测试**

Run: `pnpm --filter @mediakit/server exec tsc --noEmit`
Expected: 无输出

Run: `pnpm --filter @mediakit/server exec vitest run`
Expected: 全绿（既有测试不受影响；若有测试构造 AuthPayload 缺字段报 TS 错，按报错位置补 `businessLineCode: null`）

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/types/express.d.ts apps/server/src/middleware/auth.ts apps/server/src/modules/auth/auth.service.ts apps/server/src/modules/users/users.schema.ts apps/server/src/modules/users/users.service.ts
git commit -m "feat(auth): req.user/登录响应/users API 透传 businessLineCode"
```

---

### Task 5: seed-users 脚本（建账号 + 存量划归）

**Files:**
- Create: `apps/server/prisma/seed-users.ts`
- Modify: `apps/server/prisma/seed.ts`

- [ ] **Step 1: 写 seed-users.ts**

创建 `apps/server/prisma/seed-users.ts`（**完整文件，照抄**）：

```typescript
/**
 * 业务线账号 seed：
 * 1. 按库中 BusinessLine 为每条业务线 upsert 一个 USER 账号（{code小写}@mediakit.local / mediakit123）。
 * 2. 把 ADMIN 名下的存量业务数据按 businessLine 字段划归到对应业务线账号（ownerId 机制）。
 *
 * 幂等：可重复执行。划归只动「当前归 ADMIN 所有」的行，不会抢业务线账号新建的数据。
 * 注：划归放这里而不放 migration——UPDATE JOIN 依赖业务线账号已存在，migration 无法保证顺序。
 * 本文件只导出函数，不自动执行（main 由 seed.ts 编排；也避免被 import 时意外跑库）。
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/hash';

const prisma = new PrismaClient();

const PASSWORD = 'mediakit123';

export async function seedBusinessLineUsers(): Promise<void> {
  const lines = await prisma.businessLine.findMany({ orderBy: { code: 'asc' } });
  if (lines.length === 0) {
    console.log('[seed-users] BusinessLine 表为空，跳过（先跑 seed-lookup-tables.ts）');
    return;
  }
  for (const bl of lines) {
    const email = `${bl.code.toLowerCase()}@mediakit.local`;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { name: bl.name, businessLineCode: bl.code },
      });
      console.log(`[seed-users] updated: ${email} (${bl.code})`);
    } else {
      await prisma.user.create({
        data: {
          email,
          passwordHash: hashPassword(PASSWORD),
          name: bl.name,
          role: 'USER',
          businessLineCode: bl.code,
        },
      });
      console.log(`[seed-users] created: ${email} / ${PASSWORD} (${bl.code})`);
    }
  }

  // 孤儿账号（businessLineCode 指向已删除的业务线）：仅告警，不删——
  // User 删除会级联删其名下 Campaign/Project 等数据。
  const orphans = await prisma.user.findMany({
    where: { businessLineCode: { notIn: lines.map((b) => b.code) } },
    select: { email: true, businessLineCode: true },
  });
  for (const o of orphans) {
    console.warn(`[seed-users] WARN: ${o.email} 的业务线 ${o.businessLineCode} 已不存在（保留账号与数据）`);
  }
}

/** 把 ADMIN 名下存量数据按业务线划归（ownerId → 业务线账号）。只动 ADMIN 拥有的行。 */
export async function reassignOwnersToBusinessLines(): Promise<void> {
  // Campaign：结构化 businessLineCode 列
  const c1 = await prisma.$executeRaw`
    UPDATE `Campaign` c
    JOIN `User` u ON u.businessLineCode = c.businessLineCode AND u.role = 'USER'
    JOIN `User` a ON a.id = c.ownerId AND a.role = 'ADMIN'
    SET c.ownerId = u.id`;

  // DataRecord(CAMPAIGN)：data JSON 里的 businessLine
  const c2 = await prisma.$executeRaw`
    UPDATE `DataRecord` d
    JOIN `User` u
      ON u.businessLineCode = JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.businessLine'))
      AND u.role = 'USER'
    JOIN `User` a ON a.id = d.ownerId AND a.role = 'ADMIN'
    SET d.ownerId = u.id
    WHERE d.kind = 'CAMPAIGN'`;

  // Project：meta JSON 里的 businessLine（NULL 业务线的留 admin）
  const c3 = await prisma.$executeRaw`
    UPDATE `Project` p
    JOIN `User` u
      ON u.businessLineCode = JSON_UNQUOTE(JSON_EXTRACT(p.meta, '$.businessLine'))
      AND u.role = 'USER'
    JOIN `User` a ON a.id = p.ownerId AND a.role = 'ADMIN'
    SET p.ownerId = u.id`;

  console.log(`[seed-users] reassign: Campaign=${c1} DataRecord(CAMPAIGN)=${c2} Project=${c3}`);
}
```

- [ ] **Step 2: seed.ts 编排**

`apps/server/prisma/seed.ts` 整体替换为：

```typescript
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/hash';
import { seedBusinessLineUsers, reassignOwnersToBusinessLines } from './seed-users';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // 1. admin（幂等 upsert）
  const email = 'admin@mediakit.local';
  const password = 'admin123';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`[seed] admin user already exists: ${email}`);
  } else {
    await prisma.user.create({
      data: {
        email,
        passwordHash: hashPassword(password),
        name: 'Admin',
        role: 'ADMIN',
      },
    });
    console.log(`[seed] created admin user: ${email} / ${password}`);
  }

  // 2. 业务线账号（{code小写}@mediakit.local / mediakit123）+ 存量划归
  await seedBusinessLineUsers();
  await reassignOwnersToBusinessLines();
}

main()
  .catch((err) => {
    console.error('[seed] failed', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 3: 类型检查**

Run: `pnpm --filter @mediakit/server exec tsc --noEmit`
Expected: 无输出

- [ ] **Step 4: Commit**

```bash
git add apps/server/prisma/seed-users.ts apps/server/prisma/seed.ts
git commit -m "feat(seed): 业务线账号自动生成 + 存量数据按业务线划归(ownerId)"
```

（真库执行在 Task 10；本任务只保证编译通过。）

---

### Task 6: data 模块 viewer 隔离（DataRecord）

**Files:**
- Modify: `apps/server/src/modules/data/data.service.ts`
- Modify: `apps/server/src/modules/data/data.controller.ts`
- Test: `apps/server/src/modules/data/data.service.test.ts`（改既有 + 加新例）

- [ ] **Step 1: 写失败测试**

`apps/server/src/modules/data/data.service.test.ts`：把 `describe('dataService · list', ...)` 整块替换为：

```typescript
const adminViewer = { id: 'u-admin', role: 'ADMIN' as const, businessLineCode: null };
const blViewer = { id: 'u-bl', role: 'USER' as const, businessLineCode: 'DG' };

describe('dataService · list（业务线隔离）', () => {
  it('ADMIN: 按 kind 查询无 owner 过滤,createdAt desc', async () => {
    prismaMock.dataRecord.findMany.mockResolvedValue([makeRecord()]);
    const r = await dataService.list('campaign', adminViewer);
    expect(r).toHaveLength(1);
    expect(prismaMock.dataRecord.findMany).toHaveBeenCalledWith({
      where: { kind: 'CAMPAIGN' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('USER: 非 CREATOR kind 强制加 ownerId 过滤', async () => {
    prismaMock.dataRecord.findMany.mockResolvedValue([]);
    await dataService.list('campaign', blViewer);
    expect(prismaMock.dataRecord.findMany).toHaveBeenCalledWith({
      where: { kind: 'CAMPAIGN', ownerId: 'u-bl' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('USER + CREATOR: 共享字典,不加 owner 过滤', async () => {
    prismaMock.dataRecord.findMany.mockResolvedValue([]);
    await dataService.list('creator', blViewer);
    expect(prismaMock.dataRecord.findMany).toHaveBeenCalledWith({
      where: { kind: 'CREATOR' },
      orderBy: { createdAt: 'desc' },
    });
  });
});

describe('dataService · get（业务线隔离）', () => {
  it('USER 读他人 CAMPAIGN 记录 → 404', async () => {
    prismaMock.dataRecord.findUnique.mockResolvedValue(makeRecord({ ownerId: 'u-admin' }));
    await expect(dataService.get('camp-x', blViewer)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('USER 读他人 CREATOR 记录 → 放行（共享字典）', async () => {
    prismaMock.dataRecord.findUnique.mockResolvedValue(
      makeRecord({ id: 'cre-x', kind: 'CREATOR', ownerId: 'u-admin' }),
    );
    await expect(dataService.get('cre-x', blViewer)).resolves.toBeTruthy();
  });

  it('USER 读自己记录 → 放行；ADMIN 读任意 → 放行', async () => {
    prismaMock.dataRecord.findUnique.mockResolvedValue(makeRecord({ ownerId: 'u-bl' }));
    await expect(dataService.get('camp-x', blViewer)).resolves.toBeTruthy();
    await expect(dataService.get('camp-x', adminViewer)).resolves.toBeTruthy();
  });
});
```

（文件里若有其他直接调用 `dataService.list('campaign')` 单参的旧用例，一律补第二参 `adminViewer`。）

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @mediakit/server exec vitest run src/modules/data/data.service.test.ts`
Expected: FAIL（list 只收 1 参 / get 不存在）

- [ ] **Step 3: 实现 service**

`apps/server/src/modules/data/data.service.ts`：

顶部 import 区加：

```typescript
import type { AuthPayload } from '../../types/express';
import type { Role } from '@mediakit/shared';
```

`dataService` 里把 `list`（L45-52）替换为：

```typescript
  /** viewer 感知列表：CREATOR 共享字典；其余 kind 非 ADMIN 强制 ownerId。 */
  async list(kind: Kind, viewer: { id: string; role: Role }) {
    // Phase 4: CAMPAIGN/CREATOR/COLLABORATION 已迁移到独立表，
    // 此方法保留供旧路径回退读取；新代码应直接查 Campaign/Creator 表。
    const where: Prisma.DataRecordWhereInput = { kind: kindToDb(kind) };
    if (kind !== 'creator' && viewer.role !== 'ADMIN') {
      where.ownerId = viewer.id;
    }
    return prisma.dataRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  },
```

`getOrThrow`（L54-60）后新增：

```typescript
  /** viewer 感知读取：CREATOR 共享；其余 kind 非 ADMIN 校验 owner。 */
  async get(id: string, viewer: { id: string; role: Role }) {
    const rec = await this.getOrThrow(id);
    if (rec.kind !== 'CREATOR' && viewer.role !== 'ADMIN' && rec.ownerId !== viewer.id) {
      throw ApiError.notFound('Data record not found');
    }
    return rec;
  },
```

`create`（L70）签名改 `async create(viewer: AuthPayload, kind: Kind, data: unknown)`，函数体里 `ownerId` 一律用 `viewer.id`，并在函数开头加业务线一致性校验：

```typescript
    if (kind === 'campaign') assertBusinessLine(viewer, (data as { businessLine?: string })?.businessLine);
```

`importMany`（L90）签名改 `async importMany(viewer: AuthPayload, kind: Kind, items: unknown[])`，函数体 `ownerId` 用 `viewer.id`；campaign 行加校验——在 `const valid = res.data as { id: string };` 后加：

```typescript
      if (kind === 'campaign' && !assertBusinessLineSoft(viewer, (valid as { businessLine?: string })?.businessLine)) {
        skipped++;
        continue;
      }
```

`update`（L137）签名改 `async update(id: string, viewer: AuthPayload, data: unknown)`；把首行 `const rec = await this.getOrThrow(id, ownerId);` 改为：

```typescript
    const rec = await this.getOrThrow(id);
    // 写权限维持 owner 制（ADMIN 改他人记录不在本期范围）
    if (rec.ownerId !== viewer.id) throw ApiError.notFound('Data record not found');
    if (rec.kind === 'CAMPAIGN') assertBusinessLine(viewer, (data as { businessLine?: string })?.businessLine);
```

`remove`（L153）签名改 `async remove(id: string, viewer: AuthPayload)`，首行改：

```typescript
    const rec = await this.getOrThrow(id);
    if (rec.ownerId !== viewer.id) throw ApiError.notFound('Data record not found');
```

同文件底部（`export const dataService` 之前）加两个辅助函数 + import：

```typescript
import { assertBusinessLine, assertBusinessLineSoft } from '../../utils/business-line';
```

（`utils/business-line.ts` 在 Task 7 创建——本任务先建。见 Task 7 Step 1 的完整代码；如本任务先行完成编译会报模块不存在，故 **本任务 Step 3 一并创建该文件**，内容如下，Task 7 只是用它：）

创建 `apps/server/src/utils/business-line.ts`：

```typescript
import { ApiError } from './ApiError';
import type { AuthPayload } from '../types/express';

/**
 * 业务线一致性守卫：业务线账号(USER + businessLineCode)不得创建/改写成其他业务线的数据。
 * code 缺省（undefined/空串）时不拦——兼容不含业务线字段的旧载荷。
 */
export function assertBusinessLine(viewer: AuthPayload, code: unknown): void {
  if (viewer.role === 'ADMIN' || !viewer.businessLineCode) return;
  if (typeof code === 'string' && code && code !== viewer.businessLineCode) {
    throw ApiError.forbidden('不能创建或修改其他业务线的数据');
  }
}

/** 软校验（批量导入用）：不抛错，返回 false 计入 skipped。 */
export function assertBusinessLineSoft(viewer: AuthPayload, code: unknown): boolean {
  try {
    assertBusinessLine(viewer, code);
    return true;
  } catch {
    return false;
  }
}
```

（`ApiError.forbidden(message)` 已存在于 `apps/server/src/utils/ApiError.ts:20`，requireRole 在用，直接用即可。）

- [ ] **Step 4: 改 controller**

`apps/server/src/modules/data/data.controller.ts`：

`owner(req)` helper 删除，替换为：

```typescript
function viewer(req: Request): AuthPayload {
  return req.user as AuthPayload;
}
```

各 handler 改为：

```typescript
  list: asyncHandler(async (req: Request, res: Response) => {
    const kind = (req.query as { kind: Kind }).kind;
    res.json({ records: await dataService.list(kind, viewer(req)) });
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    res.json({ record: await dataService.get(req.params.id, viewer(req)) });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const { kind, data } = req.body as { kind: Kind; data: unknown };
    res.status(201).json({ record: await dataService.create(viewer(req), kind, data) });
  }),

  import: asyncHandler(async (req: Request, res: Response) => {
    const { kind, items } = req.body as { kind: Kind; items: unknown[] };
    res.json(await dataService.importMany(viewer(req), kind, items));
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const { data } = req.body as { data: unknown };
    res.json({ record: await dataService.update(req.params.id, viewer(req), data) });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await dataService.remove(req.params.id, viewer(req));
    res.status(204).end();
  }),
```

（`clear` 不动。）

- [ ] **Step 5: 修既有测试 + 跑全绿**

既有 `data.service.test.ts` 中 create/update/remove/importMany 的调用（原来传 `'u1'` 作 ownerId）改为传 viewer 对象 `{ id: 'u1', role: 'ADMIN', businessLineCode: null }`；`getOrThrow` 单测不动（它签名没变）。

Run: `pnpm --filter @mediakit/server exec vitest run src/modules/data`
Expected: 全部通过（含 data.routes.test.ts 的 401 用例）

Run: `pnpm --filter @mediakit/server exec tsc --noEmit`
Expected: 无输出

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/modules/data apps/server/src/utils/business-line.ts
git commit -m "feat(data): DataRecord 按 viewer 隔离(CREATOR 共享读) + 业务线一致性守卫"
```

---

### Task 7: campaigns 模块（Creator 共享读 + 写 ownership + 业务线守卫）

**Files:**
- Modify: `apps/server/src/modules/campaigns/campaigns.service.ts`（creatorService）
- Modify: `apps/server/src/modules/campaigns/campaigns.controller.ts`
- Test: `apps/server/src/modules/campaigns/campaigns.service.test.ts`（追加）

- [ ] **Step 1: 写失败测试**

`apps/server/src/modules/campaigns/campaigns.service.test.ts`：顶部 prismaMock 补 creator/campaign mock，import 行改为同时引入 `creatorService`（ES import 必须在顶部）：

```typescript
import { creatorService, importService } from './campaigns.service';

const prismaMock = vi.hoisted(() => ({
  campaignCreator: { findFirst: vi.fn() },
  cpsPerformance: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), upsert: vi.fn() },
  creator: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
```

文件末尾追加：

```typescript
const blViewer = { id: 'u-bl', role: 'USER' as const, businessLineCode: 'DG' };

describe('creatorService · 共享字典读 + owner 写', () => {
  it('list 不再按 ownerId 过滤(共享读),仅保留筛选条件', async () => {
    prismaMock.creator.findMany.mockResolvedValue([]);
    await creatorService.list({ platform: 'TikTok' });
    expect(prismaMock.creator.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.not.objectContaining({ ownerId: expect.anything() }) }),
    );
    const call = prismaMock.creator.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ platform: 'TikTok' });
  });

  it('getOrThrow 改为存在性校验(不查 owner)', async () => {
    prismaMock.creator.findFirst.mockResolvedValue({ id: 'cre-1', ownerId: 'u-admin' });
    await expect(creatorService.getOrThrow('cre-1')).resolves.toMatchObject({ id: 'cre-1' });
    expect(prismaMock.creator.findFirst).toHaveBeenCalledWith({ where: { id: 'cre-1' } });
  });

  it('remove: 非 owner 且非 ADMIN → 404', async () => {
    prismaMock.creator.findFirst.mockResolvedValue({ id: 'cre-1', ownerId: 'u-admin' });
    await expect(creatorService.remove('cre-1', blViewer)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('remove: owner → 删除', async () => {
    prismaMock.creator.findFirst.mockResolvedValue({ id: 'cre-1', ownerId: 'u-bl' });
    prismaMock.creator.delete.mockResolvedValue({});
    await expect(creatorService.remove('cre-1', blViewer)).resolves.toBeUndefined();
    expect(prismaMock.creator.delete).toHaveBeenCalledWith({ where: { id: 'cre-1' } });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @mediakit/server exec vitest run src/modules/campaigns/campaigns.service.test.ts`
Expected: FAIL（list 仍收 ownerId / getOrThrow 收 2 参）

- [ ] **Step 3: 实现 creatorService**

`apps/server/src/modules/campaigns/campaigns.service.ts` 的 `creatorService`（L70-108）整体替换为：

```typescript
// ─── Creator ─────────────────────────────────────────────────────────────────

export const creatorService = {
  /** 共享字典：所有登录用户可读（无 ownerId 过滤）。写操作仍校验 owner。 */
  async list(opts: { platform?: string; tier?: string; category?: string; partnerType?: string; search?: string }) {
    const where: Prisma.CreatorWhereInput = {};
    if (opts.platform) where.platform = opts.platform;
    if (opts.tier) where.tier = opts.tier;
    if (opts.category) where.category = opts.category;
    if (opts.partnerType) where.partnerType = opts.partnerType;
    if (opts.search) {
      where.OR = [
        { name: { contains: opts.search } },
        { handle: { contains: opts.search } },
      ];
    }
    return prisma.creator.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  },

  /** 存在性校验（共享读语义，不查 owner）。 */
  async getOrThrow(id: string) {
    const rec = await prisma.creator.findFirst({ where: { id } });
    if (!rec) throw ApiError.notFound('Creator not found');
    return rec;
  },

  /** 写权限：owner 或 ADMIN。 */
  async getOwnedOrThrow(id: string, viewer: { id: string; role: string }) {
    const rec = await this.getOrThrow(id);
    if (viewer.role !== 'ADMIN' && rec.ownerId !== viewer.id) {
      throw ApiError.notFound('Creator not found');
    }
    return rec;
  },

  async create(ownerId: string, data: Prisma.CreatorUncheckedCreateInput) {
    return prisma.creator.create({ data: { ...data, ownerId } });
  },

  async update(id: string, viewer: { id: string; role: string }, data: Prisma.CreatorUncheckedUpdateInput) {
    await this.getOwnedOrThrow(id, viewer);
    return prisma.creator.update({ where: { id }, data });
  },

  async remove(id: string, viewer: { id: string; role: string }) {
    await this.getOwnedOrThrow(id, viewer);
    await prisma.creator.delete({ where: { id } });
  },
};
```

- [ ] **Step 4: 修 call sites + campaigns 写守卫**

同文件 `campaignCreatorService.upsert`（L125-150）里 `await creatorService.getOrThrow(data.creatorId, ownerId);` 改为：

```typescript
    await creatorService.getOrThrow(data.creatorId);
```

`apps/server/src/modules/campaigns/campaigns.controller.ts`：

顶部加 import：

```typescript
import { assertBusinessLine } from '../../utils/business-line';
```

`create`（L21-24）改为：

```typescript
  create: asyncHandler(async (req: Request, res: Response) => {
    const v = req.user as AuthPayload;
    assertBusinessLine(v, (req.body as { businessLineCode?: string })?.businessLineCode);
    res.status(201).json({ campaign: await campaignService.create(v.id, req.body) });
  }),
```

`update`（L25-28）改为：

```typescript
  update: asyncHandler(async (req: Request, res: Response) => {
    const v = req.user as AuthPayload;
    assertBusinessLine(v, (req.body as { businessLineCode?: string })?.businessLineCode);
    res.json({ campaign: await campaignService.update(req.params.id, v.id, req.body) });
  }),
```

`listCreators`（L45-48）去掉 ownerId：

```typescript
  listCreators: asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as { platform?: string; tier?: string; category?: string; partnerType?: string; search?: string };
    res.json({ creators: await creatorService.list(q) });
  }),
```

`updateCreator`（L58-60）/`removeCreator`（L62-65）改传 viewer：

```typescript
  updateCreator: asyncHandler(async (req: Request, res: Response) => {
    res.json({ creator: await creatorService.update(req.params.id, req.user as AuthPayload, req.body) });
  }),

  removeCreator: asyncHandler(async (req: Request, res: Response) => {
    await creatorService.remove(req.params.id, req.user as AuthPayload);
    res.status(204).end();
  }),
```

- [ ] **Step 5: 跑测试 + 类型检查**

Run: `pnpm --filter @mediakit/server exec vitest run src/modules/campaigns`
Expected: 全部通过

Run: `pnpm --filter @mediakit/server exec tsc --noEmit`
Expected: 无输出（如 `importService.importCreatorAudience/Works` 内 `findFirst({ where: { id, ownerId } })` 编译不过——不会，ownerId 传的是 string，逻辑不变，保留 owner 制写入语义）

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/modules/campaigns
git commit -m "feat(campaigns): Creator 共享读/owner 写 + campaign 写业务线守卫"
```

---

### Task 8: lookup GET 端点加鉴权

**Files:**
- Modify: `apps/server/src/modules/lookup/lookup.routes.ts`
- Test: `apps/server/src/modules/lookup/lookup.routes.test.ts`（新建）

- [ ] **Step 1: 写失败测试**

创建 `apps/server/src/modules/lookup/lookup.routes.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';

describe('lookup routes · 鉴权', () => {
  it('未登录 GET /api/v1/lookup/business-lines → 401', async () => {
    const res = await request(createApp()).get('/api/v1/lookup/business-lines');
    expect(res.status).toBe(401);
  });
  it('未登录 GET /api/v1/lookup/advertisers → 401', async () => {
    const res = await request(createApp()).get('/api/v1/lookup/advertisers');
    expect(res.status).toBe(401);
  });
  it('未登录 GET /api/v1/lookup/merchants → 401', async () => {
    const res = await request(createApp()).get('/api/v1/lookup/merchants');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @mediakit/server exec vitest run src/modules/lookup/lookup.routes.test.ts`
Expected: FAIL（当前返回 200）

- [ ] **Step 3: 实现**

`apps/server/src/modules/lookup/lookup.routes.ts`：把 `router.use(authenticate);`（L28，原「写操作需登录」处）**上移到 GET 路由块之前**（L19 注释处），注释改为：

```typescript
// 全部端点需登录（业务线字典不对匿名暴露；已核实登录页等 pre-auth 表面不调 lookup）。
router.use(authenticate);
```

即最终顺序：`const router = Router();` → 注释 + `router.use(authenticate);` → 6 条 GET → 9 条写路由（原 L28-29 的 `router.use(authenticate);` 和注释删除）。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @mediakit/server exec vitest run src/modules/lookup`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/lookup
git commit -m "feat(lookup): GET 端点加 authenticate（消除匿名字典面）"
```

---

### Task 9: web 前端（弹窗锁业务线 + 顶栏徽章 + 测试）

**Files:**
- Modify: `apps/web/src/components/CreateProjectDialog.tsx`
- Modify: `apps/web/src/components/Layout.tsx:62-72`
- Test: `apps/web/src/tests/CreateProjectDialog.test.tsx`（追加）
- Test: `apps/web/src/tests/auth.store.test.tsx`（追加断言）

- [ ] **Step 1: 写失败测试（弹窗锁定）**

`apps/web/tests/CreateProjectDialog.test.tsx`：hoisted 块扩为（`waitFor` 该文件已 import，无需补）：

```typescript
const { listCampaignsMock, lookupApiMock, authStateMock } = vi.hoisted(() => ({
  listCampaignsMock: vi.fn<() => Promise<Campaign[]>>(async () => []),
  lookupApiMock: {
    listBusinessLines: vi.fn().mockResolvedValue([
      { id: 'bl-ft', code: 'FT', name: 'Fanstoshop' },
      { id: 'bl-sm', code: 'SM', name: 'SmileKOLs' },
      { id: 'bl-dg', code: 'DG', name: 'Digchic' },
    ]),
    listAdvertisers: vi.fn().mockResolvedValue([]),
    listMerchants: vi.fn().mockResolvedValue([]),
  },
  authStateMock: { user: null as null | { role: string; businessLineCode?: string | null } },
}));
vi.mock('@/api/campaigns', () => ({ listCampaigns: listCampaignsMock }));
vi.mock('@/api/lookup', () => ({ lookupApi: lookupApiMock }));
vi.mock('@/stores/auth', () => ({
  useAuthStore: (selector: (s: { user: unknown }) => unknown) => selector({ user: authStateMock.user }),
}));
```

`beforeEach` 里加 `authStateMock.user = null;`。文件末尾追加（**注意**：业务线 `<select>` 无 label 关联，沿用本文件既有的 `parentElement.querySelector('select')` 选择器模式）：

```typescript
describe('CreateProjectDialog — 业务线账号锁定本业务线', () => {
  function blSelect() {
    return screen.getByText('业务线').parentElement!.querySelector('select')!;
  }

  it('USER+DG: 下拉 disabled 且值为 DG', async () => {
    authStateMock.user = { role: 'USER', businessLineCode: 'DG' };
    render(<CreateProjectDialog open onSubmit={() => {}} onCancel={() => {}} />);
    // blOptions 是异步拉取的，等选项出现
    await waitFor(() => expect(blSelect().querySelectorAll('option').length).toBeGreaterThan(1));
    expect(blSelect()).toBeDisabled();
    expect(blSelect().value).toBe('DG');
  });

  it('ADMIN: 下拉不受限', async () => {
    authStateMock.user = { role: 'ADMIN', businessLineCode: null };
    render(<CreateProjectDialog open onSubmit={() => {}} onCancel={() => {}} />);
    await waitFor(() => expect(blSelect().querySelectorAll('option').length).toBeGreaterThan(1));
    expect(blSelect()).not.toBeDisabled();
  });

  it('无登录信息(旧 fixture 路径): 下拉不受限', async () => {
    authStateMock.user = null;
    render(<CreateProjectDialog open onSubmit={() => {}} onCancel={() => {}} />);
    await waitFor(() => expect(blSelect().querySelectorAll('option').length).toBeGreaterThan(1));
    expect(blSelect()).not.toBeDisabled();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @mediakit/web exec vitest run tests/CreateProjectDialog.test.tsx`
Expected: FAIL（组件未消费 auth store，DG 用例 disabled 断言失败）

- [ ] **Step 3: 实现弹窗锁定**

`apps/web/src/components/CreateProjectDialog.tsx`：

import 区加：

```typescript
import { useAuthStore } from '@/stores/auth';
```

组件内（`const [businessLine, setBusinessLine] = useState('');` 之后任意 state 声明区）加：

```typescript
  // 业务线账号锁定本业务线（ADMIN / 无归属不受限）
  const authUser = useAuthStore((s) => s.user);
  const lockedBusinessLine =
    authUser && authUser.role !== 'ADMIN' ? authUser.businessLineCode ?? null : null;

  useEffect(() => {
    if (open && lockedBusinessLine) setBusinessLine(lockedBusinessLine);
  }, [open, lockedBusinessLine]);
```

业务线 `<select>`（L544 附近）加 `disabled={!!lockedBusinessLine}`：

```tsx
            <select
              className={`${selectCls} ${businessLineError ? 'border-red' : ''}`}
              value={businessLine}
              disabled={!!lockedBusinessLine}
              onChange={(e) => {
                setBusinessLine(e.target.value);
                setCampaignId('');
              }}
            >
```

campaign 下拉 onChange（L595 附近）锁定时禁止覆盖：

```tsx
                        const c = campaigns.find((x) => x.id === id);
                        if (c && !lockedBusinessLine) setBusinessLine(c.businessLine);
```

- [ ] **Step 4: Layout 徽章**

`apps/web/src/components/Layout.tsx`（L66-70 ADMIN 徽章后）加：

```tsx
              {user.businessLineCode && (
                <span className="ml-1 rounded-full bg-accent-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent-primary">
                  {user.businessLineCode}
                </span>
              )}
```

- [ ] **Step 5: auth store 测试追加**

`apps/web/tests/auth.store.test.tsx`：现有 login 成功用例的断言处（`expect(useAuthStore.getState().user)...` 附近）追加一个用例（fixture user 补上 `businessLineCode: 'DG'` 的变体）：

```typescript
  it('login 响应的 businessLineCode 透传入 store', async () => {
    loginMock.mockResolvedValue({
      user: { ...user, businessLineCode: 'DG' },
      accessToken: 'tok',
      expiresIn: 900,
    });
    await useAuthStore.getState().login('dg@mediakit.local', 'x');
    expect(useAuthStore.getState().user?.businessLineCode).toBe('DG');
  });
```

（若文件里 login 成功用例的 mock 结构不同，按其现有结构对齐——关键是断言 store 里能读到 `businessLineCode`。）

- [ ] **Step 6: 跑 web 测试 + 类型门禁**

Run: `pnpm --filter @mediakit/web exec vitest run tests/CreateProjectDialog.test.tsx tests/auth.store.test.tsx`
Expected: 全部通过

Run: `pnpm --filter @mediakit/web exec tsc -b --force`
Expected: 无输出

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/CreateProjectDialog.tsx apps/web/src/components/Layout.tsx apps/web/tests/CreateProjectDialog.test.tsx apps/web/tests/auth.store.test.tsx
git commit -m "feat(web): 业务线账号锁定新建弹窗业务线 + 顶栏业务线徽章"
```

---

### Task 10: 全量门禁 + 真库执行 + 手动验证 + 文档

**Files:**
- Modify: `docs/PROJECT.md`

- [ ] **Step 1: 全量测试**

Run: `pnpm --filter @mediakit/server exec vitest run`
Expected: 全绿（对照：改动前基线全绿）

Run: `pnpm --filter @mediakit/web exec vitest run`
Expected: 全绿（基线 806+）

- [ ] **Step 2: 全量类型检查**

Run: `pnpm --filter @mediakit/server exec tsc --noEmit && pnpm --filter @mediakit/web exec tsc -b --force`
Expected: 均无输出

- [ ] **Step 3: 真库执行（dev DB：mediakit 容器 mysql:3317）**

```bash
# 容器在跑（mediakit-mysql-1 / mediakit-redis-1）；不在则 docker compose up -d
pnpm --filter @mediakit/server exec prisma migrate deploy   # 应用 user_business_line DDL
pnpm --filter @mediakit/server db:seed                      # admin + 业务线账号 + 划归
```

Expected: migrate 输出 `1 migration found ... applied`；seed 打印 6 个 `created: xx@mediakit.local / mediakit123` + `reassign: Campaign=6 DataRecord(CAMPAIGN)=6 Project=26`

- [ ] **Step 4: DB sanity check**

```bash
docker exec mediakit-mysql-1 mysql -umediakit -pmediakit_pw -e "
SELECT email, role, businessLineCode FROM User ORDER BY email;
SELECT businessLineCode, ownerId, COUNT(*) FROM Campaign GROUP BY businessLineCode, ownerId;
SELECT ownerId, COUNT(*) FROM Project GROUP BY ownerId;
SELECT ownerId, kind, COUNT(*) FROM DataRecord GROUP BY ownerId, kind" mediakit
```

Expected:
- User：admin(ADMIN, NULL) + 6 个 `{code小写}@mediakit.local`(USER, 各 code) + db/cascade(USER, NULL)
- Campaign：6 行各归对应业务线账号（ownerId 不再是 admin）
- Project：admin 只剩 1 条（meta.businessLine NULL）；其余按业务线分布（FT8/DG8/DM9/CX1 + cascade 那条不动）
- DataRecord：CAMPAIGN 6 条归业务线账号；CREATOR 12 条仍归 admin

- [ ] **Step 5: 手动验证（起 dev server）**

```bash
pnpm dev   # web :5173 + server :4000
```

验证清单（注意登录限流 10 次/5 分钟，慢慢来）：
1. `dg@mediakit.local` / `mediakit123` 登录 → 顶栏显示 `DG` 徽章 → 报告管理只见 DG 的 8 个项目 → 数据管理 Campaign 只见 DG 的 1 条 → 新建报告弹窗业务线锁定为 DG（灰）→ Creator 页仍能看到全部达人（共享读）
2. `admin@mediakit.local` / `admin123` 登录 → 顶栏 ADMIN 徽章无业务线徽章 → 报告管理见全部（含 cascade 的 1 条 + 业务线账号新建的）→ 弹窗业务线可选
3. 业务线账号用 curl 直接 GET `/api/v1/campaigns`（带其 token）→ 只返回本业务线 campaign

- [ ] **Step 6: 更新 PROJECT.md**

`docs/PROJECT.md` 的 seed 一行（L83 附近）后补：

```markdown
pnpm --filter @mediakit/server db:seed    # admin@mediakit.local / admin123
# 同时生成业务线账号（按 BusinessLine 表）：{code小写}@mediakit.local / mediakit123
# 如 ft@mediakit.local / sm@… / cx@… / dg@… / kn@… / dm@…（role=USER，数据按 ownerId 隔离到本业务线）
```

- [ ] **Step 7: Commit**

```bash
git add docs/PROJECT.md
git commit -m "docs: 业务线账号说明（seed 生成 / 初始密码 / 隔离语义）"
```

---

## Self-Review 结论

- **Spec 覆盖**：§1 模型/seed/JWT（Task 1-5）、§2 划归（Task 2 DDL + Task 5 划归脚本——实现从 migration SQL 移到 seed 以消除顺序依赖，语义与幂等性不变）、§3 服务端隔离（Task 6-8：data/creator 共享读/lookup 鉴权/写守卫）、§4 前端（Task 9）、§5 测试（各任务内嵌 + Task 10 门禁）、§6 错误处理（旧 token bl 缺失 → `?? null`，Task 3/4 已覆盖）。
- **两处 spec 修正**已内联：孤儿账号只告警不删（防级联毁数据）；划归脚本化（顺序安全）。Task 1 Step 2 同步改 spec 文件。
- **类型一致性**：`AuthPayload { id, role, businessLineCode }` nonetheless 贯穿 middleware/controller/service；service 层 viewer 参数用结构子集 `{ id, role }` 兼容；`assertBusinessLine(viewer, code)` 单一定义（utils/business-line.ts），Task 6 创建 Task 7 复用。
- **无占位符**；所有步骤含完整代码与精确命令。
