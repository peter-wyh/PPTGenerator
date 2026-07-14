import { it, expect, vi, beforeEach } from 'vitest';

const { listMock, getMock } = vi.hoisted(() => ({ listMock: vi.fn(), getMock: vi.fn() }));

vi.mock('@/api/dataLibrary', () => ({
  dataApi: {
    list: (k: string) => listMock(k),
    get: (id: string) => getMock(id),
  },
}));

import { listCampaigns, getCampaign } from '@/api/campaigns';

beforeEach(() => vi.clearAllMocks());

it('listCampaigns → dataApi.list("campaign") 并取 .data', async () => {
  listMock.mockResolvedValue([
    { id: 'c1', kind: 'CAMPAIGN', ownerId: 'u', data: { id: 'c1', name: 'Campaign X' }, createdAt: '', updatedAt: '' },
  ]);
  const r = await listCampaigns();
  expect(listMock).toHaveBeenCalledWith('campaign');
  expect(r).toEqual([{ id: 'c1', name: 'Campaign X' }]);
});

it('getCampaign → 命中返回 data;404/异常返回 undefined', async () => {
  getMock.mockResolvedValue({ id: 'c1', kind: 'CAMPAIGN', ownerId: 'u', data: { id: 'c1', name: 'X' }, createdAt: '', updatedAt: '' });
  expect((await getCampaign('c1'))?.id).toBe('c1');
  getMock.mockRejectedValue(new Error('404'));
  expect(await getCampaign('missing')).toBeUndefined();
});
