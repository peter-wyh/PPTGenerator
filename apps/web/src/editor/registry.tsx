import type { FC } from 'react';
import type { ComponentType, EditorComponent, IconWeight, DataSourceMode } from '@mediakit/shared';
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
  ContentCard,
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
  CampaignAnalysis,
  CreatorWorkMetrics,
  CreatorWorksTable,
  SwotMatrix,
  CampaignSummaryBoard,
  FunnelChartView,
  RevenueTimelineChart,
  PublisherTable,
  GeoDistribution,
  PlacementWideTableView,
  PlacementTypeSummaryView,
  DeviceBreakdownView,
  ContentTopicView,
  SearchTermTableView,
  HourlyHeatmapView,
  CreatorAudienceProfile,
} from './components/report';
import { WorkScreenshot, WorkMetrics, CommentWordcloud } from './components/WorksComponents';
import { ImageGroupComponent } from './components/ImageGroupComponent';
import { TitleBlock } from './components/BasicComponents';
import { parseCreatorLink } from './creatorLink';
import {
  ReportCreatorAvatarImporter,
  ReportCreatorMetaStripImporter,
  ReportCreatorStatsImporter,
  ReportCreatorListImporter,
  ReportCreatorWorksImporter,
  ReportWorkScreenshotImporter,
  ReportWorkMetricsImporter,
  ReportCommentWordcloudImporter,
  ReportWorkAudienceImporter,
  ChartImportButton,
  KpiBoardImporter,
  CampaignReportImporter,
} from './property-panel/importers';

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
  // 异构 registry 边界：每个组件有各自的 data 类型（TextData / BarChartData …），
  // registry 需统一存储。此处 any 是刻意为之——同 TypeScript 中 Map<string, FC> 的标准做法。
  // 实际类型安全由各组件函数签名保证，ComponentRenderer 仅做分发。
  Component: FC<{ data: any }>; // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultSize: { w: number; h: number };
  defaultData: () => unknown;
  propertySchema: PropertyField[];
  /** 可选：该组件支持的样式变体。出现时属性面板渲染 chip 选择器。 */
  variants?: VariantOption[];
  /** 可选：数据源配置。出现时属性面板渲染模式切换器（手动/URL/项目导入互斥）。 */
  dataSource?: DataSourceConfig;
}

/**
 * 数据源配置：声明组件支持哪些数据获取模式，以及各模式的实现。
 * PropertyPanel 根据此配置渲染对应 UI。
 */
export interface DataSourceConfig {
  /** 支持的模式列表（顺序决定 UI 展示顺序）。至少含 'manual'。 */
  modes: DataSourceMode[];
  /**
   * URL 解析器。async 函数，接收 URL 返回 data patch。
   * 仅 modes 含 'url' 时需要。
   */
  urlResolver?: (url: string) => Promise<Record<string, unknown>>;
  /**
   * 项目导入组件。仅 modes 含 'project' 时需要。
   * 接收当前 comp，内部自行处理导入逻辑。
   */
  projectImporter?: FC<{ comp: EditorComponent }>;
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
  { value: 'xiaohongshu', label: 'Xiaohongshu' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'weibo', label: 'Weibo' },
];

