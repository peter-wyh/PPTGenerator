import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DataConfigOverlay } from '@/editor/components/DataConfigOverlay';
import { useEditorStore } from '@/editor/store';
import type { Creator } from '@/api/creators';
import type { CreatorWorkPost } from '@/api/mock/creatorPerformance';

// ---- Mock 达人 + 作品数据 ----
const MOCK_CREATORS: Creator[] = [
  { id: 'c1', name: '达人A', handle: 'creator_a', platform: 'TikTok', tier: 'KOL', followers: '120K', engagement: '5.2%', category: '美妆', region: '中国', avatar: '', metrics: [] },
  { id: 'c2', name: '达人B', handle: 'creator_b', platform: 'Instagram', tier: 'KOC', followers: '45K', engagement: '3.8%', category: '时尚', region: '美国', avatar: '', metrics: [] },
  { id: 'c3', name: '达人C', handle: 'creator_c', platform: 'YouTube', tier: 'KOL', followers: '800K', engagement: '7.1%', category: '美食', region: '日本', avatar: '', metrics: [] },
];

const MOCK_POSTS: CreatorWorkPost[] = [
  { postId: 'p1', creatorId: 'c1', creatorName: '达人A', title: '秋季新品开箱', cover: '', url: '', platform: 'TikTok', publishedAt: '2026-09-15', impressions: '50K', likes: '3.2K', comments: '180', shares: '90', saves: '450', orders: '23', cpm: '$12', engagementRate: '6.5%', screenshots: [{ src: '' }] },
];

const MOCK_WORKS = [
  { creatorId: 'c1', creatorName: '达人A', platform: 'TikTok', tier: 'KOL', posts: MOCK_POSTS },
  { creatorId: 'c2', creatorName: '达人B', platform: 'Instagram', tier: 'KOC', posts: [] },
  { creatorId: 'c3', creatorName: '达人C', platform: 'YouTube', tier: 'KOL', posts: [] },
];

vi.mock('@/api/creators', () => ({
  listCampaignCreators: vi.fn(() => Promise.resolve(MOCK_CREATORS)),
  fetchCampaignCreatorWorks: vi.fn(() => Promise.resolve(MOCK_WORKS)),
  listCreators: vi.fn(() => Promise.resolve(MOCK_CREATORS)),
}));

vi.mock('@/api/campaigns', () => ({
  listCampaigns: vi.fn(() => Promise.resolve([])),
  reportCampaignFrom: vi.fn(),
}));

const noop = () => {};

function seedStore(campaignId?: string) {
  useEditorStore.setState({
    projectMeta: campaignId ? { campaignId } : null,
    reportData: campaignId
      ? ({ campaign: { id: campaignId, name: 'Test Campaign' } } as never)
      : { campaign: null, campaignCreators: [] },
  } as never);
}

describe('DataConfigOverlay — 纯显隐模式', () => {
  beforeEach(() => {
    seedStore();
  });

  it('未绑定 Campaign 时显示提示', () => {
    seedStore(undefined);
    render(<DataConfigOverlay onClose={noop} />);
    expect(screen.getByText(/未绑定 Campaign/)).toBeInTheDocument();
  });

  it('加载后默认全选所有达人', async () => {
    seedStore('camp-1');
    render(<DataConfigOverlay onClose={noop} />);
    await waitFor(() => {
      expect(screen.getByText(/共 3 位达人 · 显示 3 位 · 隐藏 0 位/)).toBeInTheDocument();
    });
  });

  it('点击达人勾选框切换为隐藏', async () => {
    seedStore('camp-1');
    const { container } = render(<DataConfigOverlay onClose={noop} />);
    // 等待加载完成
    await waitFor(() => {
      expect(screen.getByText(/共 3 位达人 · 显示 3 位 · 隐藏 0 位/)).toBeInTheDocument();
    });
    // 第一个勾选按钮对应达人A
    const checkBtns = container.querySelectorAll('button[title]');
    expect(checkBtns.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(checkBtns[0]);
    // 应该显示 2 显示 1 隐藏
    await waitFor(() => {
      expect(screen.getByText(/显示 2 位 · 隐藏 1 位/)).toBeInTheDocument();
    });
  });

  it('全部隐藏按钮将所有达人设为隐藏', async () => {
    seedStore('camp-1');
    render(<DataConfigOverlay onClose={noop} />);
    await waitFor(() => {
      expect(screen.getByText(/共 3 位达人/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('全部隐藏'));
    await waitFor(() => {
      expect(screen.getByText(/显示 0 位 · 隐藏 3 位/)).toBeInTheDocument();
    });
  });

  it('全部显示按钮恢复所有达人', async () => {
    seedStore('camp-1');
    render(<DataConfigOverlay onClose={noop} />);
    await waitFor(() => {
      expect(screen.getByText(/共 3 位达人/)).toBeInTheDocument();
    });
    // 先全部隐藏
    fireEvent.click(screen.getByText('全部隐藏'));
    await waitFor(() => {
      expect(screen.getByText(/显示 0 位/)).toBeInTheDocument();
    });
    // 再全部显示
    fireEvent.click(screen.getByText('全部显示'));
    await waitFor(() => {
      expect(screen.getByText(/显示 3 位 · 隐藏 0 位/)).toBeInTheDocument();
    });
  });

  it('可见达人展示作品数据', async () => {
    seedStore('camp-1');
    render(<DataConfigOverlay onClose={noop} />);
    await waitFor(() => {
      expect(screen.getByText('秋季新品开箱')).toBeInTheDocument();
    });
  });

  it('勾选状态实时同步到 store', async () => {
    seedStore('camp-1');
    const { container } = render(<DataConfigOverlay onClose={noop} />);
    await waitFor(() => {
      expect(screen.getByText(/共 3 位达人/)).toBeInTheDocument();
    });
    // 初始：store 有 3 个达人
    expect(useEditorStore.getState().reportData.campaignCreators?.length).toBe(3);
    // 隐藏达人B（第二个）
    const checkBtns = container.querySelectorAll('button[title]');
    fireEvent.click(checkBtns[1]);
    expect(useEditorStore.getState().reportData.campaignCreators?.length).toBe(2);
  });
});
