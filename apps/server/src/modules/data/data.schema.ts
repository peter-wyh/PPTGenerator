import { z } from 'zod';
import { idParamSchema } from '../projects/projects.schema';

/** 数据记录类型(与 Prisma DataRecordKind 对齐:DB 存大写,API 用小写)。 */
export const kindSchema = z.enum(['campaign', 'creator', 'collaboration']);

/** CampaignMetric:Campaign 与 Creator 共用,三字段必填。 */
const campaignMetricSchema = z.object({
  label: z.string(),
  value: z.string(),
  compare: z.string(),
});

/** CampaignPlatform:多平台合作形式。 */
const campaignPlatformSchema = z.object({
  platform: z.string(),
  collaborationType: z.string(),
});

/** Campaign 记录数据(镜像 shared Campaign)。 */
export const campaignRecordDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  advertiser: z.string(),
  businessLine: z.string(),
  platform: z.string(),
  platforms: z.array(campaignPlatformSchema).optional(),
  startDate: z.string(),
  endDate: z.string(),
  budget: z.string(),
  status: z.string().optional(),
  owner: z.string().optional(),
  metrics: z.array(campaignMetricSchema).optional(),
  creatorIds: z.array(z.string()).optional(),
});

/** Creator 记录数据(镜像 web Creator;metrics 必填)。 */
export const creatorRecordDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  handle: z.string(),
  platform: z.string(),
  tier: z.string(),
  followers: z.string(),
  engagement: z.string(),
  category: z.string(),
  region: z.string(),
  avatar: z.string().max(2048).optional(),
  metrics: z.array(campaignMetricSchema),
});

/** Collaboration 子 schema(镜像 shared CollaborationData)。 */
const contentTypeSchema = z.enum(['post', 'reels', 'video', 'image', 'live', 'story']);
const screenshotItemSchema = z.object({
  src: z.string(),
  caption: z.string().optional(),
  captionHidden: z.boolean().optional(),
});
const collaborationMetricSchema = z.object({
  label: z.string(),
  value: z.string(),
  color: z.string().optional(),
});
const namedValueSchema = z.object({ label: z.string(), value: z.number(), color: z.string().optional() });
const trendPointSchema = z.object({ label: z.string(), value: z.number() });
const audienceInsightSchema = z.object({
  topCities: z.array(namedValueSchema).optional(),
  genderSplit: z.array(namedValueSchema).optional(),
  ageRange: z.array(namedValueSchema).optional(),
  trend: z.array(trendPointSchema).optional(),
  trendLabel: z.string().optional(),
});
const wordItemSchema = z.object({
  text: z.string(),
  weight: z.number(),
  sentiment: z.enum(['pos', 'neg', 'neutral']),
});
const deliverableSchema = z.object({
  contentType: contentTypeSchema,
  screenshots: z.array(screenshotItemSchema).optional(),
  metrics: z.array(collaborationMetricSchema).optional(),
  audience: audienceInsightSchema.optional(),
  wordcloud: z.array(wordItemSchema).optional(),
});

/** Collaboration 记录数据(达人合作:合作方式=作品类型组合 + 每类四类数据)。 */
export const collaborationRecordDataSchema = z.object({
  id: z.string().min(1),
  campaignId: z.string().min(1),
  creatorId: z.string().min(1),
  deliverables: z.array(deliverableSchema).min(1),
});

/** 按 kind 取对应数据 schema。 */
export function dataSchemaForKind(kind: 'campaign' | 'creator' | 'collaboration') {
  if (kind === 'campaign') return campaignRecordDataSchema;
  if (kind === 'collaboration') return collaborationRecordDataSchema;
  return creatorRecordDataSchema;
}

/** POST /api/v1/data — kind + data(data 在 service 按 kind 校验)。 */
export const createDataSchema = z.object({
  kind: kindSchema,
  data: z.unknown(),
});

/** POST /api/v1/data/import — kind + items[]。 */
export const importDataSchema = z.object({
  kind: kindSchema,
  items: z.array(z.unknown()),
});

/** PATCH /api/v1/data/:id — data(data 在 service 按记录既有 kind 校验)。 */
export const updateDataSchema = z.object({
  data: z.unknown(),
});

/** GET /api/v1/data?kind=... — kind 必填。 */
export const listQuerySchema = z.object({ kind: kindSchema });

/** DELETE /api/v1/data?kind=... — kind 必填。 */
export const clearQuerySchema = z.object({ kind: kindSchema });

export { idParamSchema };
