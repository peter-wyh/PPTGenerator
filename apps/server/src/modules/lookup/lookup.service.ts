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

export const businessLineService = {
  async list(opts?: { merchantId?: string }) {
    const where: Prisma.BusinessLineWhereInput = {};
    if (opts?.merchantId) where.merchantId = opts.merchantId;
    return prisma.businessLine.findMany({
      where,
      orderBy: { code: 'asc' },
      include: {
        merchant: { select: { id: true, name: true } },
        _count: { select: { advertisers: true } },
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

  async create(data: { code: string; name: string; logo?: string; color?: string; merchantId?: string; designMd?: string; designMdUrl?: string }) {
    return prisma.businessLine.create({ data });
  },

  async update(id: string, data: Partial<{ code: string; name: string; logo: string; color: string; merchantId: string; designMd: string; designMdUrl: string }>) {
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
        businessLine: { select: { id: true, code: true, name: true } },
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
