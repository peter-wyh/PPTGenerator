import { z } from 'zod';

/**
 * 历史遗留：旧编辑器版本曾把页面「大类」（PageCategory）误当作 pageType 持久化。
 * 当前枚举不含这些值，旧项目再次保存会被 Zod 拒绝（HTTP 400）。
 * 这里把它们归一为 undefined（页面降为普通页，组件/标题不动）——惰性数据迁移，
 * 既修复存量项目，又保留枚举对真正非法值的严格校验。
 */
const LEGACY_CATEGORY_AS_PAGE_TYPE = new Set([
  'campaign-report',
  'creator-case',
  'media-report',
  'creator-collab',
]);

/** 页面类型（27 种，与前端 PageType 对齐；与模板 1:1）。 */
const pageTypeSchema = z.preprocess(
  (v) => (typeof v === 'string' && LEGACY_CATEGORY_AS_PAGE_TYPE.has(v) ? undefined : v),
  z
    .enum([
      // 基础
      'blank', 'title', 'overview', 'table',
      // 投放报告
      'report-weekly-overview', 'report-monthly-overview', 'report-channel',
      'report-product', 'report-creator-collab', 'report-placement',
      'report-posts', 'report-wrapup-review', 'content-analysis', 'funnel',
      // 公司 · 品牌
      'cover', 'agenda', 'company', 'package', 'milestone', 'global', 'org', 'service',
      // 达人 · 案例
      'creator', 'case',
      // 策略 · 内容
      'challenge', 'process', 'calendar', 'campaign-plan',
      // 媒介包（media-kit 专属）
      'audience-portrait', 'account-overview', 'brand-collab',
    ])
    .optional(),
);

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
  /** 页面业务类型。 */
  pageType: pageTypeSchema,
  /** 绑定的 Campaign ID（campaign-report / creator-collab 类型用）。 */
  campaignId: z.string().max(120).optional(),
  /** 绑定的达人 ID（creator-case / creator-collab 类型用）。 */
  creatorId: z.string().max(120).optional(),
  /** 标题组件 id。 */
  titleComponentId: z.string().max(64).optional(),
  /** 用户手改过标题。 */
  titleOverridden: z.boolean().optional(),
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
    layout: z
      .object({
        safeMargin: z.number().min(0).max(500),
        gridSize: z.number().min(1).max(100),
        showGrid: z.boolean().optional(),
        showSafeArea: z.boolean().optional(),
      })
      .optional(),
    lineHeight: z
      .object({ mode: z.enum(['ratio', 'fixed']), value: z.number().min(0).max(100) })
      .optional(),
    heading: z
      .object({
        fontSize: z.number().min(8).max(200).optional(),
        variant: z
          .enum(['plain', 'bar-left', 'underline', 'gradient', 'card', 'numbered', 'highlight', 'accent-tag', 'accent-underline', 'block-underline'])
          .optional(),
        color: z.string().max(20).optional(),
      })
      .optional(),
    format: z
      .object({
        currencySymbol: z.string().min(1).max(8),
        currencyPosition: z.enum(['before', 'after']),
        thousandsSep: z.boolean(),
        decimals: z.union([z.literal(0), z.literal(1), z.literal(2)]),
        compact: z.enum(['none', 'auto']),
      })
      .optional(),
    chart: z
      .object({
        showAxis: z.boolean(),
        showGrid: z.boolean(),
        legendPosition: z.enum(['none', 'top', 'bottom', 'right']),
        barRadius: z.number().min(0).max(16),
      })
      .optional(),
    shadow: z.enum(['none', 'subtle', 'soft', 'strong']).optional(),
    branding: z
      .object({
        logo: z.string().max(2048).optional(),
        title: z.string().max(200).optional(),
        subtitle: z.string().max(200).optional(),
        logoHeight: z.number().min(8).max(200).optional(),
        logoRadius: z.number().min(0).max(64).optional(),
      })
      .optional(),
    background: z
      .object({
        type: z.enum(['none', 'color', 'gradient', 'image']),
        color: z.string().max(20).optional(),
        gradient: z
          .object({
            type: z.enum(['linear', 'radial']),
            angle: z.number().optional(),
            stops: z
              .array(z.object({ color: z.string().max(20), position: z.number() }))
              .min(2)
              .max(6),
          })
          .optional(),
        image: z.string().max(2048).optional(),
      })
      .optional(),
    preset: z.string().max(120).optional(),
    /** 皮肤预设（与 color/font 正交，控制圆角+阴影档位）。 */
    skinPreset: z.enum(['default', 'flat', 'elevated']).optional(),
  })
  .optional();

