# MediaKit PPT Generator — 设计文档

**日期**：2026-06-25
**作者**：ap + Claude（结对设计）
**状态**：设计已确认，待编写实现计划

---

## 1. 背景与目标

### 1.1 背景

仓库根目录的 `demo.html`（约 180KB / 3550 行单文件）实现了一个 MediaKit 广告投放报告编辑器原型，包含：

- 1280×720 画布的 PPT 式编辑器（拖拽、缩放、多选、撤销/重做）
- 左侧多页缩略图、顶部工具栏（预览/导出）、右侧样式与数据源面板
- 7 种基础组件（文本/图片/柱状图/折线图/饼图/指标卡/表格）
- 20+ 种营销业务组件，每个含 3 种变体（standard / cards / light / accent / stats / table 等）
- 4 种硬编码 mock 数据源（投放效果 / 达人 / 渠道触达 / Q4 活动）

**当前限制**：单文件 HTML、状态在内存、刷新即丢；无后端、无持久化、无真实导出、无数据源接入、无用户系统。

### 1.2 目标

将 `demo.html` 升级为**部署到线上、面向多人使用的内部工具**：

- 管理员发账号，用户登录后看自己的项目空间（数据隔离）
- 完整项目持久化（CRUD）
- 在保留 demo 视觉风格的前提下，用 React + TS 重写前端，提升可维护性
- 支持上传 CSV/Excel 或 API URL 拉取真实数据源
- 支持真实 PDF 导出与分享链接（仅预览）

### 1.3 非目标（YAGNI）

- **不做 PPTX 导出**：导出图片嵌入的 PPTX 无法二次编辑，对内部工具价值低
- **不做协作编辑**：内部工具，每人独立项目
- **不做真实广告平台 API 集成**：用户如有需要可走"API URL 拉取"通道
- **不做 SSR/SEO**：内部工具不需要搜索引擎收录
- **不做 Konva/Canvas 重写**：DOM 渲染已能复刻 demo 视觉，迁 Canvas 代价过高

### 1.4 用户与角色

| 角色 | 权限 |
|---|---|
| **ADMIN** | 创建/禁用/删除用户，可查看所有项目（运维需要） |
| **USER** | 仅能查看/操作自己的项目与数据源 |
| **匿名访客** | 仅能访问开启分享的预览链接 |

---

## 2. 技术栈

| 层级 | 技术 |
|---|---|
| **前端** | React 18 + Vite + TypeScript + TailwindCSS + Zustand + React Router |
| **图表** | recharts（柱状/折线/饼图） |
| **后端** | Node.js 20 + Express + TypeScript + Prisma |
| **数据库** | MySQL 8.0 |
| **缓存/队列** | Redis 7（refresh token 黑名单 + BullMQ 导出任务） |
| **导出** | Puppeteer + puppeteer-cluster + pdf-lib |
| **认证** | JWT（HS256）+ refresh token（HttpOnly Cookie） |
| **部署** | Docker Compose |

---

## 3. 仓库结构（monorepo）

```
ppt-generator/
├── apps/
│   ├── web/                      # React + Vite 前端
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── Login.tsx
│   │   │   │   ├── Projects.tsx          # 项目列表
│   │   │   │   ├── Editor.tsx            # 编辑器入口
│   │   │   │   ├── Datasets.tsx          # 数据源管理
│   │   │   │   ├── AdminUsers.tsx        # 管理员：用户管理
│   │   │   │   └── Share.tsx             # 公开分享预览
│   │   │   ├── editor/                   # 编辑器内核
│   │   │   │   ├── EditorApp.tsx
│   │   │   │   ├── store/
│   │   │   │   ├── canvas/
│   │   │   │   ├── panels/
│   │   │   │   ├── topbar/
│   │   │   │   ├── components/
│   │   │   │   │   ├── basic/            # 文本/图表/表格/指标卡/图片
│   │   │   │   │   └── business/         # 20+ 业务组件 + 注册表
│   │   │   │   └── types.ts
│   │   │   ├── api/                      # axios + 自动 refresh
│   │   │   ├── stores/auth.ts
│   │   │   ├── components/               # 通用 UI
│   │   │   └── main.tsx
│   │   └── package.json
│   └── server/                   # Node + Express 后端
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── users/               # 仅 ADMIN
│       │   │   ├── projects/
│       │   │   ├── datasets/
│       │   │   ├── exports/
│       │   │   └── share/
│       │   ├── middleware/              # auth / error / upload
│       │   ├── jobs/                    # BullMQ worker（PDF 导出）
│       │   ├── prisma/                  # schema.prisma + migrations
│       │   ├── utils/
│       │   ├── routes/index.ts
│       │   └── index.ts
│       ├── uploads/                     # 用户上传（gitignore）
│       ├── exports/                     # 生成 PDF（gitignore）
│       ├── fonts/                       # Inter / Funnel Sans / IBM Plex Mono
│       └── package.json
├── packages/
│   └── shared/                          # 前后端共享类型
│       └── src/types.ts                 # Component / Page / Project / Dataset
├── docker-compose.yml
└── README.md
```

