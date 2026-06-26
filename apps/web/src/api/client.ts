import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { authBridge } from './authBridge'

export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true, // 携带 refresh 的 httpOnly cookie
})

// 用 api 实例调 refresh（走 MockAdapter 可测）；递归由响应拦截器的 isAuthCall 守卫挡住。
export async function doRefresh(): Promise<string | null> {
  try {
    const res = await api.post<{ accessToken: string }>('/auth/refresh', {})
    return res.data.accessToken
  } catch {
    return null
  }
}

let refreshPromise: Promise<string | null> | null = null

function refreshOnce(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

// 请求拦截：注入 bearer
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = authBridge.fns?.getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 响应拦截：401 → refresh → 重试一次；refresh 失败则 clear
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    const status = error.response?.status
    const isAuthCall = original?.url?.includes('/auth/')
    if (status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true
      const newToken = await refreshOnce()
      if (newToken) {
        authBridge.fns?.setAccessToken(newToken)
        original.headers!.Authorization = `Bearer ${newToken}`
        return api(original)
      }
      authBridge.fns?.clear()
    }
    return Promise.reject(error)
  },
)
