# MediaKit — 项目状态

把 `demo.html`（MediaKit 广告投放报告编辑器原型）全新重写为干净的工程代码：React + Tailwind 前端编辑器 + Express + Prisma 全栈。

设计文档：[`superpowers/specs/2026-06-30-mediakit-fresh-rewrite-design.md`](./superpowers/specs/2026-06-30-mediakit-fresh-rewrite-design.md)

## 技术栈

| 层 | 选型 |
|---|---|
| Monorepo | pnpm workspaces：`apps/web` · `apps/server` · `packages/shared`（type-only） |
| 前端 | React 18 · Vite · TypeScript · Tailwind · Zustand · React Router · axios |
| 后端 | Express · TypeScript · Prisma · MySQL 8 · Redis（ioredis） · JWT（jose，access/refresh + 轮换 + 黑名单） · zod · helmet · pino |
| 测试 | vitest + @testing-library（web） · vitest + supertest（server） |
| 基础设施 | docker-compose（mysql:8 + redis:7） + 种子脚本（admin@mediakit.local / admin123） |

## 目录

```
apps/server        Express + Prisma：auth（轮换+黑名单）/ admin users / projects CRUD（所有权隔离）/ health
apps/web           Vite + React：login · /projects 列表 · /projects/:id 编辑器外壳（M1 升级）
packages/shared    纯类型：User / Project / Page / EditorComponent / 各组件 Data / BusinessBlockData
docker-compose.yml mysql:8 + redis:7（宿主端口参数化）
```

## 起步

需要 Node 20、Docker。

```bash
# 1. 起数据库
cp .env.example .env          # 默认 mysql:3317 / redis:6389（避开常见占用）
docker compose up -d

# 2. 装依赖
pnpm install

# 3. 迁移 + 种子
pnpm --filter @mediakit/server exec prisma migrate deploy
pnpm --filter @mediakit/server db:seed    # admin@mediakit.local / admin123

# 4. 开发
pnpm dev                      # 并行起 web(:5173) + server(:4000)
```

打开 http://localhost:5173，用 `admin@mediakit.local` / `admin123` 登录。

## 端口说明

mediakit 默认用 **mysql:3317 / redis:6389**（`docker-compose.yml` 经 `${MYSQL_PORT}`/`${REDIS_PORT}` 参数化）。若与本地其他服务冲突，改根 `.env` 即可。`apps/server` 读取 `DATABASE_URL` / `REDIS_URL`（见 `apps/server/.env.example`）。

## 门禁

```bash
pnpm typecheck   # 两端 tsc --noEmit
pnpm test        # server(35) + web(16)
pnpm build       # server noEmit + web vite build
```

## 里程碑路线图

| M# | 里程碑 | 状态 |
|---|---|---|
| **M0** | 地基 & 应用外壳 | ✅ 完成 |
| **M1** | 编辑器内核 + 7 基础组件 | ✅ 完成 |
| **M2** | 交互补全（多选/框选/对齐/右键/锁定） | ✅ 完成 |
| **M3** | 页面管理（缩略图/模板/复制/排序） | ✅ 完成 |
| **M4** | 业务组件（20 类 × 变体） | ✅ 完成 |
| **M5** | 数据源（CSV/Excel 上传 + 绑定） | ✅ 完成 |
| M6 | 预览 + 导出（PDF / 分享链接） | 待启动 |

每期独立 design → plan → implement → verify。
