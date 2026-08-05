/**
 * AI HTML 报告预设 — 共享模块（消除 HtmlStudio / GenerateHtmlReportOverlay 双份冗余）。
 *
 * 架构四层：
 *   L1 SYSTEM_PROMPT  (后端 ai-generate.service.ts，全局技术栈+CSS骨架)
 *   L2 design.md       (DB BusinessLine.designMd，品牌配色/字体/CSS变量)
 *   L3 report-presets  (本文件，报告 section 结构 + 图表 + 布局)
 *   L4 Campaign Data   (DB campaign+creator+analytics)
 *
 * 本文件是 L3。所有预设 BL 无关：配色/字体/品牌名由 design.md 提供。
 */

/** 单个提示词模板的结构。 */
export interface ReportPreset {
  /** 模板名称（显示在模板卡片上）。 */
  label: string;
  /** 一句话描述（显示在模板卡片下方，帮助用户理解适用场景）。 */
  description: string;
  /** 提示词正文（design.md 由后端自动注入为变量，此处不重复配色/字体）。 */
  requirement: string;
  /** 适用报告类型（用于 UI 分组或过滤）。 */
  reportType: 'campaign' | 'settlement' | 'comparison' | 'creator';
  /** 适用 BL（空数组 = 全 BL 通用）。 */
  businessLines?: string[];
  /** @deprecated 旧字段，保留向后兼容。设计规范现在由 design.md 自动注入。 */
  designSpec?: string;
}

export const REPORT_PRESETS: ReportPreset[] = [
  {
    label: '投放结案',
    description: 'B2B 营销活动标准 6 section 结案：KPI 总览 + 趋势图 + 渠道明细 + 洞察分析',
    reportType: 'campaign',
    requirement: `生成一份 B2B 营销活动投放结案报告，SaaS 仪表盘风格，max-width 1280px，6 个 section：

§1 Header — flex row：左（商家 Logo：圆角字母缩写+品牌名 | 分割线 | 品牌方 Logo），右（灰色浅底色日期标签）
§2 KPI Overview — grid-cols-2 lg:grid-cols-5，5 个卡片：Total Revenue / Clicks / Orders / New Customers(数字用品牌色) / AOV。数字用品牌指定字体 32px bold
§3 Performance Trend — 300px canvas 混合图表：Revenue（品牌色实线 tension:0.4 左轴）+ Clicks（深色虚线 右轴）+ Orders（品牌色半透明柱状 右轴），双 Y 轴
§4 Publisher Performance — 可横向滚动的表格，列：Publisher(首字母圆圈头像+名) | Type(.tag标签) | Screenshot(占位图) | Sales(右对齐加大加粗) | Clicks | CVR | Action(外链图标)
§5 Insight & Analysis — grid-cols-1 lg:grid-cols-3：(1)Top Categories 环形图+HTML图例 (2)Top Products 无表头表格 (3)Top Market 进度条（品牌色/灰色相间）(4)Top Offers 表格 col-span-2 (5)New Customer Rate 环形图（中心绝对定位百分比）
§6 Actionable Insights — grid-cols-1 lg:grid-cols-5，5 个卡片各带 3px 顶部彩边（绿/橙/蓝/紫/红），含图标+列表+底部灰色总结，等高 flex-col+mt-auto`,
  },
  {
    label: '达人复盘',
    description: '聚焦 ROI 和内容效果：达人排行榜 + ROI 对比 + 平台维度 + 内容墙',
    reportType: 'creator',
    requirement: `生成一份达人投放复盘报告，聚焦 ROI 和内容效果，max-width 1280px，5 个 section：

§1 Header — flex row：左（品牌 Logo + Campaign 名称），右（日期标签）
§2 Creator Leaderboard — grid-cols-1 lg:grid-cols-3，3 个卡片展示 Top 3 达人：头像+名+Tier 标签+核心指标（Revenue/ROAS/Engagement Rate），指标数字用品牌色大字
§3 ROI Comparison — 300px canvas 水平柱状图：各达人的 Revenue vs Spend 对比，品牌色=Revenue，灰色=Spend，按 ROI 降序排列
§4 Platform Performance — 表格：Platform | Creators 数 | Impressions | Engagement | Orders | Revenue | ROAS，hover 高亮行
§5 Content Wall — grid-cols-2 lg:grid-cols-4：4 张内容截图（9:16 手机比例占位图），下方叠加达人名+播放量/点赞数`,
  },
  {
    label: '效果对比',
    description: '多平台/达人横向对比：KPI 对比卡 + 趋势对比图 + 绩效矩阵',
    reportType: 'comparison',
    requirement: `生成一份效果对比报告，将不同平台/达人的关键指标横向对比，max-width 1280px，4 个 section：

§1 Header — flex row：品牌 Logo + 报告标题，右（日期范围标签）
§2 KPI Comparison — grid-cols-2 lg:grid-cols-4：4 张大卡片对比 A vs B（如 Platform A vs Platform B），每张含 3 个核心指标（Revenue/Orders/CVR），差异用绿/红色箭头标注
§3 Trend Comparison — 300px canvas 多折线图：2-3 条线代表不同对比对象，各用不同颜色，共享 X 轴日期，双 Y 轴（左=Revenue 右=Orders）
§4 Performance Matrix — 表格：行=各对比对象，列=6 项指标（Revenue/Clicks/Orders/CVR/AOV/ROAS），最佳值绿色高亮，最差值灰色`,
  },
  {
    label: '业务复盘看板',
    description: '结算台账风格：KPI 总览 + 季度对比 + 月度明细 + 佣金预估 + 运营动作',
    reportType: 'settlement',
    requirement: `生成一份业务结算复盘看板，结算台账风格，max-width 1280px，5 个 section：

§1 Hero 总览 — 大号 KPI 数字（58px），含 YOY 同比标签 + 完成率印章（圆形百分比）。指标：总收入/结算毛利/毛利率/活跃商家数
§2 季度对比 — grid-cols-2：Q1 vs Q2 卡片，每张含季度收入柱状图 + 环比变化标签
§3 按月分析 — 12 行月度明细表：月份 | 收入 | 成本 | 毛利 | 毛利率 | 完成率。数字列右对齐，表格底部汇总行加粗
§4 佣金预估 — grid-cols-1 lg:grid-cols-2：左侧品类佣金饼图，右侧佣金明细表（品类 | GMV | 佣金率 | 预估佣金）
§5 运营动作 — 编号列表（01-05）：下阶段重点运营动作，每项含标题+描述+负责人 Tag。每个 section 顶部含序号 + 大标题`,
  },
];

