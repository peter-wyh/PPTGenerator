import { api } from './client'
import type { ProjectSummary, ProjectDetail } from '@ppt-generator/shared'

export async function listProjects(): Promise<ProjectSummary[]> {
  const res = await api.get<{ projects: ProjectSummary[] }>('/projects')
  return res.data.projects
}

export async function createProject(name: string): Promise<ProjectDetail> {
  const res = await api.post<{ project: ProjectDetail }>('/projects', { name })
  return res.data.project
}

export async function getProject(id: string): Promise<ProjectDetail> {
  const res = await api.get<{ project: ProjectDetail }>(`/projects/${id}`)
  return res.data.project
}

export async function updateProject(id: string, patch: { name?: string }): Promise<ProjectSummary> {
  const res = await api.patch<{ project: ProjectSummary }>(`/projects/${id}`, patch)
  return res.data.project
}

export async function deleteProject(id: string): Promise<void> {
  await api.delete(`/projects/${id}`)
}
