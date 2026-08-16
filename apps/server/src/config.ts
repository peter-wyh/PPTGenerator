import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

// 单测可能在不同 cwd 加载本模块，按 server 包根定位 .env。
loadEnv({ path: resolve(process.cwd(), '.env') });

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${name}`);
  return v;
}

/**
 * 生产环境强制要求显式配置：禁止弱回退静默生效。
 * （安全：JWT 弱密钥 = 任何人可伪造 token）
 */
function requiredInProd(name: string, devFallback: string): string {
  if (process.env.NODE_ENV === 'production' && !process.env[name]) {
    throw new Error(`[FATAL] ${name} is required in production (weak fallback disabled)`);
  }
  return required(name, devFallback);
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
  /** Redis DB index (0-15)，可单独指定避免与其他服务共用 DB 0。 */
  redisDb: int('REDIS_DB', 0),

  jwt: {
    accessSecret: requiredInProd('JWT_ACCESS_SECRET', 'dev-access-secret-change-me'),
    refreshSecret: requiredInProd('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me'),
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

  /** 前端 Web 地址（PDF 导出时 puppeteer 访问 /share/:token?print=1 渲染页面）。 */
  webUrl: process.env.WEB_URL ?? 'http://localhost:5173',

  /** 文件上传存储：local=本地目录（默认），oss=阿里云 OSS。 */
  storage: {
    driver: (process.env.STORAGE_DRIVER === 'oss' ? 'oss' : 'local') as 'local' | 'oss',
    uploadDir: process.env.UPLOAD_DIR ?? resolve(process.cwd(), 'uploads'),
    // 默认空串 → 返回相对路径 /uploads/<file>，浏览器经 Vite 代理 / 同源访问。
    // 焊死 http://localhost:PORT 会在容器/远程/部署后导致 <img> 直连失败 → 图片不回显。
    // 需要绝对地址（如 CDN）时显式设置 PUBLIC_BASE 覆盖。
    publicBase: (process.env.PUBLIC_BASE ?? '').replace(/\/$/, ''),
    oss: {
      region: process.env.OSS_REGION,
      bucket: process.env.OSS_BUCKET,
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
      endpoint: process.env.OSS_ENDPOINT,
    },
  },
} as const;

export type Config = typeof config;
