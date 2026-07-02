import { defineConfig } from 'vitest/config';

// 测试库：默认指向 docker-compose 的 mysql/redis（可被 TEST_DATABASE_URL / TEST_REDIS_URL 覆盖）。
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? 'mysql://mediakit:mediakit_pw@localhost:3317/mediakit';
const testRedisUrl = process.env.TEST_REDIS_URL ?? 'redis://localhost:6389';

export default defineConfig({
  test: {
    environment: 'node',
    // 共享测试库：单进程串行执行，避免并发写冲突。
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    globalSetup: ['./tests/global-setup.ts'],
    setupFiles: ['./tests/setup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl,
      REDIS_URL: testRedisUrl,
      JWT_ACCESS_SECRET: 'test-access-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
      LOG_LEVEL: 'silent',
    },
  },
});
