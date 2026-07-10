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

/** 页面类型；命中 'media-report' 触发默认标题规则。 */
export type PageType = 'media-report';

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
  /** 页面类型；命中 'media-report' 触发默认标题规则。 */
  pageType?: PageType;
  /** 作为「页面标题」的 text 组件 id（pageType='media-report' 时由标题逻辑维护）。 */
  titleComponentId?: string;
  /** 用户曾手改标题 → 停止自动跟随 meta。 */
  titleOverridden?: boolean;
}
