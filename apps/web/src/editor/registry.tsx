import type { FC } from 'react';
import type { ComponentType, EditorComponent, IconWeight } from '@mediakit/shared';
import { DEFAULT_SIZES, getDefaultData } from './defaults';
import {
  BarChartComponent,
  ImageComponent,
  IndicatorCardComponent,
  LineChartComponent,
  PieChartComponent,
  ShapeComponent,
  TableComponent,
  TextComponent,
} from './components/BasicComponents';
import { BusinessBlockRenderer } from './business/render';
import {
  CreatorAvatarCard,
  CreatorStatsStrip,
  CreatorWorksList,
  CreatorList,
  CreatorFanGender,
  CreatorFanCity,
  CreatorFanAge,
  CreatorFanInterest,
} from './components/CreatorComponents';
import { BrandWall, PackageCard } from './components/CompanyComponents';
import {
  KpiBoard,
  MetaStripComponent,
  StrategyBlockComponent,
  TimelineCompare,
  PlacementDisplay,
  PostList,
  ProductPerformance,
} from './components/ReportComponents';
import { WorkScreenshot, WorkMetrics, CommentWordcloud } from './components/WorksComponents';
import { ImageGroupComponent } from './components/ImageGroupComponent';

/* ---------------------------- property schema ---------------------------- */

export type PropertyFieldKind =
  | 'text'
  | 'textarea'
  | 'number'
  | 'color'
  | 'select'
  | 'image-url' // 图片 URL（文本 + 上传 + 裁剪）
  | 'list' // {label,value,color}[] —— 柱状/饼图
  | 'table' // TableData headers+rows
  | 'icon'; // catalog 图标选择器（读写 data.icon / data.iconWeight）

export interface SelectOption {
  value: string;
  label: string;
}

/** 组件样式变体（版式）选项。声明后属性面板渲染 chip 选择器，写入 data.variant。 */
export interface VariantOption {
  id: string;
  label: string;
  /**
   * 变体声明图标支持。存在即启用：
   *  - 渲染层在该变体的图标位渲染 <IconKit>
   *  - 属性面板对该组件显示 icon 字段
   * 缺省（undefined）= 该变体不涉及图标。
   */
  icon?: {
    position?: 'left' | 'top' | 'bg';
    defaultKey?: string;
    defaultWeight?: IconWeight;
  };
}

export interface PropertyField {
  key: string;
  label: string;
  kind: PropertyFieldKind;
  options?: SelectOption[];
  /** 嵌套在 data 下（默认 true）。x/y/w/h 等几何字段为 false。 */
  inData?: boolean;
}

export interface BlockDef {
  Component: FC<{ data: any }>;
  defaultSize: { w: number; h: number };
  defaultData: () => unknown;
  propertySchema: PropertyField[];
  /** 可选：该组件支持的样式变体。出现时属性面板渲染 chip 选择器。 */
  variants?: VariantOption[];
}

/** 通用几何字段（x/y/w/h），始终展示。 */
const GEOMETRY: PropertyField[] = [
  { key: 'x', label: 'X', kind: 'number', inData: false },
  { key: 'y', label: 'Y', kind: 'number', inData: false },
  { key: 'w', label: 'W', kind: 'number', inData: false },
  { key: 'h', label: 'H', kind: 'number', inData: false },
];

const FONT_WEIGHTS: SelectOption[] = [
  { value: '400', label: '常规' },
  { value: '500', label: '中等' },
  { value: '600', label: '半粗' },
  { value: '700', label: '粗体' },
];

const THEMES: SelectOption[] = [
  { value: 'blue', label: '蓝' },
  { value: 'green', label: '绿' },
  { value: 'orange', label: '橙' },
  { value: 'purple', label: '紫' },
  { value: 'red', label: '红' },
];

const FITS: SelectOption[] = [
  { value: 'cover', label: 'cover' },
  { value: 'contain', label: 'contain' },
  { value: 'fill', label: 'fill' },
];

const PLATFORMS: SelectOption[] = [
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'weibo', label: '微博' },
];

