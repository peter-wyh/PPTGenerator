/**
 * 组图组件（image-group）：按图片数量提供预设版式的纯图网格。
 * 版式 = 数量即版式（2/3/4/5/6/7/9/12），variant 缺省 'auto' 时按 images.length
 * 自适应到最接近张数的版式。版式锁定时槽位固定：溢出忽略、不足补空占位。
 * 风格对齐 BasicComponents；占位态参考 ImageComponent。
 */
import type { CSSProperties } from 'react';
import type { ImageGroupData, ImageGroupLayoutId } from '@mediakit/shared';

/** 单元格：列/行起点（1 基）+ 可选跨度。 */
interface LayoutCell {
  c: number;
  r: number;
  cs?: number;
  rs?: number;
}

interface LayoutDef {
  id: Exclude<ImageGroupLayoutId, 'auto'>;
  count: number; // 自然张数（= cells.length）
  cols: number;
  rows: number;
  /** 各行相对高度（fr）；缺省等高。 */
  rowHeights?: number[];
  cells: LayoutCell[];
}

/** 版式目录：每个版式完全铺满其 cols×rows 网格。 */
const LAYOUTS: LayoutDef[] = [
  { id: 'duo', count: 2, cols: 2, rows: 1, cells: [{ c: 1, r: 1 }, { c: 2, r: 1 }] },
  { id: 'trio', count: 3, cols: 2, rows: 2, rowHeights: [1, 1.15], cells: [
    { c: 1, r: 1 }, { c: 2, r: 1 }, { c: 1, r: 2, cs: 2 },
  ] },
  { id: 'quad', count: 4, cols: 2, rows: 2, cells: [
    { c: 1, r: 1 }, { c: 2, r: 1 }, { c: 1, r: 2 }, { c: 2, r: 2 },
  ] },
  { id: 'mosaic-5', count: 5, cols: 4, rows: 3, cells: [
    { c: 1, r: 1, cs: 2, rs: 2 }, { c: 3, r: 1, cs: 2 },
    { c: 3, r: 2 }, { c: 4, r: 2 }, { c: 1, r: 3, cs: 4 },
  ] },
  { id: 'hex', count: 6, cols: 3, rows: 2, cells: [
    { c: 1, r: 1 }, { c: 2, r: 1 }, { c: 3, r: 1 },
    { c: 1, r: 2 }, { c: 2, r: 2 }, { c: 3, r: 2 },
  ] },
  { id: 'septet', count: 7, cols: 6, rows: 3, rowHeights: [1.2, 1, 1], cells: [
    { c: 1, r: 1, cs: 3 }, { c: 4, r: 1, cs: 3 },
    { c: 1, r: 2, cs: 2 }, { c: 3, r: 2, cs: 2 }, { c: 5, r: 2, cs: 2 },
    { c: 1, r: 3, cs: 3 }, { c: 4, r: 3, cs: 3 },
  ] },
  { id: 'nona', count: 9, cols: 3, rows: 3, cells: [
    { c: 1, r: 1 }, { c: 2, r: 1 }, { c: 3, r: 1 },
    { c: 1, r: 2 }, { c: 2, r: 2 }, { c: 3, r: 2 },
    { c: 1, r: 3 }, { c: 2, r: 3 }, { c: 3, r: 3 },
  ] },
  { id: 'duoza', count: 12, cols: 3, rows: 4, cells: [
    { c: 1, r: 1 }, { c: 2, r: 1 }, { c: 3, r: 1 },
    { c: 1, r: 2 }, { c: 2, r: 2 }, { c: 3, r: 2 },
    { c: 1, r: 3 }, { c: 2, r: 3 }, { c: 3, r: 3 },
    { c: 1, r: 4 }, { c: 2, r: 4 }, { c: 3, r: 4 },
  ] },
];

const BY_ID = new Map(LAYOUTS.map((l) => [l.id, l]));

/**
 * 解析生效版式。
 * - 锁定版式（非 auto）→ 直接返回该版式，忽略 count。
 * - auto / 缺省 → 选 |count - def.count| 最小者；平手取 count 较大者。
 */
export function resolveLayout(variant: ImageGroupLayoutId | undefined, count: number): LayoutDef {
  if (variant && variant !== 'auto') {
    const def = BY_ID.get(variant);
    if (def) return def;
  }
  let best = LAYOUTS[0];
  let bestDist = Math.abs(best.count - count);
  for (const l of LAYOUTS) {
    const d = Math.abs(l.count - count);
    if (d < bestDist || (d === bestDist && l.count > best.count)) {
      best = l;
      bestDist = d;
    }
  }
  return best;
}

/** 网格容器样式：列/行模板按版式铺满。 */
export function buildGridStyle(layout: LayoutDef, gap: number): CSSProperties {
  return {
    display: 'grid',
    gap,
    gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
    gridTemplateRows: layout.rowHeights
      ? layout.rowHeights.map((h) => `${h}fr`).join(' ')
      : `repeat(${layout.rows}, 1fr)`,
    width: '100%',
    height: '100%',
  };
}

/** 单元格样式：列/行起点 + 跨度 + 圆角。 */
export function cellStyle(cell: LayoutCell): CSSProperties {
  return {
    gridColumn: `${cell.c} / span ${cell.cs ?? 1}`,
    gridRow: `${cell.r} / span ${cell.rs ?? 1}`,
    overflow: 'hidden',
    borderRadius: 8,
  };
}

export function ImageGroupComponent({ data }: { data: ImageGroupData }) {
  const { variant, images = [], gap = 8 } = data;

  // 无图 → 整块占位。
  if (!images || images.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center skin-card-flat bg-surface-hover text-xs text-foreground-muted">
        Image group
      </div>
    );
  }

  const layout = resolveLayout(variant, images.length);

  return (
    <div className="h-full w-full" style={buildGridStyle(layout, gap)}>
      {layout.cells.map((cell, i) => {
        const src = images[i]?.src;
        return (
          <div key={i} style={cellStyle(cell)} className="bg-surface-hover">
            {src ? (
              <img src={src} alt="" draggable={false} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-foreground-muted">
                Image
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
