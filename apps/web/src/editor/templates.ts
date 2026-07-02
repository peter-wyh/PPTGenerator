import type { ComponentType, EditorComponent } from '@mediakit/shared';
import { getDefaultData } from './defaults';

/**
 * 页面模板目录（M3 精简版：由基础组件拼成）。
 * demo 的完整业务模板（cover/funnel/...）依赖业务组件，留 M4 落地。
 * 组件 id 为占位，addPageWithComponents 会重新分配。
 */
export interface Template {
  id: string;
  name: string;
  description: string;
  components: () => EditorComponent[];
}

function t(type: ComponentType, x: number, y: number, w: number, h: number): EditorComponent {
  return { id: `tpl-${type}-${x}-${y}`, type, x, y, w, h, data: getDefaultData(type) };
}

export const TEMPLATES: Template[] = [
  {
    id: 'blank',
    name: '空白页',
    description: '从零开始',
    components: () => [],
  },
  {
    id: 'title',
    name: '标题页',
    description: '大标题 + 副标题',
    components: () => {
      const title = t('text', 120, 200, 900, 120);
      (title.data as { content: string; fontSize: number; fontWeight: number }).content = '报告标题';
      (title.data as { fontSize: number }).fontSize = 48;
      (title.data as { fontWeight: number }).fontWeight = 700;
      const sub = t('text', 120, 340, 900, 60);
      (sub.data as { content: string; fontSize: number }).content = '副标题 / 摘要说明';
      (sub.data as { fontSize: number }).fontSize = 20;
      return [title, sub];
    },
  },
  {
    id: 'overview',
    name: '数据概览',
    description: '指标卡 + 柱状图',
    components: () => {
      const cards = [0, 1, 2].map((i) => {
        const c = t('indicator-card', 80 + i * 300, 80, 260, 110);
        (c.data as { title: string; value: string }).title = `指标 ${i + 1}`;
        (c.data as { value: string }).value = '---';
        return c;
      });
      const chart = t('bar-chart', 80, 240, 1120, 380);
      return [...cards, chart];
    },
  },
  {
    id: 'table',
    name: '表格页',
    description: '数据表格',
    components: () => {
      const tbl = t('table', 80, 100, 1120, 520);
      return [tbl];
    },
  },
];
