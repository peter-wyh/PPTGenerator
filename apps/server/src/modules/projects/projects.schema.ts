import { z } from 'zod'

export const createProjectSchema = z.object({
  name: z.string().min(1).max(120),
})

export const updateProjectSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    canvasWidth: z.number().int().min(1).optional(),
    canvasHeight: z.number().int().min(1).optional(),
    pages: z.unknown().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' })

export const projectIdParams = z.object({ id: z.string().min(1) })
