import type { ShapeKind, Sentiment } from '@mediakit/shared';
import type { Alignment } from '../store';

export const LABELS: Record<string, string> = {
  // 基础
  text: '基础·文本',
  image: '基础·图片',
  'image-group': '基础·组图',
  shape: '基础·图形',
  'title-block': '基础·标题块',
  'business-block': '基础·业务组件',
  'content-card': '基础·卡片',
  // 图表
  'bar-chart': '图表·柱状图',
  'line-chart': '图表·折线图',
  'pie-chart': '图表·饼图',
  'campaign-analysis': '图表·分析图',
  table: '图表·表格',
  'timeline-compare': '图表·周期对比表',
  'kpi-board': '业绩·看板',
  'indicator-card': '业绩·指标卡',
  'product-performance': '业绩·商品表现',
  'strategy-block': '业绩·策略块',
  // 达人
  'creator-avatar-card': '达人·头像卡',
  'creator-stats-strip': '达人·数据条',
  'creator-works-list': '达人·作品列表',
  'creator-works-table': '达人·作品表格',
  'creator-work-metrics': '达人·作品指标',
  'creator-list': '达人·列表',
  'creator-fan-gender': '达人·性别占比',
  'creator-fan-city': '达人·城市分布',
  'creator-fan-age': '达人·年龄段',
  'creator-fan-interest': '达人·兴趣标签',
  'creator-audience-profile': '达人·用户画像',
  'work-screenshot': '达人·作品截图',
  'work-metrics': '达人·作品数据',
  // 展示
  'brand-wall': '展示·品牌墙',
  'package-card': '展示·套餐卡',
  'meta-strip': '展示·基础信息',
  'placement-display': '展示·广告位',
  'post-list': '展示·Post 列表',
  'comment-wordcloud': '展示·评论词云',
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
