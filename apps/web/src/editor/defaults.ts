/**
 * 组件默认尺寸 / 默认数据。供 editor store（addComponent）与 REGISTRY 共用，
 * 避免循环依赖（REGISTRY 含 React 组件）。忠实 demo.html。
 */
import type { ComponentType, ComponentData, CreatorAvatarCardData, MetaStripData, ShapeKind, ShapeData } from '@mediakit/shared';
import { campaignWorkScreenshots } from '@/api/creatorPerformance';

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
  'title-block': { w: 600, h: 80 },
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

export function getDefaultData(type: ComponentType): ComponentData {
  switch (type) {
    case 'text':
      return {
        content: '文本内容',
        fontSize: 14,
        fontFamily: '',
        fontWeight: 400,
        color: 'var(--foreground-primary)',
      };
    case 'indicator-card':
      return { variant: 'plain', title: '指标名称', value: '---', colorTheme: 'blue' };
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
        headers: ['列1', '列2', '列3'],
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
        title: '业务组件',
        meta: '',
        details: [],
        variant: 'standard',
      };
    case 'creator-avatar-card':
      return {
        variant: 'horizontal',
        avatar: '',
        name: 'Mia Chen',
        platform: 'tiktok',
        platforms: ['tiktok', 'instagram'],
        tier: 'macro',
        intro: 'Beauty & Skincare Creator · @miaglowup',
      } as CreatorAvatarCardData;
    case 'creator-stats-strip':
      return {
        variant: 'cards',
        stats: [
          { key: 'followers', label: 'Followers', value: '1.28M', color: 'auto', selected: true },
          { key: 'engagement', label: 'Engagement Rate', value: '8.7%', color: 'auto', selected: true },
          { key: 'reach', label: 'Avg. Reach', value: '640K', color: 'auto', selected: true },
          { key: 'impressions', label: 'Impressions', value: '12.6M', color: 'auto', selected: true },
        ],
      };
    case 'creator-works-list':
      return {
        variant: 'cards',
        headers: ['Cover', 'Title', 'Shares', 'Likes', 'Comments'],
        rows: [
          ['', '7-Day Skin Diary · Day 1', '1.2K', '86K', '2.4K'],
          ['', 'Sensitive Skin Serum Test', '980', '54K', '1.8K'],
          ['', 'Morning Skincare Routine', '760', '42K', '1.2K'],
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
          ['', '林小美', 'xiaohongshu', '128.5K', '4.8%', '美妆'],
          ['', '张一凡', 'douyin', '456K', '6.2%', '时尚'],
          ['', 'Emily Chen', 'instagram', '89.3K', '5.1%', '生活方式'],
          ['', '王大力', 'youtube', '1.2M', '3.4%', '美食'],
          ['', 'Sarah W.', 'tiktok', '567K', '7.8%', '娱乐'],
        ],
      };
    case 'brand-wall':
      return {
        variant: 'grid',
        headers: ['品牌', 'Logo URL'],
        rows: [
          ['LUMIÈRE', ''],
          ['NOVA HOME', ''],
          ['MOTION', ''],
          ['EVERYDAY', ''],
          ['WANDER', ''],
          ['GLOWLAB', ''],
        ],
      };
    case 'package-card':
      return {
        variant: 'standard',
        name: '增长加速包',
        price: '$80,000',
        headers: ['特性'],
        rows: [
          ['40–60 位达人'],
          ['Spark Ads 资源位'],
          ['8–12% CPS 佣金'],
          ['6 周服务周期'],
        ],
        highlighted: false,
      };
    case 'kpi-board':
      return {
        variant: 'grid',
        headers: ['指标', '数值', '对比'],
        rows: [
          ['GMV', '$1.24M', '+15%'],
          ['Commission', '$98K', '+12%'],
          ['ROAS', '3.21', '+12%'],
          ['Clicks', '120K', '-3%'],
          ['Conversions', '4.35K', '+18%'],
          ['CVR', '3.8%', '+0.4%'],
          ['AOV', '$72.5', '+1%'],
          ['Spend', '$128K', '+8%'],
          ['Impressions', '4.2M', '+6%'],
        ],
        icons: ['currency', 'currency', 'target', 'eye', 'cart', 'percent', 'currency', 'currency', 'eye'],
        valueColors: ['success', 'success', 'info', 'warning', 'success', 'info', 'primary', 'warning', 'info'],
        compareLabel: 'vs 上期',
      };
    case 'meta-strip':
      return {
        variant: 'inline',
        headers: ['图标', '标签', '文本'],
        rows: [
          ['target', 'BASE', 'The United States'],
          ['tag', 'TYPE', 'Beauty'],
          ['trophy', 'TIER', 'A'],
        ],
      } as MetaStripData;
    case 'strategy-block':
      return {
        // variant 缺省 = 'default'（见 StrategyBlockComponent）；此处省略以避开与 PlacementData 的联合类型歧义。
        headers: ['图标', '标题', '内容'],
        rows: [
          ['sparkle', 'INSIGHT', 'My audience values authenticity and practical <mark>beauty tips</mark>.'],
          ['target', 'STRATEGY', 'Focus on practical <mark>beauty tips</mark> and authentic product reviews.'],
        ],
      };
    case 'timeline-compare':
      return {
        variant: 'standard',
        headers: ['指标', '本期', '上期', '状态'],
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
        insight: '【最佳销售 Top5】功效精华类贡献 46% 销售额；建议下阶段单品加投。',
        headers: ['商品', '图URL', '销量', '占比', '品类'],
        rows: [
          ['敏感肌精华', '', '12.4K', '32%', '护肤'],
          ['保湿面霜', '', '8.6K', '22%', '护肤'],
          ['洁面慕斯', '', '5.2K', '13%', '清洁'],
          ['防晒霜', '', '4.1K', '11%', '防晒'],
          ['眼霜', '', '3.0K', '8%', '护肤'],
        ],
      };
    case 'placement-display':
      return {
        variant: 'grid',
        highlights: '首页 Banner CTR 高于均值 1.8 倍。',
        learnings: '推荐位素材需强化功效可视化。',
        headers: ['名称', '截图URL', '数据'],
        rows: [
          ['首页 Banner', '', 'CTR 2.4%'],
          ['详情页推荐位', '', 'CTR 1.6%'],
          ['购物车加购位', '', 'CTR 3.1%'],
        ],
      };
    case 'post-list':
      return {
        variant: 'cards',
        headers: ['截图URL', '标题', 'ID', '链接', '数据'],
        rows: [
          ['', 'Content Site 深度测评', 'CS-001', 'https://example.com/1', '阅读 24K'],
          ['', 'Reddit Discussion', 'RD-104', 'https://example.com/2', '3.2K engagement'],
          ['', 'FB Recommendation', 'FB-220', 'https://example.com/3', '1.8K engagement'],
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
        subtitle: 'Tier-1 & new tier-1 cities make up 73%',
        bars: [
          { label: 'Shanghai', value: 22, color: 'auto' },
          { label: 'Guangzhou', value: 16, color: 'auto' },
          { label: 'Beijing', value: 14, color: 'auto' },
          { label: 'Shenzhen', value: 12, color: 'auto' },
          { label: 'Hangzhou', value: 9, color: 'auto' },
          { label: 'Chengdu', value: 7, color: 'auto' },
          { label: 'Wuhan', value: 5, color: 'auto' },
          { label: "Xi'an", value: 4, color: 'auto' },
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
        subtitle: 'Beauty & Food are the top two interests',
        showPercent: true,
        tags: [
          { label: 'Beauty', value: 35, color: 'auto' },
          { label: 'Food', value: 28, color: 'auto' },
          { label: 'Fashion', value: 22, color: 'auto' },
          { label: 'Travel', value: 15, color: 'auto' },
        ],
      };
    case 'work-screenshot':
      return {
        variant: 'auto',
        title: '达人作品截图',
        images: campaignWorkScreenshots('camp-glowlab-q4'),
      };
    case 'work-metrics':
      return {
        title: 'Work Metrics',
        subtitle: 'Last 7 days',
        workName: '7-Day Skin Diary · Day 1',
        cover: '',
        metrics: [
          { label: 'Views', value: '1.2M', color: 'auto' },
          { label: 'Likes', value: '86K', color: 'auto' },
          { label: 'Comments', value: '2.4K', color: 'auto' },
          { label: 'Shares', value: '1.2K', color: 'auto' },
          { label: 'Completion Rate', value: '42%', color: 'auto' },
          { label: 'Saves', value: '5.6K', color: 'auto' },
        ],
      };
    case 'comment-wordcloud':
      return {
        title: 'Comment Word Cloud',
        subtitle: 'Positive sentiment dominates, focused on efficacy and texture',
        words: [
          { text: 'must-have', weight: 90, sentiment: 'pos' },
          { text: 'love it', weight: 80, sentiment: 'pos' },
          { text: 'repurchase', weight: 70, sentiment: 'pos' },
          { text: 'great value', weight: 60, sentiment: 'pos' },
          { text: 'texture', weight: 55, sentiment: 'neutral' },
          { text: 'scent', weight: 45, sentiment: 'neutral' },
          { text: 'irritating', weight: 35, sentiment: 'neg' },
          { text: 'overhyped', weight: 30, sentiment: 'neg' },
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
        text: '章节标题',
        subtitle: '副标题（可选）',
        color: 'auto',
        underlineColor: 'brand',
        divider: true,
      };
    case 'campaign-analysis':
      return {
        variant: 'radar',
        title: '达人投放效果分析',
        subtitle: '多维度对比',
        dimensions: [
          { label: '曝光', value: 85, max: 100 },
          { label: '互动', value: 72, max: 100 },
          { label: '转化', value: 68, max: 100 },
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
        insight: 'This creator excels in reach and engagement, but conversion rate has room for improvement.',
      };
    case 'creator-work-metrics':
      return {
        variant: 'grid',
        title: 'Key Metrics',
        subtitle: 'Last 7 days',
        workName: '7-Day Skin Diary · Day 1',
        cover: '',
        metrics: [
          { label: 'Views', value: '1.2M', sub: '+15%', color: 'auto' },
          { label: 'Likes', value: '86K', sub: '+8%', color: 'auto' },
          { label: 'Comments', value: '2.4K', sub: '+22%', color: 'auto' },
          { label: 'Shares', value: '1.2K', sub: '+5%', color: 'auto' },
          { label: 'Completion', value: '42%', sub: '+3pt', color: 'auto' },
          { label: 'Saves', value: '5.6K', sub: '+12%', color: 'auto' },
        ],
        audience: {
          topCities: [
            { label: 'New York', value: 23, color: 'auto' },
            { label: 'Los Angeles', value: 18, color: 'auto' },
            { label: 'Chicago', value: 14, color: 'auto' },
            { label: 'Houston', value: 11, color: 'auto' },
            { label: 'Miami', value: 8, color: 'auto' },
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
          ['', 'Summer Skincare Routine', '1.2M', '86K', '2.4K', '1.2K', '42%'],
          ['', 'Product Unboxing Review', '856K', '52K', '1.8K', '890', '38%'],
          ['', 'Daily Vlog', '432K', '28K', '960', '420', '35%'],
          ['', 'Top Picks Recommendation', '678K', '41K', '1.5K', '670', '40%'],
          ['', 'Ingredient Science Explained', '1.05M', '73K', '3.1K', '1.4K', '46%'],
          ['', 'Seasonal Transition Skincare', '389K', '24K', '820', '510', '33%'],
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
        title: '卡片标题',
        body: '在此输入正文内容。可用于重点说明、摘要介绍或关键结论的展示。',
        tag: '标签',
        footer: '',
      };
    case 'swot-matrix':
      return {
        variant: 'grid' as const,
        title: 'Opportunities & Challenges',
        quadrants: [
          { title: 'Opportunities', items: ['18–24 高潜受众', 'UGC 口碑背书', '敏感肌蓝海品类'] },
          { title: 'Strengths', items: ['300+ 品牌服务经验', 'AI 数据归因能力', '跨平台达人资源'] },
          { title: 'Challenges', items: ['心智占位不足', '内容同质化严重', '品类教育成本高'] },
          { title: 'Threats', items: ['竞品投放加码', '平台算法波动', '用户注意力碎片化'] },
        ],
      };
    case 'campaign-summary':
      return {
        title: 'Campaign Overview',
        campaignName: 'GlowLab Q4 Affiliate Campaign',
        period: '2026-10-12 ~ 2026-11-12',
        metrics: [
          { label: 'Spend', value: '$128,000', compare: '' },
          { label: 'Revenue', value: '$487,200', compare: '+15%' },
          { label: 'ROAS', value: '3.81x', compare: '+0.3' },
          { label: 'Commission', value: '$43,848', compare: '' },
        ],
        customerSplit: { newCustomers: 842, returningCustomers: 1588, newCustomerRate: '34.7%' },
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
        insight: 'Add-to-Cart → Checkout 转化率 40%，高于行业均值（25-30%），商品页说服力强。',
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
          { publisher: 'InfluApp', clicks: '12,400', impressions: '320,000', ctr: '3.88%', conversions: '372', cvr: '3.00%', revenue: '$89,200', commission: '$8,028', epc: '$7.19', roas: '4.2x', status: 'good' },
          { publisher: 'DealHub', clicks: '8,200', impressions: '180,000', ctr: '4.56%', conversions: '246', cvr: '3.00%', revenue: '$52,800', commission: '$4,752', epc: '$6.44', roas: '3.5x', status: 'good' },
          { publisher: 'CouponPro', clicks: '15,600', impressions: '520,000', ctr: '3.00%', conversions: '312', cvr: '2.00%', revenue: '$41,600', commission: '$3,744', epc: '$2.67', roas: '2.1x', status: 'warn' },
          { publisher: 'BlogAds', clicks: '3,100', impressions: '95,000', ctr: '3.26%', conversions: '62', cvr: '2.00%', revenue: '$14,800', commission: '$1,332', epc: '$4.77', roas: '1.8x', status: 'bad' },
        ],
      };
    case 'geo-distribution':
      return {
        title: 'Revenue by GEO',
        subtitle: 'Top 6 markets',
        variant: 'bars',
        items: [
          { code: 'US', name: 'United States', value: 42, display: '$204,624', share: '42.0%' },
          { code: 'UK', name: 'United Kingdom', value: 18, display: '$87,696', share: '18.0%' },
          { code: 'DE', name: 'Germany', value: 12, display: '$58,464', share: '12.0%' },
          { code: 'CA', name: 'Canada', value: 10, display: '$48,720', share: '10.0%' },
          { code: 'AU', name: 'Australia', value: 8, display: '$38,976', share: '8.0%' },
          { code: 'JP', name: 'Japan', value: 10, display: '$48,720', share: '10.0%' },
        ],
      };
    case 'placement-wide-table':
      return {
        title: 'Placement Breakdown',
        rows: [
          { placement: 'Bio Link', publisher: 'InfluApp', clicks: '4,200', ctr: '4.10%', conversions: '168', cvr: '4.00%', revenue: '$38,200', epc: '$9.10', status: 'good' },
          { placement: 'Story', publisher: 'DealHub', clicks: '3,800', ctr: '3.50%', conversions: '114', cvr: '3.00%', revenue: '$24,500', epc: '$6.45', status: 'good' },
          { placement: 'Live', publisher: 'InfluApp', clicks: '2,100', ctr: '5.20%', conversions: '105', cvr: '5.00%', revenue: '$22,800', epc: '$10.86', status: 'good' },
          { placement: 'Shopping Ads', publisher: 'CouponPro', clicks: '6,500', ctr: '2.80%', conversions: '78', cvr: '1.20%', revenue: '$14,600', epc: '$2.25', status: 'warn' },
          { placement: 'Bio Link', publisher: 'BlogAds', clicks: '1,100', ctr: '3.00%', conversions: '22', cvr: '2.00%', revenue: '$5,800', epc: '$5.27', status: 'bad' },
        ],
      };
    case 'placement-type-summary':
      return {
        title: 'Placement Type Summary',
        subtitle: 'Aggregated by type',
        items: [
          { type: 'Bio Link', revenue: '$44,000', revenueShare: '35%', clicks: '5,300', ctr: '3.90%', conversions: '190', cvr: '3.60%', epc: '$8.30', roas: '4.5x', trend: Array.from({ length: 7 }, (_, i) => ({ label: `D${i}`, value: 4000 + i * 500 })) },
          { type: 'Story', revenue: '$28,000', revenueShare: '22%', clicks: '4,100', ctr: '3.60%', conversions: '126', cvr: '3.10%', epc: '$6.83', roas: '3.2x', trend: Array.from({ length: 7 }, (_, i) => ({ label: `D${i}`, value: 3000 + i * 300 })) },
          { type: 'Live', revenue: '$32,000', revenueShare: '25%', clicks: '2,800', ctr: '5.00%', conversions: '140', cvr: '5.00%', epc: '$11.43', roas: '5.1x', trend: Array.from({ length: 7 }, (_, i) => ({ label: `D${i}`, value: 3500 + i * 600 })) },
          { type: 'Shopping Ads', revenue: '$23,200', revenueShare: '18%', clicks: '7,200', ctr: '2.80%', conversions: '86', cvr: '1.20%', epc: '$3.22', roas: '2.0x', trend: Array.from({ length: 7 }, (_, i) => ({ label: `D${i}`, value: 2500 - i * 100 })) },
        ],
      };
    case 'device-breakdown':
      return {
        title: 'Device Breakdown',
        items: [
          { device: 'Mobile', sessions: '82,400', revenue: '$380,400', share: '78%', trend: '+12%' },
          { device: 'Desktop', sessions: '14,200', revenue: '$82,800', share: '17%', trend: '-3%' },
          { device: 'Tablet', sessions: '3,800', revenue: '$24,000', share: '5%', trend: '+1%' },
        ],
      };
    case 'content-topic-performance':
      return {
        title: 'Content Topic Performance',
        items: [
          { topic: 'Skincare Routine', posts: 12, impressions: '1.2M', engagement: '8.4%', revenue: '$128,000', roas: '4.2x', status: 'good' },
          { topic: 'Product Review', posts: 8, impressions: '980K', engagement: '6.1%', revenue: '$96,500', roas: '3.8x', status: 'good' },
          { topic: 'Before & After', posts: 6, impressions: '720K', engagement: '5.2%', revenue: '$72,000', roas: '3.1x', status: 'good' },
          { topic: 'Tutorial / How-to', posts: 4, impressions: '420K', engagement: '3.8%', revenue: '$38,000', roas: '2.2x', status: 'warn' },
          { topic: 'UGC Repost', posts: 10, impressions: '1.5M', engagement: '4.1%', revenue: '$42,000', roas: '1.8x', status: 'bad' },
        ],
      };
    case 'search-term-table':
      return {
        title: 'Search Term Performance',
        items: [
          { term: 'glowlab vitamin c', clicks: '2,400', conversions: '144', ctr: '4.80%', revenue: '$28,800', status: 'good' },
          { term: 'best vitamin c serum', clicks: '1,800', conversions: '90', ctr: '4.20%', revenue: '$18,000', status: 'good' },
          { term: 'glowlab discount', clicks: '3,200', conversions: '48', ctr: '2.80%', revenue: '$9,600', status: 'warn' },
          { term: 'skincare for sensitive skin', clicks: '1,200', conversions: '36', ctr: '3.60%', revenue: '$7,200', status: 'warn' },
          { term: 'glowlab review', clicks: '800', conversions: '8', ctr: '2.00%', revenue: '$1,600', status: 'bad' },
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
