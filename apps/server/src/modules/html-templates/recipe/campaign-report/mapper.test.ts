// mapper.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  campaign: { findUnique: vi.fn() },
}));
vi.mock('../../../../prisma', () => ({ prisma: prismaMock }));

import { mapCampaign } from './mapper';

const campaignRow = {
  id: 'c1', name: 'GlowLab x DIGCHIC', platform: 'TikTok',
  startDate: '2026-10-12', endDate: '2026-11-10', budget: '$300K', status: 'Completed',
  businessLineCode: 'FT', advertiserName: 'GlowLab',
  businessLine: { name: 'FT' }, advertiser: { name: 'GlowLab' },
  metrics: { totalRevenue: 876360, clicks: 348619, orders: 4636, newCustomers: 1604, aov: 189, newCustomerRate: 34.6 },
  analytics: { trend: { labels: ['Oct 12','Nov 10'], revenue: [50000,166360], clicks: [15000,83619], orders: [250,876] } },
  campaignCreators: [{
    creator: { name: 'Mia Chen', handle: '@miaglowup', platform: 'TikTok', partnerType: 'creator', profileUrl: 'https://tiktok.com/@miaglowup' },
    contentType: 'video', collabType: 'cps',
    cpsPerformances: [{ clicks: 124678, impressions: 0, orders: 1016, gmv: 192000, spend: 0, commission: 0 }],
    performance: { summary: {} },
  }],
};

beforeEach(() => vi.clearAllMocks());

describe('mapCampaign', () => {
  it('campaign 不存在 → 抛 notFound', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(null);
    await expect(mapCampaign('nope')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('KPI 从 metrics 映射 + 格式化', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRow);
    const c = await mapCampaign('c1');
    const byLabel = Object.fromEntries(c.kpis.map((k) => [k.label, k.value]));
    expect(byLabel['Total Revenues']).toBe('$876,360');
    expect(byLabel['Clicks']).toBe('348,619');
    expect(byLabel['Orders']).toBe('4,636');
    expect(byLabel['New Customer Acquisition']).toBe('1,604');
    expect(byLabel['AOV']).toBe('$189');
    // New Customer 卡高亮
    expect(c.kpis.find((k) => k.label === 'New Customer Acquisition')?.highlight).toBe(true);
  });

  it('header.period.display 格式化', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRow);
    const c = await mapCampaign('c1');
    expect(c.header.period.display).toBe('Oct 12 - Nov 10, 2026');
  });

  it('publisher 从 campaignCreators + cps 映射', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRow);
    const c = await mapCampaign('c1');
    expect(c.publishers).toHaveLength(1);
    const p = c.publishers[0];
    expect(p.name).toBe('Mia Chen');
    expect(p.handle).toBe('@miaglowup');
    expect(p.type.kind).toBe('creator');
    expect(p.revenue).toBe('$192,000');
    expect(p.clicks).toBe('124,678');
    expect(p.orders).toBe('1,016');
    expect(p.linkUrl).toBe('https://tiktok.com/@miaglowup');
  });

  it('trend 从 analytics.trend 映射', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRow);
    const c = await mapCampaign('c1');
    expect(c.trend.labels).toEqual(['Oct 12','Nov 10']);
    expect(c.trend.revenue).toEqual([50000,166360]);
  });

  it('metrics 缺字段 → 兜底 0,不抛', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue({ ...campaignRow, metrics: {} });
    const c = await mapCampaign('c1');
    expect(c.kpis.find((k) => k.label === 'Total Revenues')?.value).toBe('$0');
  });

  it('actionable 留空(由 narrative 填)', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaignRow);
    const c = await mapCampaign('c1');
    expect(c.actionable).toEqual([]);
  });
});
