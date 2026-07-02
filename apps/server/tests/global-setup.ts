import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? 'mysql://mediakit:mediakit_pw@localhost:3317/mediakit';

/**
 * Vitest globalSetup：在每个测试 run 前确保数据库 schema 已应用。
 * vitest 的 `env` 配置只注入到 worker 进程，不传给这里的子进程，
 * 因此显式把 DATABASE_URL 放进环境，供 prisma CLI 读取。
 */
export default function globalSetup(): void {
  process.env.DATABASE_URL = testDatabaseUrl;
  execSync('pnpm exec prisma migrate deploy', {
    stdio: 'inherit',
    cwd: resolve(here, '..'),
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
  });
}
