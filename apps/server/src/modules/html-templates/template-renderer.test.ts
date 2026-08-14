import { beforeEach, describe, expect, it, vi } from 'vitest';

// extractPeriodData 直接查 prisma.campaign.findUnique({ include: { campaignCreators: { include: { creator, performance, cpsPerformances } } } })
const prismaMock = vi.hoisted(() => ({
  campaign: { findUnique: vi.fn() },
}));

vi.mock('../../prisma', () => ({ prisma: prismaMock }));

import { extractPeriodData, renderTemplate } from './template-renderer';

const AVATAR_URL = 'https://cdn.example.com/alice.jpg';
const PERIOD = { startDate: '2026-08-01', endDate: '2026-08-11' };

/** 一个 creator,带真实 avatar + 期内有 CPS daily(让该行被选中)。creator 头像是 Prisma 的 `avatar` 字段,非 `avatarUrl`。 */
function campaignWithAvatarCreator() {
  return {
    id: 'camp-1',
    platform: 'instagram',
    startDate: '2026-08-01',
    endDate: '2026-08-11',
    metrics: {},
    campaignCreators: [
      {
        creator: {
          name: 'Alice',
          handle: '@alice',
          platform: 'instagram',
          partnerType: 'mega',
          avatar: AVATAR_URL, // Prisma schema 字段名是 avatar(schema.prisma:262)
        },
        performance: { posts: 5, engagement: 100, impressions: 1000, engagementRate: 10 },
        cpsPerformances: [
          {
            daily: [
              {
                date: '2026-08-05',
                clicks: 50,
                orders: 5,
                gmv: 500,
                newCustomers: 3,
                commission: 50,
              },
            ],
          },
        ],
      },
    ],
    businessLine: null,
    advertiser: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.campaign.findUnique.mockResolvedValue(campaignWithAvatarCreator());
});

describe('template-renderer · 达人头像字段名映射', () => {
  it('extractPeriodData 把 Prisma creator.avatar 映射到 CreatorRow.avatarUrl', async () => {
    const data = await extractPeriodData('camp-1', PERIOD);
    expect(data.creators).toHaveLength(1);
    expect(data.creators[0].avatarUrl).toBe(AVATAR_URL);
  });

  it('renderTemplate 把达人头像 URL 渲染进 creators 表格行', async () => {
    const html = await renderTemplate(
      `<html><body>
        <tbody data-field="creators">
          <tr data-creator="template">
            <td data-field="creator.avatar">placeholder</td>
            <td data-field="creator.name">name</td>
          </tr>
        </tbody>
      </body></html>`,
      'camp-1',
      PERIOD,
    );
    expect(html).toContain(AVATAR_URL);
  });
});
