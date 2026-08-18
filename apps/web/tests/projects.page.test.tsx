import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Projects } from '@/routes/Projects';

const { listMock, createMock, renameMock, removeMock, updateMock, duplicateMock, getHtmlMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  createMock: vi.fn(),
  renameMock: vi.fn(),
  removeMock: vi.fn(),
  updateMock: vi.fn(),
  duplicateMock: vi.fn(),
  getHtmlMock: vi.fn(),
}));

vi.mock('@/api/projects', () => ({
  projectsApi: {
    list: () => listMock(),
    create: (n: string, w?: number, h?: number, meta?: unknown) => createMock(n, w, h, meta),
    rename: (id: string, n: string) => renameMock(id, n),
    update: (id: string, patch: unknown) => updateMock(id, patch),
    duplicate: (id: string) => duplicateMock(id),
    remove: (id: string) => removeMock(id),
    getHtml: (id: string) => getHtmlMock(id),
  },
}));

const { listCampaignsMock } = vi.hoisted(() => ({ listCampaignsMock: vi.fn() }));
vi.mock('@/api/campaigns', () => ({
  listCampaigns: () => listCampaignsMock(),
  getCampaign: vi.fn(),
}));

// 业务线/查找表数据来自数据库(lookupApi),测试环境 mock
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

const summary = (id: string, name: string, pageCount = 1, meta?: Record<string, unknown>) => ({
  id,
  name,
  width: 1280,
  height: 720,
  pageCount,
  createdAt: '',
  updatedAt: '',
  ...(meta ? { meta } : {}),
});

function renderPage() {
  return render(
    <MemoryRouter>
      <Projects />
    </MemoryRouter>,
  );
}

