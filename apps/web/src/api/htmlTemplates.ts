import { api, getAccessToken, refreshAccessToken } from './client';

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
  action?: 'generate' | 'edit' | 'fix' | 'manual' | 'qa' | 'cancelled';
  ts: string;
  /** AI 思考过程（chain-of-thought），流式结束后保存到聊天记录 */
  reasoning?: string;
  /** 附件图片的 base64 data URL 列表（vision 多模态编辑用） */
  images?: string[];
  /**
   * ★ 对话即版本历史：该消息产生时的完整 HTML 快照。
   * assistant 消息 = 本次编辑后的成品（可恢复点）；user 消息 = 发送时的原状（编辑前状态）。
   * 右侧预览跟随「最新 assistant 快照」；点历史消息「恢复到此版本」= onHtmlChange(snapshot) + autoSave。
   * 大小量级：报告 HTML 20-40KB ≈ base64 图片 1 张，meta JSON 5mb limit 内可存数十轮对话。
   */
  htmlSnapshot?: string;
}

/** 「宁缺勿假」数据覆盖(服务端 recipe reportContent.dataCoverage / SSE done chunk 附带)。 */
export interface RecipeDataCoverage {
  requested?: { start: string; end: string };
  covered: { start: string; end: string } | null;
  missingDays: number;
  complete: boolean;
}

/** ★ 模块级数据覆盖预检(生成前)——镜像服务端 ModuleCoverageResult。 */
export interface ModuleCoverageItem {
  /** 模块键(= AI 上下文注入字段名) */
  key: string;
  /** 模块中文名 */
  label: string;
  /** 'ok' = 有数据;'missing' = 缺数据 → 生成时渲染 Data Unavailable 占位 */
  status: 'ok' | 'missing';
  /** 补充说明 */
  detail?: string;
}

export interface ModuleCoverageResult {
  requested: { start: string; end: string };
  modules: ModuleCoverageItem[];
}

// ─── SSE 流式类型 ───────────────────────────────────────────

/** SSE 事件类型 */
export type SSEChunk =
  | { type: 'reasoning'; text: string }
  | { type: 'content'; text: string }
  | { type: 'done'; html: string; truncated: boolean; dataCoverage?: RecipeDataCoverage; guideUsed?: { id: string; name: string }[] }
  | { type: 'error'; message: string };

/** 通用 SSE 流式消费者（fetch + ReadableStream，绕过 axios 不支持 SSE）
 *  ★ 401 自动 refresh + 重试一次：fetch 通道不走 axios interceptor，须自带。
 *    token 过期(15min)不再炸出 HTTP 401 中断对话——与普通请求同体验。 */
