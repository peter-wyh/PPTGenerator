import type { Request, Response } from 'express';
import { templatesService } from './templates.service';
import { asyncHandler } from '../../utils/asyncHandler';
import type { AuthPayload } from '../../types/express';
import type { TemplateStatus } from '@prisma/client';

function owner(req: Request): string {
  return (req.user as AuthPayload).id;
}
function role(req: Request): 'ADMIN' | 'USER' {
  return (req.user as AuthPayload).role;
}

export const templatesController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      status: (req.query.status as TemplateStatus | undefined) ?? undefined,
      businessLine: (req.query.businessLine as string | undefined) ?? undefined,
      scenario: (req.query.scenario as string | undefined) ?? undefined,
      templateType: (req.query.templateType as string | undefined) ?? undefined,
      isDefault:
        req.query.isDefault === undefined ? undefined : req.query.isDefault === 'true',
    };
    res.json({ templates: await templatesService.list(role(req), filters) });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ template: await templatesService.create(owner(req), req.body) });
  }),

  createFromProjectPage: asyncHandler(async (req: Request, res: Response) => {
    res
      .status(201)
      .json({ template: await templatesService.createFromProjectPage(owner(req), req.body) });
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    // ADMIN 取自己的（含草稿）；普通用户只能取已发布。
    if (role(req) === 'ADMIN') {
      res.json({ template: await templatesService.getOwnedDetailOrThrow(owner(req), req.params.id) });
    } else {
      res.json({ template: await templatesService.getPublishedOrThrow(req.params.id) });
    }
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    res.json({ template: await templatesService.update(owner(req), req.params.id, req.body) });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await templatesService.remove(owner(req), req.params.id);
    res.status(204).end();
  }),

  duplicate: asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ template: await templatesService.duplicate(owner(req), req.params.id) });
  }),

  setDefault: asyncHandler(async (req: Request, res: Response) => {
    const { value } = req.body as { value: boolean };
    res.json({ template: await templatesService.setDefault(owner(req), req.params.id, value) });
  }),
};
