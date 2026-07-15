/**
 * 编辑器数据模型（M0 仅定义类型，编辑器内核在 M1 落地）。
 * 含 IconWeight、ComponentType（38 成员联合）、各组件 Data 接口、变体类型、
 * ComponentData 联合、EditorComponent、ComponentBinding、Datasource。
 */
import type { CreatorStatItem } from './campaign';

/** 图标风格 = Phosphor weight。6 套风格。 */
export type IconWeight = 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';

export type ComponentType =
  | 'text'
  | 'image'
  | 'indicator-card'
  | 'bar-chart'
  | 'line-chart'
  | 'pie-chart'
  | 'table'
  | 'business-block'
  // 业务组件（试点：达人介绍页拆出的页内语义块，绑定"达人"领域实体）
  | 'creator-avatar-card'
  | 'creator-stats-strip'
  | 'creator-works-list'
  | 'creator-list'
  // 业务组件（试点：公司/报价域，从原整页版式拆出的可复用语义块）
  | 'brand-wall'
  | 'package-card'
  // 业务组件（试点：Campaign 报告域，周报/月报/结案核心页）
  | 'kpi-board'
  | 'timeline-compare'
  | 'product-performance'
  | 'placement-display'
  // 业务组件（试点：达人粉丝画像图表，绑定"达人"领域实体）
  | 'creator-fan-gender'
  | 'creator-fan-city'
  | 'creator-fan-age'
  | 'creator-fan-interest'
  | 'post-list'
  // 业务组件（试点：业绩·商品域，作品证据 / 口碑展示）
  | 'work-screenshot'
  | 'work-metrics'
  | 'comment-wordcloud'
  // 业务组件（基础图形 / 缺口组件）
  | 'shape'
  | 'meta-strip'
  | 'strategy-block'
  // 基础组件：组图（按图片数量的预设版式，纯图无 caption）
  | 'image-group'
  // 基础组件：标题块（多样式大标题，用于页头/分隔/强调）
  | 'title-block'
  // 业绩·商品域：Campaign 单达人维度分析图表
  | 'campaign-analysis'
  // 业绩·商品域：单达人作品数据指标（拆分子分类）
  | 'creator-work-metrics'
  // 业绩·商品域：达人作品列表（带封面+数据列，mock 数据）
  | 'creator-works-table'
  // 基础组件：内容卡片（带标题 + 正文 + 可选图片/标签），可自由填充
  | 'content-card'
  | 'swot-matrix'
  // Campaign 强关联组件：数据来自 Campaign Summary / Funnel / Revenue / Publisher / GEO 等
  | 'campaign-summary'
  | 'funnel-chart'
  | 'revenue-timeline'
  | 'publisher-table'
  | 'geo-distribution'
  | 'placement-wide-table'
  | 'placement-type-summary'
  | 'device-breakdown'
  | 'content-topic-performance'
  | 'search-term-table'
  | 'hourly-heatmap'
  // 达人域：用户画像复合容器（性别/年龄/城市等可增删子模块，从绑定达人 audience 填充）
  | 'creator-audience-profile';

/* ---- 数据来源标记（所有组件 data 通用元字段） ---- */

/**
 * 组件数据来源模式（互斥）。
 * - 'manual'  → 手动填写，属性面板直接编辑字段
 * - 'url'     → URL 解析导入，属性面板显示 URL 输入框
 * - 'project' → 项目数据导入，属性面板显示导入选择器
 */
export type DataSourceMode = 'manual' | 'url' | 'project';

/* ---- 各组件 Data（取自 demo.html + G2/G4 spec） ---- */

export type ShapeKind = 'rectangle' | 'rounded' | 'circle' | 'line';

export interface ShapeData {
  shape: ShapeKind;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  rotation?: number;
  borderRadius?: number; // 仅 rounded
  dash?: boolean; // 仅 line
}

export interface TextData {
  content: string;
  fontSize: number;
  fontWeight?: number;
  fontFamily?: string;
  color: string;
  bgColor?: string;
  padding?: number;
}

