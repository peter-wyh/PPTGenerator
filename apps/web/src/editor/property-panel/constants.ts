import type { ShapeKind, Sentiment } from '@mediakit/shared';
import type { Alignment } from '../store';

export const LABELS: Record<string, string> = {
  text: '文本',
  image: '图片',
  'indicator-card': '指标卡',
  'bar-chart': '柱状图',
  'line-chart': '折线图',
  'pie-chart': '饼图',
  table: '表格',
  'business-block': '业务组件',
  'strategy-block': '策略块',
  'meta-strip': '基础信息',
  'creator-avatar-card': '达人头像卡',
  'creator-stats-strip': '达人数据条',
  'creator-works-list': '达人作品列表',
  'creator-list': '达人列表',
  'creator-fan-gender': '性别占比',
  'creator-fan-city': '城市分布',
  'creator-fan-age': '年龄段',
  'creator-fan-interest': '兴趣标签',
  'creator-audience-profile': '用户画像',
  'brand-wall': '品牌墙',
  'package-card': '套餐卡',
  'kpi-board': '业绩看板',
  'timeline-compare': '周期对比表',
  'product-performance': '商品表现',
  'placement-display': '广告位展示',
  'post-list': 'Post 列表',
  'work-screenshot': '作品截图',
  'work-metrics': '作品数据',
  'comment-wordcloud': '评论词云',
  'shape': '图形',
  'image-group': '组图',
  'title-block': '标题块',
  'campaign-analysis': '分析图表',
  'creator-work-metrics': '作品指标',
  'creator-works-table': '作品列表',
};

export const GRADIENT_ANGLE_PRESETS: { angle: number; label: string }[] = [
  { angle: 0, label: '→' },
  { angle: 45, label: '↘' },
  { angle: 90, label: '↓' },
  { angle: 135, label: '↙' },
  { angle: 180, label: '←' },
  { angle: 225, label: '↖' },
  { angle: 270, label: '↑' },
  { angle: 315, label: '↗' },
];

export const SHAPE_OPTIONS: { id: ShapeKind; label: string }[] = [
  { id: 'rectangle', label: '矩形' },
  { id: 'rounded', label: '圆角' },
  { id: 'circle', label: '圆形' },
  { id: 'line', label: '直线' },
];

export const WORDCLOUD_SENTIMENT_OPTIONS: { value: Sentiment; label: string }[] = [
  { value: 'pos', label: '正面' },
  { value: 'neg', label: '负面' },
  { value: 'neutral', label: '中性' },
];


export const ALIGN_BUTTONS: { label: string; alignment: Alignment }[] = [
  { label: '左对齐', alignment: 'left' },
  { label: '水平居中', alignment: 'center-h' },
  { label: '右对齐', alignment: 'right' },
  { label: '顶对齐', alignment: 'top' },
  { label: '垂直居中', alignment: 'middle-v' },
  { label: '底对齐', alignment: 'bottom' },
];
