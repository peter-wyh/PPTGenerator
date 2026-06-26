import { Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import { logout } from '../api/auth'
import { Button } from './Button'

export function Layout() {
  const user = useAuthStore((s) => s.user)
  const clear = useAuthStore((s) => s.clear)
  const navigate = useNavigate()

  async function onLogout() {
    try {
      await logout()
    } finally {
      clear()
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-edge bg-surface px-6 py-3">
        <span className="text-lg font-extrabold text-primary">MediaKit</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-neutral-600">{user?.username}</span>
          <Button variant="ghost" onClick={onLogout}>登出</Button>
        </div>
      </header>
      <main className="flex-1 overflow-auto bg-canvas">
        <Outlet />
      </main>
    </div>
  )
}
