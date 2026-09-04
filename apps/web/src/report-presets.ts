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

// FT (Fanstoshop) — 结算复盘 + 增长提案 + 年度绩效
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
  {
    label: '增长提案（Growth Proposal）',
    description: '面向广告主的季度增长提案 deck：上期绩效 → 机会点 → 达人推荐 → 玩法 → 报价套餐',
    reportType: 'campaign',
    requirement: `生成一份面向广告主的季度增长提案（Growth Proposal deck 风格，低饱和玫瑰调），配合「选用整套模板」中的「FT Campaign Growth Proposal（增长提案）」使用，12 个 section 按提案叙事推进：

§1 Cover — 客户品牌名 + 提案标题 + 日期，超大衬线标题
§2 Agenda — 编号目录
§3 Performance Overview — 上一周期核心指标巨型数字 + 环比标签
§4 Campaign Detail — 分活动明细表（周期/渠道/花费/结果）
§5 Opportunity — 本季机会点论述（要点+数据支撑）
§6 Influencer Analysis — 达人分层占比 + 代表达人
§7 Recommended Talent — 推荐达人名单（≤6 人卡片网格，含粉丝量级与推荐理由）
§8 Activation Strategy — 合作玩法矩阵（内容形式 × 平台）
§9 Learnings — what worked / what to improve
§10 Packages — 三档报价卡片（中档高亮 Most Popular）
§11 Next Steps — 时间线
§12 Thank You — 极简致谢`,
  },
  {
    label: '年度绩效报告（Annual Report）',
    description: '面向广告主的年度绩效 deck：趋势 KPI → 明细 → 达人占比 → 套餐对比 → 资源位展示',
    reportType: 'campaign',
    requirement: `生成一份面向广告主的年度绩效报告 deck（DM Sans 巨型标题 + 品牌粉/黄高亮），配合「选用整套模板」中的「FT Performance Report（年度绩效报告）」使用，11 个 section：

§1 Cover — FANSTOSHOP + 报告标题 + 年份，巨型字
§2 Contents — 9 项编号目录
§3 Yearly Trend — 年度趋势：DAU/GMV 巨型数字（100K+ 量级）+ 月度趋势图
§4 Detail Tables — 分阶段明细双表并列
§5 Influencer Share — 达人占比分析
§6 Q3 vs Q4 Packages — 季度套餐对比双卡片（CPA %+金额大数字）
§7 Competitor Review — 竞品投放复盘
§8 Campaign Recap — 主题营销活动复盘（活动×周期表）
§9 APP Exposure — APP 端资源位（Rotation Banner / What's New / Essentials）
§10 Hub & Social Groups — 流量枢纽与社群
§11 Seasonal Campaign — 季节活动预告（大标题+月份+活动卡片）`,
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
  requirement: '',
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
