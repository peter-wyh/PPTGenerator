import { useState } from 'react';
import type { ComponentType } from '@mediakit/shared';
import { useEditorStore } from './store';
import { DatasourceMenu } from './components/DatasourceMenu';
import { getBusinessItem } from './business/catalog';

/** 调色板拖放 payload（dataTransfer）。 */
const PALETTE_MIME = 'application/x-mediakit-palette';
type PalettePayload =
  | { op: 'component'; type: ComponentType }
  | { op: 'business'; kind: string };

/** 面板项：新组件（一级 ComponentType）或 legacy 整页版式（business-block kind）。 */
type PanelItem =
  | { op: 'component'; type: ComponentType; label: string; icon: string }
  | { op: 'business'; kind: string };

const c = (type: ComponentType, label: string, icon: string): PanelItem => ({
  op: 'component',
  type,
  label,
  icon,
});
const b = (kind: string): PanelItem => ({ op: 'business', kind });

/**
 * 组件库有机分组（新组件 + legacy 整页版式按域合并，不再单列 legacy 区）。
 * 与新组件重名的 legacy（品牌墙/套餐/达人名单/达人介绍/Campaign 概览）已由新组件取代，不重复陈列。
 */
const GROUPS: { group: string; items: PanelItem[] }[] = [
  {
    group: '基础',
    items: [
      c('text', '文本', 'T'),
      c('image', '图片', '▭'),
      c('indicator-card', '指标卡', '◉'),
      c('table', '表格', '▦'),
      c('bar-chart', '柱状图', '▮'),
      c('line-chart', '折线图', '╱'),
      c('pie-chart', '饼图', '◐'),
      b('cover'),
      b('agenda'),
      b('funnel'),
    ],
  },
  {
    group: '达人',
    items: [c('creator-avatar-card', '头像卡', '◒'), c('creator-stats-strip', '数据条', '▤'), c('creator-works-list', '作品列表', '▦'), b('content-analysis')],
  },
  {
    group: '业绩·商品',
    items: [c('kpi-board', '业绩看板', '◉'), c('timeline-compare', '周期对比', '↔'), c('product-performance', '商品表现', '▣'), b('retrospective'), b('report')],
  },
  { group: '渠道·广告', items: [c('placement-display', '广告位', '▤'), c('post-list', 'Post 列表', '☲')] },
  {
    group: '商务·品牌',
    items: [c('brand-wall', '品牌墙', '▦'), c('package-card', '套餐卡', '≡'), b('milestone'), b('global'), b('org'), b('service'), b('case-showcase')],
  },
  { group: '策略·方案', items: [b('challenge'), b('process'), b('calendar'), b('campaign-plan')] },
];

/** 解析面板项的展示信息（legacy 从 catalog 取 icon/name）。 */
function resolve(item: PanelItem): { label: string; icon: string } {
  if (item.op === 'component') return { label: item.label, icon: item.icon };
  const it = getBusinessItem(item.kind);
  return { label: it.name, icon: it.icon };
}

/** 组件库面板：页面栏与画布之间。
 *  有机分组陈列组件（新组件 + legacy 按域合并），点击添加到画布中央、或拖拽到画布指定位置。
 *  底部为数据源。
 */
export function ComponentPanel() {
  const addComponent = useEditorStore((s) => s.addComponent);
  const addBusinessBlock = useEditorStore((s) => s.addBusinessBlock);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (g: string) => setCollapsed((p) => ({ ...p, [g]: !p[g] }));

  function payloadOf(item: PanelItem): PalettePayload {
    return item.op === 'component' ? { op: 'component', type: item.type } : { op: 'business', kind: item.kind };
  }
  function addItem(item: PanelItem) {
    if (item.op === 'component') addComponent(item.type);
    else addBusinessBlock(item.kind);
  }
  function onDragStart(e: React.DragEvent, item: PanelItem) {
    e.dataTransfer.setData(PALETTE_MIME, JSON.stringify(payloadOf(item)));
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
                  {g.items.map((item) => {
                    const key = item.op === 'component' ? item.type : item.kind;
                    const { label, icon } = resolve(item);
                    return (
                      <button
                        key={key}
                        draggable
                        onDragStart={(e) => onDragStart(e, item)}
                        title={`添加${label}（拖到画布或点击）`}
                        onClick={() => addItem(item)}
                        className="flex cursor-grab flex-col items-center gap-1 rounded-lg border border-border-default bg-surface-primary px-1 py-2 text-[11px] text-foreground-secondary transition hover:border-accent-primary hover:bg-accent-primary/5 hover:text-accent-primary active:cursor-grabbing"
                      >
                        <span className="flex h-5 w-5 items-center justify-center text-[14px] text-accent-primary">{icon}</span>
                        <span className="truncate">{label}</span>
                      </button>
                    );
                  })}
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
