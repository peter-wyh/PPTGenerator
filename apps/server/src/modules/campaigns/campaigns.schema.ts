import { z } from 'zod';
import { idParamSchema } from '../lookup/lookup.schema';

// ─── Campaign ────────────────────────────────────────────────────────────────

export const createCampaignSchema = z.object({
  name: z.string().min(1),
  platform: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  budget: z.string(),
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

export { idParamSchema };
