import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError';
import { config } from '../config';
import { logger } from '../logger';

function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof ZodError) return ApiError.badRequest('Validation failed', err.flatten());
  if (config.isProd) return new ApiError(500, 'Internal Server Error', 'INTERNAL');
  const msg = err instanceof Error ? err.message : String(err);
  return new ApiError(500, msg, 'INTERNAL');
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(ApiError.notFound('Resource not found'));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const apiErr = toApiError(err);

  if (apiErr.statusCode >= 500) {
    logger.error({ err }, 'request error');
  }

  res.status(apiErr.statusCode).json({
    error: {
      code: apiErr.code,
      message: apiErr.message,
      ...(apiErr.details ? { details: apiErr.details } : {}),
      ...(config.isProd ? {} : { stack: err instanceof Error ? err.stack : undefined }),
    },
  });
};
