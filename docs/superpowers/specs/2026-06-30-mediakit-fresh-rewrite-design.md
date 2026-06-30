# MediaKit — demo.html 全新重写（全栈）设计文档

**日期**：2026-06-30
**作者**：ap + Claude（结对设计）
**状态**：设计已确认；M0 待编写实现计划
**目标参考**：`demo.html`（MediaKit 广告投放报告编辑器原型，3551 行单文件）
**范围**：完整对等 `demo.html` 的编辑器功能 + 全栈工程化（含认证 / 项目 CRUD / 持久化）

---

## 1. 背景与目标

把 `demo.html` 这个手写原型**全新重写**为干净的工程代码：React + Tailwind 的前端编辑器（行为/观感对等 demo），加 Express + Prisma 全栈（认证、项目列表、持久化）。**不**复用 git HEAD 里已有的旧工程代码——从头重建，全部业务组件拆成原生 React 组件。

**成功标准**：用户能在浏览器里登录 → 进入项目 → 用画布编辑器搭出与 demo 等价的复盘报告（7 类基础组件 + 20 类业务组件 + 全部交互 + 页面管理 + 数据源 + 预览 + 导出），数据持久化到 MySQL。

---

## 2. 已确认决策（brainstorm 结论）

| 维度 | 决策 |
|---|---|
| 工程代码来源 | **全新重写**，不 restore git 旧代码 |
| 范围 | **完整对等 demo.html**（编辑器全部功能） |
| 后端 | **全栈（含认证）**：JWT + 项目 CRUD + 持久化 |
| 前端栈 | **React + Vite + TS + Tailwind**（样式重写为 utility class，非沿用 demo 原生 CSS） |
| 业务组件渲染 | **拆成原生 React 组件**（每种 kind/变体用 JSX 重写，**非** HTML-port / `dangerouslySetInnerHTML`） |
| 推进方式 | **A — 分阶段里程碑**（M0→M6，每期 design→plan→implement→verify） |

---

## 3. 架构

### 3.1 技术栈

| 层 | 选型 |
|---|---|
| Monorepo | pnpm workspaces（`apps/web` · `apps/server` · `packages/shared` type-only） |
| 前端 | React 18 · Vite · TypeScript · **Tailwind** · **Zustand** · React Router · axios · recharts |
| 后端 | Express · TypeScript · Prisma · MySQL 8 · Redis（ioredis） · JWT（`jose`，access/refresh + 轮换 + 黑名单）· zod · helmet · pino |
| 测试 | vitest + @testing-library（web）· vitest + supertest（server） |
| 基础设施 | docker-compose（mysql:8 + redis:7）+ 种子脚本（admin/admin123） |

### 3.2 仓库结构

```
apps/server        Express + Prisma：auth / admin users / projects CRUD（所有权隔离）/ health
apps/web           Vite + React 编辑器：login · /projects 列表 · /projects/:id 编辑器
packages/shared    纯类型（type-only）：User / Project / Page / EditorComponent / 各组件 Data / BusinessBlockData
docker-compose.yml mysql:8 + redis:7
docs/              PROJECT.md / CHANGELOG.md / superpowers/{specs,plans}
```

### 3.3 数据模型

**Prisma（MySQL 8）**

```prisma
enum Role { ADMIN USER }
model User { id String @id @default(cuid()); email String @unique; passwordHash String; name String?; role Role @default(USER); projects Project[]; createdAt DateTime @default(now()); updatedAt DateTime @updatedAt }
model Project { id String @id @default(cuid()); ownerId String; name String; pages Json; width Int @default(1280); height Int @default(720); owner User @relation(fields:[ownerId], references:[id]); createdAt DateTime @default(now()); updatedAt DateTime @updatedAt }
```

- `pages` 为不透明 JSON（`Prisma.InputJsonValue`）——组件类型扩展不触发后端迁移。
- 所有权隔离：非 owner 访问返回 404（不泄露存在性）。

**共享类型（`packages/shared`）**

