import type {
  CampaignMetric,
  CreatorCampaignPerformance,
  CreatorCps,
  PlacementPerformance,
  PlacementTypeSummary,
  PlacementTrendPoint,
  PostEffect,
  PostFormat,
} from '@mediakit/shared';

/**
 * 上游「达人执行效果」接口（demo 中 mock）。
 * 返回某 campaign 下各参与达人的执行效果：帖子效果数据 + CPS（带货）数据。
 * 真实环境对接投放系统 / 电商回传（CPS = Cost Per Sale，按销售分成）。
 *
 * 数值由「达人层级基线 × campaign 强度」确定性生成，贴近真实量级；
 * 无随机数（同样输入 → 同样输出），便于回归与截图。
 */

type Tier = '头部' | '腰部' | 'KOC';

/** 创作者花名册（id / 名称 / handle / 层级），与 creators.ts 对齐。 */
interface CreatorRoster {
  id: string;
  name: string;
  handle: string;
  tier: Tier;
}

const ROSTER: Record<string, CreatorRoster> = {
  'cre-mia': { id: 'cre-mia', name: 'Mia Chen', handle: '@miaglowup', tier: '头部' },
  'cre-sofia': { id: 'cre-sofia', name: 'Sofia Lane', handle: '@sofialane', tier: '腰部' },
  'cre-ava': { id: 'cre-ava', name: 'Ava Park', handle: '@avapark.daily', tier: '腰部' },
  'cre-jamie': { id: 'cre-jamie', name: 'Jamie Wu', handle: '@jamiewu', tier: 'KOC' },
  'cre-leo': { id: 'cre-leo', name: 'Leo Sato', handle: '@leosato', tier: '头部' },
  'cre-nora': { id: 'cre-nora', name: 'Nora Kim', handle: '@nora.kim', tier: '腰部' },
  'cre-tom': { id: 'cre-tom', name: 'Tom Reyes', handle: '@tomreyes', tier: 'KOC' },
};

/** 各层级基线：单帖曝光 / 平均互动率 / 单 campaign 带货潜力 GMV。 */
const TIER_BASE: Record<Tier, { impr: number; er: number; gmv: number }> = {
  头部: { impr: 850_000, er: 8.4, gmv: 240_000 },
  腰部: { impr: 360_000, er: 6.8, gmv: 70_000 },
  KOC: { impr: 90_000, er: 10.5, gmv: 16_000 },
};

/** 单帖曝光抖动系数（按帖子序号取，确定性，避免每帖数值雷同）。 */
const POST_JITTER = [1.0, 0.72, 1.28, 0.86];

/** 视频类平台（有播放量；其余按图文计）。 */
const VIDEO_PLATFORMS = new Set(['TikTok', '抖音', 'B站', 'YouTube']);

interface CampaignProfile {
  platform: string;
  startDate: string;
  /** campaign 强度系数（反映预算 / 大盘表现）。 */
  intensity: number;
  /** CPS 佣金比例（小数，0.12 = 12%）。 */
  commissionPct: number;
  /** 客单价（元）。 */
  aov: number;
  /** 帖子标题池（创作者按序取用）。 */
  titles: string[];
  /** 参与 creatorId 列表（顺序即取标题顺序）。 */
  creators: string[];
}