const TIERS: SelectOption[] = [
  { value: 'mega', label: 'Mega 头部' },
  { value: 'macro', label: 'Macro 中腰' },
  { value: 'micro', label: 'Micro 微' },
];

export const REGISTRY: Record<ComponentType, BlockDef> = {
  text: {
    Component: TextComponent,
    defaultSize: DEFAULT_SIZES.text,
    defaultData: () => getDefaultData('text'),
    propertySchema: [
      { key: 'content', label: '内容', kind: 'textarea' },
      { key: 'fontSize', label: '字号', kind: 'number' },
      { key: 'fontWeight', label: '粗细', kind: 'select', options: FONT_WEIGHTS },
      { key: 'color', label: '颜色', kind: 'color' },
    ],
  },
  image: {
    Component: ImageComponent,
    defaultSize: DEFAULT_SIZES.image,
    defaultData: () => getDefaultData('image'),
    propertySchema: [
      { key: 'src', label: '图片地址', kind: 'image-url' },
      { key: 'fit', label: '填充', kind: 'select', options: FITS },
    ],
  },
  'indicator-card': {
    Component: IndicatorCardComponent,
    defaultSize: DEFAULT_SIZES['indicator-card'],
    defaultData: () => getDefaultData('indicator-card'),
    variants: [
      { id: 'plain', label: '极简' },
      { id: 'icon-left', label: '图标左', icon: { position: 'left', defaultKey: 'trend-up', defaultWeight: 'regular' } },
      { id: 'icon-top', label: '图标上', icon: { position: 'top', defaultKey: 'trend-up', defaultWeight: 'fill' } },
      { id: 'icon-bg', label: '图标水印', icon: { position: 'bg', defaultKey: 'trend-up', defaultWeight: 'fill' } },
      { id: 'spotlight', label: '聚光', icon: { position: 'left', defaultKey: 'trend-up', defaultWeight: 'fill' } },
      { id: 'duo', label: '双值', icon: { position: 'left', defaultKey: 'chart-bar', defaultWeight: 'regular' } },
    ],
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
      { key: 'value', label: '主数值', kind: 'text' },
      { key: 'trend', label: '副文本', kind: 'text' },
      { key: 'trendUp', label: '趋势', kind: 'select', options: [{ value: 'true', label: '上升' }, { value: 'false', label: '下降' }] },
      { key: 'colorTheme', label: '主题色', kind: 'select', options: THEMES },
      // 注：图标字段不放进 propertySchema——PropertyPanel 会按当前变体的 icon 声明注入（plain 隐藏，其余显示），
      // 否则会与变体注入重复渲染（key 冲突）并在 plain 下误显示。
    ],
  },
  'bar-chart': {
    Component: BarChartComponent,
    defaultSize: DEFAULT_SIZES['bar-chart'],
    defaultData: () => getDefaultData('bar-chart'),
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
      { key: 'bars', label: '数据', kind: 'list' },
    ],
  },
  'line-chart': {
    Component: LineChartComponent,
    defaultSize: DEFAULT_SIZES['line-chart'],
    defaultData: () => getDefaultData('line-chart'),
    propertySchema: [{ key: 'title', label: '标题', kind: 'text' }],
  },
  'pie-chart': {
    Component: PieChartComponent,
    defaultSize: DEFAULT_SIZES['pie-chart'],
    defaultData: () => getDefaultData('pie-chart'),
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
      { key: 'slices', label: '数据', kind: 'list' },
    ],
  },
  table: {
    Component: TableComponent,
    defaultSize: DEFAULT_SIZES.table,
    defaultData: () => getDefaultData('table'),
    propertySchema: [{ key: '', label: '表格内容', kind: 'table' }],
  },
  'shape': {
    Component: ShapeComponent,
    defaultSize: DEFAULT_SIZES['shape'],
    defaultData: () => getDefaultData('shape'),
    propertySchema: [],
  },
  'business-block': {
    Component: BusinessBlockRenderer,
    defaultSize: DEFAULT_SIZES['business-block'],
    defaultData: () => getDefaultData('business-block'),
    propertySchema: [
      { key: 'businessKind', label: '业务类型', kind: 'text' },
      { key: 'title', label: '标题', kind: 'text' },
      { key: 'meta', label: '说明', kind: 'text' },
    ],
  },
  'creator-avatar-card': {
    Component: CreatorAvatarCard,
    defaultSize: DEFAULT_SIZES['creator-avatar-card'],
    defaultData: () => getDefaultData('creator-avatar-card'),
    variants: [
      { id: 'horizontal', label: '横排' },
      { id: 'vertical', label: '竖排' },
      { id: 'compact', label: '紧凑' },
      { id: 'badge', label: '徽章' },
      { id: 'banner', label: '横幅' },
    ],
    propertySchema: [
      { key: 'avatar', label: '头像 URL', kind: 'image-url' },
      { key: 'name', label: '名称', kind: 'text' },
      { key: 'platform', label: '平台', kind: 'select', options: PLATFORMS },
      { key: 'tier', label: '层级', kind: 'select', options: TIERS },
      { key: 'intro', label: '简介', kind: 'textarea' },
      { key: 'handle', label: 'Handle', kind: 'text' },
      { key: 'followers', label: 'Followers', kind: 'text' },
      { key: 'likes', label: 'Likes', kind: 'text' },
      { key: 'engagement', label: 'Engagement Rate', kind: 'text' },
    ],
  },
  'creator-stats-strip': {
    Component: CreatorStatsStrip,
    defaultSize: DEFAULT_SIZES['creator-stats-strip'],
    defaultData: () => getDefaultData('creator-stats-strip'),
    variants: [
      { id: 'cards', label: '卡片' },
      { id: 'plain', label: '极简' },
      { id: 'metric', label: '指标' },
      { id: 'progress', label: '进度条' },
      { id: 'ring', label: '环形' },
    ],
    // stats 由 PropertyPanel 的自定义区块 CreatorStatsFields 负责（指标库勾选 + 文案编辑）。
    propertySchema: [],
  },
  'creator-works-list': {
    Component: CreatorWorksList,
    defaultSize: DEFAULT_SIZES['creator-works-list'],
    defaultData: () => getDefaultData('creator-works-list'),
    variants: [
      { id: 'cards', label: '卡片' },
      { id: 'row', label: '列表行' },
      { id: 'compact', label: '紧凑' },
      { id: 'detailed', label: '详细+受众' },
    ],
    propertySchema: [{ key: '', label: '作品内容', kind: 'table' }],
  },
  'creator-list': {
    Component: CreatorList,
    defaultSize: DEFAULT_SIZES['creator-list'],
    defaultData: () => getDefaultData('creator-list'),
    variants: [
      { id: 'table', label: '表格' },
      { id: 'cards', label: '卡片' },
      { id: 'compact', label: '紧凑' },
    ],
    propertySchema: [{ key: '', label: '达人列表', kind: 'table' }],
  },
  'brand-wall': {
    Component: BrandWall,
    defaultSize: DEFAULT_SIZES['brand-wall'],
    defaultData: () => getDefaultData('brand-wall'),
    variants: [
      { id: 'grid', label: '网格' },
      { id: 'row', label: '横排' },
      { id: 'marquee', label: '条带' },
      { id: 'circle', label: '圆形头像' },
      { id: 'fade', label: '渐入网格' },
    ],
    propertySchema: [{ key: '', label: '品牌列表', kind: 'table' }],
  },
  'package-card': {
    Component: PackageCard,
    defaultSize: DEFAULT_SIZES['package-card'],
    defaultData: () => getDefaultData('package-card'),
    variants: [
      { id: 'standard', label: '标准' },
      { id: 'featured', label: '推荐' },
      { id: 'compact', label: '紧凑' },
      { id: 'table', label: '表格行' },
    ],
    propertySchema: [
      { key: 'name', label: '套餐名', kind: 'text' },
      { key: 'price', label: '价格', kind: 'text' },
      {
        key: 'highlighted',
        label: '高亮推荐',
        kind: 'select',
        options: [
          { value: 'true', label: '是' },
          { value: 'false', label: '否' },
        ],
      },
      { key: '', label: '特性列表', kind: 'table' },
    ],
  },
  'kpi-board': {
    Component: KpiBoard,
    defaultSize: DEFAULT_SIZES['kpi-board'],
    defaultData: () => getDefaultData('kpi-board'),
    variants: [
      { id: 'grid', label: '网格' },
      { id: 'row', label: '横排' },
      { id: 'compact', label: '紧凑' },
      { id: 'card', label: '卡片' },
      { id: 'gradient', label: '渐变' },
      { id: 'minimal', label: '极简线框' },
      { id: 'flat', label: '平铺指标条' },
    ],
    propertySchema: [{ key: '', label: 'KPI 列表', kind: 'table' }],
  },
  'meta-strip': {
    Component: MetaStripComponent,
    defaultSize: DEFAULT_SIZES['meta-strip'],
    defaultData: () => getDefaultData('meta-strip'),
    variants: [
      { id: 'inline', label: '横排胶囊' },
      { id: 'divider', label: '竖线分隔' },
      { id: 'list', label: '键值列表' },
      { id: 'cards', label: '卡片网格' },
      { id: 'stat', label: '强调数值' },
    ],
    propertySchema: [{ key: '', label: '信息项', kind: 'table' }],
  },
  'strategy-block': {
    Component: StrategyBlockComponent,
    defaultSize: DEFAULT_SIZES['strategy-block'],
    defaultData: () => getDefaultData('strategy-block'),
    variants: [
      { id: 'default', label: '默认' },
      { id: 'labeled', label: '卡片标签' },
      { id: 'bulleted', label: '卡片列表' },
    ],
    // 行编辑（图标/标题/富文本内容）由 PropertyPanel 的 StrategyBlockFields 负责。
    propertySchema: [{ key: 'highlights', label: '高亮词（逗号分隔）', kind: 'textarea' }],
  },
  'timeline-compare': {
    Component: TimelineCompare,
    defaultSize: DEFAULT_SIZES['timeline-compare'],
    defaultData: () => getDefaultData('timeline-compare'),
    variants: [
      { id: 'standard', label: '标准' },
      { id: 'mini', label: '极简' },
      { id: 'with-bar', label: '带变化条' },
      { id: 'cards', label: '卡片' },
    ],
    propertySchema: [{ key: '', label: '对比数据', kind: 'table' }],
  },
  'product-performance': {
    Component: ProductPerformance,
    defaultSize: DEFAULT_SIZES['product-performance'],
    defaultData: () => getDefaultData('product-performance'),
    variants: [
      { id: 'cards', label: '卡片' },
      { id: 'rank', label: '排行榜' },
      { id: 'grid', label: '网格' },
      { id: 'bar', label: '条形图' },
    ],
    propertySchema: [
      { key: 'insight', label: 'AI 洞察', kind: 'textarea' },
      { key: '', label: '商品列表', kind: 'table' },
    ],
  },
  'placement-display': {
    Component: PlacementDisplay,
    defaultSize: DEFAULT_SIZES['placement-display'],
    defaultData: () => getDefaultData('placement-display'),
    variants: [
      { id: 'single', label: '单大图' },
      { id: 'grid', label: '网格' },
      { id: 'with-text', label: '含亮点' },
    ],
    propertySchema: [
      { key: 'highlights', label: 'Highlights', kind: 'textarea' },
      { key: 'learnings', label: 'Learnings', kind: 'textarea' },
      { key: '', label: '广告位列表', kind: 'table' },
    ],
  },
  'post-list': {
    Component: PostList,
    defaultSize: DEFAULT_SIZES['post-list'],
    defaultData: () => getDefaultData('post-list'),
    variants: [
      { id: 'cards', label: '卡片' },
      { id: 'row', label: '列表行' },
      { id: 'compact', label: '紧凑' },
    ],
    propertySchema: [{ key: '', label: 'Post 列表', kind: 'table' }],
  },
  'creator-fan-gender': {
    Component: CreatorFanGender,
    defaultSize: DEFAULT_SIZES['creator-fan-gender'],
    defaultData: () => getDefaultData('creator-fan-gender'),
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
      { key: 'subtitle', label: '副标题（清空隐藏）', kind: 'text' },
      { key: 'center', label: '中心文案', kind: 'text' },
      { key: 'slices', label: '性别项', kind: 'list' },
    ],
  },
  'creator-fan-city': {
    Component: CreatorFanCity,
    defaultSize: DEFAULT_SIZES['creator-fan-city'],
    defaultData: () => getDefaultData('creator-fan-city'),
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
      { key: 'subtitle', label: '副标题（清空隐藏）', kind: 'text' },
      { key: 'bars', label: '城市数据', kind: 'list' },
    ],
  },
  'creator-fan-age': {
    Component: CreatorFanAge,
    defaultSize: DEFAULT_SIZES['creator-fan-age'],
    defaultData: () => getDefaultData('creator-fan-age'),
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
      { key: 'subtitle', label: '副标题（清空隐藏）', kind: 'text' },
      { key: 'bars', label: '年龄段数据', kind: 'list' },
    ],
  },
  'creator-fan-interest': {
    Component: CreatorFanInterest,
    defaultSize: DEFAULT_SIZES['creator-fan-interest'],
    defaultData: () => getDefaultData('creator-fan-interest'),
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
      { key: 'subtitle', label: '副标题（清空隐藏）', kind: 'text' },
      { key: 'tags', label: '兴趣标签', kind: 'list' },
    ],
  },
  'work-screenshot': {
    Component: WorkScreenshot,
    defaultSize: DEFAULT_SIZES['work-screenshot'],
    defaultData: () => getDefaultData('work-screenshot'),
    variants: [
      { id: 'auto', label: '自适应' },
      { id: 'duo', label: '2 张' },
      { id: 'trio', label: '3 张' },
      { id: 'quad', label: '4 张' },
      { id: 'mosaic-5', label: '5 张' },
      { id: 'hex', label: '6 张' },
      { id: 'septet', label: '7 张' },
      { id: 'nona', label: '9 张' },
      { id: 'duoza', label: '12 张' },
    ],
    propertySchema: [{ key: 'title', label: '标题', kind: 'text' }],
  },
  'work-metrics': {
    Component: WorkMetrics,
    defaultSize: DEFAULT_SIZES['work-metrics'],
    defaultData: () => getDefaultData('work-metrics'),
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
      { key: 'subtitle', label: '副标题', kind: 'text' },
      { key: 'workName', label: '作品名', kind: 'text' },
      { key: 'cover', label: '作品封面', kind: 'image-url' },
    ],
  },
  'comment-wordcloud': {
    Component: CommentWordcloud,
    defaultSize: DEFAULT_SIZES['comment-wordcloud'],
    defaultData: () => getDefaultData('comment-wordcloud'),
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
      { key: 'subtitle', label: '副标题', kind: 'text' },
    ],
  },
  'image-group': {
    Component: ImageGroupComponent,
    defaultSize: DEFAULT_SIZES['image-group'],
    defaultData: () => getDefaultData('image-group'),
    // variant = 数量版式（自适应 + 2/3/4/5/6/7/9/12）；图片在 ImageGroupFields 编辑。
    variants: [
      { id: 'auto', label: '自适应' },
      { id: 'duo', label: '2 张' },
      { id: 'trio', label: '3 张' },
      { id: 'quad', label: '4 张' },
      { id: 'mosaic-5', label: '5 张' },
      { id: 'hex', label: '6 张' },
      { id: 'septet', label: '7 张' },
      { id: 'nona', label: '9 张' },
      { id: 'duoza', label: '12 张' },
    ],
    propertySchema: [],
  },
};

/** REGISTRY 的几何字段（属性面板追加在每类字段之后）。 */
export const GEOMETRY_FIELDS = GEOMETRY;

/** 根据 type 取 BlockDef。 */
export function getBlock(type: ComponentType): BlockDef {
  return REGISTRY[type];
}

/** 渲染单个组件（按 type 分发）。 */
export function renderComponent(comp: EditorComponent): React.ReactNode {
  const def = REGISTRY[comp.type];
  const Comp = def.Component;
  return <Comp data={comp.data} />;
}
