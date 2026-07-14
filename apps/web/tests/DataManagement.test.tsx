import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { DataManagement } from '@/routes/DataManagement';

const { listMock, removeMock, importManyMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  removeMock: vi.fn(),
  importManyMock: vi.fn(),
}));

vi.mock('@/api/dataLibrary', () => ({
  dataApi: {
    list: (k: string) => listMock(k),
    remove: (id: string) => removeMock(id),
    importMany: (k: string, items: unknown[]) => importManyMock(k, items),
    create: vi.fn(),
    update: vi.fn(),
    get: vi.fn(),
    clear: vi.fn(),
  },
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
});
