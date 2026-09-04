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
  /** 结构指南自带全套视觉规范(deck 等强版式场景):生成时跳过 LAYER 1,由本指南接管视觉 */
  overridesVisual?: boolean;
  isActive?: boolean;
  businessLine?: { code: string; title: string };
  createdAt?: string;
  updatedAt?: string;
  activeRevisionId?: string | null;
}

/** 指南版本(GuideRevision 快照;列表不含 content 全文,取全文走 getRevision) */
export interface GuideRevisionDTO {
  id?: string;
  version: number;
  /** 生效版标记:Guide.activeRevisionId 匹配项(编辑器载入生效版 checks 用)。 */
  isActive?: boolean;
  changelog?: string | null;
  createdBy?: string | null;
  createdAt?: string;
  checks?: CheckDTO[];
  toolParams?: Record<string, unknown> | null;
  /** 参考文件（样张等）：kind=sample 样张 / tokens 色彩字体 / checklist 清单 */
  assets?: { kind: string; ref: string; hash?: string; name?: string }[];
}

/** 合格断言(S2 四类模板:slide_count==N / has_class X / no_element X / contains_text X) */
export interface CheckDTO {
  assert: string;
  severity: 'report' | 'block';
  message?: string;
}

/** 干跑结果(validateHtml 报告 + lint 错误) */
export interface DryRunResultDTO {
  lintErrors: { index: number; error: string }[];
  report: {
    ok: boolean;
    total: number;
    failed: number;
    blocked: number;
    results: { assert: string; severity: 'report' | 'block'; passed: boolean; actual?: string; message?: string }[];
  } | null;
  hasTarget: boolean;
}

export const guidesApi = {
  list: (businessLineId?: string) =>
    api.get<{ guides: GuideDTO[] }>('/guides', { params: { businessLineId } }).then((r) => r.data.guides),
  create: (data: { businessLineId: string; name: string; scenario?: string; content: string; isDefault?: boolean; overridesVisual?: boolean; isActive?: boolean }) =>
    api.post<{ guide: GuideDTO }>('/guides', data).then((r) => r.data.guide),
  update: (id: string, data: Partial<{ name: string; scenario: string | null; content: string; isDefault: boolean; overridesVisual: boolean; isActive: boolean; businessLineId: string }>) =>
    api.patch<{ guide: GuideDTO }>(`/guides/${id}`, data).then((r) => r.data.guide),

  // ── S1 版本管理 ──
  listRevisions: (id: string) =>
    api.get<{ revisions: GuideRevisionDTO[] }>(`/guides/${id}/revisions`).then((r) => r.data.revisions),
  getRevision: (id: string, version: number) =>
    api.get<{ revision: GuideRevisionDTO & { content: string } }>(`/guides/${id}/revisions/${version}`).then((r) => r.data.revision),
  saveRevision: (id: string, data: { content: string; changelog?: string; checks?: CheckDTO[]; force?: boolean }) =>
    api.post<{ revision: GuideRevisionDTO }>(`/guides/${id}/revisions`, data).then((r) => r.data.revision),
  activateRevision: (id: string, version: number) =>
    api.post<{ revision: GuideRevisionDTO }>(`/guides/${id}/revisions/activate`, { version }).then((r) => r.data.revision),

  // ── S2 干跑校验 ──
  dryRun: (id: string, checks: CheckDTO[], html?: string) =>
    api.post<DryRunResultDTO>(`/guides/${id}/revisions/dry-run`, { checks, ...(html ? { html } : {}) }).then((r) => r.data),
};
