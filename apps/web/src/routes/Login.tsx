import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { login, me } from '../api/auth'
import { useAuthStore } from '../stores/auth'
import { Button } from '../components/Button'
import { Input } from '../components/Input'

export default function Login() {
  const setToken = useAuthStore((s) => s.setToken)
  const setUser = useAuthStore((s) => s.setUser)
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/projects'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { accessToken } = await login(username, password)
      setToken(accessToken) // me() 依赖拦截器注入的 token
      const user = await me()
      setUser(user, accessToken)
      navigate(from, { replace: true })
    } catch {
      setError('用户名或密码错误')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = username.trim() !== '' && password !== '' && !loading

  return (
    <div className="flex h-full items-center justify-center bg-canvas">
      <form onSubmit={onSubmit} className="w-80 rounded-lg border border-edge bg-surface p-6 shadow-sm">
        <h1 className="mb-1 text-center text-2xl font-extrabold text-primary">MediaKit</h1>
        <p className="mb-5 text-center text-xs text-neutral-500">登录到工作台</p>
        <div className="mb-3">
          <Input label="用户名" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </div>
        <div className="mb-2">
          <Input label="密码" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
        <Button type="submit" disabled={!canSubmit} className="mt-3 w-full">
          {loading ? '登录中…' : '登录'}
        </Button>
      </form>
    </div>
  )
}