export interface ImageData {
  src: string;
  fit: 'cover' | 'contain' | 'fill';
}

/**
 * 组图版式 id（数量即版式）。
 * - 'duo'..'duoza' 为固定张数版式；
 * - 'auto' = 按 images.length 自动选最接近张数的版式（见渲染层 resolveLayout）。
 */
export type ImageGroupLayoutId =
  | 'auto'
  | 'duo'
  | 'trio'
  | 'quad'
  | 'mosaic-5'
  | 'hex'
  | 'septet'
  | 'nona'
  | 'duoza';

/** 组图单项：仅图片 URL（无 caption）。 */
export interface ImageGroupItem {
  src: string;
}

/**
 * 组图组件：按图片数量提供预设版式的纯图网格。
 * variant 复用 data.variant 通道（与全局 VariantSelector 一致），缺省 'auto'。
 * images 自由长度；版式锁定时槽位固定，溢出忽略、不足补空占位。
 */
export interface ImageGroupData {
  variant?: ImageGroupLayoutId;
  images: ImageGroupItem[];
  /** 单元格间距（px）；可选，缺省 8。 */
  gap?: number;
}

/* ---- 标题块：多样式大标题 ---- */

export type TitleBlockStyle = 'plain' | 'bar-left' | 'underline' | 'gradient' | 'card' | 'numbered' | 'highlight' | 'accent-tag' | 'accent-underline' | 'block-underline';

export interface TitleBlockData {
  variant: TitleBlockStyle;
  text: string;
  subtitle?: string;
  /** 字号(px);缺省=跟随全局 heading.fontSize(见 ProjectTheme.heading)。 */
  fontSize?: number;
  /** 字重;缺省 700。 */
  fontWeight?: number;
  /** 标题文字颜色:'brand'=品牌色(--color-primary),'black'=黑色。缺省=黑色。gradient 变体固定白色。 */
  titleColor?: 'brand' | 'black';
  /** 序号（numbered / accent-tag 样式用，如 "01"） */
  index?: string;
  /** 主色（bar/underline/gradient/numbered/highlight/accent-tag 用） */
  color?: string;
  /** 下划线颜色（underline 样式）：品牌色 / 黑色；缺省品牌色 */
  underlineColor?: 'brand' | 'black';
  /** 是否显示底部分割线 */
  divider?: boolean;
}

/* ---- 内容卡片（带标题 + 正文 + 可选图片/标签）---- */

export type ContentCardVariant = 'standard' | 'image-top' | 'image-left' | 'compact' | 'quote';

export interface ContentCardData {
  variant?: ContentCardVariant;
  title: string;
  body?: string;
  image?: string;
  tag?: string;
  footer?: string;
  /** 标题色（空时跟全局品牌色） */
  accentColor?: string;
}

/* ---- SWOT / 机会挑战矩阵 ---- */

export type SwotMatrixVariant = 'grid' | 'list' | 'cards';

export interface SwotQuadrant {
  /** 象限标题，如 "Opportunities"、"Challenges" */
  title: string;
  /** 要点列表（每条一行） */
  items: string[];
}

export interface SwotMatrixData {
  variant?: SwotMatrixVariant;
  /** 大标题 */
  title?: string;
  /** 四个象限：按 [左上, 右上, 左下, 右下] 顺序 */
  quadrants: SwotQuadrant[];
}

/* ---- Campaign 强关联组件数据类型 ---- */
/* 数据结构与 campaign.ts 中同名接口对齐，但以「组件可自由编辑」的扁平形式声明。 */

/** Campaign 总览看板。 */
export interface CampaignSummaryData {
  title?: string;
  campaignName: string;
  period: string;
  /** 汇总 KPI 行 */
  metrics: { label: string; value: string; compare?: string }[];
  /** 新客/老客分布（可选） */
  customerSplit?: { newCustomers: number; returningCustomers: number; newCustomerRate: string };
}

