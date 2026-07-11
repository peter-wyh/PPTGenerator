import type { BusinessItem } from './catalog';
import type { VariantId } from './catalog';
import type { BusinessBlockData } from '@mediakit/shared';

export interface RenderCtx {
  item: BusinessItem;
  data: BusinessBlockData;
  title: string;
  meta: string;
  details: string[];
  variant: VariantId;
}

export const ACCENT = 'var(--color-primary)';
export const INK = 'var(--color-neutral-text)';
/** 业务块状态色：主品牌色 + 语义色（黄/蓝/紫），随主题切换。 */
export const STAT_COLORS = ['var(--color-primary)', 'var(--yellow)', 'var(--blue)', 'var(--purple)'];
/** 渐变柱色：主/次品牌色 + 两个浅色 tint（跟随主题）。 */
export const BAR_FADE = ['var(--color-primary)', 'var(--color-secondary)', 'color-mix(in srgb, var(--color-secondary) 40%, white)', 'color-mix(in srgb, var(--color-secondary) 20%, white)'];
export const AVATAR_DOTS = ['color-mix(in srgb, var(--color-primary) 30%, white)', 'color-mix(in srgb, var(--yellow) 35%, white)', 'color-mix(in srgb, var(--blue) 35%, white)', 'color-mix(in srgb, var(--purple) 35%, white)'];
export const CAL_BANDS = ['color-mix(in srgb, var(--color-primary) 10%, white)', 'color-mix(in srgb, var(--yellow) 12%, white)', 'color-mix(in srgb, var(--blue) 12%, white)', 'color-mix(in srgb, var(--purple) 12%, white)'];

/** 外层包裹（忠实 demo base()：accent=橙边+阴影，light=白底，其余=发丝边）。 */
export function Base({
  variant,
  tone = 'var(--color-neutral-bg)',
  children,
}: {
  variant: VariantId;
  tone?: string;
  children: React.ReactNode;
}) {
  const accent = variant === 'accent';
  const light = variant === 'light';
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        border: accent ? `2px solid ${ACCENT}` : '1px solid var(--border-default)',
        borderRadius: 'var(--radius-card)',
        background: light ? 'var(--color-neutral-bg)' : tone,
        boxShadow: accent ? `0 8px 22px color-mix(in srgb, var(--color-primary) 16%, transparent)` : 'var(--shadow-card)',
        fontFamily: 'var(--font-text)',
        color: INK,
      }}
    >
      {children}
    </div>
  );
}

/** 橙色眉标（item.name 大写）。 */
export function Label({ item }: { item: BusinessItem }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', color: ACCENT }}>
      {item.name.toUpperCase()}
    </div>
  );
}

/** 标题（heading 字体）。size 默认 21。 */
export function Title({ text, size = 21, color = INK, style }: { text: string; size?: number; color?: string; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-heading)',
        fontSize: size,
        lineHeight: 1.12,
        fontWeight: 700,
        color,
        ...style,
      }}
    >
      {text}
    </div>
  );
}

/** 药丸列表（首个橙色）。 */
export function Chips({ list, color = 'var(--surface-hover)' }: { list: string[]; color?: string }) {
  return (
    <>
      {list.map((x, i) => (
        <div
          key={i}
          style={{
            padding: 'var(--space-pad-sm)',
            background: color,
            borderRadius: 'var(--radius-card)',
            color: i === 0 ? ACCENT : 'var(--foreground-secondary)',
            fontSize: 10,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {x}
        </div>
      ))}
    </>
  );
}

/** 把 "<label> <value>" 拆成 {label, value}（最后一个 token 为数值）。 */
export function splitStat(s: string): { label: string; value: string } {
  const p = s.split(' ');
  return { value: p[p.length - 1], label: p.slice(0, -1).join(' ') };
}

export const mono = { fontFamily: 'var(--font-number)' } as const;
