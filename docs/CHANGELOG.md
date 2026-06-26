# Changelog

本项目所有显著变更会记录于此。

**格式**：日期 → 分类（新增 / 变更 / 修复 / 重构）→ 一行简述 + 关键文件路径。

**写入规则**详见根目录 `CLAUDE.md`。

---

## 2026-06-26

### 新增

- P0 后端骨架（API + 集成测试）：pnpm monorepo + `apps/server`（Express + TS + Prisma）+ `packages/shared`（type-only），分支 `p0-backend`
- 认证：JWT access/refresh + refresh 轮换 + Redis 黑名单，`apps/server/src/modules/auth/auth.service.ts`
- 管理员用户管理 CRUD（`/api/v1/admin/users`），`apps/server/src/modules/users/users.routes.ts`
- 项目 CRUD + 所有权隔离（404 不泄露存在性）+ 复制（`/api/v1/projects`），`apps/server/src/modules/projects/projects.service.ts`
- 本地基础设施 `docker-compose.yml`（mysql:8 + redis:7）+ 测试库 init 脚本；宿主端口参数化 `MYSQL_PORT`/`REDIS_PORT`
- 种子脚本创建默认 admin（admin/admin123），`apps/server/prisma/seed.ts`
- 实施计划 `docs/superpowers/plans/2026-06-26-p0-backend-foundation.md`、`README.md`
- 前端薄 UI（`apps/web`）：Vite + React 18 + TS + TailwindCSS（主色 `#FF099E`，视觉取自 `ai_studio_code-40.html`）+ Zustand + React Router + axios，分支 `frontend-thin-ui`
- 登录页 `/login` + 项目列表 `/projects`（新建/重命名/删除）+ 项目外壳占位 + 受保护路由 + 刷新页 session 恢复，`apps/web/src/router.tsx`
- axios 401 自动 refresh + 重试（去重），`apps/web/src/api/client.ts`
- 前端设计 spec 与实施计划：`docs/superpowers/specs/2026-06-26-frontend-thin-ui-design.md`、`docs/superpowers/plans/2026-06-26-frontend-thin-ui.md`
- 编辑器内核 MVP：`apps/web/src/editor/*`，1280×720 画布 + zoom + 文本/图片组件 + 选中/拖动/8 向缩放 + 属性面板 + debounce(1.5s) 自动保存；`/projects/:id` 升级为真编辑器
- 编辑器 spec 与实施计划：`docs/superpowers/specs/2026-06-26-editor-mvp-design.md`、`docs/superpowers/plans/2026-06-26-editor-mvp.md`

### 变更

- 仓库改造为 pnpm monorepo（根 `package.json` + `pnpm-workspace.yaml` + 根 `tsconfig.json`）
- env 布局：应用变量入 `apps/server/.env`（dotenv 按 cwd 读、Prisma CLI 默认读），根 `.env` 仅留 compose 变量；`.env.example` 双份模板
- `packages/shared` 增 `ProjectDetail` / `ProjectPage`，校正 `ProjectSummary` 对齐后端列表响应（供前端消费）

### 修复

- express 类型增强：`@types/express` 本版需 `declare module 'express'`，`apps/server/src/types/express.d.ts`；中间件 `req` 显式标注以通过 tsc
- `projects.service.ts` pages 字段用 `Prisma.InputJsonValue` 强转通过 tsc
- vitest `singleFork` 串行避免共享测试库竞态

## 2026-06-25

### 新增

- 初始化项目文档体系：`CLAUDE.md`（工作流规则）、`docs/PROJECT.md`（立项信息）、`docs/CHANGELOG.md`（本文件）
- 设计文档与实施计划：`docs/superpowers/specs/2026-06-25-project-docs-setup-design.md`、`docs/superpowers/plans/2026-06-25-project-docs-setup.md`

### 现状（回填，非本次代码变更）

- v0.1 原型：MediaKit 广告投放报告编辑器，单 HTML 文件（`demo.html`，3550 行）
- 实现核心三栏交互、5 类业务组件库、基础图表组件（7 种）、撤销/重做、页面增删
- 未实现：导出、返回项目列表（toast 占位，`demo.html:2602`、`demo.html:2661`）