/** 转化漏斗。 */
export interface FunnelChartData {
  title?: string;
  subtitle?: string;
  steps: { label: string; value: number; rate?: string }[];
  /** AI 洞察 */
  insight?: string;
}

/** 收入时间线（趋势线图）。 */
export interface RevenueTimelineData {
  title?: string;
  subtitle?: string;
  /** 日维度数据点 */
  points: { date: string; revenue: number; spend: number; commission: number; orders: number }[];
  /** 显示哪些系列 */
  series?: ('revenue' | 'spend' | 'commission' | 'orders')[];
}

/** Publisher 效果宽表。 */
export interface PublisherTableData {
  title?: string;
  /** 列定义 */
  columns?: { key: string; label: string }[];
  /** 行数据 */
  rows: { publisher: string; clicks: string; impressions: string; ctr: string; conversions: string; cvr: string; revenue: string; commission: string; epc: string; roas: string; status: 'good' | 'warn' | 'bad' }[];
}

/** GEO 国家收入分布。 */
export interface GeoDistributionData {
  title?: string;
  subtitle?: string;
  /** 国家维度数据，value=收入占比百分比，display=格式化收入 */
  items: { code: string; name: string; value: number; display: string; share: string }[];
  variant?: 'bars' | 'list';
}

/** 投放位宽表（9 列）。 */
export interface PlacementWideTableData {
  title?: string;
  rows: { placement: string; publisher: string; clicks: string; ctr: string; conversions: string; cvr: string; revenue: string; epc: string; status: 'good' | 'warn' | 'bad' }[];
}

/** 投放位类型汇总（带趋势线）。 */
export interface PlacementTypeSummaryData {
  title?: string;
  subtitle?: string;
  items: { type: string; revenue: string; revenueShare: string; clicks: string; ctr: string; conversions: string; cvr: string; epc: string; roas: string; trend?: { label: string; value: number }[] }[];
}

/** 设备分布。 */
export interface DeviceBreakdownData {
  title?: string;
  items: { device: string; sessions: string; revenue: string; share: string; trend: string }[];
}

/** 内容主题效果。 */
export interface ContentTopicPerformanceData {
  title?: string;
  items: { topic: string; posts: number; impressions: string; engagement: string; revenue: string; roas: string; status: 'good' | 'warn' | 'bad' }[];
}

/** 搜索词效果表。 */
export interface SearchTermTableData {
  title?: string;
  items: { term: string; clicks: string; conversions: string; ctr: string; revenue: string; status: 'good' | 'warn' | 'bad' }[];
}

/** 时段效果热力图（24h）。 */
export interface HourlyHeatmapData {
  title?: string;
  subtitle?: string;
  /** 24 条数据，hour = "00".."23" */
  hours: { hour: string; impressions: number; clicks: number; conversions: number }[];
  /** 高亮指标：impressions / clicks / conversions */
  metric?: 'impressions' | 'clicks' | 'conversions';
}

/* ---- Campaign 单达人维度分析图表 ---- */

export type CampaignAnalysisVariant = 'radar' | 'combo' | 'funnel';

export interface CampaignAnalysisData {
  variant: CampaignAnalysisVariant;
  title: string;
  subtitle?: string;
  /** 雷达图维度（variant=radar） */
  dimensions?: { label: string; value: number; max?: number }[];
  /** 组合图（柱+线）数据（variant=combo） */
  series?: { label: string; barValue: number; lineValue: number }[];
  /** 漏斗图数据（variant=funnel） */
  funnelSteps?: { label: string; value: number }[];
  /** AI 洞察文本 */
  insight?: string;
}

/* ---- 单达人作品数据指标（拆分子分类） ---- */

export type CreatorWorkMetricsVariant = 'grid' | 'strip' | 'card' | 'detailed' | 'audience' | 'city' | 'trend';

export interface CreatorWorkMetricsData {
  variant: CreatorWorkMetricsVariant;
  title: string;
  subtitle?: string;
  /** 作品封面 URL */
  cover?: string;
  /** 作品名称 */
  workName?: string;
  /** 指标列表 */
  metrics: { label: string; value: string; sub?: string; color?: string }[];
  /** 受众画像 + 趋势数据（audience / city / trend 变体用）。 */
  audience?: WorkAudienceInsight;
}

