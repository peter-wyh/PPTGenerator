/**
 * 组件默认尺寸 / 默认数据。供 editor store（addComponent）与 REGISTRY 共用，
 * 避免循环依赖（REGISTRY 含 React 组件）。忠实 demo.html。
 */
import type { ComponentType, ComponentData, MetaStripData, ShapeKind, ShapeData } from '@mediakit/shared';
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
  'geo-map': { w: 720, h: 440 },
  'gauge-card': { w: 280, h: 280 },
  'status-legend': { w: 480, h: 60 },
  'wide-table': { w: 900, h: 360 },
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
        color: '#1A1A1A',
      };
    case 'indicator-card':
      return { variant: 'plain', title: '指标名称', value: '---', colorTheme: 'blue' };
    case 'bar-chart':
      return {
        title: 'Bar Chart',
        bars: [
          { label: 'A', value: 80, color: '#FF5C00' },
          { label: 'B', value: 60, color: '#3B82F6' },
          { label: 'C', value: 40, color: '#22C55E' },
        ],
      };
    case 'line-chart':
      return {
        title: 'Line Chart',
        series: [
          {
            name: 'Series 1',
            color: '#FF5C00',
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
          { label: 'A', value: 40, color: '#FF5C00' },
          { label: 'B', value: 30, color: '#3B82F6' },
          { label: 'C', value: 30, color: '#22C55E' },
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
        tier: 'macro',
        intro: 'Beauty & Skincare Creator · @miaglowup',
      };
    case 'creator-stats-strip':
      return {
        variant: 'cards',
        stats: [
          { key: 'followers', label: 'Followers', value: '1.28M', color: '#FF5C00', selected: true },
          { key: 'engagement', label: 'Engagement Rate', value: '8.7%', color: '#3B82F6', selected: true },
          { key: 'reach', label: 'Avg. Reach', value: '640K', color: '#22C55E', selected: true },
          { key: 'impressions', label: 'Impressions', value: '12.6M', color: '#8B5CF6', selected: true },
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
              { label: '上海', value: 23, color: '#FF5C00' },
              { label: '北京', value: 18, color: '#FF8C42' },
              { label: '广州', value: 12, color: '#FFB380' },
              { label: '深圳', value: 9, color: '#FFD4B3' },
            ],
            genderSplit: [
              { label: '女', value: 72, color: '#EC4899' },
              { label: '男', value: 28, color: '#3B82F6' },
            ],
            ageRange: [
              { label: '18-24', value: 35, color: '#8B5CF6' },
              { label: '25-34', value: 42, color: '#A78BFA' },
              { label: '35-44', value: 15, color: '#C4B5FD' },
              { label: '45+', value: 8, color: '#DDD6FE' },
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
            trendLabel: '播放趋势',
          },
          {
            topCities: [
              { label: '杭州', value: 21, color: '#FF5C00' },
              { label: '成都', value: 16, color: '#FF8C42' },
              { label: '武汉', value: 11, color: '#FFB380' },
            ],
            genderSplit: [
              { label: '女', value: 85, color: '#EC4899' },
              { label: '男', value: 15, color: '#3B82F6' },
            ],
            ageRange: [
              { label: '18-24', value: 48, color: '#8B5CF6' },
              { label: '25-34', value: 32, color: '#A78BFA' },
              { label: '35-44', value: 14, color: '#C4B5FD' },
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
            trendLabel: '互动趋势',
          },
          {
            topCities: [
              { label: '南京', value: 19, color: '#FF5C00' },
              { label: '苏州', value: 14, color: '#FF8C42' },
            ],
            genderSplit: [
              { label: '女', value: 68, color: '#EC4899' },
              { label: '男', value: 32, color: '#3B82F6' },
            ],
            ageRange: [
              { label: '18-24', value: 29, color: '#8B5CF6' },
              { label: '25-34', value: 47, color: '#A78BFA' },
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
            trendLabel: '播放趋势',
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
        price: '¥80,000',
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
          ['GMV', '¥1.24M', '+15%'],
          ['Commission', '¥98K', '+12%'],
          ['ROAS', '3.21', '+12%'],
          ['Clicks', '120K', '-3%'],
          ['Conversions', '4.35K', '+18%'],
          ['CVR', '3.8%', '+0.4%'],
          ['AOV', '¥72.5', '+1%'],
          ['Spend', '¥128K', '+8%'],
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
          ['sparkle', 'INSIGHT', 'My audience values authenticity and practical beauty tips.'],
          ['target', 'STRATEGY', 'Focus on practical beauty tips and authentic product reviews.'],
        ],
        highlights: 'beauty, tips',
      };
    case 'timeline-compare':
      return {
        variant: 'standard',
        headers: ['指标', '本期', '上期', '状态'],
        rows: [
          ['Total Sales', '¥1.24M', '¥1.08M', 'Exceeded'],
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
          ['', 'Reddit 热议帖', 'RD-104', 'https://example.com/2', '互动 3.2K'],
          ['', 'FB 种草贴', 'FB-220', 'https://example.com/3', '互动 1.8K'],
        ],
      };
    case 'creator-fan-gender':
      return {
        title: 'Fan Gender Breakdown',
        subtitle: 'Female-led',
        center: 'Female 62%',
        slices: [
          { label: 'Female', value: 62, color: '#FF5C00' },
          { label: 'Male', value: 36, color: '#3B82F6' },
          { label: 'Other', value: 2, color: '#8B5CF6' },
        ],
      };
    case 'creator-fan-city':
      return {
        title: 'Top 8 Fan Cities',
        subtitle: 'Tier-1 & new tier-1 cities make up 73%',
        bars: [
          { label: 'Shanghai', value: 22, color: '#FF5C00' },
          { label: 'Guangzhou', value: 16, color: '#3B82F6' },
          { label: 'Beijing', value: 14, color: '#22C55E' },
          { label: 'Shenzhen', value: 12, color: '#8B5CF6' },
          { label: 'Hangzhou', value: 9, color: '#F59E0B' },
          { label: 'Chengdu', value: 7, color: '#EC4899' },
          { label: 'Wuhan', value: 5, color: '#3B82F6' },
          { label: "Xi'an", value: 4, color: '#22C55E' },
        ],
      };
    case 'creator-fan-age':
      return {
        title: 'Fan Age Groups',
        subtitle: '25–34 is the core group',
        bars: [
          { label: '<18', value: 8, color: '#3B82F6' },
          { label: '18-24', value: 28, color: '#FF5C00' },
          { label: '25-34', value: 38, color: '#22C55E' },
          { label: '35-44', value: 18, color: '#8B5CF6' },
          { label: '45+', value: 8, color: '#F59E0B' },
        ],
      };
    case 'creator-fan-interest':
      return {
        title: 'Interest Tags',
        subtitle: 'Beauty & Food are the top two interests',
        showPercent: true,
        tags: [
          { label: 'Beauty', value: 35, color: '#FF5C00' },
          { label: 'Food', value: 28, color: '#3B82F6' },
          { label: 'Fashion', value: 22, color: '#22C55E' },
          { label: 'Travel', value: 15, color: '#8B5CF6' },
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
        title: '单作品数据',
        subtitle: '近 7 天',
        workName: '7-Day Skin Diary · Day 1',
        cover: '',
        metrics: [
          { label: '播放', value: '1.2M', color: '#FF5C00' },
          { label: '点赞', value: '86K', color: '#3B82F6' },
          { label: '评论', value: '2.4K', color: '#22C55E' },
          { label: '转发', value: '1.2K', color: '#8B5CF6' },
          { label: '完播率', value: '42%', color: '#F59E0B' },
          { label: '收藏', value: '5.6K', color: '#EC4899' },
        ],
      };
    case 'comment-wordcloud':
      return {
        title: '评论词云',
        subtitle: '正面口碑为主，集中在功效与质地',
        words: [
          { text: '种草', weight: 90, sentiment: 'pos' },
          { text: '好用', weight: 80, sentiment: 'pos' },
          { text: '回购', weight: 70, sentiment: 'pos' },
          { text: '性价比', weight: 60, sentiment: 'pos' },
          { text: '质地', weight: 55, sentiment: 'neutral' },
          { text: '香味', weight: 45, sentiment: 'neutral' },
          { text: '刺激', weight: 35, sentiment: 'neg' },
          { text: '拔草', weight: 30, sentiment: 'neg' },
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
        color: '#FF5C00',
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
        insight: '该达人在曝光和互动维度表现突出，但转化率有提升空间。',
      };
    case 'creator-work-metrics':
      return {
        variant: 'grid',
        title: '单作品核心指标',
        subtitle: '近 7 天',
        workName: '7-Day Skin Diary · Day 1',
        cover: '',
        metrics: [
          { label: '播放', value: '1.2M', sub: '+15%', color: '#FF5C00' },
          { label: '点赞', value: '86K', sub: '+8%', color: '#3B82F6' },
          { label: '评论', value: '2.4K', sub: '+22%', color: '#22C55E' },
          { label: '转发', value: '1.2K', sub: '+5%', color: '#8B5CF6' },
          { label: '完播率', value: '42%', sub: '+3pt', color: '#F59E0B' },
          { label: '收藏', value: '5.6K', sub: '+12%', color: '#EC4899' },
        ],
      };
    case 'creator-works-table':
      return {
        variant: 'list',
        title: '达人作品列表',
        subtitle: '近期发布作品',
        headers: ['作品', '播放', '点赞', '评论', '转发', '完播率'],
        rows: [
          ['', '夏季护肤分享', '1.2M', '86K', '2.4K', '1.2K', '42%'],
          ['', '开箱测评', '856K', '52K', '1.8K', '890', '38%'],
          ['', '日常 vlog', '432K', '28K', '960', '420', '35%'],
          ['', '好物推荐', '678K', '41K', '1.5K', '670', '40%'],
        ],
      };
    case 'geo-map':
      return {
        title: 'Top Markets by Revenue',
        subtitle: '按国家收入分布',
        colorScheme: 'orange',
        metricLabel: 'Revenue',
        countries: [
          { code: 'US', name: 'United States', value: 45200, display: '$45.2K', share: '32.5%' },
          { code: 'GB', name: 'United Kingdom', value: 18900, display: '$18.9K', share: '13.6%' },
          { code: 'DE', name: 'Germany', value: 14200, display: '$14.2K', share: '10.2%' },
          { code: 'CA', name: 'Canada', value: 11600, display: '$11.6K', share: '8.3%' },
          { code: 'AU', name: 'Australia', value: 9800, display: '$9.8K', share: '7.1%' },
          { code: 'FR', name: 'France', value: 7400, display: '$7.4K', share: '5.3%' },
          { code: 'JP', name: 'Japan', value: 6100, display: '$6.1K', share: '4.4%' },
          { code: 'BR', name: 'Brazil', value: 4200, display: '$4.2K', share: '3.0%' },
        ],
        insight: '北美市场贡献 40.8% 的收入，UK+EU 合计 23.8%。建议加大 DE/FR 本地化素材投入。',
      };
    case 'gauge-card':
      return {
        title: 'New Customer Rate',
        value: '34.6%',
        progress: 34.6,
        shape: 'full',
        color: '#8B5CF6',
        centerLabel: 'New Customer',
        compare: '+5.2pp vs 上期',
        subtitle: '近 30 天新客占比',
      };
    case 'status-legend':
      return {
        title: '',
        items: [
          { status: 'good', label: 'Performing Well' },
          { status: 'warn', label: 'Needs Improvement' },
          { status: 'bad', label: 'Underperforming' },
        ],
      };
    case 'wide-table':
      return {
        title: 'Top Publishers by Revenue',
        subtitle: '联盟营销 Publisher 排行',
        freezeFirstCol: true,
        headers: ['Publisher', 'Clicks', 'Impressions', 'CTR', 'Conversions', 'CVR', 'Revenue', 'Commission', 'EPC', 'ROAS', 'AOV', 'Status'],
        rows: [
          ['GlamourBlog', '12.4K', '1.2M', '1.03%', '386', '3.11%', '$72.9K', '$8.7K', '$5.88', '4.2x', '$189', 'good'],
          ['BeautyHub', '8.9K', '890K', '1.00%', '241', '2.71%', '$45.6K', '$5.5K', '$5.12', '3.8x', '$189', 'good'],
          ['TrendyDaily', '6.2K', '620K', '1.00%', '142', '2.29%', '$26.8K', '$3.2K', '$4.32', '2.9x', '$189', 'warn'],
          ['StyleMaven', '4.1K', '410K', '1.00%', '78', '1.90%', '$14.7K', '$1.8K', '$3.59', '2.1x', '$189', 'warn'],
          ['ViralVogue', '2.8K', '280K', '1.00%', '34', '1.21%', '$6.4K', '$770', '$2.29', '1.3x', '$189', 'bad'],
        ],
        rowStatus: ['good', 'good', 'warn', 'warn', 'bad'],
      };
    default:
      return { content: '', fontSize: 14, color: '#1A1A1A' };
  }
}

export function getDefaultShapeData(shape: ShapeKind): ShapeData {
  if (shape === 'line') {
    return { shape: 'line', stroke: '#E5E7EB', strokeWidth: 1, opacity: 1, rotation: 0, dash: false };
  }
  const base: ShapeData = {
    shape,
    fill: '#FF5C00',
    stroke: '#E5E7EB',
    strokeWidth: 0,
    opacity: 1,
    rotation: 0,
  };
  if (shape === 'rounded') return { ...base, borderRadius: 12 };
  return base;
}
