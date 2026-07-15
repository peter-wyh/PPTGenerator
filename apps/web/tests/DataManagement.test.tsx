import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { DataManagement } from '@/routes/DataManagement';

const { listMock, removeMock, importManyMock, clearMock, updateMock, collaboratorsMock, listCreatorsMock, listCampaignCreatorsMock, perfMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  removeMock: vi.fn(),
  importManyMock: vi.fn(),
  clearMock: vi.fn(),
  updateMock: vi.fn(),
  collaboratorsMock: vi.fn(),
  listCreatorsMock: vi.fn(),
  listCampaignCreatorsMock: vi.fn(),
  perfMock: vi.fn(),
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

vi.mock('@/api/creatorPerformance', () => ({
  listCreatorPerformance: (id: string) => perfMock(id),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <DataManagement />
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

describe('DataManagement page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockResolvedValue([]);
    removeMock.mockResolvedValue(undefined);
    importManyMock.mockResolvedValue({ created: 1, updated: 0, skipped: 0 });
    clearMock.mockResolvedValue({ deleted: 0 });
  });

  it('渲染标题 + 两个 Tab;Campaign Tab 列表来自 dataApi.list("campaign")', async () => {
    listMock.mockResolvedValue([{ id: 'camp-x', kind: 'CAMPAIGN', ownerId: 'u', data: campaign, createdAt: '', updatedAt: '' }]);
    renderPage();
    expect(await screen.findByText('Campaign X')).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledWith('campaign');
    expect(screen.getByText('达人库')).toBeInTheDocument();
  });

  it('空库显示「导入示例数据」按钮;非空显示「清空」', async () => {
    renderPage();
    expect(await screen.findByText('导入示例数据')).toBeInTheDocument();
    expect(screen.queryByText('清空')).not.toBeInTheDocument();
  });

  it('切到达人库 Tab → list("creator")', async () => {
    listMock.mockResolvedValue([]);
    renderPage();
    await screen.findByText('导入示例数据');
    await userEvent.click(screen.getByText('达人库'));
    await waitFor(() => expect(listMock).toHaveBeenCalledWith('creator'));
  });

  it('删除按钮二次确认后调用 dataApi.remove', async () => {
    listMock.mockResolvedValue([{ id: 'camp-x', kind: 'CAMPAIGN', ownerId: 'u', data: campaign, createdAt: '', updatedAt: '' }]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    await screen.findByText('Campaign X');
    await userEvent.click(screen.getByText('删除'));
    await waitFor(() => expect(removeMock).toHaveBeenCalledWith('camp-x'));
    confirmSpy.mockRestore();
  });

  it('清空按钮二次确认后调用 dataApi.clear("campaign")', async () => {
    listMock.mockResolvedValue([{ id: 'camp-x', kind: 'CAMPAIGN', ownerId: 'u', data: campaign, createdAt: '', updatedAt: '' }]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    await screen.findByText('Campaign X');
    await userEvent.click(screen.getByText('清空'));
    await waitFor(() => expect(clearMock).toHaveBeenCalledWith('campaign'));
    confirmSpy.mockRestore();
  });

  it('删除取消(confirm=false)不调用 dataApi.remove', async () => {
    listMock.mockResolvedValue([{ id: 'camp-x', kind: 'CAMPAIGN', ownerId: 'u', data: campaign, createdAt: '', updatedAt: '' }]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPage();
    await screen.findByText('Campaign X');
    await userEvent.click(screen.getByText('删除'));
    expect(removeMock).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('空库点「导入示例数据」→ dataApi.importMany("campaign", <array>)', async () => {
    listMock.mockResolvedValue([]);
    renderPage();
    const seedBtn = await screen.findByText('导入示例数据');
    await userEvent.click(seedBtn);
    await waitFor(() => expect(importManyMock).toHaveBeenCalledWith('campaign', expect.any(Array)));
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
    renderPage();
    await userEvent.click(screen.getByText('达人库'));
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
    renderPage();
    await userEvent.click(screen.getByText('达人库'));
    await screen.findByText('Mia Chen');
    await userEvent.click(screen.getByText('编辑'));
    expect(screen.queryByText('频道 KPI')).not.toBeInTheDocument();
  });
});

describe('DataManagement · Campaign drill-down', () => {
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

  it('展开 campaign 行 → 调 listCampaignCollaborators 并渲染合作达人', async () => {
    collaboratorsMock.mockResolvedValue([{ id: 'cre-mia', name: 'Mia', handle: '@mia', platform: 'TikTok', tier: 'mega', followers: '1M', engagement: '8%', category: 'Beauty', region: 'US', metrics: [] }]);
    renderPage();
    await screen.findByText('Campaign X');
    await userEvent.click(screen.getByRole('button', { name: /Campaign X/ }));
    await waitFor(() => expect(collaboratorsMock).toHaveBeenCalledWith('camp-x'));
    expect(await screen.findByText('@mia')).toBeInTheDocument();
  });

  it('管理合作达人:勾选 + 保存 → dataApi.update 带 creatorIds(整记录重写)', async () => {
    listCreatorsMock.mockResolvedValue([{ id: 'cre-mia', name: 'Mia', handle: '@mia', platform: 'TikTok', tier: 'mega', followers: '1M', engagement: '8%', category: 'Beauty', region: 'US', metrics: [] }]);
    renderPage();
    await screen.findByText('Campaign X');
    await userEvent.click(screen.getByRole('button', { name: /Campaign X/ }));
    await screen.findByText('管理合作达人');
    await userEvent.click(screen.getByText('管理合作达人'));
    await userEvent.click(screen.getByLabelText(/Mia/));
    await userEvent.click(screen.getByText('保存'));
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith('camp-x', { ...campaign, creatorIds: ['cre-mia'] }));
  });

  it('导入示例数据:Campaign 派生 creatorIds', async () => {
    listMock.mockResolvedValue([]); // 空库才显示「导入示例数据」
    listCampaignCreatorsMock.mockResolvedValue([{ id: 'cre-mia', name: 'Mia', handle: '@m', platform: 'TikTok', tier: 'mega', followers: '1M', engagement: '8%', category: '', region: '', metrics: [] }]);
    renderPage();
    await screen.findByText('导入示例数据');
    await userEvent.click(screen.getByText('导入示例数据'));
    await waitFor(() => expect(importManyMock).toHaveBeenCalled());
    const [, itemsArg] = importManyMock.mock.calls[0] as [string, unknown[]];
    expect((itemsArg[0] as { creatorIds: string[] }).creatorIds).toEqual(['cre-mia']);
  });
});
