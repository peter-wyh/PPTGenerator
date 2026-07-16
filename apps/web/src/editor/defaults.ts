/**
 * 组件默认尺寸 / 默认数据。供 editor store（addComponent）与 REGISTRY 共用，
 * 避免循环依赖（REGISTRY 含 React 组件）。忠实 demo.html。
 */
import type { ComponentType, ComponentData, CreatorAvatarCardData, MetaStripData, ShapeKind, ShapeData } from '@mediakit/shared';
import { AUDIENCE_MODULE_CATALOG } from '@mediakit/shared';

export const DEFAULT_SIZES: Record<ComponentType, { w: number; h: number }> = {
  text: { w: 300, h: 60 },
  image: { w: 300, h: 200 },
  'indicator-card': { w: 240, h: 100 },
  'bar-chart': { w: 500, h: 300 },
  'line-chart': { w: 500, h: 300 },
  'pie-chart': { w: 300, h: 300 },
  table: { w: 500, h: 250 },
  'business-block': { w: 760, h: 430 },
  'creator-avatar-card': { w: 320, h: 120 },
  'creator-stats-strip': { w: 600, h: 100 },
  'creator-works-list': { w: 700, h: 200 },
  'creator-list': { w: 700, h: 300 },
  'brand-wall': { w: 700, h: 200 },
  'package-card': { w: 320, h: 320 },
  'kpi-board': { w: 900, h: 240 },
  'meta-strip': { w: 600, h: 80 },
  'strategy-block': { w: 600, h: 200 },
  'timeline-compare': { w: 900, h: 240 },
  'product-performance': { w: 900, h: 280 },
  'placement-display': { w: 700, h: 280 },
  'post-list': { w: 900, h: 240 },
  'creator-fan-gender': { w: 320, h: 280 },
  'creator-fan-city': { w: 420, h: 320 },
  'creator-fan-age': { w: 420, h: 300 },
  'creator-fan-interest': { w: 420, h: 280 },
  'work-screenshot': { w: 600, h: 420 },
  'work-metrics': { w: 560, h: 320 },
  'comment-wordcloud': { w: 560, h: 360 },
  'shape': { w: 200, h: 120 },
  'image-group': { w: 600, h: 420 },
  'title-block': { w: 600, h: titleHeightForFontSize(32, { subtitle: true, divider: true }) },
  'campaign-analysis': { w: 520, h: 360 },
  'creator-work-metrics': { w: 560, h: 280 },
  'creator-works-table': { w: 700, h: 320 },
  'content-card': { w: 360, h: 240 },
  'swot-matrix': { w: 560, h: 400 },
  // Campaign 强关联组件
  'campaign-summary': { w: 720, h: 200 },
  'funnel-chart': { w: 480, h: 360 },
  'revenue-timeline': { w: 640, h: 320 },
  'publisher-table': { w: 640, h: 320 },
  'geo-distribution': { w: 480, h: 280 },
  'placement-wide-table': { w: 720, h: 320 },
  'placement-type-summary': { w: 640, h: 320 },
  'device-breakdown': { w: 480, h: 200 },
  'content-topic-performance': { w: 640, h: 280 },
  'search-term-table': { w: 560, h: 280 },
  'hourly-heatmap': { w: 560, h: 200 },
  'creator-audience-profile': { w: 720, h: 360 },
};

/** 兜底网格大小（theme.layout.gridSize 不可得时回退，如未加载项目态）。 */
export const DEFAULT_GRID_SIZE = 10;
/** 缩放最小尺寸（demo：w≥40, h≥20）。 */
export const MIN_W = 40;
export const MIN_H = 20;
/** 缩放范围（demo：0.10–2.00）。 */
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 2;
/** history 上限（demo：50）。 */
export const HISTORY_CAP = 50;

/**
 * 标题块高度 = 字号派生:字号×行高 + (副标题一行) + (分割线) + 上下内边距。
 * 用于:新建标题块的默认 h、改字号(全局/单组件)时重算 h,使高度随字号自适应。
 */
export function titleHeightForFontSize(
  fontSize: number,
  opts: { subtitle?: boolean; divider?: boolean } = {},
): number {
  const titleLh = 1.25;
  let h = Math.round(fontSize * titleLh);
  if (opts.subtitle) h += Math.round(fontSize * 0.6 * titleLh);
  if (opts.divider) h += 4;
  return h + 8; // 上下内边距
}

