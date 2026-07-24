# 设计：CI/CD 部署 + Dockerfile（mediakit）

- 日期：2026-07-24
- 范围：为 mediakit（pnpm monorepo）产出生产 Dockerfile + GitLab CI，实现对 web 与 server 两个镜像的构建、推送与编排部署。**不**改动应用代码。
- 非目标（YAGNI）：Kubernetes manifests、Server 编译为 JS（保持 tsx 运行）、把 MySQL/Redis 纳入生产编排（外部托管）。

## 1. 背景与已确认事实

仓库为 pnpm monorepo（`packageManager: pnpm@9.12.0`，`engines.node >=20`，本地 `node v20.20.2`）：

- `apps/web`（`@mediakit/web`）：Vite + React SPA，构建产物默认 `dist/`。
- `apps/server`（`@mediakit/server`）：Express，启动 `tsx src/index.ts`（`build` 仅 `tsc --noEmit`，无 JS 产物）。
- `packages/shared`（`@mediakit/shared`）：以**原始 TS 源码**被消费（`package.json` 的 `main: ./src/index.ts`）。
- 数据库：MySQL 8（Prisma，`apps/server/prisma/schema.prisma`，`url = env("DATABASE_URL")`），已有 7 个迁移（`apps/server/prisma/migrations/*` + `migration_lock.toml`）。
- 缓存：Redis 7（ioredis，refresh token 黑白名单）。
- **puppeteer ^25** 用于 PDF/PNG 导出：server 内 `puppeteer.launch()` 访问 `WEB_URL`（默认 `http://localhost:5173`）渲染 `/share/:token?print=1` 页面。
- server 仅静态托管 `/uploads`（`app.use('/uploads', express.static(config.storage.uploadDir))`），**不**托管 web SPA。
- 仓库托管于自建 GitLab：`git@gitlab.duomai.cn:affliate-product/campaignreport.git`，当前无任何 CI 配置与 Dockerfile。

### 已决策（与用户确认）

1. **镜像拓扑**：两个镜像 —— nginx 静态（web）+ api（server，含 Chromium）。
2. **api 运行时**：保持 `tsx src/index.ts`，零代码改动。
3. **MySQL/Redis**：生产用外部托管（RDS/Tair），编排只起 web+server。
4. **CI**：GitLab CI（`.gitlab-ci.yml`），推送到 GitLab Container Registry（默认；未启用时降级阿里云 ACR）。

## 2. 架构

```
                    ┌──────────────────────────────────┐
   公网/网关  ──────►│  web 镜像 (nginx:alpine)          │  托管 dist + SPA fallback
                    │  /api/* /uploads/*  ──反代──► server:4000 │
                    └───────────────────┬──────────────┘
                                        │ compose 内网
                    ┌───────────────────▼──────────────┐
                    │  api 镜像 (node20-slim + Chromium) │  tsx src/index.ts
                    │  ENTRYPOINT: migrate deploy → tsx │  puppeteer → WEB_URL
                    └─────────┬──────────────────┬──────┘
                              │ DATABASE_URL     │ REDIS_URL
                    外部 MySQL8(RDS)     外部 Redis(Tair)
```

- web 镜像对外提供静态资源与入口；`/api`、`/uploads` 反代到 api 容器，其余路径 SPA fallback 到 `index.html`。
- puppeteer 跑在 **server** 容器内，通过 compose 内网访问 web：`WEB_URL=http://web:80`。
- `PUBLIC_BASE` 必须设为公网域名（否则 `<img>` 直连容器内地址导致回显失败，见 `config.ts` 注释）。

## 3. 产出文件清单

