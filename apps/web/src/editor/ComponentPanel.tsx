import type { ComponentType, ShapeKind } from '@mediakit/shared';
import { useEditorStore } from './store';

/** 调色板拖放 payload（dataTransfer）。 */
const PALETTE_MIME = 'application/x-mediakit-palette';
type PalettePayload =
  | { op: 'component'; type: ComponentType }
  | { op: 'business'; kind: string }
  | { op: 'shape'; shape: ShapeKind };

/**
 * 组件库有机分组 —— 仅通用组件 + 业务组件（页内语义块）。
 * 整页版式属于「页面模板」层，不在此处。
 */
const GROUPS: { group: string; items: { type: ComponentType; label: string; icon: string; shape?: ShapeKind }[] }[] = [
  {
    group: '基础',
    items: [
      { type: 'text', label: '文本', icon: 'T' },
      { type: 'image', label: '图片', icon: '▭' },
      { type: 'indicator-card', label: '指标卡', icon: '◉' },
      { type: 'table', label: '表格', icon: '▦' },
      { type: 'bar-chart', label: '柱状图', icon: '▮' },
      { type: 'line-chart', label: '折线图', icon: '╱' },
      { type: 'pie-chart', label: '饼图', icon: '◐' },
      { type: 'shape', shape: 'rectangle', label: '矩形', icon: '▭' },
      { type: 'shape', shape: 'rounded', label: '圆角矩形', icon: '▢' },
      { type: 'shape', shape: 'circle', label: '圆形', icon: '◯' },
      { type: 'shape', shape: 'line', label: '直线', icon: '─' },
    ],
  },
  {
    group: '达人',
    items: [
      { type: 'creator-avatar-card', label: '头像卡', icon: '◒' },
      { type: 'creator-stats-strip', label: '数据条', icon: '▤' },
      { type: 'creator-works-list', label: '作品列表', icon: '▦' },
      { type: 'creator-fan-gender', label: '性别占比', icon: '◑' },
      { type: 'creator-fan-city', label: '城市分布', icon: '≣' },
      { type: 'creator-fan-age', label: '年龄段', icon: '▤' },
      { type: 'creator-fan-interest', label: '兴趣标签', icon: '▦' },
      { type: 'meta-strip', label: '基础信息', icon: '≣' },
      { type: 'strategy-block', label: '策略块', icon: '✎' },
    ],
  },
  {
    group: '业绩·商品',
    items: [
      { type: 'kpi-board', label: '业绩看板', icon: '◉' },
      { type: 'timeline-compare', label: '周期对比', icon: '↔' },
      { type: 'product-performance', label: '商品表现', icon: '▣' },
      { type: 'work-screenshot', label: '作品截图', icon: '▦' },
      { type: 'work-metrics', label: '作品数据', icon: '▤' },
      { type: 'comment-wordcloud', label: '评论词云', icon: '◑' },
    ],
  },
  {
    group: '渠道·广告',
    items: [
      { type: 'placement-display', label: '广告位', icon: '▤' },
      { type: 'post-list', label: 'Post 列表', icon: '☲' },
    ],
  },
  {
    group: '商务·品牌',
    items: [
      { type: 'brand-wall', label: '品牌墙', icon: '▦' },
      { type: 'package-card', label: '套餐卡', icon: '≡' },
    ],
  },
];

/**
 * 组件库横向条：置于画布上方，按分组横向陈列，点击添加到画布中央、
 * 或拖拽到画布指定位置。横向布局以让出更多画布宽度。
 */
export function ComponentPanel() {
  const addComponent = useEditorStore((s) => s.addComponent);
  const addShape = useEditorStore((s) => s.addShape);

  function onDragStart(e: React.DragEvent, it: { type: ComponentType; shape?: ShapeKind }) {
    const payload: PalettePayload = it.shape
      ? { op: 'shape', shape: it.shape }
      : { op: 'component', type: it.type };
    e.dataTransfer.setData(PALETTE_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'copy';
  }

  return (
    <div className="flex h-[68px] flex-none items-center gap-3 overflow-x-auto border-b border-border-default bg-surface-primary px-3">
      {GROUPS.map((g, gi) => (
        <div key={g.group} className="flex flex-none items-center gap-1">
          {gi > 0 && <span className="mr-1 h-8 w-px bg-border-default" />}
          <span className="mr-1 flex-none text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">
            {g.group}
          </span>
          {g.items.map((it) => (
            <button
              key={it.type + (it.shape ?? '')}
              draggable
              onDragStart={(e) => onDragStart(e, it)}
              title={`添加${it.label}（拖到画布或点击）`}
              onClick={() => (it.shape ? addShape(it.shape) : addComponent(it.type))}
              className="flex w-12 flex-none cursor-grab flex-col items-center gap-0.5 rounded-lg border border-border-default bg-surface-primary px-1 py-1 text-[10px] text-foreground-secondary transition hover:border-accent-primary hover:bg-accent-primary/5 hover:text-accent-primary active:cursor-grabbing"
            >
              <span className="flex h-5 w-5 items-center justify-center text-[15px] text-accent-primary">{it.icon}</span>
              <span className="truncate">{it.label}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

export { PALETTE_MIME };
export type { PalettePayload };
