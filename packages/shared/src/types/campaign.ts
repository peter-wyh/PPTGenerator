/**
 * Campaign / 投放 / 达人执行效果 / 联盟营销 等上游实体与指标类型。
 * 与 Campaign / Creator 同级，属上游接口实体（demo 中 mock）；
 * 非持久化 Page/ComponentType 字段，不动服务端 Zod。
 */

/** 场景类型。 */
export type Scenario = 'campaign-report' | 'campaign-proposal' | 'media-kit';
/** Campaign 报告子类。 */
export type ScenarioSub = 'weekly' | 'biweekly' | 'monthly' | 'wrap-up';

/** 合作方类型：达人 / 社群 / 内容站 */
export type PartnerType = 'creator' | 'community' | 'content_site';

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
  /** Campaign 分析包（趋势 / 新老客 / 洞察）。 */
  analytics?: CampaignAnalytics;
  /** 参与 campaign 合作的达人 id 列表（数据管理库 Creator 记录 id;下钻解析用）。 */
  creatorIds?: string[];
}

/** 达人商务联系方式。 */
export interface CreatorContact {
  mcn?: string;           // MCN/机构
  agency?: string;        // 经纪公司
  email?: string;         // 商务邮箱
  phone?: string;         // 商务电话
  contactPerson?: string; // 商务联系人
}

/** 达人合作报价(多档 + 货币 + 说明)。 */
export interface CreatorRate {
  currency?: string; // CNY / USD …
  post?: string;     // 图文报价
  video?: string;    // 短视频报价
  live?: string;     // 直播报价
  note?: string;     // 报价说明
}

