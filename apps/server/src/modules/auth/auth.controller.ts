import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { isProd } from '../../config'
import * as authService from './auth.service'

const REFRESH_COOKIE = 'refreshToken'

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' })
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { username, password } = req.body
  const { accessToken, refreshToken } = await authService.login(username, password)
  setRefreshCookie(res, refreshToken)
  res.json({ accessToken })
})

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE]
  const { accessToken, refreshToken } = await authService.refresh(token)
  setRefreshCookie(res, refreshToken)
  res.json({ accessToken })
})

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE]
  await authService.logout(token)
  clearRefreshCookie(res)
  res.json({ ok: true })
})

export const me = asyncHandler(async (req: Request, res: Response) => {
  res.json({ id: req.user!.id, username: req.user!.username, role: req.user!.role })
})
