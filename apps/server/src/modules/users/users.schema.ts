import { z } from 'zod'

export const createUserSchema = z.object({
  username: z.string().min(2).max(40),
  password: z.string().min(6).max(100),
  role: z.enum(['ADMIN', 'USER']).default('USER'),
})

export const updateUserSchema = z
  .object({
    password: z.string().min(6).max(100).optional(),
    role: z.enum(['ADMIN', 'USER']).optional(),
  })
  .refine((v) => v.password !== undefined || v.role !== undefined, {
    message: 'Nothing to update',
  })

export const userIdParams = z.object({ id: z.string().min(1) })
