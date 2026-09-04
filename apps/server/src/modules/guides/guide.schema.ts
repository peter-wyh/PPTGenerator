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

/* ═══ S1 GuideRevision 版本管理 ═══ */

/** 断言模板:assert 为 DSL 字符串,由 html-validator 解析执行(业务从下拉模板选,不手写表达式)。 */
const checkSchema = z.object({
  assert: z.string().min(1).max(191),
  severity: z.enum(['report', 'block']).default('report'),
  message: z.string().max(191).optional(),
});

const assetRefSchema = z.object({
  kind: z.enum(['sample', 'tokens', 'checklist']),
  ref: z.string().min(1).max(255),
  hash: z.string().max(128).optional(),
  name: z.string().max(191).optional(),
});

export const saveRevisionSchema = z.object({
  content: z.string().min(1),
  assets: z.array(assetRefSchema).max(20).optional(),
  checks: z.array(checkSchema).max(50).optional(),
  toolParams: z
    .object({
      max_tokens: z.number().int().min(1000).max(100000).optional(),
      retries: z.number().int().min(0).max(5).optional(),
      disabled_tools: z.array(z.string().max(64)).max(10).optional(),
    })
    .optional(),
  changelog: z.string().max(500).optional(),
  force: z.boolean().optional(),
});

export const activateRevisionSchema = z.object({
  version: z.number().int().min(1),
});

export const revisionParamsSchema = z.object({
  id: z.string().min(1),
  version: z.coerce.number().int().min(1),
});

/** POST /guides/:id/revisions/dry-run */
export const dryRunSchema = z.object({
  checks: z.array(checkSchema).max(50),
  html: z.string().min(1).max(2_000_000).optional(),
});

export { idParamSchema };
