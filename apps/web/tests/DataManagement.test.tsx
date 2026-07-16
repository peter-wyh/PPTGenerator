import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Routes, Route } from 'react-router-dom';
import { CampaignPage } from '@/routes/CampaignPage';
import { CreatorPage } from '@/routes/CreatorPage';
import { DataManagement } from '@/routes/DataManagement';

const { listMock, removeMock, importManyMock, clearMock, updateMock, collaboratorsMock, listCreatorsMock, listCampaignCreatorsMock, perfMock, upsertLinkMock, listLinksMock, removeLinkMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  removeMock: vi.fn(),
  importManyMock: vi.fn(),
  clearMock: vi.fn(),
  updateMock: vi.fn(),
  collaboratorsMock: vi.fn(),
  listCreatorsMock: vi.fn(),
  listCampaignCreatorsMock: vi.fn(),
  perfMock: vi.fn(),
  upsertLinkMock: vi.fn(),
  listLinksMock: vi.fn(),
  removeLinkMock: vi.fn(),
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
  listCampaignCollaborators: (id: string) => collaboratorsMock(id),
  listCreators: () => listCreatorsMock(),
  listCampaignCreators: (id: string) => listCampaignCreatorsMock(id),
}));

vi.mock('@/api/campaignsApi', () => ({
  campaignsApi: {
    upsertLink: (data: unknown) => upsertLinkMock(data),
    listLinks: (id: string) => listLinksMock(id),
    removeLink: (id: string) => removeLinkMock(id),
  },
}));

vi.mock('@/api/creatorPerformance', () => ({
  listCreatorPerformance: (id: string) => perfMock(id),
}));

