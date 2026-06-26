import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { prisma } from '../prisma'
import { verifyAccessToken } from '../modules/auth/token'
import { ApiError } from '../utils/ApiError'

export const auth: () => RequestHandler = () =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const header = req.headers.authorization
      if (!header?.startsWith('Bearer ')) throw ApiError.unauthorized()
      const token = header.slice(7)
      const payload = verifyAccessToken(token)
      const user = await prisma.user.findUnique({ where: { id: payload.userId } })
      if (!user) throw ApiError.unauthorized()
      req.user = { id: user.id, username: user.username, role: user.role }
      next()
    } catch (err) {
      next(err instanceof ApiError ? err : ApiError.unauthorized())
    }
  }

export const requireAdmin: () => RequestHandler = () =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (req.user?.role !== 'ADMIN') return next(ApiError.forbidden('Admin only', 'ADMIN_ONLY'))
    next()
  }
