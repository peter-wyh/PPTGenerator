/**
 * 合作方 mock 数据（demo）— 达人(creator) / 内容站(content_site) / 社群(community)。
 *
 * 三类合作方共享相同维度（国家、品类、engagement rate、用户画像、insight），
 * 但核心指标差异化：
 *   - creator:     followers, engagement, impressions
 *   - content_site: monthly visits, bounce rate, avg session duration
 *   - community:   members, active users, daily messages
 *
 * 所有数值为确定性 mock，近似真实量级。
 */

/* ========================= 类型定义 ========================= */

export type PartnerType = 'creator' | 'content_site' | 'community';

/** 共享维度 */
export interface PartnerShared {
  id: string;
  name: string;
  handle: string;
  partnerType: PartnerType;
  platform: string;
  tier: 'mega' | 'macro' | 'micro';
  category: string;
  region: string;
  /** 核心指标 1（达人=followers / 内容站=monthly visits / 社群=members） */
  primaryMetric: string;
  /** 核心指标 2（达人=engagement rate / 内容站=bounce rate / 社群=active users） */
  secondaryMetric: string;
  /** 合作状态 */
  status: 'completed' | 'in-progress' | 'contracted';
  /** 合作费用 */
  contractFee: number;
  /** 内容形式 */
  contentType: string;
}

/** 用户画像（年龄/性别/兴趣） */
export interface AudienceProfile {
  ageGroups: { label: string; value: number }[];
  gender: { label: string; value: number }[];
  topCountries: { label: string; value: number }[];
  topInterests: string[];
}

/** 合作效果指标 */
export interface PartnerPerformance {
  partnerId: string;
  impressions: number;
  engagement: number;
  clicks: number;
  orders: number;
  gmv: number;
  commission: number;
  roas: number;
}

/** 合作洞察 */
export interface PartnerInsight {
  partnerId: string;
  strengths: string[];
  recommendations: string[];
  riskNotes?: string[];
}

/* ========================= 达人数据 ========================= */

export const CREATOR_PARTNERS: PartnerShared[] = [
  { id: 'cre-mia', name: 'Mia Chen', handle: '@miaglowup', partnerType: 'creator', platform: 'TikTok', tier: 'mega', category: 'Beauty', region: 'US / UK',
    primaryMetric: '1.28M', secondaryMetric: '8.7%', status: 'completed', contractFee: 8500, contentType: '短视频 × 3' },
  { id: 'cre-jamie', name: 'Jamie Park', handle: '@jamiepark', partnerType: 'creator', platform: 'TikTok', tier: 'mega', category: 'Beauty', region: 'Korea',
    primaryMetric: '2.10M', secondaryMetric: '9.3%', status: 'completed', contractFee: 12000, contentType: '短视频 × 3' },
  { id: 'cre-iris', name: 'Iris Wang', handle: '@iriswang', partnerType: 'creator', platform: 'Instagram', tier: 'mega', category: 'Lifestyle', region: 'Asia',
    primaryMetric: '1.55M', secondaryMetric: '7.1%', status: 'completed', contractFee: 9500, contentType: 'Reels + 图文 × 2' },
  { id: 'cre-sofia', name: 'Sofia Lane', handle: '@sofialane', partnerType: 'creator', platform: 'TikTok', tier: 'macro', category: 'Skincare', region: 'US',
    primaryMetric: '684K', secondaryMetric: '6.2%', status: 'completed', contractFee: 3500, contentType: '短视频 × 2' },
  { id: 'cre-nora', name: 'Nora Kim', handle: '@noraskin', partnerType: 'creator', platform: 'Instagram', tier: 'macro', category: 'Skincare', region: 'Korea',
    primaryMetric: '530K', secondaryMetric: '5.8%', status: 'in-progress', contractFee: 3000, contentType: '图文 × 2' },
  { id: 'cre-marcus', name: 'Marcus Lee', handle: '@marcuslee', partnerType: 'creator', platform: 'YouTube', tier: 'macro', category: 'Review', region: 'US',
    primaryMetric: '1.10M', secondaryMetric: '3.8%', status: 'completed', contractFee: 6000, contentType: '长视频 × 1' },
];