/** 渲染 CampaignPage（需要路由上下文） */
function renderCampaignPage() {
  return render(
    <MemoryRouter initialEntries={['/data/campaigns']}>
      <Routes>
        <Route path="/data" element={<DataManagement />}>
          <Route path="campaigns" element={<CampaignPage />} />
          <Route path="creators" element={<CreatorPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

/** 渲染 CreatorPage（需要路由上下文） */
function renderCreatorPage() {
  return render(
    <MemoryRouter initialEntries={['/data/creators']}>
      <Routes>
        <Route path="/data" element={<DataManagement />}>
          <Route path="campaigns" element={<CampaignPage />} />
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
    renderCampaignPage();
    expect(await screen.findByText('Campaign X')).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledWith('campaign');
  });

  it('空库显示「导入示例数据」按钮;非空显示「清空」', async () => {
    renderCampaignPage();
    expect(await screen.findByText('导入示例数据')).toBeInTheDocument();
    expect(screen.queryByText('清空')).not.toBeInTheDocument();
  });

  it('删除按钮二次确认后调用 dataApi.remove', async () => {
    listMock.mockResolvedValue([{ id: 'camp-x', kind: 'CAMPAIGN', ownerId: 'u', data: campaign, createdAt: '', updatedAt: '' }]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderCampaignPage();
    await screen.findByText('Campaign X');
    await userEvent.click(screen.getByText('删除'));
    await waitFor(() => expect(removeMock).toHaveBeenCalledWith('camp-x'));
    confirmSpy.mockRestore();
  });

  it('清空按钮二次确认后调用 dataApi.clear("campaign")', async () => {
    listMock.mockResolvedValue([{ id: 'camp-x', kind: 'CAMPAIGN', ownerId: 'u', data: campaign, createdAt: '', updatedAt: '' }]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderCampaignPage();
    await screen.findByText('Campaign X');
    await userEvent.click(screen.getByText('清空'));
    await waitFor(() => expect(clearMock).toHaveBeenCalledWith('campaign'));
    confirmSpy.mockRestore();
  });

  it('删除取消(confirm=false)不调用 dataApi.remove', async () => {
    listMock.mockResolvedValue([{ id: 'camp-x', kind: 'CAMPAIGN', ownerId: 'u', data: campaign, createdAt: '', updatedAt: '' }]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderCampaignPage();
    await screen.findByText('Campaign X');
    await userEvent.click(screen.getByText('删除'));
    expect(removeMock).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('空库点「导入示例数据」→ dataApi.importMany("campaign", <array>)', async () => {
    listMock.mockResolvedValue([]);
    renderCampaignPage();
    const seedBtn = await screen.findByText('导入示例数据');
    await userEvent.click(seedBtn);
    await waitFor(() => expect(importManyMock).toHaveBeenCalledWith('campaign', expect.any(Array)));
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
    renderCreatorPage();
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
    renderCreatorPage();
    await screen.findByText('Mia Chen');
    await userEvent.click(screen.getByText('编辑'));
    expect(screen.queryByText('频道 KPI')).not.toBeInTheDocument();
  });
});

describe('CampaignPage · drill-down', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockResolvedValue([{ id: 'camp-x', kind: 'CAMPAIGN', ownerId: 'u', data: campaign, createdAt: '', updatedAt: '' }]);
    removeMock.mockResolvedValue(undefined);
    importManyMock.mockResolvedValue({ created: 1, updated: 0, skipped: 0 });
    updateMock.mockResolvedValue({ id: 'camp-x' });
    collaboratorsMock.mockResolvedValue([]);
    listCreatorsMock.mockResolvedValue([]);
    listCampaignCreatorsMock.mockResolvedValue([]);
    perfMock.mockResolvedValue([]);
  });

  it('点「查看达人」打开浮窗 → 调 listCampaignCollaborators 并渲染合作达人', async () => {
    collaboratorsMock.mockResolvedValue([{ id: 'cre-mia', name: 'Mia', handle: '@mia', platform: 'TikTok', tier: 'mega', followers: '1M', engagement: '8%', category: 'Beauty', region: 'US', metrics: [] }]);
    renderCampaignPage();
    await screen.findByText('Campaign X');
    await userEvent.click(screen.getByRole('button', { name: '查看达人' }));
    await waitFor(() => expect(collaboratorsMock).toHaveBeenCalledWith('camp-x'));
    expect(await screen.findByText('@mia')).toBeInTheDocument();
  });

  it('查看达人浮窗:✕ 关闭后达人子表消失', async () => {
    collaboratorsMock.mockResolvedValue([{ id: 'cre-mia', name: 'Mia', handle: '@mia', platform: 'TikTok', tier: 'mega', followers: '1M', engagement: '8%', category: 'Beauty', region: 'US', metrics: [] }]);
    renderCampaignPage();
    await screen.findByText('Campaign X');
    await userEvent.click(screen.getByRole('button', { name: '查看达人' }));
    expect(await screen.findByText('@mia')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '关闭' }));
    await waitFor(() => expect(screen.queryByText('@mia')).not.toBeInTheDocument());
  });

  it('管理合作达人:勾选 + 保存 → campaignsApi.upsertLink（中间表 diff 写入）', async () => {
    listCreatorsMock.mockResolvedValue([{ id: 'cre-mia', name: 'Mia', handle: '@mia', platform: 'TikTok', tier: 'mega', followers: '1M', engagement: '8%', category: 'Beauty', region: 'US', metrics: [] }]);
    upsertLinkMock.mockResolvedValue({ id: 'link-1', campaignId: 'camp-x', creatorId: 'cre-mia' });
    renderCampaignPage();
    await screen.findByText('Campaign X');
    await userEvent.click(screen.getByRole('button', { name: '查看达人' }));
    await screen.findByText('管理合作达人');
    await userEvent.click(screen.getByText('管理合作达人'));
    await userEvent.click(screen.getByLabelText(/Mia/));
    await userEvent.click(screen.getByText('保存'));
    await waitFor(() => expect(upsertLinkMock).toHaveBeenCalledWith({ campaignId: 'camp-x', creatorId: 'cre-mia' }));
  });

  it('导入示例数据:Campaign 派生 creatorIds', async () => {
    listMock.mockResolvedValue([]); // 空库才显示「导入示例数据」
    listCampaignCreatorsMock.mockResolvedValue([{ id: 'cre-mia', name: 'Mia', handle: '@m', platform: 'TikTok', tier: 'mega', followers: '1M', engagement: '8%', category: '', region: '', metrics: [] }]);
    renderCampaignPage();
    await screen.findByText('导入示例数据');
    await userEvent.click(screen.getByText('导入示例数据'));
    await waitFor(() => expect(importManyMock).toHaveBeenCalled());
    const [, itemsArg] = importManyMock.mock.calls[0] as [string, unknown[]];
    expect((itemsArg[0] as { creatorIds: string[] }).creatorIds).toEqual(['cre-mia']);
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
    renderCampaignPage();
    await screen.findByText('Campaign Y');
    expect(screen.getByText('GMV $1.2M')).toBeInTheDocument();
    expect(screen.getByText('ROAS 4.2')).toBeInTheDocument();
    expect(screen.getByText('Spend $128K')).toBeInTheDocument();
    // 优先级外的 Clicks / Conversions 不展示
    expect(screen.queryByText('Clicks 45K')).not.toBeInTheDocument();
    expect(screen.queryByText('Conversions 1.2K')).not.toBeInTheDocument();
  });

  it('无 metrics 的 campaign,Stats 列显示 —', async () => {
    listMock.mockResolvedValue([{ id: 'camp-x', kind: 'CAMPAIGN', ownerId: 'u', data: { ...campaign, owner: 'alex' }, createdAt: '', updatedAt: '' }]);
    renderCampaignPage();
    await screen.findByText('Campaign X');
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText(/GMV|ROAS|Spend/)).not.toBeInTheDocument();
  });
});
