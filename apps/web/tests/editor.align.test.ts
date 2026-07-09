import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '@/editor/store';
import { type ProjectDetail, DEFAULT_THEME } from '@mediakit/shared';

const detail: ProjectDetail = {
  id: 'p',
  name: 'p',
  width: 1280,
  height: 720,
  pages: [{ id: 'pg', name: 'pg', components: [] }],
  createdAt: '',
  updatedAt: '',
};

function comp(id: string, x: number, y: number, w = 100, h = 50) {
  return { id, type: 'text' as const, x, y, w, h, data: { content: id, fontSize: 14, color: '#000' } };
}

function load(components: ReturnType<typeof comp>[]) {
  useEditorStore.getState().loadProject({ ...detail, pages: [{ id: 'pg', name: 'pg', components }] }, 'p');
}

function get(id: string) {
  return useEditorStore.getState().currentComponents().find((c) => c.id === id)!;
}

describe('editor store — align / distribute / equalize', () => {
  beforeEach(() => load([comp('a', 10, 10, 100, 50), comp('b', 200, 80, 80, 40), comp('c', 400, 200, 60, 30)]));

  it('align left sets all x to the minimum x', () => {
    useEditorStore.getState().alignComponents(['a', 'b', 'c'], 'left');
    expect(get('a').x).toBe(10);
    expect(get('b').x).toBe(10);
    expect(get('c').x).toBe(10);
  });

  it('align right sets x so all right edges match the max', () => {
    useEditorStore.getState().alignComponents(['a', 'b', 'c'], 'right');
    const maxRight = 400 + 60; // 460
    expect(get('a').x).toBe(maxRight - 100);
    expect(get('b').x).toBe(maxRight - 80);
    expect(get('c').x).toBe(maxRight - 60);
  });

  it('align top sets all y to the minimum y', () => {
    useEditorStore.getState().alignComponents(['a', 'b'], 'top');
    expect(get('a').y).toBe(10);
    expect(get('b').y).toBe(10);
  });

  it('align center-h centers each within the bbox', () => {
    useEditorStore.getState().alignComponents(['a', 'b'], 'center-h');
    // bbox minX=10 maxX=200+80=280 → mid=145
    expect(get('a').x).toBe(Math.round(145 - 100 / 2)); // 95
    expect(get('b').x).toBe(Math.round(145 - 80 / 2)); // 105
  });

  it('align is a no-op with fewer than 2 selected', () => {
    useEditorStore.getState().alignComponents(['a'], 'left');
    expect(get('a').x).toBe(10);
  });

  it('distributeH evenly spaces 3 components between first and last', () => {
    useEditorStore.getState().distributeH(['a', 'b', 'c']);
    // first a.x=10 stays; last c right edge 460 stays
    const ax = get('a').x;
    const bx = get('b').x;
    const cx = get('c').x;
    // 单调递增
    expect(ax).toBeLessThan(bx);
    expect(bx).toBeLessThan(cx);
    // 间距（b.x - a.x - a.w）与（c.x - b.x - b.w）相等
    const gap1 = bx - ax - 100;
    const gap2 = cx - bx - 80;
    expect(gap1).toBeCloseTo(gap2, 5);
  });

  it('distribute is a no-op with fewer than 3', () => {
    useEditorStore.getState().distributeH(['a', 'b']);
    expect(get('b').x).toBe(200);
  });

  it('equalWidth sets all to the average width', () => {
    useEditorStore.getState().equalWidth(['a', 'b', 'c']);
    const avg = Math.round((100 + 80 + 60) / 3); // 80
    for (const id of ['a', 'b', 'c']) expect(get(id).w).toBe(avg);
  });

  it('equalHeight sets all to the average height', () => {
    useEditorStore.getState().equalHeight(['a', 'b']);
    const avg = Math.round((50 + 40) / 2); // 45
    expect(get('a').h).toBe(avg);
    expect(get('b').h).toBe(avg);
  });

  it('each operation commits history', () => {
    const before = useEditorStore.getState().historyIndex;
    useEditorStore.getState().alignComponents(['a', 'b'], 'left');
    expect(useEditorStore.getState().historyIndex).toBe(before + 1);
  });
});

describe('align / distribute / equalize — safe-area clamp', () => {
  const safeMeta = { theme: { ...DEFAULT_THEME, layout: { safeMargin: 48, gridSize: 10, showGrid: true, showSafeArea: true } } };
  // safe = {48,48,1232,672}
  function loadAtSafe(components: ReturnType<typeof comp>[]) {
    useEditorStore.getState().loadProject(
      { ...detail, meta: safeMeta, pages: [{ id: 'pg', name: 'pg', components }] },
      'p',
    );
  }

  it('align right clamps a component whose right edge would exceed safe area', () => {
    // c 越界（右 1500>1232，懒加载保留）；a 在内。align right 把两边对到 bbox max=1500 → 夹回 1232
    loadAtSafe([comp('a', 100, 100, 100, 50), comp('c', 1400, 100, 100, 50)]);
    useEditorStore.getState().alignComponents(['a', 'c'], 'right');
    const a = get('a');
    expect(a.x + a.w).toBeLessThanOrEqual(1232);
  });

  it('equalWidth clamps components back inside safe area', () => {
    loadAtSafe([comp('a', 100, 100, 100, 50), comp('c', 1400, 100, 100, 50)]);
    useEditorStore.getState().equalWidth(['a', 'c']);
    for (const id of ['a', 'c']) expect(get(id).x + get(id).w).toBeLessThanOrEqual(1232);
  });
});
