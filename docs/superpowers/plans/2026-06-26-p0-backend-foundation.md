# P0 后端骨架 实施计划（API + 集成测试）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭起 pnpm monorepo 骨架 + Express/Prisma/MySQL/Redis 后端，交付可登录、可创建空项目、用户与项目数据隔离的 REST API，并用 supertest + vitest 全套集成测试验证。

**Architecture:** 仓库 = `apps/server`（Express + TS，CommonJS）+ `packages/shared`（前后端共享的纯类型，type-only）。MySQL 8 与 Redis 7 通过根目录 `docker-compose.yml` 本地起服务；测试用同一 MySQL 实例下的独立库 `ppt_generator_test` + Redis DB 1，vitest `singleFork` 串行执行避免竞态。认证用单 `JWT_SECRET` + `type` 声明区分 access/refresh；refresh 放 HttpOnly Cookie，jti 黑名单存 Redis，刷新即轮换。

**Tech Stack:** Node 20 · pnpm 9 workspaces · TypeScript 5 · Express 4 · Prisma 5 · MySQL 8 · Redis 7（ioredis）· jsonwebtoken · bcryptjs · zod · pino · vitest 2 · supertest 7。

**对应 spec：** `docs/superpowers/specs/2026-06-25-ppt-generator-design.md`。本计划覆盖 spec 的 §2 技术栈、§4 数据模型中的 User/Project/Role、§5.1/5.2/5.3 API、§6 认证设计、§11 错误处理、§13 部署中的 mysql+redis 部分。
**不在 P0 范围**（留后续计划）：前端（P1+）、编辑器内核、业务组件、Dataset/上传、ExportJob/Puppeteer 导出、shareSlug 分享、`/internal/render`、BullMQ worker、Docker 镜像里的 server/web 服务定义。

---

## 前置条件

- Node ≥ 20（本机已 v20.20.2 ✓）、pnpm ≥ 9（已 9.15.0 ✓）、Docker + Compose 且 daemon 运行中（已 ✓）。
- **建议在独立分支/worktree 上执行**（如 `git checkout -b p0-backend`），不要直接在 `main` 上写代码。

## File Structure

| 路径 | 类型 | 职责 |
|---|---|---|
| `package.json` | 新建 | 根 monorepo 清单 + workspace 脚本 |
| `pnpm-workspace.yaml` | 新建 | 声明 `apps/*` 与 `packages/*` |
| `.nvmrc` | 新建 | 固定 Node 20 |
| `tsconfig.json` | 新建 | 根 TS base（CommonJS / Node） |
| `packages/shared/package.json` | 新建 | type-only 共享包，入口指向 `src/index.ts` |
| `packages/shared/src/index.ts` | 新建 | 导出 `Role` 及后续 DTO 类型 |
| `docker-compose.yml` | 新建 | mysql:8.0 + redis:7-alpine（dev/测试共用） |
| `docker/mysql-init/01-databases.sql` | 新建 | 首启创建测试库 `ppt_generator_test` |
| `.env.example` | 新建 | 环境变量模板（提交） |
| `.env` / `.env.test` | 新建(gitignored) | dev / test 实际环境变量 |
| `apps/server/package.json` | 新建 | server 清单 + 依赖 + 脚本 |
| `apps/server/tsconfig.json` | 新建 | 继承根 base，outDir=dist |
| `apps/server/vitest.config.ts` | 新建 | globalSetup 跑迁移、setupFiles 每测清库、singleFork |
| `apps/server/prisma/schema.prisma` | 新建 | User + Project + Role enum（P0 子集） |
| `apps/server/prisma/seed.ts` | 新建 | 种子脚本：创建 admin |
| `apps/server/src/config.ts` | 新建 | zod 校验 + 读取 env |
| `apps/server/src/logger.ts` | 新建 | pino 实例 |
| `apps/server/src/prisma.ts` | 新建 | PrismaClient 单例 |
| `apps/server/src/redis.ts` | 新建 | ioredis 实例 + 黑名单 key helper |
| `apps/server/src/app.ts` | 新建 | `createApp()` 组装 express（不监听端口） |
| `apps/server/src/index.ts` | 新建 | 监听端口启动 |
| `apps/server/src/routes/index.ts` | 新建 | 挂载 `/api/v1/*` 路由 |
| `apps/server/src/middleware/auth.ts` | 新建 | `auth()` / `requireAdmin()` |
| `apps/server/src/middleware/validate.ts` | 新建 | zod body/params/query 校验 |
| `apps/server/src/middleware/error.ts` | 新建 | 全局错误中间件 + Prisma 错误翻译 |
| `apps/server/src/utils/ApiError.ts` | 新建 | 带状态码/code 的错误类 |
| `apps/server/src/utils/asyncHandler.ts` | 新建 | 包 async controller |
| `apps/server/src/utils/hash.ts` | 新建 | bcryptjs hash/compare |
| `apps/server/src/types/express.d.ts` | 新建 | 给 `req.user` 增加类型 |
| `apps/server/src/modules/auth/*` | 新建 | token / schema / service / controller / routes |
| `apps/server/src/modules/users/*` | 新建 | schema / controller / routes |
| `apps/server/src/modules/projects/*` | 新建 | schema / service / controller / routes |
| `apps/server/tests/global-setup.ts` | 新建 | 载入 .env.test + 跑 `prisma migrate deploy` |
| `apps/server/tests/setup.ts` | 新建 | 每测清库清 Redis + createApp helper |
| `apps/server/tests/helpers.ts` | 新建 | createUser / login 取 token |
| `apps/server/tests/{health,db,auth,users,projects}.test.ts` | 新建 | 各模块集成测试 |

---

## Task 1: monorepo 骨架 + pnpm workspaces + packages/shared

**Files:**
- Create: `package.json`、`pnpm-workspace.yaml`、`.nvmrc`、`tsconfig.json`
- Create: `packages/shared/package.json`、`packages/shared/src/index.ts`

- [ ] **Step 1: 创建根 `package.json`**

```json
{
  "name": "ppt-generator",
  "version": "0.0.0",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "engines": { "node": ">=20" },
  "scripts": {
    "dev:server": "pnpm --filter @ppt-generator/server dev",
    "test": "pnpm -r --if-present test",
    "typecheck": "pnpm -r --if-present typecheck",
    "db:migrate": "pnpm --filter @ppt-generator/server prisma:migrate",
    "db:seed": "pnpm --filter @ppt-generator/server seed"
  }
}
```

- [ ] **Step 2: 创建 `pnpm-workspace.yaml`**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 3: 创建 `.nvmrc`**

```
20
```

- [ ] **Step 4: 创建根 `tsconfig.json`（base，CommonJS/Node）**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "CommonJS",
    "moduleResolution": "Node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false
  }
}
```

- [ ] **Step 5: 创建 `packages/shared/package.json`（type-only，入口指向源码）**

```json
{
  "name": "@ppt-generator/shared",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  }
}
```

- [ ] **Step 6: 创建 `packages/shared/src/index.ts`**

```ts
export type Role = 'ADMIN' | 'USER'
```

- [ ] **Step 7: 安装并校验 workspace**

运行：`pnpm install`
预期：输出 `Lockfile`/`packages hardened` 等正常信息，无错误；生成 `pnpm-lock.yaml`。

运行：`pnpm ls -r --depth -1`
预期：列出 `ppt-generator`、`@ppt-generator/shared` 两个包。

- [ ] **Step 8: 提交**

```bash
git add package.json pnpm-workspace.yaml .nvmrc tsconfig.json packages/ pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore: init pnpm monorepo + packages/shared

Root workspace + tsconfig base (CommonJS/Node); packages/shared is a
type-only package consumed via `import type` (workspace symlink, no build).

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

预期：`[<branch>] chore: init pnpm monorepo ...`。

---

## Task 2: Docker 基础设施（mysql + redis）+ 环境变量模板

**Files:**
- Create: `docker-compose.yml`、`docker/mysql-init/01-databases.sql`、`.env.example`
- Create(gitignored): `.env`、`.env.test`
- Modify: `.gitignore`（补 `.env.test`）

- [ ] **Step 1: 创建 `docker-compose.yml`**

