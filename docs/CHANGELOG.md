# Changelog

本项目所有显著变更会记录于此。

**格式**：日期 → 分类（新增 / 变更 / 修复 / 重构）→ 一行简述 + 关键文件路径。

**写入规则**详见根目录 `CLAUDE.md`。

---

## 2026-06-28

### 新增

- G2 · Task 6 Toolbar 注册表驱动：新增 `apps/web/tests/editor/toolbar.test.tsx`（每条 REGISTRY 一个 `+ ${label}` 按钮 + 点击 `+ 柱状图` 触发 `addComponent('bar-chart')` 断言）
- G2 · Task 7 PropertyPanel schema 驱动：新增 `apps/web/tests/editor/propertyPanel-g2.test.tsx`（编辑 indicator-card 数值 / bar-chart 追加柱 / table 追加列）

### 变更

- `Toolbar` 改为注册表驱动：删除硬编码 `+ 文本`/`+ 图片` 按钮，改为 `Object.entries(REGISTRY).map(...)` 渲染 7 个添加按钮（+ 文本/+ 图片/+ 指标卡/+ 柱状图/+ 折线图/+ 饼图/+ 表格），保留 `撤销`/`重做`（disabled）与 save-status 标签，`apps/web/src/editor/Toolbar.tsx:19`
- `PropertyPanel` 改为 schema 驱动：删除 `text`/`image` 硬编码分支，改为遍历 `REGISTRY[type].propertySchema` 通过 `FieldEditor`/`ListEditor`/`TableEditor` 通用渲染（text/textarea/number/color/select/list/table 七种 kind），select 布尔值映射 '↑'→true/'↓'→false，保留 X/Y/宽/高 网格与 `删除组件` 按钮与 `未选中组件` 占位，`apps/web/src/editor/PropertyPanel.tsx`

---

## 2026-06-27

### 新增

- 邮件编辑器（还原 `ai_studio_code-40.html`）：`/email-editor` 新路由，左侧表单分区（Header/Top Deals/Featured/Fashion/Beauty）+ 右侧 iframe `srcDoc` 实时预览 + 复制 HTML，纯前端、内存数据预填原文件，`apps/web/src/email-editor/*`
- `generateEmailHtml(data)` 纯函数（port 自原文件，table+内联样式+移动端 stack），`apps/web/src/email-editor/generateHtml.ts`
- 设计与实施计划：`docs/superpowers/specs/2026-06-27-email-editor-design.md`、`docs/superpowers/plans/2026-06-27-email-editor.md`
- G2 基础组件骨架（Task 1+2）：`BasicComponentType` 联合（text/image/indicator-card/bar-chart/line-chart/pie-chart/table）+ 各类型 `Data` 接口，`packages/shared/src/index.ts:80`
- 组件注册表 `apps/web/src/editor/blocks/`：`BlockDef`/`PropertyField` 类型 (`types.ts`)、`REGISTRY` (`index.ts`) + `getBlock()` 降级到 fallback；text/image 真实 def，其余 5 类暂用 fallback 桩（Task 3-5 替换）
- `recharts ^3.9.0` 依赖（Task 5 图表用），`apps/web/package.json:32`
- 注册表测试 `apps/web/tests/editor/registry.test.ts`（7 类完整 def + fallback + text 默认数据）
- G2 · Task 3 指标卡：`indicator-card` 由 fallback 桩替换为真实 `BlockDef`（左色条 + 标题 + 数值 + 涨跌趋势，4 色 theme），`apps/web/src/editor/blocks/indicator-card.tsx`
- 共享块测试 `apps/web/tests/editor/blocks.test.tsx`：顶部 `recharts` `vi.mock`（`ResponsiveContainer` 注入固定宽高，Task 5 图表用例复用）+ `renderBlock` 辅助；首例 indicator-card 默认数据渲染断言（Task 4/5 追加 describe）
- G2 · Task 4 表格：`table` 由 fallback 桩替换为真实 `BlockDef`（th/thead + tbody 斑马纹 + 表头右对齐/首列左对齐 + `font-mono` 数字列），`apps/web/src/editor/blocks/table.tsx`；追加 table 测试（每 header 一个 `<th>`、默认 2×3 共 6 个 `<td>`），`apps/web/tests/editor/blocks.test.tsx`
- G2 · Task 5 图表（柱状/折线/饼图）：`bar-chart`/`line-chart`/`pie-chart` 由 fallback 桩替换为真实 recharts `BlockDef`（`ResponsiveContainer` 撑满 + `Cell` 逐项配色 + 空数据「无数据」占位 + 折线单系列 + 饼图 Legend），`apps/web/src/editor/blocks/{bar-chart,line-chart,pie-chart}.tsx`；测试 setup 加 `ResizeObserver` 桩 `apps/web/tests/setup.ts`；blocks 测试追加 `.recharts-wrapper` 渲染 + bar 空数据断言 `apps/web/tests/editor/blocks.test.tsx`

### 变更

- `store.addComponent` 改为注册表驱动：删除 `defaultText()`/`defaultImage()`，按 `REGISTRY[type].defaultSize/defaultData` 构建组件（位置固定 140,140），签名放宽为 `BasicComponentType`，`apps/web/src/editor/store.ts:61`
- `ComponentView` 改为注册表驱动：`getBlock(comp.type).Block` 取代 `TextBlock`/`ImageBlock` 分支，`apps/web/src/editor/ComponentView.tsx:69`

### 重构

- 删除旧 `apps/web/src/editor/blocks/TextBlock.tsx`、`ImageBlock.tsx`，逻辑迁入 `blocks/text.tsx`、`blocks/image.tsx`（同 `FC<{data:unknown}>` 签名 + `BlockDef` 元信息）

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
