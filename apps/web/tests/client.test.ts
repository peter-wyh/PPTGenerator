import { describe, it, expect, beforeEach } from 'vitest'
import MockAdapter from 'axios-mock-adapter'
import { api, doRefresh } from '../src/api/client'
import { setAuthFns, authBridge } from '../src/api/authBridge'

describe('axios client', () => {
  let mock: MockAdapter
  let token: string | null

  beforeEach(() => {
    mock = new MockAdapter(api)
    token = 'access-1'
    setAuthFns({
      getAccessToken: () => token,
      setAccessToken: (t) => {
        token = t
      },
      clear: () => {
        token = null
      },
    })
  })

  it('injects bearer token into requests', async () => {
    mock.onGet('/projects').reply((cfg) => [200, { ok: cfg.headers?.Authorization === 'Bearer access-1' }])
    const res = await api.get('/projects')
    expect(res.data.ok).toBe(true)
  })

  it('refreshes and retries once on 401', async () => {
    mock.reset()
    const refresh = mock.onPost('/auth/refresh').reply(200, { accessToken: 'access-2' })
    mock.onGet('/projects').replyOnce(401).onGet('/projects').reply(200, { retried: true })

    const res = await api.get('/projects')
    expect(refresh.history.post.length).toBe(1)
    expect(token).toBe('access-2')
    expect(res.data.retried).toBe(true)
  })

  it('clears auth when refresh fails', async () => {
    mock.reset()
    mock.onPost('/auth/refresh').reply(401)
    mock.onGet('/projects').reply(401)

    await expect(api.get('/projects')).rejects.toMatchObject({ response: { status: 401 } })
    expect(token).toBeNull()
  })

  it('doRefresh returns new token', async () => {
    mock.reset()
    mock.onPost('/auth/refresh').reply(200, { accessToken: 'fresh' })
    await expect(doRefresh()).resolves.toBe('fresh')
  })
})
