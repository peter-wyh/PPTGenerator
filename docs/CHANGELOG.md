# Changelog

## 2026-07-02 — M0：地基 & 应用外壳 ✅

完整对等 `demo.html` 重写的第 0 期：monorepo 地基 + 全栈应用外壳（认证 / 项目 CRUD / 持久化）。编辑器内核留待 M1。

### 新增

- **monorepo**：pnpm workspaces（`apps/web` · `apps/server` · `packages/shared` type-only），根 `tsconfig.base.json`，Node 20 `.nvmrc`，参数化 `docker-compose.yml`（mysql:8 + redis:7）。
- **apps/server**（Express + Prisma + Redis + jose）：
  - app 外壳：helmet · cors(credentials) · json · cookie-parser · pino-http · `/api/v1` 路由 · error/notFound 中间件 · `/healthz` 探活。
  - **auth**：login / refresh（**轮换**：作废旧 jti + 写黑名单）/ logout（拉黑）/ me；refresh 走 SameSite=Strict httpOnly cookie，access token 放响应体（前端内存）。
  - **admin users** CRUD + ADMIN 角色守卫（不可删最后一个 admin）。
  - **projects** CRUD + 所有权隔离（非 owner 一律 404，不泄露存在性）+ duplicate。
  - Prisma schema（User/Role/Project，`pages` 不透明 JSON）+ 迁移 + seed（admin@mediakit.local / admin123）。
- **apps/web**（Vite + React 18 + TS + Tailwind）：
  - demo `:root` 设计 token 移植为 CSS 变量 + Tailwind `theme.extend` 引用（主色 `#FF5C00`），`@` 路径别名，`/api` 开发代理。
  - 路由：`/login` · `/projects`（列表/新建/改名/删除）· `/projects/:id`（编辑器外壳占位，M1 升级）；受保护路由 + 会话恢复。
  - axios 单例：access token 内存持有，refresh 走 cookie，401 → 单飞刷新 → 重试，refresh 失败 → 登出。
  - Zustand auth store；组件 Button/Input/Layout/ConfirmDialog。
- **packages/shared**：User / Role / ProjectSummary / ProjectDetail / Page / EditorComponent / 各组件 Data / BusinessBlockData / BusinessVariant / ComponentType。

### 测试 / 门禁

- server：35 个（health / auth 全路径含轮换+黑名单 / admin users / projects 含所有权隔离 / db / hash），vitest + supertest，singleFork 串行。
- web：16 个（auth store / axios 401 刷新重试 + 去重 / Projects 页 CRUD / 受保护路由），vitest + @testing-library。
- `pnpm typecheck` + `pnpm test` + `pnpm build` 全绿；端到端冒烟（seed → login → /me → 建项目 → refresh 轮换）通过。

### 备注

- mediakit 数据库默认宿主端口 mysql:**3317** / redis:**6389**（避开本地与 ppt-generator 项目的 3316/6390 占用）。
