# CI/CD + Dockerfile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add production Dockerfiles + GitLab CI + prod compose so `@mediakit/web` and `@mediakit/server` build into deployable images (external MySQL/Redis, puppeteer PDF export intact) with zero changes to application code.

**Architecture:** Two images. (1) `web` = multi-stage `node:20-alpine` build → `nginx:stable-alpine` serving `dist/`, reverse-proxying `/api` and `/uploads` to the api container. (2) `server` = `node:20-bookworm-slim` (glibc for puppeteer) running `tsx src/index.ts` via an entrypoint that first runs `prisma migrate deploy`; Chromium is puppeteer's bundled build relocated into `node_modules` so it survives into the runtime image. GitLab CI builds+pushes both to the built-in Container Registry. Prod compose runs only web+server.

**Tech Stack:** Docker (multi-stage), pnpm 9.12 workspaces, Node 20, nginx, Prisma migrate, puppeteer 25, GitLab CI (docker-in-docker).

**Spec:** `docs/superpowers/specs/2026-07-24-cicd-dockerfile-design.md`

**Verification note:** This is infrastructure (Dockerfiles/config), not application code with unit tests. The "test" for each task is `docker build` + a runtime smoke (`docker run` / `docker compose config`) — the industry-standard containerization gate. Do not fabricate unit tests for nginx config.

**Working-tree hygiene:** All changes are new files (tree starts clean on `main`). Each task commits only the files it creates via explicit `git add <files>` in one atomic command (the host IDE clears staging between CLI calls — never stage-and-commit in two steps).

---

## Task 0: Create feature branch

**Files:** none

- [ ] **Step 1: Create and switch to the branch**

Run:
```bash
cd /Users/ap/Desktop/PPTGenerator
git checkout -b feat/cicd-dockerfile
```
Expected: `Switched to a new branch 'feat/cicd-dockerfile'`

- [ ] **Step 2: Confirm clean tree on the new branch**

Run: `git status --short`
Expected: empty output (nothing to commit).

---

## Task 1: Root `.dockerignore`

**Files:**
- Create: `.dockerignore`

Excludes host `node_modules` (macOS-built Prisma engine + puppeteer Chromium must not leak into the Linux build), worktrees, env files, build artifacts, and test files so the build context stays small and correct.

- [ ] **Step 1: Create `.dockerignore`**

```
# dependencies & build artifacts (built inside the image, never copied from host)
**/node_modules
**/dist
**/.turbo
**/coverage

# vcs & tooling
.git
.gitignore
.github
.gitlab-ci.yml
.claude
.vscode
.idea
.DS_Store

# docs don't belong in images
docs
**/*.md

# logs & runtime
**/*.log
npm-debug.log*

# secrets — keep examples, drop real env
.env
.env.*
!.env.example
**/.env.example

# local dev infra & uploads
docker-compose.yml
uploads
```

- [ ] **Step 2: Verify it parses (no syntax errors) and reflects intended excludes**

Run: `docker build --no-cache --progress=plain -f- . <<'EOF' 2>&1 | grep -i 'transferring\|sending\|DONE' | head` (a trivial context check) — or simply confirm the file exists and lists the patterns above.
Expected: file exists at repo root with the 6 sections above.

- [ ] **Step 3: Commit**

```bash
git add .dockerignore && git commit -m "chore(docker): add .dockerignore for build context hygiene

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Web image (`nginx.conf` + `Dockerfile`)

**Files:**
- Create: `apps/web/nginx.conf`
- Create: `apps/web/Dockerfile`

Mirrors the Vite dev proxy (`/api`, `/uploads` → `localhost:4000`) onto `http://server:4000` and serves the SPA with an `index.html` fallback. Build uses a **filtered** pnpm install so server's puppeteer/Chromium is never downloaded for the web image.

