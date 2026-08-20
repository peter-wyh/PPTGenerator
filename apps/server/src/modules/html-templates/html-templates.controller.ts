import type { Request, Response } from 'express';
import { htmlTemplateService } from './html-templates.service';
import { aiGenerateService, type StreamChunk } from './ai-generate.service';
import { SYSTEM_PROMPT_DISPLAY } from './ai-generate.service';
import { resolveForCampaign } from '../guides/guide.service';
import { asyncHandler } from '../../utils/asyncHandler';
import type { AuthPayload } from '../../types/express';
import type { TemplateStatus } from '@prisma/client';

/** SSE helper: write one event to the response stream */
function sseWrite(res: Response, event: StreamChunk) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

/** SSE helper: set up SSE response headers */
function initSSE(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // nginx: disable buffering
  res.flushHeaders?.();
}

export const htmlTemplateController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const auth = req.user as AuthPayload;
    const role = auth.role;
    const { status, category } = req.query;
    const filters: { status?: string; category?: string } = {};
    if (status) filters.status = String(status);
    if (category) filters.category = String(category);
    const templates = await htmlTemplateService.list(role, filters);
    res.json(templates);
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const auth = req.user as AuthPayload;
    const template = await htmlTemplateService.get(auth.role, req.params.id);
    res.json(template);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const auth = req.user as AuthPayload;
    const { name, html, description, category, thumbnail, status } = req.body;
    const tpl = await htmlTemplateService.create(auth.id, {
      name,
      html,
      description,
      category,
      thumbnail,
      status: status as TemplateStatus | undefined,
    });
    res.status(201).json(tpl);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const auth = req.user as AuthPayload;
    const { name, html, description, category, thumbnail, status } = req.body;
    const tpl = await htmlTemplateService.update(auth.id, req.params.id, {
      name,
      html,
      description,
      category,
      thumbnail,
      status: status as TemplateStatus | undefined,
    });
    res.json(tpl);
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const auth = req.user as AuthPayload;
    await htmlTemplateService.remove(auth.id, req.params.id);
    res.status(204).json({ ok: true });
  }),

  /** Generate HTML report: recipe mode (template-driven, data-swap-ready) or AI mode */
  generate: asyncHandler(async (req: Request, res: Response) => {
    const { mode, recipeId, prompt, campaignId, theme, reportPeriod } = req.body;
    let html: string;
    let guideUsed: { id: string; name: string } | null = null;
    if (mode === 'recipe') {
      const { getRecipe } = await import('./recipe');
      html = await getRecipe(recipeId ?? 'campaign-report').render({ campaignId, theme, reportPeriod });
    } else {
      const out = await aiGenerateService.generateHtml({
        campaignId,
        prompt: prompt || 'Generate a comprehensive campaign performance report',
        scenario: req.body.scenario,
        reportPeriod,
      });
      html = out.html;
      guideUsed = out.guideUsed;
    }
    res.json({ html, guideUsed });
  }),

  /** 保存生成的 HTML 到项目（兼容旧接口，同时写入 HtmlVersion 表） */
  saveHtml: asyncHandler(async (req: Request, res: Response) => {
    const auth = req.user as AuthPayload;
    const { projectId } = req.params;
    const { html, name, source, mode } = req.body;
    // mode: 'overwrite' (覆盖当前版本) | 'new' (新增版本)，默认 overwrite
    const result = await htmlTemplateService.saveHtmlVersion(projectId, auth.id, html, {
      name,
      source,
      mode: mode || 'overwrite',
    });
    res.json(result);
  }),

  /** 列出项目的所有 HTML 版本 */
  listHtmlVersions: asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const versions = await htmlTemplateService.listHtmlVersions(projectId);
    res.json(versions);
  }),

  /** 获取单个 HTML 版本 */
  getHtmlVersion: asyncHandler(async (req: Request, res: Response) => {
    const { versionId } = req.params;
    const version = await htmlTemplateService.getHtmlVersion(versionId);
    res.json(version);
  }),

  /** 更新 HTML 版本（名称/内容/激活状态） */
  updateHtmlVersion: asyncHandler(async (req: Request, res: Response) => {
    const auth = req.user as AuthPayload;
    const { versionId } = req.params;
    const { name, html, isActive } = req.body;
    const version = await htmlTemplateService.updateHtmlVersion(versionId, auth.id, {
      name,
      html,
      isActive,
    });
    res.json(version);
  }),

  /** 删除 HTML 版本 */
  deleteHtmlVersion: asyncHandler(async (req: Request, res: Response) => {
    const { versionId } = req.params;
    await htmlTemplateService.deleteHtmlVersion(versionId);
    res.status(204).json({ ok: true });
  }),

  /** 从 Campaign 直接创建新报告并保存 HTML（Campaign 列表入口） */
  saveHtmlAsProject: asyncHandler(async (req: Request, res: Response) => {
    const auth = req.user as AuthPayload;
    const { html, campaignId, name, ...rest } = req.body;
    const project = await htmlTemplateService.saveHtmlAsNewProject(auth.id, {
      html,
      campaignId,
      name,
      ...rest,
    });
    res.status(201).json({ ok: true, projectId: project.id });
  }),

  /** Agent 增量编辑：当前 HTML + 用户指令（可选附带图片）→ 修改后的完整 HTML */
  agentEdit: asyncHandler(async (req: Request, res: Response) => {
    const { currentHtml, instruction, images, campaignId, reportPeriod, scenario } = req.body;
    // ★ ④ 数据上下文：有 campaignId → 注入真实 DB 数据（AI 数据改动唯一真源），杜绝凭空编造
    const dataContext = campaignId
      ? await aiGenerateService.buildCampaignContext(campaignId, reportPeriod).catch(() => undefined)
      : undefined;
    // ★ 数据上下文 + 业务线指南：有 campaignId → 注入真实 DB 数据与指南（编辑风格与首稿一致）
    const { guide, businessLineName } = campaignId
      ? await resolveForCampaign(campaignId, scenario)
      : { guide: null, businessLineName: '' };
    const html = await aiGenerateService.editHtml({
      currentHtml,
      instruction,
      images,
      dataContext,
      guideContent: guide?.content,
      businessLineName,
    });
    res.json({ html, guideUsed: guide ? { id: guide.id, name: guide.name } : null });
  }),

  /** SSE 流式生成 HTML 报告 */
  generateStream: async (req: Request, res: Response) => {
    const { prompt, campaignId, scenario, reportPeriod } = req.body;
    initSSE(res);

    // AbortController: 前端断开连接时取消上游 fetch
    const abortCtrl = new AbortController();
    req.on('close', () => abortCtrl.abort());

    try {
      for await (const chunk of aiGenerateService.generateHtmlStream({
        campaignId,
        prompt: prompt || 'Generate a comprehensive campaign performance report',
        scenario,
        reportPeriod,
        signal: abortCtrl.signal,
      })) {
        if (chunk.type === 'done' && chunk.usage) {
          // token 用量透传给前端（done chunk 携带 usage 字段），同时落服务端日志供成本审计
          console.log('[generateStream] token usage', {
            user: req.user?.id,
            campaignId,
            ...chunk.usage,
          });
        }
        sseWrite(res, chunk);
      }
    } catch (err: any) {
      const isAbort = err?.name === 'AbortError' || /abort|terminated/i.test(String(err?.message || ''));
      if (!isAbort) {
        sseWrite(res, { type: 'error', message: err?.message || '流式生成失败' });
      }
    } finally {
      res.end();
    }
  },

  /** SSE 流式 Agent 增量编辑 */
  agentEditStream: async (req: Request, res: Response) => {
    const { currentHtml, instruction, images, campaignId, reportPeriod, scenario } = req.body;
    initSSE(res);

    const abortCtrl = new AbortController();
    req.on('close', () => abortCtrl.abort());

    try {
      // ★ ④ 数据上下文：有 campaignId → 注入真实 DB 数据（AI 数据改动唯一真源），杜绝凭空编造。
      //   失败不阻断编辑流（降级为旧行为，提示词铁律仍兜底）。
      const dataContext = campaignId
        ? await aiGenerateService.buildCampaignContext(campaignId, reportPeriod).catch(() => undefined)
        : undefined;
      // ★ 业务线指南：编辑风格与首稿一致（resolveForCampaign 静默降级，无指南不阻断）
      const { guide, businessLineName } = campaignId
        ? await resolveForCampaign(campaignId, scenario)
        : { guide: null, businessLineName: '' };
      for await (const chunk of aiGenerateService.editHtmlStream({
        currentHtml,
        instruction,
        images,
        dataContext,
        guideContent: guide?.content,
        businessLineName,
        signal: abortCtrl.signal,
      })) {
        sseWrite(res, chunk);
      }
    } catch (err: any) {
      const isAbort = err?.name === 'AbortError' || /abort|terminated/i.test(String(err?.message || ''));
      if (!isAbort) {
        sseWrite(res, { type: 'error', message: err?.message || '流式编辑失败' });
      }
    } finally {
      res.end();
    }
  },

  /** Agent 模式自动保存（直接覆盖 htmlContent，无版本管理） */
  autoSave: asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { html, agentHistory, aiPrompt, designMd } = req.body;
    const result = await htmlTemplateService.autoSaveHtml(projectId, html, agentHistory, aiPrompt, designMd);
    res.json(result);
  }),

  /** 创建 recipe 版本并设为 active(G1) */
  createRecipeVersion: asyncHandler(async (req: Request, res: Response) => {
    const auth = req.user as AuthPayload;
    const { projectId } = req.params;
    const { recipeId, reportPeriod } = req.body;
    const result = await htmlTemplateService.createRecipeVersion(projectId, auth.id, {
      recipeId,
      reportPeriod,
    });
    res.status(201).json(result);
  }),

  /** 按新时间段重算 recipe 版本(G2) */
  recompute: asyncHandler(async (req: Request, res: Response) => {
    const { versionId } = req.params;
    const { reportPeriod } = req.body;
    const result = await htmlTemplateService.recomputeRecipe(versionId, reportPeriod);
    res.json(result);
  }),

  /** 获取 Campaign 关联业务线的 design.md（供前端回显/编辑） */
  getDesignGuide: asyncHandler(async (req: Request, res: Response) => {
    const { campaignId } = req.params;
    const json = await aiGenerateService.buildCampaignContext(campaignId);
    let designMd = '';
    let businessLineName = '';
    let businessLineCode = '';
    try {
      const parsed = JSON.parse(json);
      designMd = parsed.designGuide ?? '';
      // businessLine 可能是对象 {code, name, logoUrl} 或字符串
      const bl = parsed.campaign?.businessLine;
      if (typeof bl === 'string') {
        businessLineName = bl;
        businessLineCode = bl;
      } else if (bl && typeof bl === 'object') {
        businessLineName = bl.name ?? bl.code ?? '';
        businessLineCode = bl.code ?? bl.name ?? '';
      }
    } catch { /* ignore */ }
    res.json({ designMd, businessLineName, businessLineCode });
  }),

  /** 返回系统提示词的 Markdown 展示版（仅供前端回显，不影响 AI 生成） */
  getSystemPrompt: asyncHandler(async (_req: Request, res: Response) => {
    res.json({ systemPrompt: SYSTEM_PROMPT_DISPLAY });
  }),

  /** 保存 recipe 配置(reportContent/tokenOverrides/manifestOverrides)到 HtmlVersion,
   *  触发重渲染并写回 html。编辑器「保存」用。 */
  saveRecipeConfig: asyncHandler(async (req: Request, res: Response) => {
    const { versionId } = req.params;
    const { reportContent, tokenOverrides, manifestOverrides } = req.body;
    await htmlTemplateService.saveRecipeConfig(versionId, {
      reportContent,
      tokenOverrides,
      manifestOverrides,
    });
    res.json({ ok: true });
  }),

  /** 实时重渲染不保存(编辑器预览用,debounced)。 */
  reRender: asyncHandler(async (req: Request, res: Response) => {
    const { recipeId, campaignId, reportContent, tokenOverrides, manifestOverrides } =
      req.body;
    const { getRecipe } = await import('./recipe');
    const html = await getRecipe(recipeId ?? 'campaign-report').render({
      campaignId,
      reportContent,
      tokenOverrides,
      manifestOverrides,
    });
    res.json({ html });
  }),
};
