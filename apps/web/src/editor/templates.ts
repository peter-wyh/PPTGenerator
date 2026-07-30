import type { ComponentType, EditorComponent, PageType, Scenario } from '@mediakit/shared';
import { getDefaultData } from './defaults';

/**
 * Page template catalog (M3 lite: composed of basic components).
 * Full business templates (cover/funnel/...) depend on business components, deferred to M4.
 * Component ids are placeholders; addPageWithComponents reassigns them.
 */
export interface Template {
  id: string;
  name: string;
  description: string;
  components: () => EditorComponent[];
  /** 标题组件在 components() 返回数组中的下标；命中则应用时该页为投放报告页（media-report）。 */
  pageTitleIndex?: number;
  /** 创建页面时自动设置的页面业务类型（与 pageTitleIndex 互斥时优先 pageTitleIndex）。 */
  pageType?: PageType;
  /**
   * 标记该模板适用的业务线（FT/SM/CX/DG/KN/DM）。
   * 业务线专属模板通过 createBusinessLineTemplates() 生成。
   * getTemplateByPageType 会优先匹配带有此字段的模板。
   */
  businessLine?: string;
  /**
   * 标记该模版适用的项目场景。
   * 缺省 = 所有场景可见（向后兼容）；仅当数组包含当前项目场景时，模版在选择器中可见。
   */
  scenario?: Scenario[];
}

/** Get a page template by id. */
export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/**
 * Get a page template by PageType.
 *
 * When `businessLine` is provided, first attempts to match a template that has
 * the matching `pageType` **and** `businessLine`. If none is found, falls back
 * to the first template matching only `pageType` (preserving backward compat).
 */
export function getTemplateByPageType(pageType: PageType, businessLine?: string): Template | undefined {
  if (businessLine) {
    const blMatch = TEMPLATES.find((tpl) => tpl.pageType === pageType && tpl.businessLine === businessLine);
    if (blMatch) return blMatch;
  }
  return TEMPLATES.find((tpl) => tpl.pageType === pageType);
}

/**
 * 「+ 页面」浮层点选通用模板后，按当前项目业务线解析出实际应套用的模板：
 * 存在同 pageType 的业务线变体则用变体，否则回退原通用模板。
 * 与 setPageType 内 `getTemplateByPageType(pageType, businessLine)` 行为对齐——
 * 让两条新建页面路径（浮层 / 属性面板改类型）对业务线变体的取舍一致。
 */
export function resolveTemplateForBusinessLine(tpl: Template, businessLine?: string): Template {
  if (tpl.pageType && businessLine) {
    const bl = getTemplateByPageType(tpl.pageType, businessLine);
    if (bl && bl.businessLine === businessLine) return bl;
  }
  return tpl;
}

/** Page template categories (grouped in the "New Page" dialog). Order = display order. */
export const TEMPLATE_CATEGORIES: { category: string; ids: string[] }[] = [
  { category: '基础', ids: ['blank', 'title', 'overview', 'table'] },
  {
    category: '投放报告',
    ids: [
      'report-weekly-overview',
      'report-monthly-overview',
      'report-single-page',
      'report-single-page-classic',
      'report-single-page-dashboard',
      'report-single-page-narrative',
      'report-channel',
      'report-product',
      'report-creator-collab',
      'report-placement',
      'report-posts',
      'report-wrapup-review',
    ],
  },
  {
    category: '公司 · 品牌',
    ids: ['cover-page', 'agenda-page', 'company-page', 'package-page', 'milestone-page', 'global-page', 'org-page', 'service-page'],
  },
  { category: '达人 · 案例', ids: ['creator-page', 'case-page'] },
  {
    category: '策略 · 内容',
    ids: ['challenge-page', 'process-page', 'calendar-page', 'campaign-plan-page', 'content-analysis-page', 'funnel-page'],
  },
  { category: '媒介包', ids: ['audience-portrait', 'account-overview', 'brand-collab'] },
];

/**
 * 按项目场景过滤模版分类（「+ 页面」浮层用）：
 * - tpl.scenario 缺省 → 全场景可见；
 * - 否则仅当 scenario 包含当前场景时保留该模版；
 * - 过滤后为空的分类被丢弃；
 * - scenario 为 undefined（旧项目 / 未设场景）→ 返回全部（向后兼容）。
 */
export function filterCategoriesByScenario(
  scenario?: Scenario,
): { category: string; ids: string[] }[] {
  if (!scenario) return TEMPLATE_CATEGORIES;
  return TEMPLATE_CATEGORIES.map((cat) => ({
    category: cat.category,
    ids: cat.ids.filter((id) => {
      const tpl = getTemplate(id);
      return !tpl?.scenario || tpl.scenario.includes(scenario);
    }),
  })).filter((cat) => cat.ids.length > 0);
}

/* ----------------------------- Scenario templates (layer ④) ----------------------------- */
// Compose multiple page templates into a full report (one-click multi-page).
// References page template ids from TEMPLATES.

export interface ScenarioPage {
  /** Page name (shown in sidebar). */
  name: string;
  /** Referenced page template id (see TEMPLATES). */
  templateId: string;
}

export interface ScenarioTemplate {
  id: string;
  name: string;
  description: string;
  pages: ScenarioPage[];
}

export const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  {
    id: 'biweekly',
    name: 'Campaign Biweekly Report',
    description: '8 pages · Performance + Channels + Placements + Creators + Packages',
    pages: [
      { name: 'Cover', templateId: 'cover-page' },
      { name: 'Performance Overview', templateId: 'report-monthly-overview' },
      { name: 'Channel Breakdown', templateId: 'report-channel' },
      { name: '渠道贴文', templateId: 'report-posts' },
      { name: 'DM Placements', templateId: 'report-placement' },
      { name: 'Partner Creators', templateId: 'creator-page' },
      { name: 'Packages', templateId: 'package-page' },
      { name: 'Back Cover', templateId: 'cover-page' },
    ],
  },
  {
    id: 'monthly',
    name: 'Campaign Monthly Report',
    description: '14 pages · Section dividers + Performance/Product/Channel/Creator/Placement/Package',
    pages: [
      { name: "Editor's Note (not exported)", templateId: 'blank' },
      { name: 'Cover', templateId: 'cover-page' },
      { name: 'PART 1 · Performance', templateId: 'title' },
      { name: 'Performance Overview', templateId: 'report-monthly-overview' },
      { name: '商品表现', templateId: 'report-product' },
      { name: 'Channel Performance', templateId: 'report-channel' },
      { name: 'Top Creator Collaboration', templateId: 'report-creator-collab' },
      { name: '渠道贴文', templateId: 'report-posts' },
      { name: 'DM Placements', templateId: 'report-placement' },
      { name: 'PART 2 · Optimization', templateId: 'title' },
      { name: 'Packages', templateId: 'package-page' },
      { name: 'Recommended Creators', templateId: 'creator-page' },
      { name: 'Creator Details', templateId: 'creator-page' },
      { name: 'Back Cover', templateId: 'cover-page' },
    ],
  },
];

function t(type: ComponentType, x: number, y: number, w: number, h: number): EditorComponent {
  return { id: `tpl-${type}-${x}-${y}`, type, x, y, w, h, data: getDefaultData(type) };
}

/** Page title text block (large, bold). */
function titleAt(content: string, x: number, y: number, w = 1120, h = 50): EditorComponent {
  const title = t('text', x, y, w, h);
  const data = title.data as { content: string; fontSize: number; fontWeight: number };
  data.content = content;
  data.fontSize = 28;
  data.fontWeight = 700;
  return title;
}

/** Table body block (sets headers/rows). */
function tableAt(x: number, y: number, w: number, h: number, headers: string[], rows: string[][]): EditorComponent {
  const tbl = t('table', x, y, w, h);
  const data = tbl.data as { headers: string[]; rows: string[][] };
  data.headers = headers;
  data.rows = rows;
  return tbl;
}

/** Text block (sets content/fontSize). */
function textAt(x: number, y: number, w: number, h: number, content: string, fontSize = 16): EditorComponent {
  const tx = t('text', x, y, w, h);
  const data = tx.data as { content: string; fontSize: number };
  data.content = content;
  data.fontSize = fontSize;
  return tx;
}