const CAMPAIGN_PROFILE: Record<string, CampaignProfile> = {
  'camp-glowlab-q4': {
    platform: 'TikTok',
    startDate: '2026-10-12',
    intensity: 1.0,
    commissionPct: 0.12,
    aov: 189,
    titles: [
      '敏感肌7天急救 vlog｜红脸期靠它稳住',
      '成分党实测｜神经酰胺精华到底有没有用',
      '换季烂脸自救指南｜3步修护屏障',
      '素颜也敢出门！养厚角质层的心得',
    ],
    creators: ['cre-mia', 'cre-sofia', 'cre-tom'],
  },
  'camp-lumiere-launch': {
    platform: '抖音',
    startDate: '2026-09-01',
    intensity: 0.85,
    commissionPct: 0.15,
    aov: 359,
    titles: [
      '30+ 抗老实录｜用满一罐后的真实变化',
      '贵妇面霜值不值？28天打卡对比',
      '法令纹淡化？抗老面霜盲测分享',
      '熬夜垮脸救星｜提拉紧致实测',
    ],
    creators: ['cre-jamie', 'cre-mia', 'cre-sofia'],
  },
  'camp-nova-home-618': {
    platform: '小红书',
    startDate: '2026-05-20',
    intensity: 1.25,
    commissionPct: 0.08,
    aov: 129,
    titles: [
      '租房改造｜百元好物提升幸福感',
      '618 囤货清单｜家居必买 TOP10',
      '小户型收纳神器真实测评',
      '氛围感家装配色分享｜抄作业',
    ],
    creators: ['cre-ava', 'cre-nora', 'cre-sofia'],
  },
  'camp-motion-spring': {
    platform: 'B站',
    startDate: '2026-03-01',
    intensity: 0.6,
    commissionPct: 0.1,
    aov: 159,
    titles: [
      '春日户外 vlog｜一套穿搭搞定跑步+通勤',
      '健身房 vs 居家训练｜30天实测',
      '运动防晒不花妆的秘诀',
      '跑步装备入门指南｜新手避坑',
    ],
    creators: ['cre-leo', 'cre-mia', 'cre-tom'],
  },
  'camp-everyday-bf': {
    platform: 'TikTok',
    startDate: '2026-11-20',
    intensity: 1.3,
    commissionPct: 0.1,
    aov: 249,
    titles: [
      '黑五送礼清单｜男女通用高级感好物',
      '开箱｜黑五入手的宝藏礼盒',
      '节日礼物怎么挑？这份清单直接抄',
      '送闺蜜 / 长辈不出错的礼物合集',
    ],
    creators: ['cre-mia', 'cre-sofia', 'cre-tom', 'cre-nora'],
  },
  'camp-wander-summer': {
    platform: '微信',
    startDate: '2026-07-01',
    intensity: 0.7,
    commissionPct: 0.06,
    aov: 899,
    titles: [
      '暑期避暑路线｜小众海岛攻略',
      '7天自驾 vlog｜沿途绝美风景',
      '旅行打包清单｜轻装出行攻略',
      '亲子游避坑指南｜住宿+行程分享',
    ],
    creators: ['cre-leo', 'cre-ava', 'cre-nora'],
  },
};

/* ------------------------------ 格式化工具 ------------------------------ */

const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');

const compact = (n: number): string => {
  const v = Math.round(n);
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(v);
};

const money = (n: number): string => `¥${fmt(n)}`;
/** 小额金额 2 位小数（EPC 等个位数金额）。 */
const money2 = (n: number): string => `¥${n.toFixed(2)}`;
const pct = (n: number): string => `${n.toFixed(1)}%`;
/** 百分比 2 位小数（CTR / CVR，对齐看板精度）。 */
const pct2 = (n: number): string => `${n.toFixed(2)}%`;

/** ISO 日期加天数（YYYY-MM-DD）。 */
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/* ------------------------------ 投放位模板 ------------------------------ */

/**
 * 各平台的投放位/渠道模板：revW = 收入归因权重，clkW = 点击归因权重。
 * revW ≠ clkW → 各投放位 EPC/转化效率不同（高意向位如 Bio Link 收入占比高于点击占比）。
 * 每行权重各自求和≈1。
 */
interface PlacementTemplate {
  type: string;
  revW: number;
  clkW: number;
  note: string;
}

