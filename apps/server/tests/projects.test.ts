import { describe, it, expect } from 'vitest'
import { createUser, login, withToken } from './helpers'

describe('projects', () => {
  it('creates a project with 3 empty pages', async () => {
    await createUser({ username: 'a', role: 'USER' })
    const { body } = await login('a')
    const res = await withToken(body.accessToken).post('/api/v1/projects').send({ name: '我的项目' })
    expect(res.status).toBe(201)
    expect(res.body.project.name).toBe('我的项目')
    expect(res.body.project.pages).toHaveLength(3)
    expect(res.body.project.pages[0].components).toEqual([])
  })

  it('lists only own projects', async () => {
    await createUser({ username: 'a', role: 'USER' })
    await createUser({ username: 'b', role: 'USER' })
    const authA = withToken((await login('a')).body.accessToken)
    const authB = withToken((await login('b')).body.accessToken)
    await authA.post('/api/v1/projects').send({ name: 'A1' })
    await authB.post('/api/v1/projects').send({ name: 'B1' })

    const namesOf = (r: { body: { projects: { name: string }[] } }) => r.body.projects.map((p) => p.name)
    expect(namesOf(await authA.get('/api/v1/projects'))).toEqual(['A1'])
    expect(namesOf(await authB.get('/api/v1/projects'))).toEqual(['B1'])
  })

  it('isolates access across users (foreign project → 404)', async () => {
    await createUser({ username: 'a', role: 'USER' })
    await createUser({ username: 'b', role: 'USER' })
    const authA = withToken((await login('a')).body.accessToken)
    const authB = withToken((await login('b')).body.accessToken)
    const created = await authA.post('/api/v1/projects').send({ name: 'A1' })
    const id = created.body.project.id

    expect((await authB.get(`/api/v1/projects/${id}`)).status).toBe(404)
    expect((await authB.delete(`/api/v1/projects/${id}`)).status).toBe(404)
    // 确认 a 仍能访问（未被 b 误删）
    expect((await authA.get(`/api/v1/projects/${id}`)).status).toBe(200)
  })

  it('admin sees all projects', async () => {
    await createUser({ username: 'admin1', role: 'ADMIN' })
    await createUser({ username: 'a', role: 'USER' })
    await withToken((await login('a')).body.accessToken).post('/api/v1/projects').send({ name: 'A1' })

    const res = await withToken((await login('admin1')).body.accessToken).get('/api/v1/projects')
    expect(res.status).toBe(200)
    expect(res.body.projects.length).toBe(1)
    expect(res.body.projects[0].name).toBe('A1')
  })

  it('updates and duplicates', async () => {
    await createUser({ username: 'a', role: 'USER' })
    const auth = withToken((await login('a')).body.accessToken)
    const created = await auth.post('/api/v1/projects').send({ name: '原始' })
    const id = created.body.project.id

    const patched = await auth.patch(`/api/v1/projects/${id}`).send({ name: '改名', canvasWidth: 1920 })
    expect(patched.status).toBe(200)
    expect(patched.body.project.name).toBe('改名')
    expect(patched.body.project.canvasWidth).toBe(1920)

    const dup = await auth.post(`/api/v1/projects/${id}/duplicate`)
    expect(dup.status).toBe(201)
    expect(dup.body.project.name).toBe('改名 副本')

    expect((await auth.get('/api/v1/projects')).body.projects.length).toBe(2)

    const deleted = await auth.delete(`/api/v1/projects/${id}`)
    expect(deleted.status).toBe(200)
    expect((await auth.get(`/api/v1/projects/${id}`)).status).toBe(404)
  })

  it('rejects unauthenticated (401)', async () => {
    expect((await withToken().get('/api/v1/projects')).status).toBe(401)
  })
})
