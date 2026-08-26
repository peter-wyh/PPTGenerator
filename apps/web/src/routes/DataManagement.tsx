import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';

interface MenuItem {
  path?: string;
  label: string;
  children?: { path: string; label: string }[];
}

const MENUS: MenuItem[] = [
  {
    label: 'Campaign',
    children: [
      { path: '/data/campaigns', label: 'Campaign 列表' },
      { path: '/data/campaign-collabs', label: '合作列表' },
    ],
  },
  { path: '/data/orders', label: '订单明细' },
  {
    label: 'TrackingLink',
    children: [
      { path: '/data/links', label: '链接统计' },
      { path: '/data/links/daily', label: '按日明细' },
    ],
  },
  { path: '/data/stats', label: '数据统计' },
  { path: '/data/creators', label: '达人库' },
  { path: '/data/advertisers', label: '广告主' },
  { path: '/data/marketing-events', label: '营销活动' },
  { path: '/data/guides', label: '指南' },
  { path: '/data/business-lines', label: '业务线' },
  { path: '/data/api-docs', label: '接口文档' },
];

function isActive(path: string, pathname: string) {
  return pathname === path || pathname.startsWith(path + '/');
}

export function DataManagement() {
  const location = useLocation();
  const navigate = useNavigate();
  // 通用多组展开：初始展开所有「含活跃子项」的组（当前路径命中即保持展开）
  const [expandedLabels, setExpandedLabels] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const m of MENUS) {
      if (m.children?.some((c) => isActive(c.path, location.pathname))) s.add(m.label);
    }
    return s;
  });
  const toggle = (label: string) =>
    setExpandedLabels((prev) => {
      const s = new Set(prev);
      if (s.has(label)) s.delete(label); else s.add(label);
      return s;
    });

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* 左侧菜单 */}
      <aside className="flex w-52 shrink-0 flex-col border-r border-border-default bg-surface-primary">
        <div className="px-4 py-4">
          <h1 className="font-headings text-lg font-semibold text-foreground-primary">数据管理</h1>
          <p className="mt-0.5 text-xs text-foreground-secondary">
            Campaign · 订单 · 链接 · 达人 · 业务线
          </p>
        </div>
        <nav className="flex-1 overflow-auto px-2">
          {MENUS.map((menu) => {
            if (menu.children) {
              // 有子菜单（可展开组）
              const anyActive = menu.children.some((c) => isActive(c.path, location.pathname));
              const expanded = expandedLabels.has(menu.label);
              return (
                <div key={menu.label} className="mb-1">
                  <button
                    onClick={() => toggle(menu.label)}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
                      anyActive ? 'bg-accent-primary/10 text-accent-primary' : 'text-foreground-secondary hover:bg-surface-hover hover:text-foreground-primary'
                    }`}
                  >
                    <span>{menu.label}</span>
                    <span className="text-xs">{expanded ? '▾' : '▸'}</span>
                  </button>
                  {expanded && (
                    <div className="ml-2 mt-0.5 flex flex-col gap-0.5 border-l border-border-subtle pl-2">
                      {menu.children.map((child) => (
                        <button
                          key={child.path}
                          onClick={() => navigate(child.path)}
                          className={`rounded-md px-3 py-1.5 text-left text-xs transition-colors ${
                            isActive(child.path, location.pathname)
                              ? 'bg-accent-primary/10 font-medium text-accent-primary'
                              : 'text-foreground-secondary hover:bg-surface-hover hover:text-foreground-primary'
                          }`}
                        >
                          {child.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            // 无子菜单
            return (
              <button
                key={menu.path}
                onClick={() => navigate(menu.path!)}
                className={`mb-1 flex w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  isActive(menu.path!, location.pathname)
                    ? 'bg-accent-primary/10 font-medium text-accent-primary'
                    : 'text-foreground-secondary hover:bg-surface-hover hover:text-foreground-primary'
                }`}
              >
                {menu.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* 右侧内容区 */}
      <main className="min-w-0 flex-1 overflow-auto px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