// ── Section 模板片段库（用于 per-BL 定制时拼装） ──────────────────────

/** 可复用的 section 结构片段，BL 可按需组合。 */
export const SECTION_LIBRARY = {
  header: `§ Header — flex row：左（商家 Logo：圆角字母缩写+品牌名 | 分割线 | 品牌方 Logo），右（灰色浅底色日期标签）`,
  kpiOverview5: `§ KPI Overview — grid-cols-2 lg:grid-cols-5，5 个卡片：Total Revenue / Clicks / Orders / New Customers(品牌色) / AOV。数字用品牌指定字体 32px bold`,
  perfTrendMixed: `§ Performance Trend — 300px canvas 混合图表：Revenue（品牌色实线 tension:0.4 左轴）+ Clicks（深色虚线 右轴）+ Orders（品牌色半透明柱状 右轴），双 Y 轴`,
  publisherTable: `§ Publisher Performance — 可横向滚动的表格，列：Publisher(首字母圆圈头像+名) | Type(.tag标签) | Screenshot(占位图) | Sales(右对齐加大加粗) | Clicks | CVR | Action(外链图标)`,
  insightAnalysis3col: `§ Insight & Analysis — grid-cols-1 lg:grid-cols-3：(1)Top Categories 环形图+HTML图例 (2)Top Products 无表头表格 (3)Top Market 进度条（品牌色/灰色相间）(4)Top Offers 表格 col-span-2 (5)New Customer Rate 环形图（中心绝对定位百分比）`,
  actionableInsights5: `§ Actionable Insights — grid-cols-1 lg:grid-cols-5，5 个卡片各带 3px 顶部彩边（绿/橙/蓝/紫/红），含图标+列表+底部灰色总结，等高 flex-col+mt-auto`,
  settlementHero: `§ Hero 总览 — 大号 KPI 数字（58px），含 YOY 同比标签 + 完成率印章（圆形百分比）。指标：总收入/结算毛利/毛利率/活跃商家数`,
  quarterlyCompare: `§ 季度对比 — grid-cols-2：Q1 vs Q2 卡片，每张含季度收入柱状图 + 环比变化标签`,
  monthlyBreakdown: `§ 按月分析 — 12 行月度明细表：月份 | 收入 | 成本 | 毛利 | 毛利率 | 完成率。数字列右对齐，表格底部汇总行加粗`,
  commissionPreview: `§ 佣金预估 — grid-cols-1 lg:grid-cols-2：左侧品类佣金饼图，右侧佣金明细表（品类 | GMV | 佣金率 | 预估佣金）`,
  operationsActions: `§ 运营动作 — 编号列表（01-05）：下阶段重点运营动作，每项含标题+描述+负责人 Tag`,
} as const;

