import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '@/editor/store';
import type { ProjectDetail } from '@mediakit/shared';

function comp(id: string, x = 10, y = 10) {
  return { id, type: 'text' as const, x, y, w: 100, h: 50, data: { content: id, fontSize: 14, color: '#000' } };
}

const detail: ProjectDetail = {
  id: 'p',
  name: 'p',
  width: 1280,
  height: 720,
  pages: [{ id: 'pg', name: '第 1 页', components: [comp('c1'), comp('c2')] }],
  createdAt: '',
  updatedAt: '',
};

describe('editor store — copyPage / addPageWithComponents', () => {
  beforeEach(() => useEditorStore.getState().loadProject(detail, 'p'));

  it('copyPage clones the page with a new id and new component ids, inserted after source', () => {
    useEditorStore.getState().copyPage('pg');
    const pages = useEditorStore.getState().pages;
    expect(pages).toHaveLength(2);
    const copy = pages[1];
    expect(copy.id).not.toBe('pg');
    expect(copy.name).toBe('第 1 页 (副本)');
    expect(copy.components).toHaveLength(2);
    // 组件 id 全部重新生成。
    expect(copy.components.every((c) => !['c1', 'c2'].includes(c.id))).toBe(true);
    // 内容仍保留（深拷贝）。
    expect((copy.components[0].data as { content: string }).content).toBe('c1');
  });

  it('copyPage does not switch the current page', () => {
    useEditorStore.getState().copyPage('pg');
    expect(useEditorStore.getState().currentPageId).toBe('pg');
  });

  it('copyPage commits history and marks dirty', () => {
    const before = useEditorStore.getState().historyIndex;
    useEditorStore.getState().copyPage('pg');
    expect(useEditorStore.getState().historyIndex).toBe(before + 1);
    expect(useEditorStore.getState().dirty).toBe(true);
  });

  it('addPageWithComponents reids template components and switches to the new page', () => {
    const tpl = [comp('t1', 0, 0), comp('t2', 100, 100)];
    useEditorStore.getState().addPageWithComponents('模板页', tpl);
    const pages = useEditorStore.getState().pages;
    expect(pages).toHaveLength(2);
    const newPage = pages[1];
    expect(newPage.name).toBe('模板页');
    expect(newPage.components).toHaveLength(2);
    expect(newPage.components.every((c) => !['t1', 't2'].includes(c.id))).toBe(true);
    expect(useEditorStore.getState().currentPageId).toBe(newPage.id);
  });
});
