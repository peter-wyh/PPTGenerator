import { api } from './client';
import type {
  ProjectDetail,
  ProjectMeta,
  TemplateDetail,
  TemplateStatus,
  TemplateSummary,
} from '@mediakit/shared';

export const templatesApi = {
  /** 列表。ADMIN 看全部（含草稿），USER 只看已发布。 */
  list: (params?: {
    status?: TemplateStatus;
    businessLine?: string;
    scenario?: string;
    templateType?: string;
    isDefault?: boolean;
  }) => api.get<{ templates: TemplateSummary[] }>('/templates', { params }).then((r) => r.data.templates),

  /** 详情（含 pages，供编辑器加载）。 */
  get: (id: string) =>
    api.get<{ template: TemplateDetail }>(`/templates/${id}`).then((r) => r.data.template),

  /** 创建模板（ADMIN）。返回详情。 */
  create: (input: {
    name: string;
    width?: number;
    height?: number;
    meta?: ProjectMeta;
    note?: string;
  }) => api.post<{ template: TemplateDetail }>('/templates', input).then((r) => r.data.template),

  /** 更新模板（ADMIN）。编辑器 autosave + 属性修改均走此路径。 */
  update: (
    id: string,
    patch: {
      name?: string;
      width?: number;
      height?: number;
      pages?: unknown;
      meta?: ProjectMeta;
      note?: string | null;
      status?: TemplateStatus;
      htmlContent?: string;
    },
  ) => api.patch<{ template: TemplateDetail }>(`/templates/${id}`, patch).then((r) => r.data.template),

  /** 删除模板（ADMIN）。 */
  remove: (id: string) => api.delete(`/templates/${id}`),

  /** 复制模板（ADMIN）。返回新模板详情。 */
  duplicate: (id: string) =>
    api.post<{ template: TemplateDetail }>(`/templates/${id}/duplicate`).then((r) => r.data.template),

  /** 从项目页面创建模板（ADMIN）。将项目中的某页保存为可复用模板。 */
  createFromProjectPage: (input: {
    projectId: string;
    pageId: string;
    name: string;
    width?: number;
    height?: number;
    meta?: ProjectMeta;
    note?: string;
    overwrite?: boolean;
  }) =>
    api.post<{ template: TemplateDetail }>('/templates/from-project-page', input).then((r) => r.data.template),

  /** 从整个项目创建模板（ADMIN）。将项目的所有页面保存为可复用模板。 */
  createFromProject: (input: {
    projectId: string;
    name: string;
    meta?: ProjectMeta;
    note?: string;
    overwrite?: boolean;
  }) =>
    api.post<{ template: TemplateDetail }>('/templates/from-project', input).then((r) => r.data.template),

  /** 发布/取消发布（便捷封装）。 */
  setStatus: (id: string, status: TemplateStatus) =>
    api.patch<{ template: TemplateDetail }>(`/templates/${id}`, { status }).then((r) => r.data.template),

  /** 设/取消默认模板（ADMIN）。 */
  setDefault: (id: string, value: boolean) =>
    api.patch<{ template: TemplateDetail }>(`/templates/${id}/default`, { value }).then((r) => r.data.template),
};

/** 从模板创建项目（任意登录用户）。返回新项目详情。 */
export function createProjectFromTemplate(templateId: string, name?: string): Promise<ProjectDetail> {
  return api
    .post<{ project: ProjectDetail }>('/projects/from-template', { templateId, name })
    .then((r) => r.data.project);
}
