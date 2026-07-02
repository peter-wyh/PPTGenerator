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

export const ACCENT = '#FF5C00';
export const INK = '#1A1A1A';
export const STAT_COLORS = ['#FF5C00', '#F59E0B', '#3B82F6', '#8B5CF6'];
export const BAR_FADE = ['#FF5C00', '#FF8533', '#FDBA74', '#FED7AA'];
export const AVATAR_DOTS = ['#FFDAC5', '#FDE68A', '#BFDBFE', '#DDD6FE'];
export const CAL_BANDS = ['#FFF0E8', '#FEF3C7', '#DBEAFE', '#EDE9FE'];

/** 外层包裹（忠实 demo base()：accent=橙边+阴影，light=白底，其余=发丝边）。 */
export function Base({
  variant,
  tone = '#FFFFFF',
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
        border: accent ? `2px solid ${ACCENT}` : '1px solid #F0E7E2',
        borderRadius: 10,
        background: light ? '#FFFFFF' : tone,
        boxShadow: accent ? `0 8px 22px rgba(255,92,0,.16)` : undefined,
        fontFamily: 'Inter, sans-serif',
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

/** 标题（Funnel Sans）。size 默认 21。 */
export function Title({ text, size = 21, color = INK, style }: { text: string; size?: number; color?: string; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        fontFamily: "'Funnel Sans', sans-serif",
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
export function Chips({ list, color = '#FFF7F0' }: { list: string[]; color?: string }) {
  return (
    <>
      {list.map((x, i) => (
        <div
          key={i}
          style={{
            padding: 8,
            background: color,
            borderRadius: 6,
            color: i === 0 ? ACCENT : '#555',
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

export const mono = { fontFamily: "'IBM Plex Mono', monospace" } as const;
