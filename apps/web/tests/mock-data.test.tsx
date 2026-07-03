import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MockData } from '@/routes/MockData';

const { listCampaignsMock } = vi.hoisted(() => ({ listCampaignsMock: vi.fn() }));
const { listCreatorsMock } = vi.hoisted(() => ({ listCreatorsMock: vi.fn() }));

vi.mock('@/api/campaigns', () => ({ listCampaigns: () => listCampaignsMock() }));
vi.mock('@/api/creators', () => ({ listCreators: () => listCreatorsMock() }));

describe('MockData page', () => {
  beforeEach(() => {
    listCampaignsMock.mockResolvedValue([
      {
        id: 'c1',
        name: 'GlowLab Q4 上市',
        advertiser: 'GlowLab',
        businessLine: 'FT',
        platform: 'TikTok',
        startDate: '2026-10-12',
        endDate: '2026-11-10',
        budget: '¥300K',
        status: '投放中',
        owner: 'alex',
      },
    ]);
    listCreatorsMock.mockResolvedValue([
      {
        id: 'cr1',
        name: 'Mia Chen',
        handle: '@miaglowup',
        platform: 'TikTok',
        tier: '头部',
        followers: '1.28M',
        engagement: '8.7%',
        category: 'Beauty',
        region: 'US / UK',
      },
    ]);
  });

  it('renders campaign and creator tables from the mock APIs', async () => {
    render(<MockData />);
    expect(screen.getByText(/Campaign 数据 ·/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('达人数据 · 1')).toBeInTheDocument());

    // campaign 数据
    expect(screen.getByText('GlowLab Q4 上市')).toBeInTheDocument();
    expect(screen.getByText('投放中')).toBeInTheDocument();
    // 达人数据
    expect(screen.getByText('Mia Chen')).toBeInTheDocument();
    expect(screen.getByText('1.28M')).toBeInTheDocument();
  });

  it('shows empty state when upstream returns no data', async () => {
    listCampaignsMock.mockResolvedValue([]);
    listCreatorsMock.mockResolvedValue([]);
    render(<MockData />);
    await waitFor(() => expect(screen.getAllByText('暂无数据').length).toBe(2));
  });
});
