import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CollaborationDetail } from '@/components/CollaborationDetail';
import type { CollaborationData } from '@mediakit/shared';
import { collaborationId } from '@mediakit/shared';

vi.mock('@/api/collaborations', () => ({
  getCollaboration: vi.fn(),
  saveCollaboration: vi.fn().mockResolvedValue(undefined),
  removeCollaboration: vi.fn().mockResolvedValue(undefined),
}));

import { getCollaboration } from '@/api/collaborations';

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
});