/* ---- 达人作品列表（封面+数据列，mock 数据） ---- */

export type CreatorWorksTableVariant = 'list' | 'cards' | 'compact' | 'insight';

export interface CreatorWorksTableData {
  variant: CreatorWorksTableVariant;
  title: string;
  subtitle?: string;
  headers: string[];
  /** 每行：[封面URL, 作品名, 播放, 点赞, 评论, 转发, 完播率] */
  rows: string[][];
  /** 'insight' 变体下，按 rows 索引对齐的受众洞察数据；缺省=无洞察。 */
  insights?: WorkAudienceInsight[];
}

export type IndicatorCardVariant = 'plain' | 'icon-left' | 'icon-top' | 'icon-bg' | 'spotlight' | 'duo';

export interface IndicatorCardData {
  /** 样式变体；缺省 'plain'（向后兼容老数据，无 variant 字段时按旧外观渲染）。 */
  variant?: IndicatorCardVariant;
  title: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
  colorTheme: 'orange' | 'green' | 'blue' | 'purple' | 'red';
  /** catalog 图标 key，可选；仅当变体启用图标时有意义。 */
  icon?: string;
  /** 图标 weight；缺省走 variant.icon.defaultWeight。 */
  iconWeight?: IconWeight;
}

export interface BarChartDatum {
  label: string;
  value: number;
  color: string;
}
export type BarChartVariant = 'vertical' | 'horizontal' | 'stacked';

export interface BarChartData {
  title?: string;
  variant?: BarChartVariant;
  bars: BarChartDatum[];
  /** 堆叠模式（variant='stacked'）时的系列名列表；bars 的 label 作为 X 轴分类 */
  stackKeys?: string[];
  /** 堆叠数据：每个分类下各系列的值 { label, values: { key: number } } */
  stackBars?: { label: string; values: Record<string, number> }[];
}

export interface LineChartDatum {
  label: string;
  value: number;
}
export interface LineChartSeries {
  name: string;
  color: string;
  points: LineChartDatum[];
}
export interface LineChartData {
  title?: string;
  series: LineChartSeries[];
}

export interface PieChartSlice {
  label: string;
  value: number;
  color: string;
}
export interface PieChartData {
  title?: string;
  slices: PieChartSlice[];
}

export interface TableData {
  headers: string[];
  rows: string[][];
}

export type BusinessVariant =
  | 'standard'
  | 'cards'
  | 'accent'
  | 'stats'
  | 'light'
  | 'table'
  | 'results';

export interface BusinessBlockData {
  businessKind: string;
  title: string;
  meta: string;
  details: string[];
  variant: BusinessVariant;
  layoutForm?: string;
}

/* ---- 业务组件（试点：达人领域）Data ---- */

/** 平台 logo 文本标识（渲染层映射为图标/文案）。 */
export type CreatorPlatform = 'xiaohongshu' | 'tiktok' | 'instagram' | 'youtube' | 'weibo';
/** 达人层级。 */
export type CreatorTier = 'mega' | 'macro' | 'micro';

/** 达人头像卡：头像 + 名称 + 平台 + 层级 + 简介。
 *  platform = 主平台（向后兼容）；platforms = 全部平台标识（可多平台）。 */
export type CreatorAvatarVariant = 'horizontal' | 'vertical' | 'compact' | 'badge' | 'banner' | 'glass' | 'hero' | 'minimal';
export interface CreatorAvatarCardData {
  variant: CreatorAvatarVariant;
  avatar: string;
  name: string;
  /** 主平台（向后兼容单平台数据）。 */
  platform: CreatorPlatform;
  /** 全部平台（多平台账号）；缺省时回退到 platform。 */
  platforms?: CreatorPlatform[];
  tier: CreatorTier;
  intro: string;
  /** 链接解析产出（可选；向后兼容老数据）。 */
  sourceUrl?: string;
  handle?: string;
  followers?: string;
  likes?: string;
  engagement?: string;
}

