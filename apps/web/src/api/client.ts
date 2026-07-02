import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

/**
 * axios 单例。
 * - access token 存内存（由 auth store 持有，经 setAccessToken 注入请求头）。
 * - refresh token 走 httpOnly cookie（withCredentials）。
 * - 401 → 自动 refresh（并发去重）→ 重试原请求；refresh 失败 → 通知登出。
 */

let accessToken: string | null = null;
export function setAccessToken(t: string | null): void {
  accessToken = t;
}
export function getAccessToken(): string | null {
  return accessToken;
}

export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
});

api.interceptors.request.use((cfg) => {
  if (accessToken) {
    cfg.headers.Authorization = `Bearer ${accessToken}`;
  }
  return cfg;
});

// refresh 并发去重：同一时刻只发一个 refresh。
let refreshPromise: Promise<string> | null = null;
async function refresh(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = api
    .post<{ accessToken: string }>('/auth/refresh')
    .then((res) => {
      setAccessToken(res.data.accessToken);
      return res.data.accessToken;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

// refresh 失败时通知 auth store 清会话（用回调打破 client ↔ store 循环依赖）。
const unauthorizedListeners = new Set<() => void>();
export function onUnauthorized(fn: () => void): () => void {
  unauthorizedListeners.add(fn);
  return () => unauthorizedListeners.delete(fn);
}
function fireUnauthorized(): void {
  unauthorizedListeners.forEach((fn) => fn());
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const cfg = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const url = cfg?.url ?? '';
    const isLogin = url.startsWith('/auth/login');
    const isRefresh = url.startsWith('/auth/refresh');
    const status = error.response?.status;

    // 普通请求 401：尝试 refresh 后重试一次。
    if (status === 401 && cfg && !cfg._retry && !isLogin && !isRefresh) {
      cfg._retry = true;
      try {
        const token = await refresh();
        cfg.headers!.Authorization = `Bearer ${token}`;
        return api.request(cfg);
      } catch {
        fireUnauthorized();
        return Promise.reject(error);
      }
    }

    // refresh 本身失败：会话失效，通知登出。
    if (status === 401 && isRefresh) {
      fireUnauthorized();
    }

    return Promise.reject(error);
  },
);
