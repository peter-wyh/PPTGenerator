/**
 * 主题 / 字体 / 风格预设类型定义（仅类型；运行时常量见 ../theme/presets.ts）。
 */
import type { Scenario, ScenarioSub, CampaignInfo, ReportDataContext } from './campaign';
import type { PageGradient } from './page';

/**
 * 字体选项：预置字体清单，前后端共享。
 * key 为唯一标识（存入 ProjectTheme.font.text/number/heading），
 * stack 为 CSS font-family 值，loadUrl 为 Google Fonts <link>（按需注入 <head>）。
 */
export interface FontOption {
  key: string; // 'noto-sans-sc'
  label: string; // '思源黑体'
  category: 'text' | 'number' | 'heading';
  stack: string; // 实际 CSS font-family 值
  loadUrl?: string; // Google Fonts <link>，按需注入 <head>
}

/**
 * 自定义字体元数据（用户上传的本地字体）。
 * 前后端共享：服务端 FontRecord 字段子集，前端据此生成 @font-face。
 * 与 FontOption 互补：FontOption 是预置的 Google Fonts，CustomFontMeta 是上传的本地字体。
 */
export interface CustomFontMeta {
  /** 唯一 id（服务端 FontRecord.id）。 */
  id: string;
  /** 字体家族名（用于 @font-face font-family 与显示）。 */
  name: string;
  /** 稳定 key（追加到 FontSelect 选项 value，格式 'custom-xxx-slug'）。 */
  key: string;
  /** 公开访问 URL（/uploads/fonts/<file> 或 OSS 绝对 URL）。 */
  url: string;
  /** CSS format() 值（truetype / opentype / woff / woff2）。 */
  format: 'truetype' | 'opentype' | 'woff' | 'woff2';
  /** 原始文件名（UI 展示）。 */
  originalName: string;
  /** 文件大小（字节）。 */
  size: number;
  /** 上传时间 ISO。 */
  uploadedAt: string;
}

/** 整体风格预设：一整套 ProjectTheme 值，点中即填入报告设置。 */
export interface StylePreset {
  key: string; // 'business-sober'
  name: string; // '商务沉稳'
  description: string;
  theme: ProjectTheme; // 一整套值
}

/** 密度：紧凑 / 标准 / 舒适 / 宽松。 */
export type ThemeDensity = 'compact' | 'standard' | 'comfortable' | 'spacious';
/** 圆角：直角 / 小圆角 / 中圆角 / 大圆角。 */
export type ThemeRadius = 'sharp' | 'small' | 'medium' | 'large';

/** v2 派生类型（供 theme.tsx / 测试 / 格式化器引用）。 */
export type LineHeightMode = 'ratio' | 'fixed';
export type CurrencyPosition = 'before' | 'after';
export type NumberCompact = 'none' | 'auto';
export type ThemeShadow = 'none' | 'subtle' | 'soft' | 'strong';
export type ChartLegendPosition = 'none' | 'top' | 'bottom' | 'right';
export type ThemeFormat = NonNullable<ProjectTheme['format']>;

