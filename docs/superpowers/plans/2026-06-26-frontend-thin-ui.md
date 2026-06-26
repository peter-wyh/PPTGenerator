# 前端薄 UI（登录 + 项目管理）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `apps/web` 搭起 Vite + React + TS + Tailwind 前端，交付登录页 + 项目列表（新建/重命名/删除/进入占位）+ 受保护路由 + axios 自动 refresh，浏览器里能登录管项目并接通 P0 后端。

**Architecture:** 单页应用，Zustand 管 auth（access token 内存 + refresh httpOnly cookie）。axios 实例经 `authBridge`（避免与 store 循环依赖）注入 token、401 自动 refresh+重试。视觉 token 取自 `ai_studio_code-40.html`（主色 `#FF099E`）。Vite dev 把 `/api` 代理到后端。

**Tech Stack:** Vite · React 18 · TypeScript · TailwindCSS · Zustand · React Router v6 · axios · vitest · @testing-library/react · axios-mock-adapter。

**对应 spec：** `docs/superpowers/specs/2026-06-26-frontend-thin-ui-design.md`。**不在范围**：画布编辑器、业务组件、图表（下一期）/ 数据源、导出、分享（P3/P4）。

---

## 前置条件

- P0 后端可跑（已交付；本机 dev server 在 `:3017`，见 `apps/server/.env` 的 `PORT`）。
- pnpm workspace 已含 `apps/*`（`pnpm-workspace.yaml`）。
- **建议在独立分支执行**（`git checkout -b frontend-thin-ui`），不在 `main` 上写代码。

## File Structure

| 路径 | 类型 | 职责 |
|---|---|---|
| `apps/web/package.json` | 新建 | 清单 + 依赖 + 脚本 |
| `apps/web/index.html` | 新建 | Vite 入口 HTML |
| `apps/web/vite.config.ts` | 新建 | react 插件 + `/api` 代理 → `:3017` + vitest 配置 |
| `apps/web/tsconfig.json` | 新建 | Vite TS 配置（ESNext/Bundler） |
| `apps/web/tsconfig.node.json` | 新建 | vite.config 自身类型 |
| `apps/web/tailwind.config.ts` | 新建 | 主题色 `primary=#FF099E` |
| `apps/web/postcss.config.js` | 新建 | tailwindcss + autoprefixer |
| `apps/web/src/main.tsx` | 新建 | 挂载 RouterProvider |
| `apps/web/src/index.css` | 新建 | Tailwind 指令 + Inter |
| `apps/web/src/App.tsx` | 新建 | 根组件（占位，Task 1） |
| `apps/web/src/api/authBridge.ts` | 新建 | 解 client↔store 循环依赖的可变桥 |
| `apps/web/src/api/client.ts` | 新建 | axios 实例 + 请求注入 + 401 refresh+重试（去重） |
| `apps/web/src/api/auth.ts` | 新建 | login / refresh / logout / me |
| `apps/web/src/api/projects.ts` | 新建 | list / create / update / getOne / remove |
| `apps/web/src/stores/auth.ts` | 新建 | Zustand auth store，挂载 bridge |
| `apps/web/src/components/{Button,Input,Layout,ConfirmDialog}.tsx` | 新建 | 通用 UI |
| `apps/web/src/routes/{Login,Projects,ProjectShell}.tsx` | 新建 | 三个页面 |
| `apps/web/src/router.tsx` | 新建 | 路由表 + ProtectedRoute |
| `apps/web/tests/{setup,helpers}.ts` | 新建 | jest-dom + 测试工具 |
| `apps/web/tests/**/*.test.tsx` | 新建 | 单测/组件测 |
| `packages/shared/src/index.ts` | 修改 | 补 `ProjectDetail`，校正 `ProjectSummary` |

---

## Task 1: apps/web 脚手架（Vite + React + TS + Tailwind + 测试基座）

**Files:**
- Create: `apps/web/package.json`、`index.html`、`vite.config.ts`、`tsconfig.json`、`tsconfig.node.json`、`tailwind.config.ts`、`postcss.config.js`、`src/main.tsx`、`src/index.css`、`src/App.tsx`
- Create: `apps/web/tests/setup.ts`、`apps/web/tests/smoke.test.tsx`
- Modify: `packages/shared/src/index.ts`（补/校正项目类型）

