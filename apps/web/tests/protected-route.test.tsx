import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedLayout } from '@/routes/ProtectedLayout';
import { useAuthStore } from '@/stores/auth';

vi.mock('@/components/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="layout">{children}</div>
  ),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>LOGIN_PAGE</div>} />
        <Route element={<ProtectedLayout />}>
          <Route path="/projects" element={<div>PROJECTS_PAGE</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedLayout', () => {
  it('redirects guests to /login', () => {
    useAuthStore.setState({ status: 'guest' });
    renderAt('/projects');
    expect(screen.getByText('LOGIN_PAGE')).toBeInTheDocument();
    expect(screen.queryByText('PROJECTS_PAGE')).toBeNull();
  });

  it('renders the protected page for authed users', () => {
    useAuthStore.setState({
      status: 'authed',
      user: { id: '1', email: 'a@x.com', name: null, role: 'USER', createdAt: '', updatedAt: '' },
    });
    renderAt('/projects');
    expect(screen.getByText('PROJECTS_PAGE')).toBeInTheDocument();
    expect(screen.getByTestId('layout')).toBeInTheDocument();
  });

  it('shows the loading state while restoring', () => {
    useAuthStore.setState({ status: 'loading' });
    renderAt('/projects');
    expect(screen.getByText('加载中…')).toBeInTheDocument();
  });
});