describe('Projects page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listCampaignsMock.mockResolvedValue([
      {
        id: 'camp-x',
        name: 'Campaign X',
        advertiser: 'AdX',
        businessLine: 'FT',
        platform: 'TikTok',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        budget: '$100K',
      },
    ]);
  });

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
    expect(screen.getByText(/3 \/ 3 个PPT 多页报告/)).toBeInTheDocument();

    const combos = screen.getAllByRole('combobox'); // [业务线, 场景]
    await user.selectOptions(combos[0], 'FT');
    expect(screen.getByText(/2 \/ 3 个PPT 多页报告/)).toBeInTheDocument();
    expect(screen.queryByText('B')).toBeNull();

    await user.selectOptions(combos[1], 'media-kit');
    expect(screen.getByText(/1 \/ 3 个PPT 多页报告/)).toBeInTheDocument(); // FT ∩ media-kit = C
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
    await screen.findByText(/还没有报告/);

    // 打开新建项目弹窗
    await user.click(screen.getByRole('button', { name: /新建报告/ }));
    // 填名称
    await user.type(screen.getByPlaceholderText(/例如/), 'My Report');
    // 选业务线(顶层必填;选项异步加载自数据库)
    await screen.findByText(/FT · Fanstoshop/);
    await user.selectOptions(screen.getByRole('combobox', { name: '业务线' }), 'FT');
    // PPT 多页模式默认 16:9(1920×1080):显式选「PPT 多页」再提交
    // (左侧类型菜单也有同名文本,须在弹窗内查找)
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByText('PPT 多页'));
    await user.click(screen.getByRole('button', { name: '创建' }));

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    const [n, w, h, meta] = createMock.mock.calls[0];
    expect(n).toBe('My Report');
    expect(w).toBe(1920);
    expect(h).toBe(1080);
    expect(meta).toBeDefined();
  });

  it('passes meta (场景驱动 + campaign 选择联动填充)', async () => {
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
    await screen.findByText(/还没有报告/);
    await user.click(screen.getByRole('button', { name: /新建报告/ }));
    await user.type(screen.getByPlaceholderText(/例如/), 'Campaign 周报');

    // 1) 先选场景 Campaign 报告 → campaign 列表懒加载
    await user.selectOptions(screen.getByRole('combobox', { name: '场景' }), 'campaign-report');
    // 业务线决定 campaign 过滤(camp-x 属 FT;选项异步加载自数据库)
    await screen.findByText(/FT · Fanstoshop/);
    await user.selectOptions(screen.getByRole('combobox', { name: '业务线' }), 'FT');
    await screen.findByText('Campaign X · AdX');

    // 2) 选择具体 campaign（联动填充广告主/业务线/campaign 信息）
    await user.selectOptions(screen.getByRole('combobox', { name: /Campaign/ }), 'camp-x');

    await user.click(screen.getByRole('button', { name: '创建' }));

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    const meta = createMock.mock.calls[0][3];
    expect(meta.scenario).toBe('campaign-report');
    expect(meta.scenarioSub).toBe('weekly');
    expect(meta.campaignId).toBe('camp-x');
    // 联动自上游 campaign：
    expect(meta.advertiser).toBe('AdX');
    expect(meta.businessLine).toBe('FT');
    expect(meta.campaignInfo).toMatchObject({ campaignName: 'Campaign X', platform: 'TikTok', budget: '$100K' });
  });

  it('edits a project via the edit dialog', async () => {
    const user = userEvent.setup();
    listMock.mockResolvedValue([summary('p1', '报告 A', 1, { businessLine: 'FT' })]);
    updateMock.mockResolvedValue({
      id: 'p1',
      name: '改名后',
      pages: [],
      width: 1280,
      height: 720,
      createdAt: '',
      updatedAt: '',
    });
    renderPage();

    await screen.findByText('报告 A');
    await user.click(screen.getByRole('button', { name: '编辑' }));

    // 名称预填，改为「改名后」
    const nameInput = screen.getByDisplayValue('报告 A');
    await user.clear(nameInput);
    await user.type(nameInput, '改名后');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith('p1', expect.objectContaining({ name: '改名后' })),
    );
    // 列表项名称已更新。
    await waitFor(() => expect(screen.getByText('改名后')).toBeInTheDocument());
  });

  it('duplicates a project (calls duplicate then refreshes list)', async () => {
    const user = userEvent.setup();
    listMock.mockResolvedValueOnce([summary('p1', '报告 A')]).mockResolvedValueOnce([
      summary('p1', '报告 A'),
      summary('p2', '报告 A 副本'),
    ]);
    duplicateMock.mockResolvedValue({ id: 'p2', name: '报告 A 副本', pages: [] });
    renderPage();

    await screen.findByText('报告 A');
    await user.click(screen.getByRole('button', { name: '复制' }));
    // 复制按钮现打开 DuplicateProjectDialog(源无周期 → 直接「复制」确认)
    await screen.findByText('复制报告');
    const copyBtns = screen.getAllByRole('button', { name: '复制' });
    await user.click(copyBtns[copyBtns.length - 1]);
    await waitFor(() => expect(duplicateMock).toHaveBeenCalledWith('p1'));
    // 复制后刷新列表，副本出现。
    await waitFor(() => expect(screen.getByText('报告 A 副本')).toBeInTheDocument());
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

  it('ai-html 报告: HTML ▾ 菜单可预览/下载/复制源码(复制走 getHtml+clipboard)', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    getHtmlMock.mockResolvedValue({
      id: 'p1',
      name: 'AI 报告',
      html: '<p>HTML</p>',
      updatedAt: '',
    });
    listMock.mockResolvedValue([
      summary('p1', 'AI 报告', 0, { styleType: 'ai-html', businessLine: 'FT' }),
    ]);
    renderPage();
    // ai-html 报告在「AI HTML」菜单下(左侧类型导航,不再有 Tab)
    await user.click(await screen.findByRole('button', { name: /AI HTML/ }));
    await screen.findByText('AI 报告');

    await user.click(screen.getByRole('button', { name: /HTML ▾/ }));
    const copyBtn = await screen.findByRole('button', { name: '复制源码' });
    await user.click(copyBtn);

    await waitFor(() => expect(getHtmlMock).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('<p>HTML</p>'));
  });

  it('建报告遇重名 400 → 在弹窗回显后端文案', async () => {
    const user = userEvent.setup();
    listMock.mockResolvedValue([]);
    createMock.mockRejectedValueOnce({
      response: { data: { error: { message: '已存在同名报告「X」，请使用其他名称' } } },
    });
    renderPage();
    await screen.findByText(/还没有报告/);

    await user.click(screen.getByRole('button', { name: /新建报告/ }));
    await user.type(screen.getByPlaceholderText(/例如/), 'X');
    await screen.findByText(/FT · Fanstoshop/);
    await user.selectOptions(screen.getByRole('combobox', { name: '业务线' }), 'FT');
    // PPT 多页默认 16:9(1920×1080),直接提交
    await user.click(screen.getByRole('button', { name: '创建' }));

    await waitFor(() =>
      expect(screen.getByText('已存在同名报告「X」，请使用其他名称')).toBeInTheDocument(),
    );
  });
});