- [ ] **Step 1: 创建 `apps/web/package.json`（先写框架，依赖 Step 4 装）**

```json
{
  "name": "@ppt-generator/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -b --noEmit",
    "test": "vitest run"
  }
}
```

- [ ] **Step 2: 创建 `apps/web/index.html`**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MediaKit</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: 创建 `apps/web/vite.config.ts`（含 vitest + jsdom + 代理）**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3017',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
})
```

> 代理 target `:3017` 对齐 `apps/server/.env` 的 `PORT`（本机覆盖值）；canonical 默认是 3001，他机改此处。

- [ ] **Step 4: 创建 `apps/web/tsconfig.json` 与 `tsconfig.node.json`**

`tsconfig.json`：
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "tests"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`tsconfig.node.json`：
```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: 创建 `apps/web/tailwind.config.ts`（主色 `#FF099E`）与 `postcss.config.js`**

`tailwind.config.ts`：
```ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FF099E',
          hover: '#d0007b',
        },
        surface: '#ffffff',
        canvas: '#f2f4f7',
        edge: '#dcdfe6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
```

`postcss.config.js`：
```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 6: 创建 `apps/web/src/index.css`（Tailwind 指令 + Inter）**

```css
@import url('https://rsms.me/inter/inter.css');
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
body { @apply bg-canvas text-neutral-800 font-sans; }
```

- [ ] **Step 7: 创建 `apps/web/src/App.tsx`（占位）与 `src/main.tsx`**

`src/App.tsx`：
```tsx
export default function App() {
  return (
    <div className="flex h-full items-center justify-center">
      <h1 className="text-3xl font-bold text-primary">MediaKit</h1>
    </div>
  )
}
```

`src/main.tsx`：
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 8: 创建 `apps/web/tests/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 9: 校正 `packages/shared/src/index.ts` 的项目类型**

把 `ProjectSummary` 改为与后端 `GET /projects` 一致，并新增 `ProjectDetail`：

```ts
export interface ProjectSummary {
  id: string
  name: string
  canvasWidth: number
  canvasHeight: number
  userId: string
  updatedAt: string
}

export interface ProjectPage {
  id: string
  name: string
  components: unknown[]
}

export interface ProjectDetail {
  id: string
  userId: string
  name: string
  canvasWidth: number
  canvasHeight: number
  pages: ProjectPage[]
  createdAt: string
  updatedAt: string
}
```

> `UpdateProjectRequest` 等已有类型不动。后端 P0 代码无需改（类型仅前后端契约）。

- [ ] **Step 10: 安装依赖（仓库根运行）**

```bash
pnpm --filter @ppt-generator/web add react@^18 react-dom@^18 react-router-dom@^6 axios@^1 zustand@^4 @ppt-generator/shared
pnpm --filter @ppt-generator/web add -D vite@^5 @vitejs/plugin-react@^4 typescript@^5 tailwindcss@^3 postcss@^8 autoprefixer@^10 vitest@^2 @testing-library/react@^16 @testing-library/jest-dom@^6 @testing-library/user-event@^14 jsdom@^25 axios-mock-adapter@^2 @types/react@^18 @types/react-dom@^18
```
预期：均成功；`pnpm-lock.yaml` 更新；`@ppt-generator/shared` 在 web 的 dependencies 中为 `workspace:*`（若不是，手动改 `package.json` 加 `"@ppt-generator/shared": "workspace:*"` 后 `pnpm install`）。

- [ ] **Step 11: 写冒烟测试 `apps/web/tests/smoke.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../src/App'

describe('App', () => {
  it('renders the brand', () => {
    render(<App />)
    expect(screen.getByText('MediaKit')).toBeInTheDocument()
  })
})
```

- [ ] **Step 12: 运行测试确认通过**

运行：`pnpm --filter @ppt-generator/web test`
预期：`1 passed`。

- [ ] **Step 13: 起 dev 冒烟（手动）**

运行：`pnpm --filter @ppt-generator/web dev`
浏览器开 `http://localhost:5173`，预期看到品红色「MediaKit」。然后停掉。

