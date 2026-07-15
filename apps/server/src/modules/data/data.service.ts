import type { z } from 'zod';
import { prisma } from '../../prisma';
import { ApiError } from '../../utils/ApiError';
import type { Prisma } from '@prisma/client';
import { dataSchemaForKind, kindSchema } from './data.schema';

type Kind = z.infer<typeof kindSchema>;

/** API 小写 kind → Prisma 大写枚举。 */
export function kindToDb(kind: Kind): 'CAMPAIGN' | 'CREATOR' | 'COLLABORATION' {
  if (kind === 'campaign') return 'CAMPAIGN';
  if (kind === 'collaboration') return 'COLLABORATION';
  return 'CREATOR';
}

export const dataService = {
  async list(kind: Kind) {
    return prisma.dataRecord.findMany({
      where: { kind: kindToDb(kind) },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getOrThrow(id: string) {
    const rec = await prisma.dataRecord.findUnique({ where: { id } });
    if (!rec) throw ApiError.notFound('Data record not found');
    return rec;
  },

  /** 按 kind 校验 data;失败抛 400。 */
  validateData(kind: Kind, data: unknown) {
    const schema = dataSchemaForKind(kind);
    const res = schema.safeParse(data);
    if (!res.success) throw ApiError.badRequest('Invalid record data', res.error.flatten());
    return res.data;
  },

  async create(ownerId: string, kind: Kind, data: unknown) {
    const valid = this.validateData(kind, data);
    return prisma.dataRecord.create({
      data: {
        id: (valid as { id: string }).id,
        kind: kindToDb(kind),
        ownerId,
        data: valid as unknown as Prisma.InputJsonValue,
      },
    });
  },

  /** 批量 upsert-by-id(幂等);逐条校验,非法行计入 skipped。 */
  async importMany(ownerId: string, kind: Kind, items: unknown[]) {
    const schema = dataSchemaForKind(kind);
    let created = 0;
    let updated = 0;
    let skipped = 0;
    for (const item of items) {
      const res = schema.safeParse(item);
      if (!res.success) {
        skipped++;
        continue;
      }
      const valid = res.data as { id: string };
      if (!valid.id) {
        skipped++;
        continue;
      }
      try {
        const existing = await prisma.dataRecord.findUnique({ where: { id: valid.id } });
        if (existing) {
          await prisma.dataRecord.update({
            where: { id: valid.id },
            data: { data: valid as unknown as Prisma.InputJsonValue },
          });
          updated++;
        } else {
          await prisma.dataRecord.create({
            data: {
              id: valid.id,
              kind: kindToDb(kind),
              ownerId,
              data: valid as unknown as Prisma.InputJsonValue,
            },
          });
          created++;
        }
      } catch {
        // DB 错误(并发 create 唯一约束竞争 / 瞬时故障)计入 skipped,不中断批次。
        skipped++;
      }
    }
    return { created, updated, skipped };
  },

  async update(id: string, data: unknown) {
    const rec = await this.getOrThrow(id);
    const kind: Kind =
      rec.kind === 'CAMPAIGN' ? 'campaign' : rec.kind === 'COLLABORATION' ? 'collaboration' : 'creator';
    const valid = this.validateData(kind, data);
    return prisma.dataRecord.update({
      where: { id },
      data: { data: valid as unknown as Prisma.InputJsonValue },
    });
  },

  async remove(id: string) {
    await this.getOrThrow(id);
    await prisma.dataRecord.delete({ where: { id } });
  },

  async clear(kind: Kind) {
    const r = await prisma.dataRecord.deleteMany({ where: { kind: kindToDb(kind) } });
    return { deleted: r.count };
  },
};
