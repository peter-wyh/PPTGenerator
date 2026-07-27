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

# tsc extends ../../tsconfig.base.json from apps/web
COPY tsconfig.base.json ./

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
