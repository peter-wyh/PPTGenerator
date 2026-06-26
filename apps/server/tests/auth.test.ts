import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { api, createUser, login, withToken } from './helpers'
import { createApp } from '../src/app'

describe('auth', () => {
  it('login succeeds and sets refresh cookie', async () => {
    await createUser({ username: 'alice' })
    const res = await login('alice')
    expect(res.status).toBe(200)
    expect(res.body.accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/)
    expect(String(res.cookie)).toContain('refreshToken=')
    expect(String(res.cookie)).toContain('HttpOnly')
  })

  it('login fails with wrong password (401)', async () => {
    await createUser({ username: 'alice' })
    const res = await login('alice', 'wrong')
    expect(res.status).toBe(401)
    expect(res.body.error!.code).toBe('INVALID_CREDENTIALS')
  })

  it('login fails for unknown user (401)', async () => {
    const res = await login('nobody')
    expect(res.status).toBe(401)
  })

  it('me returns the logged-in user', async () => {
    await createUser({ username: 'alice' })
    const { body } = await login('alice')
    const res = await withToken(body.accessToken).get('/api/v1/auth/me')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ username: 'alice', role: 'USER' })
  })

  it('me rejects without token (401)', async () => {
    const res = await api().get('/api/v1/auth/me')
    expect(res.status).toBe(401)
  })

  it('refresh issues a new access token (cookie flow)', async () => {
    await createUser({ username: 'alice' })
    const agent = request.agent(createApp())
    await agent.post('/api/v1/auth/login').send({ username: 'alice', password: 'pw12345' })
    const res = await agent.post('/api/v1/auth/refresh')
    expect(res.status).toBe(200)
    expect(res.body.accessToken).toBeTruthy()
  })

  it('refresh rotation invalidates the old refresh token', async () => {
    await createUser({ username: 'alice' })
    // 用首次 login 的 Set-Cookie 作为“旧 token”
    const { cookie } = await login('alice')
    const oldCookie = String(cookie).split(';')[0] // refreshToken=<jwt>

    // 第一次 refresh 成功
    const r1 = await api().post('/api/v1/auth/refresh').set('Cookie', oldCookie)
    expect(r1.status).toBe(200)

    // 同一旧 cookie 再 refresh 应被拒（已轮换作废）
    const r2 = await api().post('/api/v1/auth/refresh').set('Cookie', oldCookie)
    expect(r2.status).toBe(401)
  })

  it('logout revokes the refresh token', async () => {
    await createUser({ username: 'alice' })
    const agent = request.agent(createApp())
    await agent.post('/api/v1/auth/login').send({ username: 'alice', password: 'pw12345' })
    const out = await agent.post('/api/v1/auth/logout')
    expect(out.status).toBe(200)

    const res = await agent.post('/api/v1/auth/refresh')
    expect(res.status).toBe(401)
  })
})