```yaml
services:
  mysql:
    image: mysql:8.0
    container_name: ppt-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:-rootpass}
      MYSQL_DATABASE: ppt_generator
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ./docker/mysql-init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-uroot", "-p${MYSQL_ROOT_PASSWORD:-rootpass}"]
      interval: 5s
      retries: 20
      start_period: 20s

  redis:
    image: redis:7-alpine
    container_name: ppt-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      retries: 10

volumes:
  mysql_data:
  redis_data:
```

- [ ] **Step 2: 创建 `docker/mysql-init/01-databases.sql`（首启建测试库）**

```sql
CREATE DATABASE IF NOT EXISTS ppt_generator_test
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

- [ ] **Step 3: 创建 `.env.example`（提交的模板）**

```
NODE_ENV=development
PORT=3001
DATABASE_URL=mysql://root:rootpass@localhost:3306/ppt_generator
REDIS_URL=redis://localhost:6379/0
JWT_SECRET=replace-with-a-long-random-string-min-16-chars
MYSQL_ROOT_PASSWORD=rootpass
```

- [ ] **Step 4: 创建实际 `.env`（dev）**

内容（JWT_SECRET 至少 16 字符）：

```
NODE_ENV=development
PORT=3001
DATABASE_URL=mysql://root:rootpass@localhost:3306/ppt_generator
REDIS_URL=redis://localhost:6379/0
JWT_SECRET=dev-secret-change-me-32chars-min
MYSQL_ROOT_PASSWORD=rootpass
```

- [ ] **Step 5: 创建 `.env.test`（测试库 + Redis DB 1）**

```
NODE_ENV=test
PORT=3099
DATABASE_URL=mysql://root:rootpass@localhost:3306/ppt_generator_test
REDIS_URL=redis://localhost:6379/1
JWT_SECRET=test-secret-change-me-32chars-min
MYSQL_ROOT_PASSWORD=rootpass
```

- [ ] **Step 6: 更新 `.gitignore`，确保 `.env.test` 不入库**

在 `.gitignore` 的 `# Environment` 段追加一行 `.env.test`（`.env` 与 `.env.local`、`.env.*.local` 已存在）。最终该段形如：

```
# Environment
.env
.env.local
.env.*.local
.env.test
```

- [ ] **Step 7: 启动 mysql + redis，等待健康**

运行：
```bash
docker compose up -d mysql redis
docker compose ps
```
预期：`ppt-mysql` 与 `ppt-redis` 状态为 `Up`，且 mysql 的 STATUS 含 `(healthy)`（首次启动需等约 20–30s）。

校验测试库已建：
```bash
docker compose exec -T mysql mysql -uroot -prootpass -e "SHOW DATABASES LIKE 'ppt_generator_test'"
```
预期：表格输出一行 `ppt_generator_test`。
（若该卷已存在旧数据导致 init 脚本未执行，则手动补：`docker compose exec -T mysql mysql -uroot -prootpass -e "CREATE DATABASE IF NOT EXISTS ppt_generator_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"`）

- [ ] **Step 8: 提交**

```bash
git add docker-compose.yml docker/ .env.example .gitignore
git commit -m "$(cat <<'EOF'
chore: add docker-compose (mysql+redis) + env templates

Local dev/test infra. Init script creates ppt_generator_test on first
boot. .env/.env.test are gitignored; .env.example is the committed template.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

预期：`.env` / `.env.test` **不会**出现在 `git status` 中（已被忽略）；commit 仅含 4 个文件。

---

## Task 3: apps/server 骨架 + health 端点 + vitest 测试基座

**Files:**
- Create: `apps/server/package.json`、`apps/server/tsconfig.json`、`apps/server/vitest.config.ts`
- Create: `apps/server/src/config.ts`、`apps/server/src/logger.ts`、`apps/server/src/app.ts`、`apps/server/src/index.ts`、`apps/server/src/routes/index.ts`
- Create: `apps/server/tests/health.test.ts`

- [ ] **Step 1: 创建 `apps/server/package.json`（先只写框架，依赖 Step 3 装）**

```json
{
  "name": "@ppt-generator/server",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "cross-env NODE_ENV=test vitest run",
    "test:watch": "cross-env NODE_ENV=test vitest",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:deploy": "prisma migrate deploy",
    "seed": "tsx prisma/seed.ts"
  }
}
```

- [ ] **Step 2: 创建 `apps/server/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "dist",
    "types": ["node"]
  },
  "include": ["src", "tests", "prisma/seed.ts"]
}
```

- [ ] **Step 3: 安装依赖**

在仓库根运行：
```bash
pnpm --filter @ppt-generator/server add express@^4 cookie-parser@^1 dotenv@^16 zod@^3 pino@^9 ioredis@^5 jsonwebtoken@^9 bcryptjs@^2 @prisma/client@^5
pnpm --filter @ppt-generator/server add -D typescript@^5 tsx@^4 vitest@^2 supertest@^7 cross-env@^7 prisma@^5 pino-pretty@^11 @types/node@^20 @types/express@^4 @types/cookie-parser@^1 @types/jsonwebtoken@^9 @types/bcryptjs@^2 @types/supertest@^6
pnpm --filter @ppt-generator/server add @ppt-generator/shared
```
预期：三条命令均成功；`pnpm-lock.yaml` 更新。`@ppt-generator/shared` 在 `apps/server/package.json` 的 dependencies 中显示为 `"workspace:*"`。

- [ ] **Step 4: 创建 `apps/server/src/config.ts`（zod 校验 env）**

```ts
import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
})

const parsed = envSchema.safeParse(process.env)
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const config = parsed.data
export const isProd = config.NODE_ENV === 'production'
export const isTest = config.NODE_ENV === 'test'
```

> 说明：`import 'dotenv/config'` 默认载入 `.env`；测试时 `tests/global-setup.ts` 会先以 `override:true` 载入 `.env.test` 设置测试库，dotenv 默认不覆盖已存在的变量，故测试库优先级更高。

- [ ] **Step 5: 创建 `apps/server/src/logger.ts`**

```ts
import pino from 'pino'
import { config } from './config'

export const logger = pino({
  level: config.NODE_ENV === 'test' ? 'silent' : 'info',
  transport: config.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
})
```

- [ ] **Step 6: 创建 `apps/server/src/routes/index.ts`（先只有 health）**

```ts
import { Router } from 'express'

const api = Router()

api.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

export default api
```

- [ ] **Step 7: 创建 `apps/server/src/app.ts`（导出 createApp，不监听端口）**

```ts
import express from 'express'
import cookieParser from 'cookie-parser'
import apiRouter from './routes'

export function createApp() {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/v1', apiRouter)
  return app
}
```

- [ ] **Step 8: 创建 `apps/server/src/index.ts`（启动入口）**

```ts
import { createApp } from './app'
import { config } from './config'
import { logger } from './logger'

const app = createApp()
app.listen(config.PORT, () => {
  logger.info(`server listening on :${config.PORT}`)
})
```

- [ ] **Step 9: 创建 `apps/server/vitest.config.ts`（先不放 globalSetup，Task 4 再加）**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
})
```

- [ ] **Step 10: 写失败测试 `apps/server/tests/health.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'

describe('GET /api/v1/health', () => {
  it('returns 200 { status: "ok" }', async () => {
    const res = await request(createApp()).get('/api/v1/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })
})
```

- [ ] **Step 11: 运行测试，确认通过**

运行：`pnpm --filter @ppt-generator/server test`
预期：`1 passed`，输出含 `✓ returns 200 { status: "ok" }`。

> 该测试不连数据库/Redis（health 路由不触达），仅校验 express 装配与 env 校验通过。

- [ ] **Step 12: 起开发服务器冒烟**

运行（后台或另开终端）：`pnpm dev:server`
运行：`curl -s http://localhost:3001/api/v1/health`
预期：返回 `{"status":"ok"}`。然后停掉 dev server。

- [ ] **Step 13: 提交**