/** 达人数据条：一组 KPI（粉丝/互动率/触达/曝光…）。复用 {label,value,color} 形状。 */
export type CreatorStatsVariant = 'cards' | 'plain' | 'metric' | 'progress' | 'ring' | 'gradient';

/**
 * 达人数据条单项。
 * 注：CreatorStatItem 类型定义在 campaign.ts（ReportCreator.stats 引用），
 * 此处从 campaign.ts 复用同一类型，避免重复定义导致的类型不一致。
 * re-export 以便 editor 模块的消费者仍可从此处导入。
 */
export type { CreatorStatItem };

export interface CreatorStatsStripData {
  variant: CreatorStatsVariant;
  stats: CreatorStatItem[];
}

/**
 * 达人作品列表：复用 TableData 形状（{headers,rows}）。
 * 约定列顺序：[封面URL, 标题, 转, 赞, 评]；渲染层把列0当图片、列2-4当互动数据。
 * 注：试点刻意复用 table 字段编辑器，强类型 object-list 留后续。
 */
export type CreatorWorksVariant = 'cards' | 'row' | 'compact' | 'detailed';

/** 作品趋势数据点（时间→数值，用于作品详情的趋势迷你图）。 */
export interface WorkTrendPoint {
  label: string;
  value: number;
}

/** 单个作品的受众维度数据（可选，用于 'detailed' 变体展开展示）。 */
export interface WorkAudienceInsight {
  /** 粉丝受众 Top 城市/区域 [{label, value}]。 */
  topCities?: { label: string; value: number; color?: string }[];
  /** 性别分布 [{label: '男'|'女', value: 百分比, color}]。 */
  genderSplit?: { label: string; value: number; color?: string }[];
  /** 年龄段分布 [{label: '18-24', value: 百分比, color}]。 */
  ageRange?: { label: string; value: number; color?: string }[];
  /** 数据趋势（播放/互动等随时间的变化）。 */
  trend?: WorkTrendPoint[];
  /** 趋势指标名称（如"播放趋势""互动趋势"），缺省 '数据趋势'。 */
  trendLabel?: string;
}

/** 作品详情行：在基础 [封面,标题,转,赞,评] 之外，携带受众画像 + 趋势数据。 */
export interface CreatorWorksListData {
  variant: CreatorWorksVariant;
  headers: string[];
  rows: string[][];
  /** 'detailed' 变体下，按 rows 索引对齐的受众洞察数据；缺省=无洞察。 */
  insights?: WorkAudienceInsight[];
}

/**
 * 达人列表：多达人汇总展示。复用 TableData 形状，
 * 约定列顺序 [头像URL, 名称, 平台, 粉丝数, 互动率, 分类]。
 */
export type CreatorListVariant = 'table' | 'cards' | 'compact';
export interface CreatorListData {
  variant: CreatorListVariant;
  /** 列标题（可自定义文案）。 */
  headers: string[];
  /** 每行：[头像URL, 名称, 平台, 粉丝数, 互动率, 分类]。 */
  rows: string[][];
}

/* ---- 业务组件（试点：公司/报价域）Data ---- */

/**
 * 品牌墙：Logo 网格。复用 TableData 形状（{headers,rows}）。
 * 约定列顺序：[品牌名, Logo URL]；无 URL 时渲染品牌名首字占位。
 */
export type BrandWallVariant = 'grid' | 'row' | 'marquee' | 'circle' | 'fade';
export interface BrandWallData {
  variant: BrandWallVariant;
  headers: string[];
  rows: string[][];
}

/**
 * 套餐卡：单个方案。features 复用 TableData 形状（headers+rows，单列 [特性]，每行一条），
 * 以便复用 table 字段编辑器（与 brand-wall / works-list 一致的对象列表方案）。
 */
export type PackageCardVariant = 'standard' | 'featured' | 'compact' | 'table';
export interface PackageCardData {
  variant: PackageCardVariant;
  name: string;
  price: string;
  headers: string[];
  rows: string[][];
  highlighted: boolean;
}

