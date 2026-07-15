import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { useAuthStore } from '@/stores/auth';

// Layout 内部用 useNavigate/useLocation，需要 router 上下文。
// 用 MemoryRouter + initialEntries 控制当前路径，验证 active 高亮。
function renderLayoutAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<Layout><div>PAGE</div></Layout>} />
      </Routes>
    </MemoryRouter>,
  );
}

const userBase = {
  id: '1',
  email: 'a@x.com',
  name: 'A',
  role: 'USER' as const,
  createdAt: '',
  updatedAt: '',
};

describe('Layout 顶栏导航', () => {
  beforeEach(() => {
    useAuthStore.setState({ status: 'authed', user: userBase });
  });

  it('渲染「我的项目」菜单项', () => {
    renderLayoutAt('/projects');
    expect(
      screen.getByRole('button', { name: '我的项目' }),
    ).toBeInTheDocument();
  });

  it('当前页在 /projects 时「我的项目」高亮', () => {
    renderLayoutAt('/projects');
    expect(
      screen.getByRole('button', { name: '我的项目' }),
    ).toHaveClass('bg-surface-hover');
  });

  it('当前页在 /data 时「数据管理」高亮、「我的项目」不高亮', () => {
    renderLayoutAt('/data');
    expect(
      screen.getByRole('button', { name: '数据管理' }),
    ).toHaveClass('bg-surface-hover');
    expect(
      screen.getByRole('button', { name: '我的项目' }),
    ).not.toHaveClass('bg-surface-hover');
  });
});