```bash
git add apps/server/package.json apps/server/tsconfig.json apps/server/vitest.config.ts apps/server/src pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(server): express skeleton with health endpoint + vitest harness

createApp() factory (no listen) for supertest; config with zod-validated
env; pino logger. health.test bootstraps the integration test harness.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Prisma schema（User/Project）+ 迁移 + 测试库 reset

**Files:**
- Create: `apps/server/prisma/schema.prisma`、`apps/server/src/prisma.ts`
- Create: `apps/server/src/redis.ts`
- Create: `apps/server/tests/global-setup.ts`、`apps/server/tests/setup.ts`、`apps/server/tests/db.test.ts`
- Modify: `apps/server/vitest.config.ts`（接入 globalSetup/setupFiles）

> P0 schema 只含 `User` + `Project` + `Role` enum（spec §4 的子集）。`Dataset`/`ExportJob`/`shareSlug`/`shareEnabled` 留给后续阶段（迁移是增量追加，不冲突）。

- [ ] **Step 1: 创建 `apps/server/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  USER
}

model User {
  id           String    @id @default(cuid())
  username     String    @unique
  passwordHash String
  role         Role      @default(USER)
  projects     Project[]
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}

model Project {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name         String
  canvasWidth  Int      @default(1280)
  canvasHeight Int      @default(720)
  pages        Json     @default("[]")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([userId])
}
```

- [ ] **Step 2: 生成 client 并创建首条迁移（dev 库）**

确保 `docker compose up -d mysql` 已运行。运行：
```bash
pnpm --filter @ppt-generator/server exec prisma generate
pnpm --filter @ppt-generator/server exec prisma migrate dev --name init
```
预期：生成 `@prisma/client`；创建 `apps/server/prisma/migrations/<ts>_init/migration.sql`；dev 库 `ppt_generator` 建表；输出 `Applied migration`。

- [ ] **Step 3: 创建 `apps/server/src/prisma.ts`（单例）**

```ts
import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()
```

- [ ] **Step 4: 创建 `apps/server/src/redis.ts`（ioredis + 黑名单 key）**

```ts
import { Redis } from 'ioredis'
import { config } from './config'

export const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null })

export const REFRESH_BLACKLIST_PREFIX = 'auth:refresh:'
export const refreshKey = (jti: string) => `${REFRESH_BLACKLIST_PREFIX}${jti}`
```

- [ ] **Step 5: 创建 `apps/server/tests/global-setup.ts`（载入 .env.test + 对测试库跑 migrate deploy）**

```ts
import { execSync } from 'node:child_process'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.test', override: true })

export default async function globalSetup() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL missing for tests — check apps/server/.env.test')
  }
  execSync('pnpm exec prisma migrate deploy', { stdio: 'inherit', env: process.env })
}
```

- [ ] **Step 6: 创建 `apps/server/tests/setup.ts`（每测清库清 Redis + 断开连接）**

```ts
import { beforeEach, afterAll } from 'vitest'
import { prisma } from '../src/prisma'
import { redis } from '../src/redis'

export async function resetDb() {
  // FK 安全顺序：先 Project 后 User
  await prisma.project.deleteMany()
  await prisma.user.deleteMany()
}

export async function resetRedis() {
  await redis.flushdb()
}

beforeEach(async () => {
  await resetDb()
  await resetRedis()
})

afterAll(async () => {
  await prisma.$disconnect()
  await redis.quit()
})
```

- [ ] **Step 7: 更新 `apps/server/vitest.config.ts` 接入 setup**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/global-setup.ts'],
    setupFiles: ['./tests/setup.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
})
```

- [ ] **Step 8: 写测试 `apps/server/tests/db.test.ts`（验证 beforeEach reset 生效）**

```ts
import { describe, it, expect } from 'vitest'
import { prisma } from '../src/prisma'

describe('test db reset (beforeEach)', () => {
  it('can create a user', async () => {
    await prisma.user.create({ data: { username: 'temp', passwordHash: 'x', role: 'USER' } })
    expect(await prisma.user.count()).toBe(1)
  })

  it('starts clean because resetDb ran in beforeEach', async () => {
    expect(await prisma.user.count()).toBe(0)
  })
})
```

- [ ] **Step 9: 运行测试，确认 global-setup 连库 + reset 生效**

运行：`pnpm --filter @ppt-generator/server test`
预期：全部通过（health 1 + db 2）。global-setup 输出 `Applied migration` 到测试库；第二条断言为 0（证明 beforeEach 清库）。

- [ ] **Step 10: 提交**

```bash
git add apps/server/prisma apps/server/src/prisma.ts apps/server/src/redis.ts apps/server/vitest.config.ts apps/server/tests/global-setup.ts apps/server/tests/setup.ts apps/server/tests/db.test.ts
git commit -m "$(cat <<'EOF'
feat(server): prisma schema (User/Project) + migrations + test db reset

P0 schema subset (User/Project/Role); Dataset/ExportJob/share deferred.
global-setup deploys migrations to ppt_generator_test; setupFiles resets
db+redis before each test. singleFork pool avoids shared-db races.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

## Task 5: 错误处理 / 校验 / 哈希 等基础设施

**Files:**
- Create: `apps/server/src/utils/ApiError.ts`、`apps/server/src/utils/asyncHandler.ts`、`apps/server/src/utils/hash.ts`
- Create: `apps/server/src/middleware/validate.ts`、`apps/server/src/middleware/error.ts`
- Create: `apps/server/src/types/express.d.ts`
- Create: `apps/server/tests/hash.test.ts`
- Modify: `apps/server/src/app.ts`（接入 errorHandler）

- [ ] **Step 1: 写失败测试 `apps/server/tests/hash.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '../src/utils/hash'

describe('hash utils', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('s3cret')
    expect(hash).not.toBe('s3cret')
    await expect(verifyPassword('s3cret', hash)).resolves.toBe(true)
  })

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('s3cret')
    await expect(verifyPassword('wrong', hash)).resolves.toBe(false)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

运行：`pnpm --filter @ppt-generator/server test hash`
预期：FAIL（`Cannot find module '../src/utils/hash'`）。

- [ ] **Step 3: 创建 `apps/server/src/utils/hash.ts`**

```ts
import bcrypt from 'bcryptjs'

const ROUNDS = 10

export const hashPassword = (plain: string) => bcrypt.hash(plain, ROUNDS)
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash)
```

- [ ] **Step 4: 创建 `apps/server/src/utils/ApiError.ts`**

```ts
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }

  static unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    return new ApiError(401, code, message)
  }
  static forbidden(message = 'Forbidden', code = 'FORBIDDEN') {
    return new ApiError(403, code, message)
  }
  static notFound(message = 'Not Found', code = 'NOT_FOUND') {
    return new ApiError(404, code, message)
  }
  static badRequest(message = 'Bad Request', code = 'BAD_REQUEST', details?: unknown) {
    return new ApiError(400, code, message, details)
  }
  static conflict(message = 'Conflict', code = 'CONFLICT', details?: unknown) {
    return new ApiError(409, code, message, details)
  }
  static unprocessable(message = 'Validation failed', code = 'VALIDATION_ERROR', details?: unknown) {
    return new ApiError(422, code, message, details)
  }
}
```

- [ ] **Step 5: 创建 `apps/server/src/utils/asyncHandler.ts`**

```ts
import type { Request, Response, NextFunction, RequestHandler } from 'express'

type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<unknown>

export const asyncHandler = (fn: AsyncFn): RequestHandler => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}
```

- [ ] **Step 6: 创建 `apps/server/src/middleware/validate.ts`（zod 校验 body/params/query）**

```ts
import type { RequestHandler } from 'express'
import type { ZodTypeAny } from 'zod'
import { ApiError } from '../utils/ApiError'

type Schemas = { body?: ZodTypeAny; query?: ZodTypeAny; params?: ZodTypeAny }

export const validate =
  (schemas: Schemas): RequestHandler =>
  (req, _res, next) => {
    try {
      for (const key of ['params', 'query', 'body'] as const) {
        const schema = schemas[key]
        if (schema) (req as unknown as Record<string, unknown>)[key] = schema.parse(req[key])
      }
      next()
    } catch (err) {
      const issues = (err as { flatten?: () => unknown }).flatten
        ? (err as { flatten: () => unknown }).flatten()
        : (err as { issues?: unknown }).issues
      next(ApiError.unprocessable('Validation failed', 'VALIDATION_ERROR', issues))
    }
  }
```

