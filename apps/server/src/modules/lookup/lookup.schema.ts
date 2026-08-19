import { z } from 'zod';
import { idParamSchema } from '../projects/projects.schema';

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const createMerchantSchema = z.object({
  name: z.string().min(1).max(100),
  logo: z.string().max(2048).optional(),
});

export const updateMerchantSchema = createMerchantSchema.partial();

export const createBusinessLineSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  logo: z.string().max(2048).optional(),
  color: z.string().max(20).optional(),
  merchantId: z.string().optional(),
  designMd: z.string().optional(),
  designMdUrl: z.string().max(2048).optional(),
});

export const updateBusinessLineSchema = createBusinessLineSchema.partial();

export const createAdvertiserSchema = z.object({
  name: z.string().min(1).max(100),
  logo: z.string().max(2048).optional(),
  businessLineId: z.string().min(1),
  merchantId: z.string().optional(),
});

export const updateAdvertiserSchema = createAdvertiserSchema.partial();

/** GET /api/v1/advertisers?businessLineCode=FT */
export const listAdvertisersQuerySchema = z.object({
  businessLineCode: z.string().optional(),
  businessLineId: z.string().optional(),
});

/** GET /api/v1/business-lines?merchantId=m1 */
export const listBusinessLinesQuerySchema = z.object({
  merchantId: z.string().optional(),
});

// ─── MarketingEvent（营销活动）────────────────────────────────────────────────

export const createMarketingEventSchema = z.object({
  name: z.string().min(1).max(191),
  description: z.string().max(2000).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate 须为 YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate 须为 YYYY-MM-DD'),
  advertiserId: z.string().min(1),
});

export const updateMarketingEventSchema = createMarketingEventSchema.partial();

/** GET /api/v1/marketing-events?advertiserId= */
export const listMarketingEventsQuerySchema = z.object({
  advertiserId: z.string().optional(),
});

export { idParamSchema };