/** 项目主题（报告维度配置）：结构化 ThemeSpec，驱动编辑器整树换肤。 */
export interface ProjectTheme {
  color: {
    primary: string; // 主品牌色（原 primary），映射 --color-primary
    secondary: string; // 次品牌色（原 secondary），映射 --color-secondary
    chartPalette: string[]; // 图表配色序列，6 色，用于柱/折/饼
    neutralText: string; // 主文字色（中性），映射 --color-neutral-text
    neutralBg: string; // 页面/卡片背景色，映射 --color-neutral-bg
  };
  font: {
    text: string; // 文本字体 key（如 'noto-sans-sc'）
    number: string; // 数字字体 key（如 'inter'）
    heading?: string; // 标题字体 key，可选，缺省=跟随 text
  };
  density: ThemeDensity;
  radius: ThemeRadius;
  /** 布局尺寸：安全距离 + 网格；并入主题，由 4 套预设覆盖。 */
  layout?: {
    safeMargin: number; // 四面统一内缩 px；0=不画安全区
    gridSize: number; // 网格大小 px；驱动可见网格 + 移动/拖拽/键盘/缩放吸附
    showGrid?: boolean; // 显示可见网格叠加；缺省 true
    showSafeArea?: boolean; // 显示安全区虚线；缺省 true
  };
  /**
   * 品牌配置：Logo + 默认标题/副标题，用于报告封面与页眉。
   * 可选字段，未配置时不渲染对应元素。
   */
  branding?: {
    /** Logo 图片 URL（建议透明背景 PNG/SVG）。 */
    logo?: string;
    /** 品牌标题文案（如广告主名）。留空=跟随项目 advertiser。 */
    title?: string;
    /** 品牌副标题文案（如 "Q4 Campaign Report"）。 */
    subtitle?: string;
    /** Logo 显示高度 px；缺省 32。 */
    logoHeight?: number;
    /** Logo 圆角 px；缺省 0。 */
    logoRadius?: number;
    /**
     * 业务线标识（Badge）配置：页面右上角的业务线 Logo 水印。
     * 默认取"数据管理-业务线"的 logo 数据；以下字段可覆盖位置/尺寸/透明度。
     */
    blBadge?: {
      /** 是否显示；缺省 true。 */
      visible?: boolean;
      /** Logo URL；留空=跟随项目 businessLine。 */
      logo?: string;
      /** 宽度 px；缺省 40。 */
      width?: number;
      /** 高度 px；缺省 40。 */
      height?: number;
      /** 距右边缘 px；缺省 24。 */
      right?: number;
      /** 距顶部 px；缺省 24。 */
      top?: number;
      /** 透明度 0-1；缺省 0.8。 */
      opacity?: number;
      /** 圆角 px；缺省 8。 */
      radius?: number;
    };
  };
  /**
   * 默认页面背景：新建页面时的初始背景配置。
   * 不直接驱动渲染（页面自身 bgColor/bgGradient/bgImage 控制各自渲染），
   * 但"应用默认背景到全部页面"操作会把它写入所有页面。
   */
  background?: {
    /** 默认背景类型。 */
    type: 'none' | 'color' | 'gradient' | 'image';
    /** 纯色背景色。 */
    color?: string;
    /** 渐变背景。 */
    gradient?: PageGradient;
    /** 图片背景 URL。 */
    image?: string;
  };
  /** 行高规则：ratio=字号×n；fixed=字号+Npx。仅作用于用户「文本」组件 + 基础 CSS 变量。 */
  lineHeight?: {
    mode: 'ratio' | 'fixed';
    value: number;
  };
  /**
   * 标题样式：全局默认，「标题块」组件默认继承、可单组件覆盖。
   * fontSize 为 px；variant/color 为新标题块的初始样式（不强制覆盖已存在组件）。
   */
  heading?: {
    fontSize?: number;
    variant?: import('./editor').TitleBlockStyle;
    color?: string;
  };
  /** 币种 + 数字格式（成对）。 */
  format?: {
    currencySymbol: string;
    currencyPosition: 'before' | 'after';
    thousandsSep: boolean;
    decimals: 0 | 1 | 2;
    compact: 'none' | 'auto';
  };
  /** 图表统一样式：经 ThemeContext 下发，recharts 组件消费。 */
  chart?: {
    showAxis: boolean;
    showGrid: boolean;
    legendPosition: 'none' | 'top' | 'bottom' | 'right';
    barRadius: number;
  };
  /** 卡片阴影档位 → --shadow-card。 */
  shadow?: 'none' | 'subtle' | 'soft' | 'strong';
  preset?: string; // 当前命中的预设 key，仅用于 UI 高亮；手改字段后置空
}

/**
 * 旧形状兼容：早期 ProjectTheme 是 { primary?, secondary?, fontFamily? } 扁平结构。
 * normalizeTheme 接受任意形状（旧/新/空），输出标准化 ProjectTheme。
 */
export interface LegacyProjectTheme {
  primary?: string;
  secondary?: string;
  fontFamily?: string;
}

/** 项目元数据（mock 原型字段，存于 Project.meta JSON）。 */
export interface ProjectMeta {
  /** 业务线：FT/SM/CX/DG/KN/DM 等。 */
  businessLine?: string;
  /** 创建人。 */
  creator?: string;
  scenario?: Scenario;
  /** Campaign 报告子类（仅 scenario=campaign-report）。 */
  scenarioSub?: ScenarioSub;
  /** 模版类型：场景下的细分（周报/月报/总结 等），与模板对应。campaign-report 时与 scenarioSub 同值。 */
  templateType?: string;
  /** 广告主。 */
  advertiser?: string;
  /** 选中的上游 campaign id（campaign 类型场景）。 */
  campaignId?: string;
  campaignInfo?: CampaignInfo;
  /** 样式类型：'ppt' = 多页 PPT 模式，'single' = 单页面模式，'ai-html' = AI 生成 HTML（跳转外部编辑器）。 */
  styleType?: 'ppt' | 'single' | 'ai-html';
  /** 报告主题（品牌色等）。 */
  theme?: ProjectTheme;
  /** 报告全局数据上下文（Campaign + 达人），「数据配置」面板编辑，随项目保存。 */
  reportData?: ReportDataContext;
  /** 报告方案版本（用于追溯生成报告时所用的方案版本）。 */
  reportSchemeVersion?: string;
  /** P1-15: 渲染类型 — 'multi-page'=多页PPT, 'long-poster'=长图海报, 'html-report'=HTML报告。 */
  renderType?: string;
}
