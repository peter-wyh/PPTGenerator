import { describe, it, expect } from 'vitest';
import { safeRectFrom, snapMove, snapResize, SAFE_SNAP_THRESHOLD } from '@/editor/snap';

describe('safeRectFrom', () => {
  it('returns null for non-positive margin', () => {
    expect(safeRectFrom(0, 1280, 720)).toBeNull();
    expect(safeRectFrom(-5, 1280, 720)).toBeNull();
  });
  it('returns null when margin would invert the rect', () => {
    expect(safeRectFrom(400, 1280, 720)).toBeNull(); // 2*400 < min(1280,720)=720? 800>720 → null
  });
  it('builds a rect for a normal margin', () => {
    expect(safeRectFrom(48, 1280, 720)).toEqual({ left: 48, top: 48, right: 1232, bottom: 672 });
  });
});

describe('snapMove', () => {
  const safe = { left: 48, top: 48, right: 1232, bottom: 672 };
  it('aligns to grid', () => {
    const r = snapMove({ x: 53, y: 9, w: 100, h: 50 }, 10, null);
    expect(r).toEqual({ x: 50, y: 10 });
  });
  it('magnetically snaps left edge to safe line when within threshold', () => {
    const r = snapMove({ x: 52, y: 100, w: 100, h: 50 }, 10, safe); // 52→grid 50, |50-48|=2 ≤ 6 → 48
    expect(r.x).toBe(48);
  });
  it('magnetically snaps right edge to safe line', () => {
    // 右边 = x+100；想吸到 1232 → x=1132；给 x=1130（grid 对齐后 1130，|1230-1232|=2）
    const r = snapMove({ x: 1130, y: 100, w: 100, h: 50 }, 10, safe);
    expect(r.x).toBe(1132);
  });
  it('does NOT snap when far from safe line (bleed allowed)', () => {
    const r = snapMove({ x: 300, y: 300, w: 100, h: 50 }, 10, safe);
    expect(r).toEqual({ x: 300, y: 300 });
  });
  it('default threshold is SAFE_SNAP_THRESHOLD', () => {
    expect(SAFE_SNAP_THRESHOLD).toBe(6);
  });
});

describe('snapResize', () => {
  const safe = { left: 48, top: 48, right: 1232, bottom: 672 };
  it('aligns w/h and x/y to grid', () => {
    const r = snapResize({ x: 100, y: 100, w: 53, h: 47 }, 'se', 10, null);
    expect(r).toEqual({ x: 100, y: 100, w: 50, h: 50 });
  });
  it('snaps moving west edge to safe left line', () => {
    // west 边在动：x=50（|50-48|=2≤6）→ x=48，w 增 2
    const r = snapResize({ x: 50, y: 100, w: 200, h: 100 }, 'w', 10, safe);
    expect(r.x).toBe(48);
    expect(r.w).toBe(202);
  });
  it('snaps moving east edge to safe right line', () => {
    // east 边在动：x+w=1230（|1230-1232|=2）→ w=1232-1000=232
    const r = snapResize({ x: 1000, y: 100, w: 230, h: 100 }, 'e', 10, safe);
    expect(r.w).toBe(232);
  });
  it('respects MIN_W floor even when snapping', () => {
    const r = snapResize({ x: 48, y: 100, w: 30, h: 100 }, 'w', 10, null);
    expect(r.w).toBeGreaterThanOrEqual(40); // MIN_W
  });
});