// ── per-BL 预设覆写 ──────────────────────────────────────────────────

/**
 * per-BL 自定义预设。键为 BL code，值为该 BL 独有的预设数组。
 * 未列出的 BL 使用 REPORT_PRESETS 默认值。
 *
 * designSpec 全部留空 — 配色/字体/组件样式完全由 design.md 控制。
 * requirement 定义该 BL 专属的 §1~§N section 结构。
 */

// DG (Digchic) — 美妆营销，SaaS 仪表盘风格，6 section 黄金标准
const DG_PRESETS: ReportPreset[] = [
  {
    label: '投放结案',
    description: '美妆行业结案：KPI 五卡 + 趋势混合图 + Publisher 表 + 洞察 3 列 + 5 卡建议',
    reportType: 'campaign',
    requirement: `生成一份 B2B 美妆营销活动投放结案报告，SaaS 仪表盘风格，max-width 1280px，6 个 section：

§1 Header — flex row 垂直居中：左（商家 Logo：圆角字母缩写+品牌名 | 分割线 | 品牌方 Logo），右（灰色浅底色日期标签 "活动期间"）
§2 KPI Overview — grid-cols-2 lg:grid-cols-5，5 个卡片：Total Revenue / Clicks / Orders / New Customer Acquisition（品牌色高亮）/ AOV。数字用品牌指定字体 32px bold
§3 Performance Trend — 300px canvas 混合图表：Revenue（品牌色实线 tension:0.4 左轴）+ Clicks（深色虚线 右轴）+ Orders（品牌色半透明柱状 右轴），双 Y 轴
§4 Publisher Performance — 可横向滚动的表格，列：Publisher(首字母圆圈头像+名) | Type(.tag标签) | Screenshot(占位图) | Sales(右对齐加大加粗) | Clicks | CVR | Action(外链图标)
§5 Insight & Analysis — grid-cols-1 lg:grid-cols-3：(1)Top Categories 环形图+HTML图例 (2)Top Products 无表头表格 (3)Top Market 进度条（品牌色/灰色相间）(4)Top Offers 表格 col-span-2 (5)New Customer Rate 环形图（中心绝对定位百分比+绿色环比标签）
§6 Actionable Insights — grid-cols-1 lg:grid-cols-5，5 个卡片各带 3px 顶部彩边（绿/橙/蓝/紫/红），含图标+列表+底部灰色总结，等高 flex-col+mt-auto`,
  },
];

