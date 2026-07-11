import type { Page, PageGradient } from '@mediakit/shared';
import { gradientToCss } from '@mediakit/shared';

export type BackgroundType = 'color' | 'gradient' | 'image' | 'none';

/** 页面背景 CSS：bgImage > bgGradient > bgColor > #fff。 */
export function resolvePageBackground(page: Pick<Page, 'bgColor' | 'bgGradient' | 'bgImage'>): string {
  if (page.bgImage) return `var(--surface-primary) url(${page.bgImage}) center/cover no-repeat`;
  if (page.bgGradient) return gradientToCss(page.bgGradient);
  return page.bgColor ?? 'var(--surface-primary)';
}

/** 由数据推导当前背景类型。 */
export function backgroundType(page: Pick<Page, 'bgColor' | 'bgGradient' | 'bgImage'>): BackgroundType {
  if (page.bgImage) return 'image';
  if (page.bgGradient) return 'gradient';
  if (page.bgColor) return 'color';
  return 'none';
}

/**
 * 切换背景类型应写入页面的 patch（单选语义：清掉非目标字段，目标字段给默认值）。
 * 持久化对象里始终最多一个背景字段。
 */
export function buildBackgroundTypePatch(
  page: Pick<Page, 'bgColor' | 'bgGradient' | 'bgImage'>,
  type: BackgroundType,
): Partial<Pick<Page, 'bgColor' | 'bgGradient' | 'bgImage'>> {
  switch (type) {
    case 'color':
      return { bgColor: page.bgColor ?? 'var(--surface-primary)', bgGradient: undefined, bgImage: undefined };
    case 'gradient': {
      const first = page.bgColor ?? 'var(--surface-primary)';
      const grad: PageGradient = {
        type: 'linear',
        angle: 180,
        stops: [
          { color: first, position: 0 },
          { color: 'var(--border-default)', position: 100 },
        ],
      };
      return { bgColor: undefined, bgGradient: grad, bgImage: undefined };
    }
    case 'image':
      return { bgColor: undefined, bgGradient: undefined, bgImage: page.bgImage };
    case 'none':
    default:
      return { bgColor: undefined, bgGradient: undefined, bgImage: undefined };
  }
}
