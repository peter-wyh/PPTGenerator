import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  Legend,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  BarChartData,
  IconWeight,
  ImageData,
  IndicatorCardData,
  IndicatorCardVariant,
  LineChartData,
  PieChartData,
  ShapeData,
  TableData,
  TextData,
  TitleBlockData,
} from '@mediakit/shared';
import { IconKit } from '../icons/IconKit';
import { useChartStyle } from '../theme';
import { useChartColors } from './report/shared';

/** 解析数据项颜色：'auto' 或空值 → 从全局 chartPalette 按索引取色。 */
function resolveColor(color: string | undefined, index: number, palette: string[]): string {
  if (!color || color === 'auto') return palette[index % palette.length];
  return color;
}


/* ---------------------------------- text --------------------------------- */
export function TextComponent({ data }: { data: TextData }) {
  return (
    <div
      className="h-full w-full overflow-hidden break-words"
      style={{
        fontSize: data.fontSize,
        fontWeight: data.fontWeight,
        fontFamily: data.fontFamily, // 留空=继承根节点 --font-text
        color: data.color,
        backgroundColor: data.bgColor,
        padding: data.padding,
        lineHeight: 'var(--line-height)',
      }}
    >
      {data.content}
    </div>
  );
}

/* --------------------------------- image --------------------------------- */
export function ImageComponent({ data }: { data: ImageData }) {
  if (!data.src) {
    return (
      <div className="flex h-full w-full items-center justify-center border border-dashed border-border-default bg-surface-hover text-xs text-foreground-muted">
        Image placeholder
      </div>
    );
  }
  return (
    <img
      src={data.src}
      alt=""
      className="h-full w-full"
      style={{ objectFit: data.fit ?? 'cover' }}
      draggable={false}
    />
  );
}

/* ----------------------------- indicator card ---------------------------- */
const INDICATOR_THEME: Record<IndicatorCardData['colorTheme'], { bg: string; fg: string }> = {
  blue: { bg: 'color-mix(in srgb, var(--blue, #3B82F6) 8%, white)', fg: 'var(--blue, #3B82F6)' },
  green: { bg: 'color-mix(in srgb, var(--green, #22C55E) 8%, white)', fg: 'var(--green, #22C55E)' },
  orange: { bg: 'color-mix(in srgb, var(--color-primary) 8%, white)', fg: 'var(--color-primary)' },
  purple: { bg: 'color-mix(in srgb, var(--purple, #8B5CF6) 8%, white)', fg: 'var(--purple, #8B5CF6)' },
  red: { bg: 'color-mix(in srgb, var(--red, #EF4444) 8%, white)', fg: 'var(--red, #EF4444)' },
};

/** 每个启用图标的变体的默认图标配置（与 REGISTRY 声明保持一致）。 */
const INDICATOR_VARIANT_ICON: Record<
  Exclude<IndicatorCardVariant, 'plain'>,
  { position: 'left' | 'top' | 'bg'; defaultKey: string; defaultWeight: IconWeight }
> = {
  'icon-left': { position: 'left', defaultKey: 'trend-up', defaultWeight: 'regular' },
  'icon-top': { position: 'top', defaultKey: 'trend-up', defaultWeight: 'fill' },
  'icon-bg': { position: 'bg', defaultKey: 'trend-up', defaultWeight: 'fill' },
  'spotlight': { position: 'left', defaultKey: 'trend-up', defaultWeight: 'fill' },
  'duo': { position: 'left', defaultKey: 'chart-bar', defaultWeight: 'regular' },
};

