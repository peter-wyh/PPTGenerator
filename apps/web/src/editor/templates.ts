import type { ComponentType, EditorComponent } from '@mediakit/shared';
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
}

/** Get a page template by id. */
export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/** Page template categories (grouped in the "New Page" dialog). Order = display order. */
export const TEMPLATE_CATEGORIES: { category: string; ids: string[] }[] = [
  { category: '基础', ids: ['blank', 'title', 'overview', 'table'] },
  {
    category: '投放报告',
    ids: [
      'report-weekly-overview',
      'report-monthly-overview',
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
];

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
      { name: 'Channel Posts', templateId: 'report-posts' },
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
      { name: 'Top Products', templateId: 'report-product' },
      { name: 'Channel Performance', templateId: 'report-channel' },
      { name: 'Top Creator Collaboration', templateId: 'report-creator-collab' },
      { name: 'Channel Posts', templateId: 'report-posts' },
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
    components: () => [],
  },
  {
    id: 'title',
    name: '标题页',
    description: '大标题 + 副标题',
    components: () => {
      const title = t('text', 120, 200, 900, 120);
      (title.data as { content: string; fontSize: number; fontWeight: number }).content = 'Report Title';
      (title.data as { fontSize: number }).fontSize = 48;
      (title.data as { fontWeight: number }).fontWeight = 700;
      const sub = t('text', 120, 340, 900, 60);
      (sub.data as { content: string; fontSize: number }).content = 'Subtitle / Summary';
      (sub.data as { fontSize: number }).fontSize = 20;
      return [title, sub];
    },
  },
  {
    id: 'overview',
    name: '数据概览',
    description: '指标卡片 + 柱状图',
    components: () => {
      const cards = [0, 1, 2].map((i) => {
        const c = t('indicator-card', 80 + i * 300, 80, 260, 110);
        (c.data as { title: string; value: string }).title = `Metric ${i + 1}`;
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
    components: () => {
      const tbl = t('table', 80, 100, 1120, 520);
      return [tbl];
    },
  },
  {
    id: 'creator-page',
    name: '达人介绍页',
    description: '头像卡片 + 数据条 + 作品列表（试点）',
    components: () => {
      // Top title
      const title = t('text', 80, 60, 900, 60);
      (title.data as { content: string; fontSize: number; fontWeight: number }).content = 'Creator Intro';
      (title.data as { fontSize: number }).fontSize = 32;
      (title.data as { fontWeight: number }).fontWeight = 700;
      // In-page business components (each independently draggable/deletable — validates "in-page semantic block" granularity)
      const avatar = t('creator-avatar-card', 80, 150, 360, 120);
      const stats = t('creator-stats-strip', 460, 150, 740, 120);
      const works = t('creator-works-list', 80, 300, 1120, 220);
      return [title, avatar, stats, works];
    },
  },
  {
    id: 'cover-page',
    name: '封面页',
    description: '大标题 + 副标题',
    pageTitleIndex: 0,
    components: () => {
      const title = t('text', 120, 240, 1000, 120);
      (title.data as { content: string; fontSize: number; fontWeight: number }).content = 'Report Title';
      (title.data as { fontSize: number }).fontSize = 56;
      (title.data as { fontWeight: number }).fontWeight = 700;
      const sub = t('text', 120, 380, 1000, 50);
      (sub.data as { content: string; fontSize: number }).content = 'Subtitle / Date / Brand';
      (sub.data as { fontSize: number }).fontSize = 20;
      return [title, sub];
    },
  },
  {
    id: 'agenda-page',
    name: '目录页',
    description: '章节导航表格',
    components: () => {
      const title = t('text', 80, 60, 900, 50);
      (title.data as { content: string; fontSize: number; fontWeight: number }).content = 'Agenda';
      (title.data as { fontSize: number }).fontSize = 32;
      (title.data as { fontWeight: number }).fontWeight = 700;
      const tbl = t('table', 80, 140, 1120, 460);
      (tbl.data as { headers: string[]; rows: string[][] }).headers = ['Section', 'Content'];
      (tbl.data as { rows: string[][] }).rows = [
        ['01', 'Company Intro'],
        ['02', 'Performance Overview'],
        ['03', 'Creator Analysis'],
        ['04', 'Partnership Proposal'],
      ];
      return [title, tbl];
    },
  },
  {
    id: 'company-page',
    name: '公司介绍页',
    description: '简介 + 品牌墙',
    components: () => {
      const title = t('text', 80, 60, 900, 50);
      (title.data as { content: string; fontSize: number; fontWeight: number }).content = 'About Us';
      (title.data as { fontSize: number }).fontSize = 32;
      (title.data as { fontWeight: number }).fontWeight = 700;
      const intro = t('text', 80, 130, 1120, 80);
      (intro.data as { content: string }).content =
        'Content-first: connecting creator resources, media resources, and conversion data to serve 300+ growth-stage brands.';
      const wall = t('brand-wall', 80, 240, 1120, 360);
      return [title, intro, wall];
    },
  },
  {
    id: 'package-page',
    name: '套餐对比页',
    description: '3 个套餐卡片',
    components: () => {
      const title = t('text', 80, 60, 900, 50);
      (title.data as { content: string; fontSize: number; fontWeight: number }).content = 'Package Comparison';
      (title.data as { fontSize: number }).fontSize = 32;
      (title.data as { fontWeight: number }).fontWeight = 700;
      const cardW = 360;
      const gap = 30;
      const startX = (1280 - (cardW * 3 + gap * 2)) / 2;
      const cards = [0, 1, 2].map((i) => {
        const c = t('package-card', Math.round(startX + i * (cardW + gap)), 150, cardW, 460);
        const data = c.data as { name: string; highlighted: boolean };
        if (i === 1) {
          // Middle plan marked as recommended.
          data.name = i === 1 ? 'Growth Booster' : data.name;
          data.highlighted = true;
        }
        return c;
      });
      return [title, ...cards];
    },
  },
  {
    id: 'report-weekly-overview',
    name: '周报 · 业绩概览',
    description: 'KPI 看板 + 下周计划',
    components: () => {
      const title = titleAt('Weekly Status Update', 80, 50);
      const kpi = t('kpi-board', 80, 130, 1120, 200);
      const plan = t('text', 80, 360, 1120, 280);
      (plan.data as { content: string; fontSize: number }).content =
        'Next Week Plan:\n· Add Spark Ads placements\n· Launch 12 sensitive-skin creator posts\n· Focus on low-CVR channels';
      (plan.data as { fontSize: number }).fontSize = 16;
      return [title, kpi, plan];
    },
  },
  {
    id: 'report-monthly-overview',
    name: '月报 · 业绩概览',
    description: 'KPI + 趋势图 + 周期对比 + 洞察',
    components: () => {
      const title = titleAt('Performance Review', 80, 40);
      const kpi = t('kpi-board', 80, 110, 1120, 170);
      const chart = t('bar-chart', 80, 300, 640, 240);
      (chart.data as { title: string }).title = 'Sales Trend';
      const timeline = t('timeline-compare', 760, 300, 440, 240);
      const insight = t('text', 80, 560, 1120, 80);
      (insight.data as { content: string }).content =
        'Insight: Sales +20% YoY, mainly driven by sustained conversion from mid-tier creators; recommend increasing budget for this tier next month.';
      return [title, kpi, chart, timeline, insight];
    },
  },
  {
    id: 'report-channel',
    name: '月报 · 渠道表现',
    description: '渠道核心数据 + 对比表格',
    components: () => {
      const title = titleAt('Performance by Channels', 80, 40);
      // Channel big numbers: reuse kpi-board (compact) to carry Engaged Publishers / Est Impression etc.
      const channelKpi = t('kpi-board', 80, 110, 1120, 90);
      (channelKpi.data as { variant: string }).variant = 'compact';
      (channelKpi.data as { headers: string[]; rows: string[][] }).headers = ['Metric', 'Value', 'Compare'];
      (channelKpi.data as { rows: string[][] }).rows = [
        ['Engaged Publishers', '38', '+6'],
        ['Est Impression', '12.6M', '+18%'],
        ['# of Mega', '6', '+1'],
        ['# of Macro', '24', '+4'],
        ['Reach Platforms', '5', '+0'],
      ];
      const table = t('table', 80, 230, 1120, 320);
      (table.data as { headers: string[]; rows: string[][] }).headers = [
        'Channel',
        'Sales',
        'Clicks',
        'CVR',
        'Publishers',
      ];
      (table.data as { rows: string[][] }).rows = [
        ['Influencer', '¥600K', '80K', '4.1%', '20'],
        ['Content Site', '¥400K', '120K', '2.8%', '18'],
        ['Reddit', '¥180K', '60K', '3.2%', '8'],
      ];
      return [title, channelKpi, table];
    },
  },
  {
    id: 'report-wrapup-review',
    name: '总结 · 业绩复盘',
    description: 'KPI + 周期对比 + 亮点策略',
    components: () => {
      const title = titleAt('Campaign Review', 80, 40);
      const kpi = t('kpi-board', 80, 110, 1120, 170);
      const timeline = t('timeline-compare', 80, 300, 1120, 220);
      (timeline.data as { variant: string }).variant = 'with-bar';
      const works = t('text', 80, 540, 1120, 100);
      (works.data as { content: string }).content =
        'What Works: The 7-day skin diary mechanic significantly lifted saves and add-to-carts.\nChallenge & Strategy: Efficacy expression in the first 3s is weak → next phase: shorter hooks, amplify mid-tier creators.';
      return [title, kpi, timeline, works];
    },
  },
  {
    id: 'report-product',
    name: '月报 · 商品表现',
    description: '热门商品 + AI 洞察',
    components: () => {
      const title = titleAt('Top Products', 80, 40);
      const products = t('product-performance', 80, 110, 1120, 360);
      return [title, products];
    },
  },
  {
    id: 'report-creator-collab',
    name: '月报 · 达人合作详情',
    description: '头像 + 合作数据 + 作品 + 变化说明',
    components: () => {
      const title = titleAt('Top Influencer Collaboration', 80, 40);
      // Orchestrate the existing creator trio (validates cross-page reuse of business components).
      const avatar = t('creator-avatar-card', 80, 110, 440, 120);
      const stats = t('creator-stats-strip', 560, 110, 640, 120);
      // Partnership metrics override default follower data.
      (stats.data as { stats: { label: string; value: string; color: string }[] }).stats = [
        { label: 'Impressions', value: '2.4M', color: '#FF5C00' },
        { label: 'Engagement Rate', value: '9.1%', color: '#3B82F6' },
        { label: 'Sales', value: '¥186K', color: '#22C55E' },
        { label: 'ROAS', value: '4.2x', color: '#8B5CF6' },
      ];
      const works = t('creator-works-list', 80, 260, 1120, 200);
      const note = t('text', 80, 480, 1120, 80);
      (note.data as { content: string }).content =
        "Change Note: This creator's promo volume rose 18% this period, mainly driven by repeat purchases from the 7-day diary content line; recommend continuing this mechanic next period and adding 2 hero-post replicas.";
      return [title, avatar, stats, works, note];
    },
  },
  {
    id: 'report-placement',
    name: '月报 · DM 广告位',
    description: '广告位截图 + 亮点/经验',
    components: () => {
      const title = titleAt('Placement Display', 80, 40);
      const placement = t('placement-display', 80, 110, 1120, 320);
      (placement.data as { variant: string }).variant = 'with-text';
      return [title, placement];
    },
  },
  {
    id: 'report-posts',
    name: '月报 · 渠道贴文',
    description: '内容站 / Reddit / FB 贴文列表',
    components: () => {
      const title = titleAt('Channel Posts', 80, 40);
      const posts = t('post-list', 80, 110, 1120, 320);
      return [title, posts];
    },
  },

  /* -------- legacy full-page layouts → page templates (split into common/business component orchestrations) -------- */

  {
    id: 'milestone-page',
    name: '公司里程碑',
    description: '标题 + 里程碑表格 + 简介',
    components: () =>
      tablePage(
        'Company Milestones',
        ['Year', 'Milestone'],
        [
          ['2019', 'Business Launched'],
          ['2022', 'Served 100+ Brands'],
          ['2024', 'AI Marketing Capabilities Live'],
          ['2026', 'Global Coverage'],
        ],
        'From zero to global: every step focused on real content-driven brand growth.',
      ),
  },
  {
    id: 'global-page',
    name: '全球布局',
    description: '标题 + 区域布局表格',
    components: () =>
      tablePage('Global Business Network', ['Region', 'Offices', 'Creator Resources'], [
        ['APAC', '3', '420+'],
        ['North America', '2', '280+'],
        ['Europe', '1', '180+'],
        ['Middle East', '0', '120+'],
      ]),
  },
  {
    id: 'org-page',
    name: '组织架构',
    description: '标题 + 团队构成表格',
    components: () =>
      tablePage('Strategy × Creative × Ops × Data', ['Function', 'Share', 'Responsibility'], [
        ['Strategy Consulting', '20%', 'Growth diagnosis & creator strategy'],
        ['Creative Content', '25%', 'Content solution co-creation'],
        ['Media Ops', '35%', 'Media buying & creator ops'],
        ['Data & Tech', '20%', 'Attribution & review'],
      ]),
  },
  {
    id: 'service-page',
    name: '核心服务矩阵',
    description: '标题 + 服务列表表格',
    components: () =>
      tablePage('From Audience Insight to Business Growth', ['Service', 'Description'], [
        ['Creator Strategy & Recruiting', 'Match creators by category'],
        ['TikTok Content Buying', 'Spark Ads acceleration'],
        ['Social Media Buying', 'Multi-platform mix'],
        ['AI Data Attribution', 'Traceable performance'],
      ]),
  },
  {
    id: 'challenge-page',
    name: '机会与挑战',
    description: '标题 + 机会/挑战表格',
    components: () =>
      tablePage(
        'Opportunities & Challenges',
        ['Dimension', 'Opportunity', 'Challenge'],
        [
          ['Audience', '18–24 high-potential', 'Weak mind-share'],
          ['Content', 'Credible UGC endorsement', 'Heavy homogenization'],
          ['Segment', 'Sensitive-skin blue ocean', 'High category-education cost'],
        ],
        'Seize the efficacy-visualization content window; amplify mid-tier creator conversion.',
      ),
  },
  {
    id: 'process-page',
    name: '合作评估流程',
    description: '标题 + 流程步骤表格',
    components: () =>
      tablePage('4 Weeks from Brief to Launch', ['Step', 'Core Work', 'Goal'], [
        ['1', 'Brand Growth Diagnosis', 'Define KPIs'],
        ['2', 'Creator Resource Evaluation', 'Match-rank sorting'],
        ['3', 'Content Solution Co-creation', 'Finalize scripts'],
        ['4', 'Launch, Review & Iterate', 'Performance attribution'],
      ]),
  },
  {
    id: 'calendar-page',
    name: '营销日历',
    description: '标题 + 节点规划表格',
    components: () =>
      tablePage('2026 Content Marketing Cadence', ['Milestone', 'Theme', 'Action'], [
        ['Spring', 'Refresh & seed', 'Launch new content'],
        ['618', 'Concentrated conversion', 'Mega-creator boost'],
        ['Back-to-School', 'Scenario penetration', 'Mid-tier scale-up'],
        ['Black Friday & Christmas', 'Gifting surge', 'Spark Ads'],
      ]),
  },
  {
    id: 'campaign-plan-page',
    name: '投放计划',
    description: '标题 + 阶段路线图表格',
    components: () =>
      tablePage('30-Day TikTok Growth Path', ['Stage', 'Action', 'Goal'], [
        ['Warm-up', 'Seed-creator seeding', 'Demand pool'],
        ['Ignite', 'Mega-creator burst', 'Buzz'],
        ['Scale', 'Spark Ads boost', 'Reach'],
        ['Review', 'GMV & reviews', 'Attribution'],
      ]),
  },
  {
    id: 'case-page',
    name: '案例展示',
    description: '标题 + 成果卡片 + 案例作品 + 文案',
    components: () => {
      const title = titleAt('Case Study', 80, 50);
      const cards = [0, 1, 2, 3].map((i) => {
        const c = t('indicator-card', 80 + i * 280, 130, 260, 90);
        const d = c.data as { title: string; value: string; colorTheme: string };
        d.title = ['Impressions', 'GMV Achievement', 'Engagement Rate', 'Partner Creators'][i];
        d.value = ['12.6M', '138%', '8.7%', '70'][i];
        d.colorTheme = ['orange', 'green', 'blue', 'purple'][i];
        return c;
      });
      const works = t('creator-works-list', 80, 250, 1120, 200);
      const narrative = textAt(80, 480, 1120, 100, 'Linking reviews, seeding, and instant conversion via the "7-day skin diary" content line.');
      return [title, ...cards, works, narrative];
    },
  },
  {
    id: 'content-analysis-page',
    name: '内容分析',
    description: '标题 + 内容类型分布柱状图 + 明细表格',
    components: () => {
      const title = titleAt('Content Performance & Conversion Analysis', 80, 50);
      const chart = t('bar-chart', 80, 130, 560, 260);
      (chart.data as { title: string; bars: { label: string; value: number; color: string }[] }).title = 'Content Type Distribution';
      (chart.data as { bars: { label: string; value: number; color: string }[] }).bars = [
        { label: 'UGC Review', value: 46, color: '#FF5C00' },
        { label: 'Creator Demo', value: 31, color: '#3B82F6' },
        { label: 'Ingredient Education', value: 15, color: '#22C55E' },
        { label: 'Gifting', value: 8, color: '#8B5CF6' },
      ];
      const tbl = tableAt(680, 130, 520, 260, ['Type', 'View Share', 'Top Keywords'], [
        ['UGC Review', '46%', 'gentle / glow'],
        ['Creator Demo', '31%', 'effect / authentic'],
        ['Ingredient Education', '15%', 'safe / gentle'],
      ]);
      return [title, chart, tbl];
    },
  },
  {
    id: 'funnel-page',
    name: '增长漏斗',
    description: '标题 + 漏斗阶段柱状图',
    components: () => {
      const title = titleAt('Content-Driven Conversion Funnel', 80, 50);
      const chart = t('bar-chart', 80, 130, 1120, 360);
      (chart.data as { title: string; bars: { label: string; value: number; color: string }[] }).title = 'From Impressions to Orders';
      (chart.data as { bars: { label: string; value: number; color: string }[] }).bars = [
        { label: 'Impressions', value: 1260, color: '#FF5C00' },
        { label: 'Reach', value: 810, color: '#F97316' },
        { label: 'Interactions', value: 110, color: '#3B82F6' },
        { label: 'Orders', value: 84, color: '#22C55E' },
      ];
      return [title, chart];
    },
  },
];
