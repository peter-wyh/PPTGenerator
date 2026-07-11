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
 * 页面业务类型：
 * - 'general'          → 通用页面（空白/标题/数据概览/表格）
 * - 'media-report'     → 投放报告页（自动维护标题）
 * - 'campaign-report'  → Campaign 报告页（需选择 Campaign）
 * - 'creator-case'     → 达人案例/介绍页（需选择达人）
 * - 'creator-collab'   → 达人合作详情页（需选择当前 Campaign 下达人）
 * - 'company-intro'    → 公司/品牌介绍页
 * - 'strategy'         → 策略规划/流程/日历页
 */
export type PageType =
  | 'general'
  | 'media-report'
  | 'campaign-report'
  | 'creator-case'
  | 'creator-collab'
  | 'company-intro'
  | 'strategy';

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
  /** 页面业务类型。 */
  pageType?: PageType;
  /** 作为「页面标题」的 text 组件 id（pageType='media-report' 时由标题逻辑维护）。 */
  titleComponentId?: string;
  /** 用户曾手改标题 → 停止自动跟随 meta。 */
  titleOverridden?: boolean;
  /** 页面绑定的 Campaign ID（campaign-report / creator-collab 类型用）。 */
  campaignId?: string;
  /** 页面绑定的达人 ID（creator-case 类型用）。 */
  creatorId?: string;
}
