import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getCampaignMock, getMock } = vi.hoisted(() => ({
  getCampaignMock: vi.fn(),
  getMock: vi.fn(),
}));

vi.mock('@/api/campaigns', () => ({ getCampaign: (id: string) => getCampaignMock(id) }));
vi.mock('@/api/dataLibrary', () => ({ dataApi: { get: (id: string) => getMock(id), list: vi.fn() } }));

import { listCampaignCollaborators } from '@/api/creators';

const mia = { id: 'cre-mia', kind: 'CREATOR', ownerId: 'u', data: { id: 'cre-mia', name: 'Mia', handle: '@mia', platform: 'TikTok', tier: 'mega', followers: '1M', engagement: '8%', category: 'Beauty', region: 'US', metrics: [] }, createdAt: '', updatedAt: '' };

beforeEach(() => vi.clearAllMocks());

describe('listCampaignCollaborators', () => {
  it('按 campaign.creatorIds 从达人库解析;孤儿 id(404)跳过', async () => {
    getCampaignMock.mockResolvedValue({ id: 'camp-x', creatorIds: ['cre-mia', 'cre-gone'] });
    getMock.mockImplementation((id: string) =>
      id === 'cre-mia' ? Promise.resolve(mia) : Promise.reject(new Error('404')),
    );
    const r = await listCampaignCollaborators('camp-x');
    expect(getMock).toHaveBeenCalledWith('cre-mia');
    expect(getMock).toHaveBeenCalledWith('cre-gone');
    expect(r).toEqual([mia.data]);
  });
  it('campaign 无 creatorIds → 空数组(不调 get)', async () => {
    getCampaignMock.mockResolvedValue({ id: 'camp-x' });
    const r = await listCampaignCollaborators('camp-x');
    expect(r).toEqual([]);
    expect(getMock).not.toHaveBeenCalled();
  });
});
