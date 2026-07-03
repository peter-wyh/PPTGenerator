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
    create: (n: string, w?: number, h?: number) => createMock(n, w, h),
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

    await waitFor(() =>
      expect(createMock).toHaveBeenCalledWith('My Report', 1920, 1080),
    );
  });

  it('renames a project inline', async () => {
    const user = userEvent.setup();
    listMock.mockResolvedValue([summary('p1', '报告 A')]);
    renameMock.mockResolvedValue(summary('p1', '改名后'));
    renderPage();

    const item = (await screen.findAllByRole('listitem'))[0];
    await user.click(within(item).getByRole('button', { name: '改名' }));
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

    const item = (await screen.findAllByRole('listitem'))[0];
    await user.click(within(item).getByRole('button', { name: '删除' }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: '删除' }));

    await waitFor(() => expect(removeMock).toHaveBeenCalledWith('p1'));
  });
});
