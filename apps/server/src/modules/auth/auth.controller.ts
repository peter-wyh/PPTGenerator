import type { CookieOptions, Request, Response } from 'express';
import { config } from '../../config';
import { authService } from './auth.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import type { AuthPayload } from '../../types/express';

function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: 'strict',
    path: '/api/v1/auth',
    domain: config.cookie.domain,
    maxAge: config.jwt.refreshTtlSec * 1000,
  };
}

export const authController = {
  login: asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.cookie(config.cookie.name, result.refreshToken, refreshCookieOptions());
    res.json({
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    });
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const token = req.cookies?.[config.cookie.name];
    if (!token) throw ApiError.unauthorized('Missing refresh token', 'NO_REFRESH_TOKEN');
    const result = await authService.refresh(token);
    res.cookie(config.cookie.name, result.refreshToken, refreshCookieOptions());
    res.json({ accessToken: result.accessToken, expiresIn: result.expiresIn });
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    const token = req.cookies?.[config.cookie.name];
    await authService.logout(token);
    res.clearCookie(config.cookie.name, { ...refreshCookieOptions(), maxAge: undefined });
    res.status(204).end();
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as AuthPayload;
    const me = await authService.me(user.id);
    res.json({ user: me });
  }),
};
