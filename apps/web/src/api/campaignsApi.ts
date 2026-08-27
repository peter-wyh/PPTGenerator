/**
 * Phase 2 查找表 API（Campaign / Creator / CampaignCreator）。
 * 对接后端 /api/v1/campaigns/* 路由。
 * 全部需登录（按 ownerId 隔离数据）。
 *
 * 兼容策略：新 API 优先，失败时回退 DataRecord（旧路径）。
 */
import { api } from './client';
import type { Campaign, Creator } from '@mediakit/shared';
import { creatorAvatarUrl } from './creatorAvatar';

// ─── DTO ─────────────────────────────────────────────────────────────────────

export interface CampaignDTO {
  id: string;
  name: string;
  platform: string;
  startDate: string;
  endDate: string;
  budget: string;
  status: string | null;
  owner: string | null;
  businessLineId: string | null;
  advertiserId: string | null;
  businessLineCode: string | null;
  advertiserName: string | null;
  metrics: unknown;
  analytics: unknown;
  businessLine?: { id: string; code: string; name: string };
  advertiser?: { id: string; name: string };
  _count?: { campaignCreators: number };
}

/** CampaignDTO → 前端 Campaign 类型（补齐 advertiser/businessLine 字符串）。 */
export function dtoToCampaign(dto: CampaignDTO): Campaign {
  return {
    id: dto.id,
    name: dto.name,
    advertiser: dto.advertiserName ?? dto.advertiser?.name ?? '',
    businessLine: dto.businessLineCode ?? dto.businessLine?.code ?? '',
    platform: dto.platform,
    startDate: dto.startDate,
    endDate: dto.endDate,
    budget: dto.budget,
    status: dto.status ?? undefined,
    owner: dto.owner ?? undefined,
    metrics: dto.metrics as Campaign['metrics'] ?? [],
    // 多选平台回填：DTO 无 platforms 字段时从主 platform 派生（编辑态必填校验依赖）
    platforms: (dto as { platforms?: string[] }).platforms?.length
      ? ((dto as { platforms?: string[] }).platforms as unknown as Campaign['platforms'])
      : dto.platform
        ? ([{ platform: dto.platform, collaborationType: '' }] as Campaign['platforms'])
        : [],
    creatorIds: [],
  };
}

export interface CreatorDTO {
  id: string;
  name: string;
  handle: string;
  platform: string;
  partnerType?: string | null;
  tier: string;
  followers: string;
  engagement: string;
  category: string;
  region: string;
  avatar: string | null;
  profileUrl: string | null;
  contact: unknown;
  rate: unknown;
  metrics: unknown;
  audience: unknown;
  works: unknown;
  stats: unknown;
  profile: unknown;
}

/** CreatorDTO → 前端 Creator 类型。 */
export function dtoToCreator(dto: CreatorDTO): Creator {
  const profile = (dto.profile ?? null) as {
    bio?: string; tags?: string[];
  } | null;
  const contact = (dto.contact ?? null) as Creator['contact'] | null;
  const rate = (dto.rate ?? null) as Creator['rate'] | null;
  // 优先用 DB stats 中的 recentPostsCount / engagementMedian；缺失时不伪造（审计 #15）
  const stats = (dto.stats ?? null) as {
    recentPostsCount?: number; engagementMedian?: string;
  } | null;
  return {
    id: dto.id,
    name: dto.name,
    handle: dto.handle,
    platform: dto.platform,
    partnerType: (dto.partnerType as Creator['partnerType']) ?? 'creator',
    tier: dto.tier as Creator['tier'],
    followers: dto.followers,
    engagement: dto.engagement,
    category: dto.category,
    region: dto.region,
    avatar: dto.avatar ?? creatorAvatarUrl(dto.name),
    metrics: (dto.metrics as Creator['metrics']) ?? [],
    audience: (dto.audience as Creator['audience']) ?? undefined,
    works: (dto.works as Creator['works']) ?? undefined,
    stats: (dto.stats as Creator['stats']) ?? undefined,
    bio: profile?.bio,
    tags: profile?.tags,
    contact: contact ?? undefined,
    rate: rate ?? undefined,
    recentPostsCount: stats?.recentPostsCount,
    engagementMedian: stats?.engagementMedian,
  };
}