/* ---- 业务组件（试点：Campaign 报告域）Data ---- */

/**
 * 业绩看板（≈PRD CMP-B1）：KPI 矩阵。复用 TableData 形状，
 * 约定列顺序 [指标, 数值, 对比]；对比为 "+15%"/"-2%" 文本，渲染层按首字符上色。
 */
export type KpiBoardVariant = 'grid' | 'row' | 'compact' | 'card' | 'gradient' | 'minimal' | 'flat';
export type KpiColorToken = 'primary' | 'success' | 'warning' | 'danger' | 'info';
/** 环比方向：positive=升为好（默认） / inverse=降为好（CPA/CPC/退款率等逆向指标）。 */
export type KpiTrendDirection = 'positive' | 'inverse';

export interface KpiBoardData {
  variant: KpiBoardVariant;
  headers: string[];
  rows: string[][];
  /** 每行图标 catalog key（按 rows 索引对齐）；null/缺省=不显示。仅 card 变体消费。 */
  icons?: (string | null)[];
  /** 每行数值主题色 token（按 rows 索引对齐）；缺省/null=默认前景。 */
  valueColors?: (KpiColorToken | null)[];
  /** 图标 weight，缺省 'regular'。 */
  iconWeight?: IconWeight;
  /** 每行环比方向（按 rows 索引）；positive=升好 / inverse=降好。缺省视为 positive。 */
  trendDirections?: (KpiTrendDirection | null)[];
  /** 环比对比基准文字（全局），如 "vs 06.01–06.30" / "vs 目标"；缺省回退 "vs 上期"。 */
  compareLabel?: string;
  /** 被隐藏的行索引（按 rows 索引）；渲染时过滤掉，属性面板可重新显示。 */
  hiddenIndices?: number[];
}

/** 基础信息横排卡组（达人画像页 BASE/TYPE/TIER）。复用 TableData 形态。 */
export type MetaStripVariant = 'inline' | 'divider' | 'list' | 'cards' | 'stat';

export interface MetaStripData {
  /** 样式变体；缺省按 'inline'（向后兼容老数据）。 */
  variant?: MetaStripVariant;
  /** 约定 ['图标', '标签', '文本']。 */
  headers: string[];
  /** 每行 [iconKey?, label, text]；iconKey 为 catalog key，空串=无图标。 */
  rows: string[][];
}

/** 内容策略富文本块（达人画像页 INSIGHT/STRATEGY）。复用 TableData 形态。 */
export type StrategyBlockVariant = 'default' | 'labeled' | 'bulleted' | 'cards';

export interface StrategyBlockData {
  /** 样式变体；缺省 'default'（平铺）。labeled=卡片标签，bulleted=卡片列表。 */
  variant?: StrategyBlockVariant;
  /** 大标题（labeled 变体顶部显示）。 */
  title?: string;
  /** 约定 ['图标', '标题', '内容']。 */
  headers: string[];
  /**
   * 每行 [iconKey?, title, content]。
   * content 为受限 HTML 字符串（允许 b/strong/i/em/ul/ol/li/br/p，无属性），
   * 渲染前经 sanitizeRichText 清洗；旧数据（纯文本）自动兼容。
   */
  rows: string[][];
  /** 全局高亮词，逗号分隔；渲染时 split，命中 content 的词包粉色 span。 */
  highlights?: string;
}

/**
 * 周期对比表（≈PRD CMP-B13）：本期 vs 上期 + 状态。复用 TableData 形状，
 * 约定列顺序 [指标, 本期, 上期, 状态]；状态值 Optimized/Exceeded/Stable 渲染为色块。
 */
export type TimelineCompareVariant = 'standard' | 'mini' | 'with-bar' | 'cards';
export interface TimelineCompareData {
  variant: TimelineCompareVariant;
  headers: string[];
  rows: string[][];
}

