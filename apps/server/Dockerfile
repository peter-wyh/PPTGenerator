
######## deps + build ########
FROM harbor.duomai.com/tool/node:20-bookworm-slim AS build
WORKDIR /repo
ENV CI=1 \
    PUPPETEER_CACHE_DIR=/repo/node_modules/.puppeteer-cache
RUN npm i -g corepack@latest && corepack enable
# puppeteer postinstall extracts the Chromium zip → needs unzip (absent from -slim)
RUN apt-get update && apt-get install -y --no-install-recommends unzip ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

# tsc/tsx read tsconfig.json which extends ../../tsconfig.base.json
COPY tsconfig.base.json ./
COPY apps/server apps/server
COPY packages/shared packages/shared

# Generate the Prisma client on the SAME linux base as runtime (engine matches).
RUN pnpm --filter @mediakit/server exec prisma generate

######## runtime ########
FROM harbor.duomai.com/tool/node:20-bookworm-slim AS runtime

# Puppeteer Chromium shared libraries (official pptr troubleshooting list).
RUN sed -i 's#http://deb.debian.org#http://mirrors.tuna.tsinghua.edu.cn#g' /etc/apt/sources.list.d/debian.sources && \    
    sed -i 's#http://security.debian.org#http://mirrors.tuna.tsinghua.edu.cn#g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && apt-get install -y --no-install-recommends \
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