- [ ] **Step 1: Create `apps/web/nginx.conf`**

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # client max body covers /uploads of large images (local driver)
    client_max_body_size 10m;

    # Mirror the Vite dev proxy: API + uploads to the api container.
    location /api/ {
        proxy_pass http://server:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /uploads/ {
        proxy_pass http://server:4000;
        proxy_set_header Host $host;
    }

    # SPA fallback for client-side routes
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 2: Create `apps/web/Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1

######## build ########
FROM node:20-alpine AS build
WORKDIR /repo
ENV CI=1
RUN corepack enable

# manifests first for layer caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/

# Install ONLY the web closure (+ its workspace dep @mediakit/shared).
# This avoids pulling the server's puppeteer + Chromium download.
RUN pnpm install --frozen-lockfile --filter "@mediakit/web..."

# sources needed to build the web app
COPY apps/web apps/web
COPY packages/shared packages/shared
RUN pnpm --filter @mediakit/web build

######## runtime ########
FROM nginx:stable-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 3: Validate nginx config syntax inside the runtime image**

Build then `nginx -t`:
```bash
docker build -t mediakit-web:dev -f apps/web/Dockerfile .
docker run --rm mediakit-web:dev nginx -t
```
Expected: `nginx: configuration file /etc/nginx/conf.d/default.conf test is successful` (and `/etc/nginx/nginx.conf test is successful`).

- [ ] **Step 4: Smoke: image serves index.html and proxies /api to the configured upstream**

```bash
docker run --rm -d --name web-smoke -p 8080:80 mediakit-web:dev
curl -s -o /dev/null -w "GET / -> HTTP %{http_code}\n" http://localhost:8080/
curl -s -o /dev/null -w "GET /api/v1/x -> HTTP %{http_code}\n" http://localhost:8080/api/v1/x
docker rm -f web-smoke
```
Expected: `GET / -> HTTP 200`; `GET /api/v1/x -> HTTP 502` (502 = nginx reached upstream `server:4000` which is absent — proves the proxy rule is wired; 404 would mean it fell through to SPA fallback, which is wrong).

- [ ] **Step 5: Commit**

```bash
git add apps/web/nginx.conf apps/web/Dockerfile && git commit -m "feat(docker): add nginx web image (dist + /api /uploads proxy)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Server image (`docker-entrypoint.sh` + `Dockerfile`)

**Files:**
- Create: `apps/server/docker-entrypoint.sh`
- Create: `apps/server/Dockerfile`

Runs migrations then `tsx`. Base is `node:20-bookworm-slim` (glibc) for both build and runtime so the Prisma engine + bundled Chromium match. Chromium download is relocated into `node_modules` via `PUPPETEER_CACHE_DIR` so it survives the runtime copy.

- [ ] **Step 1: Create `apps/server/docker-entrypoint.sh`**

```sh
#!/bin/sh
set -e

echo "[entrypoint] applying prisma migrations..."
npx --no-install prisma migrate deploy

echo "[entrypoint] starting server (tsx)..."
exec npx --no-install tsx src/index.ts
```

- [ ] **Step 2: Create `apps/server/Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1

######## deps + build ########
FROM node:20-bookworm-slim AS build
WORKDIR /repo
ENV CI=1 \
    PUPPETEER_CACHE_DIR=/repo/node_modules/.puppeteer-cache
RUN corepack enable

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

COPY apps/server apps/server
COPY packages/shared packages/shared

# Generate the Prisma client on the SAME linux base as runtime (engine matches).
RUN pnpm --filter @mediakit/server exec prisma generate

######## runtime ########
FROM node:20-bookworm-slim AS runtime

# Puppeteer Chromium shared libraries (official pptr troubleshooting list).
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 \
    libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 \
    libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 \
    libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
    libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 \
    libxss1 libxtst6 lsb-release wget xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production \
    PUPPETEER_CACHE_DIR=/app/node_modules/.puppeteer-cache

# Whole-repo copy keeps workspace symlinks + devDeps (tsx) + Prisma client + Chromium intact.
COPY --from=build /repo /app
COPY apps/server/docker-entrypoint.sh /app/apps/server/docker-entrypoint.sh
RUN chmod +x /app/apps/server/docker-entrypoint.sh

WORKDIR /app/apps/server
EXPOSE 4000
ENTRYPOINT ["/app/apps/server/docker-entrypoint.sh"]
```

