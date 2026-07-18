import type {
  CommentWordItem,
  WorkAudienceInsight,
  WorkMetricItem,
  WorkScreenshotItem,
} from './editor';
import type { PostDaily } from './campaign';

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
}

/** 一条合作记录的 data 载荷。id 作 DataRecord 主键 = collaborationId(campaignId, creatorId)。 */
export interface CollaborationData {
  id: string;
  campaignId: string;
  creatorId: string;
  deliverables: CollaborationDeliverable[];
}

/** 确定性记录 id，便于直接 get 与幂等导入 upsert。 */
export function collaborationId(campaignId: string, creatorId: string): string {
  return `collab:${campaignId}:${creatorId}`;
}

/** 合作方式展示标签（由 contentType 组合派生，不单独存储）。 */
export function collaborationLabel(data: { deliverables: CollaborationDeliverable[] }): string {
  return data.deliverables.map((d) => d.contentType).join(' + ') || '未设置';
}
