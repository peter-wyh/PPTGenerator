// render.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({ campaign: { findUnique: vi.fn() } }));
vi.mock('../../../../prisma', () => ({ prisma: prismaMock }));
vi.mock('./narrative', () => ({ fillActionable: vi.fn().mockResolvedValue([{ icon: 'trophy', color: 'green', title: 'Top Performers', items: [{ text: 'Mia', sub: '(ROAS 4.10)' }], footer: 'Scale.' }]) }));

import { render } from './render';

const campaignRow = {
  id: 'c1', name: 'GlowLab x DIGCHIC', platform: 'TikTok',
  startDate: '2026-10-12', endDate: '2026-11-10', budget: '$300K', status: 'Completed',
  businessLine: { name: 'FT' }, advertiser: { name: 'GlowLab' },
  businessLineCode: 'FT', advertiserName: 'GlowLab',
  metrics: { totalRevenue: 876360, clicks: 348619, orders: 4636, newCustomers: 1604, aov: 189, newCustomerRate: 34.6 },
  analytics: { trend: { labels: ['Oct 12', 'Nov 10'], revenue: [50000, 166360], clicks: [15000, 83619], orders: [250, 876] } },
  campaignCreators: [{
    creator: { name: 'Mia Chen', handle: '@miaglowup', platform: 'TikTok', partnerType: 'creator', profileUrl: 'https://tiktok.com/@miaglowup' },
    contentType: 'video', collabType: 'cps',
    cpsPerformances: [{ clicks: 124678, impressions: 0, orders: 1016, gmv: 192000, spend: 0, commission: 0 }],
    performance: { summary: {} },
  }],
};

beforeEach(() => { vi.clearAllMocks(); prismaMock.campaign.findUnique.mockResolvedValue(campaignRow); });

describe('render', () => {
  it('产出以 <!DOCTYPE html> 开头、</html> 结尾的独立 HTML', async () => {
    const html = await render({ campaignId: 'c1' });
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html.trim().endsWith('</html>')).toBe(true);
  });

  it('真实数字注入(不经 AI)', async () => {
    const html = await render({ campaignId: 'c1' });
    expect(html).toContain('$876,360');      // KPI
    expect(html).toContain('124,678');        // publisher clicks
    expect(html).toContain('data: [50000,166360]'); // Chart.js trend.revenue 注入(template: data: {{{json trend.revenue}}})
  });

  it('DG token 注入', async () => {
    const html = await render({ campaignId: 'c1' });
    expect(html).toContain('#ff099e');
  });

  it('AI 文案出现(Actionable 区块)', async () => {
    const html = await render({ campaignId: 'c1' });
    expect(html).toContain('Top Performers');
  });

  it('HTML 快照(DG 保真基线)', async () => {
    const html = await render({ campaignId: 'c1' });
    expect(html).toMatchSnapshot();
  });

  it('缺 campaignId → 400(不查 DB)', async () => {
    await expect(render({ campaignId: '' } as any)).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.campaign.findUnique).not.toHaveBeenCalled();
  });
});
