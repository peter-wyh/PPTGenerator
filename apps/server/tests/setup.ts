import { afterEach } from 'vitest';
import { prisma } from '../src/prisma';
import { redis } from '../src/redis';

/**
 * 每个测试后清空表 + 刷新 Redis，保证测试间隔离。
 * TRUNCATE + FK 检查关闭包在一个原子调用里（$transaction 内同一连接执行），
 * 避免 Prisma 连接池把 SET/TRUNCATE 路由到不同连接导致 FOREIGN_KEY_CHECKS
 * 是 session 级设置而失效 → 并行 vitest 时常报
 * "Cannot truncate a table referenced in a foreign key constraint"（flake 根因）。
 */
afterEach(async () => {
  await prisma.$transaction([
    prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0'),
    prisma.$executeRawUnsafe('TRUNCATE TABLE Project'),
    prisma.$executeRawUnsafe('TRUNCATE TABLE Template'),
    prisma.$executeRawUnsafe('TRUNCATE TABLE User'),
    prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1'),
  ]);
  await redis.flushdb();
});