const PLACEMENT_TEMPLATES: Record<string, PlacementTemplate[]> = {
  TikTok: [
    { type: 'Bio Link', revW: 0.48, clkW: 0.4, note: 'High intent traffic' },
    { type: 'Story', revW: 0.32, clkW: 0.36, note: 'Impulse convert' },
    { type: 'Live', revW: 0.2, clkW: 0.24, note: 'Repeat buyer heavy' },
  ],
  抖音: [
    { type: '主页链接', revW: 0.48, clkW: 0.4, note: '高意向流量' },
    { type: '短视频挂车', revW: 0.32, clkW: 0.36, note: '冲动转化' },
    { type: '直播', revW: 0.2, clkW: 0.24, note: '复购占比高' },
  ],
  小红书: [
    { type: '笔记带货', revW: 0.5, clkW: 0.42, note: '种草转化强' },
    { type: '店铺橱窗', revW: 0.3, clkW: 0.34, note: '主动浏览' },
    { type: '直播', revW: 0.2, clkW: 0.24, note: '复购占比高' },
  ],
  Instagram: [
    { type: 'Bio Link', revW: 0.48, clkW: 0.4, note: 'High intent traffic' },
    { type: 'Story', revW: 0.32, clkW: 0.36, note: 'Impulse convert' },
    { type: 'Reels', revW: 0.2, clkW: 0.24, note: 'Top funnel reach' },
  ],
  B站: [
    { type: '简介链接', revW: 0.46, clkW: 0.4, note: '深度种草' },
    { type: '置顶评论', revW: 0.32, clkW: 0.36, note: '互动转化' },
    { type: '片尾卡片', revW: 0.22, clkW: 0.24, note: '新客驱动' },
  ],
  YouTube: [
    { type: 'Description Link', revW: 0.46, clkW: 0.4, note: 'Deep consideration' },
    { type: 'Pinned Comment', revW: 0.32, clkW: 0.36, note: 'Engaged convert' },
    { type: 'End Card', revW: 0.22, clkW: 0.24, note: 'New customer driver' },
  ],
  微信: [
    { type: '阅读原文', revW: 0.46, clkW: 0.4, note: '高意向流量' },
    { type: '小程序卡片', revW: 0.32, clkW: 0.36, note: '冲动转化' },
    { type: '视频号橱窗', revW: 0.22, clkW: 0.24, note: '新客驱动' },
  ],
};

/** 各投放位 CTR 相对均值的系数（高意向位 CTR 更高）。 */
const CTR_FACTOR = [1.15, 0.92, 0.8];

/** 生成 6 周上升趋势数据点（确定性，供迷你趋势图）。 */
function trendPoints(total: number, seed: number): PlacementTrendPoint[] {
  const pts: PlacementTrendPoint[] = [];
  for (let i = 0; i < 6; i++) {
    const wave = 0.9 + 0.05 * ((seed + i) % 3);
    pts.push({ label: `W${i + 1}`, value: Math.round((total / 6) * (0.45 + 0.16 * i) * wave) });
  }
  return pts;
}

/* ------------------------------ 生成单达人效果 ------------------------------ */

/** 投放位原始数值（供 campaign 维度 rollup 聚合，避免从格式化字符串反解析）。 */
interface RawPlacement {
  type: string;
  revenue: number;
  clicks: number;
  conversions: number;
  impressions: number;
  commission: number;
}

/** 单达人在某 campaign 下的汇总数值（供 campaign / creator 维度 rollup，避免从格式化串反解析）。 */
interface RawCreatorTotals {
  gmv: number;
  orders: number;
  commission: number;
  clicks: number;
  impressions: number;
  cpsSpend: number;
}

interface RawPerformance {
  perf: CreatorCampaignPerformance;
  rawPlacements: RawPlacement[];
  totals: RawCreatorTotals;
}

