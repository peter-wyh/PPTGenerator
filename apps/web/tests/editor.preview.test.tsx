import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '@/editor/store';
import type { ProjectDetail } from '@mediakit/shared';

function makeDetail(pages = 3): ProjectDetail {
  return {
    id: 'proj-1',
    name: 'P',
    width: 1280,
    height: 720,
    pages: Array.from({ length: pages }, (_, i) => ({
      id: `p${i + 1}`,
      name: `第 ${i + 1} 页`,
      components: [],
    })),
    createdAt: '',
    updatedAt: '',
  };
}

function load(detail = makeDetail()) {
  useEditorStore.getState().loadProject(detail, detail.name);
}

describe('editor preview store (M6)', () => {
  beforeEach(() => load());

  it('defaults to closed, index 0', () => {
    const s = useEditorStore.getState();
    expect(s.previewOpen).toBe(false);
    expect(s.previewPageIndex).toBe(0);
  });

  it('enterPreview opens at current page index', () => {
    load(makeDetail(3));
    useEditorStore.getState().setPage('p2');
    useEditorStore.getState().enterPreview();
    const s = useEditorStore.getState();
    expect(s.previewOpen).toBe(true);
    expect(s.previewPageIndex).toBe(1);
  });

  it('previewNext / previewPrev move and clamp', () => {
    useEditorStore.getState().enterPreview();
    const st = useEditorStore.getState();
    expect(st.previewPageIndex).toBe(0);

    useEditorStore.getState().previewNext();
    expect(useEditorStore.getState().previewPageIndex).toBe(1);
    useEditorStore.getState().previewNext();
    expect(useEditorStore.getState().previewPageIndex).toBe(2);
    // clamp at last
    useEditorStore.getState().previewNext();
    expect(useEditorStore.getState().previewPageIndex).toBe(2);

    useEditorStore.getState().previewPrev();
    expect(useEditorStore.getState().previewPageIndex).toBe(1);
    // clamp at first
    useEditorStore.getState().previewPrev();
    useEditorStore.getState().previewPrev();
    expect(useEditorStore.getState().previewPageIndex).toBe(0);
  });

  it('exitPreview closes', () => {
    useEditorStore.getState().enterPreview();
    expect(useEditorStore.getState().previewOpen).toBe(true);
    useEditorStore.getState().exitPreview();
    expect(useEditorStore.getState().previewOpen).toBe(false);
  });

  it('setPreviewPageIndex clamps to valid range', () => {
    useEditorStore.getState().enterPreview();
    useEditorStore.getState().setPreviewPageIndex(999);
    expect(useEditorStore.getState().previewPageIndex).toBe(2);
    useEditorStore.getState().setPreviewPageIndex(-5);
    expect(useEditorStore.getState().previewPageIndex).toBe(0);
  });

  it('preview changes do NOT pollute undo history', () => {
    const before = useEditorStore.getState().historyIndex;
    useEditorStore.getState().enterPreview();
    useEditorStore.getState().previewNext();
    useEditorStore.getState().exitPreview();
    expect(useEditorStore.getState().historyIndex).toBe(before);
  });
});