/* ========================= 内容站数据 ========================= */

export const CONTENT_SITE_PARTNERS: PartnerShared[] = [
  { id: 'site-glowguide', name: 'GlowGuide', handle: 'glowguide.com', partnerType: 'content_site', platform: 'WordPress Blog', tier: 'mega', category: 'Beauty/Skincare', region: 'Global',
    primaryMetric: '3.2M visits/mo', secondaryMetric: '42% bounce', status: 'completed', contractFee: 5000, contentType: 'Banner + Review × 2' },
  { id: 'site-skincarerev', name: 'SkincareRev', handle: 'skincarerev.com', partnerType: 'content_site', platform: 'Content Site', tier: 'macro', category: 'Skincare', region: 'US',
    primaryMetric: '1.1M visits/mo', secondaryMetric: '38% bounce', status: 'completed', contractFee: 2500, contentType: 'Deep Review × 1' },
  { id: 'site-beautylab', name: 'BeautyLab Daily', handle: 'beautylabdaily.com', partnerType: 'content_site', platform: 'Media Site', tier: 'macro', category: 'Beauty', region: 'Asia',
    primaryMetric: '850K visits/mo', secondaryMetric: '45% bounce', status: 'in-progress', contractFee: 2000, contentType: 'Sponsored Article × 2' },
  { id: 'site-dermastack', name: 'DermaStack', handle: 'dermastack.com', partnerType: 'content_site', platform: 'Review Site', tier: 'micro', category: 'Dermatology', region: 'US / EU',
    primaryMetric: '320K visits/mo', secondaryMetric: '29% bounce', status: 'completed', contractFee: 800, contentType: 'Product Listing × 1' },
];

/* ========================= 社群数据 ========================= */

export const COMMUNITY_PARTNERS: PartnerShared[] = [
  { id: 'com-skincarejunkies', name: 'Skincare Junkies', handle: 'discord.gg/skincarejunkies', partnerType: 'community', platform: 'Discord', tier: 'mega', category: 'Skincare', region: 'Global',
    primaryMetric: '180K members', secondaryMetric: '42K active', status: 'completed', contractFee: 4000, contentType: 'AMA + Banner' },
  { id: 'com-glowgang', name: 'Glow Gang', handle: 't.me/glowgang', partnerType: 'community', platform: 'Telegram', tier: 'mega', category: 'Beauty', region: 'Asia',
    primaryMetric: '95K members', secondaryMetric: '28K active', status: 'completed', contractFee: 3000, contentType: 'Group Buy + Pin' },
  { id: 'com-beautybar', name: 'Beauty Bar Club', handle: 'reddit.com/r/beautybar', partnerType: 'community', platform: 'Reddit', tier: 'macro', category: 'Beauty', region: 'US / UK',
    primaryMetric: '62K members', secondaryMetric: '15K active', status: 'in-progress', contractFee: 1500, contentType: 'Megathread × 1' },
  { id: 'com-kbeauty', name: 'K-Beauty Insiders', handle: 'discord.gg/kbeauty', partnerType: 'community', platform: 'Discord', tier: 'macro', category: 'K-Beauty', region: 'Korea / Global',
    primaryMetric: '48K members', secondaryMetric: '12K active', status: 'contracted', contractFee: 1200, contentType: 'Product Drop + AMA' },
];

/* ========================= 合并导出 ========================= */

export const ALL_PARTNERS: PartnerShared[] = [
  ...CREATOR_PARTNERS,
  ...CONTENT_SITE_PARTNERS,
  ...COMMUNITY_PARTNERS,
];

/* ========================= 用户画像 mock ========================= */

