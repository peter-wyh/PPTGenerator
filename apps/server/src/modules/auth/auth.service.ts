import { prisma } from '../../prisma'
import { redis, refreshKey } from '../../redis'
import { ApiError } from '../../utils/ApiError'
import { verifyPassword } from '../../utils/hash'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from './token'

export async function login(username: string, password: string) {
  const user = await prisma.user.findUnique({ where: { username } })
  if (!user) throw ApiError.unauthorized('Invalid credentials', 'INVALID_CREDENTIALS')
  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok) throw ApiError.unauthorized('Invalid credentials', 'INVALID_CREDENTIALS')

  const accessToken = signAccessToken({ id: user.id, role: user.role })
  const refreshToken = signRefreshToken(user.id)
  return { accessToken, refreshToken }
}

export async function refresh(refreshToken: string) {
  let payload
  try {
    payload = verifyRefreshToken(refreshToken)
  } catch {
    throw ApiError.unauthorized('Invalid refresh token', 'INVALID_REFRESH')
  }

  if (await redis.get(refreshKey(payload.jti))) {
    throw ApiError.unauthorized('Refresh token revoked', 'INVALID_REFRESH')
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  if (!user) throw ApiError.unauthorized('Invalid refresh token', 'INVALID_REFRESH')

  // 轮换：作废旧 jti（TTL = 剩余有效期，最少 1s）
  const remaining = Math.max(1, (payload.exp ?? 0) - Math.floor(Date.now() / 1000))
  await redis.set(refreshKey(payload.jti), '1', 'EX', remaining)

  const accessToken = signAccessToken({ id: user.id, role: user.role })
  const newRefresh = signRefreshToken(user.id)
  return { accessToken, refreshToken: newRefresh }
}

export async function logout(refreshToken?: string) {
  if (!refreshToken) return
  try {
    const payload = verifyRefreshToken(refreshToken)
    const remaining = Math.max(1, (payload.exp ?? 0) - Math.floor(Date.now() / 1000))
    await redis.set(refreshKey(payload.jti), '1', 'EX', remaining)
  } catch {
    // 无效 token 视作已登出，忽略
  }
}
