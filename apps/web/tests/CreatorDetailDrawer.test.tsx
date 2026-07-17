import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreatorDetailDrawer } from '@/editor/components/CreatorDetailDrawer';
import type { Creator } from '@mediakit/shared';

const creator: Creator = {
  id: 'cre-1',
  name: 'Mia Chen',
  handle: '@miaglowup',
  platform: 'TikTok',
  tier: 'mega',
  followers: '1.28M',
  engagement: '8.7%',
  category: 'Beauty',
  region: 'US',
  avatar: 'https://x/avatar.png',
  metrics: [
    { label: 'Avg Reach', value: '2.4M', compare: '' },
    { label: 'Impressions', value: '18M', compare: '' },
    { label: 'Follower Growth', value: '+38K', compare: '' },
    { label: 'CPM', value: '$120', compare: '' },
  ],
};

describe('CreatorDetailDrawer', () => {
  it('渲染头部 + 基本字段 + 4 KPI', () => {
    render(<CreatorDetailDrawer creator={creator} onClose={vi.fn()} />);
    expect(screen.getByText('Mia Chen')).toBeInTheDocument();
    expect(screen.getByText('@miaglowup')).toBeInTheDocument();
    expect(screen.getByText('1.28M')).toBeInTheDocument(); // Followers
    expect(screen.getByText('频道 KPI')).toBeInTheDocument();
    expect(screen.getByText('2.4M')).toBeInTheDocument(); // Avg Reach
    expect(screen.getByText('$120')).toBeInTheDocument(); // CPM
  });
  it('scrim 点击 → onClose', async () => {
    const onClose = vi.fn();
    const { container } = render(<CreatorDetailDrawer creator={creator} onClose={onClose} />);
    await userEvent.click(container.firstChild as Element);
    expect(onClose).toHaveBeenCalled();
  });
  it('✕ → onClose', async () => {
    const onClose = vi.fn();
    render(<CreatorDetailDrawer creator={creator} onClose={onClose} />);
    await userEvent.click(screen.getByLabelText('关闭'));
    expect(onClose).toHaveBeenCalled();
  });
  it('Esc → onClose', () => {
    const onClose = vi.fn();
    render(<CreatorDetailDrawer creator={creator} onClose={onClose} />);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalled();
  });
  it('metrics 为空 → 不渲染 KPI 区', () => {
    render(<CreatorDetailDrawer creator={{ ...creator, metrics: [] }} onClose={vi.fn()} />);
    expect(screen.queryByText('频道 KPI')).not.toBeInTheDocument();
  });
  it('metrics 缺失(CSV 导入)→ 不崩溃、隐藏 KPI 区', () => {
    const noMetrics = { ...creator, metrics: undefined } as unknown as Creator;
    const { container } = render(<CreatorDetailDrawer creator={noMetrics} onClose={vi.fn()} />);
    // 不崩溃:头部仍渲染
    expect(container.textContent).toContain('Mia Chen');
    // KPI 区隐藏
    expect(screen.queryByText('频道 KPI')).not.toBeInTheDocument();
  });
});

const fullCreator: Creator = {
  id: 'cre-x', name: 'Mia', handle: '@mia', platform: 'TikTok', tier: 'macro',
  followers: '100K', engagement: '7%', category: 'Beauty', region: 'US',
  metrics: [{ label: 'Avg Reach', value: '720K', compare: '' }],
  bio: '美妆领域 macro 达人',
  tags: ['美妆种草', '试色'],
  contact: { mcn: 'MCN-A', email: 'biz@mia.com', phone: '+1-555', contactPerson: 'Ann' },
  rate: { currency: 'USD', post: '$1,000', video: '$3,000', live: '$8,000' },
};

describe('CreatorDetailDrawer rich profile', () => {
  it('renders bio + tags + rate + contact', () => {
    render(<CreatorDetailDrawer creator={fullCreator} onClose={() => {}} />);
    expect(screen.getByText('美妆领域 macro 达人')).toBeInTheDocument();
    expect(screen.getByText('美妆种草')).toBeInTheDocument();
    expect(screen.getByText('$1,000')).toBeInTheDocument();   // post
    expect(screen.getByText('$3,000')).toBeInTheDocument();   // video
    expect(screen.getByText('$8,000')).toBeInTheDocument();   // live
    expect(screen.getByText('biz@mia.com')).toBeInTheDocument();
    expect(screen.getByText('MCN-A')).toBeInTheDocument();
  });

  it('does not crash when rich fields missing', () => {
    const minimal: Creator = {
      id: 'cre-y', name: 'Y', handle: '@y', platform: 'IG', tier: 'micro',
      followers: '1K', engagement: '5%', category: 'Food', region: 'US',
      metrics: [],
    };
    expect(() => render(<CreatorDetailDrawer creator={minimal} onClose={() => {}} />)).not.toThrow();
  });
});

const dataCreator: Creator = {
  ...fullCreator,
  audience: {
    genderSplit: [{ label: 'Female', value: 55 }, { label: 'Male', value: 45 }],
    ageRange: [{ label: '25-34', value: 40 }],
    topCities: [{ label: 'New York', value: 32 }],
  },
  works: [{
    id: 'w1', title: 'Glow Routine', contentType: 'video',
    impressions: '1.2M', likes: '96K', engagementRate: '8.0%',
    hashtags: ['#beauty'], attribution: { gmv: '$2,100' }, featured: true,
  }],
  stats: [{ key: 'followers', label: 'Followers', value: '100K', color: '#000' }],
};

describe('CreatorDetailDrawer audience/works/stats', () => {
  it('renders audience slices, works, stats', () => {
    render(<CreatorDetailDrawer creator={dataCreator} onClose={() => {}} />);
    // 受众
    expect(screen.getByText('Female')).toBeInTheDocument();
    expect(screen.getByText('25-34')).toBeInTheDocument();
    // 作品
    expect(screen.getByText('Glow Routine')).toBeInTheDocument();
    expect(screen.getByText('$2,100')).toBeInTheDocument();
    // 统计
    expect(screen.getAllByText('Followers').length).toBeGreaterThan(0);
  });
});
