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
  ImageData,
  IndicatorCardData,
  LineChartData,
  PieChartData,
  TableData,
  TextData,
} from '@mediakit/shared';

/* ---------------------------------- text --------------------------------- */
export function TextComponent({ data }: { data: TextData }) {
  return (
    <div
      className="h-full w-full overflow-hidden break-words"
      style={{
        fontSize: data.fontSize,
        fontWeight: data.fontWeight,
        fontFamily: data.fontFamily ?? 'Inter',
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
const THEME: Record<IndicatorCardData['colorTheme'], { bg: string; fg: string }> = {
  blue: { bg: '#EFF6FF', fg: '#3B82F6' },
  green: { bg: '#ECFDF5', fg: '#22C55E' },
  orange: { bg: '#FFF7F0', fg: '#FF5C00' },
  purple: { bg: '#F5F3FF', fg: '#8B5CF6' },
  red: { bg: '#FEF2F2', fg: '#EF4444' },
};

export function IndicatorCardComponent({ data }: { data: IndicatorCardData }) {
  const t = THEME[data.colorTheme] ?? THEME.blue;
  return (
    <div className="flex h-full w-full flex-col justify-center rounded-xl px-4" style={{ backgroundColor: t.bg }}>
      <div className="text-xs text-foreground-secondary">{data.title}</div>
      <div className="font-data text-2xl font-semibold" style={{ color: t.fg }}>
        {data.value}
      </div>
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
    <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-accent-primary/40 bg-accent-primary/5 text-center text-sm text-accent-primary">
      业务组件 · {data.businessKind ?? 'unknown'}
      {data.title ? ` · ${data.title}` : ''}
    </div>
  );
}
