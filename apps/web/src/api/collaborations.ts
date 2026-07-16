import { dataApi } from './dataLibrary';
import { campaignsApi } from './campaignsApi';
import { collaborationId, type CollaborationData, type CollaborationDeliverable } from '@mediaket/shared';

/**
 * Phase 3: 优先从独立表 /api/v1/campaigns/.../collaboration 读写；失败回退 DataRecord。
 */

/** 判断 deliverables 是否有实质内容（不只是 contentType 空壳）。 */
function hasRichData(deliverables: CollaborationDeliverable[]): boolean {
  if (deliverables.length === 0) return false;
  return deliverables.some(
    (d) =>
      (d.screenshots && d.screenshots.length > 0) ||
      (d.metrics && d.metrics.length > 0) ||
      (d.audience && d.wordcloud && d.wordcloud.length > 0),
  );
}

/**
 * 读取一个 (campaign, creator) 的合作记录；不存在或仅含空壳 deliverables 返回 null。
 * 空壳数据（seed 写入的 contentType-only）不返回，让调用方走 buildSeedCollaboration 生成丰富 fallback。
 */
export async function getCollaboration(
  campaignId: string,
  creatorId: string,
): Promise<CollaborationData | null> {
  // 1. 新表优先
  try {
    const dto = await campaignsApi.getCollaboration(campaignId, creatorId);
    if (dto) {
      const deliverables = dto.deliverables as CollaborationDeliverable[];
      // seed 写入的空壳数据（只有 contentType，无 screenshots/metrics）视为无数据
      if (hasRichData(deliverables)) {
        return {
          id: collaborationId(campaignId, creatorId),
          campaignId,
          creatorId,
          deliverables,
        };
      }
    }
  } catch {
    // fall through
  }
  // 2. 回退 DataRecord
  try {
    const r = await dataApi.get<CollaborationData>(collaborationId(campaignId, creatorId));
    if (r.data && hasRichData(r.data.deliverables)) {
      return r.data;
    }
  } catch {
    // not found
  }
  return null;
}

/** 保存合作记录：Phase 4 后只写新表。 */
export async function saveCollaboration(data: CollaborationData): Promise<void> {
  const id = collaborationId(data.campaignId, data.creatorId);
  const payload: CollaborationData = { ...data, id };

  // 只写新表（Phase 4 降级：不再双写 DataRecord）
  try {
    await campaignsApi.upsertCollaboration(data.campaignId, data.creatorId, {
      deliverables: payload.deliverables,
    });
  } catch {
    // 新表写入失败时 fallback 写 DataRecord（保底不丢数据）
    try {
      await dataApi.update(id, payload);
    } catch {
      await dataApi.create('collaboration', payload);
    }
  }
}

/** 删除合作记录；不存在静默忽略。仅删 DataRecord（新表由 FK cascade 处理）。 */
export async function removeCollaboration(campaignId: string, creatorId: string): Promise<void> {
  await dataApi.remove(collaborationId(campaignId, creatorId)).catch(() => {});
}