export const AUDIENCE_PROFILES: Record<string, AudienceProfile> = {
  // 达人画像
  'cre-mia': {
    ageGroups: [{ label: '18-24', value: 38 }, { label: '25-34', value: 42 }, { label: '35-44', value: 14 }, { label: '45+', value: 6 }],
    gender: [{ label: 'Female', value: 78 }, { label: 'Male', value: 20 }, { label: 'Other', value: 2 }],
    topCountries: [{ label: 'US', value: 42 }, { label: 'UK', value: 18 }, { label: 'Canada', value: 12 }, { label: 'Australia', value: 8 }],
    topInterests: ['Beauty', 'Skincare', 'Lifestyle', 'Fashion'],
  },
  'cre-jamie': {
    ageGroups: [{ label: '18-24', value: 45 }, { label: '25-34', value: 35 }, { label: '35-44', value: 12 }, { label: '45+', value: 8 }],
    gender: [{ label: 'Female', value: 82 }, { label: 'Male', value: 16 }, { label: 'Other', value: 2 }],
    topCountries: [{ label: 'Korea', value: 38 }, { label: 'US', value: 25 }, { label: 'Japan', value: 15 }, { label: 'China', value: 10 }],
    topInterests: ['Beauty', 'K-Pop', 'Skincare', 'Travel'],
  },
  'cre-iris': {
    ageGroups: [{ label: '18-24', value: 28 }, { label: '25-34', value: 48 }, { label: '35-44', value: 16 }, { label: '45+', value: 8 }],
    gender: [{ label: 'Female', value: 71 }, { label: 'Male', value: 26 }, { label: 'Other', value: 3 }],
    topCountries: [{ label: 'China', value: 35 }, { label: 'Taiwan', value: 20 }, { label: 'US', value: 15 }, { label: 'Singapore', value: 10 }],
    topInterests: ['Lifestyle', 'Beauty', 'Food', 'Travel'],
  },
  // 内容站画像
  'site-glowguide': {
    ageGroups: [{ label: '18-24', value: 20 }, { label: '25-34', value: 45 }, { label: '35-44', value: 22 }, { label: '45+', value: 13 }],
    gender: [{ label: 'Female', value: 68 }, { label: 'Male', value: 30 }, { label: 'Other', value: 2 }],
    topCountries: [{ label: 'US', value: 35 }, { label: 'UK', value: 15 }, { label: 'India', value: 12 }, { label: 'Germany', value: 8 }],
    topInterests: ['Skincare', 'Product Reviews', 'Beauty Tutorials', 'Ingredients'],
  },
  'site-skincarerev': {
    ageGroups: [{ label: '18-24', value: 15 }, { label: '25-34', value: 50 }, { label: '35-44', value: 25 }, { label: '45+', value: 10 }],
    gender: [{ label: 'Female', value: 64 }, { label: 'Male', value: 34 }, { label: 'Other', value: 2 }],
    topCountries: [{ label: 'US', value: 55 }, { label: 'Canada', value: 12 }, { label: 'UK', value: 8 }],
    topInterests: ['Skincare Science', 'Product Reviews', 'Dermatology', 'Anti-aging'],
  },
  // 社群画像
  'com-skincarejunkies': {
    ageGroups: [{ label: '18-24', value: 32 }, { label: '25-34', value: 44 }, { label: '35-44', value: 16 }, { label: '45+', value: 8 }],
    gender: [{ label: 'Female', value: 74 }, { label: 'Male', value: 23 }, { label: 'Other', value: 3 }],
    topCountries: [{ label: 'US', value: 40 }, { label: 'UK', value: 14 }, { label: 'Philippines', value: 10 }],
    topInterests: ['Skincare', 'Product Swaps', 'Routine Sharing', 'Ingredients'],
  },
  'com-glowgang': {
    ageGroups: [{ label: '18-24', value: 35 }, { label: '25-34', value: 40 }, { label: '35-44', value: 18 }, { label: '45+', value: 7 }],
    gender: [{ label: 'Female', value: 85 }, { label: 'Male', value: 12 }, { label: 'Other', value: 3 }],
    topCountries: [{ label: 'China', value: 30 }, { label: 'Korea', value: 22 }, { label: 'Japan', value: 15 }, { label: 'US', value: 12 }],
    topInterests: ['Beauty Deals', 'Group Buy', 'K-Beauty', 'Skincare'],
  },
};

/* ========================= 合作效果 mock ========================= */

