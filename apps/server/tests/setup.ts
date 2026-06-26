import { beforeEach, afterAll } from 'vitest'
import { prisma } from '../src/prisma'
import { redis } from '../src/redis'

export async function resetDb() {
  // FK 安全顺序：先 Project 后 User
  await prisma.project.deleteMany()
  await prisma.user.deleteMany()
}

export async function resetRedis() {
  await redis.flushdb()
}

beforeEach(async () => {
  await resetDb()
  await resetRedis()
})

afterAll(async () => {
  await prisma.$disconnect()
  await redis.quit()
})
