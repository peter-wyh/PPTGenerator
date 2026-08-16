import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore, type ResizeDir } from '@/editor/store';
import { type ProjectDetail, DEFAULT_THEME } from '@mediakit/shared';

function makeDetail(overrides: Partial<ProjectDetail> = {}): ProjectDetail {
  return {
    id: 'proj-1',
    name: '测试项目',
    width: 1280,
    height: 720,
    pages: [{ id: 'p1', name: '第 1 页', components: [] }],
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function load(detail = makeDetail()) {
  useEditorStore.getState().loadProject(detail, detail.name);
  return detail;
}

function comp(id: string, x = 100, y = 100, w = 200, h = 80) {
  return { id, type: 'text' as const, x, y, w, h, data: { content: id, fontSize: 14, color: '#000' } };
}

function currentComps() {
  return useEditorStore.getState().currentComponents();
}

describe('editor store — lifecycle', () => {
  beforeEach(() => useEditorStore.getState().loadProject(makeDetail(), '测试项目'));

  it('loadProject seeds history with baseline snapshot', () => {
    const s = useEditorStore.getState();
    expect(s.loaded).toBe(true);
    expect(s.historyIndex).toBe(0);
    expect(s.canUndo()).toBe(false);
    expect(s.currentPageId).toBe('p1');
  });

  it('loadProject synthesizes a page when none provided', () => {
    useEditorStore.getState().loadProject({ ...makeDetail(), pages: [] }, 'x');
    expect(useEditorStore.getState().pages).toHaveLength(1);
  });
});

describe('editor store — add / select', () => {
  beforeEach(() => load());

  it('addComponent uses default size + data, centers, selects, commits history', () => {
    useEditorStore.getState().addComponent('bar-chart');
    const comps = currentComps();
    expect(comps).toHaveLength(1);
    const c = comps[0];
    expect(c.type).toBe('bar-chart');
    expect(c.w).toBe(500);
    expect(c.h).toBe(300);
    // centered for 1280×720: x=(1280-500)/2=390, y=(720-300)/2=210
    expect(c.x).toBe(390);
    expect(c.y).toBe(210);
    expect((c.data as { bars: unknown[] }).bars).toHaveLength(3);
    expect(useEditorStore.getState().selectedIds).toEqual([c.id]);
    expect(useEditorStore.getState().canUndo()).toBe(true);
    expect(useEditorStore.getState().dirty).toBe(true);
  });

  it('select toggles in additive mode, replaces otherwise', () => {
    useEditorStore.getState().addComponent('text');
    useEditorStore.getState().addComponent('text');
    const [a, b] = currentComps();
    useEditorStore.getState().select(a.id);
    expect(useEditorStore.getState().selectedIds).toEqual([a.id]);
    useEditorStore.getState().select(b.id, true);
    expect(useEditorStore.getState().selectedIds).toEqual([a.id, b.id]);
    useEditorStore.getState().select(a.id, true); // toggle off
    expect(useEditorStore.getState().selectedIds).toEqual([b.id]);
    useEditorStore.getState().clearSelection();
    expect(useEditorStore.getState().selectedIds).toEqual([]);
  });

  it('selectAll selects all components on the page', () => {
    useEditorStore.getState().addComponent('text');
    useEditorStore.getState().addComponent('text');
    useEditorStore.getState().clearSelection();
    useEditorStore.getState().selectAll();
    expect(useEditorStore.getState().selectedIds).toHaveLength(2);
  });
});

describe('editor store — move / resize (live, no history until commit)', () => {
  beforeEach(() => {
    load(makeDetail({ pages: [{ id: 'p1', name: 'p', components: [comp('c1', 100, 100)] }] }));
  });

  it('move snaps to 10px grid and does not push history', () => {
    const before = useEditorStore.getState().historyIndex;
    useEditorStore.getState().move(['c1'], 13, 27);
    const c = currentComps()[0];
    // DEFAULT_THEME.layout.gridSize=8: 100+13=113 → snap 112(14*8); 100+27=127 → snap 128(16*8)
    expect(c.x).toBe(112);
    expect(c.y).toBe(128);
    expect(useEditorStore.getState().historyIndex).toBe(before);
    expect(useEditorStore.getState().dirty).toBe(true);
  });

  it('move skips locked components', () => {
    useEditorStore.getState().toggleLock('c1');
    useEditorStore.getState().move(['c1'], 50, 50);
    const c = currentComps()[0];
    expect(c.x).toBe(100);
    expect(c.y).toBe(100);
  });

  it('commit pushes a single history entry after a drag', () => {
    const before = useEditorStore.getState().historyIndex;
    useEditorStore.getState().move(['c1'], 30, 30);
    useEditorStore.getState().move(['c1'], 30, 30);
    useEditorStore.getState().commit();
    expect(useEditorStore.getState().historyIndex).toBe(before + 1);
  });

  // 期望值按 DEFAULT_THEME.layout.gridSize=8 重算——snapResize 对 x/y/w/h 全字段 round 到 8 的倍数
  // (100→104, 250→248, 110→112, 150→152; 西/北向锚点边缘经 round 后近似保持)
  it.each<[ResizeDir, number, number, { x: number; y: number; w: number; h: number }]>([
    ['se', 50, 30, { x: 104, y: 104, w: 248, h: 112 }],
    ['e', 50, 0, { x: 104, y: 104, w: 248, h: 80 }],
    ['s', 0, 30, { x: 104, y: 104, w: 200, h: 112 }],
    // west keeps east edge fixed: x+w stays 300(152+148=300)
    ['w', 50, 0, { x: 152, y: 104, w: 152, h: 80 }],
    // north keeps south edge fixed: y+h stays 180(128+48≈176→h 仍是 8 的倍数;y snap 到 128)
    ['n', 0, 30, { x: 104, y: 128, h: 48, w: 200 }],
  ])('resize %s applies correct math', (dir, dx, dy, expected) => {
    useEditorStore.getState().resize('c1', dir, dx, dy, { x: 100, y: 100, w: 200, h: 80 });
    const c = currentComps()[0];
    expect(c.x).toBe(expected.x);
    expect(c.y).toBe(expected.y);
    expect(c.w).toBe(expected.w);
    expect(c.h).toBe(expected.h);
  });

  it('resize enforces minimums (w≥40, h≥20)', () => {
    useEditorStore.getState().resize('c1', 'se', -500, -500, { x: 100, y: 100, w: 200, h: 80 });
    const c = currentComps()[0];
    // snap 后取 8 的倍数: w≥40 → 40(恰为倍数), h≥20 → 24
    expect(c.w).toBe(40);
    expect(c.h).toBe(24);
  });
});

describe('editor store — delete / duplicate / nudge / clipboard', () => {
  beforeEach(() => {
    load(makeDetail({ pages: [{ id: 'p1', name: 'p', components: [comp('c1')] }] }));
    useEditorStore.getState().select('c1');
  });

  it('deleteSelected removes and clears selection', () => {
    useEditorStore.getState().deleteSelected();
    expect(currentComps()).toHaveLength(0);
    expect(useEditorStore.getState().selectedIds).toEqual([]);
  });

  it('duplicateSelected clones with new id and +20 offset, selects clones', () => {
    useEditorStore.getState().duplicateSelected();
    const comps = currentComps();
    expect(comps).toHaveLength(2);
    const dupe = comps[1];
    expect(dupe.id).not.toBe('c1');
    expect(dupe.x).toBe(120);
    expect(dupe.y).toBe(120);
    expect(useEditorStore.getState().selectedIds).toEqual([dupe.id]);
  });

  it('nudge moves by exact px (no grid snap) and commits history', () => {
    const before = useEditorStore.getState().historyIndex;
    useEditorStore.getState().nudge(7, 0);
    expect(currentComps()[0].x).toBe(107);
    expect(useEditorStore.getState().historyIndex).toBe(before + 1);
  });

  it('copy → paste clones with new ids and +20 offset', () => {
    useEditorStore.getState().copy();
    useEditorStore.getState().paste();
    const comps = currentComps();
    expect(comps).toHaveLength(2);
    expect(comps[1].id).not.toBe('c1');
    expect(comps[1].x).toBe(120);
  });

  it('cut copies then removes', () => {
    useEditorStore.getState().cut();
    expect(currentComps()).toHaveLength(0);
    expect(useEditorStore.getState().clipboard).toHaveLength(1);
    useEditorStore.getState().paste();
    expect(currentComps()).toHaveLength(1);
  });

  it('paste with empty clipboard is a no-op', () => {
    useEditorStore.getState().clearSelection();
    useEditorStore.getState().copy(); // nothing selected
    const before = currentComps().length;
    useEditorStore.getState().paste();
    expect(currentComps().length).toBe(before);
  });
});

describe('editor store — layers & lock', () => {
  beforeEach(() => {
    load(
      makeDetail({
        pages: [{ id: 'p1', name: 'p', components: [comp('a'), comp('b'), comp('c')] }],
      }),
    );
  });

  it('bringForward / sendBackward swap adjacent', () => {
    useEditorStore.getState().bringForward('a');
    expect(currentComps().map((c) => c.id)).toEqual(['b', 'a', 'c']);
    useEditorStore.getState().sendBackward('a');
    expect(currentComps().map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('bringToFront / sendToBack move to ends', () => {
    useEditorStore.getState().bringToFront('a');
    expect(currentComps().map((c) => c.id)).toEqual(['b', 'c', 'a']);
    useEditorStore.getState().sendToBack('a');
    expect(currentComps().map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('toggleLock flips locked flag', () => {
    useEditorStore.getState().toggleLock('b');
    expect(currentComps().find((c) => c.id === 'b')?.locked).toBe(true);
  });
});

describe('editor store — pages', () => {
  beforeEach(() => load());

  it('addPage appends and switches to it', () => {
    useEditorStore.getState().addPage();
    const s = useEditorStore.getState();
    expect(s.pages).toHaveLength(2);
    expect(s.currentPageId).toBe(s.pages[1].id);
  });

  it('deletePage refuses when only one page remains', () => {
    useEditorStore.getState().deletePage('p1');
    expect(useEditorStore.getState().pages).toHaveLength(1);
  });

  it('deletePage switches current when deleting the active page', () => {
    useEditorStore.getState().addPage();
    const first = useEditorStore.getState().pages[0].id;
    useEditorStore.getState().setPage(useEditorStore.getState().pages[1].id);
    useEditorStore.getState().deletePage(useEditorStore.getState().currentPageId!);
    expect(useEditorStore.getState().currentPageId).toBe(first);
  });

  it('renamePage trims and ignores empty', () => {
    useEditorStore.getState().renamePage('p1', '  新名字  ');
    expect(useEditorStore.getState().pages[0].name).toBe('新名字');
    useEditorStore.getState().renamePage('p1', '   ');
    expect(useEditorStore.getState().pages[0].name).toBe('新名字');
  });

  it('reorderPage moves a page', () => {
    useEditorStore.getState().addPage();
    useEditorStore.getState().addPage();
    useEditorStore.getState().reorderPage(0, 2);
    const names = useEditorStore.getState().pages.map((p) => p.name);
    expect(names[2]).toBe('第 1 页');
  });
});

describe('editor store — undo / redo', () => {
  beforeEach(() => load());

  it('undo restores prior pages and clears selection; redo reapplies', () => {
    useEditorStore.getState().addComponent('text');
    const createdId = currentComps()[0].id;
    useEditorStore.getState().addComponent('text');
    expect(currentComps()).toHaveLength(2);

    useEditorStore.getState().undo();
    expect(currentComps().map((c) => c.id)).toEqual([createdId]);

    useEditorStore.getState().redo();
    expect(currentComps()).toHaveLength(2);
  });

  it('history snapshots exclude selection (undo clears it)', () => {
    useEditorStore.getState().addComponent('text');
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().selectedIds).toEqual([]);
  });

  it('undo is a no-op at baseline', () => {
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().historyIndex).toBe(0);
  });
});

describe('editor store — safe-area hard clamp (move/resize/nudge)', () => {
  function loadWithSafe(components: ReturnType<typeof comp>[], showSafeArea = true) {
    useEditorStore.getState().loadProject(
      makeDetail({
        meta: { theme: { ...DEFAULT_THEME, layout: { safeMargin: 48, gridSize: 10, showGrid: true, showSafeArea } } },
        pages: [{ id: 'p1', name: 'p', components }],
      }),
      'p',
    );
  }
  // safeRectFrom(48,1280,720) = {left:48,top:48,right:1232,bottom:672}

  it('move clamps a component dragged past the safe edge', () => {
    loadWithSafe([comp('c1', 100, 100)]);
    useEditorStore.getState().move(['c1'], -200, -200); // → -100,-100 → clamp 48,48
    const c = currentComps()[0];
    expect(c.x).toBe(48);
    expect(c.y).toBe(48);
  });

  it('move still clamps when showSafeArea is false (decoupled from guide)', () => {
    loadWithSafe([comp('c1', 100, 100)], false);
    useEditorStore.getState().move(['c1'], -200, -200);
    const c = currentComps()[0];
    expect(c.x).toBe(48);
    expect(c.y).toBe(48);
  });

  it('move shrinks an oversized component to fit on first touch', () => {
    loadWithSafe([comp('c1', 0, 0, 2000, 1000)]);
    useEditorStore.getState().move(['c1'], 5, 5);
    const c = currentComps()[0];
    expect(c.w).toBe(1184);
    expect(c.h).toBe(624);
    expect(c.x).toBe(48);
    expect(c.y).toBe(48);
  });

  it('resize clamps the east edge to the safe right line', () => {
    loadWithSafe([comp('c1', 1100, 100, 100, 80)]);
    useEditorStore.getState().resize('c1', 'e', 500, 0, { x: 1100, y: 100, w: 100, h: 80 });
    const c = currentComps()[0];
    expect(c.x).toBe(1100);
    expect(c.w).toBe(132); // 1232-1100（clamp 在 grid snap 之后，不重新对齐）
    expect(c.x + c.w).toBe(1232);
  });

  it('resize clamps west edge, preserving the right edge', () => {
    loadWithSafe([comp('c1', 100, 100)]); // w=200, right=300
    useEditorStore.getState().resize('c1', 'w', -200, 0, { x: 100, y: 100, w: 200, h: 80 });
    const c = currentComps()[0];
    expect(c.x).toBe(48);
    expect(c.x + c.w).toBe(300); // 对边不动
  });

  it('nudge clamps into safe area', () => {
    loadWithSafe([comp('c1', 50, 50)]);
    useEditorStore.getState().select('c1');
    useEditorStore.getState().nudge(-100, -100); // → -50,-50 → clamp 48,48
    const c = currentComps()[0];
    expect(c.x).toBe(48);
    expect(c.y).toBe(48);
  });

  it('addComponentAt clamps the drop point into safe area', () => {
    loadWithSafe([]);
    useEditorStore.getState().addComponentAt('text', 1270, 710); // 落在右下角外
    const c = currentComps()[0];
    expect(c.x).toBeGreaterThanOrEqual(48);
    expect(c.y).toBeGreaterThanOrEqual(48);
    expect(c.x + c.w).toBeLessThanOrEqual(1232);
    expect(c.y + c.h).toBeLessThanOrEqual(672);
  });

  it('duplicateSelected clamps the +20 offset clone into safe area', () => {
    loadWithSafe([comp('c1', 1220, 660)]); // 本身越界（懒加载不动），副本要夹
    useEditorStore.getState().select('c1');
    useEditorStore.getState().duplicateSelected();
    const dupe = currentComps()[1];
    expect(dupe.x + dupe.w).toBeLessThanOrEqual(1232);
    expect(dupe.y + dupe.h).toBeLessThanOrEqual(672);
  });

  it('paste clamps pasted components into safe area', () => {
    loadWithSafe([comp('c1', 1220, 660)]);
    useEditorStore.getState().select('c1');
    useEditorStore.getState().copy();
    useEditorStore.getState().paste();
    const pasted = currentComps()[1];
    expect(pasted.x + pasted.w).toBeLessThanOrEqual(1232);
    expect(pasted.y + pasted.h).toBeLessThanOrEqual(672);
  });

  it('sanitizeComponent clamps current geometry into safe area (no history push)', () => {
    loadWithSafe([comp('c1', 100, 100)]);
    const before = useEditorStore.getState().historyIndex;
    useEditorStore.getState().updateComponent('c1', { x: 5, y: 5 }); // 裸写越界
    useEditorStore.getState().sanitizeComponent('c1');
    const c = currentComps()[0];
    expect(c.x).toBe(48);
    expect(c.y).toBe(48);
    expect(useEditorStore.getState().historyIndex).toBe(before); // 不入 history，由调用方 commit
  });
});

describe('setTheme v2 深合并', () => {
  beforeEach(() => {
    useEditorStore.setState({
      projectMeta: { theme: { ...DEFAULT_THEME } },
      dirty: false,
    });
  });

  it('部分改 chart.barRadius 不清同级字段', () => {
    useEditorStore.getState().setTheme({ chart: { barRadius: 12 } });
    const t = useEditorStore.getState().projectMeta!.theme!;
    expect(t.chart!.barRadius).toBe(12);
    expect(t.chart!.showGrid).toBe(true);
    expect(t.chart!.legendPosition).toBe('bottom');
  });

  it('shadow 标量替换、preset 显式 undefined 清空', () => {
    useEditorStore.getState().setTheme({ shadow: 'strong', preset: undefined });
    const t = useEditorStore.getState().projectMeta!.theme!;
    expect(t.shadow).toBe('strong');
    expect(t.preset).toBeUndefined();
    expect(useEditorStore.getState().dirty).toBe(true);
  });

  it('format 部分更新保留其它 format 字段', () => {
    useEditorStore.getState().setTheme({ format: { currencySymbol: '€' } });
    const t = useEditorStore.getState().projectMeta!.theme!;
    expect(t.format!.currencySymbol).toBe('€');
    expect(t.format!.currencyPosition).toBe('before');
  });
});
