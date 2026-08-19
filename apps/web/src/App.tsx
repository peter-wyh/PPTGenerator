import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Login } from './routes/Login';
import { ProtectedLayout, useRestoreSession } from './routes/ProtectedLayout';
import { ToastContainer } from './components/Toast';

// 路由级 lazy load —— 编辑器(ProjectShell)是最大模块，延迟到进入 /projects/:id 才加载
const Projects = lazy(() => import('./routes/Projects').then((m) => ({ default: m.Projects })));
const Templates = lazy(() => import('./routes/Templates').then((m) => ({ default: m.Templates })));
const ProjectShell = lazy(() => import('./routes/ProjectShell').then((m) => ({ default: m.ProjectShell })));
const TemplateShell = lazy(() => import('./routes/TemplateShell').then((m) => ({ default: m.TemplateShell })));
const SharePage = lazy(() => import('./routes/SharePage').then((m) => ({ default: m.SharePage })));
const DataManagement = lazy(() => import('./routes/DataManagement').then((m) => ({ default: m.DataManagement })));
const CampaignPage = lazy(() => import('./routes/CampaignPage').then((m) => ({ default: m.CampaignPage })));
const CreatorPage = lazy(() => import('./routes/CreatorPage').then((m) => ({ default: m.CreatorPage })));
const OrdersPage = lazy(() => import('./routes/OrdersPage'));
const AdvertiserPage = lazy(() => import('./routes/AdvertiserPage').then((m) => ({ default: m.AdvertiserPage })));
const MarketingEventPage = lazy(() => import('./routes/MarketingEventPage').then((m) => ({ default: m.MarketingEventPage })));
const ApiDocsPage = lazy(() => import('./routes/ApiDocsPage'));
const BusinessLinePage = lazy(() => import('./routes/BusinessLinePage').then((m) => ({ default: m.BusinessLinePage })));
const CampaignCollabPage = lazy(() => import('./routes/CampaignCollabPage').then((m) => ({ default: m.CampaignCollabPage })));
const SchemesPage = lazy(() => import('./routes/SchemesPage').then((m) => ({ default: m.SchemesPage })));
const HtmlStudio = lazy(() => import('./routes/HtmlStudio').then((m) => ({ default: m.HtmlStudio })));
const TemplateHtmlStudio = lazy(() => import('./routes/TemplateHtmlStudio').then((m) => ({ default: m.TemplateHtmlStudio })));

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
            {/* ★ 报告管理两类报告独立路由：可直达/可刷新/前进后退不丢；:tab 用静态路由避免与 bare 布局的 /projects/:id 冲突 */}
            <Route path="/projects" element={<Navigate to="/projects/ppt" replace />} />
            <Route path="/projects/ppt" element={<Projects />} />
            <Route path="/projects/ai-html" element={<Projects />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/schemes" element={<SchemesPage />} />
            <Route path="/data" element={<DataManagement />}>
              <Route index element={<CampaignPage />} />
              <Route path="campaigns" element={<CampaignPage />} />
              <Route path="campaign-collabs" element={<CampaignCollabPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="creators" element={<CreatorPage />} />
              <Route path="advertisers" element={<AdvertiserPage />} />
              <Route path="marketing-events" element={<MarketingEventPage />} />
              <Route path="business-lines" element={<BusinessLinePage />} />
              <Route path="api-docs" element={<ApiDocsPage />} />
            </Route>
          </Route>
          {/* 编辑器：沉浸式，无全局导航 */}
          <Route element={<ProtectedLayout bare />}>
            <Route path="/projects/:id" element={<ProjectShell />} />
            <Route path="/projects/:id/html-studio" element={<HtmlStudio />} />
            <Route path="/templates/:id" element={<TemplateShell />} />
            <Route path="/templates/:id/html-studio" element={<TemplateHtmlStudio />} />
          </Route>
          <Route path="*" element={<Login />} />
        </Routes>
      </Suspense>
      <ToastContainer />
    </BrowserRouter>
  );
}
