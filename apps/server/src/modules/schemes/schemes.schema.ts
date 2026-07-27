import { z } from 'zod';

/** 路径参数 id 校验。 */
export const idParamSchema = z.object({ id: z.string().min(1) });

/** 路径参数 code 校验。 */
export const codeParamSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'code 只能包含小写字母、数字和连字符'),
});

/** 新建方案校验。 */
export const createSchemeSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'code 只能包含小写字母、数字和连字符'),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  businessLineCode: z.string().max(50).optional(),
  pageCount: z.number().int().min(1).max(200).optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  defaultStyle: z.string().max(100).optional(),
});

/** 更新方案校验（全部可选）。 */
export const updateSchemeSchema = z
  .object({
    code: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9-]+$/, 'code 只能包含小写字母、数字和连字符')
      .optional(),
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).nullable().optional(),
    businessLineCode: z.string().max(50).nullable().optional(),
    pageCount: z.number().int().min(1).max(200).optional(),
    enabled: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    defaultStyle: z.string().max(100).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export type CreateSchemeInput = z.infer<typeof createSchemeSchema>;
export type UpdateSchemeInput = z.infer<typeof updateSchemeSchema>;