/**
 * Title + table (+ optional intro) page skeleton — legacy full-page layouts
 * (milestones / org chart / service matrix …) migrated to the generic
 * "page-template-orchestrates-common-components" form.
 */
function tablePage(
  title: string,
  headers: string[],
  rows: string[][],
  intro?: string,
): EditorComponent[] {
  return [titleAt(title, 80, 50), tableAt(80, 130, 1120, intro ? 380 : 540, headers, rows), ...(intro ? [textAt(80, 540, 1120, 80, intro)] : [])];
}

export const TEMPLATES: Template[] = [
  {
    id: 'blank',
    name: '空白页',
    description: '从零开始',
    pageType: 'blank',
    components: () => [],
  },
  {
    id: 'title',
    name: '标题页',
    description: '大标题 + 副标题',
    pageType: 'title',
    components: () => {
      const title = t('text', 80, 180, 900, 160);
      (title.data as { content: string; fontSize: number; fontWeight: number }).content = '报告标题';
      (title.data as { fontSize: number }).fontSize = 48;
      (title.data as { fontWeight: number }).fontWeight = 700;
      const sub = t('text', 80, 360, 900, 60);
      (sub.data as { content: string; fontSize: number }).content = '副标题 / 摘要';
      (sub.data as { fontSize: number }).fontSize = 20;
      return [title, sub];
    },
  },
  {
    id: 'overview',
    name: '数据概览',
    description: '指标卡片 + 柱状图',
    pageType: 'overview',
    components: () => {
      const cards = [0, 1, 2].map((i) => {
        const c = t('indicator-card', 80 + i * 380, 80, 360, 110);
        (c.data as { title: string; value: string }).title = `指标 ${i + 1}`;
        (c.data as { value: string }).value = '---';
        return c;
      });
      const chart = t('bar-chart', 80, 240, 1120, 380);
      return [...cards, chart];
    },
  },
  {
    id: 'table',
    name: '表格页',
    description: '数据表格',
    pageType: 'table',
    components: () => {
      const tbl = t('table', 80, 100, 1120, 520);
      return [tbl];
    },
  },

  /* -------- 投放报告模板：业务页面库中置于最前方（基础模板之后、其他分类之前） -------- */

  {
    id: 'report-weekly-overview',
    name: '周报 · 业绩概览',
    description: 'KPI 看板 + 下周计划',
    pageType: 'report-weekly-overview',
    scenario: ['campaign-report'],
    components: () => {
      const title = titleAt('周报 · 业绩概览', 80, 50);
      const kpi = t('kpi-board', 80, 130, 1120, 200);
      (kpi.data as { variant: string }).variant = 'grid';
      (kpi.data as { headers: string[] }).headers = ['指标', '本周', '环比'];
      (kpi.data as { rows: string[][] }).rows = [
        ['GMV', '$32,500', '+12.3%'],
        ['Spend', '$8,200', '-3.1%'],
        ['ROAS', '3.96x', '+0.4x'],
        ['订单', '1,240', '+8.7%'],
      ];
      const plan = t('text', 80, 360, 1120, 280);
      (plan.data as { content: string; fontSize: number }).content =
        '下周计划：\n1. 扩大 Top 3 达人投放预算 +20%\n2. 新增 5 位 Micro 达人合作\n3. 优化广告位素材 A/B Test';
      (plan.data as { fontSize: number }).fontSize = 16;
      return [title, kpi, plan];
    },
  },
  {
    id: 'report-monthly-overview',
    name: '月报 · 业绩概览',
    description: 'KPI + 趋势图 + 周期对比 + 洞察',
    pageType: 'report-monthly-overview',
    scenario: ['campaign-report'],
    components: () => {
      const title = titleAt('月报 · 业绩概览', 80, 40);
      const kpi = t('kpi-board', 80, 110, 1120, 170);
      (kpi.data as { headers: string[] }).headers = ['指标', '本月', '环比'];
      (kpi.data as { rows: string[][] }).rows = [
        ['GMV', '$128,500', '+18.2%'],
        ['Spend', '$32,400', '+5.1%'],
        ['ROAS', '3.97x', '+0.6x'],
        ['新客占比', '62%', '+4pp'],
      ];
      const chart = t('bar-chart', 80, 300, 640, 240);
      (chart.data as { title: string }).title = '周度 GMV';
      (chart.data as { bars: { label: string; value: number; color: string }[] }).bars = [
        { label: 'W1', value: 28500, color: 'auto' },
        { label: 'W2', value: 31200, color: 'auto' },
        { label: 'W3', value: 34800, color: 'auto' },
        { label: 'W4', value: 34000, color: 'auto' },
      ];
      const timeline = t('timeline-compare', 760, 300, 440, 240);
      (timeline.data as { headers: string[] }).headers = ['指标', '本月', '上月', '变化'];
      (timeline.data as { rows: string[][] }).rows = [
        ['GMV', '$128.5K', '$108.7K', '↗+18%'],
        ['Spend', '$32.4K', '$30.8K', '↗+5%'],
        ['ROAS', '3.97x', '3.53x', '↗+0.4x'],
        ['新客', '7,950', '6,820', '↗+17%'],
      ];
      const insight = t('text', 80, 560, 1120, 80);
      (insight.data as { content: string }).content =
        '本月 Campaign 整体表现优于上月，GMV 增长 18%，主要驱动因素：达人内容质量提升 + 广告位优化。建议下月持续扩大 Micro 达人矩阵。';
      return [title, kpi, chart, timeline, insight];
    },
  },
  {
    id: 'report-channel',
    name: '月报 · 渠道表现',
    description: '渠道核心数据 + 对比表格',
    pageType: 'report-channel',
    scenario: ['campaign-report'],
    components: () => {
      const title = titleAt('渠道表现', 80, 40);
      // Channel big numbers: reuse kpi-board (compact) to carry Engaged Publishers / Est Impression etc.
      const channelKpi = t('kpi-board', 80, 110, 1120, 90);
      (channelKpi.data as { variant: string }).variant = 'compact';
      (channelKpi.data as { headers: string[] }).headers = ['指标', '数值', '环比'];
      (channelKpi.data as { rows: string[][] }).rows = [
        ['活跃渠道', '8', '+2'],
        ['合作发布者', '45', '+12'],
        ['总曝光', '2.3M', '+25%'],
        ['互动率', '4.8%', '+0.6pp'],
      ];
      const table = t('table', 80, 230, 1120, 320);
      (table.data as { headers: string[] }).headers = ['渠道', '销量', '点击', 'CVR', '发布者数', 'GMV', 'ROAS'];
      (table.data as { rows: string[][] }).rows = [
        ['', '', '', '', '', '', ''],
        ['', '', '', '', '', '', ''],
        ['', '', '', '', '', '', ''],
        ['', '', '', '', '', '', ''],
        ['', '', '', '', '', '', ''],
      ];
      return [title, channelKpi, table];
    },
  },
  {
    id: 'report-wrapup-review',
    name: '总结 · 业绩复盘',
    description: 'KPI + 周期对比 + 亮点策略',
    pageType: 'report-wrapup-review',
    scenario: ['campaign-report'],
    components: () => {
      const title = titleAt('业绩复盘', 80, 40);
      const kpi = t('kpi-board', 80, 110, 1120, 170);
      (kpi.data as { headers: string[] }).headers = ['指标', '本期', '上期', '变化'];
      (kpi.data as { rows: string[][] }).rows = [
        ['总GMV', '$385K', '$325K', '↗+18%'],
        ['总Spend', '$97K', '$92K', '↗+5%'],
        ['综合ROAS', '3.97x', '3.53x', '↗+0.4x'],
        ['总订单', '3,720', '3,280', '↗+13%'],
      ];
      const timeline = t('timeline-compare', 80, 300, 1120, 220);
      (timeline.data as { variant: string }).variant = 'with-bar';
      (timeline.data as { headers: string[] }).headers = ['指标', '本期', '上期', '趋势'];
      (timeline.data as { rows: string[][] }).rows = [
        ['GMV', '$385K', '$325K', '↗'],
        ['ROAS', '3.97x', '3.53x', '↗'],
        ['新客率', '62%', '58%', '↗'],
        ['复购率', '38%', '42%', '↘'],
      ];
      const works = t('text', 80, 540, 1120, 100);
      (works.data as { content: string }).content =
        '本期亮点：\n• Top 3 达人贡献 45% GMV\n• 视频内容 ROI 高于图文 2.3x\n• 新客占比提升至 62%\n\n待改进：\n• 复购率下降 4pp，需加强老客运营\n• 广告位 CTR 有下降趋势';
      return [title, kpi, timeline, works];
    },
  },
  {
    id: 'report-product',
    name: '月报 · 商品表现',
    description: '热门商品 + AI 洞察',
    pageType: 'report-product',
    scenario: ['campaign-report'],
    components: () => {
      const title = titleAt('商品表现', 80, 40);
      const products = t('product-performance', 80, 110, 1120, 520);
      return [title, products];
    },
  },
  {
    id: 'report-creator-collab',
    name: '月报 · 达人合作详情',
    description: '头像 + 合作数据 + 作品 + 变化说明',
    pageType: 'report-creator-collab',
    scenario: ['campaign-report'],
    components: () => {
      const title = titleAt('达人合作详情', 80, 40);
      // Orchestrate the existing creator trio (validates cross-page reuse of business components).
      const avatar = t('creator-avatar-card', 80, 110, 440, 120);
      const stats = t('creator-stats-strip', 560, 110, 640, 120);
      const works = t('creator-works-list', 80, 250, 1120, 170);
      // 粉丝画像：性别占比 + 年龄段分布
      const fanGender = t('creator-fan-gender', 80, 440, 540, 220);
      (fanGender.data as { title: string }).title = '性别占比';
      (fanGender.data as { subtitle: string }).subtitle = '粉丝性别分布';
      const fanAge = t('creator-fan-age', 660, 440, 540, 220);
      (fanAge.data as { title: string }).title = '年龄段';
      (fanAge.data as { subtitle: string }).subtitle = '粉丝年龄分布';
      const note = t('text', 80, 650, 1120, 60);
      (note.data as { content: string }).content =
        '合作达人内容质量稳定，视频类内容互动率高于图文 1.8x。建议下期增加 Micro 达人比例，提升内容多样性。';
      return [title, avatar, stats, works, fanGender, fanAge, note];
    },
  },
  {
    id: 'report-placement',
    name: '月报 · DM 广告位',
    description: '广告位截图 + 亮点/经验',
    pageType: 'report-placement',
    scenario: ['campaign-report'],
    components: () => {
      const title = titleAt('广告位展示', 80, 40);
      const placement = t('placement-display', 80, 110, 1120, 480);
      (placement.data as { variant: string }).variant = 'with-text';
      return [title, placement];
    },
  },
  {
    id: 'report-posts',
    name: '月报 · 渠道贴文',
    description: '内容站 / Reddit / FB 贴文列表',
    pageType: 'report-posts',
    scenario: ['campaign-report'],
    components: () => {
      const title = titleAt('渠道贴文', 80, 40);
      const posts = t('post-list', 80, 110, 1120, 480);
      return [title, posts];
    },
  },
  {
    id: 'report-single-page',
    name: '单页 · Campaign 综合月报',
    description: 'KPI + 渠道表现 + 达人明细 + 合作方明细 + 趋势图 + 洞察（单页全览）',
    pageType: 'report-single-page',
    scenario: ['campaign-report'],
    components: () => {
      const comps: EditorComponent[] = [];

      // ── Row 0: 标题 ──
      const title = titleAt('Campaign 月报 · 综合概览', 80, 40);
      comps.push(title);

      // ── Row 1: KPI 看板（满宽）──
      const kpi = t('kpi-board', 80, 100, 1120, 120);
      comps.push(kpi);

      // ── Row 2: 趋势图(左) + 转化漏斗(右) ──
      const trend = t('bar-chart', 80, 240, 660, 200);
      (trend.data as { title: string }).title = '';
      comps.push(trend);
      const funnel = t('funnel-chart', 780, 240, 420, 200);
      comps.push(funnel);

      // ── Row 3: 渠道表现表格（满宽）──
      const channelTitle = textAt(80, 460, 1120, 24, '渠道 / 合作方表现', 16);
      comps.push(channelTitle);
      const channelTable = tableAt(80, 490, 1120, 200, ['合作方', '类型', '平台', '粉丝/访问量', '互动率', 'GMV', 'ROAS', '状态'], [
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
      ]);
      comps.push(channelTable);

      return comps;
    },
  },
  {
    // ── 风格 B: 经典商务风 ──
    // 标题块分隔 + Campaign 摘要卡 + 左右双栏（发布者表 + 地域分布）+ 收入趋势
    id: 'report-single-page-classic',
    name: '单页 · 经典商务风',
    description: '标题块 + Campaign 摘要 + 发布者表 + 地域分布 + 收入趋势线',
    pageType: 'report-single-page-classic',
    scenario: ['campaign-report'],
    components: () => {
      const comps: EditorComponent[] = [];

      // ── 标题块（带副标题 + 分割线）──
      const hero = t('title-block', 80, 40, 1120, 80);
      const hd = hero.data as { text: string; subtitle: string; variant: string; fontSize: number };
      hd.text = 'Campaign 月度报告';
      hd.subtitle = '经典商务风 · 综合数据概览';
      hd.variant = 'bar-left';
      hd.fontSize = 32;
      comps.push(hero);

      // ── Campaign 摘要卡（满宽）──
      const summary = t('campaign-summary', 80, 140, 1120, 160);
      comps.push(summary);

      // ── 左栏: 发布者表(640) ──
      const publisher = t('publisher-table', 80, 320, 640, 340);
      comps.push(publisher);

      // ── 右栏: 地域分布(420) ──
      const geo = t('geo-distribution', 760, 320, 440, 340);
      comps.push(geo);

      return comps;
    },
  },
  {
    // ── 风格 C: 数据仪表盘风 ──
    // 4 指标卡顶部排列 + 漏斗图 + 设备分布 + 内容话题 + 搜索词表
    id: 'report-single-page-dashboard',
    name: '单页 · 数据仪表盘风',
    description: '指标卡阵列 + 漏斗 + 设备分布 + 内容话题 + 搜索词',
    pageType: 'report-single-page-dashboard',
    scenario: ['campaign-report'],
    components: () => {
      const comps: EditorComponent[] = [];

      // ── Row 0: 标题 ──
      const title = titleAt('数据仪表盘 · Campaign 实时概览', 80, 35, 1120, 40);
      comps.push(title);

      // ── Row 1: 4 个指标卡横排（紧凑型）──
      const cardW = 265;
      const gap = 20;
      for (let i = 0; i < 4; i++) {
        const c = t('indicator-card', 80 + i * (cardW + gap), 90, cardW, 90);
        const d = c.data as { title: string; value: string; colorTheme: string };
        d.title = `指标 ${i + 1}`;
        d.value = '---';
        d.colorTheme = ['orange', 'blue', 'green', 'purple'][i];
        comps.push(c);
      }

      // ── Row 2: 转化漏斗(左 540) + 设备分布(右 540) ──
      const funnel = t('funnel-chart', 80, 200, 540, 230);
      comps.push(funnel);
      const device = t('device-breakdown', 660, 200, 540, 230);
      comps.push(device);

      // ── Row 3: 内容话题表现(左 540) + 搜索词表(右 540) ──
      const topics = t('content-topic-performance', 80, 450, 540, 230);
      comps.push(topics);
      const search = t('search-term-table', 660, 450, 540, 230);
      comps.push(search);

      return comps;
    },
  },
  {
    // ── 风格 D: 叙事分析风 ──
    // Campaign 摘要 → 多维分析雷达 → 时间线对比 → 策略洞察文本 → SWOT
    id: 'report-single-page-narrative',
    name: '单页 · 叙事分析风',
    description: 'Campaign 摘要 + 雷达分析 + 周期对比 + 策略洞察 + SWOT 矩阵',
    pageType: 'report-single-page-narrative',
    scenario: ['campaign-report'],
    components: () => {
      const comps: EditorComponent[] = [];

      // ── 标题 ──
      const title = titleAt('叙事分析 · Campaign 深度洞察', 80, 35, 1120, 40);
      comps.push(title);

      // ── Row 1: Campaign 摘要(左 680) + 多维雷达分析(右 420) ──
      const summary = t('campaign-summary', 80, 90, 680, 180);
      comps.push(summary);
      const radar = t('campaign-analysis', 800, 90, 400, 280);
      comps.push(radar);

      // ── Row 2: 周期对比时间线（满宽）──
      const timeline = t('timeline-compare', 80, 380, 1120, 170);
      (timeline.data as { variant: string }).variant = 'with-bar';
      comps.push(timeline);

      // ── Row 3: 策略洞察文本(左 540) + SWOT 矩阵(右 540) ──
      const strategy = t('strategy-block', 80, 570, 540, 130);
      comps.push(strategy);
      const swot = t('swot-matrix', 660, 570, 540, 130);
      (swot.data as { variant: string; title: string }).variant = 'grid';
      (swot.data as { title: string }).title = '';
      (swot.data as { quadrants: { title: string; items: string[] }[] }).quadrants = [
        { title: 'Opportunities', items: [] },
        { title: 'Strengths', items: [] },
        { title: 'Challenges', items: [] },
        { title: 'Threats', items: [] },
      ];
      comps.push(swot);

      return comps;
    },
  },

  /* -------- 公司 · 品牌 · 达人 · 案例 · 策略模板 -------- */

  {
    id: 'creator-page',
    name: '达人介绍页',
    description: '头像卡片 + 数据条 + 作品列表（试点）',
    pageType: 'creator',
    components: () => {
      // Top title
      const title = t('text', 80, 60, 900, 60);
      (title.data as { content: string; fontSize: number; fontWeight: number }).content = '达人介绍';
      (title.data as { fontSize: number }).fontSize = 32;
      (title.data as { fontWeight: number }).fontWeight = 700;
      // In-page business components (each independently draggable/deletable — validates "in-page semantic block" granularity)
      const avatar = t('creator-avatar-card', 80, 150, 360, 120);
      const stats = t('creator-stats-strip', 460, 150, 740, 120);
      const works = t('creator-works-list', 80, 300, 1120, 300);
      return [title, avatar, stats, works];
    },
  },
  {
    id: 'cover-page',
    name: '封面页',
    description: '大标题 + 副标题',
    pageType: 'cover',
    pageTitleIndex: 0,
    components: () => {
      const title = t('text', 80, 220, 1000, 180);
      (title.data as { content: string; fontSize: number; fontWeight: number }).content = '报告标题';
      (title.data as { fontSize: number }).fontSize = 56;
      (title.data as { fontWeight: number }).fontWeight = 700;
      const sub = t('text', 80, 420, 1000, 50);
      (sub.data as { content: string; fontSize: number }).content = '副标题 / 日期 / 品牌';
      (sub.data as { fontSize: number }).fontSize = 20;
      return [title, sub];
    },
  },
  {
    id: 'agenda-page',
    name: '目录页',
    description: '章节导航表格',
    pageType: 'agenda',
    components: () => {
      const title = t('text', 80, 60, 900, 50);
      (title.data as { content: string; fontSize: number; fontWeight: number }).content = '目录';
      (title.data as { fontSize: number }).fontSize = 32;
      (title.data as { fontWeight: number }).fontWeight = 700;
      const tbl = t('table', 80, 140, 1120, 460);
      (tbl.data as { headers: string[]; rows: string[][] }).headers = ['章节', '内容'];
      (tbl.data as { rows: string[][] }).rows = [
        ['', ''],
        ['', ''],
        ['', ''],
        ['', ''],
      ];
      return [title, tbl];
    },
  },
  {
    id: 'company-page',
    name: '公司介绍页',
    description: '简介 + 品牌墙',
    pageType: 'company',
    components: () => {
      const title = t('text', 80, 60, 900, 50);
      (title.data as { content: string; fontSize: number; fontWeight: number }).content = '关于我们';
      (title.data as { fontSize: number }).fontSize = 32;
      (title.data as { fontWeight: number }).fontWeight = 700;
      const intro = t('text', 80, 130, 1120, 80);
      (intro.data as { content: string }).content = '';
      const wall = t('brand-wall', 80, 240, 1120, 360);
      return [title, intro, wall];
    },
  },
  {
    id: 'package-page',
    name: '套餐方案',
    description: '标题 + 套餐卡片 + logo 墙',
    pageType: 'package',
    components: () => {
      const title = t('text', 80, 60, 900, 50);
      (title.data as { content: string; fontSize: number; fontWeight: number }).content = '套餐方案';
      (title.data as { fontSize: number }).fontSize = 32;
      (title.data as { fontWeight: number }).fontWeight = 700;
      const cardW = 360;
      const gap = 20;
      const startX = 80;
      const cards = [0, 1, 2].map((i) => {
        const c = t('package-card', startX + i * (cardW + gap), 150, cardW, 460);
        const data = c.data as { highlighted: boolean };
        if (i === 1) {
          // Middle plan marked as recommended.
          data.highlighted = true;
        }
        return c;
      });
      return [title, ...cards];
    },
  },

  /* -------- legacy full-page layouts → page templates (split into common/business component orchestrations) -------- */

  {
    id: 'milestone-page',
    name: '公司里程碑',
    description: '标题 + 里程碑表格 + 简介',
    pageType: 'milestone',
    components: () =>
      tablePage(
        '公司里程碑',
        ['年份', '里程碑'],
        [
          ['', ''],
          ['', ''],
          ['', ''],
          ['', ''],
        ],
        '',
      ),
  },
  {
    id: 'global-page',
    name: '全球布局',
    description: '标题 + 区域布局表格',
    pageType: 'global',
    components: () =>
      tablePage('全球布局', ['区域', '办公点', '达人资源'], [
        ['', '', ''],
        ['', '', ''],
        ['', '', ''],
        ['', '', ''],
      ]),
  },
  {
    id: 'org-page',
    name: '组织架构',
    description: '标题 + 团队构成表格',
    pageType: 'org',
    components: () =>
      tablePage('组织架构', ['职能', '占比', '职责'], [
        ['', '', ''],
        ['', '', ''],
        ['', '', ''],
        ['', '', ''],
      ]),
  },
  {
    id: 'service-page',
    name: '核心服务矩阵',
    description: '标题 + 服务列表表格',
    pageType: 'service',
    components: () =>
      tablePage('核心服务矩阵', ['服务', '描述'], [
        ['', ''],
        ['', ''],
        ['', ''],
        ['', ''],
      ]),
  },
  {
    id: 'challenge-page',
    name: '机会与挑战',
    description: 'SWOT 四象限矩阵',
    pageType: 'challenge',
    scenario: ['campaign-report', 'campaign-proposal'],
    components: () => {
      const title = titleAt('机会与挑战', 80, 50);
      const swot = t('swot-matrix', 80, 130, 1120, 420);
      (swot.data as { variant: string; title: string }).variant = 'grid';
      (swot.data as { title: string }).title = '';
      (swot.data as { quadrants: { title: string; items: string[] }[] }).quadrants = [
        { title: 'Opportunities', items: [] },
        { title: 'Strengths', items: [] },
        { title: 'Challenges', items: [] },
        { title: 'Threats', items: [] },
      ];
      return [title, swot];
    },
  },
  {
    id: 'process-page',
    name: '合作评估流程',
    description: '标题 + 流程步骤表格',
    pageType: 'process',
    scenario: ['campaign-report', 'campaign-proposal'],
    components: () =>
      tablePage('合作评估流程', ['步骤', '核心工作', '目标'], [
        ['', '', ''],
        ['', '', ''],
        ['', '', ''],
        ['', '', ''],
      ]),
  },
  {
    id: 'calendar-page',
    name: '营销日历',
    description: '标题 + 节点规划表格',
    pageType: 'calendar',
    scenario: ['campaign-report', 'campaign-proposal'],
    components: () =>
      tablePage('营销日历', ['节点', '主题', '动作'], [
        ['', '', ''],
        ['', '', ''],
        ['', '', ''],
        ['', '', ''],
      ]),
  },
  {
    id: 'campaign-plan-page',
    name: '投放计划',
    description: '标题 + 阶段路线图表格',
    pageType: 'campaign-plan',
    scenario: ['campaign-report', 'campaign-proposal'],
    components: () =>
      tablePage('投放计划', ['阶段', '动作', '目标'], [
        ['', '', ''],
        ['', '', ''],
        ['', '', ''],
        ['', '', ''],
      ]),
  },
  {
    id: 'case-page',
    name: '案例展示',
    description: '标题 + 成果卡片 + 案例作品 + 文案',
    pageType: 'case',
    components: () => {
      const title = titleAt('案例展示', 80, 50);
      const cards = [0, 1, 2, 3].map((i) => {
        const c = t('indicator-card', 80 + i * 285, 130, 265, 90);
        const d = c.data as { title: string; value: string; colorTheme: string };
        d.title = `指标 ${i + 1}`;
        d.value = '---';
        d.colorTheme = ['orange', 'green', 'blue', 'purple'][i];
        return c;
      });
      const works = t('creator-works-list', 80, 250, 1120, 200);
      const narrative = textAt(80, 480, 1120, 100, '');
      return [title, ...cards, works, narrative];
    },
  },
  {
    id: 'content-analysis-page',
    name: '内容分析',
    description: '标题 + 内容类型分布柱状图 + 明细表格',
    pageType: 'content-analysis',
    components: () => {
      const title = titleAt('内容分析', 80, 50);
      const chart = t('bar-chart', 80, 130, 560, 460);
      (chart.data as { title: string }).title = '';
      const tbl = tableAt(680, 130, 520, 460, ['类型', '观看占比', '热门关键词'], [
        ['', '', ''],
        ['', '', ''],
        ['', '', ''],
      ]);
      return [title, chart, tbl];
    },
  },
  {
    id: 'funnel-page',
    name: '增长漏斗',
    description: '标题 + 漏斗阶段柱状图',
    pageType: 'funnel',
    scenario: ['campaign-report', 'campaign-proposal'],
    components: () => {
      const title = titleAt('增长漏斗', 80, 50);
      const chart = t('bar-chart', 80, 130, 1120, 500);
      (chart.data as { title: string }).title = '';
      return [title, chart];
    },
  },
  {
    id: 'audience-portrait',
    name: '受众画像',
    description: '粉丝画像：性别 / 年龄 / 城市 / 兴趣',
    pageType: 'audience-portrait',
    scenario: ['media-kit'],
    components: () => {
      const title = titleAt('粉丝画像', 80, 40);
      const profile = t('creator-audience-profile', 80, 110, 1120, 360);
      const interest = t('creator-fan-interest', 80, 490, 1120, 160);
      (interest.data as { title: string }).title = '';
      const note = t('text', 80, 650, 1120, 60);
      (note.data as { content: string }).content = '';
      return [title, profile, interest, note];
    },
  },
  {
    id: 'account-overview',
    name: '账号数据概览',
    description: '数据条 + 核心指标 + 增长趋势',
    pageType: 'account-overview',
    scenario: ['media-kit'],
    components: () => {
      const title = titleAt('账号数据概览', 80, 40);
      const stats = t('creator-stats-strip', 80, 110, 1120, 120);
      const c1 = t('indicator-card', 80, 250, 265, 130);
      const c2 = t('indicator-card', 365, 250, 265, 130);
      const c3 = t('indicator-card', 650, 250, 265, 130);
      const c4 = t('indicator-card', 935, 250, 265, 130);
      const growth = t('line-chart', 80, 400, 1120, 240);
      (growth.data as { title: string }).title = '';
      return [title, stats, c1, c2, c3, c4, growth];
    },
  },
  {
    id: 'brand-collab',
    name: '合作品牌',
    description: '过往合作品牌 Logo 墙',
    pageType: 'brand-collab',
    scenario: ['media-kit'],
    components: () => {
      const title = titleAt('合作品牌', 80, 40);
      const wall = t('brand-wall', 80, 110, 1120, 420);
      const note = t('text', 80, 550, 1120, 70);
      (note.data as { content: string }).content = '';
      return [title, wall, note];
    },
  },
];

