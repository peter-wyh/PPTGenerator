import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma';
import { ApiError } from '../../utils/ApiError';
import { hashPassword } from '../../utils/hash';
import type { User } from '@prisma/client';

export function toPublicUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    businessLineCode: u.businessLineCode,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

export const usersService = {
  async list() {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
    return users.map(toPublicUser);
  },

  async create(input: { email: string; password: string; name?: string; role?: 'ADMIN' | 'USER'; businessLineCode?: string | null }) {
    const data: Prisma.UserCreateInput = {
      email: input.email.toLowerCase(),
      passwordHash: await hashPassword(input.password),
      name: input.name ?? null,
      role: input.role ?? 'USER',
      ...(input.businessLineCode !== undefined ? { businessLineCode: input.businessLineCode } : {}),
    };
    try {
      const user = await prisma.user.create({ data });
      return toPublicUser(user);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw ApiError.conflict('Email already in use');
      }
      throw err;
    }
  },

  async update(
    id: string,
    input: { email?: string; password?: string; name?: string | null; role?: 'ADMIN' | 'USER'; businessLineCode?: string | null },
  ) {
    const data: Prisma.UserUpdateInput = {};
    if (input.email !== undefined) data.email = input.email.toLowerCase();
    if (input.password !== undefined) data.passwordHash = await hashPassword(input.password);
    if (input.name !== undefined) data.name = input.name;
    if (input.role !== undefined) data.role = input.role;
    if (input.businessLineCode !== undefined) data.businessLineCode = input.businessLineCode;

    try {
      const user = await prisma.user.update({ where: { id }, data });
      return toPublicUser(user);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2025') throw ApiError.notFound('User not found');
        if (err.code === 'P2002') throw ApiError.conflict('Email already in use');
      }
      throw err;
    }
  },

  async remove(id: string) {
    // 不允许删掉最后一个管理员。
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw ApiError.notFound('User not found');
    if (target.role === 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) throw ApiError.conflict('Cannot delete the last admin');
    }
    await prisma.user.delete({ where: { id } });
  },
};
