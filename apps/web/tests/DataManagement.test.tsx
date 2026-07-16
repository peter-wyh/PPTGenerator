import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Routes, Route } from 'react-router-dom';
import { CampaignPage } from '@/routes/CampaignPage';
import { CreatorPage } from '@/routes/CreatorPage';
import { DataManagement } from '@/routes/DataManagement';

const { listMock, removeMock, importManyMock, clearMock, updateMock, listCampaignCreatorsMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  removeMock: vi.fn(),
  importManyMock: vi.fn(),
  clearMock: vi.fn(),
  updateMock: vi.fn(),
  listCampaignCreatorsMock: vi.fn(),
}));

vi.mock('@/api/dataLibrary', () => ({
  dataApi: {
    list: (k: string) => listMock(k),
    remove: (id: string) => removeMock(id),
    importMany: (k: string, items: unknown[]) => importManyMock(k, items),
    create: vi.fn(),
    update: (id: string, data: unknown) => updateMock(id, data),
    get: vi.fn(),
    clear: (k: string) => clearMock(k),
  },
}));

vi.mock('@/api/creators', () => ({
  listCampaignCollaborators: vi.fn(),
  listCreators: vi.fn(),
  listCampaignCreators: (id: string) => listCampaignCreatorsMock(id),
}));

vi.mock('@/api/campaignsApi', () => ({
  campaignsApi: {
    list: () => Promise.resolve([]),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    upsertLink: vi.fn(),
    updateLink: vi.fn(),
    listLinks: (id: string) => Promise.resolve([]),
    removeLink: vi.fn(),
    getPerformance: vi.fn(),
    upsertPerformance: vi.fn(),
    getCollaboration: vi.fn(),
    upsertCollaboration: vi.fn(),
    listCreators: () => Promise.resolve([]),
    getCreator: vi.fn(),
    createCreator: vi.fn(),
    updateCreator: vi.fn(),
    removeCreator: vi.fn(),
  },
  dtoToCampaign: (d: Record<string, unknown>) => d,
  dtoToCreator: (d: Record<string, unknown>) => d,
}));

vi.mock('@/api/creatorPerformance', () => ({
  listCreatorPerformance: vi.fn(),
}));

vi.mock('@/components/CollaborationDetail', () => ({
  CollaborationDetail: () => <div>MockCollaborationDetail</div>,
}));

vi.mock('@/editor/components/CreatorMultiSelect', () => ({
  CreatorMultiSelect: () => <div>MockCreatorMultiSelect</div>,
}));

