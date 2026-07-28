import type { Request, Response } from 'express';
import { schemesService } from './schemes.service';
import { asyncHandler } from '../../utils/asyncHandler';
import type { AuthPayload } from '../../types/express';

function owner(req: Request): string {
  return (req.user as AuthPayload).id;
}

export const schemesController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const businessLineCode = (req.query.businessLineCode as string | undefined) ?? undefined;
    const enabled =
      req.query.enabled === undefined ? undefined : req.query.enabled === 'true';
    const schemes = await schemesService.list({ businessLineCode, enabled });
    res.json({ schemes });
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    res.json({ scheme: await schemesService.getByIdOrThrow(req.params.id) });
  }),

  getByCode: asyncHandler(async (req: Request, res: Response) => {
    res.json({ scheme: await schemesService.getByCodeOrThrow(req.params.code) });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ scheme: await schemesService.create(owner(req), req.body) });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    res.json({ scheme: await schemesService.update(req.params.id, req.body) });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await schemesService.remove(req.params.id);
    res.status(204).end();
  }),
};
