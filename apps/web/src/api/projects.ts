import { api } from './client';
import axios from 'axios';
import type { ProjectDetail, ProjectMeta, ProjectSummary } from '@mediakit/shared';

export const projectsApi = {
  list: () => api.get<{ projects: ProjectSummary[] }>('/projects').then((r) => r.data.projects),
  create: (name: string, width?: number, height?: number, meta?: ProjectMeta) =>
    api
      .post<{ project: ProjectDetail; seeded: boolean }>('/projects', { name, width, height, meta })
      .then((r) => ({ project: r.data.project, seeded: r.data.seeded ?? false })),
  get: (id: string) =>
    api.get<{ project: ProjectDetail }>(`/projects/${id}`).then((r) => r.data.project),
  rename: (id: string, name: string) =>
    api.patch<{ project: ProjectDetail }>(`/projects/${id}`, { name }).then((r) => r.data.project),
  update: (
    id: string,
    patch: { name?: string; width?: number; height?: number; pages?: unknown; meta?: ProjectMeta },
  ) => api.patch<{ project: ProjectDetail }>(`/projects/${id}`, patch).then((r) => r.data.project),
  remove: (id: string) => api.delete(`/projects/${id}`),
  /** 复制项目（后端深拷贝页面/尺寸/meta，生成新 id）。返回新项目详情。 */
  duplicate: (id: string) =>
    api.post<{ project: ProjectDetail }>(`/projects/${id}/duplicate`).then((r) => r.data.project),

  /** 导出图片（PNG ZIP）：返回 Blob。
   *  format=images，后端用 puppeteer 逐页截图 2x 高清 PNG，打包 ZIP。 */
  exportImages: (id: string) =>
    api
      .post(`/projects/${id}/export`, undefined, { params: { format: 'images' }, responseType: 'blob' })
      .then((r) => r.data as Blob),

  // ---- M6 分享 ----
  /** 生成（或刷新）分享 token，返回 token。 */
  createShare: (id: string) =>
    api.post<{ shareToken: string }>(`/projects/${id}/share`).then((r) => r.data.shareToken),
  /** 撤销分享 token。 */
  revokeShare: (id: string) => api.delete(`/projects/${id}/share`),

  // ---- M6 PDF 导出 ----
  /** 导出 PDF：走带认证的 api（blob），返回 Blob。
   *  后端路由为 POST /projects/:id/export（export.routes.ts），用 POST 避免被缓存，
   *  且导出有副作用（生成 share token + puppeteer 渲染）。format 走 query。 */
  exportPdf: (id: string) =>
    api
      .post(`/projects/${id}/export`, undefined, { params: { format: 'pdf' }, responseType: 'blob' })
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

