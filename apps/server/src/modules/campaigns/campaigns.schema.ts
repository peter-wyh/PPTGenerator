import { z } from 'zod';
import { idParamSchema } from '../lookup/lookup.schema';

// ─── Campaign ────────────────────────────────────────────────────────────────

export const createCampaignSchema = z.object({
  name: z.string().min(1),
  platform: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  /** 预算（含币种符号如 "$300K"）。非必填——新建时预算常未定（0827 放开）。 */
  budget: z.string().optional(),
  status: z.string().optional(),
  owner: z.string().optional(),
  businessLineId: z.string().optional(),
  advertiserId: z.string().optional(),
  businessLineCode: z.string().optional(),
  advertiserName: z.string().optional(),
  metrics: z.any().optional(),
  analytics: z.any().optional(),
});

export const updateCampaignSchema = createCampaignSchema.partial();

export const listCampaignsQuerySchema = z.object({
  businessLineId: z.string().optional(),
  advertiserId: z.string().optional(),
  businessLineCode: z.string().optional(),
  status: z.string().optional(),
});

// ─── Creator ─────────────────────────────────────────────────────────────────

export const createCreatorSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  handle: z.string(),
  platform: z.string(),
  partnerType: z.enum(['creator', 'community', 'content_site']).optional(),
  tier: z.string(),
  followers: z.string(),
  engagement: z.string(),
  category: z.string(),
  region: z.string(),
  avatar: z.string().optional(),
  profileUrl: z.string().optional(),
  contact: z.any().optional(),
  rate: z.any().optional(),
  metrics: z.any().optional(),
  audience: z.any().optional(),
  works: z.any().optional(),
});

export const updateCreatorSchema = createCreatorSchema.partial();

export const listCreatorsQuerySchema = z.object({
  platform: z.string().optional(),
  tier: z.string().optional(),
  category: z.string().optional(),
  partnerType: z.enum(['creator', 'community', 'content_site']).optional(),
  search: z.string().optional(),
});

// ─── CampaignCreator ─────────────────────────────────────────────────────────

export const createCampaignCreatorSchema = z.object({
  campaignId: z.string().min(1),
  creatorId: z.string().min(1),
  collabType: z.string().optional(),
  status: z.string().optional(),
  contentType: z.string().optional(),
  collabId: z.string().optional(),
  currency: z.string().optional(),
  totalPrice: z.string().optional(),
});

export const updateCampaignCreatorSchema = createCampaignCreatorSchema.partial().omit({ campaignId: true, creatorId: true });

// ─── Collab Overview (批量总览) ──────────────────────────────────────────────
// 0828：合作列表页原 3 层循环（list + N×listLinks + N×getCollaboration）烧限流；
// 此查询参数透传 campaignService.list 同款过滤。
export const collabOverviewQuerySchema = listCampaignsQuerySchema;

export { idParamSchema };