function buildPerformance(
  profile: CampaignProfile,
  campaignId: string,
  creatorId: string,
  cIdx: number,
): RawPerformance {
  const cr = ROSTER[creatorId];
  const base = TIER_BASE[cr.tier];
  const k = profile.intensity;
  const isVideo = VIDEO_PLATFORMS.has(profile.platform);
  const format: PostFormat = isVideo ? 'video' : 'image';
  const numPosts = 2;

  const posts: PostEffect[] = [];
  let totalImpr = 0;
  let totalEng = 0;

  for (let p = 0; p < numPosts; p++) {
    const impr = Math.round(base.impr * k * POST_JITTER[(cIdx + p) % POST_JITTER.length]);
    const er = base.er * (0.85 + 0.12 * p); // 帖间互动率轻微波动
    const eng = impr * (er / 100);
    totalImpr += impr;
    totalEng += eng;

    posts.push({
      id: `${campaignId}-${creatorId}-p${p + 1}`,
      title: profile.titles[(cIdx + p) % profile.titles.length],
      publishedAt: addDays(profile.startDate, 2 + cIdx * 4 + p * 6),
      format,
      impressions: compact(impr),
      ...(isVideo ? { plays: compact(Math.round(impr * 0.82)) } : {}),
      likes: fmt(eng * 0.56),
      comments: fmt(eng * 0.11),
      shares: fmt(eng * 0.18),
      saves: fmt(eng * 0.15),
      engagementRate: pct(er),
    });
  }

  // CPS（带货）：GMV 由层级潜力 × 强度驱动，佣金按 campaign 比例。
  const gmv = Math.round(base.gmv * k * (0.8 + 0.18 * cIdx));
  const orders = Math.round(gmv / profile.aov);
  const commission = Math.round(gmv * profile.commissionPct);
  const cpsSpend = Math.round(commission * 1.08); // 佣金 + 8% 平台服务费
  const clicks = Math.round(totalImpr * 0.038);
  const ctrOverall = (clicks / totalImpr) * 100;
  const cvr = (orders / clicks) * 100;
  const roas = gmv / cpsSpend;
  const epc = gmv / clicks;

  const cps: CreatorCps = {
    gmv: money(gmv),
    orders: fmt(orders),
    aov: money(profile.aov),
    cvr: pct2(cvr),
    commission: money(commission),
    cpsSpend: money(cpsSpend),
    roas: roas.toFixed(2),
    clicks: fmt(clicks),
    ctr: pct2(ctrOverall),
    epc: money2(epc),
    refundRate: pct(1.8 + (cIdx % 3) * 0.7),
  };

  // 投放位明细（affiliate 维度）：把达人的 GMV/点击/转化按投放位权重拆分。
  const templates = PLACEMENT_TEMPLATES[profile.platform] ?? PLACEMENT_TEMPLATES.TikTok;
  const placements: PlacementPerformance[] = [];
  const rawPlacements: RawPlacement[] = [];

  templates.forEach((tpl, i) => {
    const revP = Math.round(gmv * tpl.revW);
    const clkP = Math.round(clicks * tpl.clkW);
    const convP = Math.round(orders * tpl.revW);
    const commP = Math.round(revP * profile.commissionPct);
    const ctrP = ctrOverall * CTR_FACTOR[i % CTR_FACTOR.length];
    const imprP = Math.round(clkP / (ctrP / 100));
    const cvrP = (convP / clkP) * 100;
    const epcP = revP / clkP;
    const roasP = revP / (commP * 1.08);

    rawPlacements.push({
      type: tpl.type,
      revenue: revP,
      clicks: clkP,
      conversions: convP,
      impressions: imprP,
      commission: commP,
    });

    placements.push({
      type: tpl.type,
      screenshot: '',
      revenue: money(revP),
      revenueShare: pct(tpl.revW * 100),
      clicks: fmt(clkP),
      ctr: pct2(ctrP),
      conversions: fmt(convP),
      cvr: pct2(cvrP),
      epc: money2(epcP),
      commission: money(commP),
      roas: roasP.toFixed(2),
      trend: trendPoints(revP, cIdx + i),
      notes: tpl.note,
    });
  });

  return {
    perf: {
      campaignId,
      creatorId,
      creatorName: cr.name,
      handle: cr.handle,
      platform: profile.platform,
      tier: cr.tier,
      summary: {
        posts: numPosts,
        totalImpressions: compact(totalImpr),
        totalEngagement: compact(Math.round(totalEng)),
        avgEngagementRate: pct((totalEng / totalImpr) * 100),
      },
      posts,
      placements,
      cps,
    },
    rawPlacements,
    totals: { gmv, orders, commission, clicks, impressions: totalImpr, cpsSpend },
  };
}

