/**
 * Campaign / 投放 / 达人执行效果 / 联盟营销 等上游实体与指标类型。
 * 与 Campaign / Creator 同级，属上游接口实体（demo 中 mock）；
 * 非持久化 Page/ComponentType 字段，不动服务端 Zod。
 */

/** 场景类型。 */
export type Scenario = 'campaign-report' | 'campaign-proposal' | 'media-kit';
/** Campaign 报告子类。 */
export type ScenarioSub = 'weekly' | 'monthly' | 'wrap-up';

/** Campaign 信息（仅 campaign 类型场景填写）。 */
export interface CampaignInfo {
  campaignName?: string;
  platform?: string;
  startDate?: string;
  endDate?: string;
  budget?: string;
}

/** Campaign 投放表现指标项；与 kpi-board 行 [指标, 数值, 对比] 同构。 */
export interface CampaignMetric {
  label: string; // 指标名，如 "Spend"（默认英文，与 kpi-board 默认指标对齐）
  value: string; // 数值，如 "$128,000"
  compare: string; // 对比文本，如 "+15%"（kpi-board 渲染器按首字符 +/- 自动着色）
}

/** 单个平台的合作形式配置。 */
export interface CampaignPlatform {
  /** 平台名称，如 'TikTok' / 'Instagram'。 */
  platform: string;
  /** 合作形式，如 'Content' / 'Live Stream' / 'Affiliate' / 'Spark Ads'。 */
  collaborationType: string;
}

/** 上游 Campaign 实体（接入上游接口；demo 中 mock）。 */
export interface Campaign {
  id: string;
  name: string;
  advertiser: string;
  businessLine: string;
  platform: string;
  /** 多平台多合作形式（可选，向后兼容）。 */
  platforms?: CampaignPlatform[];
  startDate: string;
  endDate: string;
  budget: string;
  status?: string;
  owner?: string;
  /** 投放表现指标（供业绩看板「从 Campaign 导入」）。 */
  metrics?: CampaignMetric[];
}

/** 上游达人（Creator / Influencer）实体（demo 中 mock；数据管理库管理）。 */
export interface Creator {
  id: string;
  name: string;
  handle: string;
  platform: string;
  /** 层级：mega / macro / micro。 */
  tier: string;
  followers: string;
  engagement: string;
  category: string;
  region: string;
  /** 达人头像 URL。 */
  avatar?: string;
  /** 达人自身频道 KPI 指标（Avg Reach/Impressions/Follower Growth/CPM）。 */
  metrics: CampaignMetric[];
}

/* ------------------------------------------------------------------ */
/* 报告全局数据上下文                                                    */
/* 编辑器「数据配置」面板统一选择 Campaign + 达人，存入 store 供各组件    */
/* 一键导入，避免每个组件重复手动填写。                                   */
/* ------------------------------------------------------------------ */

/** 报告中选中的 Campaign 信息（精简版，用于展示 + 组件取数）。 */
export interface ReportCampaign {
  id: string;
  name: string;
  advertiser?: string;
  platform?: string;
  /** 多平台多合作形式（可选，向后兼容）。 */
  platforms?: CampaignPlatform[];
  startDate?: string;
  endDate?: string;
  budget?: string;
  status?: string;
  metrics?: CampaignMetric[];
}

/**
 * 达人数据条单项（与编辑器 creator-stats-strip 同构）。
 * 此处提前声明，供 ReportCreator.stats 引用（避免循环依赖：editor.ts ↔ campaign.ts）。
 */
export interface CreatorStatItem {
  key?: string;
  label: string;
  value: string;
  color: string;
  selected?: boolean;
}

/** 报告中选中的达人信息（精简版，用于达人组件一键填充）。 */
export interface ReportCreator {
  id: string;
  name: string;
  handle?: string;
  platform?: string;
  tier?: string;
  followers?: string;
  engagement?: string;
  category?: string;
  region?: string;
  avatar?: string;
  /** 达人数据条 KPI（由数据配置面板从上游填充）。 */
  stats?: CreatorStatItem[];
  /** 受众画像（性别/年龄/城市分布，用于 fan-gender / fan-age / fan-city 组件一键填充）。 */
  audience?: {
    genderSplit?: { label: string; value: number; color?: string }[];
    ageRange?: { label: string; value: number; color?: string }[];
    topCities?: { label: string; value: number; color?: string }[];
  };
}

/** 报告全局数据上下文：Campaign + 达人列表。存入编辑器 store，随项目保存。 */
export interface ReportDataContext {
  /** 绑定的 Campaign（可空）。 */
  campaign?: ReportCampaign | null;
  /** Campaign 下参与合作的达人（来自 campaign performance 数据）。 */
  campaignCreators?: ReportCreator[];
  /** 达人库中选中的达人列表（可多个）。 */
  creators?: ReportCreator[];
}

