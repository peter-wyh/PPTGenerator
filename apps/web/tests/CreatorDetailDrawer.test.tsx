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