export interface CampaignCreatorDTO {
  id: string;
  campaignId: string;
  creatorId: string;
  collabType: string | null;
  status: string | null;
  contentType: string | null;
  collabId: string | null;
  currency: string | null;
  totalPrice: string | null;
  creator?: CreatorDTO;
}

// ─── Performance / Collaboration DTO ─────────────────────────────────────────

export interface PerformanceDTO {
  id: string;
  campaignCreatorId: string;
  summary: Record<string, unknown>;
  posts?: unknown[] | null;
  daily?: unknown[] | null;
  placements?: unknown[] | null;
  cps?: Record<string, unknown> | null;
}

export interface CollaborationDTO {
  id: string;
  campaignCreatorId: string;
  deliverables: unknown[];
  legacyId: string | null;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const campaignsApi = {
  // Campaign
  list: (opts?: { businessLineId?: string; advertiserId?: string; businessLineCode?: string; status?: string }) =>
    api
      .get<{ campaigns: CampaignDTO[] }>('/campaigns', { params: opts })
      .then((r) => r.data.campaigns),
  get: (id: string) =>
    api.get<{ campaign: CampaignDTO }>(`/campaigns/${id}`).then((r) => r.data.campaign),
  create: (data: Partial<CampaignDTO>) =>
    api.post<{ campaign: CampaignDTO }>('/campaigns', data).then((r) => r.data.campaign),
  update: (id: string, data: Partial<CampaignDTO>) =>
    api.patch<{ campaign: CampaignDTO }>(`/campaigns/${id}`, data).then((r) => r.data.campaign),
  remove: (id: string) => api.delete(`/campaigns/${id}`),

  // Creator
  listCreators: (opts?: { platform?: string; tier?: string; category?: string; search?: string }) =>
    api
      .get<{ creators: CreatorDTO[] }>('/campaigns/creators/list', { params: opts })
      .then((r) => r.data.creators),
  getCreator: (id: string) =>
    api.get<{ creator: CreatorDTO }>(`/campaigns/creators/${id}`).then((r) => r.data.creator),
  createCreator: (data: Partial<CreatorDTO>) =>
    api.post<{ creator: CreatorDTO }>('/campaigns/creators', data).then((r) => r.data.creator),
  updateCreator: (id: string, data: Partial<CreatorDTO>) =>
    api.patch<{ creator: CreatorDTO }>(`/campaigns/creators/${id}`, data).then((r) => r.data.creator),
  removeCreator: (id: string) => api.delete(`/campaigns/creators/${id}`),

  // CampaignCreator
  listLinks: (campaignId: string) =>
    api
      .get<{ campaignCreators: CampaignCreatorDTO[] }>(`/campaigns/${campaignId}/creators`)
      .then((r) => r.data.campaignCreators),
  upsertLink: (data: { campaignId: string; creatorId: string; collabType?: string; status?: string; contentType?: string }) =>
    api.post<{ campaignCreator: CampaignCreatorDTO }>('/campaigns/links', data).then((r) => r.data.campaignCreator),
  updateLink: (id: string, data: { collabType?: string; status?: string; contentType?: string }) =>
    api.patch<{ campaignCreator: CampaignCreatorDTO }>(`/campaigns/links/${id}`, data).then((r) => r.data.campaignCreator),
  removeLink: (id: string) => api.delete(`/campaigns/links/${id}`),

  // Performance (by campaignId + creatorId)
  getPerformance: (campaignId: string, creatorId: string) =>
    api
      .get<{ performance: PerformanceDTO | null }>(`/campaigns/${campaignId}/creators/${creatorId}/performance`)
      .then((r) => r.data.performance),
  upsertPerformance: (campaignId: string, creatorId: string, data: Partial<PerformanceDTO>) =>
    api
      .put<{ performance: PerformanceDTO }>(`/campaigns/${campaignId}/creators/${creatorId}/performance`, data)
      .then((r) => r.data.performance),

  // Collaboration (by campaignId + creatorId)
  getCollaboration: (campaignId: string, creatorId: string) =>
    api
      .get<{ collaboration: CollaborationDTO | null }>(`/campaigns/${campaignId}/creators/${creatorId}/collaboration`)
      .then((r) => r.data.collaboration),
  upsertCollaboration: (campaignId: string, creatorId: string, data: { deliverables: unknown }) =>
    api
      .put<{ collaboration: CollaborationDTO }>(`/campaigns/${campaignId}/creators/${creatorId}/collaboration`, data)
      .then((r) => r.data.collaboration),

  // Analytics (Campaign 级分析数据)
  getAnalytics: (campaignId: string) =>
    api.get<{ analytics: Record<string, unknown> | null }>(`/campaigns/${campaignId}/analytics`).then((r) => r.data.analytics),
  updateAnalytics: (campaignId: string, analytics: Record<string, unknown>) =>
    api.put<{ analytics: Record<string, unknown> }>(`/campaigns/${campaignId}/analytics`, { analytics }).then((r) => r.data.analytics),

  // ─── Batch Import (structured tables) ───────────────────────────────────────
  importCreators: (items: Record<string, unknown>[]) =>
    api.post<{ created: number; updated: number; skipped: number }>('/campaigns/import/creators', { items }).then((r) => r.data),
  importCreatorAudience: (items: Record<string, unknown>[]) =>
    api.post<{ created: number; updated: number; skipped: number }>('/campaigns/import/creator-audience', { items }).then((r) => r.data),
  importCreatorWorks: (items: Record<string, unknown>[]) =>
    api.post<{ created: number; updated: number; skipped: number }>('/campaigns/import/creator-works', { items }).then((r) => r.data),
  importCollaborationDaily: (items: Record<string, unknown>[]) =>
    api.post<{ created: number; updated: number; skipped: number }>('/campaigns/import/collaboration-daily', { items }).then((r) => r.data),
  importOrders: (items: Record<string, unknown>[]) =>
    api.post<{ created: number; updated: number; skipped: number }>('/campaigns/import/orders', { items }).then((r) => r.data),
  /** 订单明细列表（数据管理页）：campaign 筛选 + 分页，含 items/campaign/creator 展开。 */
  listOrders: (params: { campaignId?: string; page?: number; pageSize?: number }) =>
    api.get<OrdersPage>('/campaigns/orders/list', { params }).then((r) => r.data),
  /** 导入链接效果（Click References CSV 口径）：trackingUrl 必填，域名归一化归因媒体。 */
  importLinkPerformance: (items: Record<string, unknown>[]) =>
    api.post<{ upserted: number; skipped: number }>('/campaigns/import/link-performance', { items }).then((r) => r.data),
  /** TrackingLink 列表（数据管理-链接数据页·链接统计）：真源=订单表 publisherUrl 聚合。creatorId 可选（按达人筛选）。 */
  listLinkPerformances: (params: { campaignId?: string; creatorId?: string; page?: number; pageSize?: number }) =>
    api.get<LinksPageResp>('/campaigns/links/list', { params }).then((r) => r.data),
  /** TrackingLink 按日明细（数据管理-链接数据页·按日明细）：campaignId 必填，creatorId/date 可选。 */
  listLinkDailyStats: (params: { campaignId?: string; creatorId?: string; date?: string; page?: number; pageSize?: number }) =>
    api.get<{ rows: LinkDailyRow[]; total: number; page: number; pageSize: number }>('/campaigns/links/daily', { params }).then((r) => r.data),
  /** 订单日统计（OrderDailyStat 透出）：campaign 必填；creatorBreakdown=true 看 creator×date 行。 */
  listOrderDailyStats: (params: { campaignId: string; creatorBreakdown?: boolean; page?: number; pageSize?: number }) =>
    api.get<StatsPageResp<OrderDailyRow>>('/campaigns/order-daily-stats', { params }).then((r) => r.data),
  /** 媒体日统计（PublisherDailyStat 透出）：campaign 必填；publisherId/dateFrom/dateTo 可选过滤。 */
  listPublisherDailyStats: (params: { campaignId: string; publisherId?: string; dateFrom?: string; dateTo?: string; page?: number; pageSize?: number }) =>
    api.get<StatsPageResp<PublisherDailyRow>>('/campaigns/publisher-daily-stats', { params }).then((r) => r.data),
  /** 媒体×日 tab 媒体下拉选项：campaign 下有统计行的媒体去重列表。 */
  listPublisherStatPublishers: (campaignId: string) =>
    api.get<{ id: string; name: string; domain: string; type: string }[]>('/campaigns/publisher-stat-publishers', { params: { campaignId } }).then((r) => r.data),
  /** 重算中间层统计：kind=order（OrderDailyStat）/ publisher（PublisherDailyStat）。 */
  recomputeStats: (campaignId: string, kind: 'order' | 'publisher') =>
    api.post<{ rows: number; dropped?: number }>(`/campaigns/${campaignId}/${kind}-stats/recompute`).then((r) => r.data),
  /** CPS 概览（合作浮窗只读聚合）：成交←订单表逐单，流量←CpsPerformance。creatorId/ccId 可选限定单个合作行。 */
  cpsOverview: (campaignId: string, opts?: { ccId?: string; creatorId?: string }) =>
    api.get<CpsOverview>(`/campaigns/${campaignId}/cps-overview`, { params: { ...(opts?.ccId ? { ccId: opts.ccId } : {}), ...(opts?.creatorId ? { creatorId: opts.creatorId } : {}) } }).then((r) => r.data),
  /** 合作行每日 CPS 真源现算（0827 整合：只读，LP.daily + 订单按日 join）。 */
  getCreatorCpsDaily: (campaignId: string, creatorId: string) =>
    api.get<CreatorCpsDailyResp>(`/campaigns/${campaignId}/creators/${creatorId}/cps-daily`).then((r) => r.data),
};

/** /campaigns/:campaignId/creators/:creatorId/cps-daily 响应（真源现算）。 */
export interface CreatorCpsDailyResp {
  campaignId: string;
  campaignCreatorId: string;
  link: { id: string; linkUrl: string | null; linkKey: string } | null;
  totals: { clicks: number; impressions: number; spend: number; orders: number; gmv: number; commission: number };
  daily: Array<{ date: string; clicks: number; impressions: number; spend: number; orders: number; gmv: number; commission: number }>;
  recomputedAt: string;
}

/** /campaigns/:id/cps-overview 响应。 */
export interface CpsOverview {
  campaignId: string;
  rows: Array<{
    campaignCreatorId: string;
    creatorName: string;
    orders: number;
    gmv: string;
    commission: string;
    spend: string;
    roas: string;
    clicks: number;
    impressions: number;
    ctr: string;
    cvr: string;
    epc: string;
    daily: Array<{ date: string; orders?: number; gmv?: string; commission?: string; clicks?: number; impressions?: number }>;
    links: Array<{ contentType: string; linkUrl: string | null; clicks: number; impressions: number; orders: number; gmv: number; commission: number; spend: number }>;
  }>;
}

/** /campaigns/orders/list 响应（listOrders）。 */
export interface OrdersPage {
  rows: OrderRow[];
  total: number;
  page: number;
  pageSize: number;
}

/** /campaigns/links/list 响应（listLinkPerformances）。 */
export interface LinksPageResp {
  rows: LinkRow[];
  total: number;
  page: number;
  pageSize: number;
}

/** TrackingLink 行（链接统计页签）：真源=订单表 publisherUrl 逐单聚合。 */
export interface LinkRow {
  id: string;
  campaignId: string;
  campaignName: string;
  /** 跟踪链接（=订单表「发布商跟踪URL」，带业务线域名+跟踪标识）。 */
  trackingUrl: string | null;
  linkKey: string;
  publisher: { id: string; name: string; domain: string; type: string; creatorId: string | null } | null;
  /** Clicks（媒体链接口径，自 Click References/LinkPerformance 匹配；无匹配=null 显示 —）。 */
  clicks: number | null;
  impressions: number | null;
  orders: number;
  gmv: number;
  commission: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  updatedAt: string | null;
}

/** TrackingLink 按日明细行（按日明细页签）：publisherUrl × date。 */
export interface LinkDailyRow {
  id: string;
  campaignId: string;
  campaignName?: string;
  trackingUrl: string;
  statDate: string;
  publisher: { id: string; name: string; domain: string; type: string; creatorId: string | null } | null;
  orders: number;
  gmv: number;
  commission: number;
}

/** 日统计分页响应（OrderDailyStat / PublisherDailyStat 共用）。 */
export interface StatsPageResp<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 订单日统计行（campaign 聚合或 creator×date）。 */
export interface OrderDailyRow {
  statDate: string;
  campaignCreatorId: string;
  creatorName: string | null;
  orders: number;
  approvedOrders: number;
  pendingOrders: number;
  otherOrders: number;
  commission: number;
  approvedCommission: number;
  pendingCommission: number;
  newCustomerOrders: number;
  hasNewCustomerTag: boolean;
  topCountries: Array<{ country: string; orders: number; commission: number }>;
  topDevices: Array<{ device: string; orders: number }>;
  recomputedAt: string;
}

/** 媒体日统计行（publisher × 日，成交+流量双口径）。 */
export interface PublisherDailyRow {
  statDate: string;
  publisherId: string;
  publisher: { id: string; name: string; domain: string; type: string; creatorId: string | null } | null;
  clicks: number;
  impressions: number;
  orders: number;
  gmv: number;
  commission: number;
  recomputedAt: string;
}

/** 订单行（含商品明细展开）。 */
export interface OrderRow {
  id: string;
  campaignId: string;
  campaign: { id: string; name: string };
  campaignCreator?: { id: string; creator: { name: string; avatar?: string | null } } | null;
  /** 媒体归因（2026-08-25 数据结构升级：订单先归因链接/媒体，达人只是媒体类型之一）。 */
  publisher?: { id: string; name: string; domain: string; type: string } | null;
  orderId: string;
  orderDate: string | null;
  orderStatus: string | null;
  createdAt: string;
  items: { id: string; productName: string; category?: string | null; sku?: string | null; qty: number; unitPrice: string; lineTotal: string }[];
  /**
   * Awin transactions 镜像字段（可空——仅联盟导出导入的订单有值）。
   * 43 列中 order_reference/date/commission_status 由 orderId/orderDate/orderStatus 承接，
   * 此处为其余 40 列；Decimal 序列化为 string，DateTime 序列化为 ISO string。
   */
  awinId?: string | null;
  advertiserId?: string | null;
  saleAmount?: string | null;
  commission?: string | null;
  validationDate?: string | null;
  clickRef?: string | null;
  type?: string | null;
  siteName?: string | null;
  url?: string | null;
  declineReason?: string | null;
  clickThroughTime?: string | null;
  voucherCodeUsed?: string | null;
  lapseTime?: number | null;
  amended?: string | null;
  amendReason?: string | null;
  oldSaleAmount?: string | null;
  oldCommission?: string | null;
  differentCurrency?: string | null;
  clickDevice?: string | null;
  transactionDevice?: string | null;
  publisherUrl?: string | null;
  transactionParts?: string | null;
  customerCountry?: string | null;
  customParameters?: string | null;
  paidToPublisher?: string | null;
  paymentStatus?: string | null;
  paymentId?: string | null;
  transactionQueryId?: string | null;
  clickRef2?: string | null;
  clickRef3?: string | null;
  clickRef4?: string | null;
  clickRef5?: string | null;
  clickRef6?: string | null;
  voucherCode?: string | null;
  commissionSharingPublisherId?: string | null;
  commissionSharingPublisher?: string | null;
  commissionSharingSelectedRatePublisherId?: string | null;
  products?: string | null;
  campaignLabel?: string | null;
  customerAcquisition?: string | null;
}