/** 报告数据上下文 schema（Campaign + 达人列表）。 */
const reportDataContextSchema = z
  .object({
    campaign: z
      .object({
        id: z.string(),
        name: z.string(),
        advertiser: z.string().max(200).optional(),
        platform: z.string().max(100).optional(),
        startDate: z.string().max(40).optional(),
        endDate: z.string().max(40).optional(),
        budget: z.string().max(100).optional(),
        status: z.string().max(40).optional(),
        metrics: z
          .array(
            z.object({
              label: z.string(),
              value: z.string(),
              compare: z.string(),
            }),
          )
          .optional(),
      })
      .nullable()
      .optional(),
    campaignCreators: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          handle: z.string().optional(),
          platform: z.string().optional(),
          tier: z.string().optional(),
          followers: z.string().optional(),
          engagement: z.string().optional(),
          category: z.string().optional(),
          region: z.string().optional(),
          avatar: z.string().max(2048).optional(),
          stats: z
            .array(
              z.object({
                key: z.string().optional(),
                label: z.string(),
                value: z.string(),
                color: z.string(),
                selected: z.boolean().optional(),
              }),
            )
            .optional(),
        }),
      )
      .optional(),
    creators: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          handle: z.string().optional(),
          platform: z.string().optional(),
          tier: z.string().optional(),
          followers: z.string().optional(),
          engagement: z.string().optional(),
          category: z.string().optional(),
          region: z.string().optional(),
          avatar: z.string().max(2048).optional(),
          stats: z
            .array(
              z.object({
                key: z.string().optional(),
                label: z.string(),
                value: z.string(),
                color: z.string(),
                selected: z.boolean().optional(),
              }),
            )
            .optional(),
        }),
      )
      .optional(),
    /** 商品列表（Campaign CPS 数据）。 */
    products: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          image: z.string().max(2048).optional(),
          price: z.string().max(50).optional(),
          originalPrice: z.string().max(50).optional(),
          advertiser: z.string().max(200).optional(),
          businessLine: z.string().max(40).optional(),
          category: z.string().max(100).optional(),
          gmv: z.string().max(50).optional(),
          orders: z.string().max(50).optional(),
          clicks: z.string().max(50).optional(),
          cvr: z.string().max(20).optional(),
          roas: z.string().max(20).optional(),
          commission: z.string().max(50).optional(),
          spend: z.string().max(50).optional(),
          status: z.enum(['active', 'paused', 'sold-out']).optional(),
        }),
      )
      .optional(),
  })
  .optional();
const projectMetaFields = {
  businessLine: z.string().max(40).optional(),
  creator: z.string().max(80).optional(),
  scenario: z.enum(['campaign-report', 'campaign-proposal', 'media-kit']).optional(),
  scenarioSub: z.enum(['weekly', 'monthly', 'wrap-up']).optional(),
  /** 模版类型：场景下细分，松字符串，取值由前端字典约束。 */
  templateType: z.string().max(40).optional(),
  /** 样式类型：PPT 多页 / 单页面。 */
  styleType: z.enum(['ppt', 'single-page']).optional(),
  advertiser: z.string().max(120).optional(),
  campaignId: z.string().max(120).optional(),
  campaignInfo: campaignInfoSchema,
  theme: projectThemeSchema,
  reportData: reportDataContextSchema,
};

/** 项目元数据 schema（Template 与 Project 共用同一 meta 结构）。 */
export const projectMetaSchema = z.object(projectMetaFields).optional();

/** 模板 meta：在项目 meta 基础上增加 isDefault（默认模板标记，仅模板用）。 */
export const templateMetaSchema = z
  .object({ ...projectMetaFields, isDefault: z.boolean().optional() })
  .optional();

/** 设/取消默认模板的 body 校验。 */
export const setDefaultSchema = z.object({ value: z.boolean() });

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
