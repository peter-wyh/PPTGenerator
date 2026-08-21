import { create } from 'zustand';
import { authApi } from '@/api/auth';
import { setAccessToken, onUnauthorized } from '@/api/client';
import type { User } from '@mediakit/shared';
import type { AxiosError } from 'axios';

export type AuthStatus = 'idle' | 'loading' | 'authed' | 'guest';

/**
 * 登录失败文案分型：
 * - 429 限流 → 明确告知等待时长（server loginLimiter 10 次/5 分钟/IP）。
 *   之前一律显示「邮箱或密码错误」，用户会继续重试 → 加重限流 → 死循环。
 * - 401 凭据错误 → 原文案。
 * - 其他（网络/5xx）→ 不误导用户改密码。
 */
function describeLoginError(e: unknown): string {
  const status = (e as AxiosError<{ error?: string; message?: string }>)?.response?.status;
  if (status === 429) return '尝试次数过多，已被临时限流，请 5 分钟后再试';
  if (status === 401) return '邮箱或密码错误';
  return '登录服务暂时不可用，请稍后再试（若持续出现请联系管理员）';
}

interface AuthState {
  user: User | null;
  status: AuthStatus;
  /** 登录错误信息（仅 login 表单展示）。 */
  loginError: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  restore: () => Promise<void>;
  logout: () => Promise<void>;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'idle',
  loginError: null,

  async login(email, password) {
    try {
      const res = await authApi.login(email, password);
      setAccessToken(res.accessToken);
      set({ user: res.user, status: 'authed', loginError: null });
      return true;
    } catch (e) {
      set({ loginError: describeLoginError(e) });
      return false;
    }
  },

  /** 刷新页面后从 refresh cookie 恢复会话：调 /me，401 时拦截器自动 refresh。 */
  async restore() {
    set({ status: 'loading' });
    try {
      const user = await authApi.me();
      set({ user, status: 'authed' });
    } catch {
      setAccessToken(null);
      set({ user: null, status: 'guest' });
    }
  },

  async logout() {
    try {
      await authApi.logout();
    } catch {
      /* ignore */
    }
    setAccessToken(null);
    set({ user: null, status: 'guest' });
  },

  clear() {
    setAccessToken(null);
    set({ user: null, status: 'guest' });
  },
}));

// refresh 失败 → 清会话（client 通过回调通知，避免循环依赖）。
onUnauthorized(() => useAuthStore.getState().clear());
