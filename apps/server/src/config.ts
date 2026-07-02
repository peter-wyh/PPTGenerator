import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

// 单测可能在不同 cwd 加载本模块，按 server 包根定位 .env。
loadEnv({ path: resolve(process.cwd(), '.env') });

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function int(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Env var ${name} must be a number, got: ${v}`);
  return n;
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  port: int('PORT', 4000),

  databaseUrl: required('DATABASE_URL'),

  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', 'dev-access-secret-change-me'),
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me'),
    accessTtlSec: int('JWT_ACCESS_TTL', 15 * 60), // 15 min
    refreshTtlSec: int('JWT_REFRESH_TTL', 7 * 24 * 60 * 60), // 7d
  },

  cookie: {
    name: 'mediakit_refresh',
    /** cookie 是否仅 https。开发/测试关闭以便 http 调试。 */
    secure: process.env.COOKIE_SECURE === 'true',
    domain: process.env.COOKIE_DOMAIN || undefined,
  },

  cors: {
    origin: process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()) ?? ['http://localhost:5173'],
  },
} as const;

export type Config = typeof config;