/* ------------------------------------------------------------------ */
/* 达人执行效果（上游 mock）                                            */
/* ------------------------------------------------------------------ */

/** 帖子（作品）类型。 */
export type PostFormat = 'image' | 'video' | 'live-clip';

/** 单条帖子（作品）的效果数据。 */
export interface PostEffect {
  id: string;
  title: string;
  /** 封面/截图 URL（可选）。 */
  cover?: string;
  /** 帖子链接（可选）。 */
  url?: string;
  /** 发布日期 YYYY-MM-DD。 */
  publishedAt: string;
  /** 作品平台（TikTok / 抖音 / 小红书 …）。 */
  platform: string;
  format: PostFormat;
  /** 视频时长（"M:SS"）；图文为空。 */
  duration?: string;
  /** 内容标签 / 话题（逗号分隔）。 */
  hashtags?: string;
  /** 曝光（impressions）。 */
  impressions: string;
  /** 播放（视频类）；图文为空。 */
  plays?: string;
  /** 点赞。 */
  likes: string;
  /** 评论。 */
  comments: string;
  /** 转发 / 分享。 */
  shares: string;
  /** 收藏。 */
  saves: string;
  /** 互动率 = (赞+评+转+藏) / 曝光。 */
  engagementRate: string;
}

/** 达人在某 campaign 下每天的效果数据（时间序列，供趋势/明细）。 */
export interface CreatorDaily {
  /** 日期 YYYY-MM-DD。 */
  date: string;
  /** 曝光。 */
  impressions: string;
  /** 互动（赞+评+转+藏）。 */
  engagement: string;
  /** 点击。 */
  clicks: string;
  /** 带货 GMV。 */
  gmv: string;
  /** 订单（转化）。 */
  orders: string;
}

/** 达人在某 campaign 的 CPS（按销售分成 / 带货）汇总数据。 */
export interface CreatorCps {
  /** 带货 GMV（成交金额）。 */
  gmv: string;
  /** 订单数（= 转化数 Conversions）。 */
  orders: string;
  /** 客单价 AOV。 */
  aov: string;
  /** 转化率 CVR = 订单 / 点击。 */
  cvr: string;
  /** CPS 佣金（达人分佣）。 */
  commission: string;
  /** CPS 花费（佣金 + 服务费，品牌侧成本）。 */
  cpsSpend: string;
  /** CPS ROAS = GMV / CPS 花费。 */
  roas: string;
  /** 点击数 Clicks（归因到带货链路）。 */
  clicks: string;
  /** 点击率 CTR = 点击 / 曝光。 */
  ctr: string;
  /** 每次点击收益 EPC = GMV / 点击。 */
  epc: string;
  /** 退款率（可选）。 */
  refundRate?: string;
}

/**
 * 单个投放位 / 渠道（Bio Link / Story / Live / Shopping Ads …）的带货效果。
 * 对齐 affiliate/CPS 看板的 placement 维度：一个达人可挂多个投放位，
 * 各自归因 Revenue / Clicks / Conversions，并占该达人总收入的一份（revenueShare）。
 */
export interface PlacementTrendPoint {
  label: string;
  value: number;
}

export interface PlacementPerformance {
  /** 投放位类型，如 'Bio Link' / 'Story' / 'Live' / 'Shopping Ads'。 */
  type: string;
  /** 投放位截图 URL（可选，空 → 占位）。 */
  screenshot?: string;
  /** 带货收入（GMV 归因到该投放位）。 */
  revenue: string;
  /** 收入占比（该投放位 / 该达人总收入）。 */
  revenueShare: string;
  /** 点击。 */
  clicks: string;
  /** 点击率 CTR。 */
  ctr: string;
  /** 转化数（订单）。 */
  conversions: string;
  /** 转化率 CVR。 */
  cvr: string;
  /** 每次点击收益 EPC = 收入 / 点击。 */
  epc: string;
  /** 佣金。 */
  commission: string;
  /** ROAS = 收入 / 该投放位花费。 */
  roas: string;
  /** 趋势数据点（时间 → 数值，供迷你趋势图）。 */
  trend?: PlacementTrendPoint[];
  /** 备注（定性，如 "High intent traffic"）。 */
  notes?: string;
}

/** 投放位类型汇总（campaign 维度，按 type 聚合所有达人）：对齐看板 placement-type 表。 */
export interface PlacementTypeSummary {
  type: string;
  revenue: string;
  revenueShare: string;
  clicks: string;
  ctr: string;
  conversions: string;
  cvr: string;
  epc: string;
  roas: string;
  trend?: PlacementTrendPoint[];
}

