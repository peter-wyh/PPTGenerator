/**
 * 布局吸附纯函数：grid 对齐 + 安全区磁吸（仅靠近时吸，可出血）。
 * 被 store.move/resize 与 Canvas 拖拽复用，无 React/store 依赖，便于单测。
 */
import { MIN_W, MIN_H } from './defaults';

/** 安全区磁吸阈值（px）：组件边落在安全线 ±该值内时吸到安全线。 */
export const SAFE_SNAP_THRESHOLD = 6;

export interface SafeRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * 由 safeMargin + 画布尺寸构造安全区矩形。
 * - margin ≤ 0 → null（不画安全区、不吸附）；
 * - margin*2 ≥ 短边 → null（安全区大于等于画布，避免负宽高/无意义）。
 */
export function safeRectFrom(margin: number, cw: number, ch: number): SafeRect | null {
  if (!margin || margin <= 0) return null;
  if (margin * 2 >= Math.min(cw, ch)) return null;
  return { left: margin, top: margin, right: cw - margin, bottom: ch - margin };
}

/**
 * 移动落点吸附：先 grid 对齐，再把靠近安全区边线的边吸过去（可出血，仅靠近时吸）。
 * 入参 box.x/y 为「c.x + dx」之后、网格对齐之前的值；返回吸附后的 {x,y}（w/h 不变）。
 */
export function snapMove(
  box: { x: number; y: number; w: number; h: number },
  grid: number,
  safe: SafeRect | null,
  threshold: number = SAFE_SNAP_THRESHOLD,
): { x: number; y: number } {
  const g = grid > 0 ? grid : 1;
  let x = Math.round(box.x / g) * g;
  let y = Math.round(box.y / g) * g;
  if (safe) {
    if (Math.abs(x - safe.left) <= threshold) x = safe.left;
    else if (Math.abs(x + box.w - safe.right) <= threshold) x = safe.right - box.w;
    if (Math.abs(y - safe.top) <= threshold) y = safe.top;
    else if (Math.abs(y + box.h - safe.bottom) <= threshold) y = safe.bottom - box.h;
  }
  return { x, y };
}

/**
 * 缩放吸附：grid 对齐 x/y/w/h，再按 dir 把「动边」吸到安全线。
 * dir 为 'n'|'ne'|'e'|'se'|'s'|'sw'|'w'|'nw' 之一（字符串，避免与 store 的 ResizeDir 循环依赖）。
 */
export function snapResize(
  raw: { x: number; y: number; w: number; h: number },
  dir: string,
  grid: number,
  safe: SafeRect | null,
  threshold: number = SAFE_SNAP_THRESHOLD,
): { x: number; y: number; w: number; h: number } {
  const g = grid > 0 ? grid : 1;
  let x = Math.round(raw.x / g) * g;
  let y = Math.round(raw.y / g) * g;
  let w = Math.max(MIN_W, Math.round(raw.w / g) * g);
  let h = Math.max(MIN_H, Math.round(raw.h / g) * g);
  if (safe) {
    if (dir.includes('w') && Math.abs(x - safe.left) <= threshold) {
      const nx = safe.left;
      w = Math.max(MIN_W, w + (x - nx));
      x = nx;
    } else if (dir.includes('e') && Math.abs(x + w - safe.right) <= threshold) {
      w = Math.max(MIN_W, safe.right - x);
    }
    if (dir.includes('n') && Math.abs(y - safe.top) <= threshold) {
      const ny = safe.top;
      h = Math.max(MIN_H, h + (y - ny));
      y = ny;
    } else if (dir.includes('s') && Math.abs(y + h - safe.bottom) <= threshold) {
      h = Math.max(MIN_H, safe.bottom - y);
    }
  }
  return { x, y, w, h };
}