- [ ] **Step 7: 创建 `apps/server/src/middleware/error.ts`（全局错误 + Prisma 翻译）**

```ts
import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import { ApiError } from '../utils/ApiError'
import { logger } from '../logger'
import { config } from '../config'

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res
      .status(422)
      .json({ error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: err.flatten() } })
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res
        .status(409)
        .json({ error: { code: 'CONFLICT', message: 'Resource already exists', details: err.meta } })
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } })
    }
  }

  if (err instanceof ApiError) {
    if (err.statusCode >= 500) logger.error({ err }, 'API error')
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    })
  }

  logger.error({ err }, 'Unhandled error')
  const message = config.NODE_ENV === 'production' ? 'Internal Server Error' : (err as Error).message
  return res.status(500).json({ error: { code: 'INTERNAL', message } })
}
```

- [ ] **Step 8: 创建 `apps/server/src/types/express.d.ts`（给 req.user 加类型）**

```ts
import type { Role } from '@ppt-generator/shared'

declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: string; username: string; role: Role }
  }
}
```

- [ ] **Step 9: 在 `apps/server/src/app.ts` 接入 errorHandler**

把 `app.ts` 的 `return app` 之前补一行 `app.use(errorHandler)`：

```ts
import express from 'express'
import cookieParser from 'cookie-parser'
import apiRouter from './routes'
import { errorHandler } from './middleware/error'

export function createApp() {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/v1', apiRouter)
  app.use(errorHandler)
  return app
}
```

- [ ] **Step 10: 运行全部测试**

运行：`pnpm --filter @ppt-generator/server test`
预期：全部通过（health 1 + db 2 + hash 2）。

- [ ] **Step 11: 提交**

```bash
git add apps/server/src/utils apps/server/src/middleware apps/server/src/types apps/server/src/app.ts apps/server/tests/hash.test.ts
git commit -m "$(cat <<'EOF'
feat(server): error handling, validation, hashing middleware

ApiError + asyncHandler + zod validate middleware; global errorHandler
translates Prisma P2002/P2025 and shapes { error: { code, message } };
bcryptjs hash utils. req.user typed via express augmentation.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 认证（JWT access/refresh + Redis 黑名单 + 轮换）

**Files:**
- Modify: `packages/shared/src/index.ts`（加认证相关 DTO）
- Create: `apps/server/src/modules/auth/token.ts`、`auth.schema.ts`、`auth.service.ts`、`auth.controller.ts`、`auth.routes.ts`
- Create: `apps/server/src/middleware/auth.ts`
- Modify: `apps/server/src/routes/index.ts`（挂 /auth）
- Create: `apps/server/tests/helpers.ts`、`apps/server/tests/auth.test.ts`

- [ ] **Step 1: 扩充 `packages/shared/src/index.ts`（加 DTO 类型）**

```ts
export type Role = 'ADMIN' | 'USER'

export interface UserPublic {
  id: string
  username: string
  role: Role
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  accessToken: string
}
```

- [ ] **Step 2: 创建 `apps/server/src/modules/auth/token.ts`（签发/校验）**

```ts
import jwt, { type JwtPayload } from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import type { Role } from '@ppt-generator/shared'
import { config } from '../../config'

export const ACCESS_TTL = '15m'
export const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 天

interface AccessPayload extends JwtPayload {
  userId: string
  role: Role
  jti: string
  type: 'access'
}
interface RefreshPayload extends JwtPayload {
  userId: string
  jti: string
  type: 'refresh'
}

export function signAccessToken(user: { id: string; role: Role }) {
  return jwt.sign({ userId: user.id, role: user.role, jti: randomUUID(), type: 'access' }, config.JWT_SECRET, {
    expiresIn: ACCESS_TTL,
  })
}

export function signRefreshToken(userId: string, jti = randomUUID()) {
  return jwt.sign({ userId, jti, type: 'refresh' }, config.JWT_SECRET, { expiresIn: REFRESH_TTL_SECONDS })
}

export function verifyAccessToken(token: string): AccessPayload {
  const payload = jwt.verify(token, config.JWT_SECRET) as AccessPayload
  if (payload.type !== 'access') throw new Error('not an access token')
  return payload
}

export function verifyRefreshToken(token: string): RefreshPayload {
  const payload = jwt.verify(token, config.JWT_SECRET) as RefreshPayload
  if (payload.type !== 'refresh') throw new Error('not a refresh token')
  return payload
}
```

- [ ] **Step 3: 创建 `apps/server/src/modules/auth/auth.schema.ts`**

```ts
import { z } from 'zod'

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})
```

- [ ] **Step 4: 创建 `apps/server/src/modules/auth/auth.service.ts`**

```ts
import { prisma } from '../../prisma'
import { redis, refreshKey } from '../../redis'
import { ApiError } from '../../utils/ApiError'
import { verifyPassword } from '../../utils/hash'
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from './token'

export async function login(username: string, password: string) {
  const user = await prisma.user.findUnique({ where: { username } })
  if (!user) throw ApiError.unauthorized('Invalid credentials', 'INVALID_CREDENTIALS')
  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok) throw ApiError.unauthorized('Invalid credentials', 'INVALID_CREDENTIALS')

  const accessToken = signAccessToken({ id: user.id, role: user.role })
  const refreshToken = signRefreshToken(user.id)
  return { accessToken, refreshToken }
}

export async function refresh(refreshToken: string) {
  let payload
  try {
    payload = verifyRefreshToken(refreshToken)
  } catch {
    throw ApiError.unauthorized('Invalid refresh token', 'INVALID_REFRESH')
  }

  if (await redis.get(refreshKey(payload.jti))) {
    throw ApiError.unauthorized('Refresh token revoked', 'INVALID_REFRESH')
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  if (!user) throw ApiError.unauthorized('Invalid refresh token', 'INVALID_REFRESH')

  // 轮换：作废旧 jti（TTL = 剩余有效期，最少 1s）
  const remaining = Math.max(1, (payload.exp ?? 0) - Math.floor(Date.now() / 1000))
  await redis.set(refreshKey(payload.jti), '1', 'EX', remaining)

  const accessToken = signAccessToken({ id: user.id, role: user.role })
  const newRefresh = signRefreshToken(user.id)
  return { accessToken, refreshToken: newRefresh }
}

export async function logout(refreshToken?: string) {
  if (!refreshToken) return
  try {
    const payload = verifyRefreshToken(refreshToken)
    const remaining = Math.max(1, (payload.exp ?? 0) - Math.floor(Date.now() / 1000))
    await redis.set(refreshKey(payload.jti), '1', 'EX', remaining)
  } catch {
    // 无效 token 视作已登出，忽略
  }
}
```

- [ ] **Step 5: 创建 `apps/server/src/modules/auth/auth.controller.ts`**

```ts
import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { isProd } from '../../config'
import * as authService from './auth.service'

const REFRESH_COOKIE = 'refreshToken'

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' })
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { username, password } = req.body
  const { accessToken, refreshToken } = await authService.login(username, password)
  setRefreshCookie(res, refreshToken)
  res.json({ accessToken })
})

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE]
  const { accessToken, refreshToken } = await authService.refresh(token)
  setRefreshCookie(res, refreshToken)
  res.json({ accessToken })
})

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE]
  await authService.logout(token)
  clearRefreshCookie(res)
  res.json({ ok: true })
})

export const me = asyncHandler(async (req: Request, res: Response) => {
  res.json({ id: req.user!.id, username: req.user!.username, role: req.user!.role })
})
```

- [ ] **Step 6: 创建 `apps/server/src/middleware/auth.ts`（auth + requireAdmin）**

```ts
import type { RequestHandler } from 'express'
import { prisma } from '../prisma'
import { verifyAccessToken } from '../modules/auth/token'
import { ApiError } from '../utils/ApiError'

export const auth: () => RequestHandler = () => async (req, _res, next) => {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) throw ApiError.unauthorized()
    const token = header.slice(7)
    const payload = verifyAccessToken(token)
    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    if (!user) throw ApiError.unauthorized()
    req.user = { id: user.id, username: user.username, role: user.role }
    next()
  } catch (err) {
    next(err instanceof ApiError ? err : ApiError.unauthorized())
  }
}

