import { dataApi } from './dataLibrary';
import { collaborationId, type CollaborationData } from '@mediakit/shared';

/** 读取一个 (campaign, creator) 的合作记录；不存在返回 null。 */
export async function getCollaboration(
  campaignId: string,
  creatorId: string,
): Promise<CollaborationData | null> {
  try {
    const r = await dataApi.get<CollaborationData>(collaborationId(campaignId, creatorId));
    return r.data;
  } catch {
    return null;
  }
}

/** 保存合作记录：先 update，不存在（404）则 create。data.id 强制为确定性 id。 */
export async function saveCollaboration(data: CollaborationData): Promise<void> {
  const id = collaborationId(data.campaignId, data.creatorId);
  const payload: CollaborationData = { ...data, id };
  try {
    await dataApi.update(id, payload);
  } catch {
    await dataApi.create('collaboration', payload);
  }
}

/** 删除合作记录；不存在静默忽略。 */
export async function removeCollaboration(campaignId: string, creatorId: string): Promise<void> {
  await dataApi.remove(collaborationId(campaignId, creatorId)).catch(() => {});
}
