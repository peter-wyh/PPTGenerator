import type { RequestHandler } from 'express';
import { z } from 'zod';
import { ApiError } from '../utils/ApiError';

type Schemas = {
  body?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
};

/** 用 zod schema 校验 req.body/query/params，失败抛 400。 */
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    try {
      for (const key of ['body', 'query', 'params'] as const) {
        const schema = schemas[key];
        if (!schema) continue;
        const parsed = schema.parse(req[key]);
        // 只覆盖目标字段，保留 Express 原型。
        Object.assign(req[key], parsed);
      }
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        next(ApiError.badRequest('Validation failed', err.flatten()));
        return;
      }
      next(err);
    }
  };
}
