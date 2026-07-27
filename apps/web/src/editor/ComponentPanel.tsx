import { useMemo, useState } from 'react';
import type { ComponentType, ShapeKind } from '@mediakit/shared';
import { useEditorStore } from './store';

/** 调色板拖放 payload（dataTransfer）。 */
const PALETTE_MIME = 'application/x-mediakit-palette';
type PalettePayload =
  | { op: 'component'; type: ComponentType }
  | { op: 'business'; kind: string }
  | { op: 'shape'; shape: ShapeKind };

type PaletteItem = { type: ComponentType; label: string; icon: string; shape?: ShapeKind; description?: string };

/**
 * 组件库有机分组 —— 仅通用组件 + 业务组件（页内语义块）。
 * 整页版式属于「页面模板」层，不在此处。
 */
const GROUPS: { group: string; items: PaletteItem[] }[] = [
  {
    group: '基础',
    items: [
      { type: 'text', label: '文本', icon: 'T', description: '纯文本段落' },
      { type: 'image', label: '图片', icon: '▭', description: '单张图片' },
      { type: 'image-group', label: '组图', icon: '◫', description: '多图组合' },
      { type: 'indicator-card', label: '指标卡', icon: '◉', description: 'KPI 数据卡片' },
      { type: 'table', label: '表格', icon: '▦', description: '行列表格' },
      { type: 'bar-chart', label: '柱状图', icon: '▮', description: '柱状图' },
      { type: 'line-chart', label: '折线图', icon: '╱', description: '趋势折线图' },
      { type: 'pie-chart', label: '饼图', icon: '◐', description: '占比饼图' },
      { type: 'shape', shape: 'rectangle', label: '矩形', icon: '▭', description: '矩形形状' },
      { type: 'shape', shape: 'rounded', label: '圆角矩形', icon: '▢', description: '圆角矩形形状' },
      { type: 'shape', shape: 'circle', label: '圆形', icon: '◯', description: '圆形形状' },
      { type: 'shape', shape: 'line', label: '直线', icon: '─', description: '直线分隔' },
      { type: 'title-block', label: '标题块', icon: 'H', description: '页面标题块' },
      { type: 'content-card', label: '卡片', icon: '▢', description: '通用内容卡片' },
    ],
  },
  {
    group: '达人',
    items: [
      { type: 'creator-avatar-card', label: '头像卡', icon: '◒', description: '达人头像 + 简介' },
      { type: 'creator-stats-strip', label: '数据条', icon: '▤', description: '核心数据横条' },
      { type: 'creator-works-list', label: '作品列表', icon: '▦', description: '达人作品网格' },
      { type: 'creator-fan-gender', label: '性别占比', icon: '◑', description: '粉丝性别分布' },
      { type: 'creator-fan-city', label: '城市分布', icon: '≣', description: '粉丝城市分布' },
      { type: 'creator-fan-age', label: '年龄段', icon: '▤', description: '粉丝年龄分布' },
      { type: 'creator-fan-interest', label: '兴趣标签', icon: '▦', description: '粉丝兴趣标签' },
      { type: 'creator-audience-profile', label: '用户画像', icon: '◍', description: '粉丝综合画像' },
      { type: 'meta-strip', label: '基础信息', icon: '≣', description: '达人基础信息条' },
      { type: 'strategy-block', label: '策略块', icon: '✎', description: '合作策略说明' },
    ],
  },
  {
    group: '业绩·商品',
    items: [
      { type: 'kpi-board', label: '业绩看板', icon: '◉', description: '多指标 KPI 看板' },
      { type: 'timeline-compare', label: '周期对比', icon: '↔', description: '同比环比对比' },
      { type: 'product-performance', label: '商品表现', icon: '▣', description: '商品销售排行' },
      { type: 'campaign-analysis', label: '分析图表', icon: '◈', description: '投放效果分析' },
      { type: 'creator-list', label: '达人列表', icon: '◳', description: '合作达人列表' },
      { type: 'creator-work-metrics', label: '作品指标', icon: '▣', description: '单作品数据' },
      { type: 'creator-works-table', label: '作品列表', icon: '▦', description: '作品表格' },
      { type: 'work-screenshot', label: '作品截图', icon: '▦', description: '作品配图' },
      { type: 'work-metrics', label: '作品数据', icon: '▤', description: '作品数据条' },
      { type: 'comment-wordcloud', label: '评论词云', icon: '◑', description: '评论关键词' },
    ],
  },
  {
    group: '渠道·广告',
    items: [
      { type: 'placement-display', label: '广告位', icon: '▤', description: '广告位展示' },
      { type: 'post-list', label: 'Post 列表', icon: '☲', description: '渠道贴文列表' },
    ],
  },
  {
    group: '商务·品牌',
    items: [
      { type: 'brand-wall', label: '品牌墙', icon: '▦', description: '合作品牌 logo 墙' },
      { type: 'package-card', label: '套餐卡', icon: '≡', description: '套餐方案卡片' },
    ],
  },
];

