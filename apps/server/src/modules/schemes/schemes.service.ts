import { prisma } from '../../prisma';
import { ApiError } from '../../utils/ApiError';
import { Prisma } from '@prisma/client';
import type { ReportScheme } from '@mediakit/shared';
import type { CreateSchemeInput, UpdateSchemeInput } from './schemes.schema';

/** Prisma ReportScheme 行 → 共享 ReportScheme 序列化。 */
function toScheme(row: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  businessLineCode: string | null;
  pageCount: number;
  enabled: boolean;
  sortOrder: number;
  defaultStyle: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}): ReportScheme {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    businessLineCode: row.businessLineCode,
    pageCount: row.pageCount,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
    defaultStyle: row.defaultStyle,
    ownerId: row.ownerId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const schemesService = {
  /**
   * 列表：支持按 businessLineCode 过滤、enabled 过滤。
   * 按 sortOrder 升序、createdAt 升序排列。
   */
  async list(filters?: { businessLineCode?: string; enabled?: boolean }): Promise<ReportScheme[]> {
    const where: Prisma.ReportSchemeWhereInput = {};
    if (filters?.businessLineCode) where.businessLineCode = filters.businessLineCode;
    if (filters?.enabled !== undefined) where.enabled = filters.enabled;
    const rows = await prisma.reportScheme.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(toScheme);
  },

  /** 按 id 获取，不存在抛 404。 */
  async getByIdOrThrow(id: string): Promise<ReportScheme> {
    const row = await prisma.reportScheme.findUnique({ where: { id } });
    if (!row) throw ApiError.notFound('ReportScheme not found');
    return toScheme(row);
  },

  /** 按 code 获取，不存在抛 404。 */
  async getByCodeOrThrow(code: string): Promise<ReportScheme> {
    const row = await prisma.reportScheme.findUnique({ where: { code } });
    if (!row) throw ApiError.notFound('ReportScheme not found');
    return toScheme(row);
  },

  /** 创建方案。code 唯一冲突 → 409。 */
  async create(ownerId: string, input: CreateSchemeInput): Promise<ReportScheme> {
    const data: Prisma.ReportSchemeCreateInput = {
      owner: { connect: { id: ownerId } },
      code: input.code,
      name: input.name,
      description: input.description ?? null,
      businessLineCode: input.businessLineCode ?? null,
      pageCount: input.pageCount ?? 8,
      enabled: input.enabled ?? true,
      sortOrder: input.sortOrder ?? 0,
      defaultStyle: input.defaultStyle ?? null,
    };
    try {
      const row = await prisma.reportScheme.create({ data });
      return toScheme(row);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw ApiError.conflict('Scheme code already in use');
      }
      throw err;
    }
  },

  /** 更新方案。code 唯一冲突 → 409。 */
  async update(id: string, input: UpdateSchemeInput): Promise<ReportScheme> {
    const data: Prisma.ReportSchemeUpdateInput = {};
    if (input.code !== undefined) data.code = input.code;
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.businessLineCode !== undefined) data.businessLineCode = input.businessLineCode;
    if (input.pageCount !== undefined) data.pageCount = input.pageCount;
    if (input.enabled !== undefined) data.enabled = input.enabled;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.defaultStyle !== undefined) data.defaultStyle = input.defaultStyle;
    try {
      const row = await prisma.reportScheme.update({ where: { id }, data });
      return toScheme(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') throw ApiError.conflict('Scheme code already in use');
        if (err.code === 'P2025') throw ApiError.notFound('ReportScheme not found');
      }
      throw err;
    }
  },

  /** 删除方案。不存在抛 404。 */
  async remove(id: string): Promise<void> {
    try {
      await prisma.reportScheme.delete({ where: { id } });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw ApiError.notFound('ReportScheme not found');
      }
      throw err;
    }
  },
};
