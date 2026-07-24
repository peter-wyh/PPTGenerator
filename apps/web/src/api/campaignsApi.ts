/**
 * Phase 2 查找表 API（Campaign / Creator / CampaignCreator）。
 * 对接后端 /api/v1/campaigns/* 路由。
 * 全部需登录（按 ownerId 隔离数据）。
 *
 * 兼容策略：新 API 优先，失败时回退 DataRecord（旧路径）。
 */
import { api } from './client';
import type { Campaign, Creator } from '@mediaket/shared';
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
    platforms: [],
    creatorIds: [],
  };
}

export interface CreatorDTO {
  id: string;
  name: string;
  handle: string;
  platform: string;
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

/** 简单字符串哈希，用于派生确定性 mock 值。 */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** 把 "1.28M" / "684K" / "54K" 等粉丝数解析为数字。 */
function parseFollowers(s: string | undefined): number {
  if (!s) return 10000;
  const m = s.replace(/[,\s]/g, '').match(/([\d.]+)([KkMm]?)/);
  if (!m) return 10000;
  const num = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === 'm') return Math.round(num * 1_000_000);
  if (unit === 'k') return Math.round(num * 1000);
  return Math.round(num);
}

/** 根据 creator 基础信息派生"近 90 天作品数"（确定性）。 */
function deriveRecentPosts(name: string, tier: string): number {
  // tier 越大越频繁发帖；mega 90 天约 30-60 条，macro 20-40，micro 10-25
  const base = { mega: 45, macro: 30, micro: 18 }[tier] ?? 25;
  const jitter = hashStr(name) % 20; // 0-19
  return base - 10 + jitter;
}

/** 根据 creator 基础信息派生"近 90 天互动中位数"（确定性，带单位字符串）。 */
function deriveEngagementMedian(name: string, followers: string, engagement: string): string {
  const followersNum = parseFollowers(followers);
  const engRate = parseFloat((engagement || '5').replace('%', '')) / 100;
  // 互动中位数 ≈ 粉丝数 × 互动率 × [0.4, 1.0] 的抖动因子
  const jitterFactor = 0.4 + (hashStr(name + '_med') % 60) / 100; // 0.4-1.0
  const raw = Math.round(followersNum * engRate * jitterFactor);
  if (raw >= 1_000_000) return `${(raw / 1_000_000).toFixed(2)}M`;
  if (raw >= 1000) return `${(raw / 1000).toFixed(1)}K`;
  return String(raw);
}

/** CreatorDTO → 前端 Creator 类型。 */
export function dtoToCreator(dto: CreatorDTO): Creator {
  const profile = (dto.profile ?? null) as {
    bio?: string; tags?: string[];
  } | null;
  const contact = (dto.contact ?? null) as Creator['contact'] | null;
  const rate = (dto.rate ?? null) as Creator['rate'] | null;
  // 优先用 DB stats 中的 recentPostsCount / engagementMedian；缺失时派生确定性 mock
  const stats = (dto.stats ?? null) as {
    recentPostsCount?: number; engagementMedian?: string;
  } | null;
  return {
    id: dto.id,
    name: dto.name,
    handle: dto.handle,
    platform: dto.platform,
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
    recentPostsCount: stats?.recentPostsCount ?? deriveRecentPosts(dto.name, dto.tier),
    engagementMedian: stats?.engagementMedian ?? deriveEngagementMedian(dto.name, dto.followers, dto.engagement),
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

  // ─── Batch Import (structured tables) ───────────────────────────────────────
  importCreators: (items: Record<string, unknown>[]) =>
    api.post<{ created: number; updated: number; skipped: number }>('/campaigns/import/creators', { items }).then((r) => r.data),
  importCreatorAudience: (items: Record<string, unknown>[]) =>
    api.post<{ created: number; updated: number; skipped: number }>('/campaigns/import/creator-audience', { items }).then((r) => r.data),
  importCreatorWorks: (items: Record<string, unknown>[]) =>
    api.post<{ created: number; updated: number; skipped: number }>('/campaigns/import/creator-works', { items }).then((r) => r.data),
  importCollaborationDaily: (items: Record<string, unknown>[]) =>
    api.post<{ created: number; updated: number; skipped: number }>('/campaigns/import/collaboration-daily', { items }).then((r) => r.data),
  importCps: (items: Record<string, unknown>[]) =>
    api.post<{ created: number; updated: number; skipped: number }>('/campaigns/import/cps', { items }).then((r) => r.data),
  importCpsDaily: (items: Record<string, unknown>[]) =>
    api.post<{ created: number; updated: number; skipped: number }>('/campaigns/import/cps-daily', { items }).then((r) => r.data),
};