export const PARTNER_PERFORMANCES: Record<string, PartnerPerformance> = {
  'cre-mia':      { partnerId: 'cre-mia', impressions: 2500000, engagement: 152000, clicks: 100000, orders: 302, gmv: 57078, commission: 6849, roas: 3.51 },
  'cre-jamie':    { partnerId: 'cre-jamie', impressions: 2400000, engagement: 143000, clicks: 96000, orders: 300, gmv: 56700, commission: 6804, roas: 3.51 },
  'cre-iris':     { partnerId: 'cre-iris', impressions: 1800000, engagement: 106000, clicks: 72000, orders: 228, gmv: 43092, commission: 5171, roas: 3.51 },
  'cre-sofia':    { partnerId: 'cre-sofia', impressions: 792000, engagement: 48000, clicks: 31680, orders: 117, gmv: 22113, commission: 2654, roas: 3.49 },
  'cre-nora':     { partnerId: 'cre-nora', impressions: 720000, engagement: 43000, clicks: 28800, orders: 106, gmv: 20034, commission: 2404, roas: 3.49 },
  'cre-marcus':   { partnerId: 'cre-marcus', impressions: 369000, engagement: 22000, clicks: 14760, orders: 45, gmv: 8505, commission: 1021, roas: 3.46 },
  'site-glowguide':  { partnerId: 'site-glowguide', impressions: 3200000, engagement: 448000, clicks: 224000, orders: 672, gmv: 127008, commission: 15241, roas: 3.52 },
  'site-skincarerev':{ partnerId: 'site-skincarerev', impressions: 1100000, engagement: 176000, clicks: 88000, orders: 264, gmv: 49896, commission: 5988, roas: 3.50 },
  'site-beautylab': { partnerId: 'site-beautylab', impressions: 850000, engagement: 136000, clicks: 68000, orders: 204, gmv: 38556, commission: 4627, roas: 3.49 },
  'site-dermastack':{ partnerId: 'site-dermastack', impressions: 320000, engagement: 64000, clicks: 32000, orders: 96, gmv: 18144, commission: 2177, roas: 3.51 },
  'com-skincarejunkies': { partnerId: 'com-skincarejunkies', impressions: 1800000, engagement: 360000, clicks: 126000, orders: 378, gmv: 71442, commission: 8573, roas: 3.50 },
  'com-glowgang':        { partnerId: 'com-glowgang', impressions: 950000, engagement: 218500, clicks: 66500, orders: 199, gmv: 37611, commission: 4513, roas: 3.50 },
  'com-beautybar':       { partnerId: 'com-beautybar', impressions: 620000, engagement: 124000, clicks: 43400, orders: 130, gmv: 24570, commission: 2948, roas: 3.49 },
  'com-kbeauty':         { partnerId: 'com-kbeauty', impressions: 480000, engagement: 96000, clicks: 33600, orders: 101, gmv: 19089, commission: 2291, roas: 3.50 },
};

/* ========================= 合作洞察 mock ========================= */

export const PARTNER_INSIGHTS: Record<string, PartnerInsight> = {
  'cre-mia': {
    partnerId: 'cre-mia',
    strengths: ['Highest absolute reach (2.5M impressions)', 'Strong emotional storytelling driving 87K likes', 'Audience highly aligned with beauty/skincare (78% female)'],
    recommendations: ['Re-sign for Q1 with expanded deliverables (add YouTube Shorts)', 'Test new product line (eye cream) with same creator'],
  },
  'site-glowguide': {
    partnerId: 'site-glowguide',
    strengths: ['Highest CPS GMV ($127K) across all partner types', 'Long-tail SEO traffic provides sustained conversions', '42% bounce rate is excellent for content sites'],
    recommendations: ['Renew annual partnership with expanded banner placement', 'Commission a comparison article vs competitor products'],
    riskNotes: ['40% of traffic from Google — algorithm changes could impact reach'],
  },
  'com-skincarejunkies': {
    partnerId: 'com-skincarejunkies',
    strengths: ['Highest engagement rate among communities (20%)', 'AMA format drove 378 orders — best CPS per-post efficiency', 'Members self-organize product swaps, amplifying organic reach'],
    recommendations: ['Run monthly AMA cadence instead of one-off', 'Create exclusive community discount code for tracking'],
    riskNotes: ['Community moderation overhead — assign dedicated CM'],
  },
};
