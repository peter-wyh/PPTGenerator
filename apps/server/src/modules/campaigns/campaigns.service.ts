import { prisma } from '../../prisma';
import { ApiError } from '../../utils/ApiError';
import { Prisma } from '@prisma/client';
import { recomputeOrderStats } from './order-stats.service';
import { recomputePublisherStats } from './publisher-stats.service';

// ─── 导入链帮手（媒体归因 / 商品主档） ────────────────────────────────────────

/** 域名归一化：小写、去协议/www、截取主域。null = 解析不出。 */
export function normPublisherDomain(raw: unknown): string | null {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
  const m = s.match(/^([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})/);
  if (m) return m[1];
  // 非域名形态（如 facebook 群组标识）——原样去路径作键
  const first = s.split('/')[0];
  return first || null;
}

/** 商品主档 upsert：(name, sku) 匹配；命中补 category，未命中建行。 */
export async function ensureProduct(name: string, sku: string | null, category: string | null): Promise<string> {
  const existing = await prisma.product.findFirst({ where: { name, sku }, select: { id: true, category: true } });
  if (existing) {
    if (category && !existing.category) await prisma.product.update({ where: { id: existing.id }, data: { category } });
    return existing.id;
  }
  const created = await prisma.product.create({ data: { name, sku, category } });
  return created.id;
}

// ─── Campaign ────────────────────────────────────────────────────────────────

