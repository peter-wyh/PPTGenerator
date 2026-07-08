import type { Request, Response } from 'express';
import { projectsService } from './projects.service';
import { asyncHandler } from '../../utils/asyncHandler';
import type { AuthPayload } from '../../types/express';

function owner(req: Request): string {
  return (req.user as AuthPayload).id;
}

export const projectsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    res.json({ projects: await projectsService.list(owner(req)) });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ project: await projectsService.create(owner(req), req.body) });
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    res.json({ project: await projectsService.getOwnedOrThrow(owner(req), req.params.id) });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    res.json({ project: await projectsService.update(owner(req), req.params.id, req.body) });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await projectsService.remove(owner(req), req.params.id);
    res.status(204).end();
  }),

  duplicate: asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ project: await projectsService.duplicate(owner(req), req.params.id) });
  }),

  createFromTemplate: asyncHandler(async (req: Request, res: Response) => {
    const { templateId, name } = req.body as { templateId?: string; name?: string };
    if (!templateId) {
      res.status(400).json({ message: 'templateId is required' });
      return;
    }
    res
      .status(201)
      .json({ project: await projectsService.createFromTemplate(owner(req), templateId, name) });
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