```ts
export type ComponentType =
  | 'text' | 'image'
  | 'indicator-card' | 'bar-chart' | 'line-chart' | 'pie-chart' | 'table'
  | 'business-block'

export interface EditorComponent {
  id: string; type: ComponentType;
  x: number; y: number; w: number; h: number;
  data: TextData | ImageData | IndicatorCardData | BarChartData | LineChartData | PieChartData | TableData | BusinessBlockData;
  locked?: boolean; z?: number;
}
export interface Page { id: string; name: string; components: EditorComponent[] }
export interface ProjectDetail { id: string; name: string; pages: Page[]; width: number; height: number; createdAt: string; updatedAt: string }
```

各 `Data` 接口直接对齐 demo（取自 G2/G4 spec 与 `demo.html`）：

- `TextData { content; fontSize; fontWeight?; fontFamily?; color; bgColor?; padding? }`
- `ImageData { src; fit }`
- `IndicatorCardData { title; value; trend?; trendUp?; colorTheme }`
- `BarChartData { title?; bars: {label; value; color}[] }` · `LineChartData { title?; series }` · `PieChartData { title?; slices }`
- `TableData { headers: string[]; rows: string[][] }`
- `BusinessBlockData { businessKind: string; title; meta; details: string[]; variant: BusinessVariant; layoutForm? }`
- `BusinessVariant = 'standard'|'cards'|'accent'|'stats'|'light'|'table'|'results'`

### 3.4 认证

- **Access token**（`jose`，~15min）放响应体，前端存内存/localStorage，axios 请求头携带。
- **Refresh token**（~7d，**轮换**：每次 refresh 签发新 token 并作废旧 token；旧 token jti 写 Redis 黑名单）。Logout 把当前 refresh 拉黑。
- 刷新页 session 恢复：登录后调 `/auth/me` 重建会话。
- axios 拦截器：401 → 用 refresh 换新 access → 重试原请求（去重并发刷新）。

### 3.5 组件架构（REGISTRY）

注册表驱动，`type` 联合保持精简；业务组件用**单 type + businessKind 二级分发**。

```ts
interface PropertyField { key: string; label: string; kind: 'text'|'textarea'|'number'|'color'|'select'|'list'|'table'; options?: ... }
interface BlockDef {
  Component: React.FC<{ data: unknown }>;
  defaultSize: { w: number; h: number };
  defaultData: () => unknown;
  propertySchema: PropertyField[];
}
const REGISTRY: Record<ComponentType, BlockDef>
```

- 7 基础类型各 1 条；`REGISTRY['business-block'].Component` 内部按 `data.businessKind` 分发到对应原生 React 业务组件（按 `data.variant` 选变体）。
- 属性面板 schema 驱动（七种 kind 编辑器）；business-block 的 `variant` 选项按 `businessKind` 动态取自 catalog。

### 3.6 编辑器状态（Zustand 单 store）

```ts
interface EditorStore {
  projectId; projectName;
  pages: Page[]; currentPageId: string;
  selectedIds: string[];
  history: Snapshot[]; historyIndex: number;   // undo/redo
  clipboard: EditorComponent[] | null;
  zoom: number; panX: number; panY: number;
  // actions: load / addComponent / addBusinessBlock / updateComponent / deleteComponent / duplicate /
  //          select / clearSelection / move / resize / undo / redo / copy / cut / paste /
  //          bringForward / sendBackward / bringToFront / sendToBack / toggleLock /
  //          addPage / deletePage / renamePage / reorderPage / setZoom / setPan …
}
```

自动保存：`pages` 变更后 debounce(1.5s) → `PATCH /projects/:id`。

---

## 4. 里程碑路线图（M0 → M6）

> 每期独立 design → plan → implement → verify。依赖/价值序如下。