export const campaignService = {
  async list(opts: {
    ownerId: string;
    admin?: boolean;
    /** 业务线账号归属 code：传入则可见本线全部 campaign（含他人创建）。 */
    viewerBusinessLineCode?: string | null;
    businessLineId?: string;
    advertiserId?: string;
    businessLineCode?: string;
    status?: string;
  }) {
    // 三态可见性（与 projects canManageProject 对齐）：ADMIN 全局；业务线账号看本线全部；其余只看自己
    const where: Prisma.CampaignWhereInput = opts.admin
      ? {}
      : opts.viewerBusinessLineCode
        ? { businessLine: { code: opts.viewerBusinessLineCode } }
        : { ownerId: opts.ownerId };
    if (opts.businessLineId) where.businessLineId = opts.businessLineId;
    if (opts.advertiserId) where.advertiserId = opts.advertiserId;
    if (opts.businessLineCode) where.businessLineCode = opts.businessLineCode;
    if (opts.status) where.status = opts.status;
    return prisma.campaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        businessLine: { select: { id: true, code: true, title: true } },
        advertiser: { select: { id: true, name: true } },
        _count: { select: { campaignCreators: true } },
      },
    });
  },

  /**
   * Campaign 访问判定（0825 三态，与 projects canManageProject 对齐）：
   * owner / ADMIN / 同业务线账号（FK businessLine.code 或冗余 businessLineCode 匹配）。
   * 不可见时 404（不泄露存在性）。
   */
  async getOrThrow(id: string, ownerId: string, admin = false) {
    const rec = await prisma.campaign.findUnique({
      where: { id },
      include: { businessLine: { select: { code: true } } },
    });
    if (!rec) throw ApiError.notFound('Campaign not found');
    if (admin || rec.ownerId === ownerId) return rec;
    const u = await prisma.user.findUnique({ where: { id: ownerId }, select: { businessLineCode: true } });
    const campBl = rec.businessLine?.code ?? rec.businessLineCode;
    if (u?.businessLineCode && campBl && campBl === u.businessLineCode) return rec;
    throw ApiError.notFound('Campaign not found');
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
          publisher: { select: { id: true, name: true, domain: true, type: true } },
        },
      }),
      prisma.campaignOrder.count({ where }),
    ]);
    return { rows, total, page, pageSize };
  },

  /**
   * TrackingLink 列表（数据管理-链接数据页·链接统计页签）。
   * ★ 真源 = CampaignOrder.publisherUrl（=订单表「发布商跟踪URL」，带业务线域名+跟踪标识）。
   *   每条唯一 publisherUrl 聚合一行：orders=单数、GMV=Σ saleAmount、Commission=Σ 订单佣金。
   *   clicks/impressions 属媒体链接口径（Click References），订单表无此维度，不在此页展示。
   * 媒体归因：clickRef 域名（媒体实际投放链接）→ Publisher；publisherUrl 域名(dc.digchic.com)只是
   * 业务线跟踪域名，不归因媒体。
   */
  async listLinkPerformances(
    _ownerId: string,
    opts: { campaignId?: string; creatorId?: string; page?: number; pageSize?: number; admin?: boolean } = {},
  ) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
    const r = await aggregateTrackingLinks({ campaignId: opts.campaignId, creatorId: opts.creatorId });
    const total = r.rows.length;
    const pageRows = r.rows.slice((page - 1) * pageSize, page * pageSize);
    return { rows: pageRows, total, page, pageSize };
  },

  /**
   * TrackingLink 按日明细（数据管理-链接数据页·按日明细页签）。
   * 每 (publisherUrl × DATE(orderDate)) 一行，媒体归因口径同上。
   */
  async listLinkDailyStats(
    _ownerId: string,
    opts: { campaignId?: string; creatorId?: string; date?: string; page?: number; pageSize?: number } = {},
  ) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 50));
    let ccFilter = Prisma.empty;
    if (opts.creatorId) {
      const cc = await prisma.campaignCreator.findFirst({ where: { campaignId: opts.campaignId ?? undefined, creatorId: opts.creatorId }, select: { id: true } });
      ccFilter = cc
        ? Prisma.sql` AND campaignCreatorId = ${cc.id}`
        : Prisma.sql` AND 1 = 0`;
    }
    const campFilter = opts.campaignId ? Prisma.sql` AND campaignId = ${opts.campaignId}` : Prisma.empty;
    const rows = await prisma.$queryRaw<Array<{
      campaignId: string; trackingUrl: string; d: string; cnt: bigint; sale: unknown; comm: unknown;
    }>>(Prisma.sql`
      SELECT campaignId, publisherUrl AS trackingUrl,
             DATE_FORMAT(orderDate, '%Y-%m-%d') AS d,
             COUNT(*) AS cnt,
             COALESCE(SUM(saleAmount), 0) AS sale,
             COALESCE(SUM(commission), 0) AS comm
      FROM CampaignOrder
      WHERE publisherUrl IS NOT NULL AND publisherUrl != ''
        AND orderDate IS NOT NULL${ccFilter}${campFilter}
        ${opts.date ? Prisma.sql`AND DATE_FORMAT(orderDate, '%Y-%m-%d') = ${opts.date}` : Prisma.empty}
      GROUP BY campaignId, publisherUrl, d`);
    if (!rows.length) return { rows: [], total: 0, page, pageSize };
    // 媒体归因：clickRef 域名众数（单遍 GROUP BY 后取首见——全量模式下行数=URL×日期数，mediaOfUrl 逐行查询会超时）
    const mediaAgg = await prisma.$queryRawUnsafe<Array<{ campaignId: string; trackingUrl: string; host: string; n: bigint }>>(`
      SELECT campaignId, publisherUrl AS trackingUrl,
             LOWER(SUBSTRING_INDEX(SUBSTRING_INDEX(clickRef, '//', -1), '/', 1)) AS host,
             COUNT(*) AS n
      FROM CampaignOrder
      WHERE publisherUrl IS NOT NULL AND publisherUrl != '' AND clickRef IS NOT NULL AND clickRef != ''
      GROUP BY campaignId, publisherUrl, host
      ORDER BY n DESC`);
    const mediaMap = new Map<string, string>();
    for (const m of mediaAgg) {
      const key = m.campaignId + '' + m.trackingUrl;
      if (!mediaMap.has(key)) mediaMap.set(key, m.host);
    }
    // publisher 主档批量反查
    const hosts = [...new Set([...mediaMap.values()])];
    const pubs = hosts.length
      ? await prisma.publisher.findMany({ where: { domain: { in: hosts } }, select: { id: true, name: true, domain: true, type: true, creatorId: true } })
      : [];
    const pubByDomain = new Map(pubs.map((x) => [x.domain, x]));
    // campaign 名
    const campIds = [...new Set(rows.map((r) => r.campaignId))];
    const camps = campIds.length
      ? await prisma.campaign.findMany({ where: { id: { in: campIds } }, select: { id: true, name: true } })
      : [];
    const campMap = new Map(camps.map((c) => [c.id, c.name]));

    const detail = rows.map((r) => {
      const mediaHost = mediaMap.get(r.campaignId + '' + r.trackingUrl) ?? null;
      let pub = mediaHost ? pubByDomain.get(mediaHost) : undefined;
      if (!pub && mediaHost) pub = pubByDomain.get(mediaHost.replace(/^www\./, ''));
      const domain = pub?.domain ?? mediaHost?.replace(/^www\./, '') ?? null;
      return {
        id: `${r.campaignId}:${r.trackingUrl}:${r.d}`,
        campaignId: r.campaignId,
        campaignName: campMap.get(r.campaignId) ?? r.campaignId,
        trackingUrl: r.trackingUrl,
        statDate: r.d,
        publisher: pub
          ? { id: pub.id, name: pub.name, domain: pub.domain, type: pub.type, creatorId: pub.creatorId }
          : domain ? { id: '', name: domain, domain, type: 'media_site', creatorId: null } : null,
        orders: Number(r.cnt),
        gmv: decNum(r.sale),
        commission: decNum(r.comm),
      };
    });
    detail.sort((a, b) => b.statDate.localeCompare(a.statDate) || b.orders - a.orders || a.campaignId.localeCompare(b.campaignId));
    const total = detail.length;
    return { rows: detail.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
  },

  /** 订单日统计列表（OrderDailyStat 透出）：campaign 聚合行 + creator×date 行分页。 */
  async listOrderDailyStats(
    opts: { campaignId?: string; page?: number; pageSize?: number; creatorBreakdown?: boolean } = {},
  ) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 50));
    if (!opts.campaignId) return { rows: [], total: 0, page, pageSize };
    const where: Prisma.OrderDailyStatWhereInput = {
      campaignId: opts.campaignId,
      ...(opts.creatorBreakdown === true
        ? { campaignCreatorId: { not: '' } }
        : { campaignCreatorId: '' }),
    };
    const [rows, total] = await Promise.all([
      prisma.orderDailyStat.findMany({
        where,
        orderBy: { statDate: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.orderDailyStat.count({ where }),
    ]);
    // creator 名补充：OrderDailyStat 无 Prisma 关系，按 campaignCreatorId 反查 CampaignCreator
    const ccIds = [...new Set(rows.map((r) => r.campaignCreatorId).filter((x) => x && x !== ''))];
    const ccMap = new Map<string, string>();
    if (ccIds.length) {
      const ccs = await prisma.campaignCreator.findMany({
        where: { id: { in: ccIds } },
        include: { creator: { select: { name: true } } },
      });
      for (const cc of ccs) ccMap.set(cc.id, cc.creator?.name ?? '');
    }
    return {
      rows: rows.map((r) => ({
        statDate: r.statDate,
        campaignCreatorId: r.campaignCreatorId,
        creatorName: ccMap.get(r.campaignCreatorId) ?? null,
        orders: r.totalOrders,
        approvedOrders: r.approvedOrders,
        pendingOrders: r.pendingOrders,
        otherOrders: r.otherOrders,
        commission: Number(r.totalCommission),
        approvedCommission: Number(r.approvedCommission),
        pendingCommission: Number(r.pendingCommission),
        newCustomerOrders: r.newCustomerOrders,
        hasNewCustomerTag: r.hasNewCustomerTag,
        topCountries: r.topCountries ?? [],
        topDevices: r.topDevices ?? [],
        recomputedAt: r.recomputedAt,
      })),
      total, page, pageSize,
    };
  },

  /** 媒体日统计列表（PublisherDailyStat 透出）：publisher × 日，成交+流量双口径。 */
  async listPublisherDailyStats(
    opts: { campaignId?: string; publisherId?: string; page?: number; pageSize?: number } = {},
  ) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 50));
    if (!opts.campaignId) return { rows: [], total: 0, page, pageSize };
    const where: Prisma.PublisherDailyStatWhereInput = {
      campaignId: opts.campaignId,
      ...(opts.publisherId ? { publisherId: opts.publisherId } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.publisherDailyStat.findMany({
        where,
        orderBy: [{ statDate: 'asc' }, { publisherId: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { publisher: { select: { id: true, name: true, domain: true, type: true, creatorId: true } } },
      }),
      prisma.publisherDailyStat.count({ where }),
    ]);
    return {
      rows: rows.map((r) => ({
        statDate: r.statDate,
        publisherId: r.publisherId,
        publisher: r.publisher,
        clicks: r.clicks,
        impressions: r.impressions,
        orders: r.orders,
        gmv: Number(r.gmv),
        commission: Number(r.commission),
        recomputedAt: r.recomputedAt,
      })),
      total, page, pageSize,
    };
  },
};

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
        // ★ 0826 口径：合作 1:1 链接——列表透出 trackingLink（null=未建链）。
        linkPerformance: {
          select: { id: true, linkUrl: true, linkKey: true, clicks: true, orders: true },
        },
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

