import Redis from 'ioredis';
import { config } from './config';

declare global {
  // eslint-disable-next-line no-var
  var __redis: Redis | undefined;
}

/** 单例 Redis 客户端（refresh token 白名单 / 黑名单）。 */
export const redis: Redis =
  globalThis.__redis ??
  new Redis(config.redisUrl, {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
    db: config.redisDb,
  });

if (!config.isProd) {
  globalThis.__redis = redis;
}

export async function disconnectRedis(): Promise<void> {
  await redis.quit();
}