/** 公共路由包装（含 DataManagement 左右布局 + 子路由） */
function renderWithDataLayout(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/data" element={<DataManagement />}>
          <Route path="campaigns" element={<CampaignPage />} />
          <Route path="campaign-collabs" element={<div>CollabPage</div>} />
          <Route path="creators" element={<CreatorPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

const campaign = {
  id: 'camp-x',
  name: 'Campaign X',
  advertiser: 'GlowLab',
  businessLine: 'FT',
  platform: 'TikTok',
  startDate: '2026-01-01',
  endDate: '2026-01-31',
  budget: '$100K',
  status: 'Active',
};

describe('CampaignPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockResolvedValue([]);
    removeMock.mockResolvedValue(undefined);
    importManyMock.mockResolvedValue({ created: 1, updated: 0, skipped: 0 });
    clearMock.mockResolvedValue({ deleted: 0 });
  });

  it('Campaign 列表来自 dataApi.list("campaign")', async () => {
    listMock.mockResolvedValue([{ id: 'camp-x', kind: 'CAMPAIGN', ownerId: 'u', data: campaign, createdAt: '', updatedAt: '' }]);
    renderWithDataLayout('/data/campaigns');
    expect(await screen.findByText('Campaign X')).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledWith('campaign');
  });

  it('空库显示「导入示例数据」按钮;非空显示「清空」', async () => {
    renderWithDataLayout('/data/campaigns');
    expect(await screen.findByText('导入示例数据')).toBeInTheDocument();
    expect(screen.queryByText('清空')).not.toBeInTheDocument();
  });

  it('删除按钮二次确认后调用 dataApi.remove', async () => {
    listMock.mockResolvedValue([{ id: 'camp-x', kind: 'CAMPAIGN', ownerId: 'u', data: campaign, createdAt: '', updatedAt: '' }]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWithDataLayout('/data/campaigns');
    await screen.findByText('Campaign X');
    await userEvent.click(screen.getByText('删除'));
    await waitFor(() => expect(removeMock).toHaveBeenCalledWith('camp-x'));
    confirmSpy.mockRestore();
  });

  it('清空按钮二次确认后调用 dataApi.clear("campaign")', async () => {
    listMock.mockResolvedValue([{ id: 'camp-x', kind: 'CAMPAIGN', ownerId: 'u', data: campaign, createdAt: '', updatedAt: '' }]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWithDataLayout('/data/campaigns');
    await screen.findByText('Campaign X');
    await userEvent.click(screen.getByText('清空'));
    await waitFor(() => expect(clearMock).toHaveBeenCalledWith('campaign'));
    confirmSpy.mockRestore();
  });

  it('删除取消(confirm=false)不调用 dataApi.remove', async () => {
    listMock.mockResolvedValue([{ id: 'camp-x', kind: 'CAMPAIGN', ownerId: 'u', data: campaign, createdAt: '', updatedAt: '' }]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderWithDataLayout('/data/campaigns');
    await screen.findByText('Campaign X');
    await userEvent.click(screen.getByText('删除'));
    expect(removeMock).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('空库点「导入示例数据」→ dataApi.importMany("campaign", <array>)', async () => {
    listMock.mockResolvedValue([]);
    renderWithDataLayout('/data/campaigns');
    const seedBtn = await screen.findByText('导入示例数据');
    await userEvent.click(seedBtn);
    await waitFor(() => expect(importManyMock).toHaveBeenCalledWith('campaign', expect.any(Array)));
  });

  it('「查看达人」跳转到合作列表页', async () => {
    listMock.mockResolvedValue([{ id: 'camp-x', kind: 'CAMPAIGN', ownerId: 'u', data: campaign, createdAt: '', updatedAt: '' }]);
    renderWithDataLayout('/data/campaigns');
    await screen.findByText('Campaign X');
    await userEvent.click(screen.getByText('查看达人'));
    // 路由跳转到合作列表页
    expect(await screen.findByText('CollabPage')).toBeInTheDocument();
  });
});

describe('CreatorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockResolvedValue([]);
    removeMock.mockResolvedValue(undefined);
    importManyMock.mockResolvedValue({ created: 1, updated: 0, skipped: 0 });
  });

  it('达人库行点击 → 打开详情浮窗(KPI 区出现)', async () => {
    const creatorRec = {
      id: 'cre-1', kind: 'CREATOR', ownerId: 'u', createdAt: '', updatedAt: '',
      data: {
        id: 'cre-1', name: 'Mia Chen', handle: '@miaglowup', platform: 'TikTok', tier: 'mega',
        followers: '1.28M', engagement: '8.7%', category: 'Beauty', region: 'US',
        avatar: 'https://x/a.png', metrics: [{ label: 'Avg Reach', value: '2.4M', compare: '' }],
      },
    };
    listMock.mockImplementation((k: string) =>
      k === 'creator' ? Promise.resolve([creatorRec]) : Promise.resolve([]),
    );
    renderWithDataLayout('/data/creators');
    await screen.findByText('Mia Chen');
    await userEvent.click(screen.getByText('Mia Chen'));
    expect(await screen.findByText('频道 KPI')).toBeInTheDocument();
  });

  it('达人库编辑按钮点击不开浮窗(stopPropagation)', async () => {
    const creatorRec = {
      id: 'cre-1', kind: 'CREATOR', ownerId: 'u', createdAt: '', updatedAt: '',
      data: { id: 'cre-1', name: 'Mia Chen', handle: '@m', platform: 'TikTok', tier: 'mega', followers: '1', engagement: '1%', category: 'B', region: 'U', metrics: [] },
    };
    listMock.mockImplementation((k: string) =>
      k === 'creator' ? Promise.resolve([creatorRec]) : Promise.resolve([]),
    );
    renderWithDataLayout('/data/creators');
    await screen.findByText('Mia Chen');
    await userEvent.click(screen.getByText('编辑'));
    expect(screen.queryByText('频道 KPI')).not.toBeInTheDocument();
  });
});

describe('CampaignPage · Stats 列', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    removeMock.mockResolvedValue(undefined);
    importManyMock.mockResolvedValue({ created: 1, updated: 0, skipped: 0 });
  });

  it('按优先级 GMV/ROAS/Spend 展示至多 3 项指标,优先级外的指标不显示', async () => {
    const rec = {
      id: 'camp-y', kind: 'CAMPAIGN', ownerId: 'u', createdAt: '', updatedAt: '',
      data: {
        ...campaign,
        id: 'camp-y',
        name: 'Campaign Y',
        metrics: [
          { label: 'GMV', value: '$1.2M', compare: '+18%' },
          { label: 'Clicks', value: '45K', compare: '+5%' },
          { label: 'ROAS', value: '4.2', compare: '+0.6' },
          { label: 'Spend', value: '$128K', compare: '-5%' },
          { label: 'Conversions', value: '1.2K', compare: '+9%' },
        ],
      },
    };
    listMock.mockResolvedValue([rec]);
    renderWithDataLayout('/data/campaigns');
    await screen.findByText('Campaign Y');
    expect(screen.getByText('GMV $1.2M')).toBeInTheDocument();
    expect(screen.getByText('ROAS 4.2')).toBeInTheDocument();
    expect(screen.getByText('Spend $128K')).toBeInTheDocument();
    expect(screen.queryByText('Clicks 45K')).not.toBeInTheDocument();
    expect(screen.queryByText('Conversions 1.2K')).not.toBeInTheDocument();
  });

  it('无 metrics 的 campaign,Stats 列显示 —', async () => {
    listMock.mockResolvedValue([{ id: 'camp-x', kind: 'CAMPAIGN', ownerId: 'u', data: { ...campaign, owner: 'alex' }, createdAt: '', updatedAt: '' }]);
    renderWithDataLayout('/data/campaigns');
    await screen.findByText('Campaign X');
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText(/GMV|ROAS|Spend/)).not.toBeInTheDocument();
  });
});