// Awin transactions 导出字段镜像：camelCase key -> 值 coerce；空串统一转 null。
// 订单级核心三列（order_reference/date/commission_status）由 orderId/orderDate/orderStatus
// 承接，不在此字典；镜像值保持原样（yes/no 枚举不转 boolean）。
const ORDER_MIRROR_FIELDS: Record<string, (v: string) => unknown> = {
  awinId: (v) => v,
  advertiserId: (v) => v,
  saleAmount: (v) => { const f = parseFloat(v); return Number.isFinite(f) ? new Prisma.Decimal(f) : null; },
  commission: (v) => { const f = parseFloat(v); return Number.isFinite(f) ? new Prisma.Decimal(f) : null; },
  validationDate: (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; },
  clickRef: (v) => v,
  type: (v) => v,
  siteName: (v) => v,
  url: (v) => v,
  declineReason: (v) => v,
  clickThroughTime: (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; },
  voucherCodeUsed: (v) => v,
  lapseTime: (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; },
  amended: (v) => v,
  amendReason: (v) => v,
  oldSaleAmount: (v) => { const f = parseFloat(v); return Number.isFinite(f) ? new Prisma.Decimal(f) : null; },
  oldCommission: (v) => { const f = parseFloat(v); return Number.isFinite(f) ? new Prisma.Decimal(f) : null; },
  differentCurrency: (v) => v,
  clickDevice: (v) => v,
  transactionDevice: (v) => v,
  publisherUrl: (v) => v,
  transactionParts: (v) => v,
  customerCountry: (v) => v,
  customParameters: (v) => v,
  paidToPublisher: (v) => v,
  paymentStatus: (v) => v,
  paymentId: (v) => v,
  transactionQueryId: (v) => v,
  clickRef2: (v) => v,
  clickRef3: (v) => v,
  clickRef4: (v) => v,
  clickRef5: (v) => v,
  clickRef6: (v) => v,
  voucherCode: (v) => v,
  commissionSharingPublisherId: (v) => v,
  commissionSharingPublisher: (v) => v,
  commissionSharingSelectedRatePublisherId: (v) => v,
  products: (v) => v,
  campaignLabel: (v) => v,
  customerAcquisition: (v) => v,
};

/** 从导入行提取 Awin 镜像字段（未出现的 key 跳过，空串 → null）。 */
function mirrorOrderFields(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, coerce] of Object.entries(ORDER_MIRROR_FIELDS)) {
    if (!(key in row)) continue;
    const v = String(row[key] ?? '').trim();
    out[key] = v === '' ? null : coerce(v);
  }
  return out;
}

// ─── TrackingLink 聚合帮手（真源 = CampaignOrder.publisherUrl） ────────────────
// 口径（用户定稿 0826）：「链接」数据表 = TrackingLink。
//   trackingUrl = 订单表「发布商跟踪URL」（publisherUrl，带业务线域名+跟踪标识）；
//   统计按 trackingUrl 关联订单：Orders=单数、GMV=Σ saleAmount、Commission=Σ 订单佣金。
//   clicks/impressions 属媒体链接口径（Click References / LinkPerformance），不混入本表。

/** SQL SUM 结果（string/Decimal/null）→ number。 */
function decNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * 聚合 campaign（可省=全部）的 TrackingLink 行：每条唯一 publisherUrl 一行。
 * 媒体归因：该 URL 下订单 clickRef 域名的众数 → Publisher 主档（实测每条跟踪 URL 严格
 * 对应单一媒体域名，众数即稳定值；未命中主档时按域名现场归一，不虚构名字）。
 */
