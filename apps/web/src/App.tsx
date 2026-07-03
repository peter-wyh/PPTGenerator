import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Login } from './routes/Login';
import { Projects } from './routes/Projects';
import { ProjectShell } from './routes/ProjectShell';
import { SharePage } from './routes/SharePage';
import { ProtectedLayout, useRestoreSession } from './routes/ProtectedLayout';

export function App() {
  useRestoreSession();
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* 公开分享页：匿名可访问，不在 ProtectedLayout 内 */}
        <Route path="/share/:token" element={<SharePage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectShell />} />
        </Route>
        <Route path="*" element={<Login />} />
      </Routes>
    </BrowserRouter>
  );
}
