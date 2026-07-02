import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { Layout } from '@/components/Layout';

/** 会话未恢复完成时显示；已登录才放行子路由。 */
export function ProtectedLayout() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center text-sm text-foreground-muted">
        加载中…
      </div>
    );
  }

  if (status === 'guest') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

/** 顶层会话恢复：挂载即调 restore()。 */
export function useRestoreSession(): void {
  const restore = useAuthStore((s) => s.restore);
  useEffect(() => {
    void restore();
  }, [restore]);
}
