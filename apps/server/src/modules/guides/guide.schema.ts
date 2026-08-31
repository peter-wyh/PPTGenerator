import { z } from 'zod';
import { idParamSchema } from '../projects/projects.schema';

export const createGuideSchema = z.object({
  businessLineId: z.string().min(1),
  name: z.string().min(1).max(191),
  scenario: z.string().max(64).optional(),
  content: z.string().min(1),
  /** 结构指南自带全套视觉规范→生成时跳过业务线视觉层注入(deck 场景)。 */
  overridesVisual: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const updateGuideSchema = createGuideSchema.partial();

/** GET /api/v1/guides?businessLineId= */
export const listGuidesQuerySchema = z.object({
  businessLineId: z.string().optional(),
});

export { idParamSchema };