/** 联盟营销 — Publisher 表行数据。 */
export interface PublisherPerformance {
  publisher: string;
  clicks: string;
  impressions: string;
  ctr: string;
  conversions: string;
  cvr: string;
  revenue: string;
  commission: string;
  epc: string;
  roas: string;
  aov: string;
  status: 'good' | 'warn' | 'bad';
}

/** 联盟营销 — GEO 国家维度。 */
export interface GeoPerformance {
  code: string;
  name: string;
  revenue: number;
  display: string;
  share: string;
}

/** 联盟营销 — 宽表 Placement 行数据（9 列）。 */
export interface PlacementWideRow {
  placement: string;
  publisher: string;
  clicks: string;
  ctr: string;
  conversions: string;
  cvr: string;
  revenue: string;
  epc: string;
  status: 'good' | 'warn' | 'bad';
}

/** Campaign 汇总概要 — 报告首页用。 */
export interface CampaignSummary {
  campaignId: string;
  campaignName: string;
  period: string; // e.g. "2026-10-12 ~ 2026-11-12"
  totalSpend: string;
  totalRevenue: string;
  totalCommission: string;
  roas: string;
  totalClicks: string;
  totalImpressions: string;
  totalConversions: string;
  avgCtr: string;
  avgCvr: string;
  avgEpc: string;
  newCustomers: number;
  returningCustomers: number;
  newCustomerRate: string;
}

/** 设备分布。 */
export interface DeviceBreakdown {
  device: string; // Mobile / Desktop / Tablet
  sessions: string;
  revenue: string;
  share: string;
  trend: string; // +12% etc
}

/** 内容主题表现。 */
export interface ContentTopicPerformance {
  topic: string;
  posts: number;
  impressions: string;
  engagement: string;
  revenue: string;
  roas: string;
  status: 'good' | 'warn' | 'bad';
}

/** 收入时间线（日维度）。 */
export interface RevenueTimelinePoint {
  date: string;
  revenue: number;
  spend: number;
  commission: number;
  orders: number;
}

/** 转化漏斗。 */
export interface ConversionFunnelStep {
  step: string; // Impressions / Clicks / Add to Cart / Checkout / Purchase
  value: number;
  rate: string; // conversion rate from previous step
}

/** 时段效果（一天24小时分布）。 */
export interface HourlyPerformance {
  hour: string; // "00", "01", ... "23"
  impressions: number;
  clicks: number;
  conversions: number;
}

/** 关键词/搜索词表现。 */
export interface SearchTermPerformance {
  term: string;
  clicks: string;
  conversions: string;
  ctr: string;
  revenue: string;
  status: 'good' | 'warn' | 'bad';
}

/** 达人执行效果汇总（上线帖数 + 累计曝光/互动 + 平均互动率）。 */
export interface CreatorPerformanceSummary {
  posts: number;
  totalImpressions: string;
  totalEngagement: string;
  avgEngagementRate: string;
}

/** 达人在单个 campaign 的执行效果：汇总 + 帖子明细 + 投放位明细 + CPS。 */
export interface CreatorCampaignPerformance {
  campaignId: string;
  creatorId: string;
  creatorName: string;
  handle?: string;
  platform: string;
  tier: string;
  summary: CreatorPerformanceSummary;
  /** 帖子效果明细。 */
  posts: PostEffect[];
  /** 每天效果时间序列（campaign 周期内逐天）。 */
  daily: CreatorDaily[];
  /** 投放位 / 渠道带货明细（affiliate 维度）。 */
  placements: PlacementPerformance[];
  /** CPS 带货汇总。 */
  cps: CreatorCps;
}

/** 业务线（mock 查找表 BUSINESS_LINE_META 的条目）。 */
export interface BusinessLine {
  /** 简称，与 BUSINESS_LINES 中的条目一致，例如 'FT'。 */
  code: string;
  /** 全称，例如 'FineTech 芯科'。 */
  name: string;
  /** Logo URL。 */
  logo?: string;
}

/** 商家（独立列表 MERCHANTS 的条目；广告主通过 merchantId 引用）。 */
export interface Merchant {
  /** 例如 'm1'。 */
  id: string;
  /** 商家名称。 */
  name: string;
  /** Logo URL。 */
  logo?: string;
}

/** 广告主（mock 查找表 ADVERTISER_META 的条目）。 */
export interface Advertiser {
  /** 广告主名称，与 ADVERTISERS 中的条目一致，例如 'GlowLab'。 */
  name: string;
  /** 关联的商家 id（指向 MERCHANTS）。 */
  merchantId?: string;
  /** Logo URL。 */
  logo?: string;
}
