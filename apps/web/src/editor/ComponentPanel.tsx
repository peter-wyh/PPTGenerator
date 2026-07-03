import { useState } from 'react';
import type { ComponentType } from '@mediakit/shared';
import { useEditorStore } from './store';
import { DatasourceMenu } from './components/DatasourceMenu';
import { BUSINESS_GROUPS, BUSINESS_LAYOUTS } from './business/catalog';

/** 调色板拖放 payload（dataTransfer）。 */
const PALETTE_MIME = 'application/x-mediakit-palette';
type PalettePayload =
  | { op: 'component'; type: ComponentType }
  | { op: 'business'; kind: string };

/** 通用/业务组件有机分组。 */
interface CatalogItem {
  op: 'component';
  type: ComponentType;
  label: string;
  icon: string;
}
interface CatalogGroup {
  group: string;
  items: CatalogItem[];
}

const CATALOG: CatalogGroup[] = [
  {
    group: '基础',
    items: [
      { op: 'component', type: 'text', label: '文本', icon: 'T' },
      { op: 'component', type: 'image', label: '图片', icon: '▭' },
      { op: 'component', type: 'indicator-card', label: '指标卡', icon: '◉' },
      { op: 'component', type: 'table', label: '表格', icon: '▦' },
      { op: 'component', type: 'bar-chart', label: '柱状图', icon: '▮' },
      { op: 'component', type: 'line-chart', label: '折线图', icon: '╱' },
      { op: 'component', type: 'pie-chart', label: '饼图', icon: '◐' },
    ],
  },
  {
    group: '达人',
    items: [
      { op: 'component', type: 'creator-avatar-card', label: '头像卡', icon: '◒' },
      { op: 'component', type: 'creator-stats-strip', label: '数据条', icon: '▤' },
      { op: 'component', type: 'creator-works-list', label: '作品列表', icon: '▦' },
    ],
  },
  {
    group: '业绩·商品',
    items: [
      { op: 'component', type: 'kpi-board', label: '业绩看板', icon: '◉' },
      { op: 'component', type: 'timeline-compare', label: '周期对比', icon: '↔' },
      { op: 'component', type: 'product-performance', label: '商品表现', icon: '▣' },
    ],
  },
  {
    group: '渠道·广告',
    items: [
      { op: 'component', type: 'placement-display', label: '广告位', icon: '▤' },
      { op: 'component', type: 'post-list', label: 'Post 列表', icon: '☲' },
    ],
  },
  {
    group: '商务·品牌',
    items: [
      { op: 'component', type: 'brand-wall', label: '品牌墙', icon: '▦' },
      { op: 'component', type: 'package-card', label: '套餐卡', icon: '≡' },
    ],
  },
];

/** 组件库面板：页面栏与画布之间。
 *  - 通用/业务组件按有机分组陈列，点击添加到画布中央、或拖拽到画布指定位置。
 *  - 底部为 legacy 整页版式（business-block 20 kind）与数据源。
 */
export function ComponentPanel() {
  const addComponent = useEditorStore((s) => s.addComponent);
  const addBusinessBlock = useEditorStore((s) => s.addBusinessBlock);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (g: string) => setCollapsed((c) => ({ ...c, [g]: !c[g] }));

  function onDragStart(e: React.DragEvent, payload: PalettePayload) {
    e.dataTransfer.setData(PALETTE_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'copy';
  }

  function addComponentItem(it: CatalogItem) {
    addComponent(it.type);
  }

  return (
    <div className="flex w-[180px] flex-none flex-col border-r border-border-default bg-surface-primary">
      <div className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-foreground-muted">组件</div>
      <div className="flex-1 overflow-auto px-2 pb-2">
        {CATALOG.map((g) => (
          <Group key={g.group} title={g.group} collapsed={!!collapsed[g.group]} onToggle={() => toggle(g.group)}>
            {g.items.map((it) => (
              <Tile
                key={it.type}
                icon={it.icon}
                label={it.label}
                title={`添加${it.label}（拖到画布或点击）`}
                onClick={() => addComponentItem(it)}
                onDragStart={(e) => onDragStart(e, { op: 'component', type: it.type })}
              />
            ))}
          </Group>
        ))}

        {/* legacy 整页版式 */}
        <div className="mt-2 border-t border-border-subtle pt-2">
          <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">
            整页版式 · legacy
          </div>
          {BUSINESS_GROUPS.map((g) => (
            <Group
              key={g.group}
              title={g.group}
              collapsed={!!collapsed['legacy-' + g.group]}
              onToggle={() => toggle('legacy-' + g.group)}
              compact
            >
              {g.items.map((it) => {
                const layout = BUSINESS_LAYOUTS[it.id];
                return (
                  <Tile
                    key={it.id}
                    icon={it.icon}
                    label={it.name}
                    title={layout ? `${layout.form} · ${layout.w}×${layout.h}` : it.name}
                    onClick={() => addBusinessBlock(it.id)}
                    onDragStart={(e) => onDragStart(e, { op: 'business', kind: it.id })}
                  />
                );
              })}
            </Group>
          ))}
        </div>
      </div>

      {/* 数据源 */}
      <div className="border-t border-border-default p-2">
        <DatasourceMenu />
      </div>
    </div>
  );
}

function Group({
  title,
  collapsed,
  onToggle,
  compact,
  children,
}: {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded px-1 py-1 text-[11px] font-semibold text-foreground-secondary hover:bg-surface-hover"
      >
        <span className="truncate">{title}</span>
        <span className="text-foreground-muted">{collapsed ? '▸' : '▾'}</span>
      </button>
      {!collapsed && (
        <div className={`grid grid-cols-2 gap-1 pt-1 ${compact ? '' : ''}`}>{children}</div>
      )}
    </div>
  );
}

function Tile({
  icon,
  label,
  title,
  onClick,
  onDragStart,
}: {
  icon: string;
  label: string;
  title: string;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  return (
    <button
      draggable
      onDragStart={onDragStart}
      title={title}
      onClick={onClick}
      className="flex cursor-grab flex-col items-center gap-1 rounded-lg border border-border-default bg-surface-primary px-1 py-2 text-[11px] text-foreground-secondary transition hover:border-accent-primary hover:bg-accent-primary/5 hover:text-accent-primary active:cursor-grabbing"
    >
      <span className="flex h-5 w-5 items-center justify-center text-[14px] text-accent-primary">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

export { PALETTE_MIME };
export type { PalettePayload };