- [ ] **Step 14: 提交**

```bash
git add apps/web packages/shared/src/index.ts pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(web): vite+react+ts+tailwind scaffold + test harness

apps/web with primary #FF099E theme, /api proxy to backend, vitest+
jsdom+testing-library. shared: align ProjectSummary with backend list
response, add ProjectDetail/ProjectPage.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: API client + authBridge + 401 自动 refresh 拦截器

**Files:**
- Create: `apps/web/src/api/authBridge.ts`、`apps/web/src/api/client.ts`
- Create: `apps/web/tests/client.test.ts`

- [ ] **Step 1: 创建 `apps/web/src/api/authBridge.ts`（解循环依赖的可变桥）**

```ts
// client.ts 不直接 import store（store import client），用桥解耦。
export interface AuthFns {
  getAccessToken: () => string | null
  setAccessToken: (token: string) => void
  clear: () => void
}

export const authBridge: { fns: AuthFns | null } = { fns: null }

export function setAuthFns(fns: AuthFns) {
  authBridge.fns = fns
}
```

- [ ] **Step 2: 写失败测试 `apps/web/tests/client.test.ts`**

```tsx
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
    mock.onGet('/projects').reply((cfg) => [200, { ok: cfg.headers.Authorization === 'Bearer access-1' }])
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
```

- [ ] **Step 3: 运行测试确认失败**

运行：`pnpm --filter @ppt-generator/web test client`
预期：FAIL（`api`/`doRefresh` 未导出）。

- [ ] **Step 4: 创建 `apps/web/src/api/client.ts`**

```ts
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { authBridge } from './authBridge'

export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true, // 携带 refresh 的 httpOnly cookie
})

// 用原生 axios 调 refresh，避免再触发本实例的拦截器（防递归）
export async function doRefresh(): Promise<string | null> {
  try {
    const res = await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true })
    return (res.data as { accessToken: string }).accessToken
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
```

- [ ] **Step 5: 运行测试确认通过**

运行：`pnpm --filter @ppt-generator/web test client`
预期：4 passed。

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/api/authBridge.ts apps/web/src/api/client.ts apps/web/tests/client.test.ts
git commit -m "$(cat <<'EOF'
feat(web): axios client with 401 auto-refresh + retry (deduped)

authBridge breaks the client<->store cycle; request interceptor injects
bearer; response interceptor refreshes once (shared promise) and retries,
clears auth on refresh failure. /auth/* calls bypass the retry.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

## Task 3: auth store + API 模块（auth/projects）

**Files:**
- Create: `apps/web/src/stores/auth.ts`、`apps/web/src/api/auth.ts`、`apps/web/src/api/projects.ts`
- Create: `apps/web/tests/authStore.test.ts`

- [ ] **Step 1: 写失败测试 `apps/web/tests/authStore.test.ts`**

```tsx
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
```

- [ ] **Step 2: 运行测试确认失败**

运行：`pnpm --filter @ppt-generator/web test authStore`
预期：FAIL（store 未导出）。

- [ ] **Step 3: 创建 `apps/web/src/stores/auth.ts`（Zustand + 挂 bridge）**

```ts
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
```

- [ ] **Step 4: 运行测试确认通过**

运行：`pnpm --filter @ppt-generator/web test authStore`
预期：3 passed。

- [ ] **Step 5: 创建 `apps/web/src/api/auth.ts`**

```ts
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
  const res = await api.post<UserPublic>('/auth/me', {}) // Task 7 改回 GET
  return res.data
}
```

> 后端 `/auth/me` 是 `GET`；此处临时用 POST 仅为占位，**Task 7 改回 `api.get('/auth/me')`**。避免遗忘——Task 7 会显式覆盖。

- [ ] **Step 6: 创建 `apps/web/src/api/projects.ts`**

```ts
import { api } from './client'
import type { ProjectSummary, ProjectDetail } from '@ppt-generator/shared'

export async function listProjects(): Promise<ProjectSummary[]> {
  const res = await api.get<{ projects: ProjectSummary[] }>('/projects')
  return res.data.projects
}

