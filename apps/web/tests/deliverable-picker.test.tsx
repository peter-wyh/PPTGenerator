import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useEditorStore } from '@/editor/store';
import { DeliverablePicker } from '@/editor/property-panel/DeliverablePicker';
import type { CollaborationData } from '@mediakit/shared';
import { collaborationId } from '@mediakit/shared';

vi.mock('@/api/collaborations', () => ({ getCollaboration: vi.fn() }));
import { getCollaboration } from '@/api/collaborations';

const emptyProject = {
  id: 'p',
  name: 'p',
  width: 1280,
  height: 720,
  pages: [{ id: 'pg', name: '第 1 页', components: [] }],
  createdAt: '',
  updatedAt: '',
} as never;

const collab: CollaborationData = {
  id: collaborationId('camp-1', 'cre-1'),
  campaignId: 'camp-1',
  creatorId: 'cre-1',
  deliverables: [{ contentType: 'post' }, { contentType: 'reels' }],
};

beforeEach(() => {
  useEditorStore.getState().loadProject(emptyProject, 'p');
  vi.clearAllMocks();
});

describe('DeliverablePicker', () => {
  it('无战役 → 提示先选战役', () => {
    render(<DeliverablePicker pickLabel="导入" onPick={() => {}} />);
    expect(screen.getByText(/先在「数据配置」选择战役/)).toBeInTheDocument();
  });

  it('有战役+达人+合作 → 渲染按钮并回调选中 deliverable', async () => {
    const store = useEditorStore.getState();
    store.setReportData({
      campaign: { id: 'camp-1', name: 'C' } as never,
      creators: [{ id: 'cre-1', name: 'Mia' } as never],
    });
    vi.mocked(getCollaboration).mockResolvedValueOnce(collab);
    const onPick = vi.fn();
    render(<DeliverablePicker pickLabel="导入" onPick={onPick} />);
    await waitFor(() => expect(screen.getByText('导入')).toBeInTheDocument());
    fireEvent.click(screen.getByText('导入'));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ contentType: 'post' }));
  });
});
