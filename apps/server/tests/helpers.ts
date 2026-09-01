import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';
import { hashPassword } from '../src/utils/hash';
import type { Role } from '@mediakit/shared';

export function app(): Express {
  return createApp();
}

export async function createUser(opts: {
  email: string;
  password?: string;
  name?: string | null;
  role?: Role;
}) {
  return prisma.user.create({
    data: {
      email: opts.email.toLowerCase(),
      passwordHash: await hashPassword(opts.password ?? 'Password123'),
      name: opts.name ?? null,
      role: opts.role ?? 'USER',
    },
  });
}

export interface LoginResult {
  status: number;
  accessToken: string;
  /** refresh cookie 原始 Set-Cookie 字符串。 */
  setCookie: string[];
  body: unknown;
}

export async function login(express: Express, email: string, password = 'Password123'): Promise<LoginResult> {
  const res = await request(express).post('/api/v1/auth/login').send({ email, password });
  return {
    status: res.status,
    accessToken: res.body?.accessToken,
    setCookie: (res.headers['set-cookie'] as unknown as string[]) ?? [],
    body: res.body,
  };
}

export function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/** 从 set-cookie 数组中取出 name=value 供手动回放。 */
export function cookieValue(setCookie: string[], name: string): string {
  const found = setCookie.find((c) => c.startsWith(`${name}=`));
  return found ? found.split(';')[0] : '';
}
