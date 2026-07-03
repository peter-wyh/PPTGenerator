import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const here = dirname(fileURLToPath(import.meta.url));

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? 'mysql://mediakit:mediakit_pw@localhost:3317/mediakit_test';

/**
 * Vitest globalSetup：
 * 1) 确保 mediakit_test 库存在（用 root 连接建库 + 授权给应用账号），与 dev 库隔离；
 * 2) 应用迁移。
 *
 * 与 dev 库隔离很重要：setup.ts 会 TRUNCATE User/Project，独立库才不会清掉 dev 的 seed。
 */
async function ensureTestDatabase(url: string): Promise<void> {
  const u = new URL(url);
  const dbName = u.pathname.slice(1) || 'mediakit_test';
  const appUser = decodeURIComponent(u.username);
  const rootUser = process.env.MYSQL_ROOT_USER ?? 'root';
  const rootPass = process.env.MYSQL_ROOT_PASSWORD ?? 'mediakit_root';

  const conn = await mysql.createConnection({
    host: u.hostname,
    port: Number(u.port) || 3306,
    user: rootUser,
    password: rootPass,
  });
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await conn.query(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${appUser}'@'%'`);
  } finally {
    await conn.end();
  }
}

export default async function globalSetup(): Promise<void> {
  await ensureTestDatabase(testDatabaseUrl);
  process.env.DATABASE_URL = testDatabaseUrl;
  execSync('pnpm exec prisma migrate deploy', {
    stdio: 'inherit',
    cwd: resolve(here, '..'),
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
  });
}
