import type { Role } from '@mediakit/shared';

/** 认证后挂到 req.user 的载荷。 */
export interface AuthPayload {
  id: string;
  role: Role;
  /** 归属业务线 code；ADMIN / 无归属为 null。 */
  businessLineCode: string | null;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthPayload;
  }
}