describe('CampaignPage · 导入示例数据', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockResolvedValue([]);
    importManyMock.mockResolvedValue({ created: 1, updated: 0, skipped: 0 });
  });

  it('导入示例数据:Campaign 派生 creatorIds', async () => {
    listCampaignCreatorsMock.mockResolvedValue([{ id: 'cre-mia', name: 'Mia', handle: '@m', platform: 'TikTok', tier: 'mega', followers: '1M', engagement: '8%', category: '', region: '', metrics: [] }]);
    renderWithDataLayout('/data/campaigns');
    await screen.findByText('导入示例数据');
    await userEvent.click(screen.getByText('导入示例数据'));
    await waitFor(() => expect(importManyMock).toHaveBeenCalled());
    const [, itemsArg] = importManyMock.mock.calls[0] as [string, unknown[]];
    expect((itemsArg[0] as { creatorIds: string[] }).creatorIds).toEqual(['cre-mia']);
  });
});

describe('DataManagement 侧栏导航', () => {
  it('左侧菜单显示 Campaign / 达人库 / 广告主 / 业务线', async () => {
    renderWithDataLayout('/data/campaigns');
    expect(await screen.findByText('Campaign')).toBeInTheDocument();
    expect(screen.getByText('达人库')).toBeInTheDocument();
    expect(screen.getByText('广告主')).toBeInTheDocument();
    expect(screen.getByText('业务线')).toBeInTheDocument();
  });

  it('Campaign 子菜单可展开，显示「Campaign 列表」和「合作列表」', async () => {
    renderWithDataLayout('/data/campaigns');
    expect(screen.getByText('Campaign 列表')).toBeInTheDocument();
    expect(screen.getByText('合作列表')).toBeInTheDocument();
  });
});
