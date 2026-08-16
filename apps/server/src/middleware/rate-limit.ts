import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '../redis';
import type { Request } from 'express';

/**
 * ioredis 适配 rate-limit-redis：其类型定义面向 node-redis 客户端，
 * 运行时兼容 ioredis 的 call（见 rate-limit-redis README 的 ioredis 用法）。
 */
const sendCommand: any = (...args: string[]) => redis.call(...(args as [string, ...string[]]));

/** keyBy：登录用户优先（防单账号刷），否则 IP。 */
function keyByUser(req: Request): string {
  return req.user?.id ?? req.ip ?? 'unknown';
}

/**
 * 全局 API 限流（宽松兜底）：300 次 / 5 分钟 / 用户或 IP。
 * 登录、AI 生成、分享页另有更严的专用限流。
 */
export const globalLimiter = rateLimit({
  store: new RedisStore({ sendCommand }),
  windowMs: 5 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: keyByUser,
  message: { error: 'TOO_MANY_REQUESTS', message: '请求过于频繁，请稍后再试' },
});

/**
 * 登录限流（防暴力破解）：10 次 / 5 分钟 / IP。
 * 登录前无 user，只能按 IP；密码错 5 次即锁窗口。
 */
export const loginLimiter = rateLimit({
  store: new RedisStore({ sendCommand }),
  windowMs: 5 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? 'unknown',
  message: { error: 'TOO_MANY_REQUESTS', message: '尝试次数过多，请 5 分钟后再试' },
});

/**
 * AI 生成限流（防滥用烧钱）：20 次 / 小时 / 用户。
 * 单次生成约 14K output tokens，必须按用户配额。
 */
export const aiGenerateLimiter = rateLimit({
  store: new RedisStore({ sendCommand }),
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: keyByUser,
  message: { error: 'AI_QUOTA_EXCEEDED', message: 'AI 生成次数已达上限（20 次/小时），请稍后再试' },
});

/**
 * 分享页限流（公开路由防爬）：120 次 / 5 分钟 / IP。
 */
export const shareLimiter = rateLimit({
  store: new RedisStore({ sendCommand }),
  windowMs: 5 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? 'unknown',
  message: { error: 'TOO_MANY_REQUESTS', message: '访问过于频繁，请稍后再试' },
});
