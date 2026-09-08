import { prisma } from '../../prisma';
import { ApiError } from '../../utils/ApiError';
import type { Prisma } from '@prisma/client';

// ─── Merchant ────────────────────────────────────────────────────────────────

export const merchantService = {
  async list() {
    return prisma.merchant.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { businessLines: true, advertisers: true } } },
    });
  },

  async getOrThrow(id: string) {
    const rec = await prisma.merchant.findUnique({ where: { id } });
    if (!rec) throw ApiError.notFound('Merchant not found');
    return rec;
  },

  async create(data: { name: string; logo?: string }) {
    return prisma.merchant.create({ data });
  },

  async update(id: string, data: Partial<{ name: string; logo: string }>) {
    await this.getOrThrow(id);
    return prisma.merchant.update({ where: { id }, data });
  },

  async remove(id: string) {
    await this.getOrThrow(id);
    await prisma.merchant.delete({ where: { id } });
  },
};

// ─── BusinessLine ─────────────────────────────────────────────────────────────

/** BusinessLine 可写字段（源侧 dm_union_business_lines 对齐 + 本地扩展）。 */
export type BusinessLineInput = {
  code: string;
  title?: string;
  logo?: string;
  color?: string;
  merchantId?: string;
  designMd?: string;
  designMdUrl?: string;
  // 源侧字段
  directorId?: string;
  members?: string;
  extra?: string;
  status?: number;
  companyIds?: string;
  departmentIds?: string;
  specifyMembers?: string;
  cptWithdraw?: boolean;
  relatedProject?: string;
  calendarAdminIds?: string;
};

export const businessLineService = {
  async list(opts?: { merchantId?: string }) {
    const where: Prisma.BusinessLineWhereInput = {};
    if (opts?.merchantId) where.merchantId = opts.merchantId;
    return prisma.businessLine.findMany({
      where,
      orderBy: { code: 'asc' },
      include: {
        merchant: { select: { id: true, name: true } },
        _count: { select: { advertisers: true, marketingEvents: true } },
      },
    });
  },

  async getOrThrow(id: string) {
    const rec = await prisma.businessLine.findUnique({ where: { id } });
    if (!rec) throw ApiError.notFound('BusinessLine not found');
    return rec;
  },

  async findByCode(code: string) {
    return prisma.businessLine.findUnique({ where: { code } });
  },

  async create(data: BusinessLineInput) {
    return prisma.businessLine.create({ data });
  },

  async update(id: string, data: Partial<BusinessLineInput>) {
    await this.getOrThrow(id);
    return prisma.businessLine.update({ where: { id }, data });
  },

  async remove(id: string) {
    await this.getOrThrow(id);
    await prisma.businessLine.delete({ where: { id } });
  },
};

// ─── Advertiser ───────────────────────────────────────────────────────────────

export const advertiserService = {
  async list(opts?: { businessLineCode?: string; businessLineId?: string }) {
    const where: Prisma.AdvertiserWhereInput = {};
    if (opts?.businessLineId) {
      where.businessLineId = opts.businessLineId;
    } else if (opts?.businessLineCode) {
      const bl = await businessLineService.findByCode(opts.businessLineCode);
      if (!bl) return [];
      where.businessLineId = bl.id;
    }
    return prisma.advertiser.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        businessLine: { select: { id: true, code: true, title: true } },
        merchant: { select: { id: true, name: true } },
      },
    });
  },

  async getOrThrow(id: string) {
    const rec = await prisma.advertiser.findUnique({ where: { id } });
    if (!rec) throw ApiError.notFound('Advertiser not found');
    return rec;
  },

  async findByName(name: string) {
    return prisma.advertiser.findUnique({ where: { name } });
  },

  async create(data: { name: string; logo?: string; businessLineId: string; merchantId?: string }) {
    return prisma.advertiser.create({ data });
  },

  async update(id: string, data: Partial<{ name: string; logo: string; businessLineId: string; merchantId: string }>) {
    await this.getOrThrow(id);
    return prisma.advertiser.update({ where: { id }, data });
  },

  async remove(id: string) {
    await this.getOrThrow(id);
    await prisma.advertiser.delete({ where: { id } });
  },
};

// ─── MarketingEvent（营销活动，对齐 sales_activity）───────────────────────────

/** MarketingEvent 可写字段（源 sales_activity 对齐；时间统一接受 ISO/datetime 字符串）。 */
export type MarketingEventInput = {
  name: string;
  startTime?: Date | string;
  endTime?: Date | string;
  label?: string;
  type?: number;
  info?: string;
  continent?: string;
  region?: string;
  level?: number;
  adsId?: string;
  businessLineId?: string;
  isShowMember?: number;
  source?: number;
  createId?: string;
  updateId?: string;
};

