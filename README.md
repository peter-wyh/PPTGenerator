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
# 1. 起 mysql + redis（默认宿主端口 3306/6379；本机冲突可在根 .env 覆盖 MYSQL_PORT/REDIS_PORT）
docker compose up -d mysql redis

# 2. 装依赖
pnpm install

# 3. 生成 client + 建表 + 种子 admin
pnpm --filter @ppt-generator/server exec prisma generate
pnpm --filter @ppt-generator/server exec prisma migrate dev
pnpm --filter @ppt-generator/server seed     # admin / admin123

# 4. 起后端
pnpm dev:server
```

健康检查：`curl http://localhost:3001/api/v1/health` → `{"status":"ok"}`

> 应用环境变量放在 `apps/server/.env`（dotenv 按 cwd 读取，Prisma CLI 默认也读这里）；`apps/server/.env.example` 是模板。根目录 `.env` 只放 docker-compose 基础设施变量（`MYSQL_*` / `REDIS_*`）。

## API（前缀 `/api/v1`）

| 模块 | 端点 |
|---|---|
| 认证 | `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me` |
| 用户管理（ADMIN） | `GET/POST /admin/users` · `PATCH/DELETE /admin/users/:id` |
| 项目 | `GET/POST /projects` · `GET/PATCH/DELETE /projects/:id` · `POST /projects/:id/duplicate` |
| 健康 | `GET /health` |

## 测试

```bash
pnpm test           # 全量（测试库 ppt_generator_test，singleFork 串行）
pnpm typecheck      # tsc --noEmit
```
