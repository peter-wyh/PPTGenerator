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

/** 页面类型（31 种，与前端 PageType 对齐；与模板 1:1）。 */
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
      'report-single-page', 'report-single-page-classic', 'report-single-page-dashboard', 'report-single-page-narrative', 'report-single-page-settlement', 'report-single-page-digchic',
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
        blBadge: z
          .object({
            visible: z.boolean().optional(),
            logo: z.string().max(2048).optional(),
            width: z.number().min(8).max(500).optional(),
            height: z.number().min(8).max(500).optional(),
            right: z.number().min(0).max(2000).optional(),
            top: z.number().min(0).max(2000).optional(),
            opacity: z.number().min(0).max(1).optional(),
            radius: z.number().min(0).max(200).optional(),
          })
          .optional(),
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

/** 受众画像单项（性别 / 年龄 / 城市占比）。 */
const audienceSliceSchema = z.object({
  label: z.string(),
  value: z.number(),
  color: z.string().max(20).optional(),
});

/** 达人受众画像（与 shared CreatorAudience 对齐）。 */
const creatorAudienceSchema = z.object({
  genderSplit: z.array(audienceSliceSchema).optional(),
  ageRange: z.array(audienceSliceSchema).optional(),
  topCities: z.array(audienceSliceSchema).optional(),
});

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
        /** 多平台多合作形式（reportCampaignFrom 从上游 Campaign 回填）。 */
        platforms: z
          .array(z.object({ platform: z.string().max(100), collaborationType: z.string().max(100) }))
          .optional(),
        /**
         * Campaign 分析包（趋势/洞察/品类/产品/地域/优惠码）。
         * 自动回填的大型嵌套数据、非用户输入——原样透传，避免严格 schema 漏字段再次被 strip。
         */
        analytics: z.unknown().optional(),
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
          audience: creatorAudienceSchema.optional(),
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
          audience: creatorAudienceSchema.optional(),
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
    /** DM 月报专用结构化数据。 */
    dmMonthly: z
      .object({
        heroImage: z.string().max(2048).optional(),
        channelContent: z
          .array(
            z.object({
              url: z.string(),
              label: z.string().max(200).optional(),
            }),
          )
          .optional(),
        products: z
          .array(
            z.object({
              id: z.string(),
              name: z.string(),
              image: z.string().max(2048).optional(),
              sales: z.string().max(50).optional(),
              clicks: z.string().max(50).optional(),
              roas: z.string().max(20).optional(),
            }),
          )
          .optional(),
        adPlacement: z
          .object({ url: z.string(), label: z.string().max(200).optional() })
          .optional(),
        featuredCreators: z
          .array(
            z.object({
              id: z.string(),
              name: z.string(),
              avatar: z.string().max(2048).optional(),
              handle: z.string().max(120).optional(),
              platform: z.string().max(100).optional(),
              followers: z.string().max(50).optional(),
            }),
          )
          .optional(),
        creatorPosts: z
          .array(
            z.object({
              id: z.string(),
              cover: z.string().max(2048).optional(),
              title: z.string(),
              platform: z.string().max(100).optional(),
            }),
          )
          .optional(),
      })
      .optional(),
    /** DM 双周报专用结构化数据。 */
    dmBiweekly: z
      .object({
        heroImage: z.string().max(2048).optional(),
        channelContent: z
          .array(
            z.object({
              url: z.string(),
              label: z.string().max(200).optional(),
            }),
          )
          .optional(),
        adPlacement: z
          .object({ url: z.string(), label: z.string().max(200).optional() })
          .optional(),
        creatorProfiles: z
          .array(
            z.object({
              url: z.string(),
              label: z.string().max(200).optional(),
            }),
          )
          .optional(),
        optimizationReview: z
          .array(
            z.object({
              url: z.string(),
              label: z.string().max(200).optional(),
            }),
          )
          .optional(),
        packageImages: z
          .array(
            z.object({
              url: z.string(),
              label: z.string().max(200).optional(),
            }),
          )
          .optional(),
        kpi: z
          .array(
            z.object({
              label: z.string(),
              value: z.string(),
              icon: z.string().max(50).optional(),
              trend: z.string().max(20).optional(),
            }),
          )
          .optional(),
      })
      .optional(),
  })
  .optional();
/** 页眉/页脚 logo 配置（与 shared HeaderLogo 对齐）。 */
const headerLogoSchema = z.object({
  src: z.string().max(2048).optional(),
  text: z.string().max(120).optional(),
  initials: z.string().max(20).optional(),
  logoHeight: z.number().min(8).max(200).optional(),
});

