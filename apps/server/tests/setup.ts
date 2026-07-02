import { afterEach } from 'vitest';
import { prisma } from '../src/prisma';
import { redis } from '../src/redis';

/** 每个测试后清空表 + 刷新 Redis，保证测试间隔离。 */
afterEach(async () => {
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE Project');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE User');
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
  await redis.flushdb();
});