| M# | 里程碑 | 关键交付 | 对应 demo |
|---|---|---|---|
| **M0** | 地基 & 应用外壳 | pnpm monorepo；后端（auth+轮换+黑名单、admin 用户、项目 CRUD+所有权、health、seed）；前端外壳（login、项目列表 CRUD、受保护路由、session 恢复、401→refresh）；shared 类型；docker-compose | 工程脚手架（demo 无） |
| **M1** | 编辑器内核 + 基础组件 | 1280×720 画布、zoom(wheel)/pan(space-drag)/canvas-resizer；REGISTRY；**7 基础组件**（text/image/indicator-card/bar·line·pie via recharts/table）；选中+拖动+8 向缩放；schema 驱动属性面板；页面切换；自动保存；工具栏添加按钮；顶栏（项目名、撤销/重做桩、预览/导出桩） | 画布内核 + G2 |
| **M2** | 交互补全（G1） | 多选 + 框选；撤销/重做 history；复制/剪切/粘贴 + 复制；键盘快捷键（del/方向键微调/esc/全选）；图层顺序（前后上下移）；锁定；右键菜单；组件悬浮操作；对齐/分布 | demo G1 |
| **M3** | 页面管理（G3） | 增/删/改名/排序页面；缩略图（页面快照）；模板浮层（port `TEMPLATES`）；复制页面；页面计数 | demo G3 + 模板 |
| **M4** | 业务组件（G4） | **20 类 × 变体拆成原生 React+Tailwind 组件**；catalog（port `BUSINESS_COMPONENTS`/`LAYOUTS`/`STYLE_OPTIONS`）；分组库面板（port `renderBusinessMenu`）；属性面板（title/meta/details/variant/businessKind）；双击内联编辑 | demo G4 + 业务菜单 + 第 1 页内容 |
| **M5** | 数据源（G5） | 数据源下拉（port `dsDropdown`）；CSV/Excel 上传 + 解析；组件数据绑定；工具栏数据源按钮 | demo G5 UI + 真实绑定 |
| **M6** | 预览 + 导出（G6） | 全屏只读预览（上/下页、键盘、Esc）；PDF 导出（Puppeteer）；公开分享链接；接通顶栏按钮 | demo G6 |

> **M4 最重**（20 组件 × 多变体，JSX+Tailwind 像素级忠实）。计划阶段可能再拆子任务。

---

## 5. M0 详细范围（首期实现）

### 5.1 后端（`apps/server`）

- **app 骨架**：`src/app.ts`（helmet · cors · json · pino http · 路由挂载 · error 中间件）、`src/index.ts`（listen）、`src/config.ts`（env）、`src/logger.ts`（pino）、`src/prisma.ts`（singleton）、`src/redis.ts`（singleton）。
- **中间件**：`auth.ts`（JWT 校验 + 角色守卫）、`validate.ts`（zod）、`error.ts`、`utils/{ApiError,asyncHandler,hash}.ts`。
- **auth 模块**（`/api/v1/auth`）：`login` · `refresh`（轮换）· `logout`（拉黑）· `me`。`token.ts`（jose 签发/校验 + jti 黑名单）。
- **users 模块**（ADMIN，`/api/v1/admin/users`）：CRUD + 角色守卫。
- **projects 模块**（`/api/v1/projects`）：`GET` 列表 · `POST` 新建 · `GET/PATCH/DELETE /:id`（所有权隔离 404）· `POST /:id/duplicate`。
- **health**：`GET /api/v1/health` → `{status:'ok'}`。
- **Prisma**：`schema.prisma`（User/Role/Project）+ 迁移 + `seed.ts`（admin/admin123）。

### 5.2 前端外壳（`apps/web`）

- **配置**：Vite + React 18 + TS + **Tailwind**（把 demo `:root` 设计 token port 进 `tailwind.config` theme + CSS 变量；主色 `#FF5C00`）+ 路径别名。
- **入口/路由**：`main.tsx` · `router.tsx`（`/login` · `/projects` · `/projects/:id`→ProjectShell 占位，M1 升级为编辑器）· 受保护路由 + session 恢复。
- **API 层**：`api/client.ts`（axios + 401→refresh+重试去重）· `api/auth.ts` · `api/projects.ts`。
- **状态**：`stores/auth.ts`（Zustand：user、login/logout/refresh）。
- **页面/组件**：`routes/Login.tsx` · `routes/Projects.tsx`（新建/改名/删除）· `routes/ProjectShell.tsx`（占位）· `components/{Button,Input,Layout,ConfirmDialog}.tsx`。

### 5.3 共享 & 基础设施

- `packages/shared/src/index.ts`：M0 所需类型（`User`、`Role`、`ProjectSummary`、`ProjectDetail`、`Page`、`EditorComponent`、各 `Data`、`BusinessBlockData`、`BusinessVariant`、`ComponentType`）。
- 根 `package.json` + `pnpm-workspace.yaml` + 根 `tsconfig.json` + `.env.example`（双份：根 compose 变量 / `apps/server/.env` 应用变量）。
- `docker-compose.yml`（mysql:8 + redis:7，宿主端口参数化 `MYSQL_PORT`/`REDIS_PORT`）。

