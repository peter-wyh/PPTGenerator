import { create } from 'zustand';
import { authApi } from '@/api/auth';
import { setAccessToken, onUnauthorized } from '@/api/client';
import type { User } from '@mediakit/shared';

export type AuthStatus = 'idle' | 'loading' | 'authed' | 'guest';

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
    } catch {
      set({ loginError: '邮箱或密码错误' });
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
