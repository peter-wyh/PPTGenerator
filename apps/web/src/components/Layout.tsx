import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { Button } from './Button';

interface LayoutProps {
  children: ReactNode;
}

/** 菜单按钮 className：active 时给选中态，否则给默认态 + hover。 */
function navBtn(active: boolean) {
  return `rounded px-2 py-1 text-sm ${
    active
      ? 'bg-surface-hover text-foreground-primary font-medium'
      : 'text-foreground-secondary hover:bg-surface-hover hover:text-foreground-primary'
  }`;
}

/** 受保护页面的外壳：顶栏（logo / 项目名占位 / 当前用户 / 登出）。 */
export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 items-center justify-between border-b border-border-default bg-surface-primary px-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/projects')}
            className="font-headings text-xl font-semibold tracking-tight text-foreground-primary"
          >
            Report Generator
          </button>
          <button
            onClick={() => navigate('/projects')}
            className={navBtn(location.pathname === '/projects')}
          >
            报告管理
          </button>
          <button
            onClick={() => navigate('/data/campaigns')}
            className={navBtn(location.pathname.startsWith('/data'))}
          >
            数据管理
          </button>
          {user?.role === 'ADMIN' && (
            <button
              onClick={() => navigate('/templates')}
              className={navBtn(location.pathname === '/templates')}
            >
              模板管理
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <span className="text-sm text-foreground-secondary">
              {user.name ?? user.email}
              {user.role === 'ADMIN' && (
                <span className="ml-1 rounded-full bg-accent-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent-primary">
                  ADMIN
                </span>
              )}
              {user.businessLineCode && (
                <span className="ml-1 rounded-full bg-accent-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent-primary">
                  {user.businessLineCode}
                </span>
              )}
            </span>
          )}
          <Button variant="ghost" onClick={handleLogout}>
            登出
          </Button>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
