import { describe, it, expect } from 'vitest';
import { safeRectFrom, snapMove, snapResize, clampRect, clampResize, SAFE_SNAP_THRESHOLD } from '@/editor/snap';

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

describe('clampRect', () => {
  const safe = { left: 48, top: 48, right: 1232, bottom: 672 }; // safeWidth=1184, safeHeight=624
  it('returns rect unchanged when safe is null', () => {
    expect(clampRect({ x: -50, y: -50, w: 10, h: 10 }, null)).toEqual({ x: -50, y: -50, w: 10, h: 10 });
  });
  it('leaves a fully-inside rect unchanged', () => {
    expect(clampRect({ x: 100, y: 100, w: 200, h: 80 }, safe)).toEqual({ x: 100, y: 100, w: 200, h: 80 });
  });
  it('clamps x/y to safe origin when left/top outside', () => {
    const r = clampRect({ x: 10, y: 10, w: 200, h: 80 }, safe);
    expect(r).toEqual({ x: 48, y: 48, w: 200, h: 80 });
  });
  it('clamps so right/bottom edges do not exceed safe far edge', () => {
    const r = clampRect({ x: 1200, y: 700, w: 200, h: 80 }, safe);
    expect(r.x).toBe(1032); // 1232-200
    expect(r.y + r.h).toBe(672);
  });
  it('shrinks an oversized rect to fit and anchors at top-left', () => {
    const r = clampRect({ x: 0, y: 0, w: 2000, h: 1000 }, safe);
    expect(r).toEqual({ x: 48, y: 48, w: 1184, h: 624 });
  });
  it('never shrinks below MIN_W/MIN_H even in a tiny safe area', () => {
    const tiny = { left: 0, top: 0, right: 30, bottom: 20 };
    const r = clampRect({ x: 0, y: 0, w: 100, h: 100 }, tiny);
    expect(r.w).toBe(40); // MIN_W
    expect(r.h).toBe(20); // MIN_H
  });
});

describe('clampResize', () => {
  const safe = { left: 48, top: 48, right: 1232, bottom: 672 };
  it('returns rect unchanged when safe is null', () => {
    expect(clampResize({ x: 10, y: 10, w: 200, h: 80 }, 'se', null)).toEqual({ x: 10, y: 10, w: 200, h: 80 });
  });
  it('clamps moving east edge to safe right, x unchanged', () => {
    const r = clampResize({ x: 1100, y: 100, w: 200, h: 80 }, 'e', safe); // x+w=1300>1232
    expect(r).toEqual({ x: 1100, y: 100, w: 132, h: 80 }); // 1232-1100
  });
  it('clamps moving west edge to safe left, preserving right edge', () => {
    const r = clampResize({ x: 10, y: 100, w: 200, h: 80 }, 'w', safe); // right=210
    expect(r.x).toBe(48);
    expect(r.w).toBe(162); // 210-48
    expect(r.x + r.w).toBe(210); // 对边不动
  });
  it('clamps moving south edge to safe bottom, y unchanged', () => {
    const r = clampResize({ x: 100, y: 650, w: 200, h: 80 }, 's', safe); // y+h=730>672
    expect(r).toEqual({ x: 100, y: 650, w: 200, h: 22 }); // 672-650
  });
  it('clamps moving north edge to safe top, preserving bottom edge', () => {
    const r = clampResize({ x: 100, y: 10, w: 200, h: 80 }, 'n', safe); // bottom=90
    expect(r.y).toBe(48);
    expect(r.h).toBe(42); // 90-48
    expect(r.y + r.h).toBe(90);
  });
  it('does NOT clamp the non-moving edge', () => {
    // east handle：左边 x=10<48 不在动 → 不夹左边
    const r = clampResize({ x: 10, y: 100, w: 200, h: 80 }, 'e', safe); // x+w=210<1232 也不夹右边
    expect(r.x).toBe(10);
  });
  it('respects MIN_W when clamping east into a tiny safe area', () => {
    const tiny = { left: 0, top: 0, right: 10, bottom: 100 };
    const r = clampResize({ x: 0, y: 0, w: 200, h: 80 }, 'e', tiny); // w=max(40,10-0)=40
    expect(r.w).toBe(40);
  });
});
