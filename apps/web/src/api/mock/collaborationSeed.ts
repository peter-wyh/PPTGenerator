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



/**
 * 平台 → 该平台支持的作品类型 + 对应合作方式名称。
 * 基于真实平台能力校准：
 *
 * | 平台       | 作品类型                     | 合作方式中文名          |
 * | ---------- | --------------------------- | --------------------- |
 * | TikTok     | 短视频 (video)、图文 (image) | Spark Ads / Content    |
 * | Instagram  | 帖子 (post)、Reels、Story    | Content / Affiliate    |
 * | YouTube    | 长视频 (video)               | Long-form Review      |
 * | Douyin     | 短视频 (video)、图文 (image) | 星图/内容推广           |
 * | RED        | 图文笔记 (post)、视频 (video)| 种草/合作笔记           |
 * | Weibo      | 微博 (post)、直播 (live)     | 微博推广/直播带货       |
 * | Bilibili   | 视频 (video)                 | 合约推广/商单           |
 * | Twitter/X  | 推文 (post)                  | 推广合作                |
 * | Facebook   | 帖子 (post)、直播 (live)     | 品牌内容/直播           |
 */
interface PlatformSpec {
  /** 该平台可用的作品类型。 */
  contentTypes: ContentType[];
  /** 合作方式中文名（用于显示，如合作方式列）。 */
  collabLabel: string;
  /** 合作方式英文名（对应 CAMPAIGN_PROFILE.platforms[].collaborationType）。 */
  collabTypeEn: string[];
}

