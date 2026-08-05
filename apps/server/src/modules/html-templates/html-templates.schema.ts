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
  /** 生成模式：template = 选模板填充；ai = AI 提示词生成 */
  mode: z.enum(['template', 'ai']),
  /** template 模式：使用指定模板 ID */
  templateId: z.string().optional(),
  /** ai 模式：用户输入的自然语言提示词 */
  prompt: z.string().optional(),
  /** Campaign ID — 提供 campaign 数据作为填充/AI context */
  campaignId: z.string().optional(),
  /** 主题色（可选，默认跟随报告主题） */
  theme: z.enum(['light', 'dark']).optional(),
  /** 业务线 design.md 内容（前端编辑后的值，覆盖 DB 值） */
  designMd: z.string().optional(),
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
