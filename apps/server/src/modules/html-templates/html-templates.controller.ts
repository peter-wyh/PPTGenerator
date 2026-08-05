import type { Request, Response } from 'express';
import { htmlTemplateService } from './html-templates.service';
import { aiGenerateService } from './ai-generate.service';
import { asyncHandler } from '../../utils/asyncHandler';
import type { AuthPayload } from '../../types/express';
import type { TemplateStatus } from '@prisma/client';

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

  /** Generate HTML report: template mode or AI mode */
  generate: asyncHandler(async (req: Request, res: Response) => {
    const { mode, templateId, prompt, campaignId, theme } = req.body;

    let html: string;

    if (mode === 'template') {
      if (!templateId) throw new Error('templateId is required for template mode');
      // Build campaign context if available
      let campaignData: Record<string, any> = {};
      if (campaignId) {
        const json = await aiGenerateService.buildCampaignContext(campaignId);
        campaignData = JSON.parse(json);
      }
      html = await htmlTemplateService.generateFromTemplate(templateId, campaignData);
    } else {
      // AI mode
      html = await aiGenerateService.generateHtml({
        campaignId,
        prompt: prompt || 'Generate a comprehensive campaign performance report',
        theme,
        designMd: req.body.designMd,
      });
    }

    res.json({ html });
  }),

  /** 保存生成的 HTML 到项目 */
  saveHtml: asyncHandler(async (req: Request, res: Response) => {
    const auth = req.user as AuthPayload;
    const { projectId } = req.params;
    const { html } = req.body;
    await htmlTemplateService.saveHtmlToProject(projectId, auth.id, html);
    res.json({ ok: true });
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
      businessLineName = parsed.campaign?.businessLine ?? '';
      businessLineCode = businessLineName;
    } catch { /* ignore */ }
    res.json({ designMd, businessLineName, businessLineCode });
  }),
};