async function aggregateTrackingLinks(opts: { campaignId?: string; creatorId?: string }): Promise<{
  rows: Array<{
    id: string; campaignId: string; campaignName: string; trackingUrl: string; linkKey: string;
    publisher: { id: string; name: string; domain: string; type: string; creatorId: string | null } | null;
    clicks: number | null; impressions: number | null;
    orders: number; gmv: number; commission: number;
    firstOrderAt: Date | null; lastOrderAt: Date | null; updatedAt: Date | null;
  }>;
}> {
  // creatorId → campaignCreatorId 过滤（合作详情浮窗跳转按达人筛选 tracking link）
  let ccFilter = '';
  if (opts.creatorId) {
    const cc = await prisma.campaignCreator.findFirst({
      where: { campaignId: opts.campaignId ?? undefined, creatorId: opts.creatorId },
      select: { id: true },
    });
    ccFilter = cc
      ? ` AND campaignCreatorId = '${cc.id.replace(/'/g, "''")}'`
      : ` AND 1 = 0`; // 无合作行 → 空结果
  }
  const campFilter = opts.campaignId
    ? `AND campaignId = '${opts.campaignId.replace(/'/g, "''")}'`
    : '';
  const urlFilter = `publisherUrl IS NOT NULL AND publisherUrl != ''${ccFilter}`;

  // ① 订单聚合：campaign × publisherUrl 一行（单遍全表 GROUP BY）
  const agg = await prisma.$queryRawUnsafe<Array<{
    campaignId: string; trackingUrl: string; cnt: bigint; sale: unknown; comm: unknown;
    firstOrderAt: Date | null; lastOrderAt: Date | null;
  }>>(`
    SELECT campaignId, publisherUrl AS trackingUrl,
           COUNT(*) AS cnt,
           COALESCE(SUM(saleAmount), 0) AS sale,
           COALESCE(SUM(commission), 0) AS comm,
           MIN(orderDate) AS firstOrderAt, MAX(orderDate) AS lastOrderAt
    FROM CampaignOrder
    WHERE ${urlFilter} ${campFilter}
    GROUP BY campaignId, publisherUrl`);

  // ② mediaHost：独立单遍 GROUP BY（每 campaign×URL 取 clickRef 域名计数最高者——众数归因）
  const mediaAgg = await prisma.$queryRawUnsafe<Array<{
    campaignId: string; trackingUrl: string; host: string; n: bigint;
  }>>(`
    SELECT campaignId, publisherUrl AS trackingUrl,
           LOWER(SUBSTRING_INDEX(SUBSTRING_INDEX(clickRef, '//', -1), '/', 1)) AS host,
           COUNT(*) AS n
    FROM CampaignOrder
    WHERE ${urlFilter} ${campFilter} AND clickRef IS NOT NULL AND clickRef != ''
    GROUP BY campaignId, publisherUrl, host
    ORDER BY n DESC`);
  const mediaMap = new Map<string, string>(); // key: campIdurl → host（首见即众数）
  for (const m of mediaAgg) {
    const key = m.campaignId + '\u0001' + m.trackingUrl;
    if (!mediaMap.has(key)) mediaMap.set(key, m.host);
  }

  // ③ clicks/impressions：LinkPerformance 按 linkUrl=publisherUrl 匹配（媒体链接口径补流量侧，未匹配=null）
  const lpRows = (await prisma.linkPerformance.findMany({
    where: opts.campaignId
      ? { OR: [{ campaignId: opts.campaignId }, { linkUrl: { in: agg.map((r) => r.trackingUrl) } }] }
      : {},
    select: { linkUrl: true, clicks: true, impressions: true },
  })).filter((l): l is { linkUrl: string; clicks: number; impressions: number } => !!l.linkUrl);
  const lpByUrl = new Map<string, { clicks: number; impressions: number }>();
  for (const l of lpRows) {
    const prev = lpByUrl.get(l.linkUrl);
    lpByUrl.set(l.linkUrl, {
      clicks: (prev?.clicks ?? 0) + Number(l.clicks ?? 0),
      impressions: (prev?.impressions ?? 0) + Number(l.impressions ?? 0),
    });
  }

  // publisher 主档：按域名批量反查
  const hosts = [...new Set([...mediaMap.values()])];
  const pubs = hosts.length
    ? await prisma.publisher.findMany({ where: { domain: { in: hosts } }, select: { id: true, name: true, domain: true, type: true, creatorId: true } })
    : [];
  const pubByDomain = new Map(pubs.map((x) => [x.domain, x]));
  // campaign 名
  const campIds = [...new Set(agg.map((r) => r.campaignId))];
  const camps = campIds.length
    ? await prisma.campaign.findMany({ where: { id: { in: campIds } }, select: { id: true, name: true } })
    : [];
  const campMap = new Map(camps.map((c) => [c.id, c.name]));

  const rows = agg.map((r) => {
    const mediaHost = mediaMap.get(r.campaignId + '\u0001' + r.trackingUrl) ?? null;
    // clickRef 可能带 www. 前缀——归一化后再查一次
    let pub = mediaHost ? pubByDomain.get(mediaHost) : undefined;
    if (!pub && mediaHost) pub = pubByDomain.get(mediaHost.replace(/^www\./, ''));
    const domain = pub?.domain ?? mediaHost?.replace(/^www\./, '') ?? null;
    const lp = lpByUrl.get(r.trackingUrl) ?? null;
    return {
      id: `${r.campaignId}:${r.trackingUrl}`,
      campaignId: r.campaignId,
      campaignName: campMap.get(r.campaignId) ?? r.campaignId,
      trackingUrl: r.trackingUrl,
      linkKey: domain ?? '',
      publisher: pub
        ? { id: pub.id, name: pub.name, domain: pub.domain, type: pub.type, creatorId: pub.creatorId }
        : domain ? { id: '', name: domain, domain, type: 'media_site', creatorId: null } : null,
      clicks: lp?.clicks ?? null,
      impressions: lp?.impressions ?? null,
      orders: Number(r.cnt),
      gmv: decNum(r.sale),
      commission: decNum(r.comm),
      firstOrderAt: r.firstOrderAt,
      lastOrderAt: r.lastOrderAt,
      updatedAt: r.lastOrderAt,
    };
  });
  rows.sort((a, b) => b.orders - a.orders || a.campaignId.localeCompare(b.campaignId));
  return { rows };
}

/** 单条跟踪 URL 的媒体归因（clickRef 域名众数 → Publisher）——已无调用方（列表/按日均改批量单遍 GROUP BY），删除见本提交。 */

