import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
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
} from '@mediakit/shared';
import { IconKit } from '../icons/IconKit';


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
        图片占位
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
  blue: { bg: '#EFF6FF', fg: '#3B82F6' },
  green: { bg: '#ECFDF5', fg: '#22C55E' },
  orange: { bg: '#FFF7F0', fg: '#FF5C00' },
  purple: { bg: '#F5F3FF', fg: '#8B5CF6' },
  red: { bg: '#FEF2F2', fg: '#EF4444' },
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
            <div className="mt-0.5 text-xs" style={{ color: data.trendUp ? '#22C55E' : '#EF4444' }}>
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
            <div className="mt-0.5 text-xs" style={{ color: data.trendUp ? '#22C55E' : '#EF4444' }}>
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
          <div className="mt-0.5 text-xs" style={{ color: data.trendUp ? '#22C55E' : '#EF4444' }}>
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
        <div className="absolute right-3 top-3 opacity-90" style={{ color: '#fff' }}>
          <IconKit name={iconKey} weight={iconWeight} size={20} color="#fff" />
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
      <div className="flex h-full w-full items-center gap-3 rounded-xl border border-border-default bg-surface-primary px-4">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg" style={{ backgroundColor: `${t.fg}1A`, color: t.fg }}>
          <IconKit name={iconKey} weight={iconWeight} size={22} color={t.fg} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-foreground-secondary">{data.title}</div>
          <div className="font-data text-2xl font-semibold" style={{ color: t.fg }}>{data.value}</div>
        </div>
        {data.trend && (
          <div className="flex-none border-l border-border-subtle pl-3 text-right">
            <div className="text-[10px] text-foreground-muted">变化</div>
            <div className="font-data text-sm font-semibold" style={{ color: data.trendUp ? '#22C55E' : '#EF4444' }}>
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
        <div className="mt-0.5 text-xs" style={{ color: data.trendUp ? '#22C55E' : '#EF4444' }}>
          {data.trendUp ? '▲' : '▼'} {data.trend}
        </div>
      )}
    </div>
  );
}

/* -------------------------------- bar chart ------------------------------ */
export function BarChartComponent({ data }: { data: BarChartData }) {
  return (
    <div className="flex h-full w-full flex-col bg-surface-primary p-3">
      {data.title && <div className="mb-2 text-sm font-medium text-foreground-primary">{data.title}</div>}
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.bars} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
            <Tooltip cursor={{ fill: '#F9FAFB' }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.bars.map((b, i) => (
                <Cell key={i} fill={b.color} />
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
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
            <Tooltip />
            {data.series.map((s) => (
              <Line key={s.name} type="monotone" dataKey={s.name} stroke={s.color} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* -------------------------------- pie chart ------------------------------ */
export function PieChartComponent({ data }: { data: PieChartData }) {
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
                <Cell key={i} fill={s.color} />
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
      业务组件 · {data.businessKind ?? 'unknown'}
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
        <line x1="0" y1="50%" x2="100%" y2="50%" stroke={stroke ?? '#E5E7EB'} strokeWidth={strokeWidth ?? 1} strokeDasharray={dash ? '8 4' : undefined} />
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
