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

/** 常见的合作方式组合模板（按内容形式维度）。 */
const COLLAB_COMBOS: ContentType[][] = [
  ['post'],
  ['reels'],
  ['video'],
  ['post', 'reels'],
  ['post', 'story'],
  ['reels', 'story'],
  ['post', 'reels', 'story'],
  ['video', 'post'],
  ['image', 'reels'],
  ['post', 'live'],
  ['reels', 'image'],
  ['video', 'reels'],
  ['post', 'video', 'reels'],
  ['image'],
  ['story'],
  ['live'],
];

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
 * 简单确定性哈希（用于根据 campaignId+creatorId 选不同的合作组合）。
 */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** 解析 compact 格式数字（如 "1.2M" → 1200000, "45K" → 45000）。 */
function parseCompact(s: string): number {
  if (!s) return 0;
  const n = parseFloat(s.replace(/,/g, ''));
  if (isNaN(n)) return 0;
  const last = s.trim().slice(-1).toUpperCase();
  if (last === 'M') return Math.round(n * 1_000_000);
  if (last === 'K') return Math.round(n * 1_000);
  return n;
}

/**
 * 从 creatorPerformance mock 为 (campaign, creator) 组装一条合作记录。
 * 根据 campaign 的 platforms 配置 + 确定性哈希选取 1~3 种 contentType 组合，
 * 每种 deliverable 都填充截图、效果、词云、受众四类数据。
 */
export function buildSeedCollaboration(campaignId: string, creatorId: string): CollaborationData {
  const works = campaignCreatorWorks(campaignId).find((w) => w.creatorId === creatorId);

  // 收集该 campaign 声明的所有平台可产出的 contentType 候选
  const works2 = campaignCreatorWorks(campaignId);
  // 从 works 的 posts 中提取 platform → contentTypes
  const postPlatforms = [...new Set((works?.posts ?? []).map((p) => p.platform))];
  // 用 campaign 的其他达人 posts 补充 platform 信息
  const allPlatforms = [
    ...postPlatforms,
    ...works2.flatMap((w) => w.posts.map((p) => p.platform)),
  ];
  const uniquePlatforms = [...new Set(allPlatforms)];

  // 汇总所有候选 contentType
  const candidatePool: ContentType[] = [];
  for (const plat of uniquePlatforms) {
    const mapped = PLATFORM_CONTENT_MAP[plat] ?? ['post'];
    for (const ct of mapped) {
      if (!candidatePool.includes(ct)) candidatePool.push(ct);
    }
  }
  if (candidatePool.length === 0) candidatePool.push('post', 'reels');

  // 确定性选组合
  const seed = hashStr(`${campaignId}:${creatorId}`);
  const comboIdx = seed % COLLAB_COMBOS.length;
  // 优先选与候选池交集最多的组合
  let chosenCombo = COLLAB_COMBOS[comboIdx];
  // 过滤：只保留候选池中存在的 contentType
  chosenCombo = chosenCombo.filter((ct) => candidatePool.includes(ct));
  if (chosenCombo.length === 0) chosenCombo = candidatePool.slice(0, 1);

  // 为每种 contentType 构建 deliverable，复用 posts 中的实际数据
  const posts = works?.posts ?? [];
  const deliverables: CollaborationDeliverable[] = [];

  for (let i = 0; i < chosenCombo.length; i++) {
    const contentType = chosenCombo[i];
    // 每个 deliverable 分配 1~3 个 post 的截图（轮转取，尽量不重复）
    const shotsPerDel = Math.min(3, Math.max(1, Math.ceil(posts.length / chosenCombo.length)));
    const assignedPosts: typeof posts = [];
    for (let s = 0; s < shotsPerDel; s++) {
      const pi = (i * shotsPerDel + s) % Math.max(posts.length, 1);
      if (posts[pi]) assignedPosts.push(posts[pi]);
    }

    deliverables.push({
      contentType,
      screenshots: assignedPosts.length > 0
        ? assignedPosts.map((p) => ({ src: p.cover, caption: p.title, url: p.url }))
        : [{ src: '', caption: '' }],
      metrics: assignedPosts[0]
        ? [
            { label: 'Views', value: assignedPosts.reduce((sum, p) => sum + parseCompact(p.impressions), 0).toLocaleString('en-US') },
            { label: 'Likes', value: assignedPosts.reduce((sum, p) => sum + parseCompact(p.likes), 0).toLocaleString('en-US') },
            { label: 'Comments', value: assignedPosts.reduce((sum, p) => sum + parseCompact(p.comments), 0).toLocaleString('en-US') },
            { label: 'Shares', value: assignedPosts.reduce((sum, p) => sum + parseCompact(p.shares), 0).toLocaleString('en-US') },
          ]
        : [{ label: 'Views', value: '0' }],
      wordcloud: seedWordcloud(assignedPosts[0]?.title ?? '', i),
      audience: seedAudience(i),
    });
  }

  return { id: collaborationId(campaignId, creatorId), campaignId, creatorId, deliverables };
}

/** 幂等导入一个 campaign 所有合作达人的演示合作记录（按确定性 id upsert）。 */
export async function importSeedCollaborations(campaignId: string, creatorIds: string[]) {
  const items = creatorIds.map((cid) => buildSeedCollaboration(campaignId, cid));
  return dataApi.importMany('collaboration', items);
}
