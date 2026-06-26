import request from 'supertest'
import { prisma } from '../src/prisma'
import { hashPassword } from '../src/utils/hash'
import { createApp } from '../src/app'
import type { Role } from '@ppt-generator/shared'

export function api() {
  return request(createApp())
}

export async function createUser(opts: { username: string; password?: string; role?: Role }) {
  return prisma.user.create({
    data: {
      username: opts.username,
      passwordHash: await hashPassword(opts.password ?? 'pw12345'),
      role: (opts.role ?? 'USER') as 'ADMIN' | 'USER',
    },
  })
}

export async function login(username: string, password = 'pw12345') {
  const res = await api().post('/api/v1/auth/login').send({ username, password })
  return {
    status: res.status,
    body: res.body as { accessToken?: string; error?: { code: string } },
    cookie: res.headers['set-cookie'],
  }
}

export function withToken(token?: string) {
  const base = api()
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  return {
    get: (p: string) => base.get(p).set(headers),
    post: (p: string) => base.post(p).set(headers),
    patch: (p: string) => base.patch(p).set(headers),
    delete: (p: string) => base.delete(p).set(headers),
  }
}