const TIERS: SelectOption[] = [
  { value: 'mega', label: 'Mega' },
  { value: 'macro', label: 'Macro' },
  { value: 'micro', label: 'Micro' },
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
    variants: [
      { id: 'vertical', label: '竖向柱状' },
      { id: 'horizontal', label: '横向条形' },
      { id: 'stacked', label: '堆叠柱状' },
    ],
    dataSource: {
      modes: ['manual', 'project'],
      projectImporter: ChartImportButton,
    },
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
      { key: 'bars', label: '数据', kind: 'list' },
    ],
  },
  'line-chart': {
    Component: LineChartComponent,
    defaultSize: DEFAULT_SIZES['line-chart'],
    defaultData: () => getDefaultData('line-chart'),
    dataSource: {
      modes: ['manual', 'project'],
      projectImporter: ChartImportButton,
    },
    propertySchema: [{ key: 'title', label: '标题', kind: 'text' }],
  },
  'pie-chart': {
    Component: PieChartComponent,
    defaultSize: DEFAULT_SIZES['pie-chart'],
    defaultData: () => getDefaultData('pie-chart'),
    dataSource: {
      modes: ['manual', 'project'],
      projectImporter: ChartImportButton,
    },
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
      { id: 'glass', label: '毛玻璃' },
      { id: 'hero', label: 'Hero' },
      { id: 'minimal', label: '极简' },
    ],
    dataSource: {
      modes: ['manual', 'url', 'project'],
      urlResolver: parseCreatorLink,
      projectImporter: ReportCreatorAvatarImporter,
    },
    propertySchema: [
      { key: 'avatar', label: '头像 URL', kind: 'image-url' },
      { key: 'name', label: '名称', kind: 'text' },
      { key: 'platform', label: '主平台', kind: 'select', options: PLATFORMS },
      { key: 'platforms', label: '全部平台（逗号分隔）', kind: 'text' },
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
      { id: 'gradient', label: '渐变' },
    ],
    dataSource: {
      modes: ['manual', 'project'],
      projectImporter: ReportCreatorStatsImporter,
    },
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
    dataSource: {
      modes: ['manual', 'project'],
      projectImporter: ReportCreatorWorksImporter,
    },
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
    dataSource: {
      modes: ['manual', 'project'],
      projectImporter: ReportCreatorListImporter,
    },
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
    dataSource: {
      modes: ['manual', 'project'],
      projectImporter: KpiBoardImporter,
    },
    propertySchema: [{ key: '', label: 'KPI 列表', kind: 'table' }],
  },
  'meta-strip': {
    Component: MetaStripComponent,
    defaultSize: DEFAULT_SIZES['meta-strip'],
    defaultData: () => getDefaultData('meta-strip'),
    dataSource: {
      modes: ['manual', 'project'],
      projectImporter: ReportCreatorMetaStripImporter,
    },
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
      { id: 'cards', label: '单列卡片' },
    ],
    // 行编辑（图标/标题/富文本内容）+ 高亮词由 PropertyPanel 的 StrategyBlockFields 负责。
    propertySchema: [],
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
      { id: 'pie', label: '品类饼图' },
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
    dataSource: {
      modes: ['manual', 'project'],
      projectImporter: ReportWorkScreenshotImporter,
    },
    propertySchema: [{ key: 'title', label: '标题', kind: 'text' }],
  },
  'work-metrics': {
    Component: WorkMetrics,
    defaultSize: DEFAULT_SIZES['work-metrics'],
    defaultData: () => getDefaultData('work-metrics'),
    dataSource: { modes: ['manual', 'project'], projectImporter: ReportWorkMetricsImporter },
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
    dataSource: { modes: ['manual', 'project'], projectImporter: ReportCommentWordcloudImporter },
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
  'title-block': {
    Component: TitleBlock,
    defaultSize: DEFAULT_SIZES['title-block'],
    defaultData: () => getDefaultData('title-block'),
    variants: [
      { id: 'plain', label: '纯文字' },
      { id: 'bar-left', label: '左色条' },
      { id: 'underline', label: '下划线' },
      { id: 'gradient', label: '渐变背景' },
      { id: 'card', label: '卡片' },
      { id: 'numbered', label: '序号' },
      { id: 'highlight', label: '色块强调' },
      { id: 'accent-tag', label: '色块标签' },
      { id: 'accent-underline', label: '强调下划线' },
      { id: 'block-underline', label: '色块下划线' },
    ],
    propertySchema: [
      { key: 'text', label: '标题文字', kind: 'text' },
      { key: 'subtitle', label: '副标题', kind: 'text' },
      { key: 'fontSize', label: '字号', kind: 'number' },
      { key: 'titleColor', label: '标题颜色', kind: 'select', options: [{ value: 'black', label: '黑色' }, { value: 'brand', label: '品牌色' }] },
      { key: 'index', label: '序号', kind: 'text' },
      { key: 'color', label: '主色', kind: 'color' },
      { key: 'underlineColor', label: '下划线颜色', kind: 'select', options: [{ value: 'brand', label: '品牌色' }, { value: 'black', label: '黑色' }] },
      { key: 'divider', label: '底部分割线', kind: 'select', options: [{ value: 'true', label: '显示' }, { value: 'false', label: '隐藏' }] },
    ],
  },
  'campaign-analysis': {
    Component: CampaignAnalysis,
    defaultSize: DEFAULT_SIZES['campaign-analysis'],
    defaultData: () => getDefaultData('campaign-analysis'),
    variants: [
      { id: 'radar', label: '雷达图' },
      { id: 'combo', label: '柱+线组合' },
      { id: 'funnel', label: '漏斗图' },
    ],
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
      { key: 'subtitle', label: '副标题', kind: 'text' },
      { key: 'insight', label: 'AI 洞察', kind: 'textarea' },
    ],
  },
  'creator-work-metrics': {
    Component: CreatorWorkMetrics,
    defaultSize: DEFAULT_SIZES['creator-work-metrics'],
    defaultData: () => getDefaultData('creator-work-metrics'),
    dataSource: { modes: ['manual', 'project'], projectImporter: ReportWorkAudienceImporter },
    variants: [
      { id: 'grid', label: '网格' },
      { id: 'strip', label: '横向条' },
      { id: 'card', label: '卡片' },
      { id: 'detailed', label: '详细' },
      { id: 'audience', label: '受众画像' },
      { id: 'city', label: '城市分布' },
      { id: 'trend', label: '趋势图' },
    ],
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
      { key: 'subtitle', label: '副标题', kind: 'text' },
      { key: 'workName', label: '作品名', kind: 'text' },
      { key: 'cover', label: '作品封面', kind: 'image-url' },
      { key: '', label: '指标列表', kind: 'table' },
    ],
  },
  'creator-works-table': {
    Component: CreatorWorksTable,
    defaultSize: DEFAULT_SIZES['creator-works-table'],
    defaultData: () => getDefaultData('creator-works-table'),
    dataSource: { modes: ['manual', 'project'], projectImporter: ReportCreatorWorksImporter },
    variants: [
      { id: 'list', label: '列表' },
      { id: 'cards', label: '卡片' },
      { id: 'compact', label: '紧凑' },
      { id: 'insight', label: '受众洞察' },
    ],
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
      { key: 'subtitle', label: '副标题', kind: 'text' },
      { key: '', label: '作品列表', kind: 'table' },
    ],
  },
  'content-card': {
    Component: ContentCard,
    defaultSize: DEFAULT_SIZES['content-card'],
    defaultData: () => getDefaultData('content-card'),
    variants: [
      { id: 'standard', label: '标准' },
      { id: 'image-top', label: '上图下文' },
      { id: 'image-left', label: '左图右文' },
      { id: 'compact', label: '紧凑' },
      { id: 'quote', label: '引用' },
    ],
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
      { key: 'body', label: '正文', kind: 'textarea' },
      { key: 'image', label: '图片', kind: 'image-url' },
      { key: 'tag', label: '标签', kind: 'text' },
      { key: 'footer', label: '底部文字', kind: 'text' },
      { key: 'accentColor', label: '强调色', kind: 'color' },
    ],
  },
  'swot-matrix': {
    Component: SwotMatrix,
    defaultSize: { w: 560, h: 400 },
    defaultData: () => getDefaultData('swot-matrix'),
    variants: [
      { id: 'grid', label: '四象限' },
      { id: 'list', label: '列表' },
      { id: 'cards', label: '卡片' },
    ],
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
    ],
  },
  /* ---- Campaign 强关联组件 ---- */
  'campaign-summary': {
    Component: CampaignSummaryBoard,
    defaultSize: DEFAULT_SIZES['campaign-summary'],
    defaultData: () => getDefaultData('campaign-summary'),
    propertySchema: [
      { key: 'title', label: '看板标题', kind: 'text' },
      { key: 'campaignName', label: 'Campaign 名称', kind: 'text' },
      { key: 'period', label: '周期', kind: 'text' },
    ],
    dataSource: {
      modes: ['manual', 'project'],
      projectImporter: CampaignReportImporter,
    },
  },
  'funnel-chart': {
    Component: FunnelChartView,
    defaultSize: DEFAULT_SIZES['funnel-chart'],
    defaultData: () => getDefaultData('funnel-chart'),
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
      { key: 'subtitle', label: '副标题', kind: 'text' },
      { key: 'insight', label: 'AI 洞察', kind: 'textarea' },
    ],
    dataSource: {
      modes: ['manual', 'project'],
      projectImporter: CampaignReportImporter,
    },
  },
  'revenue-timeline': {
    Component: RevenueTimelineChart,
    defaultSize: DEFAULT_SIZES['revenue-timeline'],
    defaultData: () => getDefaultData('revenue-timeline'),
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
      { key: 'subtitle', label: '副标题', kind: 'text' },
    ],
    dataSource: {
      modes: ['manual', 'project'],
      projectImporter: ChartImportButton,
    },
  },
  'publisher-table': {
    Component: PublisherTable,
    defaultSize: DEFAULT_SIZES['publisher-table'],
    defaultData: () => getDefaultData('publisher-table'),
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
    ],
    dataSource: {
      modes: ['manual', 'project'],
      projectImporter: CampaignReportImporter,
    },
  },
  'geo-distribution': {
    Component: GeoDistribution,
    defaultSize: DEFAULT_SIZES['geo-distribution'],
    defaultData: () => getDefaultData('geo-distribution'),
    variants: [
      { id: 'bars', label: '条形图' },
      { id: 'list', label: '列表' },
    ],
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
      { key: 'subtitle', label: '副标题', kind: 'text' },
    ],
    dataSource: {
      modes: ['manual', 'project'],
      projectImporter: CampaignReportImporter,
    },
  },
  'placement-wide-table': {
    Component: PlacementWideTableView,
    defaultSize: DEFAULT_SIZES['placement-wide-table'],
    defaultData: () => getDefaultData('placement-wide-table'),
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
    ],
    dataSource: {
      modes: ['manual', 'project'],
      projectImporter: CampaignReportImporter,
    },
  },
  'placement-type-summary': {
    Component: PlacementTypeSummaryView,
    defaultSize: DEFAULT_SIZES['placement-type-summary'],
    defaultData: () => getDefaultData('placement-type-summary'),
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
      { key: 'subtitle', label: '副标题', kind: 'text' },
    ],
    dataSource: {
      modes: ['manual', 'project'],
      projectImporter: CampaignReportImporter,
    },
  },
  'device-breakdown': {
    Component: DeviceBreakdownView,
    defaultSize: DEFAULT_SIZES['device-breakdown'],
    defaultData: () => getDefaultData('device-breakdown'),
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
    ],
    dataSource: {
      modes: ['manual', 'project'],
      projectImporter: CampaignReportImporter,
    },
  },
  'content-topic-performance': {
    Component: ContentTopicView,
    defaultSize: DEFAULT_SIZES['content-topic-performance'],
    defaultData: () => getDefaultData('content-topic-performance'),
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
    ],
    dataSource: {
      modes: ['manual', 'project'],
      projectImporter: CampaignReportImporter,
    },
  },
  'search-term-table': {
    Component: SearchTermTableView,
    defaultSize: DEFAULT_SIZES['search-term-table'],
    defaultData: () => getDefaultData('search-term-table'),
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
    ],
    dataSource: {
      modes: ['manual', 'project'],
      projectImporter: CampaignReportImporter,
    },
  },
  'hourly-heatmap': {
    Component: HourlyHeatmapView,
    defaultSize: DEFAULT_SIZES['hourly-heatmap'],
    defaultData: () => getDefaultData('hourly-heatmap'),
    propertySchema: [
      { key: 'title', label: '标题', kind: 'text' },
      { key: 'subtitle', label: '副标题', kind: 'text' },
    ],
    dataSource: {
      modes: ['manual', 'project'],
      projectImporter: CampaignReportImporter,
    },
  },
  'creator-audience-profile': {
    Component: CreatorAudienceProfile,
    defaultSize: DEFAULT_SIZES['creator-audience-profile'],
    defaultData: () => getDefaultData('creator-audience-profile'),
    variants: [
      { id: 'grid-3', label: '三列' },
      { id: 'grid-2', label: '两列' },
      { id: 'stacked', label: '堆叠' },
    ],
    // 字段(模块增删/导入)交给自定义面板 CreatorAudienceProfileFields
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
