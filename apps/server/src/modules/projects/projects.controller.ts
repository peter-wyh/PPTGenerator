import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import * as service from './projects.service'

export const list = asyncHandler(async (req: Request, res: Response) => {
  res.json({ projects: await service.list(req.user!) })
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const project = await service.create(req.user!, req.body.name)
  res.status(201).json({ project })
})

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const project = await service.getOwnedProject(req.params.id, req.user!)
  res.json({ project })
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const project = await service.update(req.params.id, req.user!, req.body)
  res.json({ project })
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await service.remove(req.params.id, req.user!)
  res.json({ ok: true })
})

export const duplicate = asyncHandler(async (req: Request, res: Response) => {
  const project = await service.duplicate(req.params.id, req.user!)
  res.status(201).json({ project })
})
