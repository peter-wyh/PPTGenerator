import { dataApi } from './dataLibrary';
import { campaignsApi } from './campaignsApi';
import { collaborationId, type CollaborationData, type CollaborationDeliverable } from '@mediaket/shared';

/**
 * Phase 3: 优先从独立表 /api/v1/campaigns/.../collaboration 读写；失败回退 DataRecord。
 */

/** 读取一个 (campaign, creator) 的合作记录；不存在返回 null。 */
export async function getCollaboration(
  campaignId: string,
  creatorId: string,
): Promise<CollaborationData | null> {
  // 1. 新表优先
  try {
    const dto = await campaignsApi.getCollaboration(campaignId, creatorId);
    if (dto) {
      return {
        id: collaborationId(campaignId, creatorId),
        campaignId,
        creatorId,
        deliverables: dto.deliverables as CollaborationDeliverable[],
      };
    }
  } catch {
    // fall through
  }
  // 2. 回退 DataRecord
  try {
    const r = await dataApi.get<CollaborationData>(collaborationId(campaignId, creatorId));
    return r.data;
  } catch {
    return null;
  }
}

/** 保存合作记录：新表 + DataRecord 双写，确保兼容。data.id 强制为确定性 id。 */
export async function saveCollaboration(data: CollaborationData): Promise<void> {
  const id = collaborationId(data.campaignId, data.creatorId);
  const payload: CollaborationData = { ...data, id };

  // 1. 写新表
  try {
    await campaignsApi.upsertCollaboration(data.campaignId, data.creatorId, {
      deliverables: payload.deliverables,
    });
  } catch {
    // 新表写入失败时仍继续写 DataRecord
  }

  // 2. 写 DataRecord（兼容旧读取方）
  try {
    await dataApi.update(id, payload);
  } catch {
    await dataApi.create('collaboration', payload);
  }
}

/** 删除合作记录；不存在静默忽略。仅删 DataRecord（新表由 FK cascade 处理）。 */
export async function removeCollaboration(campaignId: string, creatorId: string): Promise<void> {
  await dataApi.remove(collaborationId(campaignId, creatorId)).catch(() => {});
}
