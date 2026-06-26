# 前端薄 UI（登录 + 项目管理）设计文档

**日期**：2026-06-26
**作者**：ap + Claude（结对设计）
**状态**：设计已确认，待编写实现计划
**视觉参考**：根目录 `ai_studio_code-40.html`（Digchic 邮件编辑器）——取其**视觉 token**，不照搬其邮件编辑器布局
**对应后端**：`docs/superpowers/specs/2026-06-25-ppt-generator-design.md` §5（API）、已交付的 P0 后端

---

## 1. 背景与目标

P0 后端（认证 + 用户管理 + 项目 CRUD）已上线并跑通。本期交付**最小可用前端**：浏览器里能登录、管理项目（新建/重命名/删除/进入），并接通 P0 API 的 token 自动刷新链路。

**不包含画布编辑器**——「进入项目」目前是外壳占位页，编辑器留下一期。

### 1.1 非目标（YAGNI）

- 画布编辑器、拖拽、业务组件、图表（下一期）
- 数据源、导出、分享（P3/P4）
- 注册页（用户由管理员在 `/admin/users` 创建）
- 主题切换、i18n、SSR

---

## 2. 视觉设计语言（取自参考文件）

参考 `ai_studio_code-40.html`（主色品红、白底卡片、聚焦变主色的输入）提取 token，用 Tailwind 主题实现：

| Token | 值 | 用途 |
|---|---|---|
| `primary` | `#FF099E` | 主色（按钮、聚焦边框、强调文字） |
| `primary-hover` | `#d0007b` | 按钮 hover |
| `bg` | `#f2f4f7` | 页面背景 |
| `border` | `#dcdfe6` | 卡片/分隔边框 |
| 卡片 | 白底、`6px` 圆角、`0 0 0 1px border` + 轻阴影 | 容器 |
| 输入框 | `8px` 内边距、`#ddd` 边框、`4px` 圆角、聚焦边框=主色 | 表单 |
| 按钮 | 主色底白字粗体、`4px` 圆角、轻阴影 | 主操作 |
| 字体 | Inter（正文/数据），系统 sans-serif 兜底 | 全局 |

> 参考用纯 CSS + `:root` 变量；本设计用 **TailwindCSS**，在 `tailwind.config` 里把 `colors.primary` 配为上述值，等价复刻视觉但不引入纯 CSS 维护负担。

---

## 3. 技术栈

| 层级 | 技术 |
|---|---|
| 构建 | Vite + React 18 + TypeScript |
| 样式 | TailwindCSS（主题色 `#FF099E`） |
| 状态 | Zustand（auth store） |
| 路由 | React Router v6 |
| 请求 | axios + 自动 refresh 拦截器 |
| 类型 | `@ppt-generator/shared`（type-only，`import type`） |

---

## 4. 目录结构（`apps/web`）

```
apps/web/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts            # dev 代理 /api → http://localhost:3017
├── tailwind.config.ts        # primary = #FF099E
├── postcss.config.js
└── src/
    ├── main.tsx              # 挂载 + RouterProvider
    ├── index.css             # Tailwind 指令 + Inter
    ├── router.tsx            # 路由表 + 守卫
    ├── api/
    │   ├── client.ts         # axios 实例 + 401 refresh 拦截器
    │   ├── auth.ts           # login / refresh / logout / me
    │   └── projects.ts       # list / create / update / remove
    ├── stores/
    │   └── auth.ts           # Zustand: user, login, logout, setUser
    ├── components/
    │   ├── Layout.tsx        # 顶栏（Logo + 用户名 + 登出）+ Outlet
    │   ├── Button.tsx        # 主色按钮（变体）
    │   ├── Input.tsx         # 受控输入
    │   └── ConfirmDialog.tsx # 删除确认
    ├── routes/
    │   ├── Login.tsx
    │   ├── Projects.tsx      # 列表 + 新建/重命名/删除
    │   └── ProjectShell.tsx  # /projects/:id 占位外壳
    └── types/express.d.ts    # （无；前端不需要）
```

---

## 5. 页面与路由

