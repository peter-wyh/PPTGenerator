import { api } from './client';

export interface HtmlTemplateSummary {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  thumbnail: string | null;
  status: 'DRAFT' | 'PUBLISHED';
}

export interface HtmlTemplateDetail extends HtmlTemplateSummary {
  html: string;
}

/** Recipe 报告的结构覆盖(组件顺序/隐藏)。 */
export interface ManifestOverrides {
  order?: string[];
  hidden?: string[];
}

/** 生成报告时的输入 mode:ai(DeepSeek 生成) | recipe(本地模板渲染)。 */
export type GenerateMode = 'ai' | 'recipe';

export interface HtmlVersionSummary {
  id: string;
  name: string;
  source: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HtmlVersionDetail extends HtmlVersionSummary {
  html: string;
  projectId: string;
  ownerId: string;
  /** recipe 版本标识(非空 = recipe 模式,可编辑四层配置)。 */
  recipeId?: string | null;
  /** recipe 数据快照(直接喂模板,跳过 mapCampaign)。 */
  reportContent?: unknown | null;
  /** recipe 风格层覆盖(dgTokens 子集)。 */
  tokenOverrides?: Record<string, unknown> | null;
  /** recipe 结构层覆盖。 */
  manifestOverrides?: ManifestOverrides | null;
}

/** Agent 对话消息 */
export interface AgentChatMessage {
  role: 'user' | 'assistant';
  content: string;
  action?: 'generate' | 'edit' | 'fix' | 'manual';
  ts: string;
  /** 附件图片的 base64 data URL 列表（vision 多模态编辑用） */
  images?: string[];
}

export const htmlTemplatesApi = {
  list: (params?: { status?: string; category?: string }) =>
    api
      .get<HtmlTemplateSummary[]>('/html-templates', { params })
      .then((r) => r.data),

  get: (id: string) =>
    api
      .get<HtmlTemplateDetail>(`/html-templates/${id}`)
      .then((r) => r.data),

  create: (input: {
    name: string;
    html: string;
    description?: string;
    category?: string;
    status?: 'DRAFT' | 'PUBLISHED';
  }) =>
    api
      .post<HtmlTemplateDetail>('/html-templates', input)
      .then((r) => r.data),

  update: (
    id: string,
    patch: Partial<{
      name: string;
      html: string;
      description: string | null;
      category: string | null;
      status: 'DRAFT' | 'PUBLISHED';
    }>,
  ) =>
    api
      .patch<HtmlTemplateDetail>(`/html-templates/${id}`, patch)
      .then((r) => r.data),

  remove: (id: string) =>
    api.delete(`/html-templates/${id}`).then((r) => r.data),

  /** 生成 HTML 报告（DeepSeek V4 Pro 推理模型需要 2-3 分钟） */
  generate: (input: {
    mode: GenerateMode;
    templateId?: string;
    prompt?: string;
    campaignId?: string;
    designMd?: string;
    reportPeriod?: { startDate?: string; endDate?: string };
  }) =>
    api
      .post<{ html: string }>('/html-templates/generate', input, {
        timeout: 300000, // 5 分钟超时（V4 Pro 推理模型需要更长时间）
      })
      .then((r) => r.data.html),

  /** Recipe 实时重渲染（不保存,编辑器预览用）。 */
  reRender: (input: {
    recipeId?: string;
    campaignId?: string;
    reportContent?: unknown;
    tokenOverrides?: Record<string, unknown>;
    manifestOverrides?: ManifestOverrides;
  }) =>
    api
      .post<{ html: string }>('/html-templates/recipe/render', input)
      .then((r) => r.data.html),

  /** 保存 recipe 配置到 HtmlVersion（reportContent/tokenOverrides/manifestOverrides）,
   *  触发重渲染并写回 html。仅 recipe 版本可用;未传字段沿用 version 现值。 */
  saveRecipeConfig: (
    versionId: string,
    cfg: {
      reportContent?: unknown;
      tokenOverrides?: Record<string, unknown>;
      manifestOverrides?: ManifestOverrides;
    },
  ) =>
    api
      .patch<{ ok: boolean; versionId: string }>(
        `/html-templates/html-versions/${versionId}/recipe-config`,
        cfg,
      )
      .then((r) => r.data),

  /** 获取 Campaign 关联业务线的 design.md（供前端回显/编辑） */
  getDesignGuide: (campaignId: string) =>
    api
      .get<{ designMd: string; businessLineName: string; businessLineCode: string }>(
        `/html-templates/campaign/${campaignId}/design-guide`,
      )
      .then((r) => r.data),

  /** 保存 HTML 到报告（覆盖当前版本或新增版本） */
  saveHtml: (
    projectId: string,
    html: string,
    opts?: { name?: string; source?: string; mode?: 'overwrite' | 'new' },
  ) =>
    api
      .patch<{ ok: boolean; versionId: string }>(
        `/html-templates/projects/${projectId}/html`,
        { html, ...opts },
      )
      .then((r) => r.data),

  /** 列出项目的所有 HTML 版本 */
  listHtmlVersions: (projectId: string) =>
    api
      .get<HtmlVersionSummary[]>(`/html-templates/projects/${projectId}/html-versions`)
      .then((r) => r.data),

  /** 获取单个版本（含完整 HTML） */
  getHtmlVersion: (versionId: string) =>
    api
      .get<HtmlVersionDetail>(`/html-templates/html-versions/${versionId}`)
      .then((r) => r.data),

  /** 更新版本（名称/激活状态） */
  updateHtmlVersion: (
    versionId: string,
    patch: { name?: string; html?: string; isActive?: boolean },
  ) =>
    api
      .patch<HtmlVersionDetail>(`/html-templates/html-versions/${versionId}`, patch)
      .then((r) => r.data),

  /** 删除版本 */
  deleteHtmlVersion: (versionId: string) =>
    api.delete(`/html-templates/html-versions/${versionId}`).then((r) => r.data),

  /** 从 Campaign 创建新报告并保存 HTML */
  saveHtmlAsProject: (input: {
    html: string;
    campaignId: string;
    name: string;
    businessLine?: string;
    creator?: string;
    advertiser?: string;
    scenario?: string;
    scenarioSub?: string;
  }) =>
    api
      .post<{ ok: boolean; projectId: string }>('/html-templates/projects/html', input)
      .then((r) => r.data),

  /** Agent 增量编辑：当前 HTML + 指令（可选附带图片）→ 修改后的 HTML */
  agentEdit: (input: { currentHtml: string; instruction: string; images?: string[] }) =>
    api
      .post<{ html: string }>('/html-templates/agent-edit', input, {
        timeout: 300000,
      })
      .then((r) => r.data.html),

  /** Agent 模式自动保存（直接覆盖 htmlContent） */
  autoSave: (
    projectId: string,
    html: string,
    agentHistory?: AgentChatMessage[],
  ) =>
    api
      .patch<{ ok: boolean; updatedAt: string }>(
        `/html-templates/projects/${projectId}/auto-save`,
        { html, agentHistory },
      )
      .then((r) => r.data),

  /** 获取系统提示词 Markdown 展示版 */
  getSystemPrompt: () =>
    api
      .get<{ systemPrompt: string }>('/html-templates/system-prompt')
      .then((r) => r.data.systemPrompt),
};
