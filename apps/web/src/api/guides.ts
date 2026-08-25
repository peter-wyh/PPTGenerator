/**
 * 业务线报告指南 API(AI 提示词层配置)。
 * 对接后端 /api/v1/guides(登录态)。
 */
import { api } from './client';

/**
 * 注意:字段与 packages/shared 的 Guide 接口一致(name/scenario/content/businessLineId/isDefault/isActive)。
 * 此处本地声明而不 extends Guide——worktree 的 node_modules symlink 指向主仓 packages/shared,
 * 主仓尚未含 Guide(合并 worktree 分支后即有);本地声明与 shared 版本结构兼容。
 */
export interface GuideDTO {
  id: string;
  name: string;
  scenario?: string;
  content: string;
  businessLineId: string;
  isDefault?: boolean;
  isActive?: boolean;
  businessLine?: { code: string; title: string };
  createdAt?: string;
  updatedAt?: string;
}

export const guidesApi = {
  list: (businessLineId?: string) =>
    api.get<{ guides: GuideDTO[] }>('/guides', { params: { businessLineId } }).then((r) => r.data.guides),
  create: (data: { businessLineId: string; name: string; scenario?: string; content: string; isDefault?: boolean; isActive?: boolean }) =>
    api.post<{ guide: GuideDTO }>('/guides', data).then((r) => r.data.guide),
  update: (id: string, data: Partial<{ name: string; scenario: string | null; content: string; isDefault: boolean; isActive: boolean; businessLineId: string }>) =>
    api.patch<{ guide: GuideDTO }>(`/guides/${id}`, data).then((r) => r.data.guide),
};