const TABS = GROUPS.map((g) => g.group);

/**
 * 组件库：顶部搜索框 + 分组页签。
 * - 搜索有值时跨所有组过滤（按 label/description 模糊匹配），忽略页签。
 * - 搜索为空时按页签显示当前组的组件。
 * 点击添加到画布中央，或拖拽到画布指定位置。
 */
export function ComponentPanel() {
  const addComponent = useEditorStore((s) => s.addComponent);
  const addShape = useEditorStore((s) => s.addShape);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState(TABS[0]);

  const trimmed = query.trim().toLowerCase();
  const searching = trimmed.length > 0;

  // 搜索模式：跨所有组聚合匹配结果。
  const searchResults = useMemo<PaletteItem[]>(() => {
    if (!searching) return [];
    const all = GROUPS.flatMap((g) => g.items);
    return all.filter((it) => it.label.toLowerCase().includes(trimmed) || (it.description ?? '').toLowerCase().includes(trimmed));
  }, [searching, trimmed]);

  // 普通模式：当前页签对应的分组。
  const activeItems = GROUPS.find((g) => g.group === activeTab)?.items ?? [];

  function onDragStart(e: React.DragEvent, it: PaletteItem) {
    const payload: PalettePayload = it.shape ? { op: 'shape', shape: it.shape } : { op: 'component', type: it.type };
    e.dataTransfer.setData(PALETTE_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'copy';
  }

  function renderItem(it: PaletteItem) {
    const key = it.type + (it.shape ?? '');
    return (
      <button
        key={key}
        draggable
        onDragStart={(e) => onDragStart(e, it)}
        title={`添加${it.label}（拖到画布或点击）`}
        onClick={() => (it.shape ? addShape(it.shape) : addComponent(it.type))}
        className="flex w-14 flex-none cursor-grab flex-col items-center gap-0.5 rounded-lg border border-border-default bg-surface-primary px-1 py-1.5 text-[10px] text-foreground-secondary transition hover:border-accent-primary hover:bg-accent-primary/5 hover:text-accent-primary active:cursor-grabbing"
      >
        <span className="flex h-5 w-5 items-center justify-center text-[15px] text-accent-primary">{it.icon}</span>
        <span className="truncate">{it.label}</span>
      </button>
    );
  }

  const items = searching ? searchResults : activeItems;
  const empty = items.length === 0;

  return (
    <div className="flex h-[88px] flex-none flex-col gap-1 border-b border-border-default bg-surface-primary px-3 py-1.5">
      {/* 顶部搜索框 */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[12px] text-foreground-muted">🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索组件名称…"
            className="w-full rounded border border-border-default bg-surface-primary py-1 pl-7 pr-2 text-xs text-foreground-primary placeholder:text-foreground-muted focus:border-accent-primary focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[11px] text-foreground-muted hover:text-foreground-primary"
              aria-label="清除搜索"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 页签条（搜索有值时隐藏） */}
      {!searching && (
        <div className="flex flex-none items-center gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-medium transition ${
                activeTab === tab
                  ? 'bg-accent-primary/10 text-accent-primary'
                  : 'text-foreground-secondary hover:bg-surface-hover'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      {/* 组件网格 */}
      <div className="flex flex-1 items-start gap-1.5 overflow-x-auto">
        {empty ? (
          <div className="flex h-full w-full items-center justify-center text-[11px] text-foreground-muted">
            {searching ? '没有匹配的组件' : '该分组暂无组件'}
          </div>
        ) : (
          items.map(renderItem)
        )}
      </div>
    </div>
  );
}

export { PALETTE_MIME };
export type { PalettePayload };
