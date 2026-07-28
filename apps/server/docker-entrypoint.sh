#!/bin/sh
set -e

# Invoke the prisma/tsx shims directly instead of via `npx`. npx honors
# HTTPS_PROXY and other npm network behavior, so a bad/unreachable proxy makes
# the command fail before the underlying tool ever runs — and the real error
# gets swallowed into an npm debug log. Calling the bin directly surfaces the
# tool's own output. (Shims live at node_modules/.bin in the copied repo tree.)
echo "[entrypoint] applying prisma migrations..."
./node_modules/.bin/prisma migrate deploy

echo "[entrypoint] starting server (tsx)..."
exec ./node_modules/.bin/tsx src/index.ts
