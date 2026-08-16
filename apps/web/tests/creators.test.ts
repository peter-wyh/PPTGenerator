import { describe, it, expect, vi, beforeEach } from 'vitest';

const { listLinksMock } = vi.hoisted(() => ({
  listLinksMock: vi.fn(),
}));

vi.mock('@/api/campaignsApi', async () => {
  const actual = await vi.importActual<typeof import('@/api/campaignsApi')>('@/api/campaignsApi');
  return {
    campaignsApi: {
      ...actual.campaignsApi,
      listLinks: (id: string) => listLinksMock(id),
    },
    dtoToCreator: actual.dtoToCreator,
  };
});

import { listCampaignCollaborators } from '@/api/creators';

beforeEach(() => vi.clearAllMocks());

describe('listCampaignCollaborators', () => {
  it('从 CampaignCreator 中间表解析达人;无 creator 的 link 跳过', async () => {
    listLinksMock.mockResolvedValue([
      {
        id: 'l1', campaignId: 'camp-x', creatorId: 'cre-mia', collabType: null, status: null,
        creator: {
          id: 'cre-mia', name: 'Mia', handle: '@mia', platform: 'TikTok', partnerType: null,
          tier: 'mega', followers: '1M', engagement: '8%', category: 'Beauty', region: 'US',
          avatar: null, profileUrl: null, contact: null, rate: null,
          metrics: [], audience: null, works: null, stats: null, profile: null,
        },
      },
      // 孤儿 link(creator 已删,null)跳过
      { id: 'l2', campaignId: 'camp-x', creatorId: 'cre-gone', collabType: null, status: null, creator: null },
    ]);
    const r = await listCampaignCollaborators('camp-x');
    expect(listLinksMock).toHaveBeenCalledWith('camp-x');
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe('Mia');
    expect(r[0].handle).toBe('@mia');
  });

  it('campaign 无 links → 空数组', async () => {
    listLinksMock.mockResolvedValue([]);
    const r = await listCampaignCollaborators('camp-x');
    expect(r).toEqual([]);
  });
});