export async function createProject(name: string): Promise<ProjectDetail> {
  const res = await api.post<{ project: ProjectDetail }>('/projects', { name })
  return res.data.project
}

export async function getProject(id: string): Promise<ProjectDetail> {
  const res = await api.get<{ project: ProjectDetail }>(`/projects/${id}`)
  return res.data.project
}

export async function updateProject(id: string, patch: { name?: string }): Promise<ProjectSummary> {
  const res = await api.patch<{ project: ProjectSummary }>(`/projects/${id}`, patch)
  return res.data.project
}

export async function deleteProject(id: string): Promise<void> {
  await api.delete(`/projects/${id}`)
}
```

- [ ] **Step 7: 提交**

```bash
git add apps/web/src/stores/auth.ts apps/web/src/api/auth.ts apps/web/src/api/projects.ts apps/web/tests/authStore.test.ts
git commit -m "$(cat <<'EOF'
feat(web): auth store (zustand) + auth/projects API modules

Store holds user + accessToken (memory), wires read/write/clear into
authBridge at init. auth.ts + projects.ts wrap the P0 endpoints.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 通用 UI 组件（Button / Input / Layout / ConfirmDialog）

**Files:**
- Create: `apps/web/src/components/Button.tsx`、`Input.tsx`、`Layout.tsx`、`ConfirmDialog.tsx`

- [ ] **Step 1: 创建 `apps/web/src/components/Button.tsx`（主色 + 变体）**

```tsx
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'ghost' | 'danger'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover shadow-sm',
  ghost: 'bg-transparent text-neutral-600 hover:bg-neutral-100',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
}

export function Button({ variant = 'primary', className = '', ...rest }: Props) {
  return (
    <button
      {...rest}
      className={`rounded px-4 py-2 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    />
  )
}
```

- [ ] **Step 2: 创建 `apps/web/src/components/Input.tsx`**

```tsx
import { forwardRef, type InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input({ label, className = '', ...rest }, ref) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-xs text-neutral-500">{label}</span>}
      <input
        ref={ref}
        {...rest}
        className={`w-full rounded border border-neutral-300 bg-white px-2 py-2 text-sm outline-none focus:border-primary ${className}`}
      />
    </label>
  )
})
```

- [ ] **Step 3: 创建 `apps/web/src/components/Layout.tsx`（顶栏 + Outlet）**

```tsx
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
```

- [ ] **Step 4: 创建 `apps/web/src/components/ConfirmDialog.tsx`（受控确认弹窗）**

```tsx
interface Props {
  open: boolean
  title: string
  message: string
  confirmText?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, title, message, confirmText = '确认', onConfirm, onCancel }: Props) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onCancel}>
      <div className="w-80 rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-2 text-base font-bold">{title}</h3>
        <p className="mb-4 text-sm text-neutral-600">{message}</p>
        <div className="flex justify-end gap-2">
          <button className="rounded px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100" onClick={onCancel}>取消</button>
          <button className="rounded bg-primary px-3 py-1.5 text-sm font-bold text-white hover:bg-primary-hover" onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/components
git commit -m "$(cat <<'EOF'
feat(web): shared UI components (Button/Input/Layout/ConfirmDialog)

Primary-themed button variants, focus-bordered Input, Layout top bar
(brand + username + logout), controlled ConfirmDialog.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

## Task 5: 登录页 `/login`

**Files:**
- Create: `apps/web/src/routes/Login.tsx`

- [ ] **Step 1: 创建 `apps/web/src/routes/Login.tsx`**

```tsx
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
```

- [ ] **Step 2: 提交**

```bash
git add apps/web/src/routes/Login.tsx
git commit -m "$(cat <<'EOF'
feat(web): /login page (centered card, error feedback)

Username+password, primary submit button, 401 → inline error, redirect
to `from` (or /projects) on success. Token set before me() so the
interceptor injects the bearer.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 项目列表页 `/projects`

**Files:**
- Create: `apps/web/src/routes/Projects.tsx`
- Create: `apps/web/tests/projects.test.tsx`

- [ ] **Step 1: 创建 `apps/web/src/routes/Projects.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ProjectSummary } from '@ppt-generator/shared'
import { listProjects, createProject, updateProject, deleteProject } from '../api/projects'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { ConfirmDialog } from '../components/ConfirmDialog'