/* ========================================================================== */
/*  Business-line-specific templates (layer ⑤)                                */
/* ========================================================================== */
//
// 每个业务线（FT/SM/CX/DG/KN/DM）拥有独立风格的模板变体。
// createBusinessLineTemplates(businessLine) 根据 businessLine 返回一组模板，
// 每个模板基于通用模板但调整组件布局间距/尺寸、变体选择和布局侧重。
// 这些模板会被追加到 TEMPLATES 数组末尾（见文件底部）。
//
// 风格定义：
//   FT (FineTech,    蓝 #2563eb): 科技简约风 — 大间距、留白多、紧凑指标卡
//   SM (SocialMove,  绿 #16a34a): 社交活泼风 — 达人元素突出、圆角大、社交指标优先
//   CX (CosmeX,      粉 #db2777): 美妆精致风 — 大图、粉丝画像突出、美妆达人优先
//   DG (DigitalGo,   橙 #ea580c): 数字动感风 — 数据密集、图表多、紧凑排列
//   KN (KitchenNest, 紫 #9333ea): 居家温暖风 — 产品优先、套餐卡片大、柔和间距
//   DM (DreamMart,   青 #0891b2): 电商转化风 — 商品展示密集、漏斗+ROAS突出

/** 业务线视觉风格配置。 */
interface BusinessLineStyle {
  /** 业务线代码 */
  code: string;
  /** 品牌色 */
  color: string;
  /** 模板名称后缀（用于区分同类模板） */
  suffix: string;
  /** 页面通用左右边距 */
  marginX: number;
  /** 组件间垂直间距 */
  gapY: number;
  /** KPI 板高度 */
  kpiHeight: number;
  /** 指标卡宽度 */
  cardWidth: number;
  /** 指标卡高度 */
  cardHeight: number;
  /** creator-avatar-card 默认变体 */
  avatarVariant: 'horizontal' | 'vertical' | 'compact';
  /** creator-stats-strip 默认变体 */
  statsVariant: 'cards' | 'strip' | 'compact';
  /** 标题字号 */
  titleFontSize: number;
  /** 主图/图表区域是否更大 */
  largeVisual: boolean;
}

