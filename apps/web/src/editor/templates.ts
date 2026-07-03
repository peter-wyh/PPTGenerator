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
  {
    id: 'creator-page',
    name: '达人介绍页',
    description: '头像卡 + 数据条 + 作品列表（试点）',
    components: () => {
      // 顶部标题
      const title = t('text', 80, 60, 900, 60);
      (title.data as { content: string; fontSize: number; fontWeight: number }).content = '达人介绍';
      (title.data as { fontSize: number }).fontSize = 32;
      (title.data as { fontWeight: number }).fontWeight = 700;
      // 页内业务组件（各自独立可拖拽/删除 —— 验证"页内语义块"粒度）
      const avatar = t('creator-avatar-card', 80, 150, 360, 120);
      const stats = t('creator-stats-strip', 460, 150, 740, 120);
      const works = t('creator-works-list', 80, 300, 1120, 220);
      return [title, avatar, stats, works];
    },
  },
  {
    id: 'cover-page',
    name: '封面页',
    description: '大标题 + 副标题',
    components: () => {
      const title = t('text', 120, 240, 1000, 120);
      (title.data as { content: string; fontSize: number; fontWeight: number }).content = '报告标题';
      (title.data as { fontSize: number }).fontSize = 56;
      (title.data as { fontWeight: number }).fontWeight = 700;
      const sub = t('text', 120, 380, 1000, 50);
      (sub.data as { content: string; fontSize: number }).content = '副标题 / 时间 / 品牌';
      (sub.data as { fontSize: number }).fontSize = 20;
      return [title, sub];
    },
  },
  {
    id: 'agenda-page',
    name: '目录页',
    description: '章节导航表格',
    components: () => {
      const title = t('text', 80, 60, 900, 50);
      (title.data as { content: string; fontSize: number; fontWeight: number }).content = '目录';
      (title.data as { fontSize: number }).fontSize = 32;
      (title.data as { fontWeight: number }).fontWeight = 700;
      const tbl = t('table', 80, 140, 1120, 460);
      (tbl.data as { headers: string[]; rows: string[][] }).headers = ['章节', '内容'];
      (tbl.data as { rows: string[][] }).rows = [
        ['01', '公司介绍'],
        ['02', '业绩概览'],
        ['03', '达人分析'],
        ['04', '合作提案'],
      ];
      return [title, tbl];
    },
  },
  {
    id: 'company-page',
    name: '公司介绍页',
    description: '简介 + 品牌墙',
    components: () => {
      const title = t('text', 80, 60, 900, 50);
      (title.data as { content: string; fontSize: number; fontWeight: number }).content = '关于我们';
      (title.data as { fontSize: number }).fontSize = 32;
      (title.data as { fontWeight: number }).fontWeight = 700;
      const intro = t('text', 80, 130, 1120, 80);
      (intro.data as { content: string }).content =
        '以内容为核心，连接达人资源、媒体资源与转化数据，服务 300+ 增长型品牌。';
      const wall = t('brand-wall', 80, 240, 1120, 360);
      return [title, intro, wall];
    },
  },
  {
    id: 'package-page',
    name: '套餐对比页',
    description: '3 个套餐卡',
    components: () => {
      const title = t('text', 80, 60, 900, 50);
      (title.data as { content: string; fontSize: number; fontWeight: number }).content = '套餐对比';
      (title.data as { fontSize: number }).fontSize = 32;
      (title.data as { fontWeight: number }).fontWeight = 700;
      const cardW = 360;
      const gap = 30;
      const startX = (1280 - (cardW * 3 + gap * 2)) / 2;
      const cards = [0, 1, 2].map((i) => {
        const c = t('package-card', Math.round(startX + i * (cardW + gap)), 150, cardW, 460);
        const data = c.data as { name: string; highlighted: boolean };
        if (i === 1) {
          // 中间方案设为推荐。
          data.name = i === 1 ? '增长加速包' : data.name;
          data.highlighted = true;
        }
        return c;
      });
      return [title, ...cards];
    },
  },
];
