import type { Request, Response } from 'express';
import type { z } from 'zod';
import { dataService } from './data.service';
import { asyncHandler } from '../../utils/asyncHandler';
import type { AuthPayload } from '../../types/express';
import { kindSchema } from './data.schema';

type Kind = z.infer<typeof kindSchema>;

function owner(req: Request): string {
  return (req.user as AuthPayload).id;
}

export const dataController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const kind = (req.query as { kind: Kind }).kind;
    res.json({ records: await dataService.list(kind) });
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    res.json({ record: await dataService.getOrThrow(req.params.id) });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const { kind, data } = req.body as { kind: Kind; data: unknown };
    res.status(201).json({ record: await dataService.create(owner(req), kind, data) });
  }),

  import: asyncHandler(async (req: Request, res: Response) => {
    const { kind, items } = req.body as { kind: Kind; items: unknown[] };
    res.json(await dataService.importMany(owner(req), kind, items));
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const { data } = req.body as { data: unknown };
    res.json({ record: await dataService.update(req.params.id, data) });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await dataService.remove(req.params.id);
    res.status(204).end();
  }),

  clear: asyncHandler(async (req: Request, res: Response) => {
    const kind = (req.query as { kind: Kind }).kind;
    res.json(await dataService.clear(kind));
  }),
};