export function IndicatorCardComponent({ data }: { data: IndicatorCardData }) {
  const t = INDICATOR_THEME[data.colorTheme] ?? INDICATOR_THEME.blue;
  const variant = data.variant ?? 'plain';
  const cfg = variant === 'plain' ? undefined : INDICATOR_VARIANT_ICON[variant];

  // 图标 key/weight：data 优先，缺省回退变体默认。
  const iconKey = cfg ? data.icon ?? cfg.defaultKey : undefined;
  const iconWeight: IconWeight = cfg ? data.iconWeight ?? cfg.defaultWeight : 'regular';

  if (variant === 'icon-bg') {
    return (
      <div className="relative h-full w-full overflow-hidden rounded-xl px-4" style={{ backgroundColor: t.bg }}>
        <div className="pointer-events-none absolute -right-3 -bottom-3 opacity-[0.12]" style={{ color: t.fg }}>
          <IconKit name={iconKey} weight={iconWeight} size={120} color={t.fg} />
        </div>
        <div className="relative flex h-full w-full flex-col justify-center">
          <div className="text-xs text-foreground-secondary">{data.title}</div>
          <div className="font-data text-2xl font-semibold" style={{ color: t.fg }}>{data.value}</div>
          {data.trend && (
            <div className="mt-0.5 text-xs" style={{ color: data.trendUp ? 'var(--green, #22C55E)' : 'var(--red, #EF4444)' }}>
              {data.trendUp ? '▲' : '▼'} {data.trend}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'icon-left') {
    return (
      <div className="flex h-full w-full items-center gap-3 rounded-xl px-4" style={{ backgroundColor: t.bg }}>
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg" style={{ backgroundColor: `${t.fg}1A`, color: t.fg }}>
          <IconKit name={iconKey} weight={iconWeight} size={22} color={t.fg} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-foreground-secondary">{data.title}</div>
          <div className="font-data text-2xl font-semibold" style={{ color: t.fg }}>{data.value}</div>
          {data.trend && (
            <div className="mt-0.5 text-xs" style={{ color: data.trendUp ? 'var(--green, #22C55E)' : 'var(--red, #EF4444)' }}>
              {data.trendUp ? '▲' : '▼'} {data.trend}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'icon-top') {
    return (
      <div className="flex h-full w-full flex-col justify-center rounded-xl px-4" style={{ backgroundColor: t.bg }}>
        <IconKit name={iconKey} weight={iconWeight} size={24} color={t.fg} />
        <div className="mt-1 text-xs text-foreground-secondary">{data.title}</div>
        <div className="font-data text-2xl font-semibold" style={{ color: t.fg }}>{data.value}</div>
        {data.trend && (
          <div className="mt-0.5 text-xs" style={{ color: data.trendUp ? 'var(--green, #22C55E)' : 'var(--red, #EF4444)' }}>
            {data.trendUp ? '▲' : '▼'} {data.trend}
          </div>
        )}
      </div>
    );
  }

  if (variant === 'spotlight') {
    // 聚光：深色渐变背景 + 大数值 + 右上角图标徽章。
    return (
      <div
        className="relative h-full w-full overflow-hidden rounded-xl px-4"
        style={{ background: `linear-gradient(135deg, ${t.fg}, ${t.fg}CC)` }}
      >
        <div className="absolute right-3 top-3 opacity-90" style={{ color: 'var(--foreground-inverse, #fff)' }}>
          <IconKit name={iconKey} weight={iconWeight} size={20} color="var(--foreground-inverse, #fff)" />
        </div>
        <div className="flex h-full w-full flex-col justify-center">
          <div className="text-xs text-white/70">{data.title}</div>
          <div className="font-data text-3xl font-bold text-white">{data.value}</div>
          {data.trend && (
            <div className="mt-0.5 text-xs text-white/80">
              {data.trendUp ? '▲' : '▼'} {data.trend}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'duo') {
    // 双值：主数值 + 副数值（trend 文案充当副值），左图标 + 分割线。
    return (
      <div className="flex h-full w-full items-center gap-3 skin-card px-4">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg" style={{ backgroundColor: `${t.fg}1A`, color: t.fg }}>
          <IconKit name={iconKey} weight={iconWeight} size={22} color={t.fg} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-foreground-secondary">{data.title}</div>
          <div className="font-data text-2xl font-semibold" style={{ color: t.fg }}>{data.value}</div>
        </div>
        {data.trend && (
          <div className="flex-none border-l border-border-subtle pl-3 text-right">
            <div className="text-[10px] text-foreground-muted">Change</div>
            <div className="font-data text-sm font-semibold" style={{ color: data.trendUp ? 'var(--green, #22C55E)' : 'var(--red, #EF4444)' }}>
              {data.trendUp ? '▲' : '▼'} {data.trend}
            </div>
          </div>
        )}
      </div>
    );
  }

  // plain（含缺省/老数据）
  return (
    <div className="flex h-full w-full flex-col justify-center rounded-xl px-4" style={{ backgroundColor: t.bg }}>
      <div className="text-xs text-foreground-secondary">{data.title}</div>
      <div className="font-data text-2xl font-semibold" style={{ color: t.fg }}>{data.value}</div>
      {data.trend && (
        <div className="mt-0.5 text-xs" style={{ color: data.trendUp ? 'var(--green, #22C55E)' : 'var(--red, #EF4444)' }}>
          {data.trendUp ? '▲' : '▼'} {data.trend}
        </div>
      )}
    </div>
  );
}

/* -------------------------------- bar chart ------------------------------ */
export function BarChartComponent({ data }: { data: BarChartData }) {
  const cs = useChartStyle();
  const palette = useChartColors();
  const variant = data.variant ?? 'vertical';

  /* 堆叠模式 */
  if (variant === 'stacked' && data.stackBars && data.stackBars.length > 0) {
    const keys = data.stackKeys ?? Object.keys(data.stackBars[0]?.values ?? {});
    return (
      <div className="flex h-full w-full flex-col bg-surface-primary p-3">
        {data.title && <div className="mb-2 text-sm font-medium text-foreground-primary">{data.title}</div>}
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.stackBars} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              {cs.showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle, #F3F4F6)" />}
              <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} hide={!cs.showAxis} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={32} hide={!cs.showAxis} />
              <Tooltip cursor={{ fill: 'var(--surface-hover, #F9FAFB)' }} />
              {cs.legend && <Legend {...cs.legend} />}
              {keys.map((k, i) => (
                <Bar key={k} dataKey={`values.${k}`} name={k} stackId="a" radius={i === keys.length - 1 ? [cs.barRadius, cs.barRadius, 0, 0] : [0, 0, 0, 0]} fill={resolveColor(undefined, i, palette)} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  /* 横向条形 */
  const isHorizontal = variant === 'horizontal';
  const chartProps = isHorizontal
    ? { layout: 'vertical' as const, data: data.bars, margin: { top: 4, right: 16, bottom: 4, left: 8 } }
    : { layout: 'horizontal' as const, data: data.bars, margin: { top: 4, right: 8, bottom: 4, left: 0 } };

  return (
    <div className="flex h-full w-full flex-col bg-surface-primary p-3">
      {data.title && <div className="mb-2 text-sm font-medium text-foreground-primary">{data.title}</div>}
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart {...chartProps}>
            {cs.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle, #F3F4F6)" {...(isHorizontal ? { horizontal: false } : { vertical: false })} />}
            {isHorizontal ? (
              <>
                <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} hide={!cs.showAxis} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={48} hide={!cs.showAxis} />
              </>
            ) : (
              <>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} hide={!cs.showAxis} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={32} hide={!cs.showAxis} />
              </>
            )}
            <Tooltip cursor={{ fill: 'var(--surface-hover, #F9FAFB)' }} />
            <Bar dataKey="value" radius={isHorizontal ? [0, cs.barRadius, cs.barRadius, 0] : [cs.barRadius, cs.barRadius, 0, 0]}>
              {data.bars.map((b, i) => (
                <Cell key={i} fill={resolveColor(b.color, i, palette)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* -------------------------------- line chart ----------------------------- */
export function LineChartComponent({ data }: { data: LineChartData }) {
  const cs = useChartStyle();
  const palette = useChartColors();
  // 多系列按 label 对齐成单数据集。
  const labels = data.series[0]?.points.map((p) => p.label) ?? [];
  const dataset = labels.map((label, i) => {
    const row: Record<string, string | number> = { label };
    for (const s of data.series) row[s.name] = s.points[i]?.value ?? 0;
    return row;
  });
  return (
    <div className="flex h-full w-full flex-col bg-surface-primary p-3">
      {data.title && <div className="mb-2 text-sm font-medium text-foreground-primary">{data.title}</div>}
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dataset} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            {cs.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle, #F3F4F6)" />}
            <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} hide={!cs.showAxis} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={32} hide={!cs.showAxis} />
            <Tooltip />
            {cs.legend && <Legend {...cs.legend} />}
            {data.series.map((s, i) => (
              <Line key={s.name} type="monotone" dataKey={s.name} stroke={resolveColor(s.color, i, palette)} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* -------------------------------- pie chart ------------------------------ */
export function PieChartComponent({ data }: { data: PieChartData }) {
  const palette = useChartColors();
  return (
    <div className="flex h-full w-full flex-col bg-surface-primary p-3">
      {data.title && <div className="mb-2 text-sm font-medium text-foreground-primary">{data.title}</div>}
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data.slices}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              outerRadius="80%"
              label={(e) => e.label}
            >
              {data.slices.map((s, i) => (
                <Cell key={i} fill={resolveColor(s.color, i, palette)} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* --------------------------------- table --------------------------------- */
export function TableComponent({ data }: { data: TableData }) {
  return (
    <div className="h-full w-full overflow-auto bg-surface-primary">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            {data.headers.map((h, i) => (
              <th key={i} className="border-b border-border-default bg-surface-hover px-3 py-2 text-left font-medium text-foreground-secondary">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} className="border-b border-border-subtle px-3 py-2 text-foreground-primary">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------- business block ----------------------------- */
/** M4 占位：业务组件二级分发在此实现。M1 仅渲染一个占位框。 */
export function BusinessBlockPlaceholder({ data }: { data: { title?: string; businessKind?: string } }) {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-primary/40 bg-primary/5 text-center text-sm text-primary">
      Business · {data.businessKind ?? 'unknown'}
      {data.title ? ` · ${data.title}` : ''}
    </div>
  );
}

/* --------------------------------- shape --------------------------------- */
export function ShapeComponent({ data }: { data: ShapeData }) {
  const { shape, fill, stroke, strokeWidth, opacity, rotation, borderRadius, dash } = data;
  const border = strokeWidth && stroke ? `${strokeWidth}px solid ${stroke}` : undefined;
  const inner =
    shape === 'line' ? (
      <svg className="h-full w-full" preserveAspectRatio="none">
        <line x1="0" y1="50%" x2="100%" y2="50%" stroke={stroke ?? 'var(--border-default, #E5E7EB)'} strokeWidth={strokeWidth ?? 1} strokeDasharray={dash ? '8 4' : undefined} />
      </svg>
    ) : (
      <div className="h-full w-full" style={{ backgroundColor: fill, border, borderRadius: shape === 'circle' ? '50%' : shape === 'rounded' ? borderRadius ?? 12 : undefined }} />
    );
  return (
    <div className="h-full w-full" style={{ opacity: opacity ?? 1, transform: rotation ? `rotate(${rotation}deg)` : undefined }}>
      {inner}
    </div>
  );
}

/* ------------------------------- title block ----------------------------- */
export function TitleBlock({ data }: { data: TitleBlockData }) {
  const { variant = 'plain', text, subtitle, index, divider } = data;
  const color = data.color ?? 'var(--color-primary)';

  // 字号:单组件 data.fontSize 优先;否则跟随全局 --heading-font-size(32px 兜底)。
  // fs(m) 派生相对字号(序号=1.6× 等),兼容 px 与 CSS var 两种基线。
  const fs = (m = 1): string =>
    data.fontSize
      ? `${Math.round(data.fontSize * m)}px`
      : `calc(var(--heading-font-size, 32px) * ${m})`;
  const fw = data.fontWeight ?? 700;
  // 标题文字颜色:品牌色 / 黑色(默认黑)。gradient 在彩色背景上固定白。
  const titleFg = variant === 'gradient' ? '#fff' : data.titleColor === 'brand' ? 'var(--color-primary)' : '#000000';

  // 内层：按变体渲染。divider 由外层统一控制（统一加底部分割线）。
  let inner: React.ReactNode;
  switch (variant) {
    case 'plain':
      inner = (
        <div className="min-w-0">
          <div className="leading-tight text-foreground-primary" style={{ fontSize: fs(), fontWeight: fw, color: titleFg }}>{text}</div>
          {subtitle && <div className="mt-1 text-sm text-foreground-muted">{subtitle}</div>}
        </div>
      );
      break;

    case 'bar-left':
      inner = (
        <div className="flex min-w-0 items-center gap-3">
          <span className="h-full w-1 flex-none rounded-full" style={{ backgroundColor: color }} />
          <div className="min-w-0">
            <div className="leading-tight text-foreground-primary" style={{ fontSize: fs(), fontWeight: fw, color: titleFg }}>{text}</div>
            {subtitle && <div className="mt-1 text-sm text-foreground-muted">{subtitle}</div>}
          </div>
        </div>
      );
      break;

    case 'underline':
      inner = (
        <div className="min-w-0">
          <div className="leading-tight text-foreground-primary" style={{ fontSize: fs(), fontWeight: fw, color: titleFg }}>{text}</div>
          <div className="mt-1.5 h-0.5 w-full rounded-full" style={{ backgroundColor: color }} />
          {subtitle && <div className="mt-1.5 text-sm text-foreground-muted">{subtitle}</div>}
        </div>
      );
      break;

    case 'gradient':
      inner = (
        <div className="w-full rounded-xl px-5 py-4" style={{ background: `linear-gradient(135deg, ${color}, ${color}99)` }}>
          <div className="leading-tight text-white" style={{ fontSize: fs(), fontWeight: fw, color: titleFg }}>{text}</div>
          {subtitle && <div className="mt-1 text-sm text-white/80">{subtitle}</div>}
        </div>
      );
      break;

    case 'card':
      inner = (
        <div className="w-full skin-card px-5 py-4">
          <div className="leading-tight text-foreground-primary" style={{ fontSize: fs(), fontWeight: fw, color: titleFg }}>{text}</div>
          {subtitle && <div className="mt-1 text-sm text-foreground-muted">{subtitle}</div>}
        </div>
      );
      break;

    case 'numbered':
      inner = (
        <div className="flex min-w-0 items-center gap-3">
          {index && (
            <span className="leading-none flex-none" style={{ color, fontSize: fs(1.6), fontWeight: fw }}>
              {index}
            </span>
          )}
          <div className="min-w-0">
            <div className="leading-tight text-foreground-primary" style={{ fontSize: fs(), fontWeight: fw, color: titleFg }}>{text}</div>
            {subtitle && <div className="mt-1 text-sm text-foreground-muted">{subtitle}</div>}
          </div>
        </div>
      );
      break;

    case 'highlight':
      // 色块强调:主色浅底 + 底部主色条(对标参考图)。
      inner = (
        <div
          className="w-full rounded-md px-4 py-2"
          style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`, borderBottom: `3px solid ${color}` }}
        >
          <div className="leading-tight text-foreground-primary" style={{ fontSize: fs(), fontWeight: fw, color: titleFg }}>{text}</div>
          {subtitle && <div className="mt-0.5 text-sm" style={{ color }}>{subtitle}</div>}
        </div>
      );
      break;

    case 'accent-tag':
      // 色块标签:左圆角色块(显序号/空) + 标题。
      inner = (
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ backgroundColor: color }}
          >
            {index || ''}
          </span>
          <div className="min-w-0">
            <div className="leading-tight text-foreground-primary" style={{ fontSize: fs(), fontWeight: fw, color: titleFg }}>{text}</div>
            {subtitle && <div className="mt-0.5 text-sm text-foreground-muted">{subtitle}</div>}
          </div>
        </div>
      );
      break;

    case 'accent-underline':
      // 强调下划线:粗体标题 + 贴文字宽度的彩色细下划线条(inline-block 让色条宽度=文字宽度)。
      inner = (
        <div className="min-w-0">
          <div className="inline-block">
            <div className="leading-tight text-foreground-primary" style={{ fontSize: fs(), fontWeight: fw, color: titleFg }}>{text}</div>
            <div className="mt-1 h-[3px] w-full rounded-full" style={{ backgroundColor: color }} />
          </div>
          {subtitle && <div className="mt-1 text-sm text-foreground-muted">{subtitle}</div>}
        </div>
      );
      break;

    case 'block-underline':
      // 色块下划线:粗体标题 + 贴文字宽度 60% 的粗彩色块(标记笔质感,无背景)。
      // inline-block 让色块百分比基准=标题文字宽;h-2 比 underline/accent-underline 的细线明显更粗。
      // 色块颜色跟随标题颜色（titleFg），不再使用独立 color 字段。
      inner = (
        <div className="min-w-0">
          <div className="inline-block">
            <div className="leading-tight text-foreground-primary" style={{ fontSize: fs(), fontWeight: fw, color: titleFg }}>{text}</div>
            <div className="mt-1 h-2 w-[60%] rounded-sm" style={{ backgroundColor: titleFg }} />
          </div>
          {subtitle && <div className="mt-1 text-sm text-foreground-muted">{subtitle}</div>}
        </div>
      );
      break;

    default:
      inner = (
        <div className="min-w-0">
          <div className="leading-tight text-foreground-primary" style={{ fontSize: fs(), fontWeight: fw, color: titleFg }}>{text}</div>
          {subtitle && <div className="mt-1 text-sm text-foreground-muted">{subtitle}</div>}
        </div>
      );
  }

  return (
    <div
      className={`h-full w-full flex flex-col justify-center ${divider ? 'border-b border-border-default pb-2' : ''}`}
    >
      {inner}
    </div>
  );
}

/* ------------------------------- content card ----------------------------- */

import type { ContentCardData } from '@mediakit/shared';

export function ContentCard({ data }: { data: ContentCardData }) {
  const { variant = 'standard', title, body, image, tag, footer } = data;
  const accent = data.accentColor ?? 'var(--color-primary)';

  const tagEl = tag && (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium"
      style={{ backgroundColor: `color-mix(in srgb, ${accent} 12%, white)`, color: accent }}
    >
      {tag}
    </span>
  );

  const titleEl = (
    <div className="text-lg font-bold leading-snug text-foreground-primary">{title}</div>
  );

  const bodyEl = body && (
    <p className="text-xs leading-relaxed text-foreground-secondary">{body}</p>
  );

  const footerEl = footer && (
    <div className="mt-auto border-t border-border-default pt-1.5 text-[10px] text-foreground-muted">
      {footer}
    </div>
  );

  switch (variant) {
    case 'image-top':
      return (
        <div className="skin-card-lg flex h-full w-full flex-col overflow-hidden p-0">
          {image && (
            <div className="h-2/5 w-full flex-none overflow-hidden">
              <img src={image} alt="" className="h-full w-full object-cover" />
            </div>
          )}
          <div className="flex flex-1 flex-col gap-1.5 p-4">
            <div className="flex items-center gap-2">
              {tagEl}
            </div>
            {titleEl}
            {bodyEl}
            {footerEl}
          </div>
        </div>
      );

    case 'image-left':
      return (
        <div className="skin-card-lg flex h-full w-full overflow-hidden p-0">
          {image && (
            <div className="h-full w-2/5 flex-none overflow-hidden">
              <img src={image} alt="" className="h-full w-full object-cover" />
            </div>
          )}
          <div className="flex flex-1 flex-col gap-1.5 p-4">
            <div className="flex items-center gap-2">
              {tagEl}
            </div>
            {titleEl}
            {bodyEl}
            {footerEl}
          </div>
        </div>
      );

    case 'compact':
      return (
        <div className="skin-card flex h-full w-full flex-col gap-1 p-3">
          <div className="flex items-center justify-between">
            {titleEl}
            {tagEl}
          </div>
          {bodyEl}
        </div>
      );

    case 'quote':
      return (
        <div
          className="flex h-full w-full flex-col justify-center gap-2 rounded-xl p-5"
          style={{ background: `color-mix(in srgb, ${accent} 6%, var(--surface-secondary, #f8f8f8))` }}
        >
          <span className="text-3xl leading-none" style={{ color: accent }}>❝</span>
          {bodyEl}
          <div className="flex items-center gap-2">
            <span className="h-0.5 w-6 rounded-full" style={{ backgroundColor: accent }} />
            <span className="text-sm font-bold text-foreground-primary">{title}</span>
          </div>
          {footerEl}
        </div>
      );

    default: // standard
      return (
        <div className="skin-card-lg flex h-full w-full flex-col gap-2 p-4">
          <div className="flex items-center gap-2">
            <span className="h-4 w-0.5 rounded-full" style={{ backgroundColor: accent }} />
            {tagEl}
          </div>
          {titleEl}
          {bodyEl}
          {footerEl}
        </div>
      );
  }
}