| 文件 | 作用 |
|---|---|
| `apps/server/Dockerfile` | api 镜像，多阶段 |
| `apps/web/Dockerfile` | web 镜像，多阶段（node build → nginx） |
| `apps/web/nginx.conf` | SPA fallback + 反代 `/api`、`/uploads` |
| `apps/server/docker-entrypoint.sh` | `prisma migrate deploy` → `tsx src/index.ts` |
| `.dockerignore`（根） | 排除 `node_modules`、`.git`、`.claude/worktrees`、`uploads`、`*.env`（保留 `*.env.example`） |
| `docker-compose.prod.yml`（根） | 只起 `web`+`server`；DB/Redis 走 env |
| `.gitlab-ci.yml`（根） | 构建并推送两镜像到 GitLab Container Registry |
| `.env.prod.example`（根） | 生产 env 契约 |

对仓库代码**零侵入**：不改 `apps/server/src/app.ts`，不改任何 `package.json`。

## 4. api 镜像构建策略（`apps/server/Dockerfile`）

多阶段，基础镜像 `node:20-bookworm-slim`（bookworm 而非 alpine：puppeteer 依赖 glibc + 一组共享库）。

1. **deps 阶段**：先 `COPY` 锁文件与所有 `package.json`/`pnpm-workspace.yaml` → `corepack enable && pnpm install --frozen-lockfile`。
   - **关键**：puppeteer postinstall 下载自带 Chromium。其默认落点 `$HOME/.cache/puppeteer` **不在** `node_modules` 内，`pnpm deploy` 不会带走 → 运行期镜像缺 Chromium。因此在 install 前 **`ENV PUPPETEER_CACHE_DIR=/app/node_modules/.puppeteer-cache`**，把浏览器落进会被 deploy 带走的目录树。
2. **build 阶段**：`COPY` 源码 → `pnpm --filter @mediakit/server exec prisma generate` → `pnpm deploy --filter @mediakit/server /deploy`。
   - `pnpm deploy` 产出自包含目录，自动把 `@mediakit/shared` 解析为真实文件（消除 workspace 软链），适合复制进运行期镜像。
   - deploy 后立即 `cp -r apps/server/prisma/migrations /deploy/prisma/migrations`（`pnpm deploy` 不保证带迁移目录），保证运行期能 `migrate deploy`。
3. **runtime 阶段**：`node:20-bookworm-slim` + `apt-get install` puppeteer 官方共享库清单（`ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils`）。
   - `COPY --from=build /deploy /app`（含 `/app/node_modules/.puppeteer-cache` 浏览器与生成的 Prisma client）。
   - 非 root 用户运行（puppeteer 需 `--no-sandbox`，见下）。
   - 环境变量：`NODE_ENV=production`、`PUPPETEER_CACHE_DIR=/app/node_modules/.puppeteer-cache`（与 build 阶段同路径，puppeteer 才能定位浏览器）、`PUPPETEER_SKIP_DOWNLOAD=false`。
   - `ENTRYPOINT ["docker-entrypoint.sh"]`，`EXPOSE 4000`。

### 关键约束 / 已知坑

- **tsx 是 devDependency**：故 `pnpm deploy` **不加** `--prod`，保留 devDeps（零改动）。后续优化可把 `tsx` 挪进 `dependencies` 再 `--prod`，运行期更小——本次不做。
- **Chromium**：用 puppeteer 自带（postinstall 下载），不装系统 chromium；需确保 runtime 阶段能命中同一缓存路径。
- **沙箱**：容器内非 root 运行 puppeteer 须 `args: ['--no-sandbox', '--disable-setuid-sandbox']`（`export.service.ts` 当前 launch 参数需确认；若未带，部署期通过 env 或代码补齐——实现阶段核对 `launchBrowser()`）。
- **迁移**：`docker-entrypoint.sh` 先 `prisma migrate deploy`（幂等，仅应用未执行迁移），成功后才 `exec tsx src/index.ts`；多副本时仅靠 DB 锁串行化（Prisma `migrate deploy` 不并发安全，多副本部署需外部门控或仅首副本执行——实现阶段在文档注明）。

## 5. web 镜像构建策略（`apps/web/Dockerfile` + `nginx.conf`）

