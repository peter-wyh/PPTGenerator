import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Login } from './routes/Login';
import { Projects } from './routes/Projects';
import { ProjectShell } from './routes/ProjectShell';
import { ProtectedLayout, useRestoreSession } from './routes/ProtectedLayout';

export function App() {
  useRestoreSession();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectShell />} />
        </Route>
        <Route path="*" element={<Login />} />
      </Routes>
    </BrowserRouter>
  );
}
