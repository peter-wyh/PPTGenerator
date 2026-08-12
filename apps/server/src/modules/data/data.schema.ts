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

const campaignTrendPointSchema = z.object({
  date: z.string(), revenue: z.number(), spend: z.number(),
  commission: z.number(), orders: z.number(), roas: z.number(),
});
const campaignWeeklyTrendPointSchema = z.object({
  week: z.string(), start: z.string(), revenue: z.number(),
  spend: z.number(), orders: z.number(), roas: z.number(),
});
const campaignInsightSchema = z.object({
  kind: z.string(),
  severity: z.string(),
  subjectType: z.string(),
  subjectId: z.string().optional(),
  subjectName: z.string(),
  metrics: z.array(z.object({ label: z.string(), value: z.string() })),
  rationale: z.string(),
  action: z.string(),
});
const campaignAnalyticsSchema = z.object({
  trend: z.array(campaignTrendPointSchema),
  weeklyTrend: z.array(campaignWeeklyTrendPointSchema),
  customerSplit: z.object({
    newCustomers: z.number(),
    returningCustomers: z.number(),
    newCustomerRate: z.string(),
  }).optional(),
  insights: z.array(campaignInsightSchema),
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
  /**
   * @deprecated SP1 后 campaign KPI/trend 统一从 DataRecord(COLLABORATION).deliverables[].performance.daily 派生。
   * 此字段仅保留读旧记录;recipe/AI 不得读。彻底下线见 SP5。
   */
  analytics: campaignAnalyticsSchema.optional(),
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
  contentType: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  productLink: z.string().max(2048).optional(),
  attribution: z.object({
    clicks: z.string().optional(),
    orders: z.string().optional(),
    gmv: z.string().optional(),
    ctr: z.string().optional(),
    cvr: z.string().optional(),
  }).optional(),
  duration: z.string().optional(),
  featured: z.boolean().optional(),
});

/** CreatorStatItem:镜像 shared。 */
const creatorStatItemSchema = z.object({
  key: z.string().optional(),
  label: z.string(),
  value: z.string(),
  color: z.string(),
  selected: z.boolean().optional(),
});

/** CreatorContact / CreatorRate:镜像 shared。 */
const creatorContactSchema = z.object({
  mcn: z.string().optional(),
  agency: z.string().optional(),
  email: z.string().max(320).optional(),
  phone: z.string().max(64).optional(),
  contactPerson: z.string().max(120).optional(),
});
const creatorRateSchema = z.object({
  currency: z.string().max(8).optional(),
  post: z.string().max(64).optional(),
  video: z.string().max(64).optional(),
  live: z.string().max(64).optional(),
  note: z.string().max(500).optional(),
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
  profileUrl: z.string().max(2048).optional(),
  metrics: z.array(campaignMetricSchema),
  audience: creatorAudienceSchema.optional(),
  works: z.array(creatorWorkSchema).optional(),
  stats: z.array(creatorStatItemSchema).optional(),
  bio: z.string().max(2000).optional(),
  tags: z.array(z.string()).optional(),
  contact: creatorContactSchema.optional(),
  rate: creatorRateSchema.optional(),
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
/** CPS 每日明细点(per-contentType)。recipe 按此切片求和派生 KPI/trend。必填为 recipe 必需字段,impressions/commission 可选。 */
const cpsDailyPointSchema = z.object({
  date: z.string(),
  clicks: z.number(),
  orders: z.number(),
  gmv: z.number(),
  newCustomers: z.number(),
  spend: z.number(),
  impressions: z.number().optional(),
  commission: z.number().optional(),
});

/** deliverable 级 CPS 业绩(per-contentType 每日序列)。 */
const deliverablePerformanceSchema = z.object({
  daily: z.array(cpsDailyPointSchema),
});

const deliverableSchema = z.object({
  contentType: contentTypeSchema,
  /// 作品原始链接（帖子/视频/直播 URL）。
  postUrl: z.string().max(2048).optional(),
  /// 作品形式：短视频/图文/直播切片/合集/UGC...
  contentFormat: z.string().max(64).optional(),
  screenshots: z.array(screenshotItemSchema).optional(),
  metrics: z.array(collaborationMetricSchema).optional(),
  audience: audienceInsightSchema.optional(),
  wordcloud: z.array(wordItemSchema).optional(),
  /// CPS 每日业绩(per-contentType)。SP1 新增;recipe 据此派生 campaign KPI/trend。
  performance: deliverablePerformanceSchema.optional(),
});

/** Collaboration 记录数据(达人合作:合作方式=作品类型组合 + 每类四类数据)。 */
export const collaborationRecordDataSchema = z.object({
  id: z.string().min(1),
  campaignId: z.string().min(1),
  creatorId: z.string().min(1),
  /// 合作分组 ID：一次合作（含多个 contentType）共享一个 ID。
  collabId: z.string().optional(),
  /// 合作币种（USD / CNY / EUR...）。
  currency: z.string().max(8).optional(),
  /// 合作总价（一次合作可能含多个 deliverable 的价格汇总）。
  totalPrice: z.string().max(64).optional(),
  /// 达人基础信息（导入时自动同步到 Creator 表，不填则从已有 Creator 读取）。
  creatorName: z.string().optional(),
  creatorAvatar: z.string().max(2048).optional(),
  creatorHandle: z.string().optional(),
  creatorProfileUrl: z.string().max(2048).optional(),
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