export const importService = {
  /**
   * 导入链接效果（Click References CSV 口径）：一行 = 一条跟踪链接 × campaign 的周期汇总。
   * 链接维度流量/成交数据的唯一入口——替代 cps-daily 的流量侧职责。
   * 字段：campaignId, trackingUrl（必填，linkUrl 为兼容别名）+ clicks/impressions/orders/gmv/commission/spend/sales（可选）。
   * 归因：trackingUrl 域名归一化 → upsert Publisher（siteName 可选补充命名）→ linkKey 唯一。
   */
  /** 链接效果导入（trackingUrl 口径）。周期行（无 date 列）更新标量；每日行（带 date 列）合并进 daily 数组 [{date,clicks,impressions,spend}]。 */
  async importLinkPerformance(_ownerId: string, items: Record<string, unknown>[]) {
    let upserted = 0;
    let skipped = 0;
    // ★ 记录成功写入的 campaign，导入尾部统一重算媒体日统计（PublisherDailyStat）
    const touched = new Set<string>();
    for (const item of items) {
      try {
        const campaignId = String(item.campaignId ?? '');
        const trackingUrl = String(item.trackingUrl ?? item.linkUrl ?? '').trim();
        if (!campaignId || !trackingUrl) { skipped++; continue; }
        const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
        if (!campaign) { skipped++; continue; }
        touched.add(campaignId);

        const linkKey = normPublisherDomain(trackingUrl);
        if (!linkKey) { skipped++; continue; }

        // 媒体主档 upsert（域名归一化；siteName 有值时补充命名）
        const siteName = String(item.siteName ?? '').trim();
        const publisher = await prisma.publisher.upsert({
          where: { domain: linkKey },
          update: siteName ? { name: siteName } : {},
          create: { name: siteName || linkKey, domain: linkKey },
        });

        // ★ 闭环归因：达人型媒体（publisher.creatorId）-> 同 campaign 合作行，直接挂 FK。
        //   1:1 约束冲突（该合作已有别的链接）时留空--宁缺勿假，不覆盖已有绑定。
        let ccId: string | null = null;
        if (publisher.creatorId) {
          const cc = await prisma.campaignCreator.findFirst({
            where: { campaignId, creatorId: publisher.creatorId },
            select: { id: true },
          });
          if (cc) {
            const holder = await prisma.linkPerformance.findFirst({
              where: { campaignCreatorId: cc.id },
              select: { id: true },
            });
            if (!holder) ccId = cc.id;
          }
        }

        const num = (v: unknown) => {
          const n = parseFloat(String(v ?? '').replace(/^[$£]/, '').replace(/,/g, ''));
          return Number.isFinite(n) ? n : null;
        };
        const clicks = num(item.clicks) ?? num(item.allClicks);
        const impressions = num(item.impressions);
        const orders = num(item.orders) ?? num(item.sales);
        const gmv = num(item.gmv) ?? num(item.saleAmount);
        const commission = num(item.commission);
        const spend = num(item.spend);

        // 每日行（带 date 列）：clicks/impressions/spend 视为当日值 → 合并进 daily 数组，不碰周期标量
        const dateVal = String(item.date ?? '').trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
          const existing = await prisma.linkPerformance.findUnique({
            where: { campaignId_publisherId_linkKey: { campaignId, publisherId: publisher.id, linkKey } },
          });
          // 兼容旧 Object 键式（{"2026-11-20":{clicks,impressions}}）→ 统一转数组式
          const prevDaily = Array.isArray(existing?.daily)
            ? (existing!.daily as Record<string, unknown>[])
            : existing?.daily && typeof existing.daily === 'object'
              ? Object.entries(existing.daily as Record<string, Record<string, unknown>>).map(([date, v]) => ({ date, ...v }))
              : [];
          const day = {
            date: dateVal,
            clicks: Math.round(clicks ?? 0),
            impressions: Math.round(impressions ?? 0),
            ...(spend != null ? { spend } : {}),
          };
          const merged = [...prevDaily.filter((d) => String(d.date ?? '') !== dateVal), day]
            .sort((a, b) => String(a.date).localeCompare(String(b.date)));
          if (existing) {
            await prisma.linkPerformance.update({
              where: { id: existing.id },
              data: {
                daily: merged as unknown as Prisma.InputJsonValue,
                ...(ccId ? { campaignCreatorId: ccId } : {}),
              },
            });
          } else {
            await prisma.linkPerformance.create({
              data: {
                campaignId, publisherId: publisher.id, linkUrl: trackingUrl, linkKey,
                ...(ccId ? { campaignCreatorId: ccId } : {}),
                daily: merged as unknown as Prisma.InputJsonValue,
              },
            });
          }
          upserted++;
          continue;
        }

        await prisma.linkPerformance.upsert({
          where: { campaignId_publisherId_linkKey: { campaignId, publisherId: publisher.id, linkKey } },
          update: {
            ...(clicks != null ? { clicks: Math.round(clicks) } : {}),
            ...(impressions != null ? { impressions: Math.round(impressions) } : {}),
            ...(orders != null ? { orders: Math.round(orders) } : {}),
            ...(gmv != null ? { gmv: new Prisma.Decimal(gmv) } : {}),
            ...(commission != null ? { commission: new Prisma.Decimal(commission) } : {}),
            ...(spend != null ? { spend: new Prisma.Decimal(spend) } : {}),
            publisherId: publisher.id,
            ...(ccId ? { campaignCreatorId: ccId } : {}),
          },
          create: {
            campaignId,
            publisherId: publisher.id,
            linkUrl: trackingUrl,
            linkKey,
            ...(ccId ? { campaignCreatorId: ccId } : {}),
            ...(clicks != null ? { clicks: Math.round(clicks) } : {}),
            ...(impressions != null ? { impressions: Math.round(impressions) } : {}),
            ...(orders != null ? { orders: Math.round(orders) } : {}),
            ...(gmv != null ? { gmv: new Prisma.Decimal(gmv) } : {}),
            ...(commission != null ? { commission: new Prisma.Decimal(commission) } : {}),
            ...(spend != null ? { spend: new Prisma.Decimal(spend) } : {}),
          },
        });
        upserted++;
      } catch {
        skipped++;
      }
    }
    // ★ 链接每日明细导入成功 → 重算媒体日统计中间层（PublisherDailyStat 流量侧）。
    //   对齐 importOrders 尾部模式：每 campaign 一次、失败不阻塞导入仅告警；
    //   亦可 POST /campaigns/:id/publisher-stats/recompute 手动补算。
    for (const cid of touched) {
      try {
        const r = await recomputePublisherStats(cid);
        console.log(`[importLinkPerformance] publisher stats recomputed: campaign=${cid} rows=${r.rows}`);
      } catch (err) {
        console.warn(`[importLinkPerformance] publisher stats recompute failed for campaign=${cid}:`, err);
      }
    }
    return { upserted, skipped };
  },

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
            // ★ 0827 整合：CPS 列不再写入互动日数据 JSON——CPS 口径一律走
            // LinkPerformance（importLinkPerformance）+ CampaignOrder（importOrders）真源，
            // 每日聚合由 creatorCpsDailyService.getDaily 现算。历史 cpsClicks/cpsOrders/
            // cpsGmv/cpsCommission 键冻结不清洗（浮窗已不读）。
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

        // 订单头字段取首行（同单多行应一致）；Awin 镜像列一并提取
        const orderDateRaw = String(rows[0].orderDate ?? '').trim();
        const orderDate = orderDateRaw ? new Date(orderDateRaw) : null;
        const orderStatus = String(rows[0].orderStatus ?? '').trim() || null;
        const mirrored = mirrorOrderFields(rows[0]);

        // 媒体归因（publisher 维度）：★ clickRef（媒体实际投放链接）域名归一化 -> Publisher upsert。
        // 不用 publisherUrl 域名--那是业务线跟踪域名（如 dc.digchic.com），全部订单同域，不区分媒体。
        let publisherId: string | null = null;
        // ★ 闭环挂链（0826 定稿：订单来自链接，链接来自媒体合作）。
        //   优先级 1：合作行 -> 该合作的链接（LP.campaignCreatorId 1:1）；publisher 取链接的媒体
        //   （clickRef 是达人主页域名，与链接的跟踪域名不同源--以此避免造出无主媒体）。
        let linkPerformanceId: string | null = null;
        if (campaignCreatorId) {
          const lp = await prisma.linkPerformance.findFirst({
            where: { campaignCreatorId },
            select: { id: true, publisherId: true },
          });
          if (lp) { linkPerformanceId = lp.id; publisherId = lp.publisherId; }
        }
        //   优先级 2（合作行无链接/无合作行）：clickRef 域名 -> Publisher upsert。
        if (!publisherId) {
          const refDomain = normPublisherDomain(mirrored.clickRef)
            || normPublisherDomain(mirrored.publisherUrl)  // clickRef 缺失时退回（宁可挂跟踪域名也不空）
            || normPublisherDomain(mirrored.siteName);
          if (refDomain) {
            const pub = await prisma.publisher.upsert({
              where: { domain: refDomain },
              create: { name: String(mirrored.siteName || refDomain).slice(0, 190), domain: refDomain, type: 'media_site' },
              update: {},
            });
            publisherId = pub.id;
          }
        }
        //   优先级 2 续：同 (campaign, publisher) 唯一链接且归因不冲突（LP.cc 空或=本单 cc）才挂，
        //   防张冠李戴（如 FB 群订单误挂 Fillmyfamily 的 facebook.com 链接）。宁缺勿假。
        if (publisherId && !linkPerformanceId) {
          const lps = await prisma.linkPerformance.findMany({
            where: { campaignId, publisherId },
            select: { id: true, campaignCreatorId: true },
          });
          const [lp] = lps;
          if (lps.length === 1 && (!lp.campaignCreatorId || !campaignCreatorId || lp.campaignCreatorId === campaignCreatorId)) {
            linkPerformanceId = lp.id;
          }
        }

        // 商品行（挂 Product 主档：name+sku 匹配自动 upsert）
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

        const productIds = await Promise.all(
          itemRows.map((r) => ensureProduct(r.productName, r.sku, r.category)),
        );

        // 幂等 upsert：重导同单先清空 items 再重建（先查再分支，避免 create+update 双写翻倍）
        const existing = await prisma.campaignOrder.findUnique({
          where: { campaignId_orderId: { campaignId, orderId } },
          select: { id: true },
        });
        if (existing) {
          await prisma.campaignOrder.update({
            where: { id: existing.id },
            data: {
              campaignCreatorId, orderDate, orderStatus, publisherId, linkPerformanceId,
              ...mirrored,
              items: { deleteMany: {} },   // 清空旧商品行
            },
          });
          await prisma.campaignOrderItem.createMany({
            data: itemRows.map((r, i) => ({ ...r, productId: productIds[i], campaignOrderId: existing.id })),
          });
        } else {
          await prisma.campaignOrder.create({
            data: {
              campaignId, orderId, campaignCreatorId, orderDate, orderStatus, publisherId, linkPerformanceId,
              ...mirrored,
              items: { create: itemRows.map((r, i) => ({ ...r, productId: productIds[i] })) },
            },
          });
        }

        updated++;
      } catch {
        skipped++;
      }
    }

    // ★ 订单导入成功 → 重算日级统计中间层（OrderDailyStat）。
    //   每批每 campaign 一次（非每单一次）；失败不阻塞导入，仅告警——
    //   中间层可随时通过 POST /campaigns/:id/order-stats/recompute 手动补算。
    const campaignIds = new Set([...grouped.keys()].map((k) => k.split('::')[0]));
    for (const cid of campaignIds) {
      try {
        const r = await recomputeOrderStats(cid);
        console.log(`[importOrders] order stats recomputed: campaign=${cid} rows=${r.rows} dropped=${r.dropped}`);
      } catch (err) {
        console.warn(`[importOrders] order stats recompute failed for campaign=${cid}:`, err);
      }
      try {
        const r2 = await recomputePublisherStats(cid);
        console.log(`[importOrders] publisher stats recomputed: campaign=${cid} rows=${r2.rows}`);
      } catch (err) {
        console.warn(`[importOrders] publisher stats recompute failed for campaign=${cid}:`, err);
      }
    }
    return { updated, skipped };
  },

  /**
   * @deprecated cps-daily 导入已废弃（0826 决策：CpsPerformance 冻结只读）。
   * 流量/成本每日数据请用 importLinkPerformance（带 date 列 → daily 数组式同日覆盖）；
   * 成交/新客一律从订单导入（importOrders）现算，无单独导入通道。
   * 保留空实现返回 0，老客户端调用不报错。
   */
  async importCpsDaily(_ownerId: string, _items: Record<string, unknown>[]) {
    return { updated: 0, skipped: 0 };
  },
};