/** startTime/endTime 字符串 → Date（Prisma datetime 列）。 */
function coerceMarketingEventTimes<T extends { startTime?: Date | string; endTime?: Date | string }>(data: T): T {
  const out = { ...data };
  if (out.startTime != null && !(out.startTime instanceof Date)) out.startTime = new Date(out.startTime);
  if (out.endTime != null && !(out.endTime instanceof Date)) out.endTime = new Date(out.endTime);
  return out;
}

export const marketingEventService = {
  async list(opts?: { businessLineId?: string }) {
    const where: Prisma.MarketingEventWhereInput = {};
    if (opts?.businessLineId) where.businessLineId = opts.businessLineId;
    return prisma.marketingEvent.findMany({
      where,
      orderBy: [{ startTime: 'desc' }],
      include: {
        businessLine: { select: { id: true, code: true, title: true } },
      },
    });
  },

  async getOrThrow(id: string) {
    const rec = await prisma.marketingEvent.findUnique({ where: { id } });
    if (!rec) throw ApiError.notFound('MarketingEvent not found');
    return rec;
  },

  async create(data: MarketingEventInput) {
    return prisma.marketingEvent.create({ data: coerceMarketingEventTimes(data) });
  },

  async update(id: string, data: Partial<MarketingEventInput>) {
    await this.getOrThrow(id);
    return prisma.marketingEvent.update({ where: { id }, data: coerceMarketingEventTimes(data) });
  },

  async remove(id: string) {
    await this.getOrThrow(id);
    await prisma.marketingEvent.delete({ where: { id } });
  },

  /**
   * 批量导入（0908 补批量入口）。
   * 幂等键：name + startTime——同名同开始时间的活动视为同一条，重导更新。
   * businessLineId / businessLineCode 二选一（code 简写方便 CSV：FT/SM/CX…）。
   */
  async importMany(items: Record<string, unknown>[]) {
    let created = 0, updated = 0, skipped = 0;
    // businessLineCode → businessLineId 预解析（一次查询建映射）
    const codes = new Set<string>();
    for (const it of items) {
      const c = String(it.businessLineCode ?? '').trim();
      if (c) codes.add(c);
    }
    const blMap = new Map<string, string>();
    if (codes.size) {
      const bls = await prisma.businessLine.findMany({ where: { code: { in: [...codes] } }, select: { id: true, code: true } });
      for (const b of bls) blMap.set(b.code, b.id);
    }

    for (const it of items) {
      try {
        const name = String(it.name ?? '').trim();
        const startTimeRaw = String(it.startTime ?? '').trim();
        const endTimeRaw = String(it.endTime ?? '').trim();
        if (!name || !startTimeRaw || !endTimeRaw) { skipped++; continue; }

        // 业务线归属：businessLineId 直用；否则 businessLineCode 反查（未命中→skipped，宁缺勿假）
        let businessLineId = String(it.businessLineId ?? '').trim() || null;
        if (!businessLineId) {
          const code = String(it.businessLineCode ?? '').trim();
          if (code) {
            const id = blMap.get(code);
            if (!id) { skipped++; continue; }
            businessLineId = id;
          }
        }

        const data: MarketingEventInput = {
          name,
          startTime: startTimeRaw,
          endTime: endTimeRaw,
          ...businessLineId ? { businessLineId } : {},
          ...it.type !== undefined && it.type !== '' ? { type: Number(it.type) || 0 } : {},
          ...it.level !== undefined && it.level !== '' ? { level: Number(it.level) || 0 } : {},
          ...it.isShowMember !== undefined && it.isShowMember !== '' ? { isShowMember: Number(it.isShowMember) || 0 } : {},
          ...it.label ? { label: String(it.label) } : {},
          ...it.info ? { info: String(it.info) } : {},
          ...it.continent ? { continent: String(it.continent) } : {},
          ...it.region ? { region: String(it.region) } : {},
        };
        const startTime = new Date(startTimeRaw);
        // 幂等查找：name + startTime
        const existing = await prisma.marketingEvent.findFirst({
          where: { name, startTime },
          select: { id: true },
        });
        if (existing) {
          await prisma.marketingEvent.update({ where: { id: existing.id }, data: coerceMarketingEventTimes(data) });
          updated++;
        } else {
          await prisma.marketingEvent.create({ data: coerceMarketingEventTimes(data) });
          created++;
        }
      } catch {
        skipped++;
      }
    }
    return { created, updated, skipped };
  },
};
