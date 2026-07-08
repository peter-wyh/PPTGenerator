import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '@/editor/store';
import type { ProjectDetail, PageGradient } from '@mediakit/shared';

const grad: PageGradient = {
  type: 'linear',
  angle: 90,
  stops: [
    { color: '#FF5C00', position: 0 },
    { color: '#FFFFFF', position: 100 },
  ],
};

const detail: ProjectDetail = {
  id: 'p',
  name: 'p',
  width: 1280,
  height: 720,
  pages: [{ id: 'pg', name: '第 1 页', components: [] }],
  createdAt: '',
  updatedAt: '',
};

describe('editor store — page bgGradient', () => {
  beforeEach(() => useEditorStore.getState().loadProject(detail, 'p'));

  it('updatePage 写入 bgGradient 并落 history + 标脏', () => {
    const before = useEditorStore.getState().historyIndex;
    useEditorStore.getState().updatePage('pg', { bgGradient: grad });
    const page = useEditorStore.getState().pages[0];
    expect(page.bgGradient).toEqual(grad);
    expect(useEditorStore.getState().historyIndex).toBe(before + 1);
    expect(useEditorStore.getState().dirty).toBe(true);
  });

  it('updatePage 可清空 bgGradient（传 undefined）', () => {
    useEditorStore.getState().updatePage('pg', { bgGradient: grad });
    useEditorStore.getState().updatePage('pg', { bgGradient: undefined });
    expect(useEditorStore.getState().pages[0].bgGradient).toBeUndefined();
  });
});
