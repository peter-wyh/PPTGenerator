#!/bin/sh
set -e

echo "[entrypoint] applying prisma migrations..."
npx --no-install prisma migrate deploy

echo "[entrypoint] starting server (tsx)..."
exec npx --no-install tsx src/index.ts
