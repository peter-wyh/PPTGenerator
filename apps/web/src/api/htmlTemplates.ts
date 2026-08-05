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

  /** 生成 HTML 报告 */
  generate: (input: {
    mode: 'template' | 'ai';
    templateId?: string;
    prompt?: string;
    campaignId?: string;
    theme?: 'light' | 'dark';
    designMd?: string;
  }) =>
    api
      .post<{ html: string }>('/html-templates/generate', input)
      .then((r) => r.data.html),

  /** 获取 Campaign 关联业务线的 design.md（供前端回显/编辑） */
  getDesignGuide: (campaignId: string) =>
    api
      .get<{ designMd: string; businessLineName: string; businessLineCode: string }>(
        `/html-templates/campaign/${campaignId}/design-guide`,
      )
      .then((r) => r.data),

  /** 保存 HTML 到报告 */
  saveHtml: (projectId: string, html: string) =>
    api
      .patch(`/html-templates/projects/${projectId}/html`, { html })
      .then((r) => r.data),

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
};
