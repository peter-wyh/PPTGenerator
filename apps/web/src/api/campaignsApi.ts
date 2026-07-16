/**
 * Phase 2 查找表 API（Campaign / Creator / CampaignCreator）。
 * 对接后端 /api/v1/campaigns/* 路由。
 * 全部需登录（按 ownerId 隔离数据）。
 *
 * 兼容策略：新 API 优先，失败时回退 DataRecord（旧路径）。
 */
import { api } from './client';
import type { Campaign, Creator } from '@mediaket/shared';

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
  metrics: unknown;
  audience: unknown;
  works: unknown;
}

/** CreatorDTO → 前端 Creator 类型。 */
export function dtoToCreator(dto: CreatorDTO): Creator {
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
    metrics: dto.metrics as Creator['metrics'] ?? [],
  };
}

export interface CampaignCreatorDTO {
  id: string;
  campaignId: string;
  creatorId: string;
  collabType: string | null;
  status: string | null;
  contentType: string | null;
  creator?: CreatorDTO;
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
};
