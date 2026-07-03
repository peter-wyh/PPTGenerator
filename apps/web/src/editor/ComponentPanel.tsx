import { useState } from 'react';
import type { ComponentType } from '@mediakit/shared';
import { useEditorStore } from './store';
import { DatasourceMenu } from './components/DatasourceMenu';

/** 调色板拖放 payload（dataTransfer）。 */
const PALETTE_MIME = 'application/x-mediakit-palette';
type PalettePayload = { op: 'component'; type: ComponentType } | { op: 'business'; kind: string };

/**
 * 组件库有机分组 —— 仅通用组件 + 业务组件（页内语义块）。
 * 整页版式（封面/里程碑/案例/策略…）属于「页面模板」层，不在此处，
 * 见 templates.ts / 新建页面。
 */
const GROUPS: { group: string; items: { type: ComponentType; label: string; icon: string }[] }[] = [
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
    ],
  },
  {
    group: '达人',
    items: [
      { type: 'creator-avatar-card', label: '头像卡', icon: '◒' },
      { type: 'creator-stats-strip', label: '数据条', icon: '▤' },
      { type: 'creator-works-list', label: '作品列表', icon: '▦' },
    ],
  },
  {
    group: '业绩·商品',
    items: [
      { type: 'kpi-board', label: '业绩看板', icon: '◉' },
      { type: 'timeline-compare', label: '周期对比', icon: '↔' },
      { type: 'product-performance', label: '商品表现', icon: '▣' },
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

/** 组件库面板：页面栏与画布之间。点击添加到画布中央、或拖拽到画布指定位置。底部为数据源。 */
export function ComponentPanel() {
  const addComponent = useEditorStore((s) => s.addComponent);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (g: string) => setCollapsed((p) => ({ ...p, [g]: !p[g] }));

  function onDragStart(e: React.DragEvent, type: ComponentType) {
    e.dataTransfer.setData(PALETTE_MIME, JSON.stringify({ op: 'component', type } as PalettePayload));
    e.dataTransfer.effectAllowed = 'copy';
  }

  return (
    <div className="flex w-[180px] flex-none flex-col border-r border-border-default bg-surface-primary">
      <div className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-foreground-muted">组件</div>
      <div className="flex-1 overflow-auto px-2 pb-2">
        {GROUPS.map((g) => {
          const isCollapsed = !!collapsed[g.group];
          return (
            <div key={g.group} className="mb-2">
              <button
                onClick={() => toggle(g.group)}
                className="flex w-full items-center justify-between rounded px-1 py-1 text-[11px] font-semibold text-foreground-secondary hover:bg-surface-hover"
              >
                <span>{g.group}</span>
                <span className="text-foreground-muted">{isCollapsed ? '▸' : '▾'}</span>
              </button>
              {!isCollapsed && (
                <div className="grid grid-cols-2 gap-1 pt-1">
                  {g.items.map((it) => (
                    <button
                      key={it.type}
                      draggable
                      onDragStart={(e) => onDragStart(e, it.type)}
                      title={`添加${it.label}（拖到画布或点击）`}
                      onClick={() => addComponent(it.type)}
                      className="flex cursor-grab flex-col items-center gap-1 rounded-lg border border-border-default bg-surface-primary px-1 py-2 text-[11px] text-foreground-secondary transition hover:border-accent-primary hover:bg-accent-primary/5 hover:text-accent-primary active:cursor-grabbing"
                    >
                      <span className="flex h-5 w-5 items-center justify-center text-[14px] text-accent-primary">{it.icon}</span>
                      <span className="truncate">{it.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="border-t border-border-default p-2">
        <DatasourceMenu />
      </div>
    </div>
  );
}

export { PALETTE_MIME };
export type { PalettePayload };

