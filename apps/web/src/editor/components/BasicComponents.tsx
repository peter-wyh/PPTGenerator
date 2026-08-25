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
import { useEditorStore } from '../store';
import { useBusinessLineInfo } from '@/editor/useBusinessLineLogo';
import type {
  BarChartData,
  IconWeight,
  ImageData,
  IndicatorCardData,
  IndicatorCardVariant,
  LineChartData,
  PageHeaderData,
  PageHeaderLogo,
  PieChartData,
  ShapeData,
  TableData,
  TextData,
  TitleBlockData,
} from '@mediakit/shared';
import { sanitizeRichText } from '../richText';
import { IconKit } from '../icons/IconKit';
import { useChartStyle } from '../theme';
import { useChartColors } from './report/shared';

/** 解析数据项颜色：'auto' 或空值 → 从全局 chartPalette 按索引取色。 */
function resolveColor(color: string | undefined, index: number, palette: string[]): string {
  if (!color || color === 'auto') return palette[index % palette.length];
  return color;
}

/** Y 轴数值紧凑格式化：28500 → '28.5K', 1280000 → '1.28M' */
function formatCompactNum(v: number): string {
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(v);
}


/* ---------------------------------- text --------------------------------- */
export function TextComponent({ data }: { data: TextData }) {
  // Render content as sanitized HTML to support inline rich-text formatting
  // (bold, italic, lists). The sanitizer (richText.ts) whitelists only safe
  // inline tags and strips all attributes, so XSS is not a concern here.
  const html = sanitizeRichText(data.content ?? '');
  return (
    <div
      className="h-full w-full overflow-hidden break-words [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_mark]:rounded [&_mark]:px-0.5"
      style={{
        fontSize: data.fontSize,
        fontWeight: data.fontWeight,
        fontFamily: data.fontFamily, // 留空=继承根节点 --font-text
        color: data.color,
        backgroundColor: data.bgColor,
        padding: data.padding,
        lineHeight: 'var(--line-height)',
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
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
      <div className="relative h-full w-full overflow-hidden px-4" style={{ backgroundColor: t.bg, borderRadius: 'var(--radius-card, 12px)' }}>
        <div className="pointer-events-none absolute -right-3 -bottom-3 opacity-[0.12]" style={{ color: t.fg }}>
          <IconKit name={iconKey} weight={iconWeight} size={120} color={t.fg} />
        </div>
        <div className="relative flex h-full w-full flex-col justify-center">
          <div className="text-xs text-foreground-secondary">{data.title}</div>
          <div className="font-data text-2xl skin-fw-heading" style={{ color: t.fg }}>{data.value}</div>
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
      <div className="flex h-full w-full items-center skin-gap-md px-4" style={{ backgroundColor: t.bg, borderRadius: 'var(--radius-card, 12px)' }}>
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg" style={{ backgroundColor: `${t.fg}1A`, color: t.fg }}>
          <IconKit name={iconKey} weight={iconWeight} size={22} color={t.fg} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-foreground-secondary">{data.title}</div>
          <div className="font-data text-2xl skin-fw-heading" style={{ color: t.fg }}>{data.value}</div>
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
      <div className="flex h-full w-full flex-col justify-center px-4" style={{ backgroundColor: t.bg, borderRadius: 'var(--radius-card, 12px)' }}>
        <IconKit name={iconKey} weight={iconWeight} size={24} color={t.fg} />
        <div className="mt-1 text-xs text-foreground-secondary">{data.title}</div>
        <div className="font-data text-2xl skin-fw-heading" style={{ color: t.fg }}>{data.value}</div>
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
        className="relative h-full w-full overflow-hidden px-4"
        style={{ background: `linear-gradient(135deg, ${t.fg}, ${t.fg}CC)`, borderRadius: 'var(--radius-card, 12px)' }}
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
      <div className="flex h-full w-full items-center skin-gap-md skin-card px-4">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg" style={{ backgroundColor: `${t.fg}1A`, color: t.fg }}>
          <IconKit name={iconKey} weight={iconWeight} size={22} color={t.fg} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-foreground-secondary">{data.title}</div>
          <div className="font-data text-2xl skin-fw-heading" style={{ color: t.fg }}>{data.value}</div>
        </div>
        {data.trend && (
          <div className="flex-none border-l border-border-subtle pl-3 text-right">
            <div className="text-[10px] text-foreground-muted">Change</div>
            <div className="font-data text-sm skin-fw-heading" style={{ color: data.trendUp ? 'var(--green, #22C55E)' : 'var(--red, #EF4444)' }}>
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
      <div className="font-data text-2xl skin-fw-heading" style={{ color: t.fg }}>{data.value}</div>
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

  // 防御：bars 为空时显示占位
  const bars = data.bars ?? [];
  if (variant !== 'stacked' && bars.length === 0 && !(data.stackBars?.length)) {
    return (
      <div className="flex h-full w-full flex-col bg-surface-primary p-3">
        {data.title && <div className="mb-2 text-sm skin-fw-body text-foreground-primary">{data.title}</div>}
        <div className="flex flex-1 items-center justify-center text-xs text-foreground-muted">暂无数据</div>
      </div>
    );
  }

  /* 堆叠模式 */
  if (variant === 'stacked' && data.stackBars && data.stackBars.length > 0) {
    const keys = data.stackKeys ?? Object.keys(data.stackBars[0]?.values ?? {});
    return (
      <div className="flex h-full w-full flex-col bg-surface-primary p-3">
        {data.title && <div className="mb-2 text-sm skin-fw-body text-foreground-primary">{data.title}</div>}
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.stackBars} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              {cs.showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle, #F3F4F6)" />}
              <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} hide={!cs.showAxis} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={56} hide={!cs.showAxis} tickFormatter={formatCompactNum} />
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
    ? { layout: 'vertical' as const, data: bars, margin: { top: 4, right: 16, bottom: 4, left: 8 } }
    : { layout: 'horizontal' as const, data: bars, margin: { top: 4, right: 8, bottom: 4, left: 0 } };

  return (
    <div className="flex h-full w-full flex-col bg-surface-primary p-3">
      {data.title && <div className="mb-2 text-sm skin-fw-body text-foreground-primary">{data.title}</div>}
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
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={56} hide={!cs.showAxis} tickFormatter={formatCompactNum} />
              </>
            )}
            <Tooltip cursor={{ fill: 'var(--surface-hover, #F9FAFB)' }} />
            <Bar dataKey="value" radius={isHorizontal ? [0, cs.barRadius, cs.barRadius, 0] : [cs.barRadius, cs.barRadius, 0, 0]}>
              {bars.map((b, i) => (
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
  // 防御：series 为空时显示占位
  const series = data.series ?? [];
  if (series.length === 0) {
    return (
      <div className="flex h-full w-full flex-col bg-surface-primary p-3">
        {data.title && <div className="mb-2 text-sm skin-fw-body text-foreground-primary">{data.title}</div>}
        <div className="flex flex-1 items-center justify-center text-xs text-foreground-muted">暂无数据</div>
      </div>
    );
  }
  // 多系列按 label 对齐成单数据集。
  const labels = series[0]?.points.map((p) => p.label) ?? [];
  const dataset = labels.map((label, i) => {
    const row: Record<string, string | number> = { label };
    for (const s of series) row[s.name] = s.points[i]?.value ?? 0;
    return row;
  });
  return (
    <div className="flex h-full w-full flex-col bg-surface-primary p-3">
      {data.title && <div className="mb-2 text-sm skin-fw-body text-foreground-primary">{data.title}</div>}
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dataset} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
            {cs.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle, #F3F4F6)" />}
            <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} hide={!cs.showAxis} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={56} hide={!cs.showAxis} tickFormatter={formatCompactNum} />
            <Tooltip />
            {cs.legend && <Legend {...cs.legend} />}
            {series.map((s, i) => (
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
  const slices = data.slices ?? [];
  if (slices.length === 0) {
    return (
      <div className="flex h-full w-full flex-col bg-surface-primary p-3">
        {data.title && <div className="mb-2 text-sm skin-fw-body text-foreground-primary">{data.title}</div>}
        <div className="flex flex-1 items-center justify-center text-xs text-foreground-muted">暂无数据</div>
      </div>
    );
  }
  return (
    <div className="flex h-full w-full flex-col bg-surface-primary p-3">
      {data.title && <div className="mb-2 text-sm skin-fw-body text-foreground-primary">{data.title}</div>}
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              outerRadius="80%"
              label={(e) => e.label}
            >
              {slices.map((s, i) => (
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
  const headers = data.headers ?? [];
  const rows = data.rows ?? [];
  if (headers.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-primary text-xs text-foreground-muted">
        暂无数据
      </div>
    );
  }
  return (
    <div className="h-full w-full overflow-visible bg-surface-primary">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="border-b border-border-default bg-surface-hover px-3 py-2 text-left skin-fw-body text-foreground-secondary">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
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
  const { shape, fill, src, fit, stroke, strokeWidth, opacity, rotation, borderRadius, dash } = data;
  const border = strokeWidth && stroke ? `${strokeWidth}px solid ${stroke}` : undefined;
  const inner =
    shape === 'line' ? (
      <svg className="h-full w-full" preserveAspectRatio="none">
        <line x1="0" y1="50%" x2="100%" y2="50%" stroke={stroke ?? 'var(--border-default, #E5E7EB)'} strokeWidth={strokeWidth ?? 1} strokeDasharray={dash ? '8 4' : undefined} />
      </svg>
    ) : src ? (
      // 图片填充：复用 ImageComponent 的 fit 语义（'cover'|'contain'|'fill'），
      // 通过 borderRadius / 圆形裁剪与几何形状保持一致。
      <img
        src={src}
        alt=""
        className="h-full w-full"
        style={{
          objectFit: fit ?? 'cover',
          border,
          borderRadius: shape === 'circle' ? '50%' : shape === 'rounded' ? borderRadius ?? 12 : undefined,
        }}
        draggable={false}
      />
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
  const titleFg = variant === 'gradient' ? 'var(--surface-primary)' : data.titleColor === 'brand' ? 'var(--color-primary)' : 'var(--foreground-primary)';

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
        <div className="flex min-w-0 items-center skin-gap-md">
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
          <div className="relative">
            {/* 色块条带：绝对定位贴标题底部 → 与标题底对齐并落在文字之后（重叠） */}
            <div
              className="absolute bottom-0 left-0 h-1.5 w-1/5 rounded-full"
              style={{ backgroundColor: data.underlineColor === 'black' ? 'var(--foreground-primary)' : 'var(--color-primary)' }}
            />
            <div className="relative text-2xl font-bold leading-tight text-foreground-primary">{text}</div>
          </div>
          {subtitle && <div className="mt-1.5 text-sm text-foreground-muted">{subtitle}</div>}
        </div>
      );
      break;

    case 'gradient':
      inner = (
        <div className="w-full px-5 py-4" style={{ background: `linear-gradient(135deg, ${color}, ${color}99)`, borderRadius: 'var(--radius-card, 12px)' }}>
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
        <div className="flex min-w-0 items-center skin-gap-md">
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
        <div className="flex min-w-0 items-center skin-gap-md">
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
      // 色块下划线:粗体标题 + 贴文字宽度 30% 的粗彩色块(标记笔质感),与标题字形底部重叠。
      // leading-none 剔除字体行高 → 盒子贴合字形;色块 absolute bottom-0 落在字形底部、文字之后(标题 relative 盖在其上)实现重叠。
      // inline-block 让色块百分比基准=标题文字宽;色块颜色=下划线颜色(underlineColor,缺省品牌色),与标题文字色(titleColor)解耦。
      inner = (
        <div className="min-w-0">
          <div className="relative inline-block leading-none">
            <div
              className="absolute bottom-0 left-0 h-2 w-[30%] rounded-md"
              style={{ backgroundColor: data.underlineColor === 'black' ? 'var(--foreground-primary)' : 'var(--color-primary)' }}
            />
            <div
              className="relative text-foreground-primary"
              style={{ fontSize: fs(), fontWeight: fw, color: titleFg }}
            >
              {text}
            </div>
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
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] skin-fw-body"
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
            <div className="flex items-center skin-gap-sm">
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
            <div className="flex items-center skin-gap-sm">
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
        <div className="skin-card flex h-full w-full flex-col skin-gap-xs p-3">
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
          className="flex h-full w-full flex-col justify-center skin-gap-sm p-5"
          style={{ background: `color-mix(in srgb, ${accent} 6%, var(--surface-secondary, #f8f8f8))`, borderRadius: 'var(--radius-card, 12px)' }}
        >
          <span className="text-3xl leading-none" style={{ color: accent }}>❝</span>
          {bodyEl}
          <div className="flex items-center skin-gap-sm">
            <span className="h-0.5 w-6 rounded-full" style={{ backgroundColor: accent }} />
            <span className="text-sm font-bold text-foreground-primary">{title}</span>
          </div>
          {footerEl}
        </div>
      );

    default: // standard
      return (
        <div className="skin-card-lg flex h-full w-full flex-col skin-gap-sm p-4">
          <div className="flex items-center skin-gap-sm">
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

/* ---- 页眉：左侧广告主 logo + 右侧业务线 logo ---- */

function HeaderLogo({ logo, side }: { logo: PageHeaderLogo; side: 'left' | 'right' }) {
  const height = logo.logoHeight ?? 28; /* px — configurable per logo, default 28 */
  const hasImg = logo.src && logo.src.trim();
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const customBg = (logo as any).bgColor as string | undefined;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexDirection: side === 'right' ? 'row-reverse' : 'row',
      }}
    >
      {hasImg ? (
        <img
          src={logo.src}
          alt={logo.text || ''}
          style={{ height, width: 'auto', maxWidth: 180, objectFit: 'contain' }}
        />
      ) : (
        <div
          style={{
            height,
            minWidth: height,
            borderRadius: 6,
            background: customBg || 'var(--color-primary, #e2503f)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            padding: '0 6px',
            flexShrink: 0,
          }}
        >
          {logo.initials || (logo.text || '?').slice(0, 2).toUpperCase()}
        </div>
      )}
      {logo.text && (
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--foreground-primary, #1e1c24)',
            whiteSpace: 'nowrap',
          }}
        >
          {logo.text}
        </span>
      )}
    </div>
  );
}

export function PageHeader({ data }: { data: PageHeaderData }) {
  const bg = data.background || 'var(--color-neutral-bg, #ffffff)';

  // 从项目元数据自动填充业务线/广告主信息
  const blCode = useEditorStore((s) => s.projectMeta?.businessLine);
  const advertiserName = useEditorStore((s) => s.projectMeta?.advertiser);

  // 业务线 code → 中文名 + 颜色（数据库唯一来源）
  const blInfo = useBusinessLineInfo(blCode);

  // 左侧 logo = 广告主；右侧 logo = 业务线（仅在用户手动上传图片时显示）
  const leftLogo: PageHeaderLogo = {
    ...data.leftLogo,
    text: data.leftLogo.text && data.leftLogo.text !== '广告主' ? data.leftLogo.text : (advertiserName || '广告主'),
  };
  const rightLogo: PageHeaderLogo = {
    ...data.rightLogo,
    text: data.rightLogo.text && data.rightLogo.text !== '业务线' ? data.rightLogo.text : (blInfo?.title || blInfo?.code || data.rightLogo.text || '业务线'),
  };
  // 业务线颜色仅用于用户已上传图片的配色辅助——无图片时不再渲染占位符
  // (rightLogo auto-fill removed: no default business line placeholder)

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: bg,
        border: '1px solid var(--border-default, #ebebeb)',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        boxSizing: 'border-box',
      }}
    >
      <HeaderLogo logo={leftLogo} side="left" />
      {data.dateLabel && (
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--foreground-secondary, #626166)',
            background: 'var(--background-secondary, #f5f7fa)',
            padding: '4px 16px',
            borderRadius: 6,
          }}
        >
          {data.dateLabel}
        </div>
      )}
      {/* 右侧业务线 logo：仅在用户上传了图片时显示，不再渲染默认占位符 */}
      {rightLogo.src?.trim() && <HeaderLogo logo={rightLogo} side="right" />}
    </div>
  );
}

/* ------------------------------- cards row ------------------------------- */

import type { CardsRowData as CardsRowDataType } from '@mediakit/shared';

export function CardsRow({ data }: { data: CardsRowDataType }) {
  const { items = [], gap = 16 } = data;
  if (!items.length) return null;

  return (
    <div
      className="flex h-full w-full"
      style={{ gap, alignItems: 'stretch' }}
    >
      {items.map((item, i) => (
        <div
          key={i}
          className="skin-card flex min-w-0 flex-1 flex-col p-4"
        >
          {item.icon && (
            item.iconType === 'kit' ? (
              <div className="mb-1.5" style={{ color: 'var(--color-primary)' }}>
                <IconKit name={item.icon} weight={item.iconWeight ?? 'regular'} size={24} />
              </div>
            ) : (
              <div className="mb-1.5 text-xl">{item.icon}</div>
            )
          )}
          <div className="text-sm font-bold leading-tight text-foreground-primary">{item.title}</div>
          {item.body && (
            <div className="mt-1.5 flex-1 text-xs leading-relaxed text-foreground-secondary whitespace-pre-line">{item.body}</div>
          )}
          {item.footer && (
            <div className="mt-2 border-t border-border-subtle pt-1.5 text-[10px] text-foreground-muted">{item.footer}</div>
          )}
        </div>
      ))}
    </div>
  );
}
