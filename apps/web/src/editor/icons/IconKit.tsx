import type { IconWeight } from '@mediakit/shared';
import { findIcon } from './catalog';

export interface IconKitProps {
  /** catalog 图标 key。 */
  name?: string;
  /** Phosphor weight；缺省 'regular'。 */
  weight?: IconWeight;
  size?: number | string;
  color?: string;
  className?: string;
}

/**
 * 唯一图标渲染入口。所有组件渲染图标只通过 <IconKit>，
 * 不直接 import Phosphor。未知 key 返回 null（不抛）。
 */
export function IconKit({ name, weight = 'regular', size = 24, color, className }: IconKitProps) {
  const def = findIcon(name);
  if (!def) return null;
  const Comp = def.Comp;
  return <Comp weight={weight} size={size} color={color} className={className} />;
}
