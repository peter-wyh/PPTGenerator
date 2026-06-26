import type { RequestHandler } from 'express'
import type { ZodTypeAny } from 'zod'
import { ApiError } from '../utils/ApiError'

type Schemas = { body?: ZodTypeAny; query?: ZodTypeAny; params?: ZodTypeAny }

export const validate =
  (schemas: Schemas): RequestHandler =>
  (req, _res, next) => {
    try {
      for (const key of ['params', 'query', 'body'] as const) {
        const schema = schemas[key]
        if (schema) (req as unknown as Record<string, unknown>)[key] = schema.parse(req[key])
      }
      next()
    } catch (err) {
      const issues = (err as { flatten?: () => unknown }).flatten
        ? (err as { flatten: () => unknown }).flatten()
        : (err as { issues?: unknown }).issues
      next(ApiError.unprocessable('Validation failed', 'VALIDATION_ERROR', issues))
    }
  }
