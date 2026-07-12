/**
 * Editor store 纯工具函数（从 store.ts 拆出）。
 * 无副作用、无 zustand 依赖，便于独立测试。
 */
import type { EditorComponent, Page, ProjectMeta } from '@mediakit/shared';
import { DEFAULT_THEME } from '@mediakit/shared';
import { DEFAULT_GRID_SIZE } from './defaults';
import { safeRectFrom, clampRect, type SafeRect } from './snap';
import type { Alignment } from './store-types';

/** 生成唯一 ID（优先用 crypto.randomUUID，降级到时间戳+随机）。 */
export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** 深拷贝（优先 structuredClone，降级到 JSON）。 */
export function clone<T>(v: T): T {
  return structuredClone ? structuredClone(v) : JSON.parse(JSON.stringify(v));
}

/** 在当前页上不可变地变换组件数组。 */
export function withCurrentComponents(
  pages: Page[],
  currentPageId: string | null,
  fn: (comps: EditorComponent[]) => EditorComponent[],
): Page[] {
  return pages.map((p) => (p.id === currentPageId ? { ...p, components: fn(p.components) } : p));
}

/** 计算组件居中坐标。 */
export function centered(w: number, h: number, cw: number, ch: number): { x: number; y: number } {
  return { x: Math.max(0, Math.floor((cw - w) / 2)), y: Math.max(0, Math.floor((ch - h) / 2)) };
}

/** 把拖放落点 (鼠标位置) 转为组件左上角坐标：以落点为中心、网格吸附、钳制在画布内。 */
export function placed(
  w: number,
  h: number,
  cx: number,
  cy: number,
  cw: number,
  ch: number,
  grid: number,
): { x: number; y: number } {
  const g = grid > 0 ? grid : DEFAULT_GRID_SIZE;
  const x = Math.round(Math.max(0, Math.min(cx - w / 2, cw - w)) / g) * g;
  const y = Math.round(Math.max(0, Math.min(cy - h / 2, ch - h)) / g) * g;
  return { x, y };
}

/** 从当前 meta + 画布尺寸解析吸附上下文（grid + safe）。showSafeArea=false → 不吸附（参考线也隐藏）。 */
export function snapCtx(
  meta: ProjectMeta | null,
  cw: number,
  ch: number,
): { grid: number; safe: ReturnType<typeof safeRectFrom> } {
  const layout = meta?.theme?.layout;
  const grid = layout?.gridSize ?? DEFAULT_GRID_SIZE;
  const safe =
    layout && layout.showSafeArea !== false
      ? safeRectFrom(layout.safeMargin ?? DEFAULT_THEME.layout!.safeMargin, cw, ch)
      : null;
  return { grid, safe };
}

/** 夹紧用的安全区：只看 safeMargin>0，不看 showSafeArea（隐藏参考线仍夹紧）。与 snapCtx 的磁吸 safe 解耦。
 *  仅当主题含 layout 时生效（无 meta/无 layout 视为「未定义安全距离」，不夹紧）——与 snapCtx 的 null-meta 行为一致。 */
export function clampSafeFrom(meta: ProjectMeta | null, cw: number, ch: number): SafeRect | null {
  const layout = meta?.theme?.layout;
  if (!layout) return null;
  return safeRectFrom(layout.safeMargin ?? DEFAULT_THEME.layout!.safeMargin, cw, ch);
}

/** 在数组中把 id 项朝 end 方向移动 step（越界保持原位）。返回新数组。 */
export function moveItem(comps: EditorComponent[], id: string, step: 1 | -1): EditorComponent[] {
  const idx = comps.findIndex((c) => c.id === id);
  if (idx === -1) return comps;
  const target = idx + step;
  if (target < 0 || target >= comps.length) return comps;
  const next = [...comps];
  [next[idx], next[target]] = [next[target], next[idx]];
  return next;
}

/** 多选对齐：按选中组件 bbox 计算，原地改 x/y；结果夹进安全区。 */
export function alignInPlace(comps: EditorComponent[], ids: string[], alignment: Alignment, safe: SafeRect | null): EditorComponent[] {
  const sel = comps.filter((c) => ids.includes(c.id));
  if (sel.length < 2) return comps;
  const minX = Math.min(...sel.map((c) => c.x));
  const maxX = Math.max(...sel.map((c) => c.x + c.w));
  const minY = Math.min(...sel.map((c) => c.y));
  const maxY = Math.max(...sel.map((c) => c.y + c.h));
  return comps.map((c) => {
    if (!ids.includes(c.id)) return c;
    let { x, y } = c;
    if (alignment === 'left') x = minX;
    else if (alignment === 'right') x = maxX - c.w;
    else if (alignment === 'center-h') x = Math.round((minX + maxX) / 2 - c.w / 2);
    else if (alignment === 'top') y = minY;
    else if (alignment === 'bottom') y = maxY - c.h;
    else if (alignment === 'middle-v') y = Math.round((minY + maxY) / 2 - c.h / 2);
    const cl = clampRect({ x: Math.round(x), y: Math.round(y), w: c.w, h: c.h }, safe);
    return { ...c, x: cl.x, y: cl.y, w: cl.w, h: cl.h };
  });
}

/** 多选分布：沿水平/垂直方向均匀排布间距（保持顺序，首尾不动）；结果夹进安全区。 */
export function distribute(comps: EditorComponent[], ids: string[], axis: 'h' | 'v', safe: SafeRect | null): EditorComponent[] {
  const sel = comps.filter((c) => ids.includes(c.id));
  if (sel.length < 3) return comps;
  const pos = (c: EditorComponent, start: boolean) => (axis === 'h' ? (start ? c.x : c.x + c.w) : start ? c.y : c.y + c.h);
  const sorted = [...sel].sort((a, b) => pos(a, true) - pos(b, true));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const startEdge = pos(first, true);
  const endEdge = pos(last, false);
  const totalSize = sorted.reduce((acc, c) => acc + (axis === 'h' ? c.w : c.h), 0);
  const gap = (endEdge - startEdge - totalSize) / (sorted.length - 1);
  let cursor = startEdge;
  const newPos = new Map<string, number>();
  for (const c of sorted) {
    newPos.set(c.id, cursor);
    cursor += (axis === 'h' ? c.w : c.h) + gap;
  }
  return comps.map((c) => {
    if (!ids.includes(c.id)) return c;
    const np = newPos.get(c.id);
    if (np === undefined) return c;
    const box =
      axis === 'h' ? { x: Math.round(np), y: c.y, w: c.w, h: c.h } : { x: c.x, y: Math.round(np), w: c.w, h: c.h };
    const cl = clampRect(box, safe);
    return { ...c, x: cl.x, y: cl.y, w: cl.w, h: cl.h };
  });
}

/** 多选等宽/等高：全部设为均值；结果夹进安全区。 */
export function equalize(comps: EditorComponent[], ids: string[], dim: 'w' | 'h', safe: SafeRect | null): EditorComponent[] {
  const sel = comps.filter((c) => ids.includes(c.id));
  if (sel.length < 2) return comps;
  const avg = Math.round(sel.reduce((acc, c) => acc + c[dim], 0) / sel.length);
  return comps.map((c) => {
    if (!ids.includes(c.id)) return c;
    const next = dim === 'w' ? { ...c, w: avg } : { ...c, h: avg };
    const cl = clampRect({ x: next.x, y: next.y, w: next.w, h: next.h }, safe);
    return { ...c, x: cl.x, y: cl.y, w: cl.w, h: cl.h };
  });
}
