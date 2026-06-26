import type { Request, Response } from 'express'
import { prisma } from '../../prisma'
import { hashPassword } from '../../utils/hash'
import { asyncHandler } from '../../utils/asyncHandler'

const PUBLIC_SELECT = { id: true, username: true, role: true, createdAt: true } as const

export const list = asyncHandler(async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({ select: PUBLIC_SELECT, orderBy: { createdAt: 'desc' } })
  res.json({ users })
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { username, password, role } = req.body
  const user = await prisma.user.create({
    data: { username, passwordHash: await hashPassword(password), role },
    select: PUBLIC_SELECT,
  })
  res.status(201).json({ user })
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  const { password, role } = req.body
  const data: { passwordHash?: string; role?: 'ADMIN' | 'USER' } = {}
  if (password) data.passwordHash = await hashPassword(password)
  if (role) data.role = role
  const user = await prisma.user.update({ where: { id }, data, select: PUBLIC_SELECT })
  res.json({ user })
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  await prisma.user.delete({ where: { id } })
  res.json({ ok: true })
})