// ─── CPS Overview（合作列表浮窗只读聚合） ────────────────────────────────────
// 口径与 ai-generate.service 的 creators[].cps 一致：
//   成交类（orders/gmv/commission/spend/roas）← CampaignOrder 按 campaignCreatorId × orderDate 聚合（真源：逐单）
//   流量类（clicks/impressions）← CpsPerformance 聚合列 + daily 期内切片（真源：联盟平台链接导出）
//   ctr/cvr/epc 为派生值：ctr=clicks/impressions、cvr=orders/clicks、epc=gmv/clicks
// ─── 合作行每日 CPS 现算（0827 整合：deliverable.cps JSON 冻结退役，浮窗只读真源） ──
export const creatorCpsDailyService = {
  /**
   * 单个合作行（campaignCreatorId）的每日 CPS 真源现算：
   * 流量侧 LinkPerformance.daily + 成交侧订单 GROUP BY DATE(orderDate)。
   * 返回按日 join 后的行（clicks/impressions/orders/gmv/commission），只读。
   */
  async getDaily(campaignId: string, campaignCreatorId: string) {
    // 1:1 直接 FK 拿该合作的 LP 行（0826 闭环后必挂）
    const lp = await prisma.linkPerformance.findUnique({
      where: { campaignCreatorId: campaignCreatorId },
      select: { id: true, linkUrl: true, linkKey: true, clicks: true, impressions: true, orders: true, gmv: true, commission: true, spend: true, daily: true },
    });
    // 成交侧：订单按日聚合（闭环归因标准：直接 FK 优先，LP 兜底——与 cps-source/cpsOverview 同口径）
    const orderRows = await prisma.$queryRaw<Array<{ d: string; cnt: bigint; sale: unknown; comm: unknown }>>(Prisma.sql`
      SELECT DATE_FORMAT(o.orderDate, '%Y-%m-%d') AS d, COUNT(*) AS cnt,
             COALESCE(SUM(o.saleAmount), 0) AS sale, COALESCE(SUM(o.commission), 0) AS comm
      FROM CampaignOrder o
      LEFT JOIN LinkPerformance lp ON lp.id = o.linkPerformanceId
      WHERE COALESCE(o.campaignCreatorId, lp.campaignCreatorId) = ${campaignCreatorId} AND o.orderDate IS NOT NULL
      GROUP BY d`);
    // 流量侧：LP.daily 兼容双格式（数组式 [{date,clicks,...}] / 键值式 {"2026-11-20":{...}}）
    const lpDaily = new Map<string, { clicks: number; impressions: number; spend: number }>();
    if (lp?.daily) {
      const d = lp.daily as unknown;
      if (Array.isArray(d)) {
        for (const row of d as Array<{ date?: string; clicks?: unknown; impressions?: unknown; spend?: unknown }>) {
          if (!row?.date) continue;
          lpDaily.set(String(row.date), {
            clicks: Number(row.clicks ?? 0) || 0,
            impressions: Number(row.impressions ?? 0) || 0,
            spend: Number(row.spend ?? 0) || 0,
          });
        }
      } else if (typeof d === 'object') {
        for (const [date, cell] of Object.entries(d as Record<string, { clicks?: unknown; impressions?: unknown; spend?: unknown }>)) {
          lpDaily.set(date, {
            clicks: Number(cell?.clicks ?? 0) || 0,
            impressions: Number(cell?.impressions ?? 0) || 0,
            spend: Number(cell?.spend ?? 0) || 0,
          });
        }
      }
    }
    // 按日 join
    const byDate = new Map<string, { date: string; clicks: number; impressions: number; spend: number; orders: number; gmv: number; commission: number }>();
    for (const [date, t] of lpDaily) {
      byDate.set(date, { date, ...t, orders: 0, gmv: 0, commission: 0 });
    }
    for (const r of orderRows) {
      const e = byDate.get(r.d) ?? { date: r.d, clicks: 0, impressions: 0, spend: 0, orders: 0, gmv: 0, commission: 0 };
      e.orders = Number(r.cnt);
      e.gmv = Number(r.sale ?? 0);
      e.commission = Number(r.comm ?? 0);
      byDate.set(r.d, e);
    }
    const daily = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    // 周期合计：流量侧（clicks/impressions/spend）用 LP 聚合列真源；
    // 成交侧（orders/gmv/commission）与 cps-overview 同口径——订单表逐单聚合（daily 全量再 SUM），
    // 不用 LP.orders 历史冻结列（0827 整合基准：Σ orders 必须等于订单表现算 20496）。
    const ordersSum = daily.reduce((s, d) => s + d.orders, 0);
    const gmvSum = daily.reduce((s, d) => s + d.gmv, 0);
    const commSum = daily.reduce((s, d) => s + d.commission, 0);
    return {
      campaignId,
      campaignCreatorId,
      link: lp ? { id: lp.id, linkUrl: lp.linkUrl, linkKey: lp.linkKey } : null,
      totals: {
        clicks: lp ? Number(lp.clicks ?? 0) : 0,
        impressions: lp ? Number(lp.impressions ?? 0) : 0,
        spend: lp ? Number(lp.spend ?? 0) : 0,
        orders: ordersSum,
        gmv: gmvSum,
        commission: commSum,
      },
      daily,
      recomputedAt: new Date().toISOString(),
    };
  },
};

