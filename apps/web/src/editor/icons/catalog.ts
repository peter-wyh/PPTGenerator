import type { ComponentType } from 'react';
import {
  TrendUp, TrendDown, ChartLineUp, CurrencyDollar, Percent,
  Eye, EyeSlash, Lightning, Target, Trophy,
  ShoppingCart, Storefront, Package, Gift, Tag,
  Users, UserCircle, Heart, ShareNetwork, ChatDots,
  CalendarCheck, Clock, ChartBar, Gear, MagnifyingGlass,
  ArrowUpRight, ArrowDownRight, Fire, Sparkle, CoatHanger,
} from '@phosphor-icons/react';
import type { IconWeight } from '@mediakit/shared';

export type IconCategory = 'metric' | 'creator' | 'report' | 'generic';

export interface IconDef {
  /** 稳定字符串标识，写入组件 data.icon。 */
  key: string;
  label: string;
  category: IconCategory;
  /** Phosphor 图标组件（直接 import 以保留 tree-shaking）。 */
  Comp: ComponentType<{
    weight?: IconWeight;
    size?: number | string;
    color?: string;
    className?: string;
  }>;
}

export const ICON_WEIGHTS: IconWeight[] = ['thin', 'light', 'regular', 'bold', 'fill', 'duotone'];

export const ICON_CATEGORIES: { id: IconCategory; label: string }[] = [
  { id: 'metric', label: '指标' },
  { id: 'creator', label: '达人' },
  { id: 'report', label: '报告' },
  { id: 'generic', label: '通用' },
];

export const ICONS: IconDef[] = [
  // metric
  { key: 'trend-up', label: '上升趋势', category: 'metric', Comp: TrendUp },
  { key: 'trend-down', label: '下降趋势', category: 'metric', Comp: TrendDown },
  { key: 'chart-line-up', label: '折线上升', category: 'metric', Comp: ChartLineUp },
  { key: 'currency', label: '金额', category: 'metric', Comp: CurrencyDollar },
  { key: 'percent', label: '比率', category: 'metric', Comp: Percent },
  { key: 'eye', label: '曝光', category: 'metric', Comp: Eye },
  { key: 'eye-slash', label: '曝光（线性）', category: 'metric', Comp: EyeSlash },
  { key: 'lightning', label: '互动', category: 'metric', Comp: Lightning },
  { key: 'target', label: '目标', category: 'metric', Comp: Target },
  { key: 'trophy', label: '达成', category: 'metric', Comp: Trophy },
  { key: 'fire', label: '热度', category: 'metric', Comp: Fire },
  // creator
  { key: 'users', label: '粉丝', category: 'creator', Comp: Users },
  { key: 'user-circle', label: '达人', category: 'creator', Comp: UserCircle },
  { key: 'heart', label: '点赞', category: 'creator', Comp: Heart },
  { key: 'share', label: '分享', category: 'creator', Comp: ShareNetwork },
  { key: 'chat', label: '评论', category: 'creator', Comp: ChatDots },
  { key: 'coat-hanger', label: '时尚', category: 'creator', Comp: CoatHanger },
  // report
  { key: 'cart', label: '销量', category: 'report', Comp: ShoppingCart },
  { key: 'storefront', label: '店铺', category: 'report', Comp: Storefront },
  { key: 'package', label: '商品', category: 'report', Comp: Package },
  { key: 'gift', label: '赠品', category: 'report', Comp: Gift },
  { key: 'tag', label: '客单', category: 'report', Comp: Tag },
  { key: 'calendar-check', label: '周期', category: 'report', Comp: CalendarCheck },
  { key: 'clock', label: '时段', category: 'report', Comp: Clock },
  { key: 'chart-bar', label: '对比', category: 'report', Comp: ChartBar },
  // generic
  { key: 'arrow-up-right', label: '上行', category: 'generic', Comp: ArrowUpRight },
  { key: 'arrow-down-right', label: '下行', category: 'generic', Comp: ArrowDownRight },
  { key: 'sparkle', label: '亮点', category: 'generic', Comp: Sparkle },
  { key: 'gear', label: '设置', category: 'generic', Comp: Gear },
  { key: 'search', label: '查询', category: 'generic', Comp: MagnifyingGlass },
];

export function findIcon(key?: string): IconDef | undefined {
  if (!key) return undefined;
  return ICONS.find((i) => i.key === key);
}