const BUSINESS_LINE_STYLES: Record<string, BusinessLineStyle> = {
  FT: {
    code: 'FT', color: '#2563eb', suffix: 'FT',
    marginX: 100, gapY: 90, kpiHeight: 150, cardWidth: 240, cardHeight: 100,
    avatarVariant: 'horizontal', statsVariant: 'compact', titleFontSize: 32, largeVisual: false,
  },
  SM: {
    code: 'SM', color: '#16a34a', suffix: 'SM',
    marginX: 70, gapY: 60, kpiHeight: 160, cardWidth: 260, cardHeight: 130,
    avatarVariant: 'vertical', statsVariant: 'cards', titleFontSize: 34, largeVisual: false,
  },
  CX: {
    code: 'CX', color: '#db2777', suffix: 'CX',
    marginX: 80, gapY: 70, kpiHeight: 170, cardWidth: 280, cardHeight: 140,
    avatarVariant: 'vertical', statsVariant: 'cards', titleFontSize: 30, largeVisual: true,
  },
  DG: {
    code: 'DG', color: '#ea580c', suffix: 'DG',
    marginX: 60, gapY: 45, kpiHeight: 120, cardWidth: 210, cardHeight: 85,
    avatarVariant: 'compact', statsVariant: 'compact', titleFontSize: 30, largeVisual: false,
  },
  KN: {
    code: 'KN', color: '#9333ea', suffix: 'KN',
    marginX: 90, gapY: 80, kpiHeight: 170, cardWidth: 280, cardHeight: 130,
    avatarVariant: 'horizontal', statsVariant: 'cards', titleFontSize: 32, largeVisual: true,
  },
  DM: {
    code: 'DM', color: '#0891b2', suffix: 'DM',
    marginX: 60, gapY: 40, kpiHeight: 110, cardWidth: 200, cardHeight: 80,
    avatarVariant: 'compact', statsVariant: 'strip', titleFontSize: 30, largeVisual: false,
  },
};