export default function Projects() {
  const navigate = useNavigate()
  const [items, setItems] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      setItems(await listProjects())
    } catch {
      setError('加载项目失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function onCreate() {
    const name = newName.trim()
    if (!name) return
    const p = await createProject(name)
    setNewName('')
    setCreating(false)
    setItems((prev) => [p, ...prev.filter((x) => x.id !== p.id)])
  }

  async function onRename() {
    if (!renameId) return
    const name = renameVal.trim()
    if (!name) return
    await updateProject(renameId, { name })
    setItems((prev) => prev.map((x) => (x.id === renameId ? { ...x, name } : x)))
    setRenameId(null)
  }

  async function onDelete() {
    if (!deleteId) return
    await deleteProject(deleteId)
    setItems((prev) => prev.filter((x) => x.id !== deleteId))
    setDeleteId(null)
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">我的项目</h1>
        <Button onClick={() => setCreating(true)}>+ 新建项目</Button>
      </div>

      {creating && (
        <div className="mb-4 flex gap-2 rounded-lg border border-edge bg-surface p-3">
          <Input className="flex-1" placeholder="项目名称" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button onClick={onCreate} disabled={!newName.trim()}>创建</Button>
          <Button variant="ghost" onClick={() => setCreating(false)}>取消</Button>
        </div>
      )}

      {loading && <p className="text-sm text-neutral-500">加载中…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p className="text-sm text-neutral-500">还没有项目，点「新建项目」创建第一个。</p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <div key={p.id} className="rounded-lg border border-edge bg-surface p-4 shadow-sm">
            {renameId === p.id ? (
              <div className="flex gap-2">
                <Input className="flex-1" value={renameVal} onChange={(e) => setRenameVal(e.target.value)} autoFocus />
                <Button onClick={onRename} disabled={!renameVal.trim()}>保存</Button>
                <Button variant="ghost" onClick={() => setRenameId(null)}>取消</Button>
              </div>
            ) : (
              <>
                <button className="block w-full text-left" onClick={() => navigate(`/projects/${p.id}`)}>
                  <div className="truncate font-bold text-neutral-800">{p.name}</div>
                  <div className="mt-1 text-xs text-neutral-500">
                    {p.canvasWidth}×{p.canvasHeight} · 更新 {new Date(p.updatedAt).toLocaleString()}
                  </div>
                </button>
                <div className="mt-3 flex gap-2">
                  <Button variant="ghost" onClick={() => { setRenameId(p.id); setRenameVal(p.name) }}>重命名</Button>
                  <Button variant="danger" onClick={() => setDeleteId(p.id)}>删除</Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        title="删除项目"
        message="确认删除该项目？此操作不可撤销。"
        confirmText="删除"
        onConfirm={onDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
```

- [ ] **Step 2: 写测试 `apps/web/tests/projects.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import MockAdapter from 'axios-mock-adapter'
import { MemoryRouter } from 'react-router-dom'
import { api } from '../src/api/client'
import { initAuthBridge } from '../src/stores/auth'
import Projects from '../src/routes/Projects'

function renderProjects() {
  return render(
    <MemoryRouter>
      <Projects />
    </MemoryRouter>,
  )
}

describe('Projects page', () => {
  let mock: MockAdapter
  beforeEach(() => {
    mock = new MockAdapter(api)
    initAuthBridge()
  })

  it('renders project cards from the API', async () => {
    mock.onGet('/projects').reply(200, {
      projects: [
        { id: 'p1', name: 'Q4 复盘', canvasWidth: 1280, canvasHeight: 720, userId: 'u', updatedAt: '2026-06-26T10:00:00.000Z' },
      ],
    })
    renderProjects()
    await waitFor(() => expect(screen.getByText('Q4 复盘')).toBeInTheDocument())
    expect(screen.getByText(/1280×720/)).toBeInTheDocument()
  })

  it('shows empty state when no projects', async () => {
    mock.onGet('/projects').reply(200, { projects: [] })
    renderProjects()
    await waitFor(() => expect(screen.getByText(/还没有项目/)).toBeInTheDocument())
  })

  it('shows error on failure', async () => {
    mock.onGet('/projects').reply(500)
    renderProjects()
    await waitFor(() => expect(screen.getByText(/加载项目失败/)).toBeInTheDocument())
  })
})
```

- [ ] **Step 3: 运行测试确认通过**

运行：`pnpm --filter @ppt-generator/web test projects`
预期：3 passed。

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/routes/Projects.tsx apps/web/tests/projects.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): /projects page (list + create + rename + delete)

Card grid with new/rename inline + delete confirm dialog; empty/error/
loading states. Covered by testing-library tests against a mocked axios.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 项目外壳页 + 路由表 + session 恢复 + /auth/me 改 GET + 全量验证

**Files:**
- Create: `apps/web/src/routes/ProjectShell.tsx`、`apps/web/src/router.tsx`
- Modify: `apps/web/src/main.tsx`（挂 RouterProvider + 初始化 bridge + session 恢复）
- Modify: `apps/web/src/api/auth.ts`（`me()` 改回 `GET`）
- Modify: `apps/web/src/App.tsx`（删除占位，Task 1 的冒烟测试随之失效——见 Step 6）

- [ ] **Step 1: 创建 `apps/web/src/routes/ProjectShell.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import type { ProjectDetail } from '@ppt-generator/shared'
import { getProject } from '../api/projects'
import { Button } from '../components/Button'

export default function ProjectShell() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    getProject(id).then(setProject).catch(() => setError('项目不存在或无权访问'))
  }, [id])

  if (error) return <div className="p-6 text-red-600">{error}</div>
  if (!project) return <div className="p-6 text-neutral-500">加载中…</div>

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link to="/projects" className="text-sm text-primary hover:underline">← 返回项目列表</Link>
      <h1 className="mt-2 text-2xl font-bold">{project.name}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        画布 {project.canvasWidth}×{project.canvasHeight} · 共 {project.pages.length} 页
      </p>
      <div className="mt-8 rounded-lg border border-dashed border-edge bg-surface p-10 text-center text-neutral-500">
        🎨 编辑器即将上线（下一期）
      </div>
      <div className="mt-4">
        <Button disabled>进入编辑器</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 创建 `apps/web/src/router.tsx`（路由表 + ProtectedRoute + session 恢复 loader）**

```tsx
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom'
import type { LoaderFunctionArgs } from 'react-router-dom'
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
```

> `rootLoader` 用原生 `fetch` 调 `/auth/me`（避免 `me()` 依赖 store token 的先后问题，token 刚拿到）。refresh 用 `api/auth.ts` 的 `refresh()`（走原生 axios，不带拦截器）。

- [ ] **Step 3: 把 `me()` 改回 `GET`（修 Task 3 的占位）**

把 `apps/web/src/api/auth.ts` 的 `me` 函数改为：

```ts
export async function me(): Promise<UserPublic> {
  const res = await api.get<UserPublic>('/auth/me')
  return res.data
}
```

- [ ] **Step 4: 更新 `apps/web/src/main.tsx`（挂 router + 初始化 bridge）**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { initAuthBridge } from './stores/auth'
import './index.css'

initAuthBridge()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
```

- [ ] **Step 5: 删除占位 `apps/web/src/App.tsx` 与冒烟测试**

```bash
rm apps/web/src/App.tsx apps/web/tests/smoke.test.tsx
```

> `App.tsx` 已被 `router` 取代。冒烟测试引用的 `App` 不复存在，删掉（Task 6 的 `projects.test.tsx` 已覆盖组件渲染）。

- [ ] **Step 6: 全量测试 + 类型检查 + 构建**

运行：`pnpm --filter @ppt-generator/web test`
预期：全部通过（client 4 + authStore 3 + projects 3 = 10 passed）。

运行：`pnpm --filter @ppt-generator/web typecheck`
预期：0 错误。

运行：`pnpm --filter @ppt-generator/web build`
预期：生成 `apps/web/dist/`，退出码 0。

- [ ] **Step 7: dev 联调冒烟（后端要在 `:3017` 运行）**

确保后端起着（`pnpm --filter @ppt-generator/server dev` 或已在后台）。运行：`pnpm --filter @ppt-generator/web dev`，浏览器开 `http://localhost:5173`：
1. 自动跳 `/login`（未登录）。
2. 用 `admin / admin123` 登录 → 跳 `/projects`。
3. 新建「测试项目」→ 卡片出现。
4. 重命名 → 名称更新；删除 → 确认后消失。
5. 点项目 → `/projects/:id` 外壳页（画布信息 + 占位）。
6. 顶栏「登出」→ 回 `/login`；刷新 `/projects` 页（已登录）应通过 refresh 恢复 session。
然后停掉 dev。

- [ ] **Step 8: 提交**

```bash
git add apps/web/src/routes/ProjectShell.tsx apps/web/src/router.tsx apps/web/src/main.tsx apps/web/src/api/auth.ts apps/web/src/App.tsx apps/web/tests/smoke.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): routes + session restore + project shell

Router with ProtectedRoute; root loader restores session via cookie
refresh + /auth/me on reload; ProjectShell placeholder (editor next
phase). me() fixed to GET. App.tsx/smoke test removed (router replaces).

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**1. Spec 覆盖检查**（对照 `2026-06-26-frontend-thin-ui-design.md`）：
- ✅ §2 视觉 token（primary #FF099E / 卡片 / 输入 / 按钮 / Inter）→ Task 1 tailwind.config + Task 4 组件
- ✅ §3 技术栈（Vite/React/TS/Tailwind/Zustand/React Router/axios）→ Task 1/3/4/7
- ✅ §4 目录结构 → 全部文件 Task 1–7 覆盖
- ✅ §5 页面与路由（/login、/projects、/projects/:id、/ 重定向、守卫、登出）→ Task 5/6/7
- ✅ §6 状态与数据流（Zustand + 内存 token + cookie refresh + 页面刷新恢复）→ Task 3 + Task 7 rootLoader
- ✅ §6.2 axios 自动 refresh（去重 + 重试 + clear）→ Task 2
- ✅ §7 API 对接 → Task 3 auth.ts/projects.ts
- ✅ §8 错误处理（登录 401 红字、加载失败 toast/红字、refresh 失败跳登录）→ Task 5/6/2
- ✅ §9 测试（store 单测、axios 拦截器、组件测）→ Task 2/3/6；不写 E2E（手动冒烟 Task 7 Step 7）
- ✅ §10 不在范围（编辑器等）显式排除；§11 待定项（卡片网格 ✓、ConfirmDialog 组件 ✓、文字空态 ✓）已在 Task 6 决定

**2. 占位符扫描**：无 TBD / TODO / "implement later"。Task 3 的 `me()` POST 占位在 Task 7 Step 3 显式改回 GET 并删除——已闭环，无遗留。

**3. 类型一致性**：
- `AuthUser`（stores/auth.ts）= shared `UserPublic` 形状（id/username/role）。
- `ProjectSummary`/`ProjectDetail` 来自 shared（Task 1 Step 9 校正），API 模块（Task 3）与页面（Task 6/7）引用一致。
- `setToken` 在 store（Task 3）与 Login（Task 5）一致。
- `authBridge.AuthFns`（getAccessToken/setAccessToken/clear）在 authBridge（Task 2）、store initAuthBridge（Task 3）、client 拦截器（Task 2）三处引用一致。
- `refresh()`（api/auth.ts）与 rootLoader（Task 7）一致；`doRefresh()`（api/client.ts，原生 axios）仅拦截器内部用。

**4. 已知范围裁剪（显式，非遗漏）**：编辑器/业务组件/图表（下一期）、数据源（P3）、导出/分享（P4）、管理员用户管理 UI（可选后续）。

**5. 风险与对策**：
- 循环依赖（client↔store）→ authBridge 桥（Task 2）。
- refresh 并发重复请求 → 共享 `refreshPromise`（Task 2）。
- me() 在 token 写入前调用 → Login 先 `setToken` 再 `me`（Task 5）；rootLoader 用原生 fetch 带 token（Task 7）。
- Tailwind v4（JIT 配置差异）→ 计划锁 `tailwindcss@^3` + `postcss.config.js`（Task 1 Step 5/10），避免 v4 的 CSS-first 配置。
