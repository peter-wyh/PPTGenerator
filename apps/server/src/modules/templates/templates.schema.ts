import { z } from 'zod';
import { pageSchema, templateMetaSchema, setDefaultSchema } from '../projects/projects.schema';

export const templateStatusSchema = z.enum(['DRAFT', 'PUBLISHED']);

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  width: z.number().int().min(1).max(8192).optional(),
  height: z.number().int().min(1).max(8192).optional(),
  pages: z.array(pageSchema).optional(),
  meta: templateMetaSchema,
  note: z.string().max(1000).optional(),
});

export const updateTemplateSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    width: z.number().int().min(1).max(8192).optional(),
    height: z.number().int().min(1).max(8192).optional(),
    pages: z.array(pageSchema).optional(),
    meta: templateMetaSchema,
    note: z.string().max(1000).nullable().optional(),
    status: templateStatusSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const idParamSchema = z.object({ id: z.string().min(1) });

export const fromProjectPageSchema = z.object({
  projectId: z.string().min(1),
  pageId: z.string().min(1),
  name: z.string().min(1).max(200),
  width: z.number().int().min(1).max(8192).optional(),
  height: z.number().int().min(1).max(8192).optional(),
  meta: templateMetaSchema,
  note: z.string().max(1000).optional(),
  overwrite: z.boolean().optional(),
});

export const fromProjectSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(200),
  meta: templateMetaSchema,
  note: z.string().max(1000).optional(),
  overwrite: z.boolean().optional(),
});

export { setDefaultSchema };

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type FromProjectPageInput = z.infer<typeof fromProjectPageSchema>;
export type FromProjectInput = z.infer<typeof fromProjectSchema>;
