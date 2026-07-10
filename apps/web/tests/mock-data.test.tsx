import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MockData } from '@/routes/MockData';

const { listCampaignsMock } = vi.hoisted(() => ({ listCampaignsMock: vi.fn() }));
const { listCreatorsMock } = vi.hoisted(() => ({ listCreatorsMock: vi.fn() }));
const { listCreatorPerformanceMock } = vi.hoisted(() => ({
  listCreatorPerformanceMock: vi.fn(),
}));
const { listPlacementTypeSummaryMock } = vi.hoisted(() => ({
  listPlacementTypeSummaryMock: vi.fn(),
}));

vi.mock('@/api/campaigns', () => ({ listCampaigns: () => listCampaignsMock() }));
vi.mock('@/api/creators', () => ({ listCreators: () => listCreatorsMock() }));
vi.mock('@/api/creatorPerformance', () => ({
  listCreatorPerformance: (id: string) => listCreatorPerformanceMock(id),
  listPlacementTypeSummary: (id: string) => listPlacementTypeSummaryMock(id),
}));

describe('MockData page', () => {
  beforeEach(() => {
    listCampaignsMock.mockResolvedValue([
      {
        id: 'c1',
        name: 'GlowLab Q4 Launch',
        advertiser: 'GlowLab',
        businessLine: 'FT',
        platform: 'TikTok',
        startDate: '2026-10-12',
        endDate: '2026-11-10',
        budget: '$300K',
        status: 'Active',
        owner: 'alex',
      },
    ]);
    listCreatorsMock.mockResolvedValue([
      {
        id: 'cr1',
        name: 'Mia Chen',
        handle: '@miaglowup',
        platform: 'TikTok',
        tier: 'mega',
        followers: '1.28M',
        engagement: '8.7%',
        category: 'Beauty',
        region: 'US / UK',
        metrics: [],
      },
    ]);
    listCreatorPerformanceMock.mockResolvedValue([]);
    listPlacementTypeSummaryMock.mockResolvedValue([]);
  });

  it('renders campaign and creator tables from the mock APIs', async () => {
    render(<MockData />);
    expect(screen.getByText(/Campaigns ·/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Creators · 1')).toBeInTheDocument());

    // campaign data (name now appears in table + Campaign selector)
    expect(screen.getAllByText('GlowLab Q4 Launch').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Active')).toBeInTheDocument();
    // creator data
    expect(screen.getByText('Mia Chen')).toBeInTheDocument();
    expect(screen.getByText('1.28M')).toBeInTheDocument();
  });

  it('shows empty state when upstream returns no data', async () => {
    listCampaignsMock.mockResolvedValue([]);
    listCreatorsMock.mockResolvedValue([]);
    render(<MockData />);
    await waitFor(() => expect(screen.getAllByText('No data').length).toBe(2));
  });

  it('renders creator performance (posts + CPS) for the selected campaign', async () => {
    listCreatorPerformanceMock.mockResolvedValue([
      {
        campaignId: 'c1',
        creatorId: 'cr1',
        creatorName: 'Mia Chen',
        handle: '@miaglowup',
        platform: 'TikTok',
        tier: 'mega',
        summary: {
          posts: 2,
          totalImpressions: '1.46M',
          totalEngagement: '120K',
          avgEngagementRate: '8.2%',
        },
        posts: [
          {
            id: 'c1-cr1-p1',
            title: '7-Day Sensitive Skin Rescue Vlog',
            cover: 'https://picsum.photos/seed/c1-cr1-p1/640/360',
            url: 'https://www.tiktok.com/@miaglowup/video/c1cr1p1',
            publishedAt: '2026-10-14',
            platform: 'TikTok',
            format: 'video',
            duration: '0:45',
            hashtags: '#skincare #sensitiveskin',
            impressions: '850K',
            plays: '697K',
            likes: '40,000',
            comments: '7,800',
            shares: '12,800',
            saves: '10,700',
            engagementRate: '8.4%',
          },
        ],
        daily: [
          { date: '2026-10-12', impressions: '52,000', engagement: '4,300', clicks: '1,100', gmv: '$6,900', orders: '36' },
          { date: '2026-10-13', impressions: '61,000', engagement: '5,100', clicks: '1,300', gmv: '$8,200', orders: '43' },
        ],
        placements: [
          {
            type: 'Bio Link',
            screenshot: '',
            revenue: '$92,160',
            revenueShare: '48.0%',
            clicks: '12,300',
            ctr: '3.15%',
            conversions: '488',
            cvr: '3.97%',
            epc: '$7.50',
            commission: '$11,059',
            roas: '7.71',
            notes: 'High intent traffic',
          },
        ],
        cps: {
          gmv: '$192,000',
          orders: '1,016',
          aov: '$189',
          cvr: '1.8%',
          commission: '$23,040',
          cpsSpend: '$24,883',
          roas: '7.71',
          clicks: '30,760',
          ctr: '2.7%',
          epc: '$6.24',
          refundRate: '1.8%',
        },
      },
    ]);
    listPlacementTypeSummaryMock.mockResolvedValue([
      {
        type: 'Bio Link',
        revenue: '$92,160',
        revenueShare: '48.0%',
        clicks: '12,300',
        ctr: '3.15%',
        conversions: '488',
        cvr: '3.97%',
        epc: '$7.50',
        roas: '7.71',
      },
    ]);

    render(<MockData />);
    // 帖子标题（仅 perf 卡渲染后出现）
    await waitFor(() => expect(screen.getByText('7-Day Sensitive Skin Rescue Vlog')).toBeInTheDocument());
    // Placement type summary table (campaign level)
    expect(screen.getByText('Placement Type Summary (campaign level)')).toBeInTheDocument();
    // CPS 数值（GMV 唯一；ROAS 在汇总/投放位/CPS 三处都出现，故取 all）
    expect(screen.getByText('$192,000')).toBeInTheDocument();
    expect(screen.getAllByText('7.71').length).toBeGreaterThan(0);
  });
});
