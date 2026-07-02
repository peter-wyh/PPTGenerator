import type { NextFunction, Request, Response, RequestHandler } from 'express';

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** 包裹 async 控制器，把 reject 转交 error 中间件。 */
export function asyncHandler(fn: AsyncHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
