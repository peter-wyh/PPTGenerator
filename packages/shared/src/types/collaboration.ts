import type {
  CommentWordItem,
  WorkAudienceInsight,
  WorkMetricItem,
  WorkScreenshotItem,
} from './editor';
import type { PostDaily, PartnerType } from './campaign';

/** 合作方类型（re-export）。 */
export type { PartnerType };

/** 作品类型（合作方式的构成单元）。 */
export type ContentType = 'post' | 'reels' | 'video' | 'image' | 'live' | 'story';

/**
 * CPS 挂链推广效果（每个 deliverable 可挂一条 CPS 追踪链接）。
 * 记录该链接带来的 clicks、GMV、佣金、转化率等。
 */
export interface CpsLinkData {
  /** CPS 跟踪链接（可空，仅展示用）。 */
  linkUrl?: string;
  /** 链接点击数。 */
  clicks: string;
  /** 链接曝光（归因到该链接的展示量）。 */
  impressions: string;
  /** 点击率 CTR = clicks / impressions。 */
  ctr: string;
  /** 转化数（订单数 = 归因到该链接的成交笔数）。 */
  orders: string;
  /** 转化率 CVR = orders / clicks。 */
  cvr: string;
  /** 带货 GMV（成交金额）。 */
  gmv: string;
  /** CPS 佣金（达人分佣）。 */
  commission: string;
  /** CPS 花费（佣金 + 服务费，品牌侧成本）。 */
  spend: string;
  /** CPS ROAS = GMV / 花费。 */
  roas: string;
  /** 每次点击收益 EPC = GMV / clicks。 */
  epc: string;
  /** 按天拆分的 CPS 明细（clicks/orders/gmv/commission/CTR/CVR/EPC/ROAS）。 */
  daily?: CpsDaily[];
}

/**
 * CPS 每日明细：一条 CPS 追踪链接在某天的归因数据。
 * 日期范围与 PostDaily 对齐（发布日 → 当前，最多 30 天）。
 */
export interface CpsDaily {
  /** 日期 YYYY-MM-DD。 */
  date: string;
  /** 当日链接点击数。 */
  clicks: string;
  /** 当日链接曝光。 */
  impressions: string;
  /** 当日点击率 CTR = clicks / impressions。 */
  ctr: string;
  /** 当日订单（转化数）。 */
  orders: string;
  /** 当日转化率 CVR = orders / clicks。 */
  cvr: string;
  /** 当日带货 GMV。 */
  gmv: string;
  /** 当日 CPS 佣金。 */
  commission: string;
  /** 当日 ROAS = GMV / (佣金 × 1.08)。 */
  roas: string;
  /** 当日 EPC = GMV / clicks。 */
  epc: string;
}

/** 一次合作中的一种作品类型 + 它的四类数据（均可选，按需填充）。 */
export interface CollaborationDeliverable {
  contentType: ContentType;
  /** 作品原始链接（帖子/视频/直播 URL）——报告 Creator Breakdown 达人行跳转用（0827 迭代）。 */
  postUrl?: string;
  /** 内容形式（短视频/图文/直播切片/合集/UGC）——报告 story 判定三字段之一（0827 迭代）。 */
  contentFormat?: string;
  /** 作品截图（captionHidden 为渲染开关，存储层忽略）。 */
  screenshots?: WorkScreenshotItem[];
  /** 效果数据。 */
  metrics?: WorkMetricItem[];
  /** 受众画像。 */
  audience?: WorkAudienceInsight;
  /** 评论词云。 */
  wordcloud?: CommentWordItem[];
  /** 作品发布日期（ISO YYYY-MM-DD）。 */
  publishedAt?: string;
  /** 发布平台（TikTok / Instagram / 小红书 等）。 */
  platform?: string;
  /** 每天效果明细（时间序列，从发布日起 N 天）。 */
  daily?: PostDaily[];
  /** CPS 挂链推广效果（该作品挂的 CPS 链接带来的转化数据）。 */
  cps?: CpsLinkData;

  // ─── 单作品成本指标（CPE / CPM）──────────────────────────────────
  /** 执行价（该 deliverable 的合作报价，CNY）。 */
  execPrice?: string;
  /** 单次互动成本 CPE = 执行价 ÷ 互动量（保留 2 位小数）。 */
  cpe?: string;
  /** 千次曝光成本 CPM = 执行价 ÷ 曝光量 × 1000（保留 2 位小数）。 */
  cpm?: string;

  // ─── 社群 / 内容站特有数据 ────────────────────────────────────────
  /** 社群引流效果（partnerType = community 时使用）。 */
  communityData?: CommunityTrafficData;
  /** 内容站引流效果（partnerType = content_site 时使用）。 */
  contentSiteData?: ContentSiteTrafficData;
}

/** 一条合作记录的 data 载荷。id 作 DataRecord 主键 = collaborationId(campaignId, creatorId)。 */
export interface CollaborationData {
  id: string;
  campaignId: string;
  creatorId: string;
  /** 合作方类型（默认 creator 兼容旧数据）。 */
  partnerType?: PartnerType;
  deliverables: CollaborationDeliverable[];
}

/** 确定性记录 id，便于直接 get 与幂等导入 upsert。 */
export function collaborationId(campaignId: string, creatorId: string): string {
  return `collab:${campaignId}:${creatorId}`;
}

/** 合作方类型：达人 / 社群 / 内容站 */
// PartnerType re-exported from campaign.ts above

/** 社群每日数据（群成员/活跃度时间序列） */
export interface CommunityDaily {
  /** 日期 YYYY-MM-DD */
  date: string;
  /** 当日群成员数 */
  followers: string;
  /** 当日活跃用户数 */
  activeUsers: string;
  /** 当日消息数 */
  messages?: string;
}

/** 内容站每日数据（访问量时间序列） */
export interface ContentSiteDaily {
  /** 日期 YYYY-MM-DD */
  date: string;
  /** 当日访问量 */
  visits: string;
  /** 当日独立访客 */
  uniqueVisitors?: string;
  /** 当日页面浏览量 */
  pageViews?: string;
  /** 当日平均停留时长(秒) */
  avgDuration?: string;
}

/** 内容站引流效果（类似达人 CPS 挂链） */
export interface ContentSiteTrafficData {
  /** 引流链接 URL */
  linkUrl?: string;
  /** 总访问量 */
  visits?: string;
  /** 总独立访客 */
  uniqueVisitors?: string;
  /** 总页面浏览量 */
  pageViews?: string;
  /** 跳出率 */
  bounceRate?: string;
  /** 平均停留时长(秒) */
  avgDuration?: string;
  /** 引流带来的 CPS 转化（复用 CpsLinkData） */
  cps?: CpsLinkData;
  /** 按天拆分 */
  daily?: ContentSiteDaily[];
}

/** 社群引流效果 */
export interface CommunityTrafficData {
  /** 社群链接 URL */
  linkUrl?: string;
  /** 总成员数 */
  followers?: string;
  /** 总活跃用户 */
  activeUsers?: string;
  /** 活跃率 = activeUsers / followers */
  activeRate?: string;
  /** 总消息数 */
  totalMessages?: string;
  /** 引流带来的 CPS 转化（复用 CpsLinkData） */
  cps?: CpsLinkData;
  /** 按天拆分 */
  daily?: CommunityDaily[];
}

/** 合作方式展示标签（由 contentType 组合派生，不单独存储）。 */
export function collaborationLabel(data: { deliverables: CollaborationDeliverable[] }): string {
  return data.deliverables.map((d) => d.contentType).join(' + ') || '未设置';
}