async function consumeSSEStream(
  url: string,
  body: Record<string, unknown>,
  onChunk: (chunk: SSEChunk) => void,
  signal?: AbortSignal,
): Promise<void> {
  const doFetch = () => {
    const token = getAccessToken();
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      credentials: 'include',
      signal,
    });
  };

  let response = await doFetch();

  // ★ 401 → refresh → 重试一次（refresh 失败则原样抛错）
  if (response.status === 401) {
    try {
      await refreshAccessToken();
      response = await doFetch();
    } catch {
      // refresh 失败（会话真失效）：走下面的 !ok 抛错路径
    }
  }

  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error');
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n'); // SSE events separated by double newline
    buffer = events.pop() || '';
    for (const event of events) {
      const dataLine = event.trim();
      if (!dataLine.startsWith('data: ')) continue;
      try {
        const chunk = JSON.parse(dataLine.slice(6)) as SSEChunk;
        onChunk(chunk);
        if (chunk.type === 'done' || chunk.type === 'error') return;
      } catch {
        // skip unparseable
      }
    }
  }
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

  /** SSE 流式生成 HTML（reasoning + content 实时转发） */
  generateStream: (
    input: {
      prompt?: string;
      campaignId?: string;
      guideId?: string;
      reportPeriod?: { startDate?: string; endDate?: string };
    },
    onChunk: (chunk: SSEChunk) => void,
    signal?: AbortSignal,
  ) =>
    consumeSSEStream(
      '/api/v1/html-templates/generate-stream',
      input,
      onChunk,
      signal,
    ),

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

  /** 创建 recipe 版本并设为 active(G1)。成功后需重载版本列表。 */
  createRecipeVersion: (
    projectId: string,
    input: { recipeId?: string; reportPeriod?: { startDate?: string; endDate?: string } },
  ) =>
    api
      .post<{ ok: boolean; versionId: string }>(
        `/html-templates/projects/${projectId}/recipe-version`,
        input,
      )
      .then((r) => r.data),

  /** 按新时间段重算 recipe 版本并落库(G2)。成功后需重载版本。 */
  recomputeRecipe: (versionId: string, reportPeriod: { startDate?: string; endDate?: string }) =>
    api
      .post<{ ok: boolean; versionId: string }>(
        `/html-templates/html-versions/${versionId}/recompute`,
        { reportPeriod },
      )
      .then((r) => r.data),

  /** 获取 Campaign 关联业务线的指南（供前端回显/编辑） */
  getDesignGuide: (campaignId: string, guideId?: string) =>
    api
      .get<{
        designMd: string; businessLineName: string; businessLineCode: string;
        guideName: string; guideId: string | null;
        guides?: { id: string; name: string; layer: 'visual' | 'structural' }[];
      }>(
        `/html-templates/campaign/${campaignId}/design-guide`,
        { params: guideId ? { guideId } : undefined },
      )
      .then((r) => r.data),

  /** ★ 该 campaign 业务线可选的结构指南列表（「选用整套模板」下拉动态化） */
  getStructuralGuides: (campaignId: string) =>
    api
      .get<{ guides: { id: string; name: string; updatedAt: string; overridesVisual?: boolean; checksCount?: number; assetsCount?: number }[] }>(`/html-templates/campaign/${campaignId}/structural-guides`)
      .then((r) => r.data.guides),

  /** ★ 模块级数据覆盖预检（生成前）：标准模块清单逐项判定数据可用性 */
  getModuleCoverage: (campaignId: string, reportPeriod?: { startDate?: string; endDate?: string }) =>
    api
      .get<ModuleCoverageResult>(
        `/html-templates/campaign/${campaignId}/module-coverage`,
        {
          params: {
            ...(reportPeriod?.startDate ? { startDate: reportPeriod.startDate } : {}),
            ...(reportPeriod?.endDate ? { endDate: reportPeriod.endDate } : {}),
          },
        },
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

  /** Agent 增量编辑：当前 HTML + 指令（可选附带图片）→ 修改后的完整 HTML */
  agentEdit: (input: {
    currentHtml: string;
    instruction: string;
    images?: string[];
    /** 数据上下文：服务端据此注入真实 DB 数据（防伪造） */
    campaignId?: string;
    reportPeriod?: { startDate?: string; endDate?: string };
  }) =>
    api
      .post<{ html: string }>('/html-templates/agent-edit', input, {
        timeout: 300000,
      })
      .then((r) => r.data.html),

  /** SSE 流式 Agent 编辑（reasoning + content 实时转发） */
  agentEditStream: (
    input: {
      currentHtml: string;
      instruction: string;
      images?: string[];
      /** 数据上下文：服务端据此注入真实 DB 数据（防伪造） */
      campaignId?: string;
      reportPeriod?: { startDate?: string; endDate?: string };
    },
    onChunk: (chunk: SSEChunk) => void,
    signal?: AbortSignal,
  ) =>
    consumeSSEStream(
      '/api/v1/html-templates/agent-edit-stream',
      input,
      onChunk,
      signal,
    ),

  /** Agent 数据问答:问题 → 纯文本回答(不产出 HTML),服务端限死在数据上下文内 */
  agentQa: (
    input: {
      question: string;
      campaignId?: string;
      reportPeriod?: { startDate?: string; endDate?: string };
      history?: { role: 'user' | 'assistant'; content: string }[];
    },
    signal?: AbortSignal,
  ) =>
    api
      .post<{ answer: string; hasDataContext: boolean }>('/html-templates/agent-qa', input, {
        signal,
      })
      .then((r) => r.data),

  /** Agent 模式自动保存（直接覆盖 htmlContent） */
  autoSave: (
    projectId: string,
    html?: string,
    agentHistory?: AgentChatMessage[],
    genParams?: { prompt: string; designMd: string },
  ) =>
    api
      .patch<{ ok: boolean; updatedAt: string }>(
        `/html-templates/projects/${projectId}/auto-save`,
        { html, agentHistory, aiPrompt: genParams?.prompt, designMd: genParams?.designMd },
      )
      .then((r) => r.data),

  /** 获取系统提示词 Markdown 展示版 */
  getSystemPrompt: () =>
    api
      .get<{ systemPrompt: string }>('/html-templates/system-prompt')
      .then((r) => r.data.systemPrompt),
};
