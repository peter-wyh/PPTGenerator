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

        // 订单头字段取首行（同单多行应一致）；Awin 镜像列一并提取
        const orderDateRaw = String(rows[0].orderDate ?? '').trim();
        const orderDate = orderDateRaw ? new Date(orderDateRaw) : null;
        const orderStatus = String(rows[0].orderStatus ?? '').trim() || null;
        const mirrored = mirrorOrderFields(rows[0]);

        // 媒体归因（publisher 维度）：publisherUrl/siteName 域名归一化 → Publisher upsert
        let publisherId: string | null = null;
        const pubDomain = normPublisherDomain(mirrored.publisherUrl) || normPublisherDomain(mirrored.siteName);
        if (pubDomain) {
          const pub = await prisma.publisher.upsert({
            where: { domain: pubDomain },
            create: { name: String(mirrored.siteName || pubDomain).slice(0, 190), domain: pubDomain, type: 'media_site' },
            update: {},
          });
          publisherId = pub.id;
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
              campaignCreatorId, orderDate, orderStatus, publisherId,
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
              campaignId, orderId, campaignCreatorId, orderDate, orderStatus, publisherId,
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

// ─── CPS Overview（合作列表浮窗只读聚合） ────────────────────────────────────
// 口径与 ai-generate.service 的 creators[].cps 一致：
//   成交类（orders/gmv/commission/spend/roas）← CampaignOrder 按 campaignCreatorId × orderDate 聚合（真源：逐单）
//   流量类（clicks/impressions）← CpsPerformance 聚合列 + daily 期内切片（真源：联盟平台链接导出）
//   ctr/cvr/epc 为派生值：ctr=clicks/impressions、cvr=orders/clicks、epc=gmv/clicks
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

    // 2) 链接层：CpsPerformance（聚合列 + daily）
    const links = await prisma.campaignCreator.findMany({
      where: { campaignId, ...(campaignCreatorId ? { id: campaignCreatorId } : {}) },
      select: {
        id: true,
        creator: { select: { name: true, avatar: true } },
        cpsPerformances: {
          select: { contentType: true, linkUrl: true, clicks: true, impressions: true, orders: true, gmv: true, commission: true, spend: true, daily: true },
        },
      },
    });

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
        creatorName: l.creator?.name ?? l.id,
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
      for (const p of l.cpsPerformances) {
        e.traffic.clicks += p.clicks; e.traffic.impressions += p.impressions;
        e.links.push({ contentType: p.contentType, linkUrl: p.linkUrl, clicks: p.clicks, impressions: p.impressions, orders: p.orders, gmv: Number(p.gmv), commission: Number(p.commission), spend: Number(p.spend) });
        for (const d of ((p.daily as Record<string, unknown>[] | null) ?? [])) {
          const date = String(d.date ?? '');
          if (!date) continue;
          const day = e.traffic.daily.get(date) ?? { clicks: 0, impressions: 0 };
          day.clicks += Number(d.clicks) || 0;
          day.impressions += Number(d.impressions) || 0;
          e.traffic.daily.set(date, day);
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