- build 阶段：`node:20-alpine`，`pnpm --filter @mediakit/web build` → 产出 `apps/web/dist`。
- runtime 阶段：`nginx:stable-alpine`，`COPY dist/ /usr/share/nginx/html/`，`COPY nginx.conf /etc/nginx/conf.d/default.conf`。
- `nginx.conf`：
  - `location /api/ { proxy_pass http://server:4000; }`（带 websocket/header 透传）
  - `location /uploads/ { proxy_pass http://server:4000; }`
  - `location / { try_files $uri /index.html; }`（SPA fallback）
  - `EXPOSE 80`。

## 6. CI 流水线（`.gitlab-ci.yml`）

- 触发：`main` 分支 或 `v*` tag。
- 阶段 `build`：用含 docker 的 runner，`docker login -u gitlab-ci-token -p $CI_JOB_TOKEN $CI_REGISTRY`，分别 `docker build -t $CI_REGISTRY_IMAGE/web:$CI_COMMIT_SHORT_SHA -t $CI_REGISTRY_IMAGE/web:latest -f apps/web/Dockerfile .` 与 server 同理，`docker push` 全部 tag。
- 利用 GitLab 内置 `$CI_REGISTRY` / `$CI_REGISTRY_IMAGE` / `$CI_JOB_TOKEN`，无需额外凭据。
- 失败模式：若 `gitlab.duomai.cn` 未启用 Container Registry，将 `IMAGE` 改指阿里云 ACR 仓库并新增 ACR 凭据变量（降级路径，本期默认走 GitLab registry）。

## 7. 生产 compose + env 契约

`docker-compose.prod.yml`：

```yaml
services:
  web:
    image: ${REGISTRY}/web:${TAG:-latest}
    restart: unless-stopped
    ports: ["80:80"]
    depends_on: [server]
  server:
    image: ${REGISTRY}/server:${TAG:-latest}
    restart: unless-stopped
    env_file: [.env.prod]
    volumes: ["./uploads:/app/uploads"]   # STORAGE_DRIVER=local 时；oss 驱动则去掉
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:4000/healthz"]
      interval: 15s
      timeout: 5s
      retries: 5
```

`.env.prod.example` 契约（server 容器读取，见 `apps/server/src/config.ts`）：

- `NODE_ENV=production`、`PORT=4000`
- `DATABASE_URL=mysql://...@<RDS>/mediakit`、`REDIS_URL=redis://...@<Tair>`
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`（强随机）、`JWT_ACCESS_TTL=900`、`JWT_REFRESH_TTL=604800`
- `COOKIE_SECURE=true`、`COOKIE_DOMAIN=<公网根域>`
- `CORS_ORIGIN=https://<公网域名>`
- `WEB_URL=http://web:80`（puppeteer 跨容器取 share 页）
- `PUBLIC_BASE=https://<公网域名>`（`<img>` 回显基址，留空会回显失败）
- `STORAGE_DRIVER=local` + `UPLOAD_DIR=/app/uploads`（或 `oss` + `OSS_REGION/BUCKET/ACCESS_KEY_ID/ACCESS_KEY_SECRET/ENDPOINT`）
- `LOG_LEVEL=info`

## 8. 验证方式（实现完成后）

- `docker build` 两个 Dockerfile 本地成功。
- `docker compose -f docker-compose.prod.yml up`（指向本地 mysql/redis 或临时外部实例）后：`curl /healthz` 返回 `{"status":"ok"}`；web 首页 200；`/api/v1/...` 经 nginx 反代可达；puppeteer 导出 PDF 不报 Chromium 启动错误。
- `.gitlab-ci.yml` 在 GitLab dry-run（或推送后查看 pipeline）两镜像成功 push。

## 9. 风险与未决

- 多副本部署时 `prisma migrate deploy` 并发安全 → 文档注明，默认单副本或外部一次性迁移步骤。
- `export.service.ts` 的 `launchBrowser()` 是否已带 `--no-sandbox` → 实现阶段核对。
- GitLab Container Registry 是否在 `gitlab.duomai.cn` 启用 → 默认假设启用，未启用时按 §6 降级 ACR。