/**
 * 商品表现（≈PRD CMP-B12）：TOP N 商品。复用 TableData 形状，
 * 约定列顺序 [商品名, 图URL, 销量, 占比, 品类]；insight 为可选 AI 洞察文本。
 */
export type ProductPerformanceVariant = 'cards' | 'rank' | 'grid' | 'bar' | 'pie';
export interface ProductPerformanceData {
  variant: ProductPerformanceVariant;
  insight: string;
  headers: string[];
  rows: string[][];
}

/**
 * DM 广告位展示（≈PRD CMP-B15）：广告位截图 + 名称 + 数据，
 * 可选 Highlights / Learnings 文本。复用 TableData，列顺序 [名称, 截图URL, 数据]。
 */
export type PlacementVariant = 'single' | 'grid' | 'with-text';
export interface PlacementData {
  variant: PlacementVariant;
  highlights: string;
  learnings: string;
  headers: string[];
  rows: string[][];
}

/**
 * Post/链接列表（≈PRD CMP-B16）：Content Site/Reddit/FB 等非达人渠道的 Post。
 * 复用 TableData，列顺序 [截图URL, 标题, ID, 链接, 数据]。
 */
export type PostListVariant = 'cards' | 'row' | 'compact';
export interface PostListData {
  variant: PostListVariant;
  headers: string[];
  rows: string[][];
}

/* ---- 业务组件（试点：达人粉丝画像图表）Data ---- */

/** 性别占比（环形图）。center 为中心主项摘要，空 → 不渲染中心文字。 */
export interface CreatorFanGenderData {
  title?: string;
  subtitle?: string; // 空 → 不渲染
  center?: string;
  slices: PieChartSlice[]; // 复用 {label,value,color}
}

/** 城市分布 Top N（横向条形）。bars 按 value 降序展示。 */
export interface CreatorFanCityData {
  title?: string;
  subtitle?: string;
  bars: BarChartDatum[];
}

/** 年龄段分布（竖向柱状）。 */
export interface CreatorFanAgeData {
  title?: string;
  subtitle?: string;
  bars: BarChartDatum[];
}

/** 兴趣标签（纯 div 横向占比条）。showPercent 缺省视为 true。 */
export interface CreatorFanInterestData {
  title?: string;
  subtitle?: string;
  showPercent?: boolean;
  tags: { label: string; value: number; color: string }[];
}

/* ---- 用户画像复合容器（性别/年龄/城市等可增删子模块）Data ---- */

/** 画像子模块 key（固定枚举，对应 ReportCreator.audience 字段）。 */
export type AudienceModuleKey = 'gender' | 'age' | 'city';

/** 单个子模块：selected 控制增删；items 为该维度数据（{label,value,color?}）。 */
export interface AudienceModule {
  key: AudienceModuleKey;
  /** 是否启用（增删）。缺省视为 true。 */
  selected?: boolean;
  items?: { label: string; value: number; color?: string }[];
}

/** 用户画像复合容器数据。 */
export interface CreatorAudienceProfileData {
  /** 布局：grid-2 / grid-3 / stacked。缺省 grid-3。 */
  variant?: 'grid-2' | 'grid-3' | 'stacked';
  title?: string;
  subtitle?: string;
  /** 启用的子模块列表（按顺序渲染）。 */
  modules: AudienceModule[];
}

/* ---- 业务组件（试点：业绩·商品域，作品证据 / 口碑展示）Data ---- */

/** 作品截图视觉风格预设（与版式 variant 正交）。 */
export type WorkScreenshotStyle = 'grid' | 'skew' | 'overlap' | 'filmstrip' | 'diagonal' | 'mosaic';

/** 作品截图「组合版式」预设（仅 style==='mosaic' 时生效；缺省 'auto' = 按张数自动选模板）。 */
export type WorkScreenshotMosaicLayout =
  | 'auto' | 'hero-3' | 'hero-4' | 'hero-5' | 'pinzhi' | 'staircase' | 'staggered' | 'grid-3x3';

