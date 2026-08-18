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
  images: z.array(z.string()).optional(), // base64 编码的图片（data URL）
  // ★ ④ 数据上下文：可选 campaignId + reportPeriod，服务端据此注入真实 DB 数据（防伪造）
  campaignId: z.string().max(120).optional(),
  reportPeriod: z.object({
    startDate: z.string().max(40).optional(),
    endDate: z.string().max(40).optional(),
  }).optional(),
});

/**
 * 保存 recipe 配置到 HtmlVersion(reportContent/tokenOverrides/manifestOverrides),
 * 触发重渲染并写回 html。所有字段 optional — 未传则沿用 version 现值。
 */
export const saveRecipeConfigSchema = z.object({
  reportContent: z.any().optional(),
  tokenOverrides: z.record(z.any()).optional(),
  manifestOverrides: z
    .object({
      order: z.array(z.string()).optional(),
      hidden: z.array(z.string()).optional(),
    })
    .optional(),
});

/**
 * 实时重渲染(不保存)。编辑器预览用,支持任意 recipeId/campaignId + 三类覆盖。
 */
export const reRenderSchema = z.object({
  recipeId: z.string().optional(),
  campaignId: z.string().optional(),
  reportContent: z.any().optional(),
  tokenOverrides: z.record(z.any()).optional(),
  manifestOverrides: z
    .object({
      order: z.array(z.string()).optional(),
      hidden: z.array(z.string()).optional(),
    })
    .optional(),
});

export const createRecipeVersionSchema = z.object({
  recipeId: z.string().optional(),
  reportPeriod: z.object({ startDate: z.string(), endDate: z.string() }).optional(),
});

export const recomputeSchema = z.object({
  reportPeriod: z.object({ startDate: z.string(), endDate: z.string() }),
});