export const cpsOverviewService = {
  /**
   * campaign × creator 的 CPS 概览（浮窗只读）。
   * @param opts.campaignCreatorId 可选，限定单个合作行
   * @param opts.creatorId 可选，按 (campaignId, creatorId) 解析到合作行（浮窗行主键是 creatorId）
   */
  async getForCampaign(campaignId: string, opts?: { campaignCreatorId?: string; creatorId?: string }) {
    let campaignCreatorId = opts?.campaignCreatorId;
    if (!campaignCreatorId && opts?.creatorId) {
      const cc = await prisma.campaignCreator.findFirst({
        where: { campaignId, creatorId: opts.creatorId },
        select: { id: true },
      });
      campaignCreatorId = cc?.id ?? '__none__'; // 无合作行 → 空结果（不视为全 campaign）
    }

    // 1) 订单层：逐单聚合（全周期，无日期的单归入 "(无日期)" 桶）
    const orderRows = await prisma.$queryRaw<{
      campaignCreatorId: string | null;
      d: string | null;
      cnt: bigint;
      sale: unknown;
      comm: unknown;
    }[]>(Prisma.sql`
      SELECT campaignCreatorId,
             DATE_FORMAT(orderDate, '%Y-%m-%d') AS d,
             COUNT(*) AS cnt,
             SUM(saleAmount) AS sale,
             SUM(commission) AS comm
      FROM CampaignOrder
      WHERE campaignId = ${campaignId}
      GROUP BY campaignCreatorId, d`);

    // 2) 链接层：CpsPerformance（旧）+ LinkPerformance（新）双读——迁移期两处并存（迁移是复制非移动），
    //    CpsPerformance 行已被复制到 LinkPerformance（migratedFromCpsId 溯源），
    //    旧行跳过防双计；新导入链接只在 LinkPerformance。
    //    达人归因：publisher.creatorId → campaignCreator（达人型媒体）；非达人型只进 campaign 汇总不入 creator 行。
    const ccRows = await prisma.campaignCreator.findMany({
      where: { campaignId, ...(campaignCreatorId ? { id: campaignCreatorId } : {}) },
      select: {
        id: true,
        creatorId: true,
        creator: { select: { name: true, avatar: true } },
        cpsPerformances: {
          select: { id: true, contentType: true, linkUrl: true, clicks: true, impressions: true, orders: true, gmv: true, commission: true, spend: true, daily: true },
        },
      },
    });
    // 已迁移旧行 id 集（防双计）
    const migratedIds = new Set<string>(
      (await prisma.linkPerformance.findMany({
        where: { campaignId },
        select: { migratedFromCpsId: true },
      })).map((x) => x.migratedFromCpsId).filter((x): x is string => !!x),
    );
    // LinkPerformance 按 creator 归因表：publisher.creatorId → ccId
    const lpByCc = new Map<string, {
      contentType: string; linkUrl: string | null; clicks: number; impressions: number; orders: number; gmv: number; commission: number; spend: number;
      daily: Record<string, { clicks: number; impressions: number }>;
    }[]>();
    const campaignLpRows = await prisma.linkPerformance.findMany({
      where: { campaignId },
      include: { publisher: { select: { creatorId: true } } },
    });
    for (const lp of campaignLpRows) {
      const daily = new Map<string, { clicks: number; impressions: number }>();
      for (const d of ((lp.daily as Record<string, unknown>[] | null) ?? [])) {
        const date = String(d.date ?? '');
        if (!date) continue;
        daily.set(date, { clicks: Number(d.clicks) || 0, impressions: Number(d.impressions) || 0 });
      }
      const row = {
        contentType: 'tracking_url',
        linkUrl: lp.linkUrl,
        clicks: lp.clicks, impressions: lp.impressions, orders: lp.orders,
        gmv: Number(lp.gmv), commission: Number(lp.commission), spend: Number(lp.spend),
        daily: Object.fromEntries(daily),
      };
      // ★ 0826 闭环：直接 FK 优先；publisher.creatorId 仅未回填存量兜底
      //（共享域名 publisher 如 facebook.com 无 creatorId，靠间接推导必丢——社群 LP 全靠直接 FK）。
      const ccId = (lp.campaignCreatorId && ccRows.some((cc) => cc.id === lp.campaignCreatorId) ? lp.campaignCreatorId : null)
        ?? (lp.publisher?.creatorId
          ? ccRows.find((cc) => cc.creatorId === lp.publisher?.creatorId)?.id
          : undefined);
      const key = ccId ?? '__campaign__';
      if (!lpByCc.has(key)) lpByCc.set(key, []);
      lpByCc.get(key)!.push(row);
    }
    const links = ccRows.map((l) => ({
      id: l.id,
      creatorName: l.creator?.name ?? l.id,
      rows: [
        ...l.cpsPerformances.filter((p) => !migratedIds.has(p.id)),
        ...lpByCc.get(l.id) ?? [],
      ],
    }));

    // 归并：byCampaignCreator map
    const byCc = new Map<string, {
      creatorName: string;
      /** 订单层聚合（真源）。 */
      orders: { orders: number; gmv: number; commission: number; daily: Map<string, { orders: number; gmv: number; commission: number }> };
      /** 链接层聚合（真源）。 */
      traffic: { clicks: number; impressions: number; daily: Map<string, { clicks: number; impressions: number }> };
      links: { contentType: string; linkUrl: string | null; clicks: number; impressions: number; orders: number; gmv: number; commission: number; spend: number }[];
    }>();
    for (const l of links) {
      byCc.set(l.id, {
        creatorName: l.creatorName,
        orders: { orders: 0, gmv: 0, commission: 0, daily: new Map() },
        traffic: { clicks: 0, impressions: 0, daily: new Map() },
        links: [],
      });
    }
    const ensure = (ccId: string) => {
      let e = byCc.get(ccId);
      if (!e) {
        e = { creatorName: ccId, orders: { orders: 0, gmv: 0, commission: 0, daily: new Map() }, traffic: { clicks: 0, impressions: 0, daily: new Map() }, links: [] };
        byCc.set(ccId, e);
      }
      return e;
    };

    const dec = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
    for (const r of orderRows) {
      const ccId = r.campaignCreatorId ?? '';
      if (campaignCreatorId && ccId !== campaignCreatorId) continue;
      if (!ccId) continue; // 未归因订单不进 creator 行（避免张冠李戴）
      const e = ensure(ccId);
      const sale = dec(r.sale), comm = dec(r.comm), cnt = Number(r.cnt);
      e.orders.orders += cnt; e.orders.gmv += sale; e.orders.commission += comm;
      const date = r.d ?? '(无日期)';
      const day = e.orders.daily.get(date) ?? { orders: 0, gmv: 0, commission: 0 };
      day.orders += cnt; day.gmv += sale; day.commission += comm;
      e.orders.daily.set(date, day);
    }
    for (const l of links) {
      const e = byCc.get(l.id)!;
      for (const p of l.rows) {
        e.traffic.clicks += p.clicks; e.traffic.impressions += p.impressions;
        e.links.push({ contentType: p.contentType, linkUrl: p.linkUrl, clicks: p.clicks, impressions: p.impressions, orders: p.orders, gmv: Number(p.gmv), commission: Number(p.commission), spend: Number(p.spend) });
        const dailyArr = (p as { daily?: unknown }).daily;
        if (Array.isArray(dailyArr)) {
          for (const d of (dailyArr as Record<string, unknown>[])) {
            const date = String(d.date ?? '');
            if (!date) continue;
            const day = e.traffic.daily.get(date) ?? { clicks: 0, impressions: 0 };
            day.clicks += Number(d.clicks) || 0;
            day.impressions += Number(d.impressions) || 0;
            e.traffic.daily.set(date, day);
          }
        } else if (dailyArr && typeof dailyArr === 'object') {
          // LinkPerformance 行的 daily 是 {date: {clicks, impressions}} 对象形态
          for (const [date, t] of Object.entries(dailyArr as Record<string, { clicks?: number; impressions?: number }>)) {
            const day = e.traffic.daily.get(date) ?? { clicks: 0, impressions: 0 };
            day.clicks += Number(t.clicks) || 0;
            day.impressions += Number(t.impressions) || 0;
            e.traffic.daily.set(date, day);
          }
        }
      }
    }

    // 组装输出（含派生率）
    const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(2)}%` : '—');
    const usd = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;
    return {
      campaignId,
      rows: [...byCc.entries()].map(([ccId, e]) => {
        const spend = e.orders.commission * 1.08;
        const roas = spend > 0 ? e.orders.gmv / spend : 0;
        const epc = e.traffic.clicks > 0 ? e.orders.gmv / e.traffic.clicks : 0;
        return {
          campaignCreatorId: ccId,
          creatorName: e.creatorName,
          /** 订单实绩（CampaignOrder 逐单聚合） */
          orders: e.orders.orders,
          gmv: usd(e.orders.gmv),
          commission: usd(e.orders.commission),
          spend: usd(spend),
          roas: roas.toFixed(2),
          /** 链接流量（CpsPerformance） */
          clicks: e.traffic.clicks,
          impressions: e.traffic.impressions,
          ctr: pct(e.traffic.clicks, e.traffic.impressions),
          cvr: pct(e.orders.orders, e.traffic.clicks),
          epc: `$${epc.toFixed(2)}`,
          /** 按日：订单层 gmv/orders/comm + 链接层 clicks/impressions 按日期 join */
          daily: (() => {
            const byDate = new Map<string, Record<string, string | number>>();
            for (const [date, o] of e.orders.daily) byDate.set(date, { date, orders: o.orders, gmv: usd(o.gmv), commission: usd(o.commission) });
            for (const [date, t] of e.traffic.daily) {
              const row = byDate.get(date) ?? { date };
              row.clicks = t.clicks; row.impressions = t.impressions;
              byDate.set(date, row);
            }
            return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
          })(),
          /** 链接明细（contentType × 链接） */
          links: e.links,
        };
      }),
    };
  },
};
