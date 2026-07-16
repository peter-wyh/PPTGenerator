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

export { idParamSchema };
