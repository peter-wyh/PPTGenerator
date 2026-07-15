import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { CollaborationDetail } from '@/components/CollaborationDetail';
import type { CollaborationData } from '@mediakit/shared';
import { collaborationId } from '@mediakit/shared';

vi.mock('@/api/collaborations', () => ({
  getCollaboration: vi.fn(),
  saveCollaboration: vi.fn().mockResolvedValue(undefined),
  removeCollaboration: vi.fn().mockResolvedValue(undefined),
}));

import { getCollaboration, saveCollaboration } from '@/api/collaborations';

const collab: CollaborationData = {
  id: collaborationId('c1', 'cr1'),
  campaignId: 'c1',
  creatorId: 'cr1',
  deliverables: [
    { contentType: 'post', metrics: [{ label: '播放', value: '1.2M' }] },
    { contentType: 'reels', screenshots: [{ src: 'r.jpg' }] },
  ],
};

describe('CollaborationDetail', () => {
  it('renders 合作方式 label derived from deliverables', async () => {
    vi.mocked(getCollaboration).mockResolvedValueOnce(collab);
    render(<CollaborationDetail campaignId="c1" creatorId="cr1" creatorName="Mia" onChange={() => {}} />);
    await waitFor(() => expect(screen.getByText(/合作方式/)).toBeInTheDocument());
    expect(screen.getByText('post + reels')).toBeInTheDocument();
    expect(screen.getByText('post')).toBeInTheDocument();
    expect(screen.getByText('reels')).toBeInTheDocument();
  });

  it('shows empty state when no collaboration record', async () => {
    vi.mocked(getCollaboration).mockResolvedValueOnce(null);
    render(<CollaborationDetail campaignId="c1" creatorId="cr1" creatorName="Mia" onChange={() => {}} />);
    await waitFor(() => expect(screen.getByText(/未设置合作/)).toBeInTheDocument());
  });

  it('editing 模式可编辑受众画像并保存', async () => {
    vi.mocked(getCollaboration).mockResolvedValueOnce({
      id: collaborationId('c1', 'cr1'),
      campaignId: 'c1',
      creatorId: 'cr1',
      deliverables: [{ contentType: 'post' }],
    });
    render(<CollaborationDetail campaignId="c1" creatorId="cr1" creatorName="Mia" onChange={() => {}} />);
    await waitFor(() => expect(screen.getByText('编辑合作')).toBeInTheDocument());
    fireEvent.click(screen.getByText('编辑合作'));

    const citySection = screen.getByText('受众·城市').closest('.mb-1') as HTMLElement;
    fireEvent.click(within(citySection).getByText('+ 添加'));
    fireEvent.change(within(citySection).getByPlaceholderText('标签'), { target: { value: '上海' } });
    fireEvent.change(within(citySection).getByPlaceholderText('值'), { target: { value: '28' } });

    fireEvent.click(screen.getByText('保存'));
    await waitFor(() => expect(saveCollaboration).toHaveBeenCalledTimes(1));
    const saved = vi.mocked(saveCollaboration).mock.calls[0][0];
    expect(saved.deliverables[0].audience?.topCities).toEqual([{ label: '上海', value: 28 }]);
  });

  it('非 editing 模式画像行只读（disabled，无 + 添加）', async () => {
    vi.mocked(getCollaboration).mockResolvedValueOnce({
      id: collaborationId('c1', 'cr1'),
      campaignId: 'c1',
      creatorId: 'cr1',
      deliverables: [{ contentType: 'post', audience: { topCities: [{ label: '上海', value: 28 }] } }],
    });
    render(<CollaborationDetail campaignId="c1" creatorId="cr1" creatorName="Mia" onChange={() => {}} />);
    await waitFor(() => expect(screen.getByText('受众·城市')).toBeInTheDocument());
    const citySection = screen.getByText('受众·城市').closest('.mb-1') as HTMLElement;
    expect(within(citySection).getByDisplayValue('上海')).toBeDisabled();
    expect(within(citySection).queryByText('+ 添加')).toBeNull();
  });
});
