import { prisma } from '../../prisma';
import { ApiError } from '../../utils/ApiError';
import type { Prisma } from '@prisma/client';

// ─── Campaign ────────────────────────────────────────────────────────────────

export const campaignService = {
  async list(opts: {
    ownerId: string;
    businessLineId?: string;
    advertiserId?: string;
    businessLineCode?: string;
    status?: string;
  }) {
    const where: Prisma.CampaignWhereInput = { ownerId: opts.ownerId };
    if (opts.businessLineId) where.businessLineId = opts.businessLineId;
    if (opts.advertiserId) where.advertiserId = opts.advertiserId;
    if (opts.businessLineCode) where.businessLineCode = opts.businessLineCode;
    if (opts.status) where.status = opts.status;
    return prisma.campaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        businessLine: { select: { id: true, code: true, name: true } },
        advertiser: { select: { id: true, name: true } },
        _count: { select: { campaignCreators: true } },
      },
    });
  },

  async getOrThrow(id: string, ownerId: string) {
    const rec = await prisma.campaign.findFirst({ where: { id, ownerId } });
    if (!rec) throw ApiError.notFound('Campaign not found');
    return rec;
  },

  async create(ownerId: string, data: Prisma.CampaignUncheckedCreateInput) {
    return prisma.campaign.create({ data: { ...data, ownerId } });
  },

  async update(id: string, ownerId: string, data: Prisma.CampaignUncheckedUpdateInput) {
    await this.getOrThrow(id, ownerId);
    return prisma.campaign.update({ where: { id }, data });
  },

  async remove(id: string, ownerId: string) {
    await this.getOrThrow(id, ownerId);
    await prisma.campaign.delete({ where: { id } });
  },
};

// ─── Creator ─────────────────────────────────────────────────────────────────

export const creatorService = {
  async list(opts: { ownerId: string; platform?: string; tier?: string; category?: string; search?: string }) {
    const where: Prisma.CreatorWhereInput = { ownerId: opts.ownerId };
    if (opts.platform) where.platform = opts.platform;
    if (opts.tier) where.tier = opts.tier;
    if (opts.category) where.category = opts.category;
    if (opts.search) {
      where.OR = [
        { name: { contains: opts.search } },
        { handle: { contains: opts.search } },
      ];
    }
    return prisma.creator.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  },

  async getOrThrow(id: string, ownerId: string) {
    const rec = await prisma.creator.findFirst({ where: { id, ownerId } });
    if (!rec) throw ApiError.notFound('Creator not found');
    return rec;
  },

  async create(ownerId: string, data: Prisma.CreatorUncheckedCreateInput) {
    return prisma.creator.create({ data: { ...data, ownerId } });
  },

  async update(id: string, ownerId: string, data: Prisma.CreatorUncheckedUpdateInput) {
    await this.getOrThrow(id, ownerId);
    return prisma.creator.update({ where: { id }, data });
  },

  async remove(id: string, ownerId: string) {
    await this.getOrThrow(id, ownerId);
    await prisma.creator.delete({ where: { id } });
  },
};

// ─── CampaignCreator ─────────────────────────────────────────────────────────

export const campaignCreatorService = {
  async listByCampaign(campaignId: string, ownerId: string) {
    // Verify campaign belongs to user
    await campaignService.getOrThrow(campaignId, ownerId);
    return prisma.campaignCreator.findMany({
      where: { campaignId },
      include: {
        creator: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  },

  async upsert(data: { campaignId: string; creatorId: string; collabType?: string; status?: string; contentType?: string }, ownerId: string) {
    // Verify ownership
    await campaignService.getOrThrow(data.campaignId, ownerId);
    await creatorService.getOrThrow(data.creatorId, ownerId);
    return prisma.campaignCreator.upsert({
      where: { campaignId_creatorId: { campaignId: data.campaignId, creatorId: data.creatorId } },
      create: data,
      update: {
        ...(data.collabType !== undefined && { collabType: data.collabType }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.contentType !== undefined && { contentType: data.contentType }),
      },
    });
  },

  async update(id: string, ownerId: string, data: { collabType?: string; status?: string; contentType?: string }) {
    const rec = await prisma.campaignCreator.findUnique({
      where: { id },
      include: { campaign: { select: { ownerId: true } } },
    });
    if (!rec || rec.campaign.ownerId !== ownerId) throw ApiError.notFound('CampaignCreator not found');
    return prisma.campaignCreator.update({ where: { id }, data });
  },

  async remove(id: string, ownerId: string) {
    const rec = await prisma.campaignCreator.findUnique({
      where: { id },
      include: { campaign: { select: { ownerId: true } } },
    });
    if (!rec || rec.campaign.ownerId !== ownerId) throw ApiError.notFound('CampaignCreator not found');
    await prisma.campaignCreator.delete({ where: { id } });
  },
};

// ─── CreatorPerformance ──────────────────────────────────────────────────────

export const performanceService = {
  /** 按 (campaignId, creatorId) 查找 CampaignCreator，返回其 id。 */
  async resolveLinkId(campaignId: string, creatorId: string, ownerId: string): Promise<string> {
    await campaignService.getOrThrow(campaignId, ownerId);
    const link = await prisma.campaignCreator.findUnique({
      where: { campaignId_creatorId: { campaignId, creatorId } },
    });
    if (!link) throw ApiError.notFound('CampaignCreator not found for this campaign+creator');
    return link.id;
  },

  async getByCampaignCreator(linkId: string) {
    return prisma.creatorPerformance.findUnique({ where: { campaignCreatorId: linkId } });
  },

  async upsert(data: {
    campaignCreatorId: string;
    summary: object;
    posts?: object;
    daily?: object;
    placements?: object;
    cps?: object;
  }) {
    return prisma.creatorPerformance.upsert({
      where: { campaignCreatorId: data.campaignCreatorId },
      create: data,
      update: {
        summary: data.summary,
        ...(data.posts !== undefined && { posts: data.posts }),
        ...(data.daily !== undefined && { daily: data.daily }),
        ...(data.placements !== undefined && { placements: data.placements }),
        ...(data.cps !== undefined && { cps: data.cps }),
      },
    });
  },

  async remove(linkId: string) {
    await prisma.creatorPerformance.delete({ where: { campaignCreatorId: linkId } }).catch(() => {});
  },
};

// ─── Collaboration ───────────────────────────────────────────────────────────

export const collaborationService = {
  async getByCampaignCreator(linkId: string) {
    return prisma.collaboration.findUnique({ where: { campaignCreatorId: linkId } });
  },

  async getByLegacyId(legacyId: string) {
    return prisma.collaboration.findFirst({ where: { legacyId } });
  },

  async upsert(data: { campaignCreatorId: string; deliverables: object; legacyId?: string }) {
    return prisma.collaboration.upsert({
      where: { campaignCreatorId: data.campaignCreatorId },
      create: data,
      update: {
        deliverables: data.deliverables,
        ...(data.legacyId !== undefined && { legacyId: data.legacyId }),
      },
    });
  },

  async remove(linkId: string) {
    await prisma.collaboration.delete({ where: { campaignCreatorId: linkId } }).catch(() => {});
  },
};