/* ------------------------------ campaign 维度 rollup ------------------------------ */

/** 把多个达人的投放位原始数据按 type 聚合，输出 placement-type 汇总（对齐看板截图 2）。 */
function rollupPlacementTypes(raws: RawPlacement[]): PlacementTypeSummary[] {
  const byType = new Map<
    string,
    { revenue: number; clicks: number; conversions: number; impressions: number; commission: number }
  >();
  for (const r of raws) {
    const cur =
      byType.get(r.type) ?? { revenue: 0, clicks: 0, conversions: 0, impressions: 0, commission: 0 };
    cur.revenue += r.revenue;
    cur.clicks += r.clicks;
    cur.conversions += r.conversions;
    cur.impressions += r.impressions;
    cur.commission += r.commission;
    byType.set(r.type, cur);
  }
  const total = [...byType.values()].reduce((a, b) => a + b.revenue, 0) || 1;
  return [...byType.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .map(([type, v], idx) => ({
      type,
      revenue: money(v.revenue),
      revenueShare: pct((v.revenue / total) * 100),
      clicks: fmt(v.clicks),
      ctr: pct2((v.clicks / (v.impressions || 1)) * 100),
      conversions: fmt(v.conversions),
      cvr: pct2((v.conversions / (v.clicks || 1)) * 100),
      epc: money2(v.revenue / (v.clicks || 1)),
      roas: (v.revenue / ((v.commission || 0) * 1.08)).toFixed(2),
      trend: trendPoints(v.revenue, idx + type.length),
    }));
}

/* ------------------------------ mock 数据集 ------------------------------ */

const { MOCK_PERFORMANCE, MOCK_PLACEMENT_SUMMARY, MOCK_RAW } = (() => {
  const perf: Record<string, CreatorCampaignPerformance[]> = {};
  const summary: Record<string, PlacementTypeSummary[]> = {};
  const raw: Record<string, RawPerformance[]> = {};
  for (const [cid, profile] of Object.entries(CAMPAIGN_PROFILE)) {
    const raws = profile.creators.map((creatorId, idx) =>
      buildPerformance(profile, cid, creatorId, idx),
    );
    raw[cid] = raws;
    perf[cid] = raws.map((r) => r.perf);
    summary[cid] = rollupPlacementTypes(raws.flatMap((r) => r.rawPlacements));
  }
  return { MOCK_PERFORMANCE: perf, MOCK_PLACEMENT_SUMMARY: summary, MOCK_RAW: raw };
})();

/**
 * 确定性「环比」文本：以 campaign intensity 为主信号（强 campaign → 正增长），按指标序号抖动。
 * mock 无真实上期数据，此为模拟值，仅供看板展示。
 */
function mockCompare(campaignId: string, idx: number): string {
  const profile = CAMPAIGN_PROFILE[campaignId];
  const base = ((profile?.intensity ?? 1) - 0.85) * 100; // intensity 1.0→+15, 0.6→-25
  const delta = base + ((idx % 5) - 2) * 3; // ±6% 抖动，避免各指标同涨同跌
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}%`;
}

/**
 * campaign 维度汇总：其下所有达人 totals 之和 → 9 项合并指标
 * （覆盖参考图：GMV/佣金/ROAS/点击/转化/CVR/AOV + 花费/展示）。
 * campaign = Σ creators，保证看板汇总与达人明细自洽。
 */
export function rollupCampaignMetrics(campaignId: string): CampaignMetric[] {
  const raws = MOCK_RAW[campaignId] ?? [];
  const sum = raws.reduce(
    (a, r) => ({
      gmv: a.gmv + r.totals.gmv,
      orders: a.orders + r.totals.orders,
      commission: a.commission + r.totals.commission,
      clicks: a.clicks + r.totals.clicks,
      impressions: a.impressions + r.totals.impressions,
      cpsSpend: a.cpsSpend + r.totals.cpsSpend,
    }),
    { gmv: 0, orders: 0, commission: 0, clicks: 0, impressions: 0, cpsSpend: 0 },
  );
  const roas = sum.cpsSpend ? sum.gmv / sum.cpsSpend : 0;
  const cvr = sum.clicks ? (sum.orders / sum.clicks) * 100 : 0;
  const aov = sum.orders ? sum.gmv / sum.orders : 0;
  return [
    { label: 'GMV', value: money(sum.gmv), compare: mockCompare(campaignId, 0) },
    { label: '佣金', value: money(sum.commission), compare: mockCompare(campaignId, 1) },
    { label: 'ROAS', value: roas.toFixed(2), compare: mockCompare(campaignId, 2) },
    { label: '点击', value: fmt(sum.clicks), compare: mockCompare(campaignId, 3) },
    { label: '转化', value: fmt(sum.orders), compare: mockCompare(campaignId, 4) },
    { label: 'CVR', value: pct2(cvr), compare: mockCompare(campaignId, 5) },
    { label: 'AOV', value: money(aov), compare: mockCompare(campaignId, 6) },
    { label: '花费', value: money(sum.cpsSpend), compare: mockCompare(campaignId, 7) },
    { label: '展示', value: compact(sum.impressions), compare: mockCompare(campaignId, 8) },
  ];
}

/**
 * 达人维度汇总：跨该达人参与的所有 campaign，sum totals → 主要指标（供达人列表）。
 * compare 留空（跨 campaign 汇总无单期环比语义）。
 */
export function rollupCreatorTotals(creatorId: string): CampaignMetric[] {
  const picked: RawCreatorTotals[] = [];
  for (const raws of Object.values(MOCK_RAW)) {
    const r = raws.find((x) => x.perf.creatorId === creatorId);
    if (r) picked.push(r.totals);
  }
  const sum = picked.reduce(
    (a, t) => ({
      gmv: a.gmv + t.gmv,
      orders: a.orders + t.orders,
      commission: a.commission + t.commission,
      clicks: a.clicks + t.clicks,
      cpsSpend: a.cpsSpend + t.cpsSpend,
    }),
    { gmv: 0, orders: 0, commission: 0, clicks: 0, cpsSpend: 0 },
  );
  const roas = sum.cpsSpend ? sum.gmv / sum.cpsSpend : 0;
  return [
    { label: 'GMV', value: money(sum.gmv), compare: '' },
    { label: 'ROAS', value: roas.toFixed(2), compare: '' },
    { label: '转化', value: fmt(sum.orders), compare: '' },
    { label: '佣金', value: money(sum.commission), compare: '' },
  ];
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/** 模拟上游拉取某 campaign 下各达人的执行效果（帖子 + 投放位 + CPS）。带模拟延迟。 */
export function listCreatorPerformance(
  campaignId: string,
): Promise<CreatorCampaignPerformance[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(clone(MOCK_PERFORMANCE[campaignId] ?? [])), 250);
  });
}

/** 模拟上游拉取某 campaign 的投放位类型汇总（对齐看板 placement-type 表）。带模拟延迟。 */
export function listPlacementTypeSummary(
  campaignId: string,
): Promise<PlacementTypeSummary[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(clone(MOCK_PLACEMENT_SUMMARY[campaignId] ?? [])), 250);
  });
}