- [ ] **Step 3: Build the server image**

```bash
docker build -t mediakit-server:dev -f apps/server/Dockerfile .
```
Expected: build succeeds; the puppeteer postinstall line shows Chromium downloading into `/repo/node_modules/.puppeteer-cache`.

- [ ] **Step 4: Verify runtime-critical artifacts are present in the image (no DB needed)**

```bash
docker run --rm --entrypoint sh mediakit-server:dev -c '\
  echo "tsx: $(ls node_modules/.bin/tsx 2>/dev/null || echo MISSING)"; \
  echo "prisma cli: $(ls node_modules/.bin/prisma 2>/dev/null || ls /app/node_modules/.bin/prisma 2>/dev/null || echo MISSING)"; \
  echo "migrations: $(ls prisma/migrations | wc -l) dirs"; \
  echo "chromium cache: $(ls /app/node_modules/.puppeteer-cache 2>/dev/null || echo MISSING)"; \
  echo "@prisma/client: $(ls node_modules/@prisma/client 2>/dev/null | head -1 || echo MISSING)"'
```
Expected: `tsx:` not `MISSING`; `prisma cli:` not `MISSING`; `migrations:` `>=7` dirs; `chromium cache:` a path (not `MISSING`); `@prisma/client:` a file/dir (not `MISSING`).

> If `chromium cache: MISSING`, the `PUPPETEER_CACHE_DIR` relocation failed — confirm the ENV is set before `pnpm install` in the build stage.

- [ ] **Step 5: Commit**

```bash
git add apps/server/docker-entrypoint.sh apps/server/Dockerfile && git commit -m "feat(docker): add api image (tsx + prisma migrate + bundled Chromium)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Prod compose + env contract

**Files:**
- Create: `docker-compose.prod.yml`
- Create: `.env.prod.example`

Runs only `web` + `server`; DB/Redis come from external managed services via env. Web depends on server health. Image tags default to the GitLab registry `:latest` and can be overridden via shell env at `docker compose up` time (compose interpolates `${VAR}` from the shell / a compose-level `.env`, **not** from the server's `env_file`).

- [ ] **Step 1: Create `docker-compose.prod.yml`**

```yaml
name: mediakit-prod

# Image tags + port are interpolated by docker compose from the shell env
# (or a compose-level .env), NOT from the server's env_file. Override at up time:
#   WEB_IMAGE=… SERVER_IMAGE=… WEB_PORT=8080 docker compose -f docker-compose.prod.yml up -d
services:
  web:
    image: ${WEB_IMAGE:-registry.gitlab.com/affliate-product/campaignreport/web:latest}
    restart: unless-stopped
    ports:
      - "${WEB_PORT:-80}:80"
    depends_on:
      server:
        condition: service_healthy

  server:
    image: ${SERVER_IMAGE:-registry.gitlab.com/affliate-product/campaignreport/server:latest}
    restart: unless-stopped
    env_file:
      - .env.prod
    volumes:
      # Only used when STORAGE_DRIVER=local; omit the line for oss driver.
      - ./uploads:/app/apps/server/uploads
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:4000/healthz || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 30s
```

- [ ] **Step 2: Create `.env.prod.example`**

```dotenv
# MediaKit 生产环境变量契约。复制为 .env.prod 后按真实值填写。
# docker-compose.prod.yml 的 server 服务通过 env_file 读取。
# 注：容器镜像名 (WEB_IMAGE/SERVER_IMAGE) 不在此处——它们由 compose 自行插值，
# 默认 registry.gitlab.com/.../{web,server}:latest，up 时用 shell 变量覆盖即可。

# ---- apps/server 应用变量（见 apps/server/src/config.ts） ----
NODE_ENV=production
PORT=4000

# 外部托管 MySQL(RDS) / Redis(Tair)
DATABASE_URL=mysql://USER:PASS@rds-host:3306/mediakit
REDIS_URL=redis://:PASS@tair-host:6379

