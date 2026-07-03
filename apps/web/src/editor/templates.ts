import type { ComponentType, EditorComponent } from '@mediakit/shared';
import { getDefaultData } from './defaults';

/**
 * 页面模板目录（M3 精简版：由基础组件拼成）。
 * demo 的完整业务模板（cover/funnel/...）依赖业务组件，留 M4 落地。
 * 组件 id 为占位，addPageWithComponents 会重新分配。
 */
export interface Template {
  id: string;
  name: string;
  description: string;
  components: () => EditorComponent[];
}

/** 根据 id 取页面模板。 */
export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/* ----------------------------- 场景模板（第④层）----------------------------- */
// 把多个页面模板串成一份完整报告（一键生成多页）。引用 TEMPLATES 里的页面模板 id。

export interface ScenarioPage {
  /** 页面名（侧栏显示）。 */
  name: string;
  /** 引用的页面模板 id（见 TEMPLATES）。 */
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
    name: 'Campaign 双周报',
    description: '8 页 · 业绩 + 渠道 + 广告位 + 达人 + 套餐',
    pages: [
      { name: '封面', templateId: 'cover-page' },
      { name: '业绩概览', templateId: 'report-monthly-overview' },
      { name: '渠道拆分', templateId: 'report-channel' },
      { name: '渠道 Post', templateId: 'report-posts' },
      { name: 'DM 广告位', templateId: 'report-placement' },
      { name: '合作达人', templateId: 'creator-page' },
      { name: '套餐', templateId: 'package-page' },
      { name: '封底', templateId: 'cover-page' },
    ],
  },
  {
    id: 'monthly',
    name: 'Campaign 月报',
    description: '14 页 · 章节分隔 + 业绩/商品/渠道/达人/广告位/套餐',
    pages: [
      { name: '编辑说明（不导出）', templateId: 'blank' },
      { name: '封面', templateId: 'cover-page' },
      { name: 'PART 1 · Performance', templateId: 'title' },
      { name: '业绩概览', templateId: 'report-monthly-overview' },
      { name: 'TOP 商品', templateId: 'report-product' },
      { name: '渠道表现', templateId: 'report-channel' },
      { name: '头部达人合作', templateId: 'report-creator-collab' },
      { name: '渠道 Post', templateId: 'report-posts' },
      { name: 'DM 广告位', templateId: 'report-placement' },
      { name: 'PART 2 · Optimization', templateId: 'title' },
      { name: '套餐', templateId: 'package-page' },
      { name: '推荐达人', templateId: 'creator-page' },
      { name: '达人详情', templateId: 'creator-page' },
      { name: '封底', templateId: 'cover-page' },
    ],
  },
];

function t(type: ComponentType, x: number, y: number, w: number, h: number): EditorComponent {
  return { id: `tpl-${type}-${x}-${y}`, type, x, y, w, h, data: getDefaultData(type) };
}

