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
  title: z.string().max(50).optional(),
  logo: z.string().max(2048).optional(),
  color: z.string().max(20).optional(),
  merchantId: z.string().optional(),
  designMd: z.string().optional(),
  designMdUrl: z.string().max(2048).optional(),
  // 源侧字段（dm_union_business_lines）
  directorId: z.string().max(500).optional(),
  members: z.string().optional(),
  extra: z.string().optional(),
  status: z.number().int().optional(),
  companyIds: z.string().max(500).optional(),
  departmentIds: z.string().max(2000).optional(),
  specifyMembers: z.string().optional(),
  cptWithdraw: z.boolean().optional(),
  relatedProject: z.string().max(255).optional(),
  calendarAdminIds: z.string().max(1000).optional(),
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

// ─── MarketingEvent（营销活动，对齐 sales_activity）───────────────────────────

/** datetime 字符串（ISO 8601 或 YYYY-MM-DD HH:mm[:ss]），转 Date 由 service 层完成。 */
const datetimeString = z.string().min(4);

export const createMarketingEventSchema = z.object({
  name: z.string().min(1).max(255),
  startTime: datetimeString,
  endTime: datetimeString,
  label: z.string().max(255).optional(),
  type: z.number().int().min(0).max(3).optional(),
  info: z.string().max(2000).optional(),
  continent: z.string().max(255).optional(),
  region: z.string().max(255).optional(),
  level: z.number().int().min(0).max(3).optional(),
  adsId: z.string().optional(),
  businessLineId: z.string().optional(),
  isShowMember: z.number().int().min(0).max(2).optional(),
  source: z.number().int().min(0).max(3).optional(),
  createId: z.string().optional(),
  updateId: z.string().optional(),
});

export const updateMarketingEventSchema = createMarketingEventSchema.partial().omit({ name: true }).extend({ name: z.string().min(1).max(255) });

/** GET /api/v1/marketing-events?businessLineId= */
export const listMarketingEventsQuerySchema = z.object({
  businessLineId: z.string().optional(),
});

export { idParamSchema };