// DM (Duomai) — AI 绩效营销基础设施，数据驱动企业风格
const DM_PRESETS: ReportPreset[] = [
  {
    label: '投放结案',
    description: '企业级数据仪表盘：4 核心 KPI + 趋势混合图 + 渠道明细表 + 洞察 + 4 卡建议',
    reportType: 'campaign',
    requirement: `生成一份 B2B 绩效营销活动投放结案报告，企业级数据仪表盘风格，max-width 1280px，6 个 section：

§1 Header — flex row 垂直居中：左（Duomai 业务线 Logo | 分割线 | 广告主 Logo），右（活动日期范围+状态标签）。整体紧凑专业
§2 KPI Overview — grid-cols-2 lg:grid-cols-4，4 个核心卡片：Total Revenue / Total Conversions / ROAS / New Customers。每个卡片含大号数字（品牌色）+ 环比箭头标签 + 迷你 sparkline 占位
§3 Performance Trend — 300px canvas 混合图表：Revenue（品牌色面积图 fill:true 左轴）+ Conversions（品牌色实线 左轴）+ Clicks（灰色虚线 右轴），双 Y 轴，底部 X 轴显示日期
§4 Channel Performance — 表格：行=各渠道/平台，列：Channel(平台图标+名) | Spend | Revenue | Conversions | CVR | CPA | ROAS。最佳 ROAS 绿色高亮。表格支持横向滚动
§5 Insight & Analysis — grid-cols-1 lg:grid-cols-3：(1)Top Products 水平柱状图（品牌色渐变） (2)Geo Distribution 世界地图占位+Top 5 国家表格 (3)Customer Segments 环形图（New vs Returning）+ Funnel 转化漏斗
§6 Actionable Insights — grid-cols-1 lg:grid-cols-4，4 个卡片（带左侧品牌色竖线）：Scale Winners / Optimize CVR / Expand Reach / Monitor Budget。每个含编号标题+关键发现+建议动作`,
  },
];

// FT (Feitian) — 结算复盘，深色台账风格
const FT_PRESETS: ReportPreset[] = [
  {
    label: '业务复盘看板',
    description: '半年结算复盘：KPI 总览 + 季度对比 + 月度明细表 + 佣金预估 + 运营动作',
    reportType: 'settlement',
    requirement: `生成一份业务结算复盘看板，结算台账风格，max-width 1280px，5 个 section：

§1 Hero 总览 — 大号 KPI 数字（58px），含 YOY 同比标签 + 完成率印章（圆形百分比）。指标：总收入/结算毛利/毛利率/活跃商家数
§2 季度对比 — grid-cols-2：Q1 vs Q2 卡片，每张含季度收入柱状图 + 环比变化标签
§3 按月分析 — 12 行月度明细表：月份 | 收入 | 成本 | 毛利 | 毛利率 | 完成率。数字列右对齐，表格底部汇总行加粗
§4 佣金预估 — grid-cols-1 lg:grid-cols-2：左侧品类佣金饼图，右侧佣金明细表（品类 | GMV | 佣金率 | 预估佣金）
§5 运营动作 — 编号列表（01-05）：下阶段重点运营动作，每项含标题+描述+负责人 Tag。每个 section 顶部含序号 + 大标题`,
  },
];

// ── AI 智能排版（全 BL 通用的自主决策预设） ──────────────────────────

/**
 * 不预设固定 section 结构。AI 自行分析 campaign 数据后决定：
 * - 展示哪些数据维度（取决于数据是否丰富）
 * - 用什么可视化形式（趋势用折线/面积图、占比用环形图、排名用柱状图/表格）
 * - module 编排顺序和数量
 */
const AI_AUTO_PRESET: ReportPreset = {
  label: '🤖 AI 智能排版',
  description: 'AI 自主决策：根据 Campaign 数据的实际维度和质量，自主选择 module 和可视化形式',
  reportType: 'campaign',
  requirement: `采用自主决策模式：不预设固定 section 结构，由 AI 根据 campaign 数据的实际维度和质量，自主选择 4-8 个最有价值的 module 和最佳可视化形式。
通用报告结构规则（Header/KPI/图表选型/Footer 等）已内置于系统提示词，无需在此重复——只需补充以下差异化偏好：
- 重点关注的指标或维度（如需突出某个数据视角）
- 特殊的视觉风格偏好（如需偏离 design.md 的默认风格）`,
};

export const BL_PRESET_OVERRIDES: Record<string, ReportPreset[]> = {
  DG: DG_PRESETS,
  DM: DM_PRESETS,
  FT: FT_PRESETS,
};

/**
 * 获取指定 BL 的可用预设列表。
 * 每个返回列表首位都是「AI 智能排版」（全 BL 通用），
 * 后跟 BL 专属预设（如有）或默认 REPORT_PRESETS。
 */
export function getPresetsForBL(businessLine?: string): ReportPreset[] {
  const blPresets = businessLine && BL_PRESET_OVERRIDES[businessLine]
    ? BL_PRESET_OVERRIDES[businessLine]
    : REPORT_PRESETS;
  return [AI_AUTO_PRESET, ...blPresets];
}
