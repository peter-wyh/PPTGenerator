import type {
  CommentWordItem,
  WorkAudienceInsight,
  WorkMetricItem,
  WorkScreenshotItem,
} from './editor';

/** 作品类型（合作方式的构成单元）。 */
export type ContentType = 'post' | 'reels' | 'video' | 'image' | 'live' | 'story';

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
