import { Outlet, useLocation, useNavigate } from 'react-router-dom';

const TABS = [
  { path: '/data/campaigns', label: 'Campaign' },
  { path: '/data/creators', label: '达人库' },
  { path: '/data/advertisers', label: '广告主' },
  { path: '/data/business-lines', label: '业务线' },
] as const;

export function DataManagement() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="font-headings text-xl font-semibold text-foreground-primary">数据管理</h1>
      <p className="mt-1 text-sm text-foreground-secondary">
        管理 Campaign、达人库、广告主、业务线数据，支持导入。编辑器从本库读取。
      </p>
      <div className="mt-4 flex gap-1 border-b border-border-default">
        {TABS.map((t) => (
          <button
            key={t.path}
            onClick={() => navigate(t.path)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm transition-colors ${
              location.pathname.startsWith(t.path)
                ? 'border-accent-primary font-medium text-foreground-primary'
                : 'border-transparent text-foreground-secondary hover:text-foreground-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  );
}
