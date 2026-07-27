import { api } from './client';
import type {
  ReportScheme,
  CreateReportSchemeInput,
  UpdateReportSchemeInput,
} from '@mediakit/shared';

export const schemesApi = {
  /** 列表（可按 businessLineCode / enabled 过滤）。 */
  list: (params?: { businessLineCode?: string; enabled?: boolean }) =>
    api
      .get<{ schemes: ReportScheme[] }>('/schemes', { params })
      .then((r) => r.data.schemes),

  /** 按 id 获取详情。 */
  get: (id: string) =>
    api.get<{ scheme: ReportScheme }>(`/schemes/${id}`).then((r) => r.data.scheme),

  /** 按 code 获取详情（便于配置化查找）。 */
  getByCode: (code: string) =>
    api.get<{ scheme: ReportScheme }>(`/schemes/code/${code}`).then((r) => r.data.scheme),

  /** 创建方案（ADMIN）。 */
  create: (input: CreateReportSchemeInput) =>
    api.post<{ scheme: ReportScheme }>('/schemes', input).then((r) => r.data.scheme),

  /** 更新方案（ADMIN）。 */
  update: (id: string, patch: UpdateReportSchemeInput) =>
    api.patch<{ scheme: ReportScheme }>(`/schemes/${id}`, patch).then((r) => r.data.scheme),

  /** 删除方案（ADMIN）。 */
  remove: (id: string) => api.delete(`/schemes/${id}`),
};
