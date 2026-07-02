import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import type { ProjectDetail } from '@mediakit/shared';

const updateMock = vi.fn().mockResolvedValue({});
vi.mock('@/api/projects', () => ({
  projectsApi: { update: (id: string, patch: unknown) => updateMock(id, patch) },
}));

import { Editor } from '@/editor/Editor';
import { useEditorStore } from '@/editor/store';

const detail: ProjectDetail = {
  id: 'p1',
  name: '项目',
  width: 1280,
  height: 720,
  pages: [{ id: 'pg1', name: '第 1 页', components: [] }],
  createdAt: '',
  updatedAt: '',
};

describe('editor autosave', () => {
  beforeEach(() => {
    updateMock.mockClear();
    useEditorStore.getState().loadProject(detail, detail.name);
  });

  it('PATCHes pages after a debounced change', async () => {
    vi.useFakeTimers();
    render(<Editor detail={detail} />);

    // 初始无保存。
    expect(updateMock).not.toHaveBeenCalled();

    // 触发一次变更（dirty=true）。
    act(() => {
      useEditorStore.getState().addComponent('text');
    });

    // debounce 未到，仍未保存。
    expect(updateMock).not.toHaveBeenCalled();

    // 推进 1.6s → 触发 PATCH（异步推进以刷新 markSaved 微任务）。
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });

    expect(updateMock).toHaveBeenCalledTimes(1);
    const [id, patch] = updateMock.mock.calls[0];
    expect(id).toBe('p1');
    expect((patch as { pages: { components: unknown[] }[] }).pages[0].components).toHaveLength(1);
    // 保存后 dirty 归零。
    expect(useEditorStore.getState().dirty).toBe(false);

    vi.useRealTimers();
  });
});
