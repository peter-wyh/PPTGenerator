import { api } from './client';
import axios from 'axios';
import type { ProjectDetail, ProjectSummary } from '@mediakit/shared';

export const projectsApi = {
  list: () => api.get<{ projects: ProjectSummary[] }>('/projects').then((r) => r.data.projects),
  create: (name: string) =>
    api.post<{ project: ProjectDetail }>('/projects', { name }).then((r) => r.data.project),
  get: (id: string) =>
    api.get<{ project: ProjectDetail }>(`/projects/${id}`).then((r) => r.data.project),
  rename: (id: string, name: string) =>
    api.patch<{ project: ProjectDetail }>(`/projects/${id}`, { name }).then((r) => r.data.project),
  update: (id: string, patch: { name?: string; width?: number; height?: number; pages?: unknown }) =>
    api.patch(`/projects/${id}`, patch),
  remove: (id: string) => api.delete(`/projects/${id}`),

  // ---- M6 分享 ----
  /** 生成（或刷新）分享 token，返回 token。 */
  createShare: (id: string) =>
    api.post<{ shareToken: string }>(`/projects/${id}/share`).then((r) => r.data.shareToken),
  /** 撤销分享 token。 */
  revokeShare: (id: string) => api.delete(`/projects/${id}/share`),

  // ---- M6 PDF 导出 ----
  /** 导出 PDF：走带认证的 api（blob），返回 Blob。 */
  exportPdf: (id: string) =>
    api
      .get(`/projects/${id}/export`, { params: { format: 'pdf' }, responseType: 'blob' })
      .then((r) => r.data as Blob),
};

/**
 * 匿名读分享项目（不走带 access token 的 api，用裸 axios）。
 * 供 /share/:token 路由使用。
 */
export function getSharedProject(token: string): Promise<ProjectDetail> {
  return axios
    .get<{ project: ProjectDetail }>(`/api/v1/share/${token}`)
    .then((r) => r.data.project);
}

