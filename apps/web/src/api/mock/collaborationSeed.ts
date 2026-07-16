import type {
  CollaborationData,
  CollaborationDeliverable,
  CommentWordItem,
  ContentType,
  WorkAudienceInsight,
} from '@mediaket/shared';
import { collaborationId } from '@mediaket/shared';
import { campaignCreatorWorks } from './creatorPerformance';
import { dataApi } from '../dataLibrary';

const SENTIMENTS = ['pos', 'neutral', 'neg'] as const;

/**
 * platform 名称 → ContentType 的确定性映射。
 * 'TikTok' 通常产 reels，'Instagram' 产 post/story，'YouTube' 产 video。
 */
const PLATFORM_CONTENT_MAP: Record<string, ContentType[]> = {
  TikTok: ['reels', 'image'],
  Instagram: ['post', 'reels', 'story'],
  YouTube: ['video'],
  Twitter: ['post'],
  Facebook: ['post', 'live'],
  Douyin: ['reels', 'image'],
  RED: ['post', 'image'],
  Weibo: ['post', 'live'],
  Bilibili: ['video'],
};

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

/** 确定性受众画像（demo），按 idx 变化让不同 deliverable 有差异。 */
function seedAudience(idx: number): WorkAudienceInsight {
  const cities = [
    { label: '上海', value: 28 - (idx % 5) },
    { label: '北京', value: 22 - (idx % 4) },
    { label: '广州', value: 15 + (idx % 3) },
    { label: '深圳', value: 10 + (idx % 2) },
  ];
  const femaleBase = 65 + (idx % 10);
  return {
    topCities: cities,
    genderSplit: [
      { label: '女', value: Math.min(femaleBase, 100) },
      { label: '男', value: Math.max(100 - femaleBase, 0) },
    ],
    ageRange: [
      { label: '18-24', value: 35 + (idx % 8) },
      { label: '25-34', value: 40 - (idx % 6) },
      { label: '35-44', value: 20 + (idx % 5) },
      { label: '45+', value: 5 + (idx % 3) },
    ],
  };
}

/**
 * 从 creatorPerformance mock 为 (campaign, creator) 组装一条合作记录。
 *
 * **每个 post 独立成一个 deliverable**（而非按 contentType 聚合多个 post），
 * 保证数据管理页与编辑器数据配置面板展示的作品数量完全一致。
 * 每个 deliverable 的 contentType 由 post 的 platform 派生。
 */
export function buildSeedCollaboration(campaignId: string, creatorId: string): CollaborationData {
  const works = campaignCreatorWorks(campaignId).find((w) => w.creatorId === creatorId);
  const posts = works?.posts ?? [];

  // 每个 post → 一个 deliverable
  const deliverables: CollaborationDeliverable[] = posts.map((post, i) => {
    const contentType = platformToContentType(post.platform);
    return {
      contentType,
      screenshots: [{ src: post.cover, caption: post.title, url: post.url }],
      metrics: [
        { label: 'Views', value: post.impressions },
        { label: 'Likes', value: post.likes },
        { label: 'Comments', value: post.comments },
        { label: 'Shares', value: post.shares },
      ],
      wordcloud: seedWordcloud(post.title, i),
      audience: seedAudience(i),
    };
  });

  // fallback：无 posts → 至少一个空 deliverable
  if (deliverables.length === 0) {
    deliverables.push({
      contentType: 'post',
      screenshots: [{ src: '', caption: '' }],
      metrics: [{ label: 'Views', value: '0' }],
      wordcloud: [],
      audience: seedAudience(0),
    });
  }

  return { id: collaborationId(campaignId, creatorId), campaignId, creatorId, deliverables };
}

/** 平台名 → ContentType 映射。 */
function platformToContentType(platform: string): ContentType {
  const map = PLATFORM_CONTENT_MAP[platform];
  return map?.[0] ?? 'post';
}

/** 幂等导入一个 campaign 所有合作达人的演示合作记录（按确定性 id upsert）。 */
export async function importSeedCollaborations(campaignId: string, creatorIds: string[]) {
  const items = creatorIds.map((cid) => buildSeedCollaboration(campaignId, cid));
  return dataApi.importMany('collaboration', items);
}
