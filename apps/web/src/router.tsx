import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import Login from './routes/Login'
import Projects from './routes/Projects'
import ProjectShell from './routes/ProjectShell'
import { useAuthStore } from './stores/auth'
import { refresh } from './api/auth'

function ProtectedRoute() {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

// 刷新页面后恢复 session：用 cookie 调 refresh 拿新 access，再写回 store。
// 失败则忽略（ProtectedRoute 会自然重定向到登录）。
async function rootLoader() {
  const store = useAuthStore.getState()
  if (store.user) return null
  try {
    const { accessToken } = await refresh()
    const res = await fetch('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (res.ok) {
      const user = await res.json()
      store.setUser(user, accessToken)
    }
  } catch {
    // 未登录，忽略
  }
  return null
}

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    loader: rootLoader,
    element: <Layout />,
    children: [
      { element: <ProtectedRoute />, children: [
        { index: true, element: <Navigate to="/projects" replace /> },
        { path: 'projects', element: <Projects /> },
        { path: 'projects/:id', element: <ProjectShell /> },
      ]},
    ],
  },
])