export const requireAdmin: () => RequestHandler = () => (req, _res, next) => {
  if (req.user?.role !== 'ADMIN') return next(ApiError.forbidden('Admin only', 'ADMIN_ONLY'))
  next()
}
```

- [ ] **Step 7: 创建 `apps/server/src/modules/auth/auth.routes.ts`**

```ts
import { Router } from 'express'
import { validate } from '../../middleware/validate'
import { auth } from '../../middleware/auth'
import { loginSchema } from './auth.schema'
import * as ctrl from './auth.controller'

const router = Router()

router.post('/login', validate({ body: loginSchema }), ctrl.login)
router.post('/refresh', ctrl.refresh)
router.post('/logout', ctrl.logout)
router.get('/me', auth(), ctrl.me)

export default router
```

- [ ] **Step 8: 在 `apps/server/src/routes/index.ts` 挂载 /auth**

```ts
import { Router } from 'express'
import authRoutes from '../modules/auth/auth.routes'

const api = Router()

api.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

api.use('/auth', authRoutes)

export default api
```

- [ ] **Step 9: 创建 `apps/server/tests/helpers.ts`（建用户、登录取 token）**

```ts
import request from 'supertest'
import { prisma } from '../src/prisma'
import { hashPassword } from '../src/utils/hash'
import { createApp } from '../src/app'
import type { Role } from '@ppt-generator/shared'

export function api() {
  return request(createApp())
}

export async function createUser(opts: { username: string; password?: string; role?: Role }) {
  return prisma.user.create({
    data: {
      username: opts.username,
      passwordHash: await hashPassword(opts.password ?? 'pw12345'),
      role: (opts.role ?? 'USER') as 'ADMIN' | 'USER',
    },
  })
}

export async function login(username: string, password = 'pw12345') {
  const res = await api().post('/api/v1/auth/login').send({ username, password })
  return { status: res.status, body: res.body as { accessToken?: string }, cookie: res.headers['set-cookie'] }
}

export function withToken(token?: string) {
  return token ? api().set('Authorization', `Bearer ${token}`) : api()
}
```

- [ ] **Step 10: 写测试 `apps/server/tests/auth.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { api, createUser, login, withToken } from './helpers'
import { createApp } from '../src/app'

