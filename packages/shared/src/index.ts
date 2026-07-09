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

/* ------------------------------------------------------------------ */
/* 模板                                                                */
/* 模板由设计师（ADMIN）在管理后台维护，BD（USER）从已发布模板创建项目。  */
/* ------------------------------------------------------------------ */

export type TemplateStatus = 'DRAFT' | 'PUBLISHED';

export interface TemplateSummary {
  id: string;
  name: string;
  width: number;
  height: number;
  pageCount: number;
  meta?: ProjectMeta;
  status: TemplateStatus;
  /** 设计师备注（仅管理后台可见）。 */
  note?: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateDetail {
  id: string;
  name: string;
  pages: Page[];
  width: number;
  height: number;
  meta?: ProjectMeta;
  status: TemplateStatus;
  note?: string | null;
  ownerId: string;
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

/** Campaign 投放表现指标项；与 kpi-board 行 [指标, 数值, 对比] 同构。 */
export interface CampaignMetric {
  label: string;   // 指标名，如 "Spend"（默认英文，与 kpi-board 默认指标对齐）
  value: string;   // 数值，如 "¥128,000"
  compare: string; // 对比文本，如 "+15%"（kpi-board 渲染器按首字符 +/- 自动着色）
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
  /** 投放表现指标（供业绩看板「从 Campaign 导入」）。 */
  metrics?: CampaignMetric[];
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
  startDate?: string;
  endDate?: string;
  budget?: string;
  status?: string;
  metrics?: CampaignMetric[];
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
}

/** 报告全局数据上下文：Campaign + 达人列表。存入编辑器 store，随项目保存。 */
export interface ReportDataContext {
  /** 绑定的 Campaign（可空）。 */
  campaign?: ReportCampaign | null;
  /** 选中的达人列表（可多个）。 */
  creators?: ReportCreator[];
}

/* ------------------------------------------------------------------ */
/* 达人执行效果（上游 mock）                                            */
/* campaign 下每个参与达人的执行效果：帖子效果数据 + CPS（带货）数据。   */
/* 与 Campaign / Creator 同级，属上游接口实体（demo 中 mock）；          */
/* 非持久化 Page/ComponentType 字段，不动服务端 Zod。                    */
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

/**
 * 字体选项：预置字体清单，前后端共享。
 * key 为唯一标识（存入 ProjectTheme.font.text/number/heading），
 * stack 为 CSS font-family 值，loadUrl 为 Google Fonts <link>（按需注入 <head>）。
 */
export interface FontOption {
  key: string; // 'noto-sans-sc'
  label: string; // '思源黑体'
  category: 'text' | 'number' | 'heading';
  stack: string; // 实际 CSS font-family 值
  loadUrl?: string; // Google Fonts <link>，按需注入 <head>
}

/** 整体风格预设：一整套 ProjectTheme 值，点中即填入报告设置。 */
export interface StylePreset {
  key: string; // 'business-sober'
  name: string; // '商务沉稳'
  description: string;
  theme: ProjectTheme; // 一整套值
}

/** 密度：紧凑 / 标准 / 宽松。 */
export type ThemeDensity = 'compact' | 'standard' | 'spacious';
/** 圆角：直角 / 小圆角 / 大圆角。 */
export type ThemeRadius = 'sharp' | 'small' | 'large';

/** 项目主题（报告维度配置）：结构化 ThemeSpec，驱动编辑器整树换肤。 */
export interface ProjectTheme {
  color: {
    primary: string; // 主品牌色（原 primary），映射 --color-primary
    secondary: string; // 次品牌色（原 secondary），映射 --color-secondary
    chartPalette: string[]; // 图表配色序列，6 色，用于柱/折/饼
    neutralText: string; // 主文字色（中性），映射 --color-neutral-text
    neutralBg: string; // 页面/卡片背景色，映射 --color-neutral-bg
  };
  font: {
    text: string; // 文本字体 key（如 'noto-sans-sc'）
    number: string; // 数字字体 key（如 'inter'）
    heading?: string; // 标题字体 key，可选，缺省=跟随 text
  };
  density: ThemeDensity;
  radius: ThemeRadius;
  /** 布局尺寸：安全距离 + 网格；并入主题，由 4 套预设覆盖。 */
  layout?: {
    safeMargin: number;     // 四面统一内缩 px；0=不画安全区
    gridSize: number;       // 网格大小 px；驱动可见网格 + 移动/拖拽/键盘/缩放吸附
    showGrid?: boolean;     // 显示可见网格叠加；缺省 true
    showSafeArea?: boolean; // 显示安全区虚线；缺省 true
  };
  preset?: string; // 当前命中的预设 key，仅用于 UI 高亮；手改字段后置空
}

/** 预置字体清单。 */
export const FONT_OPTIONS: FontOption[] = [
  {
    key: 'noto-sans-sc',
    label: '思源黑体',
    category: 'text',
    stack: "'Noto Sans SC', sans-serif",
    loadUrl: 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap',
  },
  {
    key: 'inter',
    label: 'Inter',
    category: 'number',
    stack: "'Inter', sans-serif",
    loadUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap',
  },
  {
    key: 'funnel-sans',
    label: 'Funnel Sans',
    category: 'heading',
    stack: "'Funnel Sans', sans-serif",
    loadUrl: 'https://fonts.googleapis.com/css2?family=Funnel+Sans:wght@400;700;800&display=swap',
  },
  {
    key: 'ibm-plex-sans',
    label: 'IBM Plex Sans',
    category: 'text',
    stack: "'IBM Plex Sans', sans-serif",
    loadUrl: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&display=swap',
  },
  {
    key: 'ibm-plex-mono',
    label: 'IBM Plex Mono',
    category: 'number',
    stack: "'IBM Plex Mono', monospace",
    loadUrl: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&display=swap',
  },
  {
    key: 'roboto',
    label: 'Roboto',
    category: 'number',
    stack: "'Roboto', sans-serif",
    loadUrl: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap',
  },
  {
    key: 'noto-serif-sc',
    label: '思源宋体',
    category: 'heading',
    stack: "'Noto Serif SC', serif",
    loadUrl: 'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&display=swap',
  },
];

/** 默认图表配色（6 色）。 */
export const DEFAULT_CHART_PALETTE = [
  '#FF5C00',
  '#3B82F6',
  '#22C55E',
  '#8B5CF6',
  '#F59E0B',
  '#EC4899',
];

/** 默认主题：与原硬编码值对齐（ACCENT=#FF5C00, INK=#1A1A1A, Inter）。 */
export const DEFAULT_THEME: ProjectTheme = {
  color: {
    primary: '#FF5C00',
    secondary: '#FF8533',
    chartPalette: [...DEFAULT_CHART_PALETTE],
    neutralText: '#1A1A1A',
    neutralBg: '#FFFFFF',
  },
  font: {
    text: 'noto-sans-sc',
    number: 'inter',
    heading: undefined,
  },
  density: 'standard',
  radius: 'small',
  layout: { safeMargin: 48, gridSize: 10, showGrid: true, showSafeArea: true },
  preset: 'business-sober',
};

/** 整体风格预设清单（4 个）。 */
export const STYLE_PRESETS: StylePreset[] = [
  {
    key: 'business-sober',
    name: '商务沉稳',
    description: '橙色主品牌色 + 思源黑体 + 标准密度',
    theme: {
      color: {
        primary: '#FF5C00',
        secondary: '#FF8533',
        chartPalette: ['#FF5C00', '#3B82F6', '#22C55E', '#8B5CF6', '#F59E0B', '#EC4899'],
        neutralText: '#1A1A1A',
        neutralBg: '#FFFFFF',
      },
      font: { text: 'noto-sans-sc', number: 'inter', heading: undefined },
      density: 'standard',
      radius: 'small',
      layout: { safeMargin: 48, gridSize: 10, showGrid: true, showSafeArea: true },
      preset: 'business-sober',
    },
  },
  {
    key: 'tech-minimal',
    name: '科技简约',
    description: '蓝色主品牌色 + Inter/IBM Plex Mono + 紧凑密度',
    theme: {
      color: {
        primary: '#2563EB',
        secondary: '#60A5FA',
        chartPalette: ['#2563EB', '#06B6D4', '#8B5CF6', '#3B82F6', '#22C55E', '#F59E0B'],
        neutralText: '#0F172A',
        neutralBg: '#F8FAFC',
      },
      font: { text: 'inter', number: 'ibm-plex-mono', heading: 'inter' },
      density: 'compact',
      radius: 'sharp',
      layout: { safeMargin: 40, gridSize: 8, showGrid: true, showSafeArea: true },
      preset: 'tech-minimal',
    },
  },
  {
    key: 'vibrant-trendy',
    name: '活力潮流',
    description: '粉红主品牌色 + Funnel Sans + 宽松密度',
    theme: {
      color: {
        primary: '#EC4899',
        secondary: '#F472B6',
        chartPalette: ['#EC4899', '#F59E0B', '#22C55E', '#3B82F6', '#8B5CF6', '#06B6D4'],
        neutralText: '#1A1A1A',
        neutralBg: '#FFFFFF',
      },
      font: { text: 'noto-sans-sc', number: 'inter', heading: 'funnel-sans' },
      density: 'spacious',
      radius: 'large',
      layout: { safeMargin: 64, gridSize: 12, showGrid: true, showSafeArea: true },
      preset: 'vibrant-trendy',
    },
  },
  {
    key: 'minimal-elegant',
    name: '极简素雅',
    description: '深灰主品牌色 + 思源黑体/思源宋体 + 标准密度',
    theme: {
      color: {
        primary: '#1A1A1A',
        secondary: '#6B7280',
        chartPalette: ['#1A1A1A', '#6B7280', '#9CA3AF', '#D1D5DB', '#374151', '#4B5563'],
        neutralText: '#1A1A1A',
        neutralBg: '#FAFAFA',
      },
      font: { text: 'noto-sans-sc', number: 'inter', heading: 'noto-serif-sc' },
      density: 'standard',
      radius: 'small',
      layout: { safeMargin: 56, gridSize: 10, showGrid: true, showSafeArea: true },
      preset: 'minimal-elegant',
    },
  },
];

/**
 * 旧形状兼容：早期 ProjectTheme 是 { primary?, secondary?, fontFamily? } 扁平结构。
 * normalizeTheme 接受任意形状（旧/新/空），输出标准化 ProjectTheme。
 */
export interface LegacyProjectTheme {
  primary?: string;
  secondary?: string;
  fontFamily?: string;
}

/** 按 key 查找 FontOption.stack；找不到时回退到默认 stack。 */
export function getFontStack(key: string | undefined, fallbackKey: string): string {
  if (key) {
    const opt = FONT_OPTIONS.find((f) => f.key === key);
    if (opt) return opt.stack;
  }
  const fb = FONT_OPTIONS.find((f) => f.key === fallbackKey);
  return fb?.stack ?? fallbackKey;
}

/**
 * 把任意形状（旧扁平 / 新结构化 / 空）归一为标准 ProjectTheme。
 * - 旧字段 primary→color.primary、secondary→color.secondary、fontFamily→font.text（按 stack 反查 key）
 * - 缺失字段用 DEFAULT_THEME 补齐
 * - 不抛错，容错所有边界
 */
export function normalizeTheme(raw: unknown): ProjectTheme {
  const d = DEFAULT_THEME;
  if (!raw || typeof raw !== 'object') return structuredCloneSafe(d);

  const obj = raw as Record<string, unknown>;

  // ---- 新结构：color / font / density / radius / preset ----
  const colorRaw = obj.color as Record<string, unknown> | undefined;
  const fontRaw = obj.font as Record<string, unknown> | undefined;

  // 旧扁平字段（向后兼容）
  const legacyPrimary = obj.primary as string | undefined;
  const legacySecondary = obj.secondary as string | undefined;
  const legacyFontFamily = obj.fontFamily as string | undefined;

  // 解析 font key：旧 fontFamily 是 CSS stack 值，需反查 key
  let textKey = d.font.text;
  if (fontRaw?.text && typeof fontRaw.text === 'string') {
    textKey = fontRaw.text;
  } else if (legacyFontFamily) {
    // 旧 fontFamily 是 stack，尝试反查；查不到就保留 stack 但存 'inter' 作 key
    const found = FONT_OPTIONS.find((f) => f.stack === legacyFontFamily || f.stack.includes(legacyFontFamily));
    textKey = found?.key ?? 'inter';
  }

  let numberKey = d.font.number;
  if (fontRaw?.number && typeof fontRaw.number === 'string') {
    numberKey = fontRaw.number;
  }

  let headingKey: string | undefined = d.font.heading;
  if (fontRaw && 'heading' in fontRaw) {
    headingKey = fontRaw.heading as string | undefined;
  }

  // 图表配色：6 色
  let chartPalette = [...d.color.chartPalette];
  if (Array.isArray(colorRaw?.chartPalette)) {
    chartPalette = (colorRaw!.chartPalette as unknown[]).filter((c): c is string => typeof c === 'string');
    while (chartPalette.length < 6) chartPalette.push(d.color.chartPalette[chartPalette.length % 6]);
    chartPalette = chartPalette.slice(0, 6);
  }

  const density = (obj.density as ThemeDensity) ?? d.density;
  const radius = (obj.radius as ThemeRadius) ?? d.radius;
  const preset = typeof obj.preset === 'string' ? obj.preset : obj.preset === undefined ? d.preset : undefined;

  // ---- 布局 layout：缺对象整体补默认；部分缺字段按字段补；非法值回退 ----
  const layoutRaw = obj.layout as Record<string, unknown> | undefined;
  const dLayout = d.layout!;
  const parseGridNum = (v: unknown, def: number, min: number): number => {
    const n = Number(v);
    return Number.isFinite(n) && n >= min ? Math.round(n) : def;
  };
  const layout = {
    safeMargin: parseGridNum(layoutRaw?.safeMargin, dLayout.safeMargin, 0),
    gridSize: parseGridNum(layoutRaw?.gridSize, dLayout.gridSize, 1),
    showGrid: typeof layoutRaw?.showGrid === 'boolean' ? layoutRaw.showGrid : dLayout.showGrid,
    showSafeArea: typeof layoutRaw?.showSafeArea === 'boolean' ? layoutRaw.showSafeArea : dLayout.showSafeArea,
  };

  return {
    color: {
      primary: (colorRaw?.primary as string) || legacyPrimary || d.color.primary,
      secondary: (colorRaw?.secondary as string) || legacySecondary || d.color.secondary,
      chartPalette,
      neutralText: (colorRaw?.neutralText as string) || d.color.neutralText,
      neutralBg: (colorRaw?.neutralBg as string) || d.color.neutralBg,
    },
    font: {
      text: textKey,
      number: numberKey,
      heading: headingKey,
    },
    density: ['compact', 'standard', 'spacious'].includes(density) ? density : d.density,
    radius: ['sharp', 'small', 'large'].includes(radius) ? radius : d.radius,
    preset,
    layout,
  };
}

/** structuredClone 容错（部分环境无此 API）。 */
function structuredCloneSafe<T>(v: T): T {
  if (typeof structuredClone === 'function') return structuredClone(v);
  return JSON.parse(JSON.stringify(v));
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
  /** 报告全局数据上下文（Campaign + 达人），「数据配置」面板编辑，随项目保存。 */
  reportData?: ReportDataContext;
}

/** 把 campaign 日期 '2026-10-12' 格式化为 '2026.10.12'；非法/空返回 ''。 */
export function formatCampaignDate(iso: string | undefined): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : '';
}

/** 结案周期：两端齐全 → '2026.10.12–2026.11.10'；否则回落 '结案报告'。 */
export function buildWrapUpPeriod(meta: ProjectMeta): string {
  const start = formatCampaignDate(meta.campaignInfo?.startDate);
  const end = formatCampaignDate(meta.campaignInfo?.endDate);
  return start && end ? `${start}–${end}` : '结案报告';
}

/**
 * 投放报告页默认标题。
 *   周报 → "{advertiser}'s MEDIA REPORT · 上周"
 *   月报 → "{advertiser}'s MEDIA REPORT · 上月"
 *   结案 → "{advertiser}'s MEDIA REPORT · {campaign 起止}"
 * 兜底：advertiser 空 → 'MEDIA REPORT'；无 scenarioSub → 不带周期。
 */
export function buildReportTitle(meta: ProjectMeta): string {
  const advertiser = meta.advertiser?.trim();
  const base = advertiser ? `${advertiser}'s MEDIA REPORT` : 'MEDIA REPORT';
  let period = '';
  if (meta.scenarioSub === 'weekly') period = '上周';
  else if (meta.scenarioSub === 'monthly') period = '上月';
  else if (meta.scenarioSub === 'wrap-up') period = buildWrapUpPeriod(meta);
  return period ? `${base} · ${period}` : base;
}

/* ------------------------------------------------------------------ */
/* 编辑器数据模型（M0 仅定义类型，编辑器内核在 M1 落地）                */
/* ------------------------------------------------------------------ */

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
  | 'image-group';

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
export type CreatorAvatarVariant = 'horizontal' | 'vertical' | 'compact' | 'badge' | 'banner';
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
export type CreatorStatsVariant = 'cards' | 'plain' | 'metric' | 'progress' | 'ring';

/** 达人数据条单项。key 命中指标库；selected 缺省视为 true（向后兼容）。 */
export interface CreatorStatItem {
  key?: string;
  label: string;
  value: string;
  color: string;
  selected?: boolean;
}

export interface CreatorStatsStripData {
  variant: CreatorStatsVariant;
  stats: CreatorStatItem[];
}

/** 常用达人指标库（属性面板勾选筛选用）。 */
export const CREATOR_METRIC_CATALOG: {
  key: string;
  label: string;
  color: string;
  placeholder: string;
}[] = [
  { key: 'followers', label: 'Followers', color: '#FF5C00', placeholder: '1.28M' },
  { key: 'engagement', label: 'Engagement Rate', color: '#3B82F6', placeholder: '8.7%' },
  { key: 'reach', label: 'Avg. Reach', color: '#22C55E', placeholder: '640K' },
  { key: 'impressions', label: 'Impressions', color: '#8B5CF6', placeholder: '12.6M' },
  { key: 'cpm', label: 'CPM', color: '#EC4899', placeholder: '¥120' },
  { key: 'cpe', label: 'CPE', color: '#14B8A6', placeholder: '¥3.2' },
  { key: 'completion', label: 'Completion Rate', color: '#F59E0B', placeholder: '42%' },
  { key: 'growth', label: 'Follower Growth', color: '#6366F1', placeholder: '+38K' },
];

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
export type StrategyBlockVariant = 'default' | 'labeled' | 'bulleted';

export interface StrategyBlockData {
  /** 样式变体；缺省 'default'（平铺）。labeled=卡片标签，bulleted=卡片列表。 */
  variant?: StrategyBlockVariant;
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
export type ProductPerformanceVariant = 'cards' | 'rank' | 'grid' | 'bar';
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

/* ---- 业务组件（试点：业绩·商品域，作品证据 / 口碑展示）Data ---- */

export interface WorkScreenshotItem {
  src: string;
  caption?: string;
}

/** 作品截图墙。variant 控制组图版式；缺省 'grid'。 */
export interface WorkScreenshotData {
  variant?: 'grid' | 'masonry' | 'hero' | 'skew';
  title?: string;
  images: WorkScreenshotItem[];
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
  | ImageGroupData;

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

/** 渐变色标：颜色（HEX）+ 位置（百分比 0–100）。 */
export interface GradientStop {
  color: string;
  position: number;
}

/** 页面背景渐变：线性 / 径向，2–6 色标；线性带角度。 */
export interface PageGradient {
  type: 'linear' | 'radial';
  angle?: number;
  stops: GradientStop[];
}

/** 页面类型；命中 'media-report' 触发默认标题规则。 */
export type PageType = 'media-report';

export interface Page {
  id: string;
  name: string;
  components: EditorComponent[];
  /** 页面背景色（HEX）；与 bgImage 二选一，未设时画布默认白。 */
  bgColor?: string;
  /** 页面背景渐变；优先级在 bgImage 之下、bgColor 之上。 */
  bgGradient?: PageGradient;
  /** 页面背景图 URL（cover 铺满）；优先于 bgColor。 */
  bgImage?: string;
  /** 页面类型；命中 'media-report' 触发默认标题规则。 */
  pageType?: PageType;
  /** 作为「页面标题」的 text 组件 id（pageType='media-report' 时由标题逻辑维护）。 */
  titleComponentId?: string;
  /** 用户曾手改标题 → 停止自动跟随 meta。 */
  titleOverridden?: boolean;
}

function clampNum(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function validHex(c: unknown): string {
  return typeof c === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c) ? c : '#FFFFFF';
}

/**
 * 把 PageGradient 对象转成 CSS 渐变字符串。防御式归一（渲染层最后一道防线）：
 * - position clamp 到 0–100 并按升序排序；
 * - 色标少于 2 → 补齐到 2；多于 6 → 截断到 6；
 * - 非法颜色回退 #FFFFFF；
 * - angle 缺省 180、clamp 到 0–360；type 非 radial 一律按 linear。
 * 输入为空 / 异常时不抛错，返回纯白线性渐变。
 */
export function gradientToCss(g: unknown): string {
  const raw = (g && typeof g === 'object' ? g : {}) as Partial<PageGradient>;
  const type: 'linear' | 'radial' = raw.type === 'radial' ? 'radial' : 'linear';

  let stops = (Array.isArray(raw.stops) ? raw.stops : [])
    .filter((s): s is GradientStop => !!s && typeof s === 'object')
    .map((s) => ({
      color: validHex(s.color),
      position: clampNum(Math.round(Number(s.position) || 0), 0, 100),
    }))
    .sort((a, b) => a.position - b.position);

  if (stops.length === 0) {
    stops = [
      { color: '#FFFFFF', position: 0 },
      { color: '#FFFFFF', position: 100 },
    ];
  } else if (stops.length === 1) {
    const c = stops[0].color;
    stops = [
      { color: c, position: 0 },
      { color: c, position: 100 },
    ];
  }
  if (stops.length > 6) stops = stops.slice(0, 6);

  const stopStr = stops.map((s) => `${s.color} ${s.position}%`).join(', ');
  if (type === 'radial') return `radial-gradient(circle at center, ${stopStr})`;
  const angle = clampNum(Math.round(Number(raw.angle ?? 180)), 0, 360);
  return `linear-gradient(${angle}deg, ${stopStr})`;
}
