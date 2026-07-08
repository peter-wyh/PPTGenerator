import { z } from 'zod';

/** 页面 schema：Template 与 Project 共用同一 Page 结构。 */
export const pageSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** 页面背景色（HEX）；与 bgImage 二选一。 */
  bgColor: z.string().max(20).optional(),
  /** 页面背景渐变；优先级在 bgImage 之下、bgColor 之上。 */
  bgGradient: z
    .object({
      type: z.enum(['linear', 'radial']),
      angle: z.number().optional(),
      stops: z.array(z.object({ color: z.string().max(20), position: z.number() })).min(2).max(6),
    })
    .optional(),
  /** 页面背景图 URL（cover 铺满）；优先于 bgColor。 */
  bgImage: z.string().max(2048).optional(),
  components: z.array(z.any()),
});

/** Campaign 信息（仅 campaign 类型场景）。 */
const campaignInfoSchema = z
  .object({
    campaignName: z.string().max(200).optional(),
    platform: z.string().max(100).optional(),
    startDate: z.string().max(40).optional(),
    endDate: z.string().max(40).optional(),
    budget: z.string().max(100).optional(),
  })
  .optional();

/** 项目主题（报告维度：结构化 ThemeSpec——color/font/density/radius/preset）。 */
const projectThemeSchema = z
  .object({
    color: z
      .object({
        primary: z.string().max(20).optional(),
        secondary: z.string().max(20).optional(),
        chartPalette: z.array(z.string().max(20)).optional(),
        neutralText: z.string().max(20).optional(),
        neutralBg: z.string().max(20).optional(),
      })
      .optional(),
    font: z
      .object({
        text: z.string().max(120).optional(),
        number: z.string().max(120).optional(),
        heading: z.string().max(120).optional(),
      })
      .optional(),
    density: z.enum(['compact', 'standard', 'spacious']).optional(),
    radius: z.enum(['sharp', 'small', 'large']).optional(),
    preset: z.string().max(120).optional(),
  })
  .optional();

/** 项目元数据：业务线/创建人/场景/子类/广告主/campaign 信息/主题。 */
export const projectMetaSchema = z
  .object({
    businessLine: z.string().max(40).optional(),
    creator: z.string().max(80).optional(),
    scenario: z.enum(['campaign-report', 'campaign-proposal', 'media-kit']).optional(),
    scenarioSub: z.enum(['weekly', 'monthly', 'wrap-up']).optional(),
    advertiser: z.string().max(120).optional(),
    campaignId: z.string().max(120).optional(),
    campaignInfo: campaignInfoSchema,
    theme: projectThemeSchema,
  })
  .optional();

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  width: z.number().int().min(1).max(8192).optional(),
  height: z.number().int().min(1).max(8192).optional(),
  pages: z.array(pageSchema).optional(),
  meta: projectMetaSchema,
});

export const updateProjectSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    width: z.number().int().min(1).max(8192).optional(),
    height: z.number().int().min(1).max(8192).optional(),
    pages: z.array(pageSchema).optional(),
    meta: projectMetaSchema,
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const idParamSchema = z.object({
  id: z.string().min(1),
});