const PLATFORM_SPECS: Record<string, PlatformSpec> = {
  TikTok:    { contentTypes: ['video', 'image'], collabLabel: 'Spark Ads / 内容合作', collabTypeEn: ['Spark Ads', 'Content'] },
  Instagram: { contentTypes: ['post', 'reels', 'story'], collabLabel: '品牌内容 / 联盟带货', collabTypeEn: ['Content', 'Affiliate'] },
  YouTube:   { contentTypes: ['video'], collabLabel: '长视频评测 / 品牌合作', collabTypeEn: ['Long-form Review', 'Content'] },
  Douyin:    { contentTypes: ['video', 'image'], collabLabel: '星图/内容推广', collabTypeEn: ['Content', 'Spark Ads'] },
  RED:       { contentTypes: ['post', 'video'], collabLabel: '种草笔记 / 品牌合作', collabTypeEn: ['Content', 'Affiliate'] },
  Weibo:     { contentTypes: ['post', 'live'], collabLabel: '微博推广 / 直播带货', collabTypeEn: ['Content', 'Affiliate'] },
  Bilibili:  { contentTypes: ['video'], collabLabel: '商单推广 / B站合作', collabTypeEn: ['Long-form Review', 'Content'] },
  Twitter:   { contentTypes: ['post'], collabLabel: '推广合作', collabTypeEn: ['Content'] },
  Facebook:  { contentTypes: ['post', 'live'], collabLabel: '品牌内容 / 直播', collabTypeEn: ['Content', 'Affiliate'] },
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
 *
 * **真实平台校准**：
 *
 * | 平台       | Views | Likes | Comments | Shares | Saves | Orders | CPM | EngRate |
 * | ---------- | ----- | ----- | -------- | ------ | ----- | ------ | --- | ------- |
 * | TikTok     |  ✅   |  ✅   |    ✅    |  ✅    |  ✅   |  ✅    | ✅  |   ✅    |
 * | Douyin     |  ✅   |  ✅   |    ✅    |  ✅    |  ✅   |  ✅    | ✅  |   ✅    |
 * | Instagram  |  ✅   |  ✅   |    ✅    |  —     |  ✅   |  ✅*   | ✅  |   ✅    |
 * | Instagram Story | ✅ | ✅ |   —    |  —     |  —    |  —     | —   |   ✅    |
 * | YouTube    |  ✅   |  ✅   |    ✅    |  —     |  —    |  ✅*   | ✅  |   ✅    |
 * | RED/小红书 |  ✅   |  ✅   |    ✅    |  —     |  ✅   |  ✅    | ✅  |   ✅    |
 * | Weibo      |  ✅   |  ✅   |    ✅    |  ✅    |  —    |  ✅    | ✅  |   ✅    |
 * | Weibo Live |  ✅   |  ✅   |    ✅    |  ✅    |  —    |  ✅    | ✅  |   ✅    |
 * | Bilibili   |  ✅   |  ✅   |    ✅    |  —     |  ✅   |  ✅*   | ✅  |   ✅    |
 * | Twitter/X  |  ✅   |  ✅   |    ✅    |  ✅    |  —    |  —     | —   |   ✅    |
 * | Facebook   |  ✅   |  ✅   |    ✅    |  ✅    |  —    |  ✅*   | ✅  |   ✅    |
 * | Facebook Live | ✅ | ✅ |   ✅    |  —     |  —    |  ✅    | ✅  |   ✅    |
 *
 * 注：✅* = 仅在 affiliate/带货合作时有此指标。
 * Instagram 没有原生 Shares（通过 DM 分享不算公开数据），用 Saves 替代。
 * YouTube 没有 Shares（分享是私密的），也没有原生 Saves（Playlist 替代）。
 * Story 类型数据维度较少（通常只有浏览量和少量互动）。
 */
function metricsForPlatform(platform: string, contentType: ContentType): MetricSpec[] {
  const p = platform.toLowerCase();
  const viewsLikes = [ALL_METRICS.views, ALL_METRICS.likes, ALL_METRICS.engRate];

  // ─── TikTok（短视频+图文，数据维度最全）───
  if (p === 'tiktok') {
    return [...viewsLikes, ALL_METRICS.comments, ALL_METRICS.shares, ALL_METRICS.saves, ALL_METRICS.orders, ALL_METRICS.cpm];
  }

  // ─── 抖音 Douyin（与 TikTok 类似）───
  if (p === 'douyin' || p === '抖音') {
    return [...viewsLikes, ALL_METRICS.comments, ALL_METRICS.shares, ALL_METRICS.saves, ALL_METRICS.orders, ALL_METRICS.cpm];
  }

  // ─── Instagram ───
  if (p === 'instagram') {
    if (contentType === 'story') {
      // Story 数据维度最少：仅 Views + Likes + EngRate
      return [ALL_METRICS.views, ALL_METRICS.likes, ALL_METRICS.engRate];
    }
    // post / reels：有 Comments + Saves，无 Shares，affiliate 可有 Orders
    return [...viewsLikes, ALL_METRICS.comments, ALL_METRICS.saves, ALL_METRICS.orders, ALL_METRICS.cpm];
  }

  // ─── YouTube ───
  if (p === 'youtube') {
    // video：有 Comments，无 Shares/Saves，affiliate 可有 Orders
    return [...viewsLikes, ALL_METRICS.comments, ALL_METRICS.orders, ALL_METRICS.cpm];
  }

  // ─── Bilibili ───
  if (p === 'bilibili') {
    // video：有 Comments + Saves（收藏/投币），无 Shares，可能有 Orders
    return [...viewsLikes, ALL_METRICS.comments, ALL_METRICS.saves, ALL_METRICS.orders, ALL_METRICS.cpm];
  }

  // ─── 小红书 RED ───
  if (p === 'red' || p === '小红书') {
    // post / video：有 Comments + Saves（收藏核心指标），无 Shares，有 Orders + CPM（种草转化）
    return [...viewsLikes, ALL_METRICS.comments, ALL_METRICS.saves, ALL_METRICS.orders, ALL_METRICS.cpm];
  }

  // ─── 微博 Weibo ───
  if (p === 'weibo' || p === '微博') {
    // post：有 Comments + Shares（转发是微博核心），无 Saves
    // live：加 Orders
    if (contentType === 'live') {
      return [...viewsLikes, ALL_METRICS.comments, ALL_METRICS.shares, ALL_METRICS.orders, ALL_METRICS.cpm];
    }
    return [...viewsLikes, ALL_METRICS.comments, ALL_METRICS.shares, ALL_METRICS.orders, ALL_METRICS.cpm];
  }

  // ─── Twitter/X ───
  if (p === 'twitter' || p === 'x') {
    // post：有 Comments + Shares（Retweet），无 Saves，无 Orders（非电商）
    return [...viewsLikes, ALL_METRICS.comments, ALL_METRICS.shares];
  }

  // ─── Facebook ───
  if (p === 'facebook') {
    if (contentType === 'live') {
      return [...viewsLikes, ALL_METRICS.comments, ALL_METRICS.shares, ALL_METRICS.orders, ALL_METRICS.cpm];
    }
    return [...viewsLikes, ALL_METRICS.comments, ALL_METRICS.shares, ALL_METRICS.orders, ALL_METRICS.cpm];
  }

  // ─── 默认 fallback ───
  return [...viewsLikes, ALL_METRICS.comments, ALL_METRICS.shares];
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

/** 平台名 → 默认 ContentType 映射（第一个 post 如果无法推断 contentType 时的 fallback）。 */
function platformToContentType(platform: string): ContentType {
  const spec = PLATFORM_SPECS[platform];
  return spec?.contentTypes[0] ?? 'post';
}

/** 平台 → 合作方式中文名。 */
export function platformCollabLabel(platform: string): string {
  return PLATFORM_SPECS[platform]?.collabLabel ?? '合作';
}

/** 幂等导入一个 campaign 所有合作达人的演示合作记录（按确定性 id upsert）。 */
export async function importSeedCollaborations(campaignId: string, creatorIds: string[]) {
  const items = creatorIds.map((cid) => buildSeedCollaboration(campaignId, cid));
  return dataApi.importMany('collaboration', items);
}
