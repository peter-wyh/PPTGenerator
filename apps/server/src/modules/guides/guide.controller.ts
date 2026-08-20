import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { guideService } from './guide.service';

export const guideController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { businessLineId } = req.query as { businessLineId?: string };
    res.json({ guides: await guideService.list({ businessLineId }) });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ guide: await guideService.create(req.body) });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    res.json({ guide: await guideService.update(req.params.id, req.body) });
  }),
};