/** 页眉背景（与 shared HeaderBackground 对齐：纯色/渐变/图片 + 不透明度）。 */
const headerBackgroundSchema = z.object({
  type: z.enum(['color', 'gradient', 'image']).optional(),
  color: z.string().max(20).optional(),
  gradient: z.string().max(500).optional(),
  image: z.string().max(2048).optional(),
  /** 不透明度 0-1。 */
  opacity: z.number().min(0).max(1).optional(),
});

/**
 * 全局页眉配置（存于 meta.headerConfig）。
 * 历史回归：曾漏声明 → Zod 默认 strip 未知键 → validate 中间件覆盖回 req.body，
 * 导致「全局样式设置-页眉页脚」保存后刷新即丢失。声明后 Project/Template 共用。
 */
const headerConfigSchema = z.object({
  enabled: z.boolean(),
  height: z.number().min(8).max(400).optional(),
  preset: z
    .enum(['split', 'left-logos-right-text', 'left-text-right-logo', 'left-logo-right-text', 'center-text', 'custom'])
    .optional(),
  leftLogo: headerLogoSchema.optional(),
  rightLogo: headerLogoSchema.optional(),
  titleText: z.string().max(200).optional(),
  dateLabel: z.string().max(200).optional(),
  connector: z.string().max(20).optional(),
  /** 背景：旧字符串形状（纯色 HEX）或新结构化 HeaderBackground。 */
  background: z.union([z.string().max(2048), headerBackgroundSchema]).optional(),
  borderColor: z.string().max(20).optional(),
});

/** 全局页脚配置（存于 meta.footerConfig）。 */
const footerConfigSchema = z.object({
  enabled: z.boolean(),
  height: z.number().min(8).max(200).optional(),
  leftText: z.string().max(200).optional(),
  rightText: z.string().max(120).optional(),
  background: z.string().max(20).optional(),
});

/** 报告时间范围（月报=选月 "YYYY-MM"；周报/双周报=选起止日期）。 */
const reportPeriodSchema = z.object({
  month: z.string().max(20).optional(),
  startDate: z.string().max(40).optional(),
  endDate: z.string().max(40).optional(),
});

/** 从模版创建项目时的 body（/from-template）。 */
export const fromTemplateSchema = z.object({
  templateId: z.string().min(1),
  name: z.string(),
  reportPeriod: reportPeriodSchema.optional(),
});

const projectMetaFields = {
  businessLine: z.string().max(40).optional(),
  creator: z.string().max(80).optional(),
  scenario: z.enum(['campaign-report', 'campaign-proposal', 'media-kit']).optional(),
  scenarioSub: z.enum(['weekly', 'biweekly', 'monthly', 'wrap-up']).optional(),
  /** 模版类型：场景下细分，松字符串，取值由前端字典约束。 */
  templateType: z.string().max(40).optional(),
  /** 样式类型：PPT 多页 / AI 生成 HTML。旧 'single' 已废弃，存量数据按 ppt 处理。 */
  styleType: z.enum(['ppt', 'ai-html']).optional(),
  advertiser: z.string().max(120).optional(),
  campaignId: z.string().max(120).optional(),
  campaignInfo: campaignInfoSchema,
  theme: projectThemeSchema,
  reportData: reportDataContextSchema,
  /** 全局页眉/页脚配置（ReportSettingsOverlay「页眉页脚」分区编辑，自动渲染在每页顶/底）。 */
  headerConfig: headerConfigSchema.optional(),
  footerConfig: footerConfigSchema.optional(),
  /** 报告时间范围（驱动报告标题周期文案）。 */
  reportPeriod: reportPeriodSchema.optional(),
  /** 渲染类型：multi-page / html-report（P1-15，模板管理流；长图海报已裁撤）。 */
  renderType: z.string().max(40).optional(),
  /** AI HTML 报告生成状态（HtmlStudio 写入，项目列表状态徽标读取）。 */
  aiHtmlStatus: z.enum(['generated', 'generating', 'pending']).optional(),
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

/** 复制项目时的可选 body（新周期）。 */
export const duplicateSchema = z.object({
  reportPeriod: z.object({
    month: z.string().max(20).optional(),
    startDate: z.string().max(40).optional(),
    endDate: z.string().max(40).optional(),
  }).optional(),
}).optional();

export const idParamSchema = z.object({
  id: z.string().min(1),
});
