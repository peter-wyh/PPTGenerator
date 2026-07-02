import { api } from './client';
import type { LoginResponse, User } from '@mediakit/shared';

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }).then((r) => r.data),
  me: () => api.get<{ user: User }>('/auth/me').then((r) => r.data.user),
  logout: () => api.post('/auth/logout'),
};
