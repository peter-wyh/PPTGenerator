import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CollaborationData } from '@mediakit/shared';
import { collaborationId } from '@mediakit/shared';

vi.mock('@/api/dataLibrary', () => ({
  dataApi: {
    get: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
  },
}));

import { dataApi } from '@/api/dataLibrary';
import { getCollaboration, saveCollaboration } from '@/api/collaborations';

const collab: CollaborationData = {
  id: collaborationId('c1', 'cr1'),
  campaignId: 'c1',
  creatorId: 'cr1',
  deliverables: [{ contentType: 'post' }],
};

beforeEach(() => vi.clearAllMocks());

describe('collaboration api helpers', () => {
  it('getCollaboration returns data on hit, null on miss', async () => {
    vi.mocked(dataApi.get).mockResolvedValueOnce({ data: collab } as never);
    await expect(getCollaboration('c1', 'cr1')).resolves.toEqual(collab);
    vi.mocked(dataApi.get).mockRejectedValueOnce(new Error('404'));
    await expect(getCollaboration('c1', 'cr1')).resolves.toBeNull();
  });
  it('saveCollaboration updates when record exists, creates on miss', async () => {
    vi.mocked(dataApi.update).mockResolvedValueOnce({} as never);
    await saveCollaboration(collab);
    expect(dataApi.update).toHaveBeenCalledWith(collab.id, collab);
    expect(dataApi.create).not.toHaveBeenCalled();

    vi.mocked(dataApi.update).mockRejectedValueOnce(new Error('404'));
    vi.mocked(dataApi.create).mockResolvedValueOnce({} as never);
    await saveCollaboration(collab);
    expect(dataApi.create).toHaveBeenCalledWith('collaboration', collab);
  });
});
