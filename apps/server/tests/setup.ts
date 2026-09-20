import { afterEach } from 'vitest';
import { prisma } from '../src/prisma';
import { redis } from '../src/redis';

/**
 * 每个测试后清空表 + 刷新 Redis，保证测试间隔离。
 * TRUNCATE + FK 检查关闭包在一个原子调用里（$transaction 内同一连接执行），
 * 避免 Prisma 连接池把 SET/TRUNCATE 路由到不同连接导致 FOREIGN_KEY_CHECKS
 * 是 session 级设置而失效 → 并行 vitest 时常报
 * "Cannot truncate a table referenced in a foreign key constraint"（flake 根因）。
 *
 * ⚠️ 0920 事故防护：TRUNCATE 仅允许打在隔离测试库。
 * global-setup.ts 会把 DATABASE_URL 切到 mediakit_test；若有人用定制配置绕过
 * globalSetup（如只跑单测不建测试库），这里会直接把 dev/prod 共库清空（0920 真实事故）。
 * 因此执行前先校验当前库名，非测试库一律拒绝并抛错。
 */
async function assertTestDatabase(): Promise<string> {
  const rows = (await prisma.$queryRawUnsafe(
    'SELECT DATABASE() AS db'
  )) as unknown as { db: string }[];
  const db = rows?.[0]?.db ?? '';
  if (!db.includes('test')) {
    throw new Error(
      `[tests/setup] 拒绝 TRUNCATE：当前库 "${db}" 不是隔离测试库（不含 "test"）。` +
        `测试必须经 global-setup.ts 切到 mediakit_test。若要绕过 DB 相关测试，` +
        `请在定制 vitest 配置中排除 setup.ts，而不是绕过 globalSetup。`
    );
  }
  return db;
}

afterEach(async () => {
  const db = await assertTestDatabase();
  await prisma.$transaction([
    prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0'),
    prisma.$executeRawUnsafe('TRUNCATE TABLE Project'),
    prisma.$executeRawUnsafe('TRUNCATE TABLE Template'),
    prisma.$executeRawUnsafe('TRUNCATE TABLE User'),
    prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1'),
  ]);
  await redis.flushdb();
  // eslint-disable-next-line no-console
  console.debug(`[tests/setup] truncated on ${db}`);
});
