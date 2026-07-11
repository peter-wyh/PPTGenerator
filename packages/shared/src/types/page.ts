/**
 * 页面 / 渐变 类型定义。
 */
import type { EditorComponent } from './editor';

/** 渐变色标：颜色（HEX）+ 位置（百分比 0–100）。 */
export interface GradientStop {
  color: string;
  position: number;
}

/** 页面背景渐变：线性 / 径向，2–6 色标；线性带角度。 */
export interface PageGradient {
  type: 'linear' | 'radial';
  angle?: number;
  stops: GradientStop[];
}

/**
 * 页面类型（27 种，与模板 1:1 对应）。
 * 每种类型对应一个模板 id，代表一种具体的页面身份。
 */
export type PageType =
  // ── 基础 ──
  | 'blank'
  | 'title'
  | 'overview'
  | 'table'
  // ── 投放报告 ──
  | 'report-weekly-overview'
  | 'report-monthly-overview'
  | 'report-channel'
  | 'report-product'
  | 'report-creator-collab'
  | 'report-placement'
  | 'report-posts'
  | 'report-wrapup-review'
  | 'content-analysis'
  | 'funnel'
  // ── 公司 · 品牌 ──
  | 'cover'
  | 'agenda'
  | 'company'
  | 'package'
  | 'milestone'
  | 'global'
  | 'org'
  | 'service'
  // ── 达人 · 案例 ──
  | 'creator'
  | 'case'
  // ── 策略 · 内容 ──
  | 'challenge'
  | 'process'
  | 'calendar'
  | 'campaign-plan';

/**
 * 页面大类（7 种）。由 pageType 映射而来，用于业务逻辑判断。
 * - 'general'          → 通用页面（空白/标题/数据概览/表格）
 * - 'media-report'     → 投放报告页（自动维护标题）
 * - 'campaign-report'  → Campaign 报告页（需选择 Campaign）
 * - 'creator-case'     → 达人案例/介绍页（需选择达人）
 * - 'creator-collab'   → 达人合作详情页（需选择当前 Campaign 下达人）
 * - 'company-intro'    → 公司/品牌介绍页
 * - 'strategy'         → 策略规划/流程/日历页
 */
export type PageCategory =
  | 'general'
  | 'media-report'
  | 'campaign-report'
  | 'creator-case'
  | 'creator-collab'
  | 'company-intro'
  | 'strategy';

/** PageType → PageCategory 映射表。 */
const PAGE_CATEGORY_MAP: Record<PageType, PageCategory> = {
  // 基础
  blank: 'general',
  title: 'general',
  overview: 'general',
  table: 'general',
  // 投放报告
  'report-weekly-overview': 'campaign-report',
  'report-monthly-overview': 'campaign-report',
  'report-channel': 'campaign-report',
  'report-product': 'campaign-report',
  'report-creator-collab': 'creator-collab',
  'report-placement': 'campaign-report',
  'report-posts': 'campaign-report',
  'report-wrapup-review': 'campaign-report',
  'content-analysis': 'campaign-report',
  funnel: 'campaign-report',
  // 公司 · 品牌
  cover: 'media-report',
  agenda: 'media-report',
  company: 'company-intro',
  package: 'company-intro',
  milestone: 'company-intro',
  global: 'company-intro',
  org: 'company-intro',
  service: 'company-intro',
  // 达人 · 案例
  creator: 'creator-case',
  case: 'creator-case',
  // 策略 · 内容
  challenge: 'strategy',
  process: 'strategy',
  calendar: 'strategy',
  'campaign-plan': 'strategy',
};

/** 获取页面类型对应的大类。 */
export function pageCategory(pt: PageType | undefined): PageCategory | undefined {
  if (!pt) return undefined;
  return PAGE_CATEGORY_MAP[pt] ?? 'general';
}

export interface Page {
  id: string;
  name: string;
  components: EditorComponent[];
  /** 页面背景色（HEX）；与 bgImage 二选一，未设时画布默认白。 */
  bgColor?: string;
  /** 页面背景渐变；优先级在 bgImage 之下、bgColor 之上。 */
  bgGradient?: PageGradient;
  /** 页面背景图 URL（cover 铺满）；优先于 bgColor。 */
  bgImage?: string;
  /** 页面业务类型（27 种，与模板 1:1）。 */
  pageType?: PageType;
  /** 作为「页面标题」的 text 组件 id（media-report 大类时由标题逻辑维护）。 */
  titleComponentId?: string;
  /** 用户曾手改标题 → 停止自动跟随 meta。 */
  titleOverridden?: boolean;
  /** 页面绑定的 Campaign ID（campaign-report / creator-collab 大类用）。 */
  campaignId?: string;
  /** 页面绑定的达人 ID（creator-case 大类用）。 */
  creatorId?: string;
}
