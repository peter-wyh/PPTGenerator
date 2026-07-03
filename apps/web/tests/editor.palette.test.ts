import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '@/editor/store';
import { PALETTE_MIME, type PalettePayload } from '@/editor/ComponentPanel';
import type { ProjectDetail } from '@mediakit/shared';

const project: ProjectDetail = {
  id: 'p',
  name: 'p',
  width: 1280,
  height: 720,
  pages: [{ id: 'pg', name: '第 1 页', components: [] }],
  createdAt: '',
  updatedAt: '',
};

describe('palette drag payload', () => {
  it('round-trips component and business payloads through JSON', () => {
    const a: PalettePayload = { op: 'component', type: 'kpi-board' };
    const b: PalettePayload = { op: 'business', kind: 'cover' };
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
    expect(JSON.parse(JSON.stringify(b))).toEqual(b);
    expect(PALETTE_MIME).toBe('application/x-mediakit-palette');
  });
});

describe('store.addComponentAt / addBusinessBlockAt', () => {
  beforeEach(() => useEditorStore.getState().loadProject(project, 'p'));

  it('addComponentAt places a component near the given point, snapped & clamped', () => {
    useEditorStore.getState().addComponentAt('text', 300, 200);
    const comps = useEditorStore.getState().currentComponents();
    expect(comps).toHaveLength(1);
    expect(comps[0].type).toBe('text');
    // 落点 (300,200) 作为中心 → 左上角约 (150,170)，吸附到 10。
    expect(comps[0].x % 10).toBe(0);
    expect(comps[0].y % 10).toBe(0);
    expect(comps[0].x).toBeLessThanOrEqual(300);
    expect(comps[0].y).toBeLessThanOrEqual(200);
    expect(useEditorStore.getState().selectedIds).toEqual([comps[0].id]);
  });

  it('addComponentAt clamps to canvas bounds', () => {
    useEditorStore.getState().addComponentAt('bar-chart', 5000, 5000);
    const c = useEditorStore.getState().currentComponents()[0];
    expect(c.x + c.w).toBeLessThanOrEqual(1280);
    expect(c.y + c.h).toBeLessThanOrEqual(720);
  });

  it('addBusinessBlockAt creates a business-block at the point', () => {
    useEditorStore.getState().addBusinessBlockAt('cover', 400, 300);
    const c = useEditorStore.getState().currentComponents()[0];
    expect(c.type).toBe('business-block');
    expect((c.data as { businessKind: string }).businessKind).toBe('cover');
  });
});