describe('auth', () => {
  it('login succeeds and sets refresh cookie', async () => {
    await createUser({ username: 'alice' })
    const res = await login('alice')
    expect(res.status).toBe(200)
    expect(res.body.accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/)
    expect(String(res.cookie)).toContain('refreshToken=')
    expect(String(res.cookie)).toContain('HttpOnly')
  })

  it('login fails with wrong password (401)', async () => {
    await createUser({ username: 'alice' })
    const res = await login('alice', 'wrong')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('login fails for unknown user (401)', async () => {
    const res = await login('nobody')
    expect(res.status).toBe(401)
  })

  it('me returns the logged-in user', async () => {
    await createUser({ username: 'alice' })
    const { body } = await login('alice')
    const res = await withToken(body.accessToken).get('/api/v1/auth/me')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ username: 'alice', role: 'USER' })
  })

  it('me rejects without token (401)', async () => {
    const res = await api().get('/api/v1/auth/me')
    expect(res.status).toBe(401)
  })

  it('refresh issues a new access token (cookie flow)', async () => {
    await createUser({ username: 'alice' })
    const agent = request.agent(createApp())
    await agent.post('/api/v1/auth/login').send({ username: 'alice', password: 'pw12345' })
    const res = await agent.post('/api/v1/auth/refresh')
    expect(res.status).toBe(200)
    expect(res.body.accessToken).toBeTruthy()
  })

  it('refresh rotation invalidates the old refresh token', async () => {
    await createUser({ username: 'alice' })
    // 用首次 login 的 Set-Cookie 作为"旧 token"
    const { cookie } = await login('alice')
    const oldCookie = String(cookie).split(';')[0] // refreshToken=<jwt>

    // 第一次 refresh 成功
    const r1 = await api().post('/api/v1/auth/refresh').set('Cookie', oldCookie)
    expect(r1.status).toBe(200)

    // 同一旧 cookie 再 refresh 应被拒（已轮换作废）
    const r2 = await api().post('/api/v1/auth/refresh').set('Cookie', oldCookie)
    expect(r2.status).toBe(401)
  })

  it('logout revokes the refresh token', async () => {
    await createUser({ username: 'alice' })
    const agent = request.agent(createApp())
    await agent.post('/api/v1/auth/login').send({ username: 'alice', password: 'pw12345' })
    const out = await agent.post('/api/v1/auth/logout')
    expect(out.status).toBe(200)

    const res = await agent.post('/api/v1/auth/refresh')
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 11: 运行测试**

运行：`pnpm --filter @ppt-generator/server test auth`
预期：8 条全部通过。

- [ ] **Step 12: 提交**

```bash
git add packages/shared/src/index.ts apps/server/src/modules/auth apps/server/src/middleware/auth.ts apps/server/src/routes/index.ts apps/server/tests/helpers.ts apps/server/tests/auth.test.ts
git commit -m "$(cat <<'EOF'
feat(server): auth (JWT access/refresh + redis blacklist + rotation)

Single JWT_SECRET with type-claim discrimination; refresh in HttpOnly
cookie path-scoped to /api/v1/auth; rotate jti on refresh, blacklist in
Redis until exp; logout revokes. auth()/requireAdmin() middleware. /me.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 管理员用户管理（/admin/users CRUD）

**Files:**
- Modify: `packages/shared/src/index.ts`（加 users DTO）
- Create: `apps/server/src/modules/users/users.schema.ts`、`users.controller.ts`、`users.routes.ts`
- Modify: `apps/server/src/routes/index.ts`（挂 /admin/users）
- Create: `apps/server/tests/users.test.ts`

- [ ] **Step 1: 扩充 `packages/shared/src/index.ts`（加 users DTO）**

在文件末尾追加：

```ts
export interface CreateUserRequest {
  username: string
  password: string
  role?: Role
}

export interface UpdateUserRequest {
  password?: string
  role?: Role
}
```

- [ ] **Step 2: 创建 `apps/server/src/modules/users/users.schema.ts`**

```ts
import { z } from 'zod'

export const createUserSchema = z.object({
  username: z.string().min(2).max(40),
  password: z.string().min(6).max(100),
  role: z.enum(['ADMIN', 'USER']).default('USER'),
})

export const updateUserSchema = z
  .object({
    password: z.string().min(6).max(100).optional(),
    role: z.enum(['ADMIN', 'USER']).optional(),
  })
  .refine((v) => v.password !== undefined || v.role !== undefined, {
    message: 'Nothing to update',
  })

export const userIdParams = z.object({ id: z.string().min(1) })
```

- [ ] **Step 3: 创建 `apps/server/src/modules/users/users.controller.ts`**

```ts
import type { Request, Response } from 'express'
import { prisma } from '../../prisma'
import { hashPassword } from '../../utils/hash'
import { asyncHandler } from '../../utils/asyncHandler'

const PUBLIC_SELECT = { id: true, username: true, role: true, createdAt: true } as const

export const list = asyncHandler(async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({ select: PUBLIC_SELECT, orderBy: { createdAt: 'desc' } })
  res.json({ users })
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { username, password, role } = req.body
  const user = await prisma.user.create({
    data: { username, passwordHash: await hashPassword(password), role },
    select: PUBLIC_SELECT,
  })
  res.status(201).json({ user })
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  const { password, role } = req.body
  const data: { passwordHash?: string; role?: 'ADMIN' | 'USER' } = {}
  if (password) data.passwordHash = await hashPassword(password)
  if (role) data.role = role
  const user = await prisma.user.update({ where: { id }, data, select: PUBLIC_SELECT })
  res.json({ user })
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  await prisma.user.delete({ where: { id } })
  res.json({ ok: true })
})
```

> 说明：删除用户时级联清理其项目/数据源由 schema 的 `onDelete: Cascade` 保证（见 Task 4）。`update`/`remove` 命中不存在的 id 会抛 Prisma `P2025`，由全局错误中间件翻译成 404（Task 5 Step 7）。

- [ ] **Step 4: 创建 `apps/server/src/modules/users/users.routes.ts`（全部 requireAdmin）**

```ts
import { Router } from 'express'
import { auth, requireAdmin } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { createUserSchema, updateUserSchema, userIdParams } from './users.schema'
import * as ctrl from './users.controller'

const router = Router()

router.use(auth(), requireAdmin())

router.get('/', ctrl.list)
router.post('/', validate({ body: createUserSchema }), ctrl.create)
router.patch('/:id', validate({ params: userIdParams, body: updateUserSchema }), ctrl.update)
router.delete('/:id', validate({ params: userIdParams }), ctrl.remove)

export default router
```

- [ ] **Step 5: 在 `apps/server/src/routes/index.ts` 挂载 /admin/users**

```ts
import { Router } from 'express'
import authRoutes from '../modules/auth/auth.routes'
import usersRoutes from '../modules/users/users.routes'

const api = Router()

api.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

api.use('/auth', authRoutes)
api.use('/admin/users', usersRoutes)

export default api
```

- [ ] **Step 6: 写测试 `apps/server/tests/users.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { api, createUser, login, withToken } from './helpers'

describe('admin users CRUD', () => {
  it('forbids non-admin (403)', async () => {
    await createUser({ username: 'user1', role: 'USER' })
    const { body } = await login('user1')
    const res = await withToken(body.accessToken).get('/api/v1/admin/users')
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('ADMIN_ONLY')
  })

  it('forbids without token (401)', async () => {
    const res = await api().get('/api/v1/admin/users')
    expect(res.status).toBe(401)
  })

  it('admin lists/creates/patches/deletes users', async () => {
    await createUser({ username: 'admin1', role: 'ADMIN' })
    const { body } = await login('admin1')
    const auth = withToken(body.accessToken)

    const list0 = await auth.get('/api/v1/admin/users')
    expect(list0.status).toBe(200)
    expect(list0.body.users.length).toBe(1)

    const created = await auth.post('/api/v1/admin/users').send({
      username: 'newbie',
      password: 'pass1234',
      role: 'USER',
    })
    expect(created.status).toBe(201)
    expect(created.body.user).toMatchObject({ username: 'newbie', role: 'USER' })

    const patched = await auth.patch(`/api/v1/admin/users/${created.body.user.id}`).send({ role: 'ADMIN' })
    expect(patched.status).toBe(200)
    expect(patched.body.user.role).toBe('ADMIN')

    const dup = await auth.post('/api/v1/admin/users').send({ username: 'newbie', password: 'pass1234' })
    expect(dup.status).toBe(409) // P2002 → 409

    const deleted = await auth.delete(`/api/v1/admin/users/${created.body.user.id}`)
    expect(deleted.status).toBe(200)
    expect(deleted.body.ok).toBe(true)

    const missing = await auth.delete(`/api/v1/admin/users/${created.body.user.id}`)
    expect(missing.status).toBe(404) // P2025 → 404
  })
})
```

- [ ] **Step 7: 运行测试**

运行：`pnpm --filter @ppt-generator/server test users`
预期：3 条全部通过。

- [ ] **Step 8: 提交**

```bash
git add packages/shared/src/index.ts apps/server/src/modules/users apps/server/src/routes/index.ts apps/server/tests/users.test.ts
git commit -m "$(cat <<'EOF'
feat(server): admin user management CRUD

All /admin/users routes behind auth()+requireAdmin(); list/create/
patch/delete; duplicate username → 409, missing id → 404 via global
Prisma translation. Cascade delete of projects handled by schema.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

## Task 8: 项目 CRUD + 所有权隔离 + 复制

**Files:**
- Modify: `packages/shared/src/index.ts`（加 project DTO）
- Create: `apps/server/src/modules/projects/projects.schema.ts`、`projects.service.ts`、`projects.controller.ts`、`projects.routes.ts`
- Modify: `apps/server/src/routes/index.ts`（挂 /projects）
- Create: `apps/server/tests/projects.test.ts`

- [ ] **Step 1: 扩充 `packages/shared/src/index.ts`（加 project DTO）**

在文件末尾追加：

```ts
export interface CreateProjectRequest {
  name: string
}

export interface UpdateProjectRequest {
  name?: string
  canvasWidth?: number
  canvasHeight?: number
  pages?: unknown // P1 编辑器会给出强类型 Page[]；P0 透传
}

export interface ProjectSummary {
  id: string
  name: string
  userId: string
  updatedAt: string
}
```

- [ ] **Step 2: 创建 `apps/server/src/modules/projects/projects.schema.ts`**

```ts
import { z } from 'zod'

export const createProjectSchema = z.object({
  name: z.string().min(1).max(120),
})

export const updateProjectSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    canvasWidth: z.number().int().min(1).optional(),
    canvasHeight: z.number().int().min(1).optional(),
    pages: z.unknown().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' })

export const projectIdParams = z.object({ id: z.string().min(1) })
```

- [ ] **Step 3: 创建 `apps/server/src/modules/projects/projects.service.ts`（含所有权校验）**

```ts
import { randomUUID } from 'node:crypto'
import { prisma } from '../../prisma'
import { ApiError } from '../../utils/ApiError'
import type { Role } from '@ppt-generator/shared'

export interface RequestUser {
  id: string
  role: Role
}

interface UpdateInput {
  name?: string
  canvasWidth?: number
  canvasHeight?: number
  pages?: unknown
}

function emptyPages() {
  return [
    { id: randomUUID(), name: '封面', components: [] },
    { id: randomUUID(), name: '第 2 页', components: [] },
    { id: randomUUID(), name: '第 3 页', components: [] },
  ]
}

export async function list(user: RequestUser) {
  return prisma.project.findMany({
    where: user.role === 'ADMIN' ? undefined : { userId: user.id },
    select: {
      id: true,
      name: true,
      canvasWidth: true,
      canvasHeight: true,
      userId: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  })
}

// 存在性 + 所有权统一校验；不满足一律 404（不暴露存在性）
export async function getOwnedProject(id: string, user: RequestUser) {
  const project = await prisma.project.findUnique({ where: { id } })
  if (!project) throw ApiError.notFound('Project not found', 'PROJECT_NOT_FOUND')
  if (user.role !== 'ADMIN' && project.userId !== user.id) {
    throw ApiError.notFound('Project not found', 'PROJECT_NOT_FOUND')
  }
  return project
}

export async function create(user: RequestUser, name: string) {
  return prisma.project.create({
    data: { userId: user.id, name, pages: emptyPages() },
  })
}

export async function update(id: string, user: RequestUser, data: UpdateInput) {
  await getOwnedProject(id, user)
  return prisma.project.update({ where: { id }, data })
}

export async function remove(id: string, user: RequestUser) {
  await getOwnedProject(id, user)
  await prisma.project.delete({ where: { id } })
}

export async function duplicate(id: string, user: RequestUser) {
  const src = await getOwnedProject(id, user)
  return prisma.project.create({
    data: {
      userId: src.userId,
      name: `${src.name} 副本`,
      canvasWidth: src.canvasWidth,
      canvasHeight: src.canvasHeight,
      pages: src.pages as object,
    },
  })
}
```

- [ ] **Step 4: 创建 `apps/server/src/modules/projects/projects.controller.ts`**

```ts
import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import * as service from './projects.service'

export const list = asyncHandler(async (req: Request, res: Response) => {
  res.json({ projects: await service.list(req.user!) })
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const project = await service.create(req.user!, req.body.name)
  res.status(201).json({ project })
})

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const project = await service.getOwnedProject(req.params.id, req.user!)
  res.json({ project })
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const project = await service.update(req.params.id, req.user!, req.body)
  res.json({ project })
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await service.remove(req.params.id, req.user!)
  res.json({ ok: true })
})

export const duplicate = asyncHandler(async (req: Request, res: Response) => {
  const project = await service.duplicate(req.params.id, req.user!)
  res.status(201).json({ project })
})
```

- [ ] **Step 5: 创建 `apps/server/src/modules/projects/projects.routes.ts`**

```ts
import { Router } from 'express'
import { auth } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { createProjectSchema, updateProjectSchema, projectIdParams } from './projects.schema'
import * as ctrl from './projects.controller'

const router = Router()
router.use(auth())

router.get('/', ctrl.list)
router.post('/', validate({ body: createProjectSchema }), ctrl.create)
router.get('/:id', validate({ params: projectIdParams }), ctrl.getOne)
router.patch('/:id', validate({ params: projectIdParams, body: updateProjectSchema }), ctrl.update)
router.delete('/:id', validate({ params: projectIdParams }), ctrl.remove)
router.post('/:id/duplicate', validate({ params: projectIdParams }), ctrl.duplicate)

export default router
```

- [ ] **Step 6: 在 `apps/server/src/routes/index.ts` 挂载 /projects**

```ts
import { Router } from 'express'
import authRoutes from '../modules/auth/auth.routes'
import usersRoutes from '../modules/users/users.routes'
import projectsRoutes from '../modules/projects/projects.routes'

const api = Router()

api.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

api.use('/auth', authRoutes)
api.use('/admin/users', usersRoutes)
api.use('/projects', projectsRoutes)

export default api
```

- [ ] **Step 7: 写测试 `apps/server/tests/projects.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { createUser, login, withToken } from './helpers'

describe('projects', () => {
  it('creates a project with 3 empty pages', async () => {
    await createUser({ username: 'a', role: 'USER' })
    const { body } = await login('a')
    const res = await withToken(body.accessToken).post('/api/v1/projects').send({ name: '我的项目' })
    expect(res.status).toBe(201)
    expect(res.body.project.name).toBe('我的项目')
    expect(res.body.project.pages).toHaveLength(3)
    expect(res.body.project.pages[0].components).toEqual([])
  })

  it('lists only own projects', async () => {
    await createUser({ username: 'a', role: 'USER' })
    await createUser({ username: 'b', role: 'USER' })
    const authA = withToken((await login('a')).body.accessToken)
    const authB = withToken((await login('b')).body.accessToken)
    await authA.post('/api/v1/projects').send({ name: 'A1' })
    await authB.post('/api/v1/projects').send({ name: 'B1' })

    const namesOf = (r: { body: { projects: { name: string }[] } }) => r.body.projects.map((p) => p.name)
    expect(namesOf(await authA.get('/api/v1/projects'))).toEqual(['A1'])
    expect(namesOf(await authB.get('/api/v1/projects'))).toEqual(['B1'])
  })

  it('isolates access across users (foreign project → 404)', async () => {
    await createUser({ username: 'a', role: 'USER' })
    await createUser({ username: 'b', role: 'USER' })
    const authA = withToken((await login('a')).body.accessToken)
    const authB = withToken((await login('b')).body.accessToken)
    const created = await authA.post('/api/v1/projects').send({ name: 'A1' })
    const id = created.body.project.id

    expect((await authB.get(`/api/v1/projects/${id}`)).status).toBe(404)
    expect((await authB.delete(`/api/v1/projects/${id}`)).status).toBe(404)
    // 确认 a 仍能访问（未被 b 误删）
    expect((await authA.get(`/api/v1/projects/${id}`)).status).toBe(200)
  })

  it('admin sees all projects', async () => {
    await createUser({ username: 'admin1', role: 'ADMIN' })
    await createUser({ username: 'a', role: 'USER' })
    await withToken((await login('a')).body.accessToken).post('/api/v1/projects').send({ name: 'A1' })

    const res = await withToken((await login('admin1')).body.accessToken).get('/api/v1/projects')
    expect(res.status).toBe(200)
    expect(res.body.projects.length).toBe(1)
    expect(res.body.projects[0].name).toBe('A1')
  })

  it('updates and duplicates', async () => {
    await createUser({ username: 'a', role: 'USER' })
    const auth = withToken((await login('a')).body.accessToken)
    const created = await auth.post('/api/v1/projects').send({ name: '原始' })
    const id = created.body.project.id

    const patched = await auth.patch(`/api/v1/projects/${id}`).send({ name: '改名', canvasWidth: 1920 })
    expect(patched.status).toBe(200)
    expect(patched.body.project.name).toBe('改名')
    expect(patched.body.project.canvasWidth).toBe(1920)

    const dup = await auth.post(`/api/v1/projects/${id}/duplicate`)
    expect(dup.status).toBe(201)
    expect(dup.body.project.name).toBe('改名 副本')

    expect((await auth.get('/api/v1/projects')).body.projects.length).toBe(2)

    const deleted = await auth.delete(`/api/v1/projects/${id}`)
    expect(deleted.status).toBe(200)
    expect((await auth.get(`/api/v1/projects/${id}`)).status).toBe(404)
  })

  it('rejects unauthenticated (401)', async () => {
    expect((await withToken().get('/api/v1/projects')).status).toBe(401)
  })
})
```

- [ ] **Step 8: 运行测试**

运行：`pnpm --filter @ppt-generator/server test projects`
预期：6 条全部通过。

- [ ] **Step 9: 提交**

```bash
git add packages/shared/src/index.ts apps/server/src/modules/projects apps/server/src/routes/index.ts apps/server/tests/projects.test.ts
git commit -m "$(cat <<'EOF'
feat(server): projects CRUD + ownership isolation + duplicate

list/create/get/patch/delete/duplicate; create seeds 3 empty pages;
getOwnedProject enforces existence+ownership as 404 (no existence leak);
ADMIN sees all, USER sees own only.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: 种子脚本（创建 admin）

**Files:**
- Create: `apps/server/prisma/seed.ts`
- Modify: `apps/server/package.json`（加 `prisma.seed` 配置）

- [ ] **Step 1: 创建 `apps/server/prisma/seed.ts`**

```ts
import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'admin123'
  const passwordHash = await bcrypt.hash(password, 10)
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', passwordHash, role: Role.ADMIN },
  })
  // eslint-disable-next-line no-console
  console.log(`seeded admin user (id=${admin.id}) — login: admin / ${password}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 2: 在 `apps/server/package.json` 加 `prisma.seed` 配置**

在顶层加一个 `prisma` 字段（与 `scripts`、`dependencies` 平级）：

```json
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  },
```

- [ ] **Step 3: 对 dev 库跑 seed**

确保 dev 库已迁移（Task 4 已建表）。运行：`pnpm --filter @ppt-generator/server seed`
预期：输出 `seeded admin user (id=...) — login: admin / admin123`。

- [ ] **Step 4: 手动冒烟：用 admin 登录 + 建项目**

dev server 起着（`pnpm dev:server`）时运行：

```bash
# 登录
curl -s -i -c /tmp/c.txt -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' | grep -E 'HTTP/|accessToken'
# 用返回的 accessToken 建项目
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).accessToken))')
curl -s -X POST http://localhost:3001/api/v1/projects -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"name":"冒烟项目"}' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s).project;console.log({name:p.name,pages:p.pages.length})})'
```
预期：登录返回含 `accessToken`；建项目返回 `{ name: '冒烟项目', pages: 3 }`。然后停掉 dev server。

- [ ] **Step 5: 提交**

```bash
git add apps/server/prisma/seed.ts apps/server/package.json
git commit -m "$(cat <<'EOF'
feat(server): seed admin user (admin/admin123)

