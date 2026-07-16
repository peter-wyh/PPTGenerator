import type {
  CollaborationData,
  CollaborationDeliverable,
  CommentWordItem,
  ContentType,
  WorkAudienceInsight,
  WorkMetricItem,
  WorkScreenshotItem,
} from '@mediaket/shared';
import { collaborationId } from '@mediaket/shared';
import { campaignCreatorWorks } from './creatorPerformance';
import { dataApi } from '../dataLibrary';

const SENTIMENTS = ['pos', 'neutral', 'neg'] as const;

/**
 * 平台 → 支持的作品类型 + 各类型适用指标。
 * 不同平台、不同作品类型的数据指标会有所不同。
 */
interface MetricSpec {
  /** 指标 label（用于 WorkMetricItem.label / CreatorWorkPost 字段映射）。 */
  label: string;
  /** 中文显示名。 */
  cn: string;
}



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

/** 全部可用指标定义。 */
const ALL_METRICS: Record<string, MetricSpec> = {
  views:     { label: 'Views',     cn: '浏览量' },
  likes:     { label: 'Likes',     cn: '点赞量' },
  comments:  { label: 'Comments',  cn: '评论量' },
  shares:    { label: 'Shares',    cn: '转发量' },
  saves:     { label: 'Saves',     cn: '收藏量' },
  orders:    { label: 'Orders',    cn: '订单量' },
  cpm:       { label: 'CPM',       cn: '千次展示成本' },
  engRate:   { label: 'Eng Rate',  cn: '互动率' },
};

/**
 * 按平台 × 作品类型返回该组合下适用的指标列表。
 * 电商/带货平台（小红书、抖音）→ 含 orders + cpm
 * 视频平台（YouTube/Bilibili）→ 含 views + saves，不含 orders
 * 图文平台（Instagram/Twitter）→ 含 saves，不含 orders
 */
function metricsForPlatform(platform: string, contentType: ContentType): MetricSpec[] {
  const base: MetricSpec[] = [ALL_METRICS.views, ALL_METRICS.likes, ALL_METRICS.comments, ALL_METRICS.shares];
  const p = platform.toLowerCase();

  // 小红书 / 抖音 / TikTok → 带货属性，加 orders + cpm + saves
  if (p === 'red' || p === '小红书' || p === 'douyin' || p === '抖音' || p === 'tiktok') {
    return [...base, ALL_METRICS.saves, ALL_METRICS.orders, ALL_METRICS.cpm, ALL_METRICS.engRate];
  }
  // YouTube / Bilibili → 视频平台，加 saves
  if (p === 'youtube' || p === 'bilibili') {
    return [...base, ALL_METRICS.saves, ALL_METRICS.engRate];
  }
  // Instagram / Facebook / 微博 → 社交图文，加 saves
  if (contentType === 'post' || contentType === 'image' || contentType === 'story') {
    return [...base, ALL_METRICS.saves, ALL_METRICS.engRate];
  }
  // 直播 → 加 orders
  if (contentType === 'live') {
    return [...base, ALL_METRICS.orders, ALL_METRICS.cpm, ALL_METRICS.engRate];
  }
  return [...base, ALL_METRICS.engRate];
}

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
 * 确定性 mock 数值生成（基于 idx 保证同输入同输出）。
 */
function seedMetricValue(label: string, baseImpressions: string, idx: number): string {
  const num = Number(baseImpressions.replace(/[^0-9.]/g, '')) || (idx + 1) * 10000;
  switch (label) {
    case 'Views':
      return baseImpressions;
    case 'Likes':
      return Math.round(num * (0.08 + (idx % 5) * 0.005)).toLocaleString();
    case 'Comments':
      return Math.round(num * (0.005 + (idx % 3) * 0.001)).toLocaleString();
    case 'Shares':
      return Math.round(num * (0.003 + (idx % 3) * 0.0008)).toLocaleString();
    case 'Saves':
      return Math.round(num * (0.02 + (idx % 4) * 0.003)).toLocaleString();
    case 'Orders':
      return Math.round(num * (0.0002 + (idx % 5) * 0.00005)).toString();
    case 'CPM':
      return `¥${(8 + (idx % 7) * 2.5).toFixed(2)}`;
    case 'Eng Rate':
      return `${(6 + (idx % 4) * 0.8).toFixed(1)}%`;
    default:
      return '0';
  }
}

/**
 * 确定性 mock 发布日期（基于 idx）。
 */
function seedPublishedAt(idx: number): string {
  const base = new Date('2024-08-01');
  base.setDate(base.getDate() + idx * 7);
  return base.toISOString().slice(0, 10);
}

/**
 * 从 creatorPerformance mock 为 (campaign, creator) 组装一条合作记录。
 *
 * **核心改造**：
 * 1. 同一 contentType 的 posts 聚合为一个 deliverable（不重复）。
 * 2. 每个 deliverable 支持多张截图（一个作品可有多张）。
 * 3. 指标按平台 × contentType 差异化生成（电商含 orders/CPM）。
 * 4. 每个 deliverable 带 publishedAt 发布时间。
 */
export function buildSeedCollaboration(campaignId: string, creatorId: string): CollaborationData {
  const works = campaignCreatorWorks(campaignId).find((w) => w.creatorId === creatorId);
  const posts = works?.posts ?? [];
  const platform = works?.platform ?? '';

  // 按 contentType 分组（同一类型只保留一个 deliverable）
  const contentTypeGroups = new Map<ContentType, typeof posts>();

  for (const post of posts) {
    const contentType = platformToContentType(post.platform);
    if (!contentTypeGroups.has(contentType)) {
      contentTypeGroups.set(contentType, []);
    }
    contentTypeGroups.get(contentType)!.push(post);
  }

  let deliverableIdx = 0;
  const deliverables: CollaborationDeliverable[] = [];

  for (const [contentType, groupPosts] of contentTypeGroups) {
    // 合并多张截图（取每个 post 的封面 + title 作为截图）
    const screenshots: WorkScreenshotItem[] = groupPosts.map((post) => ({
      src: post.cover || post.screenshots?.[0]?.src || '',
      caption: post.title,
      url: post.url || post.screenshots?.[0]?.url,
    }));

    // 取该组合下适用的指标
    const spec = metricsForPlatform(platform, contentType);

    // 指标值取该组第一个 post 的数据（代表性）
    const repPost = groupPosts[0];
    const baseImpressions = repPost.impressions || `${(deliverableIdx + 1) * 10000}`;

    const metrics: WorkMetricItem[] = spec.map((m) => ({
      label: m.label,
      value: seedMetricValue(m.label, baseImpressions, deliverableIdx),
    }));

    deliverables.push({
      contentType,
      screenshots,
      metrics,
      wordcloud: seedWordcloud(repPost.title || contentType, deliverableIdx),
      audience: seedAudience(deliverableIdx),
      publishedAt: repPost.publishedAt || seedPublishedAt(deliverableIdx),
      platform,
    });
    deliverableIdx++;
  }

  // fallback：无 posts → 至少一个空 deliverable
  if (deliverables.length === 0) {
    deliverables.push({
      contentType: 'post',
      screenshots: [{ src: '', caption: '' }],
      metrics: metricsForPlatform(platform, 'post').map((m) => ({
        label: m.label,
        value: seedMetricValue(m.label, '10000', 0),
      })),
      wordcloud: [],
      audience: seedAudience(0),
      publishedAt: seedPublishedAt(0),
      platform,
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