# JWT —— 生产强随机
JWT_ACCESS_SECRET=replace-with-strong-random
JWT_REFRESH_SECRET=replace-with-strong-random
JWT_ACCESS_TTL=900
JWT_REFRESH_TTL=604800

# refresh cookie（生产走 https）
COOKIE_SECURE=true
COOKIE_DOMAIN=.example.com

# CORS 允许来源（公网域名，逗号分隔）
CORS_ORIGIN=https://app.example.com

LOG_LEVEL=info

# puppeteer 跨容器取 share 页（compose 内网直达 nginx）
WEB_URL=http://web:80

# <img> 回显基址，必须为公网域名（留空会回显失败）
PUBLIC_BASE=https://app.example.com

# ---- 文件上传存储 ----
# local: 文件落盘 UPLOAD_DIR（compose 挂载 ./uploads 到此目录）
STORAGE_DRIVER=local
UPLOAD_DIR=/app/apps/server/uploads
# oss 驱动（STORAGE_DRIVER=oss 时启用，替换下面四项）
# OSS_REGION=oss-cn-hangzhou
# OSS_BUCKET=your-bucket
# OSS_ACCESS_KEY_ID=your-key-id
# OSS_ACCESS_KEY_SECRET=your-key-secret
# OSS_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com
```

- [ ] **Step 3: Validate the compose file parses**

```bash
docker compose -f docker-compose.prod.yml config >/dev/null && echo OK
```
Expected: `OK` (no validation errors). Defaults make it parse without any env. If it complains about a missing `.env.prod`, create a throwaway `touch .env.prod` first; delete it after.

- [ ] **Step 4: End-to-end smoke against the local dev DB/Redis**

The existing local `docker-compose.yml` already runs MySQL on `:3317` and Redis on `:6389`. Point the prod `server` container at them via the host network to exercise migrate + boot + health. Image tags are overridden to the locally-built images via shell env (no tagging needed):

```bash
# 1. ensure dev infra is up
docker compose up -d mysql redis

# 2. throwaway prod env pointing at host dev DB
cp .env.prod.example .env.prod
# edit .env.prod: set DATABASE_URL=mysql://mediakit:mediakit_pw@host.docker.internal:3317/mediakit
#                 REDIS_URL=redis://host.docker.internal:6389
#                 CORS_ORIGIN=http://localhost:8080  PUBLIC_BASE=http://localhost:8080
#                 COOKIE_SECURE=false  WEB_URL=http://web:80
#                 (JWT_* can stay as the example dev values)

# 3. bring up prod compose using LOCAL images (override the registry defaults)
WEB_IMAGE=mediakit-web:dev SERVER_IMAGE=mediakit-server:dev WEB_PORT=8080 \
  docker compose -f docker-compose.prod.yml up -d

# 4. smoke: web serves SPA (200); nginx proxies /api to the live server (401 = auth gate hit)
curl -s -o /dev/null -w "web GET / -> HTTP %{http_code}\n" http://localhost:8080/
curl -s -o /dev/null -w "proxy GET /api/v1/projects -> HTTP %{http_code}\n" http://localhost:8080/api/v1/projects
# server healthz directly
docker compose -f docker-compose.prod.yml exec server wget -qO- http://localhost:4000/healthz

# 5. teardown
docker compose -f docker-compose.prod.yml down
rm -f .env.prod
```
Expected: `web GET / -> HTTP 200`; `proxy GET /api/v1/projects -> HTTP 401` (401 = request reached the server and hit the auth gate — proves nginx→server routing end to end; 502 would mean upstream unreachable, 404 would mean it fell through to SPA fallback, both wrong); server `/healthz` returns `{"status":"ok"}`; server logs show `Applying prisma migrations` then `… migrations applied` then startup with no Chromium error.

> `host.docker.internal` resolves the host from inside Docker Desktop on macOS. On Linux set `extra_hosts: ["host.docker.internal:host-gateway"]` on the server service (add if needed).

- [ ] **Step 5: Commit**

```bash
git add docker-compose.prod.yml .env.prod.example && git commit -m "feat(deploy): add prod compose + .env.prod.example (web+server, external DB)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: GitLab CI pipeline

