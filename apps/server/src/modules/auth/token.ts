import jwt, { type JwtPayload } from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import type { Role } from '@ppt-generator/shared'
import { config } from '../../config'

export const ACCESS_TTL = '15m'
export const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 天

interface AccessPayload extends JwtPayload {
  userId: string
  role: Role
  jti: string
  type: 'access'
}
interface RefreshPayload extends JwtPayload {
  userId: string
  jti: string
  type: 'refresh'
}

export function signAccessToken(user: { id: string; role: Role }) {
  return jwt.sign({ userId: user.id, role: user.role, jti: randomUUID(), type: 'access' }, config.JWT_SECRET, {
    expiresIn: ACCESS_TTL,
  })
}

export function signRefreshToken(userId: string, jti = randomUUID()) {
  return jwt.sign({ userId, jti, type: 'refresh' }, config.JWT_SECRET, { expiresIn: REFRESH_TTL_SECONDS })
}

export function verifyAccessToken(token: string): AccessPayload {
  const payload = jwt.verify(token, config.JWT_SECRET) as AccessPayload
  if (payload.type !== 'access') throw new Error('not an access token')
  return payload
}

export function verifyRefreshToken(token: string): RefreshPayload {
  const payload = jwt.verify(token, config.JWT_SECRET) as RefreshPayload
  if (payload.type !== 'refresh') throw new Error('not a refresh token')
  return payload
}
