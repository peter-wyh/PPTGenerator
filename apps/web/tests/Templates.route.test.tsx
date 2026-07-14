import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Templates } from '@/routes/Templates';

const authState = { user: { id: 'u1', role: 'ADMIN', email: 'a@x.com', name: 'A' } };
vi.mock('@/stores/auth', () => ({
  useAuthStore: (selector: (s: typeof authState) => unknown) => selector(authState),
}));

const listMock = vi.fn();
const setDefaultMock = vi.fn(async (_id: string, _v: boolean) => ({}));
vi.mock('@/api/templates', () => ({
  templatesApi: {
    list: (...args: unknown[]) => listMock(...args),
    create: async () => ({ id: 't1' }),
    update: async () => ({}),
    remove: async () => ({}),
    duplicate: async () => ({}),
    setStatus: async () => ({}),
    setDefault: (...args: unknown[]) => setDefaultMock(...(args as [string, boolean])),
  },
}));

function renderIt() {
  return render(
    <MemoryRouter>
      <Templates />
    </MemoryRouter>,
  );
}

describe('Templates 路由', () => {
  beforeEach(() => {
    listMock.mockReset();
    setDefaultMock.mockClear();
  });

  it('渲染模板行,已发布默认模板显示「默认」徽标', async () => {
    listMock.mockResolvedValue([
      {
        id: 't1', name: 'FT周报模板', width: 1280, height: 720, pageCount: 3, status: 'PUBLISHED',
        meta: { businessLine: 'FT', scenario: 'campaign-report', templateType: 'weekly', isDefault: true },
        ownerId: 'u1', createdAt: '2026-07-01', updatedAt: '2026-07-01',
      },
    ]);
    renderIt();
    await waitFor(() => expect(screen.getByText('FT周报模板')).toBeInTheDocument());
    expect(screen.getByText('默认')).toBeInTheDocument();
  });

  it('点「设为默认」调用 templatesApi.setDefault(id, true)', async () => {
    const user = userEvent.setup();
    listMock.mockResolvedValue([
      {
        id: 't1', name: 'FT周报模板', width: 1280, height: 720, pageCount: 3, status: 'PUBLISHED',
        meta: { businessLine: 'FT', scenario: 'campaign-report', templateType: 'weekly' },
        ownerId: 'u1', createdAt: '2026-07-01', updatedAt: '2026-07-01',
      },
    ]);
    renderIt();
    await waitFor(() => expect(screen.getByText('设为默认')).toBeInTheDocument());
    await user.click(screen.getByText('设为默认'));
    await waitFor(() => expect(setDefaultMock).toHaveBeenCalledWith('t1', true));
  });

  it('已是默认时点「取消默认」调用 templatesApi.setDefault(id, false)', async () => {
    const user = userEvent.setup();
    listMock.mockResolvedValue([
      {
        id: 't1', name: 'FT周报模板', width: 1280, height: 720, pageCount: 3, status: 'PUBLISHED',
        meta: { businessLine: 'FT', scenario: 'campaign-report', templateType: 'weekly', isDefault: true },
        ownerId: 'u1', createdAt: '2026-07-01', updatedAt: '2026-07-01',
      },
    ]);
    renderIt();
    await waitFor(() => expect(screen.getByText('取消默认')).toBeInTheDocument());
    await user.click(screen.getByText('取消默认'));
    await waitFor(() => expect(setDefaultMock).toHaveBeenCalledWith('t1', false));
  });
});
