import type {
  CollaborationData,
  CollaborationDeliverable,
  CommentWordItem,
  ContentType,
  WorkAudienceInsight,
} from '@mediakit/shared';
import { collaborationId } from '@mediakit/shared';
import { campaignCreatorWorks } from './creatorPerformance';
import { dataApi } from '../dataLibrary';

const SENTIMENTS = ['pos', 'neutral', 'neg'] as const;

/** 从 post 标题派生确定性词云（demo）。 */
function seedWordcloud(title: string, idx: number): CommentWordItem[] {
  const words = (title || '种草 推荐 实测')
    .split(/\s|·|，|,|\|/)
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (words.length === 0) words.push('种草');
  return words.map((text, i) => ({
    text,
    weight: 80 - i * 15 - (idx % 3) * 5,
    sentiment: SENTIMENTS[(idx + i) % 3],
  }));
}

/** 确定性受众画像（demo）。 */
function seedAudience(idx: number): WorkAudienceInsight {
  return {
    topCities: [
      { label: '上海', value: 28 - idx },
      { label: '北京', value: 20 - idx },
      { label: '广州', value: 15 },
    ],
    genderSplit: [
      { label: '女', value: 70 },
      { label: '男', value: 30 },
    ],
    ageRange: [
      { label: '18-24', value: 40 },
      { label: '25-34', value: 35 },
      { label: '35+', value: 25 },
    ],
  };
}

/** 从 creatorPerformance mock 为 (campaign, creator) 组装一条合作记录（演示用，四槽全填）。 */
export function buildSeedCollaboration(campaignId: string, creatorId: string): CollaborationData {
  const works = campaignCreatorWorks(campaignId).find((w) => w.creatorId === creatorId);
  const deliverables: CollaborationDeliverable[] = [];
  let idx = 0;
  for (const p of works?.posts ?? []) {
    const contentType: ContentType = /video|reel/i.test(p.platform) ? 'reels' : 'post';
    deliverables.push({
      contentType,
      screenshots: [{ src: p.cover, caption: p.title }],
      metrics: [
        { label: '曝光', value: p.impressions },
        { label: '点赞', value: p.likes },
        { label: '评论', value: p.comments },
      ],
      wordcloud: seedWordcloud(p.title, idx),
      audience: seedAudience(idx),
    });
    idx++;
  }
  if (deliverables.length === 0) {
    deliverables.push({
      contentType: 'post',
      screenshots: [{ src: '', caption: '' }],
      metrics: [{ label: '曝光', value: '0' }],
      wordcloud: seedWordcloud('', 0),
      audience: seedAudience(0),
    });
  }
  return { id: collaborationId(campaignId, creatorId), campaignId, creatorId, deliverables };
}

/** 幂等导入一个 campaign 所有合作达人的演示合作记录（按确定性 id upsert）。 */
export async function importSeedCollaborations(campaignId: string, creatorIds: string[]) {
  const items = creatorIds.map((cid) => buildSeedCollaboration(campaignId, cid));
  return dataApi.importMany('collaboration', items);
}
