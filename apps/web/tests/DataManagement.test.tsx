import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Routes, Route } from 'react-router-dom';
import type { Campaign, Creator } from '@mediakit/shared';
import { CampaignPage } from '@/routes/CampaignPage';
import { CreatorPage } from '@/routes/CreatorPage';
import { DataManagement } from '@/routes/DataManagement';

const { listMock, removeMock, importManyMock, updateMock, listCampaignsMock, listCreatorsMock, campaignsRemoveMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  removeMock: vi.fn(),
  importManyMock: vi.fn(),
  updateMock: vi.fn(),
  listCampaignsMock: vi.fn(),
  listCreatorsMock: vi.fn(),
  campaignsRemoveMock: vi.fn(),
}));

// CRUD/导入仍走 dataApi(RecordFormModal 兼容)
vi.mock('@/api/dataLibrary', () => ({
  dataApi: {
    list: (k: string) => listMock(k),
    remove: (id: string) => removeMock(id),
    importMany: (k: string, items: unknown[]) => importManyMock(k, items),
    create: vi.fn(),
    update: (id: string, data: unknown) => updateMock(id, data),
    get: vi.fn(),
    clear: vi.fn(),
  },
}));

// 列表数据走 DB 表:Campaign/Creator DTO 直出
vi.mock('@/api/campaigns', () => ({
  listCampaigns: () => listCampaignsMock(),
}));
vi.mock('@/api/creators', () => ({
  listCampaignCollaborators: vi.fn(),
  listCreators: () => listCreatorsMock(),
  listCampaignCreators: vi.fn(),
}));

vi.mock('@/api/campaignsApi', () => ({
  campaignsApi: {
    list: () => Promise.resolve([]),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: (id: string) => campaignsRemoveMock(id),
    upsertLink: vi.fn(),
    updateLink: vi.fn(),
    listLinks: (_id: string) => Promise.resolve([]),
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

// CreatorDetailDrawer 需要的 lookup 数据 mock
vi.mock('@/api/lookup', () => ({
  lookupApi: {
    listBusinessLines: vi.fn().mockResolvedValue([
      { id: 'bl-ft', code: 'FT', name: 'Fanstoshop' },
      { id: 'bl-sm', code: 'SM', name: 'SmileKOLs' },
    ]),
    listAdvertisers: vi.fn().mockResolvedValue([]),
    listMerchants: vi.fn().mockResolvedValue([]),
  },
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

const campaign: Campaign = {
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

/** 完整 Creator fixture(含 metrics → 详情抽屉显示「频道 KPI」区)。 */
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
  avatar: 'https://x/a.png',
  metrics: [{ label: 'Avg Reach', value: '2.4M', compare: '' }],
};

describe('CampaignPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    removeMock.mockResolvedValue(undefined);
    importManyMock.mockResolvedValue({ created: 1, updated: 0, skipped: 0 });
    listCampaignsMock.mockResolvedValue([]);
    listCreatorsMock.mockResolvedValue([]);
  });

  it('Campaign 列表来自 DB Campaign 表(listCampaigns)', async () => {
    listCampaignsMock.mockResolvedValue([campaign]);
    renderWithDataLayout('/data/campaigns');
    expect(await screen.findByText('Campaign X')).toBeInTheDocument();
    expect(listCampaignsMock).toHaveBeenCalled();
  });

  it('空库显示 No data 空态;工具栏提供 导入 CSV/JSON/下载模板/新增', async () => {
    renderWithDataLayout('/data/campaigns');
    expect(await screen.findByText('No data')).toBeInTheDocument();
    expect(screen.getByText('导入 CSV/XLSX')).toBeInTheDocument();
    expect(screen.getByText('导入 JSON')).toBeInTheDocument();
    expect(screen.getByText('下载模板')).toBeInTheDocument();
    expect(screen.getByText('新增')).toBeInTheDocument();
  });

  it('删除按钮二次确认后调用 campaignsApi.remove(新表优先)', async () => {
    campaignsRemoveMock.mockResolvedValue(undefined);
    listCampaignsMock.mockResolvedValue([campaign]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWithDataLayout('/data/campaigns');
    await screen.findByText('Campaign X');
    await userEvent.click(screen.getByText('删除'));
    await waitFor(() => expect(campaignsRemoveMock).toHaveBeenCalledWith('camp-x'));
    expect(removeMock).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('删除取消(confirm=false)不调用 dataApi.remove', async () => {
    listCampaignsMock.mockResolvedValue([campaign]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderWithDataLayout('/data/campaigns');
    await screen.findByText('Campaign X');
    await userEvent.click(screen.getByText('删除'));
    expect(removeMock).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('「查看数据」跳转到合作列表页', async () => {
    listCampaignsMock.mockResolvedValue([campaign]);
    renderWithDataLayout('/data/campaigns');
    await screen.findByText('Campaign X');
    await userEvent.click(screen.getByText('查看数据'));
    // 路由跳转到合作列表页
    expect(await screen.findByText('CollabPage')).toBeInTheDocument();
  });
});

describe('CreatorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    removeMock.mockResolvedValue(undefined);
    importManyMock.mockResolvedValue({ created: 1, updated: 0, skipped: 0 });
    listCampaignsMock.mockResolvedValue([]);
    listCreatorsMock.mockResolvedValue([]);
  });

  it('达人库行点击 → 打开详情浮窗(KPI 区出现)', async () => {
    listCreatorsMock.mockResolvedValue([creator]);
    renderWithDataLayout('/data/creators');
    await screen.findByText('Mia Chen');
    await userEvent.click(screen.getByText('Mia Chen'));
    expect(await screen.findByText('频道 KPI')).toBeInTheDocument();
  });

  it('达人库编辑按钮点击不开浮窗(stopPropagation)', async () => {
    listCreatorsMock.mockResolvedValue([{ ...creator, metrics: [] }]);
    renderWithDataLayout('/data/creators');
    await screen.findByText('Mia Chen');
    await userEvent.click(screen.getByText('编辑'));
    expect(screen.queryByText('频道 KPI')).not.toBeInTheDocument();
  });
});

// Stats 列已于审计 #16 移除（无真实数据源、7 行全「—」）；相关断言随之删除。
