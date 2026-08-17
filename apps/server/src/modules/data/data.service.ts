import type { z } from 'zod';
import { prisma } from '../../prisma';
import { ApiError } from '../../utils/ApiError';
import type { Prisma } from '@prisma/client';
import type { Role } from '@mediakit/shared';
import { dataSchemaForKind, kindSchema } from './data.schema';
import type { AuthPayload } from '../../types/express';
import { assertBusinessLine, assertBusinessLineSoft } from '../../utils/business-line';

type Kind = z.infer<typeof kindSchema>;

/** API 小写 kind → Prisma 大写枚举。 */
export function kindToDb(kind: Kind): 'CAMPAIGN' | 'CREATOR' | 'COLLABORATION' {
  if (kind === 'campaign') return 'CAMPAIGN';
  if (kind === 'collaboration') return 'COLLABORATION';
  return 'CREATOR';
}

/**
 * 写入 DataRecord 时填 scopeCampaignId:COLLABORATION 取 data.campaignId,其余 kind 返回 null。
 * 供 recipe 后续按 (kind='COLLABORATION', scopeCampaignId) 索引查询。
 */
function scopeFor(kind: Kind, data: Record<string, unknown>): string | null {
  if (kind !== 'collaboration') return null;
  const cid = data?.campaignId;
  return typeof cid === 'string' && cid ? cid : null;
}

/**
 * Campaign ID 自增:取已有 CAMPAIGN 记录里数字 id 的最大值 +1;无数字 id 时从 1 开始。
 * 非数字遗留 id(如 mock 种子的 'camp-glowlab-q4')被忽略,不影响计数。
 * 注:campaign 的 data.id 同时是 DataRecord 主键,二者同值。
 */
async function nextCampaignId(): Promise<string> {
  const rows = await prisma.dataRecord.findMany({
    where: { kind: 'CAMPAIGN' },
    select: { id: true },
  });
  let max = 0;
  for (const r of rows) {
    const n = Number(r.id);
    if (Number.isInteger(n) && n > max) max = n;
  }
  return String(max + 1);
}

export const dataService = {
  /** viewer 感知列表：CREATOR 共享字典；其余 kind 非 ADMIN 强制 ownerId。 */
  async list(kind: Kind, viewer: { id: string; role: Role }) {
    // Phase 4: CAMPAIGN/CREATOR/COLLABORATION 已迁移到独立表，
    // 此方法保留供旧路径回退读取；新代码应直接查 Campaign/Creator 表。
    const where: Prisma.DataRecordWhereInput = { kind: kindToDb(kind) };
    if (kind !== 'creator' && viewer.role !== 'ADMIN') {
      where.ownerId = viewer.id;
    }
    return prisma.dataRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  },

  /** viewer 感知读取：CREATOR 共享；其余 kind 非 ADMIN 校验 owner。 */
  async get(id: string, viewer: { id: string; role: Role }) {
    const rec = await this.getOrThrow(id);
    if (rec.kind !== 'CREATOR' && viewer.role !== 'ADMIN' && rec.ownerId !== viewer.id) {
      throw ApiError.notFound('Data record not found');
    }
    return rec;
  },

  async getOrThrow(id: string, ownerId?: string) {
    const rec = await prisma.dataRecord.findUnique({ where: { id } });
    if (!rec) throw ApiError.notFound('Data record not found');
    // 若指定 ownerId，校验归属（防止跨用户操作）。
    if (ownerId && rec.ownerId !== ownerId) throw ApiError.notFound('Data record not found');
    return rec;
  },

  /** 按 kind 校验 data;失败抛 400。 */
  validateData(kind: Kind, data: unknown) {
    const schema = dataSchemaForKind(kind);
    const res = schema.safeParse(data);
    if (!res.success) throw ApiError.badRequest('Invalid record data', res.error.flatten());
    return res.data;
  },

  async create(viewer: AuthPayload, kind: Kind, data: unknown) {
    if (kind === 'campaign') assertBusinessLine(viewer, (data as { businessLine?: string })?.businessLine);
    // Phase 4: 新数据不再写入 DataRecord，仅保留 collaboration 的双写兼容。
    // Campaign/Creator 应通过 /api/v1/campaigns 路由写入独立表。
    if (kind !== 'collaboration') {
      console.warn(`[DEPRECATED] DataRecord.create(${kind}) — use dedicated table API instead`);
    }
    const payload = kind === 'campaign' ? { ...(data as object), id: await nextCampaignId() } : data;
    const valid = this.validateData(kind, payload);
    return prisma.dataRecord.create({
      data: {
        id: (valid as { id: string }).id,
        kind: kindToDb(kind),
        ownerId: viewer.id,
        data: valid as unknown as Prisma.InputJsonValue,
        scopeCampaignId: scopeFor(kind, valid as Record<string, unknown>),
      },
    });
  },

  /** 批量 upsert-by-id(幂等);逐条校验,非法行计入 skipped。 */
  async importMany(viewer: AuthPayload, kind: Kind, items: unknown[]) {
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
      if (kind === 'campaign' && !assertBusinessLineSoft(viewer, (valid as { businessLine?: string })?.businessLine)) {
        skipped++;
        continue;
      }
      if (!valid.id) {
        skipped++;
        continue;
      }
      try {
        const existing = await prisma.dataRecord.findUnique({ where: { id: valid.id } });
        if (existing) {
          await prisma.dataRecord.update({
            where: { id: valid.id },
            data: {
              data: valid as unknown as Prisma.InputJsonValue,
              scopeCampaignId: scopeFor(kind, valid as Record<string, unknown>),
            },
          });
          updated++;
        } else {
          await prisma.dataRecord.create({
            data: {
              id: valid.id,
              kind: kindToDb(kind),
              ownerId: viewer.id,
              data: valid as unknown as Prisma.InputJsonValue,
              scopeCampaignId: scopeFor(kind, valid as Record<string, unknown>),
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

  async update(id: string, viewer: AuthPayload, data: unknown) {
    const rec = await this.getOrThrow(id);
    // 写权限维持 owner 制（ADMIN 改他人记录不在本期范围）
    if (rec.ownerId !== viewer.id) throw ApiError.notFound('Data record not found');
    if (rec.kind === 'CAMPAIGN') assertBusinessLine(viewer, (data as { businessLine?: string })?.businessLine);
    const kind: Kind =
      rec.kind === 'CAMPAIGN' ? 'campaign' : rec.kind === 'COLLABORATION' ? 'collaboration' : 'creator';
    const parsed = this.validateData(kind, data);
    // Campaign ID 不可编辑:始终对齐既有主键,杜绝 PK 与 data.id 不一致。
    const valid = kind === 'campaign' ? { ...(parsed as object), id } : parsed;
    return prisma.dataRecord.update({
      where: { id },
      data: {
        data: valid as unknown as Prisma.InputJsonValue,
        scopeCampaignId: scopeFor(kind, valid as Record<string, unknown>),
      },
    });
  },

  async remove(id: string, viewer: AuthPayload) {
    const rec = await this.getOrThrow(id);
    if (rec.ownerId !== viewer.id) throw ApiError.notFound('Data record not found');
    await prisma.dataRecord.delete({ where: { id } });
  },

  async clear(kind: Kind) {
    const r = await prisma.dataRecord.deleteMany({ where: { kind: kindToDb(kind) } });
    return { deleted: r.count };
  },
};
