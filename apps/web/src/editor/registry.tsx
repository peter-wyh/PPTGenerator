import type { FC } from 'react';
import type { ComponentType, EditorComponent } from '@mediakit/shared';
import { DEFAULT_SIZES, getDefaultData } from './defaults';
import {
  BarChartComponent,
  ImageComponent,
  IndicatorCardComponent,
  LineChartComponent,
  PieChartComponent,
  TableComponent,
  TextComponent,
} from './components/BasicComponents';
import { BusinessBlockRenderer } from './business/render';
import {
  CreatorAvatarCard,
  CreatorStatsStrip,
  CreatorWorksList,
} from './components/CreatorComponents';
import { BrandWall, PackageCard } from './components/CompanyComponents';
import { KpiBoard, TimelineCompare, PlacementDisplay, PostList, ProductPerformance } from './components/ReportComponents';

/* ---------------------------- property schema ---------------------------- */

export type PropertyFieldKind =
  | 'text'
  | 'textarea'
  | 'number'
  | 'color'
  | 'select'
  | 'list' // {label,value,color}[] —— 柱状/饼图
  | 'table'; // TableData headers+rows

export interface SelectOption {
  value: string;
  label: string;
}

/** 组件样式变体（版式）选项。声明后属性面板渲染 chip 选择器，写入 data.variant。 */
export interface VariantOption {
  id: string;
  label: string;
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
      { key: 'src', label: '图片地址', kind: 'text' },
      { key: 'fit', label: '填充', kind: 'select', options: FITS },
    ],
  },
  'indicator-card': {
    Component: IndicatorCardComponent,
    defaultSize: DEFAULT_SIZES['indicator-card'],
    defaultData: () => getDefaultData('indicator-card'),
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
      { key: 'value', label: '主数值', kind: 'text' },
      { key: 'trend', label: '副文本', kind: 'text' },
      { key: 'trendUp', label: '趋势', kind: 'select', options: [{ value: 'true', label: '上升' }, { value: 'false', label: '下降' }] },
      { key: 'colorTheme', label: '主题色', kind: 'select', options: THEMES },
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
    ],
    propertySchema: [
      { key: 'avatar', label: '头像 URL', kind: 'text' },
      { key: 'name', label: '名称', kind: 'text' },
      { key: 'platform', label: '平台', kind: 'select', options: PLATFORMS },
      { key: 'tier', label: '层级', kind: 'select', options: TIERS },
      { key: 'intro', label: '简介', kind: 'textarea' },
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
    ],
    propertySchema: [{ key: 'stats', label: '数据项', kind: 'list' }],
  },
  'creator-works-list': {
    Component: CreatorWorksList,
    defaultSize: DEFAULT_SIZES['creator-works-list'],
    defaultData: () => getDefaultData('creator-works-list'),
    variants: [
      { id: 'cards', label: '卡片' },
      { id: 'row', label: '列表行' },
      { id: 'compact', label: '紧凑' },
    ],
    propertySchema: [{ key: '', label: '作品内容', kind: 'table' }],
  },
  'brand-wall': {
    Component: BrandWall,
    defaultSize: DEFAULT_SIZES['brand-wall'],
    defaultData: () => getDefaultData('brand-wall'),
    variants: [
      { id: 'grid', label: '网格' },
      { id: 'row', label: '横排' },
      { id: 'marquee', label: '条带' },
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
    ],
    propertySchema: [{ key: '', label: 'KPI 列表', kind: 'table' }],
  },
  'timeline-compare': {
    Component: TimelineCompare,
    defaultSize: DEFAULT_SIZES['timeline-compare'],
    defaultData: () => getDefaultData('timeline-compare'),
    variants: [
      { id: 'standard', label: '标准' },
      { id: 'mini', label: '极简' },
      { id: 'with-bar', label: '带变化条' },
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
