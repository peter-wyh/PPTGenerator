import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import { ApiError } from '../utils/ApiError'
import { logger } from '../logger'
import { config } from '../config'

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res
      .status(422)
      .json({ error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: err.flatten() } })
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res
        .status(409)
        .json({ error: { code: 'CONFLICT', message: 'Resource already exists', details: err.meta } })
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } })
    }
  }

  if (err instanceof ApiError) {
    if (err.statusCode >= 500) logger.error({ err }, 'API error')
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    })
  }

  logger.error({ err }, 'Unhandled error')
  const message = config.NODE_ENV === 'production' ? 'Internal Server Error' : (err as Error).message
  return res.status(500).json({ error: { code: 'INTERNAL', message } })
}
