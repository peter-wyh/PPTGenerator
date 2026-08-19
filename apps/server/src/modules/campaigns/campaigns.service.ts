import { prisma } from '../../prisma';
import { ApiError } from '../../utils/ApiError';
import { Prisma } from '@prisma/client';

// ─── Campaign ────────────────────────────────────────────────────────────────

export const campaignService = {
  async list(opts: {
    ownerId: string;
    admin?: boolean;
    businessLineId?: string;
    advertiserId?: string;
    businessLineCode?: string;
    status?: string;
  }) {
    const where: Prisma.CampaignWhereInput = opts.admin ? {} : { ownerId: opts.ownerId };
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

  async getOrThrow(id: string, ownerId: string, admin = false) {
    const where: Prisma.CampaignWhereUniqueInput = { id };
    if (!admin) where.ownerId = ownerId;
    const rec = await prisma.campaign.findFirst({ where });
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
  /** businessLineId → code 解析（写守卫用）；不存在返回 null。 */
  async resolveBusinessLineCode(id: string): Promise<string | null> {
    const bl = await prisma.businessLine.findUnique({ where: { id }, select: { code: true } });
    return bl?.code ?? null;
  },
  // ─── Analytics (Campaign 级分析数据) ──────────────────────────────────────
  /** 获取 Campaign 分析数据（analytics JSON）。 */
  async getAnalytics(campaignId: string, ownerId: string, admin = false) {
    const c = await this.getOrThrow(campaignId, ownerId, admin);
    return (c.analytics as Record<string, unknown> | null) ?? null;
  },

  /** 更新 Campaign 分析数据（analytics JSON 全量覆盖）。 */
  async updateAnalytics(campaignId: string, ownerId: string, analytics: Record<string, unknown>, admin = false) {
    await this.getOrThrow(campaignId, ownerId, admin);
    return prisma.campaign.update({
      where: { id: campaignId },
      data: { analytics: analytics as Prisma.InputJsonValue },
      select: { analytics: true },
    });
  },
  /**
   * 订单商品聚合：Top-Sales 商品排行（orders/qty/revenue）+ 购物篮结构指标。
   * period 可选切片（YYYY-MM-DD 区间，按 orderDate 过滤）。admin 豁免 owner 校验（列表页全局视角）。
   */
  async getOrderInsights(campaignId: string, ownerId: string, period?: { start?: string; end?: string }, admin = false) {
    await this.getOrThrow(campaignId, ownerId, admin);
    const orders = await prisma.campaignOrder.findMany({
      where: {
        campaignId,
        ...(period?.start || period?.end ? {
          orderDate: {
            ...(period.start ? { gte: new Date(period.start) } : {}),
            ...(period.end ? { lte: new Date(`${period.end}T23:59:59.999Z`) } : {}),
          },
        } : {}),
      },
      include: { items: true },
    });

    // ── 商品聚合 ──
    const byProduct = new Map<string, { orders: number; qty: number; revenue: number; category?: string }>();
    // ── 购物篮 ──
    let multiItemOrders = 0, threePlusOrders = 0, totalItems = 0;
    for (const o of orders) {
      const perProduct = new Map<string, { qty: number; revenue: number; category?: string }>();
      for (const it of o.items) {
        const cur = perProduct.get(it.productName) ?? { qty: 0, revenue: 0, category: it.category ?? undefined };
        cur.qty += it.qty;
        cur.revenue += Number(it.lineTotal);
        perProduct.set(it.productName, cur);
      }
      for (const [name, v] of perProduct) {
        const agg = byProduct.get(name) ?? { orders: 0, qty: 0, revenue: 0, category: v.category };
        agg.orders += 1;                      // 含该商品的订单数（同单同品合并为一）
        agg.qty += v.qty;
        agg.revenue += v.revenue;
        if (!agg.category && v.category) agg.category = v.category;
        byProduct.set(name, agg);
      }
      const distinctItems = perProduct.size;
      const itemCount = [...perProduct.values()].reduce((s, x) => s + x.qty, 0);
      totalItems += itemCount;
      if (distinctItems >= 2) multiItemOrders++;
      if (distinctItems >= 3) threePlusOrders++;
    }

    const topProducts = [...byProduct.entries()]
      .map(([name, v]) => ({ name, orders: v.orders, qty: v.qty, revenue: Math.round(v.revenue * 100) / 100, category: v.category ?? null }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const orderCount = orders.length;
    const basket = orderCount ? {
      orderCount,
      multiItemRate: Math.round((multiItemOrders / orderCount) * 1000) / 10,
      threePlusRate: Math.round((threePlusOrders / orderCount) * 1000) / 10,
      avgItemsPerOrder: Math.round((totalItems / orderCount) * 10) / 10,
    } : null;

    return { orderCount, topProducts, basket };
  },

  /**
   * 订单明细列表（数据管理独立页）：分页 + campaign 筛选 + items 展开。
   * admin 豁免——全局视角（与 list() 对齐）；非 admin 仅本人 owner 的 campaign 订单。
   */
  async listOrders(
    ownerId: string,
    opts: { campaignId?: string; page?: number; pageSize?: number; admin?: boolean } = {},
  ) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
    const where: Prisma.CampaignOrderWhereInput = {
      ...(opts.campaignId ? { campaignId: opts.campaignId } : {}),
      ...(opts.admin ? {} : { campaign: { ownerId } }),
    };
    const [rows, total] = await Promise.all([
      prisma.campaignOrder.findMany({
        where,
        orderBy: [{ orderDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          items: { orderBy: { lineTotal: 'desc' } },
          campaign: { select: { id: true, name: true } },
          campaignCreator: { select: { id: true, creator: { select: { name: true, avatar: true } } } },
        },
      }),
      prisma.campaignOrder.count({ where }),
    ]);
    return { rows, total, page, pageSize };
  },
};
// ─── Creator ─────────────────────────────────────────────────────────────────

export const creatorService = {
  /** 共享字典：所有登录用户可读（无 ownerId 过滤）。写操作仍校验 owner。 */
  async list(opts: { platform?: string; tier?: string; category?: string; partnerType?: string; search?: string }) {
    const where: Prisma.CreatorWhereInput = {};
    if (opts.platform) where.platform = opts.platform;
    if (opts.tier) where.tier = opts.tier;
    if (opts.category) where.category = opts.category;
    if (opts.partnerType) where.partnerType = opts.partnerType;
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

  /** 存在性校验（共享读语义，不查 owner）。 */
  async getOrThrow(id: string) {
    const rec = await prisma.creator.findFirst({ where: { id } });
    if (!rec) throw ApiError.notFound('Creator not found');
    return rec;
  },

  /** 写权限：owner 或 ADMIN。 */
  async getOwnedOrThrow(id: string, viewer: { id: string; role: string }) {
    const rec = await this.getOrThrow(id);
    if (viewer.role !== 'ADMIN' && rec.ownerId !== viewer.id) {
      throw ApiError.notFound('Creator not found');
    }
    return rec;
  },

  async create(ownerId: string, data: Prisma.CreatorUncheckedCreateInput) {
    return prisma.creator.create({ data: { ...data, ownerId } });
  },

  async update(id: string, viewer: { id: string; role: string }, data: Prisma.CreatorUncheckedUpdateInput) {
    await this.getOwnedOrThrow(id, viewer);
    return prisma.creator.update({ where: { id }, data });
  },

  async remove(id: string, viewer: { id: string; role: string }) {
    await this.getOwnedOrThrow(id, viewer);
    await prisma.creator.delete({ where: { id } });
  },
};

// ─── CampaignCreator ─────────────────────────────────────────────────────────

export const campaignCreatorService = {
  async listByCampaign(campaignId: string, ownerId: string, admin = false) {
    // Verify campaign belongs to user（ADMIN 豁免——列表页全局视角,与 campaignService.list 对齐）
    await campaignService.getOrThrow(campaignId, ownerId, admin);
    return prisma.campaignCreator.findMany({
      where: { campaignId },
      include: {
        creator: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  },

  async upsert(data: {
    campaignId: string;
    creatorId: string;
    collabType?: string;
    status?: string;
    contentType?: string;
    collabId?: string;
    currency?: string;
    totalPrice?: string;
  }, ownerId: string) {
    // Verify ownership
    await campaignService.getOrThrow(data.campaignId, ownerId);
    await creatorService.getOrThrow(data.creatorId);
    return prisma.campaignCreator.upsert({
      where: { campaignId_creatorId: { campaignId: data.campaignId, creatorId: data.creatorId } },
      create: data,
      update: {
        ...(data.collabType !== undefined && { collabType: data.collabType }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.contentType !== undefined && { contentType: data.contentType }),
        ...(data.collabId !== undefined && { collabId: data.collabId }),
        ...(data.currency !== undefined && { currency: data.currency }),
        ...(data.totalPrice !== undefined && { totalPrice: data.totalPrice }),
      },
    });
  },

  async update(id: string, ownerId: string, data: {
    collabType?: string;
    status?: string;
    contentType?: string;
    collabId?: string;
    currency?: string;
    totalPrice?: string;
  }) {
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
  async resolveLinkId(campaignId: string, creatorId: string, ownerId: string, admin = false): Promise<string> {
    await campaignService.getOrThrow(campaignId, ownerId, admin);
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

// ─── Batch Import (structured tables) ────────────────────────────────────────

export const importService = {
  /** 批量导入达人基础数据：按 id upsert Creator。 */
  async importCreators(ownerId: string, items: Record<string, unknown>[]) {
    let created = 0;
    let updated = 0;
    let skipped = 0;
    for (const item of items) {
      const id = String(item.id ?? '');
      const name = String(item.name ?? '');
      if (!id || !name) { skipped++; continue; }
      // 构建 contact / rate JSON
      const contact: Record<string, string> = {};
      for (const k of ['mcn', 'agency', 'email', 'phone', 'contactPerson']) {
        if (item[k]) contact[k] = String(item[k]);
      }
      const rate: Record<string, string> = {};
      for (const k of ['currency', 'ratePost', 'rateVideo', 'rateLive', 'rateNote']) {
        const rk = k === 'ratePost' ? 'post' : k === 'rateVideo' ? 'video' : k === 'rateLive' ? 'live' : k === 'rateNote' ? 'note' : k;
        if (item[k]) rate[rk] = String(item[k]);
      }
      try {
        const existing = await prisma.creator.findUnique({ where: { id } });
        const data = {
          id,
          name,
          handle: String(item.handle ?? ''),
          platform: String(item.platform ?? ''),
          tier: String(item.tier ?? ''),
          followers: String(item.followers ?? ''),
          engagement: String(item.engagement ?? ''),
          category: String(item.category ?? ''),
          region: String(item.region ?? ''),
          ...('avatar' in item && item.avatar ? { avatar: String(item.avatar) } : {}),
          ...('profileUrl' in item && item.profileUrl ? { profileUrl: String(item.profileUrl) } : {}),
          ...('bio' in item && item.bio ? { profile: { bio: String(item.bio) } } : {}),
          ...(Object.keys(contact).length ? { contact } : {}),
          ...(Object.keys(rate).length ? { rate } : {}),
          // 近 90 天数据存入 stats JSON
          ...(('recentPostsCount' in item && item.recentPostsCount) || ('engagementMedian' in item && item.engagementMedian)
            ? {
                stats: {
                  ...('recentPostsCount' in item && item.recentPostsCount ? { recentPostsCount: parseInt(String(item.recentPostsCount), 10) || 0 } : {}),
                  ...('engagementMedian' in item && item.engagementMedian ? { engagementMedian: String(item.engagementMedian) } : {}),
                } as Prisma.InputJsonValue
              }
            : {}),
          ownerId,
        };
        if (existing) {
          await prisma.creator.update({ where: { id }, data });
          updated++;
        } else {
          await prisma.creator.create({ data });
          created++;
        }
      } catch {
        skipped++;
      }
    }
    return { created, updated, skipped };
  },

  /** 批量导入达人受众画像：merge 到 Creator.audience JSON。 */
  async importCreatorAudience(ownerId: string, items: Record<string, unknown>[]) {
    let updated = 0;
    let skipped = 0;
    for (const item of items) {
      const creatorId = String(item.creatorId ?? '');
      if (!creatorId) { skipped++; continue; }
      try {
        const creator = await prisma.creator.findFirst({ where: { id: creatorId, ownerId } });
        if (!creator) { skipped++; continue; }
        const audience = {
          ...(creator.audience as object | null ?? {}),
          genderSplit: [
            ...(item.genderMale ? [{ label: 'Male', value: Number(item.genderMale) }] : []),
            ...(item.genderFemale ? [{ label: 'Female', value: Number(item.genderFemale) }] : []),
          ],
          ageRange: [
            ...(item.age13_17 ? [{ label: '13-17', value: Number(item.age13_17) }] : []),
            ...(item.age18_24 ? [{ label: '18-24', value: Number(item.age18_24) }] : []),
            ...(item.age25_34 ? [{ label: '25-34', value: Number(item.age25_34) }] : []),
            ...(item.age35_44 ? [{ label: '35-44', value: Number(item.age35_44) }] : []),
            ...(item.age45_64 ? [{ label: '45-64', value: Number(item.age45_64) }] : []),
          ],
          topCities: [
            ...(item.topCity1 ? [{ label: String(item.topCity1), value: Number(item.topCity1Pct ?? 0) }] : []),
            ...(item.topCity2 ? [{ label: String(item.topCity2), value: Number(item.topCity2Pct ?? 0) }] : []),
            ...(item.topCity3 ? [{ label: String(item.topCity3), value: Number(item.topCity3Pct ?? 0) }] : []),
          ],
        };
        await prisma.creator.update({ where: { id: creatorId }, data: { audience: audience as unknown as Prisma.InputJsonValue } });
        updated++;
      } catch {
        skipped++;
      }
    }
    return { updated, skipped };
  },

  /** 批量导入达人作品：merge 到 Creator.works JSON 数组。 */
  async importCreatorWorks(ownerId: string, items: Record<string, unknown>[]) {
    let updated = 0;
    let skipped = 0;
    // 按 creatorId 分组
    const grouped = new Map<string, Record<string, unknown>[]>();
    for (const item of items) {
      const creatorId = String(item.creatorId ?? '');
      if (!creatorId) { skipped++; continue; }
      if (!grouped.has(creatorId)) grouped.set(creatorId, []);
      grouped.get(creatorId)!.push(item);
    }
    for (const [creatorId, works] of grouped) {
      try {
        const creator = await prisma.creator.findFirst({ where: { id: creatorId, ownerId } });
        if (!creator) { skipped += works.length; continue; }
        const existing = (creator.works as Record<string, unknown>[] | null) ?? [];
        // 按 workId 去重 merge
        const byId = new Map(existing.map((w) => [String(w.id ?? w.workId ?? ''), w]));
        for (const w of works) {
          const wid = String(w.workId ?? '');
          byId.set(wid, {
            id: wid,
            title: String(w.title ?? ''),
            ...('cover' in w && w.cover ? { cover: String(w.cover) } : {}),
            ...('url' in w && w.url ? { url: String(w.url) } : {}),
            ...('platform' in w && w.platform ? { platform: String(w.platform) } : {}),
            ...('publishedAt' in w && w.publishedAt ? { publishedAt: String(w.publishedAt) } : {}),
            ...('impressions' in w && w.impressions ? { impressions: String(w.impressions) } : {}),
            ...('likes' in w && w.likes ? { likes: String(w.likes) } : {}),
            ...('comments' in w && w.comments ? { comments: String(w.comments) } : {}),
            ...('shares' in w && w.shares ? { shares: String(w.shares) } : {}),
            ...('saves' in w && w.saves ? { saves: String(w.saves) } : {}),
            ...('engagementRate' in w && w.engagementRate ? { engagementRate: String(w.engagementRate) } : {}),
            ...('contentType' in w && w.contentType ? { contentType: String(w.contentType) } : {}),
            ...('hashtags' in w && w.hashtags ? { hashtags: (w.hashtags as string).split(';').map((s) => s.trim()).filter(Boolean) } : {}),
            ...('productLink' in w && w.productLink ? { productLink: String(w.productLink) } : {}),
            ...('duration' in w && w.duration ? { duration: String(w.duration) } : {}),
            ...('featured' in w && w.featured !== undefined ? { featured: w.featured === 'true' || w.featured === '1' || w.featured === 'yes' } : {}),
            // 带货归因 attribution
            ...(('attrClicks' in w && w.attrClicks) || ('attrOrders' in w && w.attrOrders) || ('attrGmv' in w && w.attrGmv) || ('attrCtr' in w && w.attrCtr) || ('attrCvr' in w && w.attrCvr)
              ? {
                  attribution: {
                    ...('attrClicks' in w && w.attrClicks ? { clicks: String(w.attrClicks) } : {}),
                    ...('attrOrders' in w && w.attrOrders ? { orders: String(w.attrOrders) } : {}),
                    ...('attrGmv' in w && w.attrGmv ? { gmv: String(w.attrGmv) } : {}),
                    ...('attrCtr' in w && w.attrCtr ? { ctr: String(w.attrCtr) } : {}),
                    ...('attrCvr' in w && w.attrCvr ? { cvr: String(w.attrCvr) } : {}),
                  }
                }
              : {}),
          });
        }
        await prisma.creator.update({ where: { id: creatorId }, data: { works: [...byId.values()] as unknown as Prisma.InputJsonValue } });
        updated += works.length;
      } catch {
        skipped += works.length;
      }
    }
    return { updated, skipped };
  },

  /** 批量导入合作每日明细：按 (campaignId, creatorId) 归组 → CreatorPerformance.daily JSON。 */
  async importCollaborationDaily(ownerId: string, items: Record<string, unknown>[]) {
    let updated = 0;
    let skipped = 0;
    // 按 campaignId+creatorId 分组
    const grouped = new Map<string, Record<string, unknown>[]>();
    for (const item of items) {
      const key = `${item.campaignId}:${item.creatorId}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(item);
    }
    for (const [key, dailyRows] of grouped) {
      const [campaignId, creatorId] = key.split(':');
      try {
        const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, ownerId } });
        if (!campaign) { skipped += dailyRows.length; continue; }
        const link = await prisma.campaignCreator.findUnique({
          where: { campaignId_creatorId: { campaignId, creatorId } },
        });
        if (!link) { skipped += dailyRows.length; continue; }
        // 按 contentType 进一步归组
        const byContentType = new Map<string, Record<string, unknown>[]>();
        for (const row of dailyRows) {
          const ct = String(row.contentType ?? 'default');
          if (!byContentType.has(ct)) byContentType.set(ct, []);
          byContentType.get(ct)!.push({
            date: String(row.dailyDate ?? ''),
            ...('dailyImpressions' in row && row.dailyImpressions ? { impressions: Number(row.dailyImpressions) } : {}),
            ...('dailyLikes' in row && row.dailyLikes ? { likes: Number(row.dailyLikes) } : {}),
            ...('dailyComments' in row && row.dailyComments ? { comments: Number(row.dailyComments) } : {}),
            ...('dailyShares' in row && row.dailyShares ? { shares: Number(row.dailyShares) } : {}),
            ...('dailySaves' in row && row.dailySaves ? { saves: Number(row.dailySaves) } : {}),
            ...('dailyCpsClicks' in row && row.dailyCpsClicks ? { cpsClicks: Number(row.dailyCpsClicks) } : {}),
            ...('dailyCpsOrders' in row && row.dailyCpsOrders ? { cpsOrders: Number(row.dailyCpsOrders) } : {}),
            ...('dailyCpsGmv' in row && row.dailyCpsGmv ? { cpsGmv: Number(row.dailyCpsGmv) } : {}),
            ...('dailyCpsCommission' in row && row.dailyCpsCommission ? { cpsCommission: Number(row.dailyCpsCommission) } : {}),
          });
        }
        // Merge daily data into CreatorPerformance
        const existingPerf = await prisma.creatorPerformance.findUnique({ where: { campaignCreatorId: link.id } });
        const existingDaily = (existingPerf?.daily as Record<string, unknown>[] | null) ?? [];
        // Merge: append new daily entries by date+contentType key
        const byDate = new Map(existingDaily.map((d) => [`${d.contentType ?? 'default'}:${d.date}`, d]));
        for (const [ct, rows] of byContentType) {
          for (const row of rows) {
            byDate.set(`${ct}:${row.date}`, { ...row, contentType: ct });
          }
        }
        const mergedDaily = [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
        if (existingPerf) {
          await prisma.creatorPerformance.update({
            where: { campaignCreatorId: link.id },
            data: { daily: mergedDaily as unknown as Prisma.InputJsonValue },
          });
        } else {
          await prisma.creatorPerformance.create({
            data: { campaignCreatorId: link.id, summary: {}, daily: mergedDaily as unknown as Prisma.InputJsonValue },
          });
        }
        updated += dailyRows.length;
      } catch {
        skipped += dailyRows.length;
      }
    }
    return { updated, skipped };
  },

  /** 导入 CPS 链接效果汇总（每条链接一行→CpsPerformance upsert）。 */
  async importCpsPerformance(_ownerId: string, items: Record<string, unknown>[]) {
    let updated = 0, skipped = 0;
    for (const item of items) {
      try {
        const campaignId = String(item.campaignId ?? '');
        const creatorId = String(item.creatorId ?? '');
        const contentType = String(item.contentType ?? '');
        if (!campaignId || !creatorId || !contentType) { skipped++; continue; }

        const link = await prisma.campaignCreator.findFirst({
          where: { campaignId, creatorId },
        });
        if (!link) { skipped++; continue; }

        const clicks = parseInt(String(item.clicks ?? '0'), 10) || 0;
        const impressions = parseInt(String(item.impressions ?? '0'), 10) || 0;
        const orders = parseInt(String(item.orders ?? '0'), 10) || 0;
        const gmv = new Prisma.Decimal(parseFloat(String(item.gmv ?? '0').replace(/[$,]/g, '')) || 0);
        const commission = new Prisma.Decimal(parseFloat(String(item.commission ?? '0').replace(/[$,]/g, '')) || 0);
        const spend = new Prisma.Decimal(parseFloat(String(item.spend ?? '0').replace(/[$,]/g, '')) || 0);

        // 维度标签(链接级,空 → null)
        const productName = String(item.productName ?? '').trim() || null;
        const category = String(item.category ?? '').trim() || null;
        const market = String(item.market ?? '').trim() || null;
        const promoName = String(item.promoName ?? '').trim() || null;
        const promoType = String(item.promoType ?? '').trim() || null;

        await prisma.cpsPerformance.upsert({
          where: { campaignCreatorId_contentType: { campaignCreatorId: link.id, contentType } },
          create: {
            campaignCreatorId: link.id,
            contentType,
            linkUrl: String(item.linkUrl ?? '') || null,
            clicks, impressions, orders,
            gmv, commission, spend,
            productName, category, market, promoName, promoType,
          },
          update: {
            linkUrl: String(item.linkUrl ?? '') || null,
            clicks, impressions, orders,
            gmv, commission, spend,
            productName, category, market, promoName, promoType,
          },
        });
        updated++;
      } catch {
        skipped++;
      }
    }
    return { updated, skipped };
  },

  /** 导入订单商品明细（联盟平台订单导出）。幂等：(campaignId, orderId) 重导覆盖。 */
  async importOrders(_ownerId: string, items: Record<string, unknown>[]) {
    let updated = 0, skipped = 0;
    // 同一订单可能拆多行（每商品一行）——先按 orderId 分组
    const grouped = new Map<string, Record<string, unknown>[]>();
    for (const item of items) {
      const campaignId = String(item.campaignId ?? '');
      const orderId = String(item.orderId ?? '');
      if (!campaignId || !orderId) { skipped++; continue; }
      const key = `${campaignId}::${orderId}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(item);
    }

    for (const [key, rows] of grouped) {
      try {
        const [campaignId, orderId] = key.split('::');
        const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
        if (!campaign) { skipped += rows.length; continue; }

        // 达人归属（可选）：campaignId+creatorId → CampaignCreator.id
        let campaignCreatorId: string | null = null;
        const creatorIdRaw = String(rows[0].creatorId ?? '').trim();
        if (creatorIdRaw) {
          const link = await prisma.campaignCreator.findFirst({ where: { campaignId, creatorId: creatorIdRaw } });
          campaignCreatorId = link?.id ?? null;
        }

        // 订单头字段取首行（同单多行应一致）
        const orderDateRaw = String(rows[0].orderDate ?? '').trim();
        const orderDate = orderDateRaw ? new Date(orderDateRaw) : null;
        const orderStatus = String(rows[0].orderStatus ?? '').trim() || null;

        // 商品行
        const itemRows = rows
          .map((r) => {
            const productName = String(r.productName ?? '').trim();
            if (!productName) return null;
            const qty = parseInt(String(r.qty ?? '1'), 10) || 1;
            const unitPrice = new Prisma.Decimal(parseFloat(String(r.unitPrice ?? '0').replace(/[$,]/g, '')) || 0);
            const lineRaw = parseFloat(String(r.lineTotal ?? '0').replace(/[$,]/g, '')) || 0;
            const lineTotal = lineRaw > 0 ? new Prisma.Decimal(lineRaw) : unitPrice.mul(qty);
            return {
              productName,
              category: String(r.category ?? '').trim() || null,
              sku: String(r.sku ?? '').trim() || null,
              qty,
              unitPrice,
              lineTotal,
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);
        if (!itemRows.length) { skipped += rows.length; continue; }

        // 幂等 upsert：重导同单先清空 items 再重建（先查再分支，避免 create+update 双写翻倍）
        const existing = await prisma.campaignOrder.findUnique({
          where: { campaignId_orderId: { campaignId, orderId } },
          select: { id: true },
        });
        if (existing) {
          await prisma.campaignOrder.update({
            where: { id: existing.id },
            data: {
              campaignCreatorId, orderDate, orderStatus,
              items: { deleteMany: {} },   // 清空旧商品行
            },
          });
          await prisma.campaignOrderItem.createMany({
            data: itemRows.map((r) => ({ ...r, campaignOrderId: existing.id })),
          });
        } else {
          await prisma.campaignOrder.create({
            data: {
              campaignId, orderId, campaignCreatorId, orderDate, orderStatus,
              items: { create: itemRows },
            },
          });
        }

        updated++;
      } catch {
        skipped++;
      }
    }
    return { updated, skipped };
  },

  /** 导入 CPS 每日明细（合并到 CpsPerformance.daily JSON）。 */
  async importCpsDaily(_ownerId: string, items: Record<string, unknown>[]) {
    let updated = 0, skipped = 0;
    // 按 (campaignId, creatorId, contentType) 分组
    const grouped = new Map<string, Record<string, unknown>[]>();
    for (const item of items) {
      const key = `${String(item.campaignId)}::${String(item.creatorId)}::${String(item.contentType)}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(item);
    }

    for (const [key, dailyRows] of grouped) {
      try {
        const [campaignId, creatorId, contentType] = key.split('::');
        const link = await prisma.campaignCreator.findFirst({
          where: { campaignId, creatorId },
        });
        if (!link) { skipped += dailyRows.length; continue; }

        const existingCps = await prisma.cpsPerformance.findUnique({
          where: { campaignCreatorId_contentType: { campaignCreatorId: link.id, contentType } },
        });

        // 合并每日数据
        const existingDaily = new Map<string, Record<string, unknown>>();
        if (existingCps?.daily) {
          const arr = (existingCps.daily as unknown as { date: string }[]) || [];
          for (const d of arr) {
            if (d.date) existingDaily.set(d.date, d as Record<string, unknown>);
          }
        }

        for (const row of dailyRows) {
          const date = String(row.date ?? '');
          if (!date) continue;
          existingDaily.set(date, {
            date,
            ...('dailyClicks' in row && row.dailyClicks ? { clicks: String(row.dailyClicks) } : {}),
            ...('dailyImpressions' in row && row.dailyImpressions ? { impressions: String(row.dailyImpressions) } : {}),
            ...('dailyOrders' in row && row.dailyOrders ? { orders: String(row.dailyOrders) } : {}),
            ...('dailyGmv' in row && row.dailyGmv ? { gmv: String(row.dailyGmv).replace(/^[$]/, '') } : {}),
            ...('dailyCommission' in row && row.dailyCommission ? { commission: String(row.dailyCommission).replace(/^[$]/, '') } : {}),
            ...('dailySpend' in row && row.dailySpend ? { spend: String(row.dailySpend).replace(/^[$]/, '') } : {}),
            ...('dailyNewCustomers' in row && row.dailyNewCustomers ? { newCustomers: String(row.dailyNewCustomers) } : {}),
          });
        }

        const mergedDaily = [...existingDaily.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));

        if (existingCps) {
          await prisma.cpsPerformance.update({
            where: { campaignCreatorId_contentType: { campaignCreatorId: link.id, contentType } },
            data: { daily: mergedDaily as unknown as Prisma.InputJsonValue },
          });
        } else {
          await prisma.cpsPerformance.create({
            data: {
              campaignCreatorId: link.id,
              contentType,
              daily: mergedDaily as unknown as Prisma.InputJsonValue,
            },
          });
        }
        updated += dailyRows.length;
      } catch {
        skipped += dailyRows.length;
      }
    }
    return { updated, skipped };
  },
};