/** 上游达人（Creator / Influencer）实体（demo 中 mock；数据管理库管理）。 */
export interface Creator {
  id: string;
  name: string;
  handle: string;
  platform: string;
  /** 合作方类型：达人(默认) / 社群 / 内容站。 */
  partnerType?: PartnerType;
  /** 层级：mega / macro / micro。 */
  tier: string;
  followers: string;
  engagement: string;
  category: string;
  region: string;
  /** 达人主页链接 URL。 */
  profileUrl?: string;
  /** 达人头像 URL。 */
  avatar?: string;
  /** 近 90 天新发作品数。 */
  recentPostsCount?: number;
  /** 近 90 天互动中位数。 */
  engagementMedian?: string;
  /** 达人自身频道 KPI 指标（Avg Reach/Impressions/Follower Growth/CPM）。 */
  metrics: CampaignMetric[];
  /** 受众画像(性别/年龄/城市)。 */
  audience?: CreatorAudience;
  /** 作品列表 + 作品数据。 */
  works?: CreatorWork[];
  /** 频道维度 stat 项(creator-stats-strip 用)。 */
  stats?: CreatorStatItem[];
  /** 达人简介 / Bio。 */
  bio?: string;
  /** 内容标签(风格/品类)。 */
  tags?: string[];
  /** 商务联系方式。 */
  contact?: CreatorContact;
  /** 合作报价。 */
  rate?: CreatorRate;
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
  /** Campaign 分析包（趋势 / 新老客 / 洞察）。 */
  analytics?: CampaignAnalytics;
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

/** 受众画像单项(性别/年龄/城市占比)。value 为百分比数值。 */
export interface AudienceSlice {
  label: string;
  value: number;
  color?: string;
}

/** 达人受众画像(性别/年龄/城市分布)。Creator 与 ReportCreator 共用。 */
export interface CreatorAudience {
  genderSplit?: AudienceSlice[];
  ageRange?: AudienceSlice[];
  topCities?: AudienceSlice[];
}

/** 作品带货效果归因。 */
export interface CreatorWorkAttribution {
  clicks?: string;   // 点击
  orders?: string;   // 下单
  gmv?: string;      // 成交额
  ctr?: string;      // 点击率 %
  cvr?: string;      // 转化率 %
}

/** 达人作品(列表项 + 作品数据)。对齐 works 组件渲染所需字段。 */
export interface CreatorWork {
  id: string;
  title: string;
  cover?: string;
  url?: string;
  platform?: string;
  publishedAt?: string;
  impressions?: string;
  likes?: string;
  comments?: string;
  shares?: string;
  saves?: string;
  engagementRate?: string;
  /** 每日效果数据（14天时间序列）。 */
  daily?: PostDaily[];
  /**
   * 内容形式(达人作品维度):image=图文 / video=短视频 / live=直播 / long=长视频 / series=合集。
   * 与 ContentType(协作交付形式)、PostFormat(帖子格式)为不同维度;mock 种子目前只用 image|video。
   */
  contentType?: string;
  /** 话题标签 / 关键词。 */
  hashtags?: string[];
  /** 带货 / 挂车链接。 */
  productLink?: string;
  /** 带货效果归因。 */
  attribution?: CreatorWorkAttribution;
  /** 视频 / 内容时长(如 "01:23")。 */
  duration?: string;
  /** 是否置顶 / 精选。 */
  featured?: boolean;
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
  /** 受众画像(性别/年龄/城市分布,用于 fan-gender / fan-age / fan-city 组件一键填充)。 */
  audience?: CreatorAudience;
}

/** DM 月报数据契约。 */
export interface DmMonthlyData {
  /** 主视觉图 URL。 */
  heroImage?: string;
  /** 渠道内容截图列表。 */
  channelContent?: { url: string; label?: string }[];
  /** 五个商品展示。 */
  products?: { id: string; name: string; image?: string; sales?: string; clicks?: string; roas?: string }[];
  /** 广告位大图。 */
  adPlacement?: { url: string; label?: string };
  /** 12 位推荐达人。 */
  featuredCreators?: { id: string; name: string; avatar?: string; handle?: string; platform?: string; followers?: string }[];
  /** 达人内容/帖子。 */
  creatorPosts?: { id: string; cover?: string; title: string; platform?: string }[];
}

/** DM 双周报数据契约。 */
export interface DmBiweeklyData {
  /** 主视觉图 URL。 */
  heroImage?: string;
  /** 渠道内容截图。 */
  channelContent?: { url: string; label?: string }[];
  /** 广告位截图。 */
  adPlacement?: { url: string; label?: string };
  /** 达人主页截图。 */
  creatorProfiles?: { url: string; label?: string }[];
  /** 优化复盘截图。 */
  optimizationReview?: { url: string; label?: string }[];
  /** 套餐图。 */
  packageImages?: { url: string; label?: string }[];
  /** KPI 数据。 */
  kpi?: { label: string; value: string; icon?: string; trend?: string }[];
}

/** 报告全局数据上下文：Campaign + 达人列表 + 商品列表。存入编辑器 store，随项目保存。 */
export interface ReportDataContext {
  /** 绑定的 Campaign（可空）。 */
  campaign?: ReportCampaign | null;
  /** Campaign 下参与合作的达人（来自 campaign performance 数据）。 */
  campaignCreators?: ReportCreator[];
  /** 达人库中选中的达人列表（可多个）。 */
  creators?: ReportCreator[];
  /** 商品列表（campaign 关联的带货商品，可编辑）。 */
  products?: Product[];
  /** DM 月报专用结构化数据。 */
  dmMonthly?: DmMonthlyData;
  /** DM 双周报专用结构化数据。 */
  dmBiweekly?: DmBiweeklyData;
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
  /** 订单量（电商/带货类，非带货为空）。 */
  orders?: string;
  /** 千次展示成本（CPM，¥）。 */
  cpm?: string;
  /** 互动率 = (赞+评+转+藏) / 曝光。 */
  engagementRate: string;
  /** 每天效果明细（时间序列，从发布日起 N 天）。 */
  daily?: PostDaily[];
}

/** 单个作品每天的效果数据。 */
export interface PostDaily {
  /** 日期 YYYY-MM-DD。 */
  date: string;
  /** 曝光。 */
  impressions: string;
  /** 点赞。 */
  likes: string;
  /** 评论。 */
  comments: string;
  /** 转发/分享。 */
  shares: string;
  /** 收藏。 */
  saves: string;
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

/** 业务线（对齐营销系统 dm_union_business_lines；源侧字段 + 本地报告侧扩展）。 */
export interface BusinessLine {
  /** 本地 cuid 主键。 */
  id?: string;
  /** 简称（唯一短码，本地扩展），例如 'FT'。 */
  code: string;
  /** 名称（源 title）。 */
  title: string;
  /** Logo URL（本地扩展）。 */
  logo?: string;
  /** 品牌色 hex（本地扩展）。 */
  color?: string;
  /** design.md 文档内容（本地扩展）。 */
  designMd?: string;
  /** design.md 上传附件 URL（本地扩展）。 */
  designMdUrl?: string;
  // ─── 源侧字段（dm_union_business_lines）────────────────────────────────────
  /** 负责人 ids（逗号分隔）。 */
  directorId?: string;
  /** 负责成员 ids。 */
  members?: string;
  /** 额外信息。 */
  extra?: string;
  /** 创建人 ID（源 dm_admin id）。 */
  creatorId?: string;
  /** 更新人 ID（源 dm_admin id）。 */
  updatorId?: string;
  /** 创建时间。 */
  createTime?: Date | string;
  /** 更新时间。 */
  updateTime?: Date | string;
  /** 删除时间（软删标记）。 */
  deleteTime?: Date | string;
  /** 业务线状态（默认 1）。 */
  status?: number;
  /** 作品提及（字符串数组）。 */
  expertWorkMention?: string[];
  /** 作品标签（字符串数组）。 */
  expertWorkLabel?: string[];
  /** 所属公司。 */
  companyIds?: string;
  /** 部门 ids。 */
  departmentIds?: string;
  /** 指定成员。 */
  specifyMembers?: string;
  /** cpt 余额提现 0否1是。 */
  cptWithdraw?: boolean;
  /** 关联应用。 */
  relatedProject?: string;
  /** 日历管理员 ids。 */
  calendarAdminIds?: string;
}

/** 业务线报告指南(AI 提示词层配置:品牌视觉/章节结构/展示形式偏好/语调与术语)。 */
export interface Guide {
  /** 展示名,如 "DG 月报指南"。 */
  name: string;
  /**
   * @deprecated 0827 ID 方案:结构指南已按 id 直接选中,scenario 字符串匹配消灭。
   * 字段暂留(历史数据),不再有任何匹配语义;新代码勿读勿写。
   */
  scenario?: string;
  /** Markdown 指南正文。 */
  content: string;
  /** 关联业务线 id。 */
  businessLineId: string;
  /** 业务线默认指南(同业务线唯一)。 */
  isDefault?: boolean;
  /** 停用后不参与匹配。 */
  isActive?: boolean;
}

/** 商家（查找表 Merchant 表的条目；广告主通过 merchantId 引用）。 */
export interface Merchant {
  /** 例如 'm1'。 */
  id: string;
  /** 商家名称。 */
  name: string;
  /** Logo URL。 */
  logo?: string;
}

/** 广告主（查找表 Advertiser 表的条目）。 */
export interface Advertiser {
  /** 广告主名称，例如 'GlowLab'。 */
  name: string;
  /** 关联的商家 id（指向 Merchant 表）。 */
  merchantId?: string;
  /** Logo URL。 */
  logo?: string;
}

/** 营销活动（对齐营销系统 sales_activity；归属业务线）。 */
export interface MarketingEvent {
  /** 活动名称。 */
  name: string;
  /** 开始时间。 */
  startTime: Date | string;
  /** 结束时间。 */
  endTime: Date | string;
  /** 标识（'1'=废弃）。 */
  label?: string;
  /** 类型 1节日 2活动日 3特别促销。 */
  type?: number;
  /** 简介。 */
  info?: string;
  /** 适用州。 */
  continent?: string;
  /** 适用地区。 */
  region?: string;
  /** 平台评级 3高 2中 1低。 */
  level?: number;
  /** 申请人（源 dm_admin id）。 */
  adsId?: string;
  /** 归属业务线 id。 */
  businessLineId?: string;
  /** 展示给流量主 1是 2否。 */
  isShowMember?: number;
  /** 入库来源 1管理员录入 2邮件解析 3AI 解析。 */
  source?: number;
  /** 添加人 id。 */
  createId?: string;
  /** 修改人 id。 */
  updateId?: string;
  /** 创建时间。 */
  createTime?: Date | string;
  /** 修改时间。 */
  updateTime?: Date | string;
}

/** 商品（campaign 关联的带货商品）。 */
export interface Product {
  /** 商品 ID。 */
  id: string;
  /** 商品名称。 */
  name: string;
  /** 商品图片 URL（可选）。 */
  image?: string;
  /** 价格（含货币符号）。 */
  price: string;
  /** 原价（可选，用于显示折扣）。 */
  originalPrice?: string;
  /** 关联的广告主。 */
  advertiser?: string;
  /** 关联的业务线。 */
  businessLine?: string;
  /** 商品分类/品类。 */
  category?: string;
  /** 带货 GMV。 */
  gmv?: string;
  /** 销量/订单数。 */
  orders?: string;
  /** 点击数。 */
  clicks?: string;
  /** 转化率 CVR。 */
  cvr?: string;
  /** ROAS。 */
  roas?: string;
  /** 佣金（CPS commission）。 */
  commission?: string;
  /** CPS 花费（commission + 平台服务费）。 */
  spend?: string;
  /** 状态。 */
  status?: 'active' | 'paused' | 'sold-out';
}

/* ------------------------------ Campaign 分析数据 ------------------------------ */

/** Top-Selling Category 项（品类销售占比）。 */
export interface CategoryPerformance {
  name: string;
  /** 销售额（含货币符号，如 "$481,998"）。 */
  revenue?: string;
  /** 占比百分比数值（如 72 表示 72%）。 */
  share?: number;
}

/** Top-Selling Product 项（热销产品）。 */
export interface ProductPerformance {
  name: string;
  revenue?: string;
  orders?: string;
  category?: string;
}

/** Top Market / 地域销售维度。 */
export interface MarketPerformance {
  /** 地区名称，如 "United States"。 */
  name: string;
  revenue?: string;
  /** 占比百分比数值。 */
  share?: number;
}

/** 促销活动 / 优惠码效果。 */
export interface PromotionOffer {
  /** 优惠名称，如 "Creator Exclusive 15% OFF"。 */
  name: string;
  /** 类型：Code / Bundle / Flash Sale / … */
  type?: string;
  /** 驱动收入。 */
  revenue?: string;
  /** 使用次数。 */
  usageCount?: number;
}

/** Campaign 分析包（趋势 + 新老客 + 洞察 + 品类 + 产品 + 地域 + 优惠码）。 */

/** Campaign 大盘每日趋势（GMV + spend → ROAS）。 */
export interface CampaignTrendPoint {
  date: string;
  revenue: number;
  spend: number;
  commission: number;
  orders: number;
  roas: number;
}

/** 每周 rollup 趋势点。 */
export interface CampaignWeeklyTrendPoint {
  week: string;
  start: string;
  revenue: number;
  spend: number;
  orders: number;
  roas: number;
}

export type InsightKind =
  | 'high-traffic-low-cvr'
  | 'scale-opportunity'
  | 'best-placement'
  | 'best-creator'
  | 'roas-warning';
export type InsightSeverity = 'good' | 'warn' | 'opportunity';
export type InsightSubject = 'campaign' | 'creator' | 'placement';

export interface CampaignInsight {
  kind: InsightKind;
  severity: InsightSeverity;
  subjectType: InsightSubject;
  subjectId?: string;
  subjectName: string;
  metrics: { label: string; value: string }[];
  rationale: string;
  action: string;
}

/** Campaign 分析包（趋势 + 新老客 + 洞察 + 品类 + 产品 + 地域 + 优惠码）。 */
export interface CampaignAnalytics {
  trend: CampaignTrendPoint[];
  weeklyTrend: CampaignWeeklyTrendPoint[];
  customerSplit?: { newCustomers: number; returningCustomers: number; newCustomerRate: string };
  insights: CampaignInsight[];
  /** 新客数（DG 报告 KPI: New Customer Acquisition）。 */
  newCustomers?: number;
  /** 客单价 AOV（DG 报告 KPI）。 */
  aov?: string;
  /** Top-Selling Categories（品类销售占比）。 */
  topCategories?: CategoryPerformance[];
  /** Top-Selling Products（热销产品排行）。 */
  topProducts?: ProductPerformance[];
  /** Top Markets（地域销售维度）。 */
  topMarkets?: MarketPerformance[];
  /** Top Promotion Offers（促销活动 / 优惠码效果）。 */
  promotionOffers?: PromotionOffer[];
  /**
   * 媒体方站内资源位（campaign 级定性展示：Homepage Hero / Featured Products 等）。
   * 与达人维度 PlacementPerformance 不同——此处仅记录资源位名称/截图/说明，
   * 不含数字指标（数字真源仍是 CPS daily），用于报告的 Media Placement 展示模块。
   */
  mediaPlacements?: MediaPlacement[];
}

/** 媒体方站内资源位（campaign 级、定性）。 */
export interface MediaPlacement {
  /** 资源位名称，如 'DigChic Homepage Hero'。 */
  name: string;
  /** 截图 URL（可选，空 → 占位）。 */
  screenshotUrl?: string;
  /** 说明（投放时段 / 位置描述）。 */
  description?: string;
}
