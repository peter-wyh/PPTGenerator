import { describe, it, expect, beforeEach } from 'vitest';
import { SCENARIO_TEMPLATES, getTemplate } from '@/editor/templates';
import { useEditorStore } from '@/editor/store';
import type { ProjectDetail } from '@mediakit/shared';

const emptyProject: ProjectDetail = {
  id: 'p',
  name: 'p',
  width: 1280,
  height: 720,
  pages: [{ id: 'pg', name: '第 1 页', components: [] }],
  createdAt: '',
  updatedAt: '',
};

describe('scenario templates (第④层)', () => {
  it('biweekly = 8 pages, monthly = 14 pages', () => {
    const biweekly = SCENARIO_TEMPLATES.find((s) => s.id === 'biweekly')!;
    const monthly = SCENARIO_TEMPLATES.find((s) => s.id === 'monthly')!;
    expect(biweekly.pages.length).toBe(8);
    expect(monthly.pages.length).toBe(14);
  });

  it('every referenced templateId exists in TEMPLATES', () => {
    for (const sc of SCENARIO_TEMPLATES) {
      for (const p of sc.pages) {
        expect(getTemplate(p.templateId)).toBeDefined();
      }
    }
  });

  it('expanding a scenario yields one component batch per page (all non-empty except blank)', () => {
    const monthly = SCENARIO_TEMPLATES.find((s) => s.id === 'monthly')!;
    const expanded = monthly.pages.map((p) => ({
      name: p.name,
      components: getTemplate(p.templateId)!.components(),
    }));
    expect(expanded.length).toBe(14);
    // 除 blank 外，每页都应带入组件。
    const nonBlank = expanded.filter((p) => p.components.length > 0);
    expect(nonBlank.length).toBeGreaterThanOrEqual(12);
  });
});

describe('store.addPagesBatch', () => {
  beforeEach(() => useEditorStore.getState().loadProject(emptyProject, 'p'));

  it('creates N pages in one commit with unique component ids', () => {
    const before = useEditorStore.getState().pages.length; // 1
    useEditorStore.getState().addPagesBatch([
      {
        name: '封面',
        components: [
          { id: 'x', type: 'text', x: 0, y: 0, w: 100, h: 50, data: { content: 'A', fontSize: 14, color: '#000' } },
        ],
      },
      {
        name: '业绩',
        components: [
          { id: 'x', type: 'text', x: 0, y: 0, w: 100, h: 50, data: { content: 'B', fontSize: 14, color: '#000' } },
        ],
      },
    ]);
    const pages = useEditorStore.getState().pages;
    expect(pages.length).toBe(before + 2);
    // 组件 id 被重新分配，不与传入的 'x' 冲突，且两页互不冲突。
    const ids = pages.flatMap((p) => p.components.map((c) => c.id));
    expect(ids).not.toContain('x');
    expect(new Set(ids).size).toBe(ids.length);
    // 当前页切到新生成的第一页。
    expect(useEditorStore.getState().currentPageId).toBe(pages[before].id);
  });

  it('undo reverts the whole batch in one step', () => {
    const before = useEditorStore.getState().pages.length;
    useEditorStore.getState().addPagesBatch([
      { name: 'a', components: [] },
      { name: 'b', components: [] },
      { name: 'c', components: [] },
    ]);
    expect(useEditorStore.getState().pages.length).toBe(before + 3);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().pages.length).toBe(before); // 一次 undo 全回退
  });
});