---

## 4. 数据模型（Prisma schema）

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(cuid())
  username     String   @unique
  passwordHash String
  role         Role     @default(USER)
  projects     Project[]
  datasets     Dataset[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Project {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name         String
  canvasWidth  Int      @default(1280)
  canvasHeight Int      @default(720)
  pages        Json     @default("[]")
  shareSlug    String?  @unique
  shareEnabled Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([userId])
}

model Dataset {
  id          String        @id @default(cuid())
  userId      String
  user        User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String
  source      DatasetSource
  kind        String        // "performance" | "creator" | "channel" | "campaign"
  schema      Json          // [{ name: string, type: 'string'|'number'|'date' }]
  rows        Json          @default("[]")
  sourceUrl   String?
  refreshCron String?
  fileKey     String?       // uploads 下的相对路径
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@index([userId])
}

model ExportJob {
  id        String    @id @default(cuid())
  projectId String
  userId    String
  format    String                          // "pdf"
  status    JobStatus @default(PENDING)
  fileKey   String?
  error     String?    @db.Text
  createdAt DateTime   @default(now())
  doneAt    DateTime?

  @@index([projectId])
  @@index([userId])
}

enum Role { ADMIN USER }
enum DatasetSource { MOCK UPLOAD API }
enum JobStatus { PENDING RUNNING DONE FAILED }
```

### 4.1 关键设计决策

- **`Project.pages` 用 JSON 字段**：编辑器每次保存是把整个文档（页面+组件+数据）序列化为 JSON；画布 schema 不需要为每种组件类型建表，迭代成本低。MySQL 8 的 JSON 字段支持索引与部分更新
- **`Dataset` 单独建表**：数据源可被多个项目引用；上传一次到处可用
- **`ShareSlug` 用 nanoid(12)**：分享链接不暴露项目 ID，且不可枚举
- **`ExportJob` 独立表**：导出是异步任务，需要状态机
- **`onDelete: Cascade`**：删除用户时项目与数据源一起清掉，避免脏数据

---

## 5. API 设计（REST，全部 `/api/v1` 前缀）

### 5.1 认证

| 方法 | 路径 | Body / 说明 |
|---|---|---|
| `POST` | `/auth/login` | `{ username, password }` → `{ accessToken }` + Set-Cookie refreshToken |
| `POST` | `/auth/refresh` | 用 Cookie 中的 refresh 换新 access |
| `POST` | `/auth/logout` | 拉黑当前 refresh 的 jti |
| `GET` | `/auth/me` | 返回 `{ id, username, role }` |

### 5.2 用户管理（仅 ADMIN）

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/admin/users` | 用户列表（不含 passwordHash） |
| `POST` | `/admin/users` | `{ username, password, role }` |
| `PATCH` | `/admin/users/:id` | 改密码 / 角色 / 禁用 |
| `DELETE` | `/admin/users/:id` | 删除（级联清项目与数据源） |

### 5.3 项目

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/projects` | 当前用户项目列表（不带 pages JSON，节省流量） |
| `POST` | `/projects` | `{ name }`，默认 3 空页 |
| `GET` | `/projects/:id` | 完整项目（含 pages） |
| `PATCH` | `/projects/:id` | `{ name?, pages?, canvasWidth?, canvasHeight? }` |
| `DELETE` | `/projects/:id` | 删除 |
| `POST` | `/projects/:id/duplicate` | 复制为新项目 |
| `PATCH` | `/projects/:id/share` | `{ enabled: boolean }` → 返回 `shareSlug` |

### 5.4 数据源

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/datasets` | 当前用户数据源列表 |
| `POST` | `/datasets/upload` | multipart：file + name + kind → 自动解析 |
| `POST` | `/datasets/api` | `{ name, kind, url, refreshCron? }` → 后端拉一次 |
| `POST` | `/datasets/:id/refresh` | 重新拉取（仅 API 类型） |
| `GET` | `/datasets/:id` | 返回 `{ schema, rows }` |
| `DELETE` | `/datasets/:id` | 删除（不影响已绑定的项目，因为项目存的是当时取数快照） |

### 5.5 导出

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/exports` | `{ projectId, format: 'pdf' }` → `{ jobId }` |
| `GET` | `/exports/:jobId` | `{ status, doneAt?, error? }` |
| `GET` | `/exports/:jobId/download` | 完成后下载 PDF（流式） |

### 5.6 分享（公开）

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/share/:slug` | 公开访问，返回项目 pages（脱敏） |
| （前端）| `/s/:slug` | 路由渲染只读预览页 |

### 5.7 文件上传

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/upload/image` | multipart：file → `{ url: '/uploads/...' }` |

### 5.8 内部渲染（Puppeteer 用）

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/internal/render/:projectId` | Header `X-Internal-Token` 校验，返回 SSR HTML |

---

## 6. 认证设计

### 6.1 Token 策略

- **access token**：JWT、HS256、15 分钟过期、payload `{ userId, role, jti }`、放 `Authorization: Bearer`
- **refresh token**：JWT、HS256、7 天过期、payload `{ userId, jti }`、存 HttpOnly + Secure + SameSite=Lax Cookie
- **登出**：refresh token 的 jti 加入 Redis 黑名单直到原过期时间
- **rotate**：refresh 时生成新 jti 并作废旧的（防重放）

### 6.2 权限校验中间件链

```
auth()          → 校验 access token，挂 req.user
requireAdmin()  → 校验 req.user.role === 'ADMIN'
requireOwner()  → 在 /projects/:id 等路由校验资源属于当前用户
```

### 6.3 项目所有权校验

所有 `/projects/:id`、`/datasets/:id` 路由先查 `userId === req.user.id`（ADMIN 豁免），不匹配返回 404（不暴露存在性）。

---

## 7. 前端架构

### 7.1 路由

```
/login                  公开
/                       → /projects
/projects               项目列表
/projects/:id           编辑器
/datasets               数据源管理
/admin/users            管理员：用户管理
/s/:slug                公开分享预览
```

### 7.2 编辑器状态（Zustand）

```ts
interface EditorState {
  projectId: string
  canvasWidth: number         // 1280
  canvasHeight: number        // 720
  zoom: number                // 0.25 - 2
  pages: Page[]
  currentPageId: string
  selectedIds: string[]
  clipboard: Component[] | null
  history: HistorySnapshot[]
  historyIndex: number
  // 交互态
  dragType: 'move' | 'resize' | 'marquee' | 'pan' | null
  // 持久化
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
}

interface Page {
  id: string
  name: string
  components: Component[]
}

interface Component {
  id: string
  type: ComponentType
  x: number; y: number; w: number; h: number
  data: ComponentData          // 联合类型，按 type 区分
}
```

### 7.3 业务组件注册表

```ts
// business/index.ts
export const BUSINESS_REGISTRY: Record<string, React.FC<BusinessBlockProps>> = {
  cover: CoverBlock,
  agenda: AgendaBlock,
  milestone: MilestoneBlock,
  // ... 共 20 项
}
```

渲染时：`<BUSINESS_REGISTRY[comp.data.businessKind] {...props} />`。

新增组件：写一个文件 + 注册一行。

### 7.4 交互（从 demo.html 迁移）

| 交互 | 实现 |
|---|---|
| 拖动组件 | mousedown 标记 dragType='move' → mousemove 更新 x/y → mouseup push history |
| 8 向 resize | 每个 handle 一个方向，Shift 等比 |
| 多选 + 框选 | 空白拖出 marquee，相交即选中 |
| 双击业务组件 | contenteditable 直接编辑文本 |
| 复制粘贴 | Ctrl+C 存 clipboard，Ctrl+V 偏移 20px 创建 |
| 撤销重做 | 结构性变更 push pages 快照，限 50 步 |
| 自动保存 | debounce 1.5s 调 PATCH /projects/:id，右上角显示状态 |
| 快捷键 | Ctrl+Z / Ctrl+Shift+Z / Delete / 方向键 |

### 7.5 axios 拦截器

- 请求拦截：注入 `Authorization: Bearer <accessToken>`
- 响应拦截：401 → 自动调 `/auth/refresh` → 重试原请求 → 仍失败则跳 `/login`

---

## 8. 数据源系统

### 8.1 三种数据源类型

| 类型 | 创建方式 | 数据更新 |
|---|---|---|
| **MOCK** | 系统初始化时种入 demo 里的 4 种 mock | 不更新 |
| **UPLOAD** | 上传 CSV/Excel | 重新上传覆盖 |
| **API** | 填 URL（GET 返回 JSON） | 手动 refresh；可选 cron |

### 8.2 文件解析（后端）

```
POST /datasets/upload  (multipart: file + name + kind)
  → 保存到 uploads/{userId}/{cuid}.{ext}
  → papaparse (CSV) 或 xlsx (Excel) 解析
  → 推断 schema：第一行表头 → 字段名；前 20 行采样 → 类型
  → 写入 Dataset 表
```

### 8.3 组件数据绑定

各组件 `data` 字段新增可选 `binding`：

```ts
interface BarChartData {
  title: string
  bars: Bar[]
  binding?: {                  // 可选
    datasetId: string
    labelField: string         // "platform"
    valueField: string         // "gmv"
    colorMap?: Record<string, string>
  }
}
```

渲染时：若有 `binding`，向 store 取 dataset 行 → 转 bars；否则用静态 `bars`。

数据源刷新：所有引用该 dataset 的组件自动更新。

### 8.4 数据快照

项目保存时存的是**当前解析后的值**（不是 binding 引用），确保分享链接和导出 PDF 的内容稳定。

---

## 9. 导出系统（PDF）

### 9.1 流程

```
POST /exports { projectId, format: 'pdf' }
  → 创建 ExportJob(status: PENDING)
  → 入 BullMQ 队列（Redis）
  → worker 进程消费：
      1. status: RUNNING
      2. puppeteer-cluster 复用 browser
      3. page.goto('https://server/internal/render/:projectId')
         Header X-Internal-Token 校验
      4. 等待 .render-ready 挂上（前端每页渲染完毕后挂）
      5. await page.pdf({ printBackground: true })
      6. 写入 exports/{jobId}.pdf
      7. status: DONE + doneAt
  → 失败：status: FAILED + error
```

### 9.2 字体

后端服务器需安装：Inter、Funnel Sans、IBM Plex Mono。
Docker 镜像里 `apt install` 或把字体文件放到 `apps/server/fonts/` + CSS `@font-face` 加载。

### 9.3 性能与限制

- puppeteer-cluster：复用 browser 实例，最大并发 2（避免内存爆炸）
- 单页超时 60s，整任务 10 分钟
- 文件命名：`{projectName}_{YYYYMMDD}.pdf`

---

## 10. 分享链接

- `PATCH /projects/:id/share { enabled: true }` → 生成 12 位 nanoid
- 公开访问 `GET /share/:slug` 返回项目 pages JSON（脱敏，去掉所有 binding 字段只留值）
- 前端 `/s/:slug` 渲染只读预览：无工具栏、可翻页、可全屏
- 关闭分享：`shareEnabled=false`，原 slug 立即失效

---

## 11. 错误处理

### 11.1 后端

- **全局错误中间件**：捕获 controller 抛错 → 统一 JSON `{ error: { code, message, details? } }`
- **Zod 校验**：所有 body / query / params，失败返回 422
- **Prisma 错误码翻译**：P2002（unique）→ 409；P2025（not found）→ 404
- **上传限制**：单文件 10MB；类型白名单 csv / xlsx / png / jpg / webp
- **Puppeteer 超时**：单页 60s、整任务 10 分钟
- **日志**：pino + 请求 ID（uuid），错误级别 stack trace

### 11.2 前端

- **axios 拦截器**：401 → 自动 refresh → 跳登录
- **React Query**：服务端数据缓存 + 自动重试（限 3 次）
- **编辑器错误边界**：捕获组件渲染异常 → 回退到上一历史快照 + toast
- **自动保存失败**：toast 提示 + localStorage 兜底（下次进入恢复）

---

## 12. 测试策略

| 层级 | 范围 | 工具 |
|---|---|---|
| **单元** | 业务组件渲染、CSV 解析、JWT、Zod schema | vitest（前端）/ vitest（后端，单线程） |
| **集成** | API 端点 + Prisma + 测试 DB | vitest + supertest + MySQL 测试实例 |
| **E2E** | 登录 → 新建 → 拖组件 → 保存 → 导出 | Playwright |

### 12.1 MVP 必须测试

**后端**：
- 登录成功 / 失败 / refresh 流程
- 项目 CRUD
- 用户隔离（A 用户不能读 B 的项目）
- CSV/Excel 解析
- 导出任务流程（mock puppeteer）

**前端**：
- 每个业务组件 × 每个变体的渲染快照（共 60+ 项）
- Zustand store 的 undo/redo
- 编辑器自动保存触发

**E2E**：
- 完整流程：登录 → 新建 → 加组件 → 改样式 → 保存 → 导出 PDF

---

## 13. 部署

### 13.1 docker-compose.yml

```yaml
services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ppt_generator
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  server:
    build: ./apps/server
    environment:
      DATABASE_URL: mysql://root:${MYSQL_ROOT_PASSWORD}@mysql:3306/ppt_generator
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      INTERNAL_TOKEN: ${INTERNAL_TOKEN}
    depends_on:
      mysql: { condition: service_healthy }
      redis: { condition: service_started }
    volumes:
      - ./uploads:/app/uploads
      - ./exports:/app/exports
    ports:
      - "3001:3001"

  worker:
    build: ./apps/server
    command: node dist/jobs/worker.js
    environment: # 同 server
    depends_on: [redis, server]

  web:
    build: ./apps/web
    # nginx 静态托管 + 反向代理 /api → server
    ports:
      - "3000:80"
    depends_on: [server]

volumes:
  mysql_data:
  redis_data:
```

### 13.2 首次启动脚本

```bash
docker compose up -d mysql redis
docker compose run --rm server pnpm prisma migrate deploy
docker compose run --rm server pnpm seed   # 创建 admin + 4 个 mock dataset
docker compose up -d
```

### 13.3 健康检查

`GET /api/v1/health` → `{ status: 'ok', db: 'ok', redis: 'ok' }`

### 13.4 默认管理员

种子脚本创建：`admin / admin123`（首次登录强制改密）。

---

## 14. 实施分期

| 阶段 | 范围 | 产出 |
|---|---|---|
| **P0（骨架）** | monorepo + Prisma + auth + 用户管理 + 项目 CRUD | 可登录、可创建空项目 |
| **P1（编辑器）** | React 编辑器内核 + 7 个基础组件 + 持久化 | demo.html 的基础能力全复刻 |
| **P2（业务组件）** | 20+ 业务组件 + 注册表 + 业务组件库面板 | demo.html 完整复刻 |
| **P3（数据源）** | 上传 CSV/Excel + API 拉取 + 组件 binding | 真实数据接入 |
| **P4（导出 + 分享）** | Puppeteer PDF + 分享链接 | 完整可用 |

每期一个 PR，单独 code review。

---

## 15. 风险与对策

| 风险 | 对策 |
|---|---|
| Puppeteer 在 Docker 中启动失败 / 字体缺失 | Dockerfile 装 `fonts-noto-cjk` + 项目字体；CI 跑导出冒烟测试 |
| 业务组件 60+ 渲染分支迁移遗漏 | 用 vitest 快照测试覆盖每一项；与 demo.html 截图比对 |
| 大文档（30+ 页）保存 JSON 超过 MySQL 默认限制 | JSON 字段类型用 LONGTEXT（Prisma MySQL 适配） |
| 多人同时编辑同一项目（即使非协作场景也可能误操作） | 保存时带 `updatedAt` 乐观锁，冲突提示用户 |
| refresh token 被盗 | rotate + Redis 黑名单 + IP 异常告警 |

---

## 16. 待定（实现阶段决定）

- 上传组件库的 UI 风格（保持 demo 风格 vs 引入 shadcn/ui）
- 项目缩略图生成时机（保存时同步 vs 异步）
- 是否需要审计日志（admin 操作记录）
- 数据源 API 拉取的鉴权头支持（Header / API Key）