export interface WorkScreenshotItem {
  src: string;
  caption?: string;
  /** 是否隐藏说明文字（默认 false=显示）。隐藏后保留数据，仅渲染层不显示。 */
  captionHidden?: boolean;
}

/** 作品截图墙。复用组图版式引擎（variant = ImageGroupLayoutId）；缺省 'auto'。
 * style 控制视觉风格：'grid'=标准网格（缺省），'diagonal'=斜切网格，'skew'=斜切拼接，
 * 'overlap'=重叠堆叠，'filmstrip'=胶片条。
 * grid/diagonal 使用 variant 控制张数版式；skew/overlap/filmstrip 使用 cols 控制列数。 */
export interface WorkScreenshotData {
  variant?: ImageGroupLayoutId;
  /** 视觉风格预设，与 variant 正交。 */
  style?: WorkScreenshotStyle;
  /** 组合版式预设（仅 style==='mosaic' 生效）；缺省 'auto' = 按张数自动选模板。 */
  mosaicLayout?: WorkScreenshotMosaicLayout;
  /** 显示数量（控制渲染几张图，实际 images 数组可以更多）。缺省=全部显示。 */
  displayCount?: number;
  title?: string;
  images: WorkScreenshotItem[];
  /** 单元格间距（px）；可选，缺省 8（与组图一致）。 */
  gap?: number;
}

export interface WorkMetricItem {
  label: string;
  value: string; // 展示文案，允许 "1.2万" / "95%" 等
  color?: string;
}

/** 单作品多维指标大数字卡。 */
export interface WorkMetricsData {
  title?: string;
  subtitle?: string;
  cover?: string; // 可选作品封面
  workName?: string; // 可选作品标题
  metrics: WorkMetricItem[];
}

export type Sentiment = 'pos' | 'neg' | 'neutral';

export interface CommentWordItem {
  text: string;
  weight: number; // 数值越大字号越大
  sentiment: Sentiment;
}

/** 评论关键词云（弹性流，字号 ∝ 权重，按情感着色）。 */
export interface CommentWordcloudData {
  title?: string;
  subtitle?: string;
  words: CommentWordItem[];
}

export type ComponentData =
  | TextData
  | ImageData
  | IndicatorCardData
  | BarChartData
  | LineChartData
  | PieChartData
  | TableData
  | BusinessBlockData
  | CreatorAvatarCardData
  | CreatorStatsStripData
  | CreatorWorksListData
  | BrandWallData
  | PackageCardData
  | KpiBoardData
  | TimelineCompareData
  | ProductPerformanceData
  | PlacementData
  | CreatorFanGenderData
  | CreatorFanCityData
  | CreatorFanAgeData
  | CreatorFanInterestData
  | PostListData
  | WorkScreenshotData
  | WorkMetricsData
  | CommentWordcloudData
  | ShapeData
  | ImageGroupData
  | TitleBlockData
  | CampaignAnalysisData
  | CreatorWorkMetricsData
  | CreatorWorksTableData
  | ContentCardData
  | SwotMatrixData
  | CampaignSummaryData
  | FunnelChartData
  | RevenueTimelineData
  | PublisherTableData
  | GeoDistributionData
  | PlacementWideTableData
  | PlacementTypeSummaryData
  | DeviceBreakdownData
  | ContentTopicPerformanceData
  | SearchTermTableData
  | HourlyHeatmapData
  | CreatorAudienceProfileData;

export interface EditorComponent {
  id: string;
  type: ComponentType;
  x: number;
  y: number;
  w: number;
  h: number;
  data: ComponentData;
  locked?: boolean;
  z?: number;
  /** 数据源绑定（M5）：绑定后组件按列从数据源渲染。 */
  binding?: ComponentBinding;
}

/** 数据源绑定：选数据源 + 取值/标签列。 */
export interface ComponentBinding {
  datasourceId: string;
  labelColumn?: string;
  valueColumn?: string;
}

/** 数据源：上传的 CSV/Excel 解析为表格。 */
export interface Datasource {
  id: string;
  name: string;
  columns: string[];
  rows: Record<string, string>[];
}
