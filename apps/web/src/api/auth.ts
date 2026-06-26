import { api } from './client'
import type { LoginResponse, UserPublic } from '@ppt-generator/shared'

export async function login(username: string, password: string): Promise<LoginResponse> {
  const res = await api.post<LoginResponse>('/auth/login', { username, password })
  return res.data
}

export async function refresh(): Promise<LoginResponse> {
  const res = await api.post<LoginResponse>('/auth/refresh', {})
  return res.data
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout', {})
}

export async function me(): Promise<UserPublic> {
  const res = await api.get<UserPublic>('/auth/me')
  return res.data
}
