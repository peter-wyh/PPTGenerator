import { describe, it, expect, beforeEach } from 'vitest'
import { authBridge } from '../src/api/authBridge'
import { useAuthStore, initAuthBridge } from '../src/stores/auth'

describe('auth store', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, accessToken: null })
    initAuthBridge()
  })

  it('setUser stores user + token', () => {
    useAuthStore.getState().setUser({ id: 'u1', username: 'a', role: 'USER' }, 't1')
    expect(useAuthStore.getState().user?.username).toBe('a')
    expect(useAuthStore.getState().accessToken).toBe('t1')
  })

  it('bridge reads/writes the store token', () => {
    useAuthStore.getState().setUser({ id: 'u1', username: 'a', role: 'USER' }, 't1')
    expect(authBridge.fns?.getAccessToken()).toBe('t1')
    authBridge.fns?.setAccessToken('t2')
    expect(useAuthStore.getState().accessToken).toBe('t2')
  })

  it('clear resets the store', () => {
    useAuthStore.getState().setUser({ id: 'u1', username: 'a', role: 'USER' }, 't1')
    authBridge.fns?.clear()
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().accessToken).toBeNull()
  })
})