/** 内容宽度（页面宽 1280 固定）。 */
function contentWidth(mx: number): number {
  return 1280 - mx * 2;
}

/**
 * 为指定业务线生成一组差异化风格模板。
 *
 * 目前覆盖以下 pageType：cover, overview, creator, report-monthly-overview,
 * funnel, package, case, report-product — 这几个最能体现业务线风格差异。
 * 随着需求增长可以继续在此函数内追加。
 *
 * 每个模板的 id 格式为 `{pageType}-{blCode}-bl`，避免和通用模板冲突。
 */
export function createBusinessLineTemplates(businessLine: string): Template[] {
  const style = BUSINESS_LINE_STYLES[businessLine];
  if (!style) return [];
  const mx = style.marginX;
  const cw = contentWidth(mx);

  /* ---------- helper: 带风格的大标题 ---------- */
  const blTitle = (content: string, y: number): EditorComponent => {
    const comp = t('text', mx, y, cw, 50);
    const data = comp.data as { content: string; fontSize: number; fontWeight: number };
    data.content = content;
    data.fontSize = style.titleFontSize;
    data.fontWeight = 700;
    return comp;
  };

  /** n 行 × cols 列的占位 rows（空字符串占位）。 */
  const ph = (cols: number, n = 4): string[][] =>
    Array.from({ length: n }, () => Array.from({ length: cols }, () => ''));

  /** BL 风格的「标题 + 表格 (+ 简介)」页（milestone/global/org/service/process/calendar/campaign-plan 共用）。 */
  const blTablePage = (title: string, headers: string[], rows: string[][], intro?: string): EditorComponent[] => {
    const head = blTitle(title, 50);
    const tbl = t('table', mx, 130, cw, intro ? 380 : 540);
    const td = tbl.data as { headers: string[]; rows: string[][] };
    td.headers = headers;
    td.rows = rows;
    return intro ? [head, tbl, textAt(mx, 540, cw, 80, intro)] : [head, tbl];
  };

  const templates: Template[] = [];

  /* -------- Cover (封面) -------- */
  templates.push({
    id: `cover-${style.suffix}-bl`,
    name: `${style.suffix} · Cover`,
    description: `${businessLine} branded cover — ${style.color}`,
    pageType: 'cover',
    businessLine,
    pageTitleIndex: 0,
    components: () => {
      // FT/KN 留白更大（标题更靠下）；DG/DM 紧凑（标题靠上）
      const titleY = style.largeVisual ? 280 : 220;
      const subY = titleY + 200;
      const title = t('text', mx + 20, titleY, cw - 40, 180);
      const td = title.data as { content: string; fontSize: number; fontWeight: number };
      td.content = '报告标题';
      td.fontSize = style.code === 'FT' ? 52 : 56;
      td.fontWeight = 700;
      const sub = t('text', mx + 20, subY, cw - 40, 50);
      const sd = sub.data as { content: string; fontSize: number };
      sd.content = '副标题 / 日期 / 品牌';
      sd.fontSize = 20;
      return [title, sub];
    },
  });

  /* -------- Overview (数据概览) -------- */
  templates.push({
    id: `overview-${style.suffix}-bl`,
    name: `${style.suffix} · Overview`,
    description: `${businessLine} styled overview`,
    pageType: 'overview',
    businessLine,
    components: () => {
      // DG/DM 紧凑型：4 列；FT/SM/CX/KN 宽松型：3 列
      const cols = style.gapY < 50 ? 4 : 3;
      const gap = 20;
      const totalW = cw - gap * (cols - 1);
      const cW = Math.floor(totalW / cols);
      const cards = Array.from({ length: cols }, (_, i) => {
        const c = t('indicator-card', mx + i * (cW + gap), 80, cW, style.cardHeight);
        const d = c.data as { title: string; value: string };
        d.title = `指标 ${i + 1}`;
        d.value = '---';
        return c;
      });
      const chartY = 80 + style.cardHeight + style.gapY;
      const chartH = 720 - chartY - 60;
      const chart = t('bar-chart', mx, chartY, cw, chartH);
      return [...cards, chart];
    },
  });

  /* -------- Creator (达人介绍) -------- */
  templates.push({
    id: `creator-${style.suffix}-bl`,
    name: `${style.suffix} · Creator`,
    description: `${businessLine} styled creator page`,
    pageType: 'creator',
    businessLine,
    components: () => {
      const title = blTitle('达人介绍', 60);
      // SM/CX: 大头像 + 社交指标；FT/DG/DM: 紧凑布局
      const avatarW = style.avatarVariant === 'vertical' ? 300 : 360;
      const avatarH = style.avatarVariant === 'vertical' ? 180 : 130;
      const avatar = t('creator-avatar-card', mx, 130, avatarW, avatarH);
      (avatar.data as { variant: string }).variant = style.avatarVariant;

      const statsX = mx + avatarW + 20;
      const statsW = mx + cw - statsX;
      const stats = t('creator-stats-strip', statsX, 130, statsW, avatarH);
      (stats.data as { variant: string }).variant = style.statsVariant;

      const worksY = 130 + avatarH + style.gapY;

      // SM/CX: 增加粉丝画像组件突出
      if (style.code === 'SM' || style.code === 'CX') {
        // 重新布局：缩小作品列表高度，腾出空间放粉丝画像
        const worksHeight = 180;
        const worksComp = t('creator-works-list', mx, worksY, cw, worksHeight);
        const fanGenderY = worksY + worksHeight + style.gapY;
        const fanGender = t('creator-fan-gender', mx, fanGenderY, Math.floor(cw / 2) - 10, 150);
        (fanGender.data as { title: string }).title = '';
        const fanAge = t('creator-fan-age', mx + Math.floor(cw / 2) + 10, fanGenderY, Math.floor(cw / 2) - 10, 150);
        (fanAge.data as { title: string }).title = '';
        return [title, avatar, stats, worksComp, fanGender, fanAge];
      }

      const works = t('creator-works-list', mx, worksY, cw, 720 - worksY - 50);
      return [title, avatar, stats, works];
    },
  });

  /* -------- Report Monthly Overview (月报概览) -------- */
  templates.push({
    id: `report-monthly-overview-${style.suffix}-bl`,
    name: `${style.suffix} · Monthly Overview`,
    description: `${businessLine} styled monthly overview`,
    pageType: 'report-monthly-overview',
    businessLine,
    components: () => {
      const title = blTitle('月报 · 业绩概览', 40);
      const kpiY = 110;
      const kpi = t('kpi-board', mx, kpiY, cw, style.kpiHeight);

      // DG: 额外增加第二个图表（数据密集）
      const chartY = kpiY + style.kpiHeight + style.gapY;
      if (style.code === 'DG') {
        // 左趋势图 + 右对比图 + 底部洞察
        const halfW = Math.floor(cw / 2) - 10;
        const chart1 = t('bar-chart', mx, chartY, halfW, 220);
        (chart1.data as { title: string }).title = '';
        const chart2 = t('timeline-compare', mx + halfW + 20, chartY, halfW, 220);
        const insightY = chartY + 240;
        const insight = t('text', mx, insightY, cw, 720 - insightY - 40);
        (insight.data as { content: string; fontSize: number }).content = '';
        (insight.data as { fontSize: number }).fontSize = 14;
        return [title, kpi, chart1, chart2, insight];
      }

      const chartW = style.largeVisual ? Math.floor(cw * 0.58) : Math.floor(cw * 0.57);
      const tlW = cw - chartW - 20;
      const chart = t('bar-chart', mx, chartY, chartW, 240);
      (chart.data as { title: string }).title = '';
      const timeline = t('timeline-compare', mx + chartW + 20, chartY, tlW, 240);
      const insightY = chartY + 260;
      const insight = t('text', mx, insightY, cw, 720 - insightY - 40);
      (insight.data as { content: string }).content = '';
      return [title, kpi, chart, timeline, insight];
    },
  });

  /* -------- Funnel (增长漏斗) -------- */
  templates.push({
    id: `funnel-${style.suffix}-bl`,
    name: `${style.suffix} · Funnel`,
    description: `${businessLine} styled conversion funnel`,
    pageType: 'funnel',
    businessLine,
    components: () => {
      const title = blTitle('增长漏斗', 50);
      // DM: 电商转化突出 ROAS，增加指标行
      if (style.code === 'DM') {
        // 顶部 ROAS 指标卡行
        const roasGap = 20;
        const roasCols = 4;
        const roasW = Math.floor((cw - roasGap * (roasCols - 1)) / roasCols);
        const roasCards = Array.from({ length: roasCols }, (_, i) => {
          const c = t('indicator-card', mx + i * (roasW + roasGap), 120, roasW, 80);
          const d = c.data as { title: string; value: string };
          d.title = `指标 ${i + 1}`;
          d.value = '---';
          return c;
        });
        const chartY = 220;
        const chart = t('bar-chart', mx, chartY, cw, 720 - chartY - 40);
        (chart.data as { title: string }).title = '';
        return [title, ...roasCards, chart];
      }

      const chart = t('bar-chart', mx, 130, cw, 720 - 130 - 40);
      (chart.data as { title: string }).title = '';
      return [title, chart];
    },
  });

  /* -------- Package (套餐方案) -------- */
  templates.push({
    id: `package-${style.suffix}-bl`,
    name: `${style.suffix} · Package`,
    description: `${businessLine} styled package comparison`,
    pageType: 'package',
    businessLine,
    components: () => {
      const title = blTitle('套餐方案', 60);
      // KN: 套餐卡片更大更柔和；DM: 紧凑
      const cardW = style.code === 'KN' ? 360 : style.cardWidth + 80;
      const gap = style.code === 'KN' ? 30 : 20;
      const cardH = style.code === 'KN' ? 500 : 440;
      const startX = (1280 - (cardW * 3 + gap * 2)) / 2;
      const cards = [0, 1, 2].map((i) => {
        const c = t('package-card', Math.round(startX + i * (cardW + gap)), 150, cardW, cardH);
        const data = c.data as { name: string; highlighted: boolean };
        if (i === 1) {
          data.name = `${style.suffix} Growth Booster`;
          data.highlighted = true;
        }
        return c;
      });
      return [title, ...cards];
    },
  });

  /* -------- Case (案例展示) -------- */
  templates.push({
    id: `case-${style.suffix}-bl`,
    name: `${style.suffix} · Case Study`,
    description: `${businessLine} styled case study`,
    pageType: 'case',
    businessLine,
    components: () => {
      const title = blTitle('案例展示', 50);
      // CX: 大图突出；DG: 数据密集
      const cols = style.gapY < 50 ? 5 : 4;
      const gap = 16;
      const cardW = Math.floor((cw - gap * (cols - 1)) / cols);
      const cardH = style.largeVisual ? 110 : 90;
      const cards = Array.from({ length: cols }, (_, i) => {
        const c = t('indicator-card', mx + i * (cardW + gap), 120, cardW, cardH);
        const d = c.data as { title: string; value: string };
        const labels = ['Impressions', 'GMV', 'Engagement', 'Creators', 'ROAS'];
        const values = ['12.6M', '138%', '8.7%', '70', '4.5x'];
        d.title = labels[i] ?? '指标 ' + (i + 1);
        d.value = values[i] ?? '---';
        return c;
      });
      const worksY = 120 + cardH + style.gapY;
      const works = t('creator-works-list', mx, worksY, cw, 720 - worksY - 50);
      return [title, ...cards, works];
    },
  });

  /* -------- Report Product (商品表现) -------- */
  templates.push({
    id: `report-product-${style.suffix}-bl`,
    name: `${style.suffix} · Product Performance`,
    description: `${businessLine} styled product performance`,
    pageType: 'report-product',
    businessLine,
    components: () => {
      const title = blTitle('商品表现', 40);

      // DM: 增加顶部 ROAS 商品指标行
      if (style.code === 'DM') {
        const gap = 16;
        const cols = 3;
        const cW = Math.floor((cw - gap * (cols - 1)) / cols);
        const topCards = Array.from({ length: cols }, (_, i) => {
          const c = t('indicator-card', mx + i * (cW + gap), 110, cW, 70);
          const d = c.data as { title: string; value: string };
          d.title = ['Top GMV', 'Avg ROAS', 'Best CVR'][i];
          d.value = ['$186K', '4.2x', '5.1%'][i];
          return c;
        });
        const ppY = 200;
        const pp = t('product-performance', mx, ppY, cw, 720 - ppY - 40);
        return [title, ...topCards, pp];
      }

      const productsY = 110;
      const products = t('product-performance', mx, productsY, cw, 720 - productsY - 40);
      return [title, products];
    },
  });

  /* -------- Report Creator Collaboration (月报 · 达人合作详情) -------- */
  templates.push({
    id: `report-creator-collab-${style.suffix}-bl`,
    name: `${style.suffix} · Creator Collab`,
    description: `${businessLine} styled creator collaboration detail`,
    pageType: 'report-creator-collab',
    businessLine,
    components: () => {
      const title = blTitle('达人合作详情', 40);
      // avatar + stats 行：沿用通用布局的行高（120/170/220/70），仅按业务线切左右边距与头像/数据条变体，
      // 保证 720 画布内不溢出（业务线 gapY 在此密集页会撑高，故不代入）。
      const avatarW = style.avatarVariant === 'vertical' ? 320 : 440;
      const avatar = t('creator-avatar-card', mx, 110, avatarW, 120);
      (avatar.data as { variant: string }).variant = style.avatarVariant;
      const statsX = mx + avatarW + 20;
      const stats = t('creator-stats-strip', statsX, 110, mx + cw - statsX, 120);
      (stats.data as { variant: string }).variant = style.statsVariant;
      const works = t('creator-works-list', mx, 250, cw, 170);
      // 粉丝画像：性别占比 + 年龄段分布
      const halfW = Math.floor(cw / 2) - 10;
      const fanGender = t('creator-fan-gender', mx, 440, halfW, 220);
      (fanGender.data as { title: string; subtitle: string }).title = '';
      (fanGender.data as { subtitle: string }).subtitle = '';
      const fanAge = t('creator-fan-age', mx + halfW + 20, 440, halfW, 220);
      (fanAge.data as { title: string; subtitle: string }).title = '';
      (fanAge.data as { subtitle: string }).subtitle = '';
      const note = t('text', mx, 680, cw, 70);
      (note.data as { content: string }).content = '';
      return [title, avatar, stats, works, fanGender, fanAge, note];
    },
  });

  /* -------- Report Weekly Overview (周报 · 业绩概览) -------- */
  templates.push({
    id: `report-weekly-overview-${style.suffix}-bl`,
    name: `${style.suffix} · Weekly Overview`,
    description: `${businessLine} styled weekly overview`,
    pageType: 'report-weekly-overview',
    businessLine,
    components: () => {
      const title = blTitle('周报 · 业绩概览', 50);
      const kpi = t('kpi-board', mx, 130, cw, style.kpiHeight);
      // 行间用紧凑固定间距（非 style.gapY），保证最大业务线画布内不溢出。
      const planY = 130 + style.kpiHeight + 20;
      const plan = t('text', mx, planY, cw, 720 - planY - 40);
      (plan.data as { content: string; fontSize: number }).content = '';
      (plan.data as { fontSize: number }).fontSize = 16;
      return [title, kpi, plan];
    },
  });

  /* -------- Report Channel (月报 · 渠道表现) -------- */
  templates.push({
    id: `report-channel-${style.suffix}-bl`,
    name: `${style.suffix} · Channel Performance`,
    description: `${businessLine} styled channel performance`,
    pageType: 'report-channel',
    businessLine,
    components: () => {
      const title = blTitle('渠道表现', 40);
      const channelKpi = t('kpi-board', mx, 110, cw, 90);
      (channelKpi.data as { variant: string }).variant = 'compact';
      (channelKpi.data as { headers: string[] }).headers = ['指标', '数值', '对比'];
      const tableY = 110 + 90 + 30;
      const table = t('table', mx, tableY, cw, 720 - tableY - 40);
      (table.data as { headers: string[] }).headers = ['渠道', '销量', '点击', 'CVR', '发布者'];
      return [title, channelKpi, table];
    },
  });

  /* -------- Report Wrapup Review (总结 · 业绩复盘) -------- */
  templates.push({
    id: `report-wrapup-review-${style.suffix}-bl`,
    name: `${style.suffix} · Campaign Review`,
    description: `${businessLine} styled campaign review`,
    pageType: 'report-wrapup-review',
    businessLine,
    components: () => {
      const title = blTitle('业绩复盘', 40);
      const kpi = t('kpi-board', mx, 110, cw, style.kpiHeight);
      const tlY = 110 + style.kpiHeight + 20;
      const timeline = t('timeline-compare', mx, tlY, cw, 220);
      (timeline.data as { variant: string }).variant = 'with-bar';
      const textY = tlY + 220 + 20;
      const works = t('text', mx, textY, cw, 720 - textY - 40);
      (works.data as { content: string }).content = '';
      return [title, kpi, timeline, works];
    },
  });

  /* -------- Report Placement (月报 · DM 广告位) -------- */
  templates.push({
    id: `report-placement-${style.suffix}-bl`,
    name: `${style.suffix} · Placement Display`,
    description: `${businessLine} styled placement display`,
    pageType: 'report-placement',
    businessLine,
    components: () => {
      const title = blTitle('广告位展示', 40);
      const placement = t('placement-display', mx, 110, cw, 720 - 110 - 40);
      (placement.data as { variant: string }).variant = 'with-text';
      return [title, placement];
    },
  });

  /* -------- Report Posts (月报 · 渠道贴文) -------- */
  templates.push({
    id: `report-posts-${style.suffix}-bl`,
    name: `${style.suffix} · Channel Posts`,
    description: `${businessLine} styled channel posts`,
    pageType: 'report-posts',
    businessLine,
    components: () => {
      const title = blTitle('渠道贴文', 40);
      const posts = t('post-list', mx, 110, cw, 720 - 110 - 40);
      return [title, posts];
    },
  });

  /* -------- Title (标题页) -------- */
  templates.push({
    id: `title-${style.suffix}-bl`,
    name: `${style.suffix} · Title`,
    description: `${businessLine} styled title page`,
    pageType: 'title',
    businessLine,
    components: () => {
      const title = t('text', mx + 20, 180, cw - 40, 160);
      const td = title.data as { content: string; fontSize: number; fontWeight: number };
      td.content = '报告标题';
      td.fontSize = 48;
      td.fontWeight = 700;
      const sub = t('text', mx + 20, 360, cw - 40, 60);
      (sub.data as { content: string; fontSize: number }).content = '';
      (sub.data as { fontSize: number }).fontSize = 20;
      return [title, sub];
    },
  });

  /* -------- Table (表格页) -------- */
  templates.push({
    id: `table-${style.suffix}-bl`,
    name: `${style.suffix} · Table`,
    description: `${businessLine} styled table page`,
    pageType: 'table',
    businessLine,
    components: () => [t('table', mx, 100, cw, 520)],
  });

  /* -------- Agenda (目录页) -------- */
  templates.push({
    id: `agenda-${style.suffix}-bl`,
    name: `${style.suffix} · Agenda`,
    description: `${businessLine} styled agenda`,
    pageType: 'agenda',
    businessLine,
    components: () => {
      const title = blTitle('目录', 60);
      const tbl = t('table', mx, 140, cw, 460);
      const td = tbl.data as { headers: string[]; rows: string[][] };
      td.headers = ['章节', '内容'];
      td.rows = [['01', '...'], ['02', '...'], ['03', '...'], ['04', '...']];
      return [title, tbl];
    },
  });

  /* -------- Company (公司介绍页) -------- */
  templates.push({
    id: `company-${style.suffix}-bl`,
    name: `${style.suffix} · Company`,
    description: `${businessLine} styled company intro`,
    pageType: 'company',
    businessLine,
    components: () => {
      const title = blTitle('关于我们', 60);
      const intro = t('text', mx, 130, cw, 80);
      (intro.data as { content: string }).content = '';
      const wall = t('brand-wall', mx, 240, cw, 360);
      return [title, intro, wall];
    },
  });

  /* -------- Milestone (公司里程碑) -------- */
  templates.push({
    id: `milestone-${style.suffix}-bl`,
    name: `${style.suffix} · Milestones`,
    description: `${businessLine} styled milestones`,
    pageType: 'milestone',
    businessLine,
    components: () => blTablePage('公司里程碑', ['年份', '里程碑'], ph(2), ''),
  });

  /* -------- Global (全球布局) -------- */
  templates.push({
    id: `global-${style.suffix}-bl`,
    name: `${style.suffix} · Global Network`,
    description: `${businessLine} styled global network`,
    pageType: 'global',
    businessLine,
    components: () => blTablePage('全球布局', ['区域', '办公点', '达人资源'], ph(3)),
  });

  /* -------- Org (组织架构) -------- */
  templates.push({
    id: `org-${style.suffix}-bl`,
    name: `${style.suffix} · Org`,
    description: `${businessLine} styled org chart`,
    pageType: 'org',
    businessLine,
    components: () =>
      blTablePage('组织架构', ['职能', '占比', '职责'], ph(3)),
  });

  /* -------- Service (核心服务矩阵) -------- */
  templates.push({
    id: `service-${style.suffix}-bl`,
    name: `${style.suffix} · Services`,
    description: `${businessLine} styled service matrix`,
    pageType: 'service',
    businessLine,
    components: () => blTablePage('核心服务矩阵', ['服务', '描述'], ph(2)),
  });

  /* -------- Process (合作评估流程) -------- */
  templates.push({
    id: `process-${style.suffix}-bl`,
    name: `${style.suffix} · Process`,
    description: `${businessLine} styled process`,
    pageType: 'process',
    businessLine,
    components: () =>
      blTablePage(
        '合作评估流程',
        ['步骤', '核心工作', '目标'],
        [['1', '...', '...'], ['2', '...', '...'], ['3', '...', '...'], ['4', '...', '...']],
      ),
  });

  /* -------- Calendar (营销日历) -------- */
  templates.push({
    id: `calendar-${style.suffix}-bl`,
    name: `${style.suffix} · Calendar`,
    description: `${businessLine} styled content calendar`,
    pageType: 'calendar',
    businessLine,
    components: () => blTablePage('营销日历', ['节点', '主题', '动作'], ph(3)),
  });

  /* -------- Campaign Plan (投放计划) -------- */
  templates.push({
    id: `campaign-plan-${style.suffix}-bl`,
    name: `${style.suffix} · Campaign Plan`,
    description: `${businessLine} styled campaign plan`,
    pageType: 'campaign-plan',
    businessLine,
    components: () => blTablePage('投放计划', ['阶段', '动作', '目标'], ph(3)),
  });

  /* -------- Challenge (机会与挑战) -------- */
  templates.push({
    id: `challenge-${style.suffix}-bl`,
    name: `${style.suffix} · SWOT`,
    description: `${businessLine} styled opportunities & challenges`,
    pageType: 'challenge',
    businessLine,
    components: () => {
      const title = blTitle('机会与挑战', 50);
      const swot = t('swot-matrix', mx, 130, cw, 420);
      const sd = swot.data as {
        variant: string;
        title: string;
        quadrants: { title: string; items: string[] }[];
      };
      sd.variant = 'grid';
      sd.title = '';
      sd.quadrants = [
        { title: 'Opportunities', items: ['...'] },
        { title: 'Strengths', items: ['...'] },
        { title: 'Challenges', items: ['...'] },
        { title: 'Threats', items: ['...'] },
      ];
      return [title, swot];
    },
  });

  /* -------- Content Analysis (内容分析) -------- */
  templates.push({
    id: `content-analysis-${style.suffix}-bl`,
    name: `${style.suffix} · Content Analysis`,
    description: `${businessLine} styled content analysis`,
    pageType: 'content-analysis',
    businessLine,
    components: () => {
      const title = blTitle('内容分析', 50);
      const chartW = Math.floor(cw * 0.5) - 10;
      const chart = t('bar-chart', mx, 130, chartW, 260);
      (chart.data as { title: string }).title = '';
      const tbl = t('table', mx + chartW + 20, 130, cw - chartW - 20, 260);
      const td = tbl.data as { headers: string[]; rows: string[][] };
      td.headers = ['类型', '观看占比', '热门关键词'];
      td.rows = ph(3, 3);
      return [title, chart, tbl];
    },
  });

  return templates;
}

/* ---- Generate and append all business-line templates ---- */
const BUSINESS_LINES = ['FT', 'SM', 'CX', 'DG', 'KN', 'DM'] as const;
for (const bl of BUSINESS_LINES) {
  TEMPLATES.push(...createBusinessLineTemplates(bl));
}
