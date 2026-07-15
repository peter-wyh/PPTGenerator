import type { CollaborationData, CollaborationDeliverable, ContentType } from '@mediakit/shared';
import { collaborationId } from '@mediakit/shared';
import { campaignCreatorWorks } from './creatorPerformance';
import { dataApi } from '../dataLibrary';

/** 从 creatorPerformance mock 为 (campaign, creator) 组装一条合作记录（演示用）。 */
export function buildSeedCollaboration(campaignId: string, creatorId: string): CollaborationData {
  const works = campaignCreatorWorks(campaignId).find((w) => w.creatorId === creatorId);
  const deliverables: CollaborationDeliverable[] = [];
  for (const p of works?.posts ?? []) {
    // 粗略按 platform 推断 contentType（demo）。
    const contentType: ContentType = /video|reel/i.test(p.platform) ? 'reels' : 'post';
    deliverables.push({
      contentType,
      screenshots: [{ src: p.cover, caption: p.title }],
      metrics: [
        { label: '曝光', value: p.impressions },
        { label: '点赞', value: p.likes },
        { label: '评论', value: p.comments },
      ],
    });
  }
  if (deliverables.length === 0) deliverables.push({ contentType: 'post' });
  return { id: collaborationId(campaignId, creatorId), campaignId, creatorId, deliverables };
}

/** 幂等导入一个 campaign 所有合作达人的演示合作记录（按确定性 id upsert）。 */
export async function importSeedCollaborations(campaignId: string, creatorIds: string[]) {
  const items = creatorIds.map((cid) => buildSeedCollaboration(campaignId, cid));
  return dataApi.importMany('collaboration', items);
}
