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
}

/** Get a page template by id. */
export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/** Page template categories (grouped in the "New Page" dialog). Order = display order. */
export const TEMPLATE_CATEGORIES: { category: string; ids: string[] }[] = [
  { category: 'Basic', ids: ['blank', 'title', 'overview', 'table'] },
  {
    category: 'Campaign Reports',
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
    category: 'Company · Brand',
    ids: ['cover-page', 'agenda-page', 'company-page', 'package-page', 'milestone-page', 'global-page', 'org-page', 'service-page'],
  },
  { category: 'Creators · Cases', ids: ['creator-page', 'case-page'] },
  {
    category: 'Strategy · Content',
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
    name: 'Blank',
    description: 'Start from scratch',
    components: () => [],
  },
  {
    id: 'title',
    name: 'Title Page',
    description: 'Big title + subtitle',
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
    name: 'Data Overview',
    description: 'Indicator cards + bar chart',
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
    name: 'Table Page',
    description: 'Data table',
    components: () => {
      const tbl = t('table', 80, 100, 1120, 520);
      return [tbl];
    },
  },
  {
    id: 'creator-page',
    name: 'Creator Intro Page',
    description: 'Avatar card + stats strip + works list (pilot)',
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
    name: 'Cover Page',
    description: 'Big title + subtitle',
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
    name: 'Agenda Page',
    description: 'Section navigation table',
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
    name: 'Company Page',
    description: 'Intro + brand wall',
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
    name: 'Package Comparison Page',
    description: '3 package cards',
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
    name: 'Weekly · Performance Overview',
    description: 'KPI board + next-week plan',
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
    name: 'Monthly · Performance Overview',
    description: 'KPI + trend chart + period comparison + Insight',
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
    name: 'Monthly · Channel Performance',
    description: 'Channel big numbers + comparison table',
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
    name: 'Wrap-up · Performance Review',
    description: 'KPI + period comparison + What Works',
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
    name: 'Monthly · Product Performance',
    description: 'Top products + AI insight',
    components: () => {
      const title = titleAt('Top Products', 80, 40);
      const products = t('product-performance', 80, 110, 1120, 360);
      return [title, products];
    },
  },
  {
    id: 'report-creator-collab',
    name: 'Monthly · Creator Collaboration Details',
    description: 'Avatar + partnership data + works + change note',
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
    name: 'Monthly · DM Placements',
    description: 'Placement screenshots + highlights/learnings',
    components: () => {
      const title = titleAt('Placement Display', 80, 40);
      const placement = t('placement-display', 80, 110, 1120, 320);
      (placement.data as { variant: string }).variant = 'with-text';
      return [title, placement];
    },
  },
  {
    id: 'report-posts',
    name: 'Monthly · Channel Posts',
    description: 'Content Site / Reddit / FB Post list',
    components: () => {
      const title = titleAt('Channel Posts', 80, 40);
      const posts = t('post-list', 80, 110, 1120, 320);
      return [title, posts];
    },
  },

  /* -------- legacy full-page layouts → page templates (split into common/business component orchestrations) -------- */

  {
    id: 'milestone-page',
    name: 'Company Milestones',
    description: 'Title + milestone table + intro',
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
    name: 'Global Footprint',
    description: 'Title + regional layout table',
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
    name: 'Org Structure',
    description: 'Title + team breakdown table',
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
    name: 'Core Service Matrix',
    description: 'Title + service list table',
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
    name: 'Opportunities & Challenges',
    description: 'Title + opportunity/challenge table',
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
    name: 'Partnership Evaluation Process',
    description: 'Title + process steps table',
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
    name: 'Marketing Calendar',
    description: 'Title + seasonal milestones table',
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
    name: 'Campaign Plan',
    description: 'Title + stage roadmap table',
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
    name: 'Case Study',
    description: 'Title + result cards + case works + copy',
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
    name: 'Content Analysis',
    description: 'Title + content-type distribution bar chart + detail table',
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
    name: 'Growth Funnel',
    description: 'Title + funnel-stage bar chart',
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
