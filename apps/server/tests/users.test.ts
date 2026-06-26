import { describe, it, expect } from 'vitest'
import { api, createUser, login, withToken } from './helpers'

describe('admin users CRUD', () => {
  it('forbids non-admin (403)', async () => {
    await createUser({ username: 'user1', role: 'USER' })
    const { body } = await login('user1')
    const res = await withToken(body.accessToken).get('/api/v1/admin/users')
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('ADMIN_ONLY')
  })

  it('forbids without token (401)', async () => {
    const res = await api().get('/api/v1/admin/users')
    expect(res.status).toBe(401)
  })

  it('admin lists/creates/patches/deletes users', async () => {
    await createUser({ username: 'admin1', role: 'ADMIN' })
    const { body } = await login('admin1')
    const auth = withToken(body.accessToken)

    const list0 = await auth.get('/api/v1/admin/users')
    expect(list0.status).toBe(200)
    expect(list0.body.users.length).toBe(1)

    const created = await auth.post('/api/v1/admin/users').send({
      username: 'newbie',
      password: 'pass1234',
      role: 'USER',
    })
    expect(created.status).toBe(201)
    expect(created.body.user).toMatchObject({ username: 'newbie', role: 'USER' })

    const patched = await auth.patch(`/api/v1/admin/users/${created.body.user.id}`).send({ role: 'ADMIN' })
    expect(patched.status).toBe(200)
    expect(patched.body.user.role).toBe('ADMIN')

    const dup = await auth.post('/api/v1/admin/users').send({ username: 'newbie', password: 'pass1234' })
    expect(dup.status).toBe(409) // P2002 → 409

    const deleted = await auth.delete(`/api/v1/admin/users/${created.body.user.id}`)
    expect(deleted.status).toBe(200)
    expect(deleted.body.ok).toBe(true)

    const missing = await auth.delete(`/api/v1/admin/users/${created.body.user.id}`)
    expect(missing.status).toBe(404) // P2025 → 404
  })
})
