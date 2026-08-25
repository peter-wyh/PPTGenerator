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
};
