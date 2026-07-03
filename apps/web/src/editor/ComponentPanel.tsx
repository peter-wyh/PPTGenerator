import { useState } from 'react';
import type { ComponentType } from '@mediakit/shared';
import { useEditorStore } from './store';

/** 组件库分组项。 */
interface CatalogItem {
  type: ComponentType;
  label: string;
  icon: string;
}
interface CatalogGroup {
  group: string;
  items: CatalogItem[];
}

/**
 * 组件库有机归类（三层模型 §4 的有机分组）。
 * 通用组件按可视化形态归「基础」；业务组件按领域归「达人 / 业绩·商品 / 渠道·广告 / 商务·品牌」。
 */
const CATALOG: CatalogGroup[] = [
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

/** 组件库面板：位于页面栏与画布之间，按有机分组陈列组件，点击添加到画布。 */
export function ComponentPanel() {
  const addComponent = useEditorStore((s) => s.addComponent);
  // 默认全部展开。
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (g: string) => setCollapsed((c) => ({ ...c, [g]: !c[g] }));

  return (
    <div className="flex w-[180px] flex-none flex-col border-r border-border-default bg-surface-primary">
      <div className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-foreground-muted">组件</div>
      <div className="flex-1 overflow-auto px-2 pb-2">
        {CATALOG.map((g) => {
          const isCollapsed = collapsed[g.group];
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
                      title={`添加${it.label}`}
                      onClick={() => addComponent(it.type)}
                      className="flex flex-col items-center gap-1 rounded-lg border border-border-default bg-surface-primary px-1 py-2 text-[11px] text-foreground-secondary transition hover:border-accent-primary hover:bg-accent-primary/5 hover:text-accent-primary"
                    >
                      <span className="flex h-5 w-5 items-center justify-center text-[14px] text-accent-primary">
                        {it.icon}
                      </span>
                      <span className="truncate">{it.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
