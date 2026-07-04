/**
 * 组件默认尺寸 / 默认数据。供 editor store（addComponent）与 REGISTRY 共用，
 * 避免循环依赖（REGISTRY 含 React 组件）。忠实 demo.html。
 */
import type { ComponentType, ComponentData } from '@mediakit/shared';

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
  'brand-wall': { w: 700, h: 200 },
  'package-card': { w: 320, h: 320 },
  'kpi-board': { w: 900, h: 200 },
  'timeline-compare': { w: 900, h: 240 },
  'product-performance': { w: 900, h: 280 },
  'placement-display': { w: 700, h: 280 },
  'post-list': { w: 900, h: 240 },
};

/** 移动吸附步长（demo：10px 网格）。 */
export const MOVE_SNAP = 10;
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
        fontFamily: 'Inter',
        fontWeight: 400,
        color: '#1A1A1A',
      };
    case 'indicator-card':
      return { title: '指标名称', value: '---', colorTheme: 'blue' };
    case 'bar-chart':
      return {
        title: '柱状图',
        bars: [
          { label: 'A', value: 80, color: '#FF5C00' },
          { label: 'B', value: 60, color: '#3B82F6' },
          { label: 'C', value: 40, color: '#22C55E' },
        ],
      };
    case 'line-chart':
      return {
        title: '折线图',
        series: [
          {
            name: '系列1',
            color: '#FF5C00',
            points: [
              { label: '周一', value: 30 },
              { label: '周二', value: 60 },
              { label: '周三', value: 45 },
              { label: '周四', value: 80 },
              { label: '周五', value: 55 },
            ],
          },
        ],
      };
    case 'pie-chart':
      return {
        title: '饼图',
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
        headers: ['封面', '标题', 'Shares', 'Likes', 'Comments'],
        rows: [
          ['', '7 天肌肤日记 · Day 1', '1.2K', '86K', '2.4K'],
          ['', '敏感肌精华实测', '980', '54K', '1.8K'],
          ['', '早安护肤流程', '760', '42K', '1.2K'],
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
          ['Sales', '¥1.24M', '+15%'],
          ['Commission', '¥98K', '+12%'],
          ['CVR', '3.8%', '+0.4%'],
          ['New Customer', '62%', '+5%'],
          ['Clicks', '120K', '-3%'],
          ['Orders', '8.4K', '+9%'],
        ],
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
    default:
      return { content: '', fontSize: 14, color: '#1A1A1A' };
  }
}
