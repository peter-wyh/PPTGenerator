/**
 * 查找表 API（Merchant / BusinessLine / Advertiser）。
 * 对接后端 /api/v1/lookup/* 路由。
 * 读取公开（无需登录）；写操作需登录。
 */
import { api } from './client';
import type { BusinessLine, Merchant, Advertiser, MarketingEvent } from '@mediakit/shared';

// ─── DTO（后端返回的完整行，含关联）─────────────────────────────────────────

export interface MerchantDTO extends Merchant {
  _count?: { businessLines: number; advertisers: number };
}

export interface BusinessLineDTO extends BusinessLine {
  id: string;
  merchantId?: string;
  merchant?: { id: string; name: string };
  _count?: { advertisers: number };
}

export interface AdvertiserDTO extends Advertiser {
  id: string;
  businessLineId: string;
  businessLine?: { id: string; code: string; name: string };
  merchant?: { id: string; name: string };
}

export interface MarketingEventDTO extends MarketingEvent {
  id: string;
  advertiser?: { id: string; name: string; businessLine?: { code: string; name: string } };
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const lookupApi = {
  // Merchant
  listMerchants: () =>
    api.get<{ merchants: MerchantDTO[] }>('/lookup/merchants').then((r) => r.data.merchants),
  getMerchant: (id: string) =>
    api.get<{ merchant: MerchantDTO }>(`/lookup/merchants/${id}`).then((r) => r.data.merchant),
  createMerchant: (data: { name: string; logo?: string }) =>
    api.post<{ merchant: MerchantDTO }>('/lookup/merchants', data).then((r) => r.data.merchant),
  updateMerchant: (id: string, data: Partial<{ name: string; logo: string }>) =>
    api.patch<{ merchant: MerchantDTO }>(`/lookup/merchants/${id}`, data).then((r) => r.data.merchant),
  removeMerchant: (id: string) => api.delete(`/lookup/merchants/${id}`),

  // BusinessLine
  listBusinessLines: (merchantId?: string) =>
    api
      .get<{ businessLines: BusinessLineDTO[] }>('/lookup/business-lines', { params: { merchantId } })
      .then((r) => r.data.businessLines),
  getBusinessLine: (id: string) =>
    api.get<{ businessLine: BusinessLineDTO }>(`/lookup/business-lines/${id}`).then((r) => r.data.businessLine),
  createBusinessLine: (data: { code: string; name: string; logo?: string; color?: string; merchantId?: string; designMd?: string; designMdUrl?: string }) =>
    api.post<{ businessLine: BusinessLineDTO }>('/lookup/business-lines', data).then((r) => r.data.businessLine),
  updateBusinessLine: (id: string, data: Partial<{ code: string; name: string; logo: string; color: string; merchantId: string; designMd: string; designMdUrl: string }>) =>
    api.patch<{ businessLine: BusinessLineDTO }>(`/lookup/business-lines/${id}`, data).then((r) => r.data.businessLine),
  removeBusinessLine: (id: string) => api.delete(`/lookup/business-lines/${id}`),

  // Advertiser
  listAdvertisers: (opts?: { businessLineCode?: string; businessLineId?: string }) =>
    api
      .get<{ advertisers: AdvertiserDTO[] }>('/lookup/advertisers', { params: opts })
      .then((r) => r.data.advertisers),
  getAdvertiser: (id: string) =>
    api.get<{ advertiser: AdvertiserDTO }>(`/lookup/advertisers/${id}`).then((r) => r.data.advertiser),
  createAdvertiser: (data: { name: string; logo?: string; businessLineId: string; merchantId?: string }) =>
    api.post<{ advertiser: AdvertiserDTO }>('/lookup/advertisers', data).then((r) => r.data.advertiser),
  updateAdvertiser: (id: string, data: Partial<{ name: string; logo: string; businessLineId: string; merchantId: string }>) =>
    api.patch<{ advertiser: AdvertiserDTO }>(`/lookup/advertisers/${id}`, data).then((r) => r.data.advertiser),
  removeAdvertiser: (id: string) => api.delete(`/lookup/advertisers/${id}`),

  // MarketingEvent（营销活动）
  listMarketingEvents: (advertiserId?: string) =>
    api
      .get<{ marketingEvents: MarketingEventDTO[] }>('/lookup/marketing-events', { params: { advertiserId } })
      .then((r) => r.data.marketingEvents),
  createMarketingEvent: (data: { name: string; description?: string; startDate: string; endDate: string; advertiserId: string }) =>
    api.post<{ marketingEvent: MarketingEventDTO }>('/lookup/marketing-events', data).then((r) => r.data.marketingEvent),
  updateMarketingEvent: (id: string, data: Partial<{ name: string; description: string; startDate: string; endDate: string; advertiserId: string }>) =>
    api.patch<{ marketingEvent: MarketingEventDTO }>(`/lookup/marketing-events/${id}`, data).then((r) => r.data.marketingEvent),
  removeMarketingEvent: (id: string) => api.delete(`/lookup/marketing-events/${id}`),
};
