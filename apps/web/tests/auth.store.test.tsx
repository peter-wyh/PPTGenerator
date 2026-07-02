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

  it('logout → guest', async () => {
    logoutMock.mockResolvedValue(undefined);
    useAuthStore.setState({ status: 'authed', user });
    await useAuthStore.getState().logout();
    expect(useAuthStore.getState().status).toBe('guest');
    expect(useAuthStore.getState().user).toBeNull();
  });
});
