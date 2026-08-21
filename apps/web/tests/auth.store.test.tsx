import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from '@/stores/auth';
import { setAccessToken } from '@/api/client';

const { loginMock, meMock, logoutMock } = vi.hoisted(() => ({
  loginMock: vi.fn(),
  meMock: vi.fn(),
  logoutMock: vi.fn(),
}));

vi.mock('@/api/client', () => ({
  setAccessToken: vi.fn(),
  onUnauthorized: () => () => {},
}));
vi.mock('@/api/auth', () => ({
  authApi: {
    login: (...a: unknown[]) => loginMock(...a),
    me: () => meMock(),
    logout: () => logoutMock(),
  },
}));

const user = {
  id: 'u1',
  email: 'a@x.com',
  name: null,
  role: 'USER' as const,
  createdAt: '',
  updatedAt: '',
};

describe('auth store', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, status: 'idle', loginError: null });
    vi.clearAllMocks();
  });

  it('login success → authed + token set', async () => {
    loginMock.mockResolvedValue({ accessToken: 'AT', user, expiresIn: 900 });
    const ok = await useAuthStore.getState().login('a@x.com', 'pw');
    expect(ok).toBe(true);
    expect(loginMock).toHaveBeenCalledWith('a@x.com', 'pw');
    expect(setAccessToken).toHaveBeenCalledWith('AT');
    expect(useAuthStore.getState().status).toBe('authed');
    expect(useAuthStore.getState().user?.id).toBe('u1');
  });

  it('login failure → loginError, not authed', async () => {
    loginMock.mockRejectedValue(new Error('bad'));
    const ok = await useAuthStore.getState().login('a@x.com', 'pw');
    expect(ok).toBe(false);
    expect(useAuthStore.getState().loginError).toBeTruthy();
    expect(useAuthStore.getState().status).not.toBe('authed');
  });

  it('login 429 限流 → 提示等待而非「密码错误」（防用户继续重试加重限流）', async () => {
    loginMock.mockRejectedValue(
      Object.assign(new Error('Request failed with status code 429'), {
        response: { status: 429, data: { error: 'TOO_MANY_REQUESTS' } },
      }),
    );
    await useAuthStore.getState().login('a@x.com', 'pw');
    expect(useAuthStore.getState().loginError).toContain('限流');
    expect(useAuthStore.getState().loginError).not.toContain('密码错误');
  });

  it('login 401 凭据错误 → 保持「邮箱或密码错误」文案', async () => {
    loginMock.mockRejectedValue(
      Object.assign(new Error('Request failed with status code 401'), {
        response: { status: 401, data: { error: 'INVALID_CREDENTIALS' } },
      }),
    );
    await useAuthStore.getState().login('a@x.com', 'pw');
    expect(useAuthStore.getState().loginError).toBe('邮箱或密码错误');
  });

  it('login 网络错误/5xx → 服务不可用文案，不误导用户改密码', async () => {
    loginMock.mockRejectedValue(
      Object.assign(new Error('Network Error'), { response: undefined }),
    );
    await useAuthStore.getState().login('a@x.com', 'pw');
    expect(useAuthStore.getState().loginError).not.toContain('密码');
  });

  it('restore success → authed', async () => {
    meMock.mockResolvedValue(user);
    await useAuthStore.getState().restore();
    expect(useAuthStore.getState().status).toBe('authed');
  });

  it('restore failure → guest + token cleared', async () => {
    meMock.mockRejectedValue(new Error('no session'));
    await useAuthStore.getState().restore();
    expect(useAuthStore.getState().status).toBe('guest');
    expect(setAccessToken).toHaveBeenCalledWith(null);
  });

  it('login 响应的 businessLineCode 透传入 store', async () => {
    loginMock.mockResolvedValue({
      user: { ...user, businessLineCode: 'DG' },
      accessToken: 'tok',
      expiresIn: 900,
    });
    await useAuthStore.getState().login('dg@mediakit.local', 'x');
    expect(useAuthStore.getState().user?.businessLineCode).toBe('DG');
  });

  it('logout → guest', async () => {
    logoutMock.mockResolvedValue(undefined);
    useAuthStore.setState({ status: 'authed', user });
    await useAuthStore.getState().logout();
    expect(useAuthStore.getState().status).toBe('guest');
    expect(useAuthStore.getState().user).toBeNull();
  });
});
