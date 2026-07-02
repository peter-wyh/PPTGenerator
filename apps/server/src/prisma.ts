import { PrismaClient } from '@prisma/client';
import { config } from './config';
import { logger } from './logger';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/** 单例 PrismaClient（避免热重载/dev 重复实例）。 */
export const prisma: PrismaClient =
  globalThis.__prisma ??
  new PrismaClient({
    log: config.isTest ? [] : ['error', 'warn'],
  });

if (!config.isProd) {
  globalThis.__prisma = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
  logger.info('prisma disconnected');
}
