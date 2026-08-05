import { z } from 'zod';

export const createHtmlTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  html: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  thumbnail: z.string().url().optional().or(z.literal('')),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
});

export const updateHtmlTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  html: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  thumbnail: z.string().url().optional().or(z.literal('')).or(z.literal(null)),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
});

export const idParamSchema = z.object({
  id: z.string().min(1),
});

export const generateHtmlSchema = z.object({
  /** 生成模式:ai = AI 提示词生成;recipe = 模板化数据驱动(可换数据) */
  mode: z.enum(['ai', 'recipe']),
  /** recipe 模式:使用指定 recipe id(默认 'campaign-report') */
  recipeId: z.string().optional(),
  /** ai 模式:提示词 */
  prompt: z.string().optional(),
  campaignId: z.string().optional(),
  theme: z.enum(['light', 'dark']).optional(),
  designMd: z.string().optional(),
  reportPeriod: z.object({ startDate: z.string(), endDate: z.string() }).optional(),
});

/** 从 Campaign 生成 HTML 报告时，直接创建新报告并保存 HTML */
export const saveHtmlAsProjectSchema = z.object({
  html: z.string().min(1),
  campaignId: z.string().min(1),
  name: z.string().min(1).max(200),
  businessLine: z.string().optional(),
  creator: z.string().optional(),
  advertiser: z.string().optional(),
  scenario: z.string().optional(),
  scenarioSub: z.string().optional(),
});

/** Agent 增量编辑：当前 HTML + 用户指令 → 修改后的 HTML */
export const agentEditSchema = z.object({
  currentHtml: z.string().min(1),
  instruction: z.string().min(1).max(2000),
});
