import type { Request, Response } from 'express';
import { projectsService } from './projects.service';
import { htmlTemplateService } from '../html-templates/html-templates.service';
import { asyncHandler } from '../../utils/asyncHandler';
import type { AuthPayload } from '../../types/express';

function owner(req: Request): string {
  return (req.user as AuthPayload).id;
}

export const projectsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const v = req.user as AuthPayload;
    res.json({ projects: await projectsService.list(owner(req), v.role === 'ADMIN') });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const { detail, seeded } = await projectsService.create(owner(req), req.body);
    res.status(201).json({ project: detail, seeded });
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    res.json({ project: await projectsService.getOwnedOrThrow(owner(req), req.params.id) });
  }),

  getHtml: asyncHandler(async (req: Request, res: Response) => {
    res.json(await projectsService.getHtml(owner(req), req.params.id));
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    res.json({ project: await projectsService.update(owner(req), req.params.id, req.body) });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await projectsService.remove(owner(req), req.params.id);
    res.status(204).end();
  }),

  duplicate: asyncHandler(async (req: Request, res: Response) => {
    const { reportPeriod } = req.body as { reportPeriod?: { month?: string; startDate?: string; endDate?: string } };
    res.status(201).json({ project: await projectsService.duplicate(owner(req), req.params.id, reportPeriod) });
  }),

  createFromTemplate: asyncHandler(async (req: Request, res: Response) => {
    const { templateId, name, reportPeriod } = req.body as {
      templateId?: string;
      name?: string;
      reportPeriod?: { startDate?: string; endDate?: string };
    };
    if (!templateId) {
      res.status(400).json({ message: 'templateId is required' });
      return;
    }
    const project = await projectsService.createFromTemplate(owner(req), templateId, name, reportPeriod);
    // HTML 模版且绑了 campaign → 建活 recipe 版本(数据实时,只能改周期);否则保留静态 htmlContent 兜底
    const meta = (project.meta ?? {}) as Record<string, unknown>;
    if ((meta.styleType === 'ai-html' || meta.renderType === 'html-report') && meta.campaignId) {
      await htmlTemplateService.createRecipeVersion(project.id, owner(req), { reportPeriod });
    }
    res.status(201).json({ project });
  }),

  createShare: asyncHandler(async (req: Request, res: Response) => {
    const shareToken = await projectsService.createShareToken(owner(req), req.params.id);
    res.json({ shareToken });
  }),

  revokeShare: asyncHandler(async (req: Request, res: Response) => {
    await projectsService.revokeShareToken(owner(req), req.params.id);
    res.status(204).end();
  }),
};
