import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CollaborationData } from '@mediaket/shared';
import { collaborationId } from '@mediaket/shared';

vi.mock('@/api/dataLibrary', () => ({
  dataApi: {
    get: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('@/api/campaignsApi', () => ({
  campaignsApi: {
    getCollaboration: vi.fn(),
    upsertCollaboration: vi.fn(),
  },
}));

import { dataApi } from '@/api/dataLibrary';
import { campaignsApi } from '@/api/campaignsApi';
import { getCollaboration, saveCollaboration } from '@/api/collaborations';

const collab: CollaborationData = {
  id: collaborationId('c1', 'cr1'),
  campaignId: 'c1',
  creatorId: 'cr1',
  deliverables: [
    {
      contentType: 'post',
      screenshots: [{ src: 'https://example.com/1.jpg' }],
      metrics: [{ label: 'Impressions', value: '50K' }],
    },
  ],
};

beforeEach(() => vi.clearAllMocks());

describe('collaboration api helpers', () => {
  it('getCollaboration returns rich data on hit, null on empty-shell/miss', async () => {
    // 新表命中 + 有 rich data → 返回
    vi.mocked(campaignsApi.getCollaboration).mockResolvedValueOnce({
      id: 'x',
      campaignCreatorId: 'y',
      deliverables: collab.deliverables,
      legacyId: 'collab:c1:cr1',
    } as never);
    const result = await getCollaboration('c1', 'cr1');
    expect(result).toEqual({
      id: 'collab:c1:cr1',
      campaignId: 'c1',
      creatorId: 'cr1',
      deliverables: collab.deliverables,
    });

    // 新表命中但空壳（无 screenshots/metrics）→ 回退 → 也 miss → null
    vi.mocked(campaignsApi.getCollaboration).mockResolvedValueOnce({
      id: 'x',
      campaignCreatorId: 'y',
      deliverables: [{ contentType: 'post' }],
      legacyId: 'collab:c1:cr1',
    } as never);
    vi.mocked(dataApi.get).mockRejectedValueOnce(new Error('404'));
    await expect(getCollaboration('c1', 'cr1')).resolves.toBeNull();
  });

  it('saveCollaboration writes to new table only', async () => {
    vi.mocked(campaignsApi.upsertCollaboration).mockResolvedValueOnce({} as never);
    await saveCollaboration(collab);
    expect(campaignsApi.upsertCollaboration).toHaveBeenCalledWith('c1', 'cr1', {
      deliverables: collab.deliverables,
    });
    // dataApi 不应被调用（Phase 4: 单写新表）
    expect(dataApi.update).not.toHaveBeenCalled();
  });

  it('saveCollaboration falls back to DataRecord on new-table failure', async () => {
    vi.mocked(campaignsApi.upsertCollaboration).mockRejectedValueOnce(new Error('500'));
    vi.mocked(dataApi.update).mockResolvedValueOnce({} as never);
    await saveCollaboration(collab);
    expect(dataApi.update).toHaveBeenCalledWith(collab.id, collab);
  });
});