prisma seed config wired to tsx; upserts an ADMIN user. Password
overrideable via SEED_ADMIN_PASSWORD.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: README + 全量验证 + changelog/PROJECT 收尾

**Files:**
- Create: `README.md`
- Modify: `docs/CHANGELOG.md`（新增 2026-06-26 条目）
- Modify: `docs/PROJECT.md`（更新「当前状态」「后续计划」）

> 本 Task 同时履行 `CLAUDE.md` 的硬规则：代码变更触发 changelog；P0 里程碑达成触发 PROJECT.md 更新。

- [ ] **Step 1: 创建根 `README.md`**

````markdown
# MediaKit PPTGenerator

广告投放报告编辑器。本仓库当前为 **P0：后端骨架（API + 集成测试）**。

## 结构

```
apps/server        Express + TS + Prisma（后端）
packages/shared    前后端共享的纯类型（type-only）
docker-compose.yml 本地 mysql:8 + redis:7
```

## 本地开发

```bash
# 1. 起 mysql + redis
docker compose up -d mysql redis

# 2. 装依赖
pnpm install

# 3. 生成 client + 建表 + 种子 admin
pnpm --filter @ppt-generator/server exec prisma generate
pnpm --filter @ppt-generator/server exec prisma migrate dev
pnpm --filter @ppt-generator/server seed     # admin / admin123

# 4. 起后端（:3001）
pnpm dev:server
```

