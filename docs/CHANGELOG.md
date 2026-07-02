# Changelog

## 2026-07-02 — M5：数据源 ✅

CSV/Excel 上传 → 解析 → 组件按列绑定，真实驱动图表/表格。

### 新增（apps/web）

- **shared 类型**：`ComponentBinding`、`EditorComponent.binding?`、`Datasource`。
- **解析**（`datasource/parse.ts`）：自写 CSV 解析（支持引号/转义/CRLF）+ Excel 解析（xlsx/SheetJS，取首 sheet）；`parseFile` 按扩展名分发。
- **store 数据源**：`datasources[]` + `addDatasource`/`removeDatasource`/`bindComponent`（会话级，未持久化到后端）。
- **绑定解析**（`datasource/resolve.ts`）：bar/line/pie 按 label/value 列派生，table 整表渲染；数字列自动去千分位、非数字归 0。
- **工具栏数据源下拉**（`DatasourceMenu`）：列出数据源 + 上传入口 + 删除。
- **属性面板绑定编辑器**：bar/line/pie/table 选中时选数据源 + label/value 列，可断开。
- `ComponentRenderer` 接入 resolve（绑定后按数据源渲染）。

### 取舍

- 数据源为**会话级**（未落库）——后端 Project 模型无数据源字段；持久化留后续。

### 测试 / 门禁

- 新增 16 个 web 测试：CSV 解析 + store 6、绑定解析 6、数据源下拉/绑定 UI 4（web 累计 115）。
- `pnpm typecheck` + `pnpm test`（server 35 / web 115 = 150）+ `pnpm build` 全绿。

## 2026-07-02 — M4：业务组件 ✅

20 类业务组件 × 多变体，原生 React 像素级忠实 demo。

### 新增（apps/web）

- **catalog**（`business/catalog.ts`）：`BUSINESS_GROUPS`（5 组 20 项）/ `BUSINESS_BY_ID` / `BUSINESS_LAYOUTS`（w/h/form）/ `BUSINESS_STYLE_OPTIONS` + `getStyleOptions`，完整 port demo。
- **渲染器**（`business/render.tsx` + `shared.tsx`）：`Base`/`Label`/`Title`/`Chips` 共享件；通用 `cards`/`light`/`accent` 兜底；**20 类 standard** + **6 个专用变体**（cover/light、process·campaign-plan/cards、case-showcase/results、campaign-overview/stats、creator-profile/stats、package/table）；分发优先级忠实 demo。用 inline style 保留精确 px。
- **store `addBusinessBlock(kind)`**：按 LAYOUTS 尺寸居中，data 用 catalog 默认。
- **业务组件库**（`BusinessLibrary`）：分组浮层，点击建块；工具栏接入。
- **属性面板**：business-block 的变体选择器（按 kind 动态选项）+ details 条目编辑器。
- **registry** 接入 `BusinessBlockRenderer`。

### 取舍

- 画布上按文字节点 contentEditable 的内联编辑（demo 的 DOM 命中法）在 React 下复杂且脆弱，**延后**；属性面板已覆盖全部字段编辑（title/meta/details/variant）。

### 测试 / 门禁

- 新增 18 个 web 测试：catalog 8、渲染器 8（每类 + 每变体不抛错）、库面板 2（web 累计 99）。
- `pnpm typecheck` + `pnpm test`（server 35 / web 99 = 134）+ `pnpm build` 全绿。

## 2026-07-02 — M3：页面管理 ✅

### 新增（apps/web）

- **页面缩略图**（`PageThumbnail`）：按 `min(w/cw, h/ch)` 缩放，每个组件渲染为按类型着色的色块（indicator-card/text/bar-chart/table 各一色，忠实 demo）；空白页显示「空白页」。
- **模板浮层**（`TemplateOverlay` + `templates.ts`）：「新建页面」打开浮层，含 空白页 / 标题页 / 数据概览 / 表格页 4 个由基础组件拼成的模板；apply 时组件重新分配 id。（demo 完整业务模板依赖业务组件，留 M4。）
- **复制页面**（store `copyPage`）：克隆页面（新页面 id + 新组件 id），插入原页之后，不切换当前页。
- **store `addPageWithComponents`**：模板带入组件时重新分配 id。
- **页面栏升级**：缩略图卡片 + 📋 复制 + 拖拽排序（HTML5 DnD → `reorderPage`）+ 双击改名 + 删除。

### 测试 / 门禁

- 新增 9 个 web 测试：copyPage/addPageWithComponents 4、缩略图 + 模板浮层 5（web 累计 81）。
- `pnpm typecheck` + `pnpm test`（server 35 / web 81 = 116）+ `pnpm build` 全绿。

## 2026-07-02 — M2：交互补全 ✅

编辑器交互对齐 demo G1。

### 新增（apps/web）

- **框选**：画布空白拖拽出矩形 → mouseup 选中完全落入的组件（Shift 追加）；纯点击仍取消选中。
- **右键菜单**（`ContextMenu`）：复制/剪切/删除 · 上移/下移/置顶/置底 · 锁定/解锁；外部点击/Esc 关闭。
- **组件悬浮操作**：hover 显示 📋 复制（复制选中）/ ✕ 删除快键。
- **多选对齐面板**（>1 选中时替换单选面板）：左/中/右/顶/中/底对齐、水平/垂直分布、等宽/等高、删除选中。
- **store 对齐/分布/等宽等高**：`alignComponents`（按 bbox）、`distributeH/V`（首尾不动均分间距）、`equalWidth/Height`（取均值）。
- **键盘补全**：`Ctrl+A` 全选、`Ctrl+X` 剪切（原有 Ctrl+Z/Y/D/C/V、Del、方向键、Esc、空格 pan 不变）。

### 测试 / 门禁

- 新增 13 个 web 测试：对齐/分布/等宽等高 10、多选面板 + 右键菜单 3（web 累计 72）。
- `pnpm typecheck` + `pnpm test`（server 35 / web 72 = 107）+ `pnpm build` 全绿。

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