/** 页面标题文本块（大字号粗体）。 */
function titleAt(content: string, x: number, y: number, w = 1120, h = 50): EditorComponent {
  const title = t('text', x, y, w, h);
  const data = title.data as { content: string; fontSize: number; fontWeight: number };
  data.content = content;
  data.fontSize = 28;
  data.fontWeight = 700;
  return title;
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
      (title.data as { content: string; fontSize: number; fontWeight: number }).content = '报告标题';
      (title.data as { fontSize: number }).fontSize = 48;
      (title.data as { fontWeight: number }).fontWeight = 700;
      const sub = t('text', 120, 340, 900, 60);
      (sub.data as { content: string; fontSize: number }).content = '副标题 / 摘要说明';
      (sub.data as { fontSize: number }).fontSize = 20;
      return [title, sub];
    },
  },
  {
    id: 'overview',
    name: '数据概览',
    description: '指标卡 + 柱状图',
    components: () => {
      const cards = [0, 1, 2].map((i) => {
        const c = t('indicator-card', 80 + i * 300, 80, 260, 110);
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
    components: () => {
      const tbl = t('table', 80, 100, 1120, 520);
      return [tbl];
    },
  },
  {
    id: 'creator-page',
    name: '达人介绍页',
    description: '头像卡 + 数据条 + 作品列表（试点）',
    components: () => {
      // 顶部标题
      const title = t('text', 80, 60, 900, 60);
      (title.data as { content: string; fontSize: number; fontWeight: number }).content = '达人介绍';
      (title.data as { fontSize: number }).fontSize = 32;
      (title.data as { fontWeight: number }).fontWeight = 700;
      // 页内业务组件（各自独立可拖拽/删除 —— 验证"页内语义块"粒度）
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
    components: () => {
      const title = t('text', 120, 240, 1000, 120);
      (title.data as { content: string; fontSize: number; fontWeight: number }).content = '报告标题';
      (title.data as { fontSize: number }).fontSize = 56;
      (title.data as { fontWeight: number }).fontWeight = 700;
      const sub = t('text', 120, 380, 1000, 50);
      (sub.data as { content: string; fontSize: number }).content = '副标题 / 时间 / 品牌';
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
      (title.data as { content: string; fontSize: number; fontWeight: number }).content = '目录';
      (title.data as { fontSize: number }).fontSize = 32;
      (title.data as { fontWeight: number }).fontWeight = 700;
      const tbl = t('table', 80, 140, 1120, 460);
      (tbl.data as { headers: string[]; rows: string[][] }).headers = ['章节', '内容'];
      (tbl.data as { rows: string[][] }).rows = [
        ['01', '公司介绍'],
        ['02', '业绩概览'],
        ['03', '达人分析'],
        ['04', '合作提案'],
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
      (title.data as { content: string; fontSize: number; fontWeight: number }).content = '关于我们';
      (title.data as { fontSize: number }).fontSize = 32;
      (title.data as { fontWeight: number }).fontWeight = 700;
      const intro = t('text', 80, 130, 1120, 80);
      (intro.data as { content: string }).content =
        '以内容为核心，连接达人资源、媒体资源与转化数据，服务 300+ 增长型品牌。';
      const wall = t('brand-wall', 80, 240, 1120, 360);
      return [title, intro, wall];
    },
  },
  {
    id: 'package-page',
    name: '套餐对比页',
    description: '3 个套餐卡',
    components: () => {
      const title = t('text', 80, 60, 900, 50);
      (title.data as { content: string; fontSize: number; fontWeight: number }).content = '套餐对比';
      (title.data as { fontSize: number }).fontSize = 32;
      (title.data as { fontWeight: number }).fontWeight = 700;
      const cardW = 360;
      const gap = 30;
      const startX = (1280 - (cardW * 3 + gap * 2)) / 2;
      const cards = [0, 1, 2].map((i) => {
        const c = t('package-card', Math.round(startX + i * (cardW + gap)), 150, cardW, 460);
        const data = c.data as { name: string; highlighted: boolean };
        if (i === 1) {
          // 中间方案设为推荐。
          data.name = i === 1 ? '增长加速包' : data.name;
          data.highlighted = true;
        }
        return c;
      });
      return [title, ...cards];
    },
  },
  {
    id: 'report-weekly-overview',
    name: '周报·业绩概览',
    description: 'KPI 看板 + 下周计划',
    components: () => {
      const title = titleAt('Weekly Status Update', 80, 50);
      const kpi = t('kpi-board', 80, 130, 1120, 200);
      const plan = t('text', 80, 360, 1120, 280);
      (plan.data as { content: string; fontSize: number }).content =
        '下周计划：\n· 追加 Spark Ads 投放\n· 上线 12 位敏感肌达人内容\n· 重点跟进转化率偏低的渠道';
      (plan.data as { fontSize: number }).fontSize = 16;
      return [title, kpi, plan];
    },
  },
  {
    id: 'report-monthly-overview',
    name: '月报·业绩概览',
    description: 'KPI + 趋势图 + 周期对比 + Insight',
    components: () => {
      const title = titleAt('Performance Review', 80, 40);
      const kpi = t('kpi-board', 80, 110, 1120, 170);
      const chart = t('bar-chart', 80, 300, 640, 240);
      (chart.data as { title: string }).title = 'Sales 趋势';
      const timeline = t('timeline-compare', 760, 300, 440, 240);
      const insight = t('text', 80, 560, 1120, 80);
      (insight.data as { content: string }).content =
        'Insight：本期销售额同比 +20%，主要由中腰部创作者的持续转化驱动；下月建议加大该层级预算。';
      return [title, kpi, chart, timeline, insight];
    },
  },
  {
    id: 'report-channel',
    name: '月报·渠道表现',
    description: '渠道大数字 + 渠道对比表',
    components: () => {
      const title = titleAt('Performance by Channels', 80, 40);
      // 渠道大数字：复用 kpi-board（compact）承载 Engaged Publishers / Est Impression 等。
      const channelKpi = t('kpi-board', 80, 110, 1120, 90);
      (channelKpi.data as { variant: string }).variant = 'compact';
      (channelKpi.data as { headers: string[]; rows: string[][] }).headers = ['指标', '数值', '对比'];
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
    name: '结案·业绩复盘',
    description: 'KPI + 周期对比 + What Works',
    components: () => {
      const title = titleAt('Campaign 复盘', 80, 40);
      const kpi = t('kpi-board', 80, 110, 1120, 170);
      const timeline = t('timeline-compare', 80, 300, 1120, 220);
      (timeline.data as { variant: string }).variant = 'with-bar';
      const works = t('text', 80, 540, 1120, 100);
      (works.data as { content: string }).content =
        'What Works：7 天肌肤日记机制显著提升收藏与加购。\nChallenge & Strategy：前 3 秒功效表达偏弱 → 下一阶段缩短钩子、放大中腰部创作者。';
      return [title, kpi, timeline, works];
    },
  },
  {
    id: 'report-product',
    name: '月报·商品表现',
    description: 'TOP 商品 + AI 洞察',
    components: () => {
      const title = titleAt('Top Products', 80, 40);
      const products = t('product-performance', 80, 110, 1120, 360);
      return [title, products];
    },
  },
  {
    id: 'report-creator-collab',
    name: '月报·达人合作详情',
    description: '头像 + 合作数据 + 作品 + 变动说明',
    components: () => {
      const title = titleAt('Top Influencer Collaboration', 80, 40);
      // 编排已有 creator 三件套（验证业务组件跨页复用）。
      const avatar = t('creator-avatar-card', 80, 110, 440, 120);
      const stats = t('creator-stats-strip', 560, 110, 640, 120);
      // 合作指标覆盖默认粉丝数据。
      (stats.data as { stats: { label: string; value: string; color: string }[] }).stats = [
        { label: '曝光', value: '2.4M', color: '#FF5C00' },
        { label: '互动率', value: '9.1%', color: '#3B82F6' },
        { label: '销售额', value: '¥186K', color: '#22C55E' },
        { label: 'ROAS', value: '4.2x', color: '#8B5CF6' },
      ];
      const works = t('creator-works-list', 80, 260, 1120, 200);
      const note = t('text', 80, 480, 1120, 80);
      (note.data as { content: string }).content =
        '合作变动说明：本期该达人推广量上升 18%，主因为 7 天日记内容线带动复购；建议下期延续该机制并增加 2 条爆款复刻。';
      return [title, avatar, stats, works, note];
    },
  },
  {
    id: 'report-placement',
    name: '月报·DM 广告位',
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
    name: '月报·渠道 Post',
    description: 'Content Site / Reddit / FB Post 列表',
    components: () => {
      const title = titleAt('Channel Posts', 80, 40);
      const posts = t('post-list', 80, 110, 1120, 320);
      return [title, posts];
    },
  },
];
