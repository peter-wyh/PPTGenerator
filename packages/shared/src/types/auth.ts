/**
 * 认证 / 用户类型。前后端共享。
 * 对齐 docs/superpowers/specs/2026-06-30-mediakit-fresh-rewrite-design.md §3.3。
 */

export type Role = 'ADMIN' | 'USER';

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

/** 登录响应：access token 放响应体（前端存内存），refresh 走 httpOnly cookie。 */
export interface LoginResponse {
  user: User;
  accessToken: string;
  /** access token 剩余有效期（秒），供前端调度刷新。 */
  expiresIn: number;
}

export interface AuthSession {
  user: User;
  accessToken: string;
}
