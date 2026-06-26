import { create } from 'zustand'
import type { Role } from '@ppt-generator/shared'
import { setAuthFns } from '../api/authBridge'

export interface AuthUser {
  id: string
  username: string
  role: Role
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  setUser: (user: AuthUser, token: string) => void
  setToken: (token: string) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  setUser: (user, accessToken) => set({ user, accessToken }),
  setToken: (accessToken) => set({ accessToken }),
  clear: () => set({ user: null, accessToken: null }),
}))

// 把读写函数挂到 bridge，供 axios 拦截器使用（解循环依赖）
export function initAuthBridge() {
  setAuthFns({
    getAccessToken: () => useAuthStore.getState().accessToken,
    setAccessToken: (token) => useAuthStore.setState({ accessToken: token }),
    clear: () => useAuthStore.getState().clear(),
  })
}
