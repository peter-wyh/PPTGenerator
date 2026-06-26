import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../../prisma'
import { ApiError } from '../../utils/ApiError'
import type { Role } from '@ppt-generator/shared'

export interface RequestUser {
  id: string
  role: Role
}

interface UpdateInput {
  name?: string
  canvasWidth?: number
  canvasHeight?: number
  pages?: unknown
}

function emptyPages() {
  return [
    { id: randomUUID(), name: '封面', components: [] },
    { id: randomUUID(), name: '第 2 页', components: [] },
    { id: randomUUID(), name: '第 3 页', components: [] },
  ]
}

export async function list(user: RequestUser) {
  return prisma.project.findMany({
    where: user.role === 'ADMIN' ? undefined : { userId: user.id },
    select: {
      id: true,
      name: true,
      canvasWidth: true,
      canvasHeight: true,
      userId: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  })
}

// 存在性 + 所有权统一校验；不满足一律 404（不暴露存在性）
export async function getOwnedProject(id: string, user: RequestUser) {
  const project = await prisma.project.findUnique({ where: { id } })
  if (!project) throw ApiError.notFound('Project not found', 'PROJECT_NOT_FOUND')
  if (user.role !== 'ADMIN' && project.userId !== user.id) {
    throw ApiError.notFound('Project not found', 'PROJECT_NOT_FOUND')
  }
  return project
}

export async function create(user: RequestUser, name: string) {
  return prisma.project.create({
    data: { userId: user.id, name, pages: emptyPages() },
  })
}

export async function update(id: string, user: RequestUser, data: UpdateInput) {
  await getOwnedProject(id, user)
  const { pages, ...rest } = data
  const updateData: Prisma.ProjectUpdateInput = { ...rest }
  if (pages !== undefined) updateData.pages = pages as Prisma.InputJsonValue
  return prisma.project.update({ where: { id }, data: updateData })
}

export async function remove(id: string, user: RequestUser) {
  await getOwnedProject(id, user)
  await prisma.project.delete({ where: { id } })
}

export async function duplicate(id: string, user: RequestUser) {
  const src = await getOwnedProject(id, user)
  return prisma.project.create({
    data: {
      userId: src.userId,
      name: `${src.name} 副本`,
      canvasWidth: src.canvasWidth,
      canvasHeight: src.canvasHeight,
      pages: src.pages as Prisma.InputJsonValue,
    },
  })
}
