import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { randomUUID } from 'node:crypto';
import { config } from '../../config';
import { redis } from '../../redis';
import type { Role } from '@mediakit/shared';

const encoder = new TextEncoder();

export interface AccessTokenPayload extends JWTPayload {
  sub: string;
  role: Role;
  /** 归属业务线 code；ADMIN / 旧 token 无此约束时为 null 或缺失。 */
  bl?: string | null;
  type: 'access';
}

export interface RefreshTokenPayload extends JWTPayload {
  sub: string;
  type: 'refresh';
}

const WHITELIST = (jti: string) => `refresh:valid:${jti}`;
const BLACKLIST = (jti: string) => `refresh:blacklist:${jti}`;

function secret(name: 'access' | 'refresh'): Uint8Array {
  const raw = name === 'access' ? config.jwt.accessSecret : config.jwt.refreshSecret;
  return encoder.encode(raw);
}

export function newJti(): string {
  return randomUUID();
}

/* ------------------------------ 签发 ------------------------------ */

export async function signAccessToken(
  userId: string,
  role: Role,
  businessLineCode?: string | null,
): Promise<string> {
  return new SignJWT({ role, bl: businessLineCode ?? null, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${config.jwt.accessTtlSec}s`)
    .sign(secret('access'));
}

export async function signRefreshToken(userId: string, jti: string): Promise<string> {
  return new SignJWT({ type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(`${config.jwt.refreshTtlSec}s`)
    .sign(secret('refresh'));
}

/* ------------------------------ 校验 ------------------------------ */

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, secret('access'), {
    algorithms: ['HS256'],
  });
  return payload as AccessTokenPayload;
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  const { payload } = await jwtVerify(token, secret('refresh'), {
    algorithms: ['HS256'],
  });
  return payload as RefreshTokenPayload;
}

/* ------------------------- 白名单 / 黑名单 ------------------------- */

/** 注册新签发的 refresh token（白名单 + TTL）。 */
export async function registerRefresh(jti: string, userId: string): Promise<void> {
  await redis.set(WHITELIST(jti), userId, 'EX', config.jwt.refreshTtlSec);
}

/** refresh 是否有效（在白名单且未被拉黑）。 */
export async function isRefreshValid(jti: string): Promise<boolean> {
  const [valid, blocked] = await Promise.all([redis.exists(WHITELIST(jti)), redis.exists(BLACKLIST(jti))]);
  return valid === 1 && blocked === 0;
}

/**
 * 作废一个 refresh token：移出白名单，加入黑名单（TTL = 剩余生命，自动过期）。
 * 用于轮换与 logout。
 */
export async function revokeRefresh(jti: string): Promise<void> {
  const ttl = await redis.ttl(WHITELIST(jti));
  // ttl>0 时按剩余时间拉黑；已过期则短 TTL 兜底。
  const blacklistTtl = ttl > 0 ? ttl : config.jwt.refreshTtlSec;
  await redis
    .multi()
    .del(WHITELIST(jti))
    .set(BLACKLIST(jti), '1', 'EX', blacklistTtl)
    .exec();
}