健康检查：`curl http://localhost:3001/api/v1/health` → `{"status":"ok"}`

## 测试

```bash
pnpm test           # 全量（测试库 ppt_generator_test）
pnpm typecheck      # tsc --noEmit
```
````

- [ ] **Step 2: 全量测试**

运行：`pnpm --filter @ppt-generator/server test`
预期：health(1) + db(2) + hash(2) + auth(8) + users(3) + projects(6) = **22 passed**，0 failed。

- [ ] **Step 3: 类型检查 + 构建**

运行：`pnpm typecheck`
预期：无错误输出，退出码 0。

运行：`pnpm --filter @ppt-generator/server build`
预期：生成 `apps/server/dist/`，退出码 0。

- [ ] **Step 4: 在 `docs/CHANGELOG.md` 新增 2026-06-26 条目**

在文件顶部「写入规则」段与首个 `## 2026-06-25` 之间，插入新的日期段（保持 `### 新增` 在前）：

````markdown
## 2026-06-26

### 新增

- P0 后端骨架（API + 集成测试）：pnpm monorepo + `apps/server`（Express + TS + Prisma）+ `packages/shared`（type-only）
- 认证：JWT access/refresh + refresh 轮换 + Redis 黑名单，`apps/server/src/modules/auth/auth.service.ts:38`
- 管理员用户管理 CRUD（`/api/v1/admin/users`），`apps/server/src/modules/users/users.routes.ts:7`
- 项目 CRUD + 所有权隔离 + 复制（`/api/v1/projects`），`apps/server/src/modules/projects/projects.service.ts:36`
- 本地基础设施 `docker-compose.yml`（mysql:8 + redis:7）+ 测试库 init 脚本
- 种子脚本创建默认 admin，`apps/server/prisma/seed.ts:5`

### 变更

- 实现计划：`docs/superpowers/plans/2026-06-26-p0-backend-foundation.md`
````

- [ ] **Step 5: 更新 `docs/PROJECT.md` 的「当前状态」与「后续计划」**

把「当前状态」标题下替换为：

````markdown
## 当前状态

**v0.2 — P0 后端骨架完成**（2026-06-26）

- 后端 API（Express + TS + Prisma）上线：认证、管理员用户管理、项目 CRUD
- 数据模型：`User` / `Project` / `Role`（MySQL 8）；`Dataset`/`ExportJob` 待后续阶段
- 完整集成测试（supertest + vitest，22 项）通过；类型检查通过
- 仓库改造为 pnpm monorepo（`apps/server` + `packages/shared`）
- `demo.html` 原型保留未动，作为前端重写（P1）的视觉参考
````

把「后续计划」列表前插入一条最高优先级项：

````markdown
## 后续计划

1. **P1：React 编辑器内核** — Vite + TS + Tailwind + Zustand，复刻 `demo.html` 三栏 + 7 个基础组件 + 持久化对接 P0 API
2. 导出 PPT / PDF（`demo.html:2661`）
3. 项目列表 / 多项目管理（`demo.html:2602`）— 后端已具备，待前端
4. 持久化（localStorage 或后端）— 后端已具备
5. 组件库扩展（更多业务组件变体）
6. 模板保存与复用
````

- [ ] **Step 6: 提交文档收尾**

```bash
git add README.md docs/CHANGELOG.md docs/PROJECT.md
git commit -m "$(cat <<'EOF'
docs: P0 backend foundation — README + changelog + PROJECT status

Marks P0 milestone: backend API (auth/admin/projects) + 22 integration
tests green; monorepo scaffolded; roadmap bumped to P1 (React editor).

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7: 终验 git 状态干净**

运行：`git status --short`
预期：无输出（所有变更已提交）。

运行：`git log --oneline -11`
预期：最近 10 个 commit 分别以 `chore: init pnpm`、`chore: add docker-compose`、`feat(server): express skeleton`、`feat(server): prisma schema`、`feat(server): error handling`、`feat(server): auth`、`feat(server): admin user`、`feat(server): projects`、`feat(server): seed`、`docs: P0 backend foundation` 开头（外加历史 docs commit）。

---

## Self-Review

**1. Spec 覆盖检查**（对照 `2026-06-25-ppt-generator-design.md`）：
- ✅ §2 技术栈（React/Vite/Tailwind 是前端 P1，本计划不涉及；Node/Express/TS/Prisma/MySQL/Redis/JWT/Docker 均覆盖）→ Task 1–10
- ✅ §3 monorepo 结构（`apps/server`、`packages/shared`、`docker-compose.yml`）→ Task 1/2
- ✅ §4 数据模型 User/Project/Role → Task 4（Dataset/ExportJob/DatasetSource/JobStatus/shareSlug 显式留后续，迁移增量不冲突）
- ✅ §5.1 认证 login/refresh/logout/me → Task 6
- ✅ §5.2 用户管理（仅 ADMIN）→ Task 7
- ✅ §5.3 项目 list/create/get/patch/delete/duplicate → Task 8（share 属 P4，显式留后续）
- ✅ §6 认证（access 15m / refresh 7d / jti 黑名单 / 轮换 / Cookie HttpOnly+SameSite=Lax / 权限中间件链 auth/requireAdmin/所有权）→ Task 6 + Task 8
- ✅ §6.3 所有权校验返回 404 不暴露存在性 → Task 8 `getOwnedProject`
- ✅ §11 错误处理（统一 `{ error:{code,message,details?} }`、Zod 422、Prisma P2002→409 / P2025→404、pino）→ Task 5
- ✅ §13 部署 mysql+redis 部分 → Task 2（server/web/worker 镜像属部署阶段，本计划显式排除）

**2. 占位符扫描**：无 TBD / TODO / "implement later"；每个代码步骤含完整可编译代码；每条命令含预期输出。

**3. 类型一致性**：
- `Role` 统一来自 `@ppt-generator/shared`（`'ADMIN'|'USER'` 联合）；Prisma 生成的 `Role` 同为联合类型，可互通。
- `req.user` 类型由 `src/types/express.d.ts` 增强为 `{ id, username, role }`，全 controller 用 `req.user!`。
- `signAccessToken/verifyAccessToken` 与 `signRefreshToken/verifyRefreshToken` 签名在 token.ts 内自洽，service/controller 引用一致。
- `getOwnedProject` / `RequestUser` 在 service 内定义，controller 透传 `req.user!`（结构一致）。
- DTO（`LoginResponse`/`CreateProjectRequest` 等）在 shared 定义，作为前后端契约；后端当前按 spec §5 返回（login 仅 `{accessToken}`，用户信息走 `/auth/me`）。

**4. 已知范围裁剪（显式留后续计划，非遗漏）**：
- Dataset / 上传 / API 拉取 / 组件 binding → P3
- ExportJob / Puppeteer PDF / BullMQ worker → P4
- shareSlug 分享 / `/internal/render` → P4
- 前端（React 编辑器）→ P1
- 乐观锁（保存带 `updatedAt`）、审计日志、API 拉取鉴权头 → spec §16「待定」，后续决定

**5. 风险与对策**：
- 测试库初始化脚本仅在新卷首启执行 → Step 中给出「卷已存在时手动 `CREATE DATABASE`」兜底命令（Task 2 Step 7）。
- vitest 多 worker 竞态共享测试库 → `singleFork: true` 串行（Task 4 Step 7）。
- CommonJS + `nanoid`(ESM-only) 冲突 → P0 改用 `node:crypto.randomUUID`，`nanoid` 推迟到 P4 分享 slug（Task 8 Step 3 / Task 1 决策说明）。
- Prisma JSON 字段大文档风险 → spec §15 提到 LONGTEXT，属后续大文档压测范畴，P0 不处理。
