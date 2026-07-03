import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Projects } from '@/routes/Projects';

const { listMock, createMock, renameMock, removeMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  createMock: vi.fn(),
  renameMock: vi.fn(),
  removeMock: vi.fn(),
}));

vi.mock('@/api/projects', () => ({
  projectsApi: {
    list: () => listMock(),
    create: (n: string, w?: number, h?: number, meta?: unknown) => createMock(n, w, h, meta),
    rename: (id: string, n: string) => renameMock(id, n),
    remove: (id: string) => removeMock(id),
  },
}));

const summary = (id: string, name: string, pageCount = 1) => ({
  id,
  name,
  width: 1280,
  height: 720,
  pageCount,
  createdAt: '',
  updatedAt: '',
});

function renderPage() {
  return render(
    <MemoryRouter>
      <Projects />
    </MemoryRouter>,
  );
}

describe('Projects page', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists projects from the API', async () => {
    listMock.mockResolvedValue([summary('p1', '报告 A'), summary('p2', '报告 B', 2)]);
    renderPage();
    expect(await screen.findByText('报告 A')).toBeInTheDocument();
    expect(screen.getByText('报告 B')).toBeInTheDocument();
  });

  it('filters projects by 业务线 / 场景', async () => {
    const user = userEvent.setup();
    listMock.mockResolvedValue([
      { ...summary('p1', 'A'), meta: { businessLine: 'FT', scenario: 'campaign-report' } },
      { ...summary('p2', 'B'), meta: { businessLine: 'SM', scenario: 'media-kit' } },
      { ...summary('p3', 'C'), meta: { businessLine: 'FT', scenario: 'media-kit' } },
    ]);
    renderPage();
    await screen.findByText('A');
    expect(screen.getByText('3 / 3')).toBeInTheDocument();

    const combos = screen.getAllByRole('combobox'); // [业务线, 场景]
    await user.selectOptions(combos[0], 'FT');
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    expect(screen.queryByText('B')).toBeNull();

    await user.selectOptions(combos[1], 'media-kit');
    expect(screen.getByText('1 / 3')).toBeInTheDocument(); // FT ∩ media-kit = C
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.queryByText('A')).toBeNull();
  });

  it('creates a project via the dialog form', async () => {
    const user = userEvent.setup();
    listMock.mockResolvedValue([]);
    createMock.mockResolvedValue({
      id: 'p3',
      name: 'My Report',
      pages: [],
      width: 1920,
      height: 1080,
      createdAt: '',
      updatedAt: '',
    });
    renderPage();
    await screen.findByText(/还没有项目/);

    // 打开新建项目弹窗
    await user.click(screen.getByRole('button', { name: /新建项目/ }));
    // 填名称
    await user.type(screen.getByPlaceholderText(/例如/), 'My Report');
    // 选 1920×1080 预设并提交
    await user.click(screen.getByText('1920 × 1080'));
    await user.click(screen.getByRole('button', { name: '创建' }));

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    const [n, w, h, meta] = createMock.mock.calls[0];
    expect(n).toBe('My Report');
    expect(w).toBe(1920);
    expect(h).toBe(1080);
    expect(meta).toBeDefined();
  });

  it('passes meta (业务线/场景/campaign 信息) when filled', async () => {
    const user = userEvent.setup();
    listMock.mockResolvedValue([]);
    createMock.mockResolvedValue({
      id: 'p4',
      name: 'X',
      pages: [],
      width: 1280,
      height: 720,
      createdAt: '',
      updatedAt: '',
    });
    renderPage();
    await screen.findByText(/还没有项目/);
    await user.click(screen.getByRole('button', { name: /新建项目/ }));
    await user.type(screen.getByPlaceholderText(/例如/), 'Campaign 周报');

    // 业务线 FT、场景 Campaign 报告（出现「报告类型」子选择）
    const combos = screen.getAllByRole('combobox');
    await user.selectOptions(combos[0], 'FT'); // 业务线
    await user.selectOptions(combos[3], 'campaign-report'); // 场景
    await user.click(screen.getByRole('button', { name: '创建' }));

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    const meta = createMock.mock.calls[0][3];
    expect(meta.businessLine).toBe('FT');
    expect(meta.scenario).toBe('campaign-report');
    expect(meta.scenarioSub).toBe('weekly');
    expect(meta.campaignInfo).toBeDefined();
    expect(meta.campaignInfo.platform).toBeTruthy();
  });

  it('renames a project inline', async () => {
    const user = userEvent.setup();
    listMock.mockResolvedValue([summary('p1', '报告 A')]);
    renameMock.mockResolvedValue(summary('p1', '改名后'));
    renderPage();

    await screen.findByText('报告 A');
    await user.click(screen.getByRole('button', { name: '改名' }));
    const input = screen.getByDisplayValue('报告 A');
    await user.clear(input);
    await user.type(input, '改名后');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(renameMock).toHaveBeenCalledWith('p1', '改名后'));
  });

  it('deletes a project after confirming', async () => {
    const user = userEvent.setup();
    listMock.mockResolvedValue([summary('p1', '报告 A')]);
    removeMock.mockResolvedValue(undefined);
    renderPage();

    await screen.findByText('报告 A');
    await user.click(screen.getByRole('button', { name: '删除' }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: '删除' }));

    await waitFor(() => expect(removeMock).toHaveBeenCalledWith('p1'));
  });
});