export function getDefaultData(type: ComponentType): ComponentData {
  switch (type) {
    case 'text':
      return {
        content: 'Title',
        fontSize: 28,
        fontFamily: '',
        fontWeight: 700,
        color: 'var(--foreground-primary)',
      };
    case 'indicator-card':
      return { variant: 'plain', title: 'Metric name', value: '---', colorTheme: 'blue' };
    case 'bar-chart':
      return {
        title: 'Bar Chart',
        variant: 'vertical' as const,
        bars: [
          { label: 'A', value: 80, color: 'auto' },
          { label: 'B', value: 60, color: 'auto' },
          { label: 'C', value: 40, color: 'auto' },
        ],
      };
    case 'line-chart':
      return {
        title: 'Line Chart',
        series: [
          {
            name: 'Series 1',
            color: 'auto',
            points: [
              { label: 'Mon', value: 30 },
              { label: 'Tue', value: 60 },
              { label: 'Wed', value: 45 },
              { label: 'Thu', value: 80 },
              { label: 'Fri', value: 55 },
            ],
          },
        ],
      };
    case 'pie-chart':
      return {
        title: 'Pie Chart',
        slices: [
          { label: 'A', value: 40, color: 'auto' },
          { label: 'B', value: 30, color: 'auto' },
          { label: 'C', value: 30, color: 'auto' },
        ],
      };
    case 'table':
      return {
        headers: ['Col 1', 'Col 2', 'Col 3'],
        rows: [
          ['--', '--', '--'],
          ['--', '--', '--'],
        ],
      };
    case 'image':
      return { src: '', fit: 'cover' };
    case 'business-block':
      return {
        businessKind: 'cover',
        title: 'Business block',
        meta: '',
        details: [],
        variant: 'standard',
      };
    case 'creator-avatar-card':
      return {
        variant: 'horizontal',
        avatar: '',
        name: '达人名称',
        platform: 'tiktok',
        platforms: ['tiktok', 'instagram'],
        tier: 'macro',
        intro: '达人定位 · 社交账号',
      } as CreatorAvatarCardData;
    case 'creator-stats-strip':
      return {
        variant: 'cards',
        stats: [
          { key: 'followers', label: 'Followers', value: '--', color: 'auto', selected: true },
          { key: 'engagement', label: 'Engagement Rate', value: '--', color: 'auto', selected: true },
          { key: 'reach', label: 'Avg. Reach', value: '--', color: 'auto', selected: true },
          { key: 'impressions', label: 'Impressions', value: '--', color: 'auto', selected: true },
        ],
      };
    case 'creator-works-list':
      return {
        variant: 'cards',
        headers: ['Cover', 'Title', 'Shares', 'Likes', 'Comments'],
        rows: [
          ['', '作品标题一', '--', '--', '--'],
          ['', '作品标题二', '--', '--', '--'],
          ['', '作品标题三', '--', '--', '--'],
        ],
        insights: [
          {
            topCities: [
              { label: 'New York', value: 23, color: 'auto' },
              { label: 'Los Angeles', value: 18, color: 'auto' },
              { label: 'Chicago', value: 12, color: 'auto' },
              { label: 'Houston', value: 9, color: 'auto' },
            ],
            genderSplit: [
              { label: 'F', value: 72, color: 'auto' },
              { label: 'M', value: 28, color: 'auto' },
            ],
            ageRange: [
              { label: '18-24', value: 35, color: 'auto' },
              { label: '25-34', value: 42, color: 'auto' },
              { label: '35-44', value: 15, color: 'auto' },
              { label: '45+', value: 8, color: 'auto' },
            ],
            trend: [
              { label: 'D1', value: 12000 },
              { label: 'D2', value: 28000 },
              { label: 'D3', value: 45000 },
              { label: 'D4', value: 52000 },
              { label: 'D5', value: 61000 },
              { label: 'D6', value: 78000 },
              { label: 'D7', value: 86000 },
            ],
            trendLabel: 'Views',
          },
          {
            topCities: [
              { label: 'Houston', value: 21, color: 'auto' },
              { label: 'Miami', value: 16, color: 'auto' },
              { label: 'Seattle', value: 11, color: 'auto' },
            ],
            genderSplit: [
              { label: 'F', value: 85, color: 'auto' },
              { label: 'M', value: 15, color: 'auto' },
            ],
            ageRange: [
              { label: '18-24', value: 48, color: 'auto' },
              { label: '25-34', value: 32, color: 'auto' },
              { label: '35-44', value: 14, color: 'auto' },
            ],
            trend: [
              { label: 'D1', value: 8000 },
              { label: 'D2', value: 15000 },
              { label: 'D3', value: 22000 },
              { label: 'D4', value: 38000 },
              { label: 'D5', value: 44000 },
              { label: 'D6', value: 51000 },
              { label: 'D7', value: 54000 },
            ],
            trendLabel: 'Engagement',
          },
          {
            topCities: [
              { label: 'Austin', value: 19, color: 'auto' },
              { label: 'Denver', value: 14, color: 'auto' },
            ],
            genderSplit: [
              { label: 'F', value: 68, color: 'auto' },
              { label: 'M', value: 32, color: 'auto' },
            ],
            ageRange: [
              { label: '18-24', value: 29, color: 'auto' },
              { label: '25-34', value: 47, color: 'auto' },
            ],
            trend: [
              { label: 'D1', value: 5000 },
              { label: 'D2', value: 12000 },
              { label: 'D3', value: 18000 },
              { label: 'D4', value: 25000 },
              { label: 'D5', value: 32000 },
              { label: 'D6', value: 38000 },
              { label: 'D7', value: 42000 },
            ],
            trendLabel: 'Views',
          },
        ],
      };
    case 'creator-list':
      return {
        variant: 'table',
        headers: ['Avatar', 'Name', 'Platform', 'Followers', 'Engagement', 'Category'],
        rows: [
          ['', '达人一', 'xiaohongshu', '--', '--', '分类一'],
          ['', '达人二', 'douyin', '--', '--', '分类二'],
          ['', '达人三', 'instagram', '--', '--', '分类三'],
          ['', '达人四', 'youtube', '--', '--', '分类四'],
          ['', '达人五', 'tiktok', '--', '--', '分类五'],
        ],
      };
    case 'brand-wall':
      return {
        variant: 'grid',
        headers: ['Brand', 'Logo URL'],
        rows: [
          ['品牌一', ''],
          ['品牌二', ''],
          ['品牌三', ''],
          ['品牌四', ''],
          ['品牌五', ''],
          ['品牌六', ''],
        ],
      };
    case 'package-card':
      return {
        variant: 'standard',
        name: '套餐名称',
        price: '--',
        headers: ['Feature'],
        rows: [
          ['套餐要点一'],
          ['套餐要点二'],
          ['套餐要点三'],
          ['套餐要点四'],
        ],
        highlighted: false,
      };
    case 'kpi-board':
      return {
        variant: 'grid',
        headers: ['Metric', 'Value', 'Compare'],
        rows: [
          ['GMV', '--', '--'],
          ['Commission', '--', '--'],
          ['ROAS', '--', '--'],
          ['Clicks', '--', '--'],
          ['Conversions', '--', '--'],
          ['CVR', '--', '--'],
          ['AOV', '--', '--'],
          ['Spend', '--', '--'],
          ['Impressions', '--', '--'],
        ],
        icons: ['currency', 'currency', 'target', 'eye', 'cart', 'percent', 'currency', 'currency', 'eye'],
        valueColors: [null, null, null, null, null, null, null, null, null],
        compareLabel: 'vs last period',
      };
    case 'meta-strip':
      return {
        variant: 'inline',
        headers: ['Icon', 'Label', 'Text'],
        rows: [
          ['target', 'BASE', '文本'],
          ['tag', 'TYPE', '品类'],
          ['trophy', 'TIER', '等级'],
        ],
      } as MetaStripData;
    case 'strategy-block':
      return {
        // variant 缺省 = 'default'（见 StrategyBlockComponent）；此处省略以避开与 PlacementData 的联合类型歧义。
        headers: ['Icon', 'Title', 'Content'],
        rows: [
          ['sparkle', 'INSIGHT', 'My audience values authenticity and practical <mark>beauty tips</mark>.'],
          ['target', 'STRATEGY', 'Focus on practical <mark>beauty tips</mark> and authentic product reviews.'],
        ],
      };
    case 'timeline-compare':
      return {
        variant: 'standard',
        headers: ['Metric', 'Current', 'Previous', 'Status'],
        rows: [
          ['Total Sales', '$1.24M', '$1.08M', 'Exceeded'],
          ['Total Reach', '8.1M', '7.0M', 'Exceeded'],
          ['Conversion', '3.8%', '4.0%', 'Stable'],
          ['Engagement', '8.7%', '6.2%', 'Optimized'],
        ],
      };
    case 'product-performance':
      return {
        variant: 'cards',
        insight: '',
        headers: ['Product', 'Image URL', 'Sales', 'Share', 'Category'],
        rows: [
          ['产品一', '', '--', '--', '品类一'],
          ['产品二', '', '--', '--', '品类一'],
          ['产品三', '', '--', '--', '品类二'],
          ['产品四', '', '--', '--', '品类三'],
          ['产品五', '', '--', '--', '品类一'],
        ],
      };
    case 'placement-display':
      return {
        variant: 'grid',
        highlights: '',
        learnings: '',
        headers: ['Name', 'Screenshot URL', 'Data'],
        rows: [
          ['资源位一', '', '--'],
          ['资源位二', '', '--'],
          ['资源位三', '', '--'],
        ],
      };
    case 'post-list':
      return {
        variant: 'cards',
        headers: ['Screenshot URL', 'Title', 'ID', 'Link', 'Data'],
        rows: [
          ['', '内容标题一', 'ID-001', '', '--'],
          ['', '内容标题二', 'ID-002', '', '--'],
          ['', '内容标题三', 'ID-003', '', '--'],
        ],
      };
    case 'creator-fan-gender':
      return {
        title: 'Fan Gender Breakdown',
        subtitle: 'Female-led',
        center: 'Female 62%',
        slices: [
          { label: 'Female', value: 62, color: 'auto' },
          { label: 'Male', value: 36, color: 'auto' },
          { label: 'Other', value: 2, color: 'auto' },
        ],
      };
    case 'creator-fan-city':
      return {
        title: 'Top 8 Fan Cities',
        subtitle: '',
        bars: [
          { label: '城市一', value: 22, color: 'auto' },
          { label: '城市二', value: 16, color: 'auto' },
          { label: '城市三', value: 14, color: 'auto' },
          { label: '城市四', value: 12, color: 'auto' },
          { label: '城市五', value: 9, color: 'auto' },
          { label: '城市六', value: 7, color: 'auto' },
          { label: '城市七', value: 5, color: 'auto' },
          { label: '城市八', value: 4, color: 'auto' },
        ],
      };
    case 'creator-fan-age':
      return {
        title: 'Fan Age Groups',
        subtitle: '25–34 is the core group',
        bars: [
          { label: '<18', value: 8, color: 'auto' },
          { label: '18-24', value: 28, color: 'auto' },
          { label: '25-34', value: 38, color: 'auto' },
          { label: '35-44', value: 18, color: 'auto' },
          { label: '45+', value: 8, color: 'auto' },
        ],
      };
    case 'creator-fan-interest':
      return {
        title: 'Interest Tags',
        subtitle: '',
        showPercent: true,
        tags: [
          { label: '兴趣一', value: 35, color: 'auto' },
          { label: '兴趣二', value: 28, color: 'auto' },
          { label: '兴趣三', value: 22, color: 'auto' },
          { label: '兴趣四', value: 15, color: 'auto' },
        ],
      };
    case 'work-screenshot':
      return {
        variant: 'auto',
        title: 'Creator Work Screenshots',
        images: Array.from({ length: 8 }, () => ({ src: '' })),
      };
    case 'work-metrics':
      return {
        title: 'Work Metrics',
        subtitle: 'Last 7 days',
        workName: '作品标题',
        cover: '',
        metrics: [
          { label: 'Views', value: '--', color: 'auto' },
          { label: 'Likes', value: '--', color: 'auto' },
          { label: 'Comments', value: '--', color: 'auto' },
          { label: 'Shares', value: '--', color: 'auto' },
          { label: 'Completion Rate', value: '--', color: 'auto' },
          { label: 'Saves', value: '--', color: 'auto' },
        ],
      };
    case 'comment-wordcloud':
      return {
        title: 'Comment Word Cloud',
        subtitle: '',
        words: [
          { text: '词条一', weight: 90, sentiment: 'pos' },
          { text: '词条二', weight: 80, sentiment: 'pos' },
          { text: '词条三', weight: 70, sentiment: 'pos' },
          { text: '词条四', weight: 60, sentiment: 'pos' },
          { text: '词条五', weight: 55, sentiment: 'neutral' },
          { text: '词条六', weight: 45, sentiment: 'neutral' },
          { text: '词条七', weight: 35, sentiment: 'neg' },
          { text: '词条八', weight: 30, sentiment: 'neg' },
        ],
      };
    case 'shape':
      return getDefaultShapeData('rectangle');
    case 'image-group':
      return {
        variant: 'auto',
        images: [{ src: '' }, { src: '' }, { src: '' }],
      };
    case 'title-block':
      return {
        variant: 'bar-left',
        text: 'Section Title',
        subtitle: 'Subtitle (optional)',
        fontSize: undefined,
        titleColor: 'black',
        color: 'auto',
        underlineColor: 'brand',
        divider: true,
      };
    case 'campaign-analysis':
      return {
        variant: 'radar',
        title: 'Creator Campaign Performance Analysis',
        subtitle: 'Multi-dimensional Comparison',
        dimensions: [
          { label: 'Reach', value: 85, max: 100 },
          { label: 'Engagement', value: 72, max: 100 },
          { label: 'Conversion', value: 68, max: 100 },
          { label: 'CPE', value: 90, max: 100 },
          { label: 'CVR', value: 65, max: 100 },
          { label: 'CPM', value: 78, max: 100 },
        ],
        funnelSteps: [
          { label: 'Impressions', value: 1250000 },
          { label: 'Clicks', value: 48200 },
          { label: 'Add to Cart', value: 6840 },
          { label: 'Checkout', value: 3120 },
          { label: 'Purchase', value: 1846 },
        ],
        insight: '',
      };
    case 'creator-work-metrics':
      return {
        variant: 'grid',
        title: 'Key Metrics',
        subtitle: 'Last 7 days',
        workName: '作品标题',
        cover: '',
        metrics: [
          { label: 'Views', value: '--', sub: '--', color: 'auto' },
          { label: 'Likes', value: '--', sub: '--', color: 'auto' },
          { label: 'Comments', value: '--', sub: '--', color: 'auto' },
          { label: 'Shares', value: '--', sub: '--', color: 'auto' },
          { label: 'Completion', value: '--', sub: '--', color: 'auto' },
          { label: 'Saves', value: '--', sub: '--', color: 'auto' },
        ],
        audience: {
          topCities: [
            { label: '地区一', value: 23, color: 'auto' },
            { label: '地区二', value: 18, color: 'auto' },
            { label: '地区三', value: 14, color: 'auto' },
            { label: '地区四', value: 11, color: 'auto' },
            { label: '地区五', value: 8, color: 'auto' },
          ],
          genderSplit: [
            { label: 'F', value: 72, color: 'auto' },
            { label: 'M', value: 28, color: 'auto' },
          ],
          ageRange: [
            { label: '18-24', value: 35, color: 'auto' },
            { label: '25-34', value: 42, color: 'auto' },
            { label: '35-44', value: 15, color: 'auto' },
            { label: '45+', value: 8, color: 'auto' },
          ],
          trend: [
            { label: 'D1', value: 12000 },
            { label: 'D2', value: 28000 },
            { label: 'D3', value: 45000 },
            { label: 'D4', value: 52000 },
            { label: 'D5', value: 61000 },
            { label: 'D6', value: 78000 },
            { label: 'D7', value: 86000 },
          ],
          trendLabel: 'Views',
        },
      };
    case 'creator-works-table':
      return {
        variant: 'list',
        title: 'Creator Works',
        subtitle: 'Recent posts',
        headers: ['Cover', 'Title', 'Impr.', 'Likes', 'Comments', 'Shares', 'Eng. Rate'],
        rows: [
          ['', '作品一', '--', '--', '--', '--', '--'],
          ['', '作品二', '--', '--', '--', '--', '--'],
          ['', '作品三', '--', '--', '--', '--', '--'],
          ['', '作品四', '--', '--', '--', '--', '--'],
          ['', '作品五', '--', '--', '--', '--', '--'],
          ['', '作品六', '--', '--', '--', '--', '--'],
        ],
        insights: [
          {
            topCities: [
              { label: 'New York', value: 23, color: 'auto' },
              { label: 'Los Angeles', value: 18, color: 'auto' },
              { label: 'Chicago', value: 12, color: 'auto' },
            ],
            genderSplit: [
              { label: 'F', value: 72, color: 'auto' },
              { label: 'M', value: 28, color: 'auto' },
            ],
            trend: [
              { label: 'D1', value: 12000 },
              { label: 'D2', value: 28000 },
              { label: 'D3', value: 45000 },
              { label: 'D4', value: 52000 },
              { label: 'D5', value: 61000 },
              { label: 'D6', value: 78000 },
              { label: 'D7', value: 86000 },
            ],
            trendLabel: 'Views',
          },
          {
            topCities: [
              { label: 'Houston', value: 21, color: 'auto' },
              { label: 'Miami', value: 16, color: 'auto' },
              { label: 'Seattle', value: 11, color: 'auto' },
            ],
            genderSplit: [
              { label: 'F', value: 85, color: 'auto' },
              { label: 'M', value: 15, color: 'auto' },
            ],
            trend: [
              { label: 'D1', value: 8000 },
              { label: 'D2', value: 15000 },
              { label: 'D3', value: 22000 },
              { label: 'D4', value: 38000 },
              { label: 'D5', value: 44000 },
              { label: 'D6', value: 51000 },
              { label: 'D7', value: 54000 },
            ],
            trendLabel: 'Engagement',
          },
          {
            topCities: [
              { label: 'Austin', value: 19, color: 'auto' },
              { label: 'Denver', value: 14, color: 'auto' },
              { label: 'Boston', value: 10, color: 'auto' },
            ],
            genderSplit: [
              { label: 'F', value: 68, color: 'auto' },
              { label: 'M', value: 32, color: 'auto' },
            ],
            trend: [
              { label: 'D1', value: 5000 },
              { label: 'D2', value: 12000 },
              { label: 'D3', value: 18000 },
              { label: 'D4', value: 25000 },
              { label: 'D5', value: 32000 },
              { label: 'D6', value: 38000 },
              { label: 'D7', value: 42000 },
            ],
            trendLabel: 'Views',
          },
          {
            topCities: [
              { label: 'San Francisco', value: 20, color: 'auto' },
              { label: 'Portland', value: 15, color: 'auto' },
              { label: 'Phoenix', value: 9, color: 'auto' },
            ],
            genderSplit: [
              { label: 'F', value: 76, color: 'auto' },
              { label: 'M', value: 24, color: 'auto' },
            ],
            trend: [
              { label: 'D1', value: 10000 },
              { label: 'D2', value: 22000 },
              { label: 'D3', value: 35000 },
              { label: 'D4', value: 42000 },
              { label: 'D5', value: 50000 },
              { label: 'D6', value: 58000 },
              { label: 'D7', value: 64000 },
            ],
            trendLabel: 'Views',
          },
          {
            topCities: [
              { label: 'Dallas', value: 22, color: 'auto' },
              { label: 'Atlanta', value: 17, color: 'auto' },
              { label: 'Orlando', value: 8, color: 'auto' },
            ],
            genderSplit: [
              { label: 'F', value: 91, color: 'auto' },
              { label: 'M', value: 9, color: 'auto' },
            ],
            trend: [
              { label: 'D1', value: 15000 },
              { label: 'D2', value: 32000 },
              { label: 'D3', value: 58000 },
              { label: 'D4', value: 72000 },
              { label: 'D5', value: 88000 },
              { label: 'D6', value: 95000 },
              { label: 'D7', value: 105000 },
            ],
            trendLabel: 'Engagement',
          },
          {
            topCities: [
              { label: 'Nashville', value: 18, color: 'auto' },
              { label: 'Charlotte', value: 13, color: 'auto' },
              { label: 'Las Vegas', value: 7, color: 'auto' },
            ],
            genderSplit: [
              { label: 'F', value: 70, color: 'auto' },
              { label: 'M', value: 30, color: 'auto' },
            ],
            trend: [
              { label: 'D1', value: 4000 },
              { label: 'D2', value: 9000 },
              { label: 'D3', value: 14000 },
              { label: 'D4', value: 20000 },
              { label: 'D5', value: 26000 },
              { label: 'D6', value: 31000 },
              { label: 'D7', value: 35000 },
            ],
            trendLabel: 'Views',
          },
        ],
      };
    case 'content-card':
      return {
        variant: 'standard' as const,
        title: 'Card Title',
        body: 'Enter body text here. Use it for key points, summaries, or highlights.',
        tag: 'Tag',
        footer: '',
      };
    case 'swot-matrix':
      return {
        variant: 'grid' as const,
        title: 'Opportunities & Challenges',
        quadrants: [
          { title: 'Opportunities', items: ['要点一', '要点二', '要点三'] },
          { title: 'Strengths', items: ['要点一', '要点二', '要点三'] },
          { title: 'Challenges', items: ['要点一', '要点二', '要点三'] },
          { title: 'Threats', items: ['要点一', '要点二', '要点三'] },
        ],
      };
    case 'campaign-summary':
      return {
        title: 'Campaign Overview',
        campaignName: 'Campaign 名称',
        period: '',
        metrics: [
          { label: 'Spend', value: '--', compare: '' },
          { label: 'Revenue', value: '--', compare: '' },
          { label: 'ROAS', value: '--', compare: '' },
          { label: 'Commission', value: '--', compare: '' },
        ],
        customerSplit: { newCustomers: 0, returningCustomers: 0, newCustomerRate: '--' },
      };
    case 'funnel-chart':
      return {
        title: 'Conversion Funnel',
        subtitle: 'Impressions → Purchase',
        steps: [
          { label: 'Impressions', value: 3200000, rate: '100%' },
          { label: 'Clicks', value: 96000, rate: '3.0%' },
          { label: 'Add to Cart', value: 14400, rate: '15.0%' },
          { label: 'Checkout', value: 5760, rate: '40.0%' },
          { label: 'Purchase', value: 2430, rate: '42.2%' },
        ],
        insight: '',
      };
    case 'revenue-timeline':
      return {
        title: 'Revenue & Spend Timeline',
        subtitle: 'Daily performance',
        points: Array.from({ length: 14 }, (_, i) => ({
          date: `D${i + 1}`,
          revenue: Math.round(20000 + Math.sin(i / 2) * 8000 + i * 1500),
          spend: Math.round(8000 + i * 200),
          commission: Math.round(1800 + i * 180),
          orders: Math.round(80 + Math.sin(i / 2) * 30 + i * 5),
        })),
        series: ['revenue', 'spend'],
      };
    case 'publisher-table':
      return {
        title: 'Publisher Performance',
        rows: [
          { publisher: '媒体一', clicks: '--', impressions: '--', ctr: '--', conversions: '--', cvr: '--', revenue: '--', commission: '--', epc: '--', roas: '--', status: 'good' },
          { publisher: '媒体二', clicks: '--', impressions: '--', ctr: '--', conversions: '--', cvr: '--', revenue: '--', commission: '--', epc: '--', roas: '--', status: 'good' },
          { publisher: '媒体三', clicks: '--', impressions: '--', ctr: '--', conversions: '--', cvr: '--', revenue: '--', commission: '--', epc: '--', roas: '--', status: 'warn' },
          { publisher: '媒体四', clicks: '--', impressions: '--', ctr: '--', conversions: '--', cvr: '--', revenue: '--', commission: '--', epc: '--', roas: '--', status: 'bad' },
        ],
      };
    case 'geo-distribution':
      return {
        title: 'Revenue by GEO',
        subtitle: 'Top 6 markets',
        variant: 'bars',
        items: [
          { code: 'US', name: '国家一', value: 0, display: '--', share: '--' },
          { code: 'UK', name: '国家二', value: 0, display: '--', share: '--' },
          { code: 'DE', name: '国家三', value: 0, display: '--', share: '--' },
          { code: 'CA', name: '国家四', value: 0, display: '--', share: '--' },
          { code: 'AU', name: '国家五', value: 0, display: '--', share: '--' },
          { code: 'JP', name: '国家六', value: 0, display: '--', share: '--' },
        ],
      };
    case 'placement-wide-table':
      return {
        title: 'Placement Breakdown',
        rows: [
          { placement: '资源位一', publisher: '媒体一', clicks: '--', ctr: '--', conversions: '--', cvr: '--', revenue: '--', epc: '--', status: 'good' },
          { placement: '资源位二', publisher: '媒体二', clicks: '--', ctr: '--', conversions: '--', cvr: '--', revenue: '--', epc: '--', status: 'good' },
          { placement: '资源位三', publisher: '媒体一', clicks: '--', ctr: '--', conversions: '--', cvr: '--', revenue: '--', epc: '--', status: 'good' },
          { placement: '资源位四', publisher: '媒体三', clicks: '--', ctr: '--', conversions: '--', cvr: '--', revenue: '--', epc: '--', status: 'warn' },
          { placement: '资源位五', publisher: '媒体四', clicks: '--', ctr: '--', conversions: '--', cvr: '--', revenue: '--', epc: '--', status: 'bad' },
        ],
      };
    case 'placement-type-summary':
      return {
        title: 'Placement Type Summary',
        subtitle: 'Aggregated by type',
        items: [
          { type: '类型一', revenue: '--', revenueShare: '--', clicks: '--', ctr: '--', conversions: '--', cvr: '--', epc: '--', roas: '--', trend: Array.from({ length: 7 }, (_, i) => ({ label: `D${i}`, value: 4000 + i * 500 })) },
          { type: '类型二', revenue: '--', revenueShare: '--', clicks: '--', ctr: '--', conversions: '--', cvr: '--', epc: '--', roas: '--', trend: Array.from({ length: 7 }, (_, i) => ({ label: `D${i}`, value: 3000 + i * 300 })) },
          { type: '类型三', revenue: '--', revenueShare: '--', clicks: '--', ctr: '--', conversions: '--', cvr: '--', epc: '--', roas: '--', trend: Array.from({ length: 7 }, (_, i) => ({ label: `D${i}`, value: 3500 + i * 600 })) },
          { type: '类型四', revenue: '--', revenueShare: '--', clicks: '--', ctr: '--', conversions: '--', cvr: '--', epc: '--', roas: '--', trend: Array.from({ length: 7 }, (_, i) => ({ label: `D${i}`, value: 2500 - i * 100 })) },
        ],
      };
    case 'device-breakdown':
      return {
        title: 'Device Breakdown',
        items: [
          { device: 'Mobile', sessions: '--', revenue: '--', share: '--', trend: '--' },
          { device: 'Desktop', sessions: '--', revenue: '--', share: '--', trend: '--' },
          { device: 'Tablet', sessions: '--', revenue: '--', share: '--', trend: '--' },
        ],
      };
    case 'content-topic-performance':
      return {
        title: 'Content Topic Performance',
        items: [
          { topic: '主题一', posts: 0, impressions: '--', engagement: '--', revenue: '--', roas: '--', status: 'good' },
          { topic: '主题二', posts: 0, impressions: '--', engagement: '--', revenue: '--', roas: '--', status: 'good' },
          { topic: '主题三', posts: 0, impressions: '--', engagement: '--', revenue: '--', roas: '--', status: 'good' },
          { topic: '主题四', posts: 0, impressions: '--', engagement: '--', revenue: '--', roas: '--', status: 'warn' },
          { topic: '主题五', posts: 0, impressions: '--', engagement: '--', revenue: '--', roas: '--', status: 'bad' },
        ],
      };
    case 'search-term-table':
      return {
        title: 'Search Term Performance',
        items: [
          { term: '搜索词一', clicks: '--', conversions: '--', ctr: '--', revenue: '--', status: 'good' },
          { term: '搜索词二', clicks: '--', conversions: '--', ctr: '--', revenue: '--', status: 'good' },
          { term: '搜索词三', clicks: '--', conversions: '--', ctr: '--', revenue: '--', status: 'warn' },
          { term: '搜索词四', clicks: '--', conversions: '--', ctr: '--', revenue: '--', status: 'warn' },
          { term: '搜索词五', clicks: '--', conversions: '--', ctr: '--', revenue: '--', status: 'bad' },
        ],
      };
    case 'hourly-heatmap':
      return {
        title: 'Hourly Performance',
        subtitle: 'Clicks by hour (24h)',
        metric: 'clicks',
        hours: Array.from({ length: 24 }, (_, h) => {
          const peak1 = Math.exp(-((h - 9) ** 2) / 8) * 800;
          const peak2 = Math.exp(-((h - 21) ** 2) / 6) * 1200;
          const base = 50;
          return {
            hour: String(h).padStart(2, '0'),
            impressions: Math.round((peak1 + peak2 + base) * 30),
            clicks: Math.round(peak1 + peak2 + base),
            conversions: Math.round((peak1 + peak2 + base) * 0.03),
          };
        }),
      };
    case 'creator-audience-profile':
      return {
        variant: 'grid-3',
        title: 'Audience Profile',
        modules: AUDIENCE_MODULE_CATALOG.map((m) => ({ key: m.key, selected: true, items: [] })),
      };
    default:
      return { content: '', fontSize: 14, color: 'var(--foreground-primary)' };
  }
}

export function getDefaultShapeData(shape: ShapeKind): ShapeData {
  if (shape === 'line') {
    return { shape: 'line', stroke: 'var(--border-default)', strokeWidth: 1, opacity: 1, rotation: 0, dash: false };
  }
  const base: ShapeData = {
    shape,
    fill: 'var(--color-primary)',
    stroke: 'var(--border-default)',
    strokeWidth: 0,
    opacity: 1,
    rotation: 0,
  };
  if (shape === 'rounded') return { ...base, borderRadius: 12 };
  return base;
}
