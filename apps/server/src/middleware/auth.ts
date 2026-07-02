import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { verifyAccessToken } from '../modules/auth/token';
import type { Role } from '@mediakit/shared';

/** 校验 Authorization: Bearer <access>。 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Missing access token', 'NO_ACCESS_TOKEN');
    }
    const token = header.slice('Bearer '.length).trim();
    const payload = await verifyAccessToken(token);
    req.user = { id: payload.sub!, role: payload.role };
    next();
  } catch (err) {
    next(
      err instanceof ApiError
        ? err
        : ApiError.unauthorized('Invalid or expired access token', 'INVALID_ACCESS_TOKEN'),
    );
  }
}

/** 角色守卫工厂。 */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(ApiError.unauthorized('Authentication required', 'NO_ACCESS_TOKEN'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(ApiError.forbidden('Insufficient role'));
      return;
    }
    next();
  };
}
