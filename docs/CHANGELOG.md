# Changelog

## 2026-07-02 — M1：编辑器内核 + 7 基础组件 ✅

MediaKit 编辑器落地：进入项目即用 1280×720 画布搭报告，行为忠实 `demo.html` 内核。

### 新增（apps/web）

- **画布内核**（`editor/Canvas.tsx`）：1280×720 画布、20px 网格、`Ctrl/Cmd+滚轮`缩放（钳制 0.1–2.0，步长 `deltaY*0.001`）、`空格+拖动`平移、首次挂载 fit 到视口；组件拖动移动（10px 网格吸附）、8 向缩放手柄（`w≥40 / h≥20`，西/北边固定对边）、点空白取消选中。
- **REGISTRY**（`editor/registry.tsx`）：`BlockDef { Component, defaultSize, defaultData, propertySchema }`，按 `type` 分发。
- **7 基础组件**（原生 React+Tailwind，`editor/components/`）：text / image / indicator-card / bar·line·pie via recharts / table；business-block 留 M4 占位。默认数据/尺寸忠实 demo。
- **属性面板**（`editor/PropertyPanel.tsx`）：schema 驱动，含 number/text/textarea/color/select + list（柱/饼数据）+ table 编辑器；几何 x/y/w/h。
- **editor store**（`editor/store.ts`，Zustand）：pages/选中/history（{pages,currentPageId} 快照，限 50，zoom/尺寸/选中不入 history，忠实 demo）、增删改/拖动/缩放/复制剪切粘贴/图层/锁定/页面/undo-redo。
- **页面栏 / 工具栏 / 顶栏**：页面切换+增删改名；工具栏添加 7 类组件；顶栏项目名（可编辑）+ 撤销/重做（按状态启用）+ 预览/导出桩（M6 接通）。
- **自动保存**：`pages`/尺寸/名称变更 debounce 1.5s → `PATCH /projects/:id`。
- **键盘快捷键**：`Ctrl+Z/Y` 撤销重做、`Ctrl+D` 复制、`Ctrl+C/V` 复制粘贴、`Del` 删除、方向键 1px（Shift 10px）、`Esc` 取消、`空格`平移；输入框聚焦时跳过。
- `ProjectShell` 挂载 `<Editor>`。

### 测试 / 门禁

- 新增 28 个 web 测试：store 纯逻辑 31、registry 4、组件渲染 7、autosave 1（M1 共 43；web 累计 59）。
- `pnpm typecheck` + `pnpm test`（server 35 / web 59 = 94）+ `pnpm build` 全绿。
- 备注：recharts 使 web bundle ≈660kB（gzip 195kB）；code-split 为后续非目标（见设计文档 §8）。

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
