import type { FC } from 'react';
import type { ComponentType, EditorComponent } from '@mediakit/shared';
import { DEFAULT_SIZES, getDefaultData } from './defaults';
import {
  BarChartComponent,
  BusinessBlockPlaceholder,
  ImageComponent,
  IndicatorCardComponent,
  LineChartComponent,
  PieChartComponent,
  TableComponent,
  TextComponent,
} from './components/BasicComponents';

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
    Component: BusinessBlockPlaceholder,
    defaultSize: DEFAULT_SIZES['business-block'],
    defaultData: () => getDefaultData('business-block'),
    propertySchema: [
      { key: 'businessKind', label: '业务类型', kind: 'text' },
      { key: 'title', label: '标题', kind: 'text' },
      { key: 'meta', label: '说明', kind: 'text' },
    ],
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