### 5.4 测试（M0）

- **server**：vitest + supertest，`singleFork` 串行（共享测试库），`global-setup` 起测试库。覆盖 health / auth（login·refresh·logout·me·错误用例）/ users（ADMIN 守卫 + CRUD）/ projects（CRUD + 所有权 404 + duplicate）。
- **web**：vitest + @testing-library（jsdom）。覆盖 auth store、axios 401 刷新重试、Projects 页（新建/改名/删除）、受保护路由。
- **门禁**：`pnpm typecheck`（两端 tsc --noEmit）+ `pnpm test` + `vite build` 全绿。

---

## 6. 测试策略（全期）

- 组件单测：每个基础/业务组件默认数据渲染断言（recharts 用 `vi.mock` + `ResizeObserver` 桩）。
- 注册表测试：`REGISTRY` 覆盖全部 type；`addComponent`/`addBusinessBlock` 默认数据/尺寸正确。
- 交互测试：select/drag/resize/undo-redo/copy-paste/键盘 的 store 纯逻辑（不依赖 DOM 时优先测 store）。
- 集成：编辑器装配（加载项目 → 改组件 → 自动保存 PATCH 被调用）。
- 端到端门禁：typecheck + test + build。

---

## 7. demo.html 参考（行号供 plan）

- 顶栏 / 项目名 / 撤销重做 / 预览导出：`:901`-`:928`
- 侧栏页面列表 / 新建页面：`:933`-`:944`
- 组件工具栏 / 业务组件按钮 / 数据源按钮：`:949`-`:999`
- 画布 / 网格 / 缩放手柄 / 选中框：`:1013`-`:1022`
- 属性面板 / 模板浮层 / 右键菜单 / 预览模式：`:1026`-`:1066`
- 业务组件 catalog `BUSINESS_COMPONENTS`：`:1139`｜`BUSINESS_BY_ID`：`:1172`｜布局 `BUSINESS_COMPONENT_LAYOUTS`：`:1176`｜变体 `BUSINESS_STYLE_OPTIONS`：`:1210`｜`getBusinessStyleOptions`：`:1222`｜`renderBusinessMenu`：`:1226`｜`renderBusinessBlock`：`:1239`
- 内核：`init`：`:1291`｜history `pushHistory/undo/redo`：`:1312`-`:1346`｜`renderCanvas`：`:1411`｜`renderComponent`：`:1514`｜`fitCanvasToViewport`：`:1623`｜`zoomCanvas`：`:1636`
- 选中/交互：`selectComponent`：`:1647`｜`onComponentMouseDown`：`:2219`｜`onComponentDoubleClick`：`:2258`｜`onComponentContextMenu`：`:2310`｜`showContextMenu`：`:3057`｜`handleContextAction`：`:3088`
- 组件增删/对齐分布：`addComponent`：`:2037`｜`addBusinessComponent`：`:2073`｜`deleteComponent`：`:2104`｜`duplicateComponent`：`:2124`｜`alignComponents`：`:2139`｜`distributeComponents`：`:2171`｜`resizeCanvas`：`:2209`
- 键盘：`:2495`-`:2580`（undo/redo/dup/copy/paste/del/arrows/esc/space-pan）
- 预览：`previewPrevPage`：`:3522`｜`previewNextPage`：`:3529`｜`showToast`：`:3538`

---

## 8. 非目标（显式留后续）

- 多人协作 / 实时协同编辑。
- 业务组件库的搜索 / 收藏 / 自定义模板（demo 也无）。
- 性能极致优化（recharts code-split 等，留后续）。
- 不复用 git HEAD 旧工程代码（从头重写）。

---

## 9. 待 plan 阶段细化

- refresh token 存储介质（httpOnly cookie vs 响应体）与轮换落库/Redis 的具体写法。
- Tailwind 主题与 demo 设计 token 的映射粒度（CSS 变量 vs theme.extend）。
- M4 业务组件的子任务拆分（按分组 / 按变体）。
- 缩略图实现（DOM 快照 vs 离屏 canvas）。
