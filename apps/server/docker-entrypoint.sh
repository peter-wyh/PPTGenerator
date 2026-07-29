#!/bin/sh
set -e

# We call the prisma/tsx binaries directly instead of via `npx`.
#
# IMPORTANT: pnpm's `.bin/prisma` shim hardcodes the build-stage NODE_PATH
# (e.g. /repo/node_modules/.pnpm/…), but at runtime the files live under /app/….
# The broken NODE_PATH makes the shim fail, and prisma falls back to `npm` to
# reinstall itself — producing "npm error" logs and crashing startup.
#
# Fix: call the prisma JS entry point directly via node, bypassing the shim.
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PRISMA_BIN="$REPO_ROOT/node_modules/.pnpm/prisma@5.22.0/node_modules/prisma/build/index.js"
TSX_BIN="$REPO_ROOT/node_modules/.pnpm/tsx@4.16.2/node_modules/tsx/dist/cli.mjs"

# Fallback: if the hardcoded pnpm version path doesn't exist, try globbing.
if [ ! -f "$PRISMA_BIN" ]; then
  PRISMA_BIN="$(ls "$REPO_ROOT"/node_modules/.pnpm/prisma@*/node_modules/prisma/build/index.js 2>/dev/null | head -1)"
fi
if [ ! -f "$TSX_BIN" ]; then
  TSX_BIN="$(ls "$REPO_ROOT"/node_modules/.pnpm/tsx@*/node_modules/tsx/dist/cli.mjs 2>/dev/null | head -1)"
fi

echo "[entrypoint] applying prisma migrations..."
node "$PRISMA_BIN" migrate deploy || {
  echo "[entrypoint] ERROR: prisma migrate deploy failed (exit $?)"
  echo "[entrypoint] DATABASE_URL host: $(echo "$DATABASE_URL" | sed 's/.*@\([^:]*\):.*/\1/')"
  echo "[entrypoint] prisma bin: $PRISMA_BIN"
  echo "[entrypoint] schema engines present:"
  ls -la "$REPO_ROOT"/node_modules/.pnpm/@prisma+engines@*/node_modules/@prisma/engines/schema-engine-* 2>/dev/null || echo "  (none found)"
  exit 1
}

echo "[entrypoint] starting server (tsx)..."
exec node "$TSX_BIN" src/index.ts
