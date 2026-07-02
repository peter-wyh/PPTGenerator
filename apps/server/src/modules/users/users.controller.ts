import type { Request, Response } from 'express';
import { usersService } from './users.service';
import { asyncHandler } from '../../utils/asyncHandler';

export const usersController = {
  list: asyncHandler(async (_req: Request, res: Response) => {
    res.json({ users: await usersService.list() });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ user: await usersService.create(req.body) });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    res.json({ user: await usersService.update(req.params.id, req.body) });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await usersService.remove(req.params.id);
    res.status(204).end();
  }),
};