| 路径 | 公开? | 内容 |
|---|---|---|
| `/login` | ✅ 公开 | 居中卡片：用户名 + 密码 + 主色「登录」按钮；失败提示；成功跳 `/projects` |
| `/projects` | 🔒 受保护 | 顶栏 + 项目卡片网格（名称、更新时间、进入/重命名/删除）+ 右上「新建项目」 |
| `/projects/:id` | 🔒 受保护 | 外壳：项目名、`1280×720`、页数、占位「🎨 编辑器即将上线（下一期）」+ 返回列表 |
| `/` | — | 重定向 `/projects` |

**守卫**：`<ProtectedRoute>` 读取 auth store；无 `user` → `<Navigate to="/login" state={{from}} />`。登录成功后回到 `from`。

**登出**：顶栏按钮 → `POST /auth/logout`（清 httpOnly refresh cookie）→ 清 store → 跳 `/login`。

---

## 6. 状态与数据流

### 6.1 auth store（Zustand）

```ts
interface AuthState {
  user: { id: string; username: string; role: Role } | null
  accessToken: string | null
  setUser: (user, token) => void
  clear: () => void
}
```

- access token 存**内存**（store）；不落 localStorage（防 XSS 盗取）
- refresh token 在 **httpOnly cookie**，浏览器跨请求自动携带；前端 JS 读不到
- **刷新页面恢复 session**：app 初始化时，内存 token 已丢 → 调 `POST /auth/refresh`（靠 cookie）→ 拿新 access 写回 store → 调 `GET /auth/me` 恢复 `user`；refresh 失败 → 保持未登录（路由守卫自然跳 `/login`）

### 6.2 axios 实例 + 自动 refresh

`api/client.ts`：
- 请求拦截：`config.headers.Authorization = 'Bearer ' + accessToken`（从 store 读）
- 响应拦截：收到 401 → 调 `POST /auth/refresh`（带 cookie）→ 拿新 access 写回 store → 用**原请求**重试一次；重试仍 401 或 refresh 本身失败 → `clear()` + `window.location = '/login'`
- 并发去重：refresh 进行中时，后续 401 请求挂起在同一个 refresh Promise 上，避免多次刷新

---

## 7. API 对接（P0 端点）

| 动作 | 方法 + 路径 | 说明 |
|---|---|---|
| 登录 | `POST /auth/login` | body `{username,password}` → `{accessToken}` + Set-Cookie refresh |
| 刷新 | `POST /auth/refresh` | 用 cookie 换新 access |
| 登出 | `POST /auth/logout` | 拉黑 refresh |
| 当前用户 | `GET /auth/me` | `{id,username,role}` |
| 项目列表 | `GET /projects` | 不带 pages JSON |
| 新建 | `POST /projects` | `{name}` → 含 3 空页 |
| 重命名 | `PATCH /projects/:id` | `{name}` |
| 删除 | `DELETE /projects/:id` | |

---

## 8. 错误处理

- **登录失败**（401 `INVALID_CREDENTIALS`）：表单下红字「用户名或密码错误」
- **403**（非 admin 误入管理页等，本期主要不出现）：toast「无权限」
- **网络/5xx**：toast「服务异常，请重试」
- **自动 refresh 失败**：静默跳 `/login`
- 表单校验：用户名/密码非空（前端禁用提交按钮直到填写）

---

## 9. 测试

- **单元（vitest）**：auth store 的 setUser/clear；axios refresh 拦截器（mock 401→refresh→retry，用 `msw` 或 axios `mockAdapter`）
- **组件（@testing-library/react）**：`Login` 失败提示、`Projects` 渲染列表项、`ProtectedRoute` 重定向
- **不写 E2E**：薄 UI 手动冒烟即可（登录→新建→重命名→删除→登出）；Playwright 留到编辑器期

---

## 10. 不在范围（显式留后续）

- 画布编辑器、拖拽、基础/业务组件、图表 → 下一期（P1 编辑器）
- 数据源上传/API、组件 binding → P3
- PDF 导出、分享链接 → P4
- 管理员用户管理 UI（`/admin/users`）→ 可选后续（后端已具备）

---

## 11. 待定（实现阶段决定）

- 项目列表展示形态：卡片网格 vs 表格（倾向卡片网格，贴合参考的卡片视觉）
- 删除确认：原生 `confirm()` vs 自定义 `ConfirmDialog` 组件（倾向组件，视觉一致）
- 加载/空态插画（先文字态）
