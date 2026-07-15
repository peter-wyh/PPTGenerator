import { z } from 'zod';
import { idParamSchema } from '../projects/projects.schema';

/** 数据记录类型(与 Prisma DataRecordKind 对齐:DB 存大写,API 用小写)。 */
export const kindSchema = z.enum(['campaign', 'creator']);

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

/** AudienceSlice / CreatorAudience:镜像 shared。 */
const audienceSliceSchema = z.object({
  label: z.string(),
  value: z.number(),
  color: z.string().optional(),
});
const creatorAudienceSchema = z.object({
  genderSplit: z.array(audienceSliceSchema).optional(),
  ageRange: z.array(audienceSliceSchema).optional(),
  topCities: z.array(audienceSliceSchema).optional(),
});

/** CreatorWork:镜像 shared。 */
const creatorWorkSchema = z.object({
  id: z.string(),
  title: z.string(),
  cover: z.string().max(2048).optional(),
  url: z.string().max(2048).optional(),
  platform: z.string().optional(),
  publishedAt: z.string().optional(),
  impressions: z.string().optional(),
  likes: z.string().optional(),
  comments: z.string().optional(),
  shares: z.string().optional(),
  saves: z.string().optional(),
  engagementRate: z.string().optional(),
});

/** CreatorStatItem:镜像 shared。 */
const creatorStatItemSchema = z.object({
  key: z.string().optional(),
  label: z.string(),
  value: z.string(),
  color: z.string(),
  selected: z.boolean().optional(),
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
  audience: creatorAudienceSchema.optional(),
  works: z.array(creatorWorkSchema).optional(),
  stats: z.array(creatorStatItemSchema).optional(),
});

/** 按 kind 取对应数据 schema。 */
export function dataSchemaForKind(kind: 'campaign' | 'creator') {
  return kind === 'campaign' ? campaignRecordDataSchema : creatorRecordDataSchema;
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
