import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Login } from './routes/Login';
import { ProtectedLayout, useRestoreSession } from './routes/ProtectedLayout';

// 路由级 lazy load —— 编辑器(ProjectShell)是最大模块，延迟到进入 /projects/:id 才加载
const Projects = lazy(() => import('./routes/Projects').then((m) => ({ default: m.Projects })));
const Templates = lazy(() => import('./routes/Templates').then((m) => ({ default: m.Templates })));
const ProjectShell = lazy(() => import('./routes/ProjectShell').then((m) => ({ default: m.ProjectShell })));
const TemplateShell = lazy(() => import('./routes/TemplateShell').then((m) => ({ default: m.TemplateShell })));
const SharePage = lazy(() => import('./routes/SharePage').then((m) => ({ default: m.SharePage })));
const MockData = lazy(() => import('./routes/MockData').then((m) => ({ default: m.MockData })));

function RouteFallback() {
  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <div className="text-sm text-gray-400">加载中…</div>
    </div>
  );
}

export function App() {
  useRestoreSession();
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* 公开分享页：匿名可访问，不在 ProtectedLayout 内 */}
          <Route path="/share/:token" element={<SharePage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/projects" element={<Projects />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/data" element={<MockData />} />
          </Route>
          {/* 编辑器：沉浸式，无全局导航 */}
          <Route element={<ProtectedLayout bare />}>
            <Route path="/projects/:id" element={<ProjectShell />} />
            <Route path="/templates/:id" element={<TemplateShell />} />
          </Route>
          <Route path="*" element={<Login />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
