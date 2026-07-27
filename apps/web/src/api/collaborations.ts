import { dataApi } from './dataLibrary';
import { campaignsApi } from './campaignsApi';
import { collaborationId, type CollaborationData, type CollaborationDeliverable } from '@mediakit/shared';
import { buildSeedCollaboration } from './analytics/collaborationSeed';

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
 *
 * **daily 补全**：DB 中旧记录可能缺少 daily 字段，用 seed 同位置 deliverable 的 daily 填充。
 */
export async function getCollaboration(
  campaignId: string,
  creatorId: string,
): Promise<CollaborationData | null> {
  let result: CollaborationData | null = null;
  // 1. 新表优先
  try {
    const dto = await campaignsApi.getCollaboration(campaignId, creatorId);
    if (dto) {
      const deliverables = dto.deliverables as CollaborationDeliverable[];
      if (hasRichData(deliverables)) {
        result = {
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
  if (!result) {
    try {
      const r = await dataApi.get<CollaborationData>(collaborationId(campaignId, creatorId));
      if (r.data && hasRichData(r.data.deliverables)) {
        result = r.data;
      }
    } catch {
      // not found
    }
  }

  // 3. daily + cps 都是确定性 mock 数据，总是从 seed 重新生成
  //    daily: 发布日→当前日期，最多 30 天
  //    cps: CPS 链接挂链效果（clicks/GMV/佣金/ROAS/CVR 等）
  //    这样无需 DB migration 即可保证确定性 mock 始终反映最新逻辑
  if (result) {
    try {
      const seed = buildSeedCollaboration(campaignId, creatorId);
      result = {
        ...result,
        deliverables: result.deliverables.map((d, i) => ({
          ...d,
          daily: seed.deliverables[i]?.daily ?? d.daily,
          cps: seed.deliverables[i]?.cps ?? d.cps,
        })),
      };
    } catch {
      // seed 补全失败不影响主流程
    }
  }

  return result;
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
