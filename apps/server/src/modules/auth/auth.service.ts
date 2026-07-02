import { prisma } from '../../prisma';
import { ApiError } from '../../utils/ApiError';
import { verifyPassword } from '../../utils/hash';
import {
  isRefreshValid,
  newJti,
  registerRefresh,
  revokeRefresh,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from './token';
import type { User } from '@prisma/client';

function toPublicUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

export interface IssueResult {
  user: ReturnType<typeof toPublicUser>;
  accessToken: string;
  expiresIn: number;
  /** 新签发的 refresh token（写入 httpOnly cookie）。 */
  refreshToken: string;
}

async function issueSession(user: User): Promise<IssueResult> {
  const jti = newJti();
  await registerRefresh(jti, user.id);
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(user.id, user.role),
    signRefreshToken(user.id, jti),
  ]);
  return {
    user: toPublicUser(user),
    accessToken,
    expiresIn: 15 * 60,
    refreshToken,
  };
}

export const authService = {
  async login(email: string, password: string): Promise<IssueResult> {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    }
    return issueSession(user);
  },

  /** 用 refresh token 轮换：作废旧 jti，签发新对。 */
  async refresh(refreshToken: string): Promise<IssueResult> {
    let payload;
    try {
      payload = await verifyRefreshToken(refreshToken);
    } catch {
      throw ApiError.unauthorized('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }
    const jti = payload.jti;
    const userId = payload.sub;
    if (!jti || !userId) throw ApiError.unauthorized('Invalid refresh token', 'INVALID_REFRESH_TOKEN');

    const valid = await isRefreshValid(jti);
    if (!valid) {
      // 可能被盗用：拉黑并拒绝。
      await revokeRefresh(jti).catch(() => undefined);
      throw ApiError.unauthorized('Refresh token revoked', 'REFRESH_REVOKED');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiError.unauthorized('User not found', 'INVALID_REFRESH_TOKEN');

    // 轮换：作废旧 jti，签发新对。
    await revokeRefresh(jti);
    return issueSession(user);
  },

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    try {
      const payload = await verifyRefreshToken(refreshToken);
      if (payload.jti) await revokeRefresh(payload.jti);
    } catch {
      // token 已无效，幂等返回。
    }
  },

  async me(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiError.notFound('User not found');
    return toPublicUser(user);
  },
};
