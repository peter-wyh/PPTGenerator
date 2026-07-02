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
    default:
      return { content: '', fontSize: 14, color: '#1A1A1A' };
  }
}