**Files:**
- Create: `.gitlab-ci.yml`

Builds both images on `main` or `vX.Y.Z` tags and pushes to GitLab's built-in Container Registry (`$CI_REGISTRY_IMAGE`), authenticated with `$CI_JOB_TOKEN`.

- [ ] **Step 1: Create `.gitlab-ci.yml`**

```yaml
stages:
  - build

variables:
  DOCKER_TLS_CERTDIR: "/certs"

.build_template: &build_template
  image: docker:24
  services:
    - docker:24-dind
  before_script:
    - echo "$CI_JOB_TOKEN" | docker login -u gitlab-ci-token --password-stdin "$CI_REGISTRY"
  rules:
    - if: '$CI_COMMIT_BRANCH == "main"'
    - if: '$CI_COMMIT_TAG =~ /^v\d+\.\d+\.\d+/'
  interruptible: true

build:web:
  <<: *build_template
  stage: build
  script:
    - docker build -t "$CI_REGISTRY_IMAGE/web:$CI_COMMIT_SHORT_SHA" -t "$CI_REGISTRY_IMAGE/web:latest" -f apps/web/Dockerfile .
    - docker push "$CI_REGISTRY_IMAGE/web:$CI_COMMIT_SHORT_SHA"
    - docker push "$CI_REGISTRY_IMAGE/web:latest"

build:server:
  <<: *build_template
  stage: build
  script:
    - docker build -t "$CI_REGISTRY_IMAGE/server:$CI_COMMIT_SHORT_SHA" -t "$CI_REGISTRY_IMAGE/server:latest" -f apps/server/Dockerfile .
    - docker push "$CI_REGISTRY_IMAGE/server:$CI_COMMIT_SHORT_SHA"
    - docker push "$CI_REGISTRY_IMAGE/server:latest"
```

- [ ] **Step 2: Validate YAML syntax**

```bash
docker run --rm -v "$PWD:/w" -w /w cytopia/yamllint:latest -d "{rules: {line-length: disable, document-start: disable}}" .gitlab-ci.yml \
  || node -e "require('/dev/stdin')" < .gitlab-ci.yml 2>/dev/null \
  || python3 -c "import yaml,sys; yaml.safe_load(open('.gitlab-ci.yml')); print('yaml OK')"
```
Expected: prints `yaml OK` (or yamllint reports no errors). Any of the three validators passing is sufficient.

- [ ] **Step 3: Confirm both Dockerfiles still build together (final combined gate)**

```bash
docker build -t mediakit-web:final -f apps/web/Dockerfile .
docker build -t mediakit-server:final -f apps/server/Dockerfile .
echo "both images built OK"
```
Expected: both succeed (heavy; allow several minutes for the server image's apt + Chromium download).

- [ ] **Step 4: Commit**

```bash
git add .gitlab-ci.yml && git commit -m "ci: build & push web+server images to GitLab Container Registry

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Final verification + handoff

**Files:** none (verification only)

- [ ] **Step 1: Confirm all deliverables exist and the tree is clean**

```bash
git status --short
ls -1 .dockerignore apps/web/Dockerfile apps/web/nginx.conf apps/server/Dockerfile apps/server/docker-entrypoint.sh docker-compose.prod.yml .env.prod.example .gitlab-ci.yml
```
Expected: `git status` clean; all 8 files listed.

- [ ] **Step 2: Confirm branch commits**

Run: `git log --oneline main..HEAD`
Expected: 5 commits (Tasks 1–5), each on `feat/cicd-dockerfile`.

- [ ] **Step 3: Hand off for review/merge**

Report to the user:
- Branch `feat/cicd-dockerfile` ready with 5 commits.
- Local smoke (Task 4 Step 4) results.
- Open follow-ups from the spec §9 (single-replica `migrate deploy`; GitLab Container Registry must be enabled on `gitlab.duomai.cn`, else switch `WEB_IMAGE`/`SERVER_IMAGE` + add Aliyun ACR credentials; future `pnpm deploy --prod` pruning once `tsx` is moved to `dependencies`).

Do **not** merge or push without explicit user instruction.
