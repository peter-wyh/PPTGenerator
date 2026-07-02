import { api } from './client';
import type { ProjectDetail, ProjectSummary } from '@mediakit/shared';

export const projectsApi = {
  list: () => api.get<{ projects: ProjectSummary[] }>('/projects').then((r) => r.data.projects),
  create: (name: string) =>
    api.post<{ project: ProjectDetail }>('/projects', { name }).then((r) => r.data.project),
  get: (id: string) =>
    api.get<{ project: ProjectDetail }>(`/projects/${id}`).then((r) => r.data.project),
  rename: (id: string, name: string) =>
    api.patch<{ project: ProjectDetail }>(`/projects/${id}`, { name }).then((r) => r.data.project),
  remove: (id: string) => api.delete(`/projects/${id}`),
};
