import type { Role } from '@mediakit/shared';

/** 认证后挂到 req.user 的载荷。 */
export interface AuthPayload {
  id: string;
  role: Role;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthPayload;
  }
}
