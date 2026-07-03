/**
 * MediaKit 共享类型（type-only）。前后端共享。
 * 对齐 docs/superpowers/specs/2026-06-30-mediakit-fresh-rewrite-design.md §3.3。
 */

/* ------------------------------------------------------------------ */
/* 认证 / 用户                                                         */
/* ------------------------------------------------------------------ */

export type Role = 'ADMIN' | 'USER';

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

/** 登录响应：access token 放响应体（前端存内存），refresh 走 httpOnly cookie。 */
export interface LoginResponse {
  user: User;
  accessToken: string;
  /** access token 剩余有效期（秒），供前端调度刷新。 */
  expiresIn: number;
}

export interface AuthSession {
  user: User;
  accessToken: string;
}

/* ------------------------------------------------------------------ */
/* 项目                                                                */
/* ------------------------------------------------------------------ */

export interface ProjectSummary {
  id: string;
  name: string;
  width: number;
  height: number;
  /** 页数，便于列表展示（不展开 pages）。 */
  pageCount: number;
  /** 项目元数据（业务线/创建人/场景/广告主/campaign 信息）。 */
  meta?: ProjectMeta;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetail {
  id: string;
  name: string;
  pages: Page[];
  width: number;
  height: number;
  meta?: ProjectMeta;
  createdAt: string;
  updatedAt: string;
}

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

/** 上游 Campaign 实体（接入上游接口；demo 中 mock）。 */
export interface Campaign {
  id: string;
  name: string;
  advertiser: string;
  businessLine: string;
  platform: string;
  startDate: string;
  endDate: string;
  budget: string;
  status?: string;
  owner?: string;
}

/** 项目主题（报告维度配置）：品牌色等，驱动编辑器 accent 主题色。 */
export interface ProjectTheme {
  /** 主品牌色（HEX），映射到 CSS 变量 --accent-primary。 */
  primary?: string;
  /** 次品牌色（HEX），映射到 --accent-secondary。 */
  secondary?: string;
  /** 字体族（留空=默认 Inter）。 */
  fontFamily?: string;
}

/** 项目元数据（mock 原型字段，存于 Project.meta JSON）。 */
export interface ProjectMeta {
  /** 业务线：FT/SM/CX/DG/KN/DM 等。 */
  businessLine?: string;
  /** 创建人。 */
  creator?: string;
  scenario?: Scenario;
  /** Campaign 报告子类（仅 scenario=campaign-report）。 */
  scenarioSub?: ScenarioSub;
  /** 广告主。 */
  advertiser?: string;
  /** 选中的上游 campaign id（campaign 类型场景）。 */
  campaignId?: string;
  campaignInfo?: CampaignInfo;
  /** 报告主题（品牌色等）。 */
  theme?: ProjectTheme;
}

/* ------------------------------------------------------------------ */
/* 编辑器数据模型（M0 仅定义类型，编辑器内核在 M1 落地）                */
/* ------------------------------------------------------------------ */

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
  // 业务组件（试点：公司/报价域，从原整页版式拆出的可复用语义块）
  | 'brand-wall'
  | 'package-card'
  // 业务组件（试点：Campaign 报告域，周报/月报/结案核心页）
  | 'kpi-board'
  | 'timeline-compare'
  | 'product-performance'
  | 'placement-display'
  | 'post-list';

/* ---- 各组件 Data（取自 demo.html + G2/G4 spec） ---- */

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

export interface IndicatorCardData {
  title: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
  colorTheme: 'orange' | 'green' | 'blue' | 'purple' | 'red';
}

export interface BarChartDatum {
  label: string;
  value: number;
  color: string;
}
export interface BarChartData {
  title?: string;
  bars: BarChartDatum[];
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

/** 达人头像卡：头像 + 名称 + 平台 + 层级 + 简介。 */
export type CreatorAvatarVariant = 'horizontal' | 'vertical' | 'compact';
export interface CreatorAvatarCardData {
  variant: CreatorAvatarVariant;
  avatar: string;
  name: string;
  platform: CreatorPlatform;
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
export type CreatorStatsVariant = 'cards' | 'plain' | 'metric';
export interface CreatorStatsStripData {
  variant: CreatorStatsVariant;
  stats: { label: string; value: string; color: string }[];
}

/**
 * 达人作品列表：复用 TableData 形状（{headers,rows}）。
 * 约定列顺序：[封面URL, 标题, 转, 赞, 评]；渲染层把列0当图片、列2-4当互动数据。
 * 注：试点刻意复用 table 字段编辑器，强类型 object-list 留后续。
 */
export type CreatorWorksVariant = 'cards' | 'row' | 'compact';
export interface CreatorWorksListData {
  variant: CreatorWorksVariant;
  headers: string[];
  rows: string[][];
}

/* ---- 业务组件（试点：公司/报价域）Data ---- */

/**
 * 品牌墙：Logo 网格。复用 TableData 形状（{headers,rows}）。
 * 约定列顺序：[品牌名, Logo URL]；无 URL 时渲染品牌名首字占位。
 */
export type BrandWallVariant = 'grid' | 'row' | 'marquee';
export interface BrandWallData {
  variant: BrandWallVariant;
  headers: string[];
  rows: string[][];
}

/**
 * 套餐卡：单个方案。features 复用 TableData 形状（headers+rows，单列 [特性]，每行一条），
 * 以便复用 table 字段编辑器（与 brand-wall / works-list 一致的对象列表方案）。
 */
export type PackageCardVariant = 'standard' | 'featured' | 'compact';
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
export type KpiBoardVariant = 'grid' | 'row' | 'compact';
export interface KpiBoardData {
  variant: KpiBoardVariant;
  headers: string[];
  rows: string[][];
}

/**
 * 周期对比表（≈PRD CMP-B13）：本期 vs 上期 + 状态。复用 TableData 形状，
 * 约定列顺序 [指标, 本期, 上期, 状态]；状态值 Optimized/Exceeded/Stable 渲染为色块。
 */
export type TimelineCompareVariant = 'standard' | 'mini' | 'with-bar';
export interface TimelineCompareData {
  variant: TimelineCompareVariant;
  headers: string[];
  rows: string[][];
}

/**
 * 商品表现（≈PRD CMP-B12）：TOP N 商品。复用 TableData 形状，
 * 约定列顺序 [商品名, 图URL, 销量, 占比, 品类]；insight 为可选 AI 洞察文本。
 */
export type ProductPerformanceVariant = 'cards' | 'rank' | 'grid';
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
  | PostListData;

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

export interface Page {
  id: string;
  name: string;
  components: EditorComponent[];
  /** 页面背景色（HEX）；与 bgImage 二选一，未设时画布默认白。 */
  bgColor?: string;
  /** 页面背景图 URL（cover 铺满）；优先于 bgColor。 */
  bgImage?: string;
}
