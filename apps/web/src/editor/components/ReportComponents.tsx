/**
 * 业务组件（试点：Campaign 报告域）渲染器。
 *
 * 周报/月报/结案核心页的两个可复用锚点：
 *  - KpiBoard 业绩看板（≈PRD CMP-B1）：KPI 矩阵
 *  - TimelineCompare 周期对比表（≈PRD CMP-B13）：本期 vs 上期 + 状态
 * 复用 TableData 形状（headers+rows），table 字段兼作对象列表编辑器。
 */
import type {
  CampaignAnalysisData,
  CreatorWorkMetricsData,
  CreatorWorksTableData,
  KpiBoardData,
  KpiTrendDirection,
  MetaStripData,
  PlacementData,
  PostListData,
  ProductPerformanceData,
  StrategyBlockData,
  TimelineCompareData,
} from '@mediakit/shared';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { findIcon } from '../icons/catalog';
import { renderHtmlWithHighlights } from '../richText';
import { KPI_COLOR_TOKENS } from '../kpiTokens';

/* -------------------------------- kpi board ------------------------------- */

/** 对比文本上色：positive=升绿/降红；inverse（CPA/CPC 等降为好）=降绿/升红。 */
function compareColor(compare: string, direction: KpiTrendDirection = 'positive'): string {
  if (!compare) return 'transparent';
  const isDown = compare.trim().startsWith('-');
  const good = direction === 'inverse' ? isDown : !isDown;
  return good ? '#22C55E' : '#EF4444';
}

export function KpiBoard({ data }: { data: KpiBoardData }) {
  const { variant = 'grid', rows = [] } = data;
  const hidden = new Set(data.hiddenIndices ?? []);
  const items = rows
    .map((r, i) => {
      const token = data.valueColors?.[i] ?? null;
      const color = token && token !== 'primary' ? KPI_COLOR_TOKENS[token].fg : undefined;
      const direction = data.trendDirections?.[i] ?? 'positive';
      return { label: r[0] ?? '', value: r[1] ?? '', compare: r[2] ?? '', color, direction };
    })
    .filter((_, i) => !hidden.has(i));

  const Card = ({
    label, value, compare, color, direction = 'positive',
  }: { label: string; value: string; compare: string; color?: string; direction?: KpiTrendDirection }) => (
    <div className="flex flex-col justify-center">
      <div className="text-[11px] text-foreground-secondary">{label}</div>
      <div
        className="font-data text-xl font-bold text-foreground-primary"
        style={color ? { color } : undefined}
      >
        {value}
      </div>
      {compare && (
        <div className="text-[11px] font-medium" style={{ color: compareColor(compare, direction) }}>
          {compare}
        </div>
      )}
    </div>
  );

  if (variant === 'compact') {
    return (
      <div className="flex h-full w-full flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border border-border-default bg-surface-primary p-3">
        {items.map((it, i) => (
          <div key={i} className="flex items-baseline gap-1.5">
            <span className="text-[11px] text-foreground-secondary">{it.label}</span>
            <span className="font-data text-base font-semibold text-foreground-primary">{it.value}</span>
            {it.compare && (
              <span className="text-[10px]" style={{ color: compareColor(it.compare, it.direction) }}>
                {it.compare}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'row') {
    return (
      <div className="flex h-full w-full items-stretch gap-2">
        {items.map((it, i) => (
          <div key={i} className="flex-1">
            <Card {...it} />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'gradient') {
    // 渐变深色卡片：每个 KPI 用渐变背景 + 白色文字，2 列网格。
    return (
      <div className="grid h-full w-full grid-cols-2 gap-3 overflow-auto">
        {items.map((it, i) => {
          const token = data.valueColors?.[i] ?? 'primary';
          const c = KPI_COLOR_TOKENS[token];
          return (
            <div
              key={i}
              className="flex flex-col justify-center rounded-2xl p-5"
              style={{ background: `linear-gradient(135deg, ${c.fg}, ${c.fg}CC)`, color: '#fff' }}
            >
              <div className="text-xs text-white/70">{it.label}</div>
              <div className="font-data text-2xl font-bold text-white">{it.value}</div>
              {it.compare && (
                <div className="text-[11px] font-medium text-white/80">{it.compare}</div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (variant === 'minimal') {
    // 极简线框：无背景色，顶部 2px 颜色线 + label + 大数值，等宽排列。
    return (
      <div className="grid h-full w-full grid-cols-3 gap-2 overflow-auto">
        {items.map((it, i) => {
          const token = data.valueColors?.[i] ?? null;
          const color = token && token !== 'primary' ? KPI_COLOR_TOKENS[token].fg : '#9CA3AF';
          return (
            <div key={i} className="flex flex-col justify-center" style={{ borderTop: `2px solid ${color}` }}>
              <div className="mt-2 text-[11px] text-foreground-secondary">{it.label}</div>
              <div className="font-data text-xl font-bold text-foreground-primary">{it.value}</div>
              {it.compare && (
                <div className="text-[11px] font-medium" style={{ color: compareColor(it.compare, it.direction) }}>
                  {it.compare}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (variant === 'flat') {
    // 平铺指标条（参考图风格）：单行等宽卡 —— 标题 + 大数值（按类型染色）+ 环比 + 对比基准锚点。
    const compareLabel = data.compareLabel?.trim() ? data.compareLabel : 'vs 上期';
    return (
      <div className="flex h-full w-full items-stretch gap-2 overflow-auto">
        {items.map((it, i) => (
          <div
            key={i}
            className="flex flex-1 flex-col justify-center rounded-xl border border-border-subtle bg-surface-primary px-3.5 py-2.5"
          >
            <div className="text-[10px] uppercase tracking-wide text-foreground-muted">{it.label}</div>
            <div
              className="font-data text-2xl font-bold leading-tight"
              style={it.color ? { color: it.color } : undefined}
            >
              {it.value}
            </div>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              {it.compare && (
                <span className="text-[11px] font-semibold" style={{ color: compareColor(it.compare, it.direction) }}>
                  {it.compare}
                </span>
              )}
              <span className="text-[10px] text-foreground-muted">{compareLabel}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div
        className="grid h-full w-full gap-3 overflow-auto p-1"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}
      >
        {items.map((it, i) => {
          const token = data.valueColors?.[i] ?? null;
          const isPrimary = !token || token === 'primary';
          const c = KPI_COLOR_TOKENS[token ?? 'primary'];
          const Icon = findIcon(data.icons?.[i] ?? undefined)?.Comp;
          const weight = data.iconWeight ?? 'regular';
          return (
            <div
              key={i}
              className="flex items-center justify-between rounded-2xl bg-surface-primary p-5 shadow-sm"
            >
              <div className="flex flex-col gap-1">
                <div className="text-xs text-foreground-secondary">{it.label}</div>
                <div
                  className="font-data text-2xl font-bold text-foreground-primary"
                  style={isPrimary ? undefined : { color: c.fg }}
                >
                  {it.value}
                </div>
                {it.compare && (
                  <div className="text-xs font-medium" style={{ color: compareColor(it.compare, it.direction) }}>
                    {it.compare}
                  </div>
                )}
              </div>
              {Icon && (
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: c.softBg }}
                >
                  <Icon size={22} weight={weight} color={isPrimary ? undefined : c.fg} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // grid（默认 3 列）：指标格无 gap，彼此紧贴并贴区块边缘（默认尺寸不留 padding）。
  return (
    <div className="grid h-full w-full grid-cols-3 overflow-auto">
      {items.map((it, i) => (
        <Card key={i} {...it} />
      ))}
    </div>
  );
}

/* ----------------------------- timeline compare ---------------------------- */

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  Exceeded: { bg: '#22C55E14', fg: '#22C55E' },
  Optimized: { bg: '#3B82F614', fg: '#3B82F6' },
  Stable: { bg: '#9CA3AF14', fg: '#6B7280' },
};

function statusChip(status: string) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.Stable;
  return { bg: s.bg, fg: s.fg };
}

export function TimelineCompare({ data }: { data: TimelineCompareData }) {
  const { variant = 'standard', headers = [], rows = [] } = data;

  if (variant === 'cards') {
    // 卡片：每行数据用独立卡片展示，2 列网格。指标名在顶部，本期/上期并列大数值，状态在底部色块。
    const curLabel = headers[1] ?? '本期';
    const prevLabel = headers[2] ?? '上期';
    return (
      <div className="grid h-full w-full grid-cols-2 gap-3 overflow-auto">
        {rows.map((row, ri) => {
          const label = row[0] ?? '';
          const cur = row[1] ?? '';
          const prev = row[2] ?? '';
          const status = row[3] ?? '';
          const chip = statusChip(status);
          return (
            <div key={ri} className="flex flex-col gap-2 rounded-xl border border-border-default bg-surface-primary p-3">
              <div className="text-xs font-medium text-foreground-secondary">{label}</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col">
                  <span className="text-[10px] text-foreground-muted">{curLabel}</span>
                  <span className="font-data text-lg font-bold text-foreground-primary">{cur}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-foreground-muted">{prevLabel}</span>
                  <span className="font-data text-lg font-semibold text-foreground-secondary">{prev}</span>
                </div>
              </div>
              {status && (
                <div className="mt-auto">
                  <span className="rounded px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: chip.bg, color: chip.fg }}>
                    {status}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (variant === 'mini') {
    // 仅指标 + 本期 + 变化方向（两列紧凑）。
    return (
      <div className="flex h-full w-full flex-col gap-1 overflow-auto rounded-xl border border-border-default bg-surface-primary p-3">
        {rows.map((r, ri) => {
          const label = r[0] ?? '';
          const cur = r[1] ?? '';
          const prev = r[2] ?? '';
          const up = parseFloat(cur) >= parseFloat(prev);
          return (
            <div key={ri} className="flex items-center justify-between border-b border-border-subtle py-1.5 last:border-b-0">
              <span className="text-sm text-foreground-primary">{label}</span>
              <span className="flex items-center gap-2">
                <span className="font-data text-sm font-semibold text-foreground-primary">{cur}</span>
                <span className="text-[11px]" style={{ color: up ? '#22C55E' : '#EF4444' }}>
                  {up ? '▲' : '▼'}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // standard / with-bar：标准对比表（指标 / 本期 / 上期 / 状态）
  return (
    <div className="h-full w-full overflow-auto rounded-xl border border-border-default bg-surface-primary">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className="border-b border-border-default bg-surface-hover px-3 py-2 text-left font-medium text-foreground-secondary"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            const status = row[3] ?? '';
            const chip = statusChip(status);
            const cur = parseFloat(row[1] ?? '0');
            const prev = parseFloat(row[2] ?? '0');
            const pct = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : 0;
            return (
              <tr key={ri}>
                <td className="border-b border-border-subtle px-3 py-2 text-foreground-primary">{row[0]}</td>
                <td className="border-b border-border-subtle px-3 py-2 font-data font-semibold text-foreground-primary">
                  {row[1]}
                </td>
                <td className="border-b border-border-subtle px-3 py-2 text-foreground-secondary">{row[2]}</td>
                <td className="border-b border-border-subtle px-3 py-2">
                  <div className="flex items-center gap-2">
                    {variant === 'with-bar' && (
                      <div className="h-1.5 w-16 overflow-hidden rounded bg-surface-hover">
                        <div
                          className="h-full"
                          style={{
                            width: `${Math.min(Math.abs(pct), 100)}%`,
                            backgroundColor: pct >= 0 ? '#22C55E' : '#EF4444',
                          }}
                        />
                      </div>
                    )}
                    {status && (
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                        style={{ backgroundColor: chip.bg, color: chip.fg }}
                      >
                        {status}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------ meta strip ------------------------------- */

type MetaItem = { iconKey: string; label: string; text: string };

function MetaInline({ items }: { items: MetaItem[] }) {
  return (
    <div className="flex h-full w-full flex-wrap items-center gap-2 overflow-auto">
      {items.map((it, i) => {
        const Icon = findIcon(it.iconKey)?.Comp;
        return (
          <div key={i} className="flex items-center gap-1.5 rounded bg-surface-secondary px-2 py-1">
            {Icon && <Icon size={14} className="text-foreground-secondary" />}
            <span className="text-[11px] uppercase tracking-wide text-foreground-secondary">{it.label}</span>
            <span className="text-sm text-foreground-primary">{it.text}</span>
          </div>
        );
      })}
    </div>
  );
}

function MetaDivider({ items }: { items: MetaItem[] }) {
  return (
    <div className="flex h-full w-full flex-wrap items-center">
      {items.map((it, i) => {
        const Icon = findIcon(it.iconKey)?.Comp;
        return (
          <div
            key={i}
            className={`flex items-center gap-1.5 ${i === 0 ? 'pl-0' : 'border-l border-border-subtle pl-2'}`}
          >
            {Icon && <Icon size={13} className="text-foreground-secondary" />}
            <span className="text-[11px] uppercase tracking-wide text-foreground-muted">{it.label}</span>
            <span className="text-sm text-foreground-primary">{it.text}</span>
          </div>
        );
      })}
    </div>
  );
}

function MetaList({ items }: { items: MetaItem[] }) {
  return (
    <div className="flex h-full w-full flex-col divide-y divide-border-subtle">
      {items.map((it, i) => {
        const Icon = findIcon(it.iconKey)?.Comp;
        return (
          <div key={i} className="flex items-baseline justify-between gap-3 py-1.5">
            <span className="flex items-center gap-1.5">
              {Icon && <Icon size={13} className="text-foreground-secondary" />}
              <span className="text-[11px] uppercase tracking-wide text-foreground-secondary">{it.label}</span>
            </span>
            <span className="text-right text-sm text-foreground-primary">{it.text}</span>
          </div>
        );
      })}
    </div>
  );
}

function MetaCards({ items }: { items: MetaItem[] }) {
  return (
    <div className="grid h-full w-full grid-cols-3 content-start gap-2 overflow-auto">
      {items.map((it, i) => {
        const Icon = findIcon(it.iconKey)?.Comp;
        return (
          <div key={i} className="flex flex-col gap-1 rounded-lg border border-border-subtle bg-surface-primary p-2">
            <span className="flex items-center gap-1.5">
              {Icon && <Icon size={14} className="text-foreground-secondary" />}
              <span className="text-[11px] uppercase tracking-wide text-foreground-secondary">{it.label}</span>
            </span>
            <span className="text-sm text-foreground-primary">{it.text}</span>
          </div>
        );
      })}
    </div>
  );
}

function MetaStat({ items }: { items: MetaItem[] }) {
  return (
    <div className="flex h-full w-full flex-wrap items-end gap-x-6 gap-y-2">
      {items.map((it, i) => {
        const Icon = findIcon(it.iconKey)?.Comp;
        return (
          <div key={i} className="flex flex-col">
            <span className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-foreground-secondary">
              {Icon && <Icon size={13} className="text-foreground-secondary" />}
              {it.label}
            </span>
            <span className="font-data text-xl font-bold text-foreground-primary">{it.text}</span>
          </div>
        );
      })}
    </div>
  );
}

export function MetaStripComponent({ data }: { data: MetaStripData }) {
  const { variant = 'inline', rows = [] } = data;
  const items: MetaItem[] = rows.map((r) => ({ iconKey: r[0] ?? '', label: r[1] ?? '', text: r[2] ?? '' }));
  if (variant === 'divider') return <MetaDivider items={items} />;
  if (variant === 'list') return <MetaList items={items} />;
  if (variant === 'cards') return <MetaCards items={items} />;
  if (variant === 'stat') return <MetaStat items={items} />;
  return <MetaInline items={items} />;
}

/* ---------------------------- strategy block ----------------------------- */

export function StrategyBlockComponent({ data }: { data: StrategyBlockData }) {
  const { variant = 'default' } = data;
  if (variant === 'labeled') return <StrategyLabeled data={data} />;
  if (variant === 'bulleted') return <StrategyBulleted data={data} />;
  return <StrategyDefault data={data} />;
}

/** default：平铺，图标 + 深色大写标题 + 高亮正文。 */
function StrategyDefault({ data }: { data: StrategyBlockData }) {
  const rows = data.rows ?? [];
  return (
    <div className="flex h-full w-full flex-col gap-3 overflow-auto">
      {rows.map((r, i) => {
        const iconKey = r[0] ?? '';
        const title = r[1] ?? '';
        const content = r[2] ?? '';
        const Icon = findIcon(iconKey)?.Comp;
        return (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              {Icon && <Icon size={16} className="text-secondary" />}
              <span className="text-xs font-semibold uppercase tracking-wide text-foreground-primary">
                {title}
              </span>
            </div>
            <div
              className="text-sm text-foreground-secondary [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_li]:my-0.5 [&_b]:font-semibold [&_strong]:font-semibold"
              dangerouslySetInnerHTML={{ __html: renderHtmlWithHighlights(content, data.highlights) }}
            />
          </div>
        );
      })}
    </div>
  );
}

/** labeled（参考#4）：卡片 + 主题色大写标签标题 + 高亮正文 + 块间发丝分隔。 */
function StrategyLabeled({ data }: { data: StrategyBlockData }) {
  const rows = data.rows ?? [];
  return (
    <div className="flex h-full w-full flex-col rounded-xl border border-border-default bg-surface-primary p-4 shadow-sm">
      {rows.map((r, i) => {
        const iconKey = r[0] ?? '';
        const title = r[1] ?? '';
        const content = r[2] ?? '';
        const Icon = findIcon(iconKey)?.Comp;
        return (
          <div key={i} className={`flex flex-col gap-1 ${i > 0 ? 'mt-3 border-t border-border-subtle pt-3' : ''}`}>
            <div className="flex items-center gap-1.5">
              {Icon && <Icon size={16} className="text-secondary" />}
              <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
                {title}
              </span>
            </div>
            <div
              className="text-sm text-foreground-secondary [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_li]:my-0.5 [&_b]:font-semibold [&_strong]:font-semibold"
              dangerouslySetInnerHTML={{ __html: renderHtmlWithHighlights(content, data.highlights) }}
            />
          </div>
        );
      })}
    </div>
  );
}

/** bulleted（参考#5）：卡片 + 首行作小标题（图标+标题、下方分隔）+ 其余行 • 项目符号列表（两两成对，1 卡含 2 个策略块配置）。 */
function StrategyBulleted({ data }: { data: StrategyBlockData }) {
  const rows = data.rows ?? [];
  if (rows.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-xl border border-border-default bg-surface-primary p-4 shadow-sm text-xs text-foreground-muted">
        策略块
      </div>
    );
  }
  const [headerRow, ...bodyRows] = rows;
  const HeaderIcon = findIcon(headerRow[0] ?? '')?.Comp;
  const hTitle = headerRow[1] ?? '';
  return (
    <div className="flex h-full w-full flex-col rounded-xl border border-border-default bg-surface-primary p-4 shadow-sm">
      <div className="flex items-center gap-1.5">
        {HeaderIcon && <HeaderIcon size={16} className="text-secondary" />}
        <span className="text-xs font-semibold uppercase tracking-wide text-foreground-primary">
          {hTitle}
        </span>
      </div>
      {bodyRows.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-0.5 border-t border-border-subtle pt-3">
          {bodyRows.map((r, i) => {
            const content = r[2] || r[1] || '';
            return (
              <div key={i} className="flex gap-2 py-0.5 text-sm text-foreground-secondary">
                <span className="flex-none text-secondary">•</span>
                <div
                  className="min-w-0 flex-1 [&_ul]:my-0.5 [&_ul]:list-disc [&_ul]:pl-4"
                  dangerouslySetInnerHTML={{ __html: renderHtmlWithHighlights(content, data.highlights) }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* --------------------------- product performance -------------------------- */
// ≈PRD CMP-B12。列顺序 [商品, 图URL, 销量, 占比, 品类]。

function ImgOrPlaceholder({ url, label, cls }: { url: string; label: string; cls?: string }) {
  if (url) {
    return <img src={url} alt={label} draggable={false} className={`rounded object-cover ${cls ?? ''}`} />;
  }
  return (
    <div
      className={`flex items-center justify-center rounded bg-surface-hover text-[10px] text-foreground-muted ${cls ?? ''}`}
    >
      {label.slice(0, 1) || '?'}
    </div>
  );
}

export function ProductPerformance({ data }: { data: ProductPerformanceData }) {
  const { variant = 'cards', insight, rows = [] } = data;
  const items = rows.map((r) => ({ name: r[0] ?? '', img: r[1] ?? '', sold: r[2] ?? '', share: r[3] ?? '', cat: r[4] ?? '' }));

  if (variant === 'bar') {
    // 条形图：横向 BarChart(layout=vertical) 展示 TOP 商品销量。
    // sold 字段可能是 "1.2K"/"85%" 文本，解析首段数字作 value；无数字则按行号递减占位。
    const chartData = items.map((it, i) => {
      const m = it.sold.match(/-?\d+(\.\d+)?/);
      return { name: it.name || `#${i + 1}`, value: m ? parseFloat(m[0]) : items.length - i, sold: it.sold };
    });
    return (
      <div className="flex h-full w-full gap-2 rounded-xl border border-border-default bg-surface-primary p-3">
        <div className="min-w-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={chartData} margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
              <Tooltip cursor={{ fill: '#F9FAFB' }} formatter={(v: number) => v} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="var(--color-primary, #FF5C00)">
                <LabelList dataKey="sold" position="right" style={{ fontSize: 11 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {insight && (
          <div className="flex w-[220px] flex-none flex-col justify-center rounded-lg bg-primary/5 p-3">
            <div className="mb-1 text-[11px] font-semibold text-primary">Insight</div>
            <div className="text-xs text-foreground-secondary">{insight}</div>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'pie') {
    // 品类饼图：按品类聚合商品，左侧 PieChart 展示品类分布，右侧 TOP 商品列表。
    const PIE_COLORS = ['#FF5C00', '#3B82F6', '#22C55E', '#8B5CF6', '#F59E0B', '#EC4899', '#14B8A6', '#6B7280'];
    const catMap = new Map<string, number>();
    items.forEach((it) => {
      const cat = it.cat || '未分类';
      const m = it.sold.match(/-?\d+(\.\d+)?/);
      const v = m ? parseFloat(m[0]) : 1;
      catMap.set(cat, (catMap.get(cat) ?? 0) + v);
    });
    const pieData = Array.from(catMap.entries()).map(([name, value]) => ({ name, value }));
    return (
      <div className="flex h-full w-full gap-2 rounded-xl border border-border-default bg-surface-primary p-3">
        <div className="flex min-w-0 flex-1 items-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius="75%"
                innerRadius="40%"
                paddingAngle={2}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => v} />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                iconSize={8}
                iconType="circle"
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex w-[260px] flex-none flex-col gap-1 overflow-auto">
          <div className="mb-1 text-[11px] font-semibold text-foreground-secondary">TOP 商品</div>
          {items.slice(0, 8).map((it, i) => (
            <div key={i} className="flex items-center gap-2 border-b border-border-subtle py-1 last:border-b-0">
              <span className="w-4 flex-none text-center text-[10px] text-foreground-muted">{i + 1}</span>
              <ImgOrPlaceholder url={it.img} label={it.name} cls="h-7 w-7 flex-none" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs text-foreground-primary">{it.name}</div>
                <div className="text-[10px] text-foreground-muted">{it.cat}</div>
              </div>
              <div className="flex-none text-right">
                <div className="font-data text-xs font-semibold text-foreground-primary">{it.sold}</div>
                <div className="text-[10px] text-foreground-secondary">{it.share}</div>
              </div>
            </div>
          ))}
        </div>
        {insight && (
          <div className="flex w-[200px] flex-none flex-col justify-center rounded-lg bg-primary/5 p-3">
            <div className="mb-1 text-[11px] font-semibold text-primary">Insight</div>
            <div className="text-xs text-foreground-secondary">{insight}</div>
          </div>
        )}
      </div>
    );
  }

  const Row = ({ it, rank }: { it: (typeof items)[number]; rank: number }) => (
    <div className="flex items-center gap-2 border-b border-border-subtle py-1.5 last:border-b-0">
      <span className="w-5 flex-none text-center text-xs text-foreground-muted">{rank}</span>
      <ImgOrPlaceholder url={it.img} label={it.name} cls="h-10 w-10 flex-none" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-foreground-primary">{it.name}</div>
        <div className="text-[10px] text-foreground-muted">{it.cat}</div>
      </div>
      <div className="flex-none text-right">
        <div className="font-data text-sm font-semibold text-foreground-primary">{it.sold}</div>
        <div className="text-[10px] text-foreground-secondary">占比 {it.share}</div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full w-full gap-2 rounded-xl border border-border-default bg-surface-primary p-3">
      <div className={insight ? 'min-w-0 flex-1' : 'min-w-0 flex-1'}>
        {variant === 'rank' ? (
          <div className="flex flex-col">{items.map((it, i) => <Row key={i} it={it} rank={i + 1} />)}</div>
        ) : (
          <div className={`grid ${variant === 'grid' ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
            {items.map((it, i) => (
              <div key={i} className="flex flex-col gap-1 rounded-lg border border-border-subtle p-2">
                <ImgOrPlaceholder url={it.img} label={it.name} cls="h-12 w-full" />
                <div className="truncate text-xs font-medium text-foreground-primary">{it.name}</div>
                <div className="flex justify-between text-[10px] text-foreground-secondary">
                  <span>{it.sold}</span>
                  <span>{it.share}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {insight && (
        <div className="flex w-[260px] flex-none flex-col justify-center rounded-lg bg-primary/5 p-3">
          <div className="mb-1 text-[11px] font-semibold text-primary">Insight</div>
          <div className="text-xs text-foreground-secondary">{insight}</div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ placement display ------------------------- */
// ≈PRD CMP-B15。列顺序 [名称, 截图URL, 数据]。

export function PlacementDisplay({ data }: { data: PlacementData }) {
  const { variant = 'grid', highlights, learnings, rows = [] } = data;
  const items = rows.map((r) => ({ name: r[0] ?? '', img: r[1] ?? '', metric: r[2] ?? '' }));

  if (variant === 'single') {
    const it = items[0] ?? { name: '', img: '', metric: '' };
    return (
      <div className="flex h-full w-full gap-3 rounded-xl border border-border-default bg-surface-primary p-3">
        <ImgOrPlaceholder url={it.img} label={it.name} cls="h-full w-1/2" />
        <div className="flex flex-1 flex-col justify-center">
          <div className="text-sm font-semibold text-foreground-primary">{it.name}</div>
          <div className="mt-1 font-data text-lg font-bold text-primary">{it.metric}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-2 rounded-xl border border-border-default bg-surface-primary p-3">
      <div className="grid flex-1 grid-cols-3 gap-2 overflow-auto">
        {items.map((it, i) => (
          <div key={i} className="flex flex-col gap-1 rounded-lg border border-border-subtle p-2">
            <ImgOrPlaceholder url={it.img} label={it.name} cls="h-16 w-full" />
            <div className="truncate text-xs font-medium text-foreground-primary">{it.name}</div>
            <div className="text-[10px] text-foreground-secondary">{it.metric}</div>
          </div>
        ))}
      </div>
      {variant === 'with-text' && (highlights || learnings) && (
        <div className="grid flex-none grid-cols-2 gap-2 border-t border-border-subtle pt-2">
          {highlights && (
            <div>
              <div className="text-[11px] font-semibold text-primary">Highlights</div>
              <div className="text-[11px] text-foreground-secondary">{highlights}</div>
            </div>
          )}
          {learnings && (
            <div>
              <div className="text-[11px] font-semibold text-foreground-primary">Learnings</div>
              <div className="text-[11px] text-foreground-secondary">{learnings}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------- post list ------------------------------- */
// ≈PRD CMP-B16。列顺序 [截图URL, 标题, ID, 链接, 数据]。

export function PostList({ data }: { data: PostListData }) {
  const { variant = 'cards', headers = [], rows = [] } = data;
  const items = rows.map((r) => ({ img: r[0] ?? '', title: r[1] ?? '', id: r[2] ?? '', link: r[3] ?? '', metric: r[4] ?? '' }));
  const idLabel = headers[2] ?? 'ID';

  if (variant === 'compact') {
    return (
      <div className="flex h-full w-full flex-col gap-1 overflow-auto rounded-xl border border-border-default bg-surface-primary p-3">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border-subtle py-1.5 last:border-b-0">
            <span className="min-w-0 flex-1 truncate text-sm text-foreground-primary">{it.title}</span>
            <span className="flex-none text-[11px] text-foreground-muted">{idLabel} {it.id}</span>
            <span className="flex-none text-[11px] text-foreground-secondary">{it.metric}</span>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'row') {
    return (
      <div className="flex h-full w-full flex-col gap-1 overflow-auto rounded-xl border border-border-default bg-surface-primary p-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-surface-hover">
            <ImgOrPlaceholder url={it.img} label={it.title} cls="h-10 w-10 flex-none" />
            <div className="min-w-0 flex-1 truncate text-sm text-foreground-primary">{it.title}</div>
            <span className="flex-none text-[11px] text-foreground-muted">{it.id}</span>
            <span className="flex-none text-[11px] text-foreground-secondary">{it.metric}</span>
          </div>
        ))}
      </div>
    );
  }

  // cards
  return (
    <div className="grid h-full w-full grid-cols-3 gap-2 overflow-auto rounded-xl border border-border-default bg-surface-primary p-2">
      {items.map((it, i) => (
        <div key={i} className="flex flex-col gap-1 rounded-lg border border-border-subtle p-2">
          <ImgOrPlaceholder url={it.img} label={it.title} cls="h-16 w-full" />
          <div className="line-clamp-1 text-xs font-medium text-foreground-primary">{it.title}</div>
          <div className="flex items-center justify-between text-[10px] text-foreground-secondary">
            <span>{it.id}</span>
            <span>{it.metric}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------- campaign analysis --------------------------- */
// ≈PRD CMP-B17。Campaign 单达人维度分析图表：radar / combo / funnel。

const CAMPAIGN_COLORS = ['#FF5C00', '#3B82F6', '#22C55E', '#8B5CF6', '#F59E0B', '#EC4899'];

export function CampaignAnalysis({ data }: { data: CampaignAnalysisData }) {
  const { variant = 'radar', title, subtitle, dimensions = [], series = [], funnelSteps = [], insight } = data;

  return (
    <div className="flex h-full w-full flex-col gap-2 rounded-xl border border-border-default bg-surface-primary p-3">
      {(title || subtitle) && (
        <div className="flex flex-none flex-col">
          {title && <div className="text-sm font-semibold text-foreground-primary">{title}</div>}
          {subtitle && <div className="text-[11px] text-foreground-secondary">{subtitle}</div>}
        </div>
      )}
      <div className="min-h-0 flex-1">
        {variant === 'radar' && <CampaignRadar dimensions={dimensions} />}
        {variant === 'combo' && <CampaignCombo series={series} />}
        {variant === 'funnel' && <CampaignFunnel steps={funnelSteps} />}
      </div>
      {insight && (
        <div className="flex-none rounded-lg bg-primary/5 p-2.5">
          <div className="mb-0.5 text-[11px] font-semibold text-primary">Insight</div>
          <div className="text-[11px] text-foreground-secondary">{insight}</div>
        </div>
      )}
    </div>
  );
}

function CampaignRadar({ dimensions }: { dimensions: CampaignAnalysisData['dimensions'] }) {
  if (!dimensions || dimensions.length === 0) {
    return <div className="flex h-full items-center justify-center text-xs text-foreground-muted">无维度数据</div>;
  }
  const data = dimensions.map((d) => ({ label: d.label, value: d.value, max: d.max ?? 100 }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="var(--color-border-default, #E5E7EB)" />
        <PolarAngleAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-foreground-secondary, #6B7280)' }} />
        <PolarRadiusAxis angle={90} domain={[0, 'auto']} tick={{ fontSize: 9, fill: 'var(--color-foreground-muted, #9CA3AF)' }} />
        <Radar dataKey="value" stroke="#FF5C00" fill="#FF5C00" fillOpacity={0.35} />
        <Tooltip formatter={(v: number) => v} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

function CampaignCombo({ series }: { series: CampaignAnalysisData['series'] }) {
  if (!series || series.length === 0) {
    return <div className="flex h-full items-center justify-center text-xs text-foreground-muted">无系列数据</div>;
  }
  const data = series.map((s) => ({ label: s.label, barValue: s.barValue, lineValue: s.lineValue }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle, #F3F4F6)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="left" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip />
        <Bar yAxisId="left" dataKey="barValue" radius={[4, 4, 0, 0]} fill="#FF5C00" barSize="40%" />
        <Line yAxisId="right" dataKey="lineValue" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function CampaignFunnel({ steps }: { steps: CampaignAnalysisData['funnelSteps'] }) {
  if (!steps || steps.length === 0) {
    return <div className="flex h-full items-center justify-center text-xs text-foreground-muted">无漏斗数据</div>;
  }
  const max = Math.max(...steps.map((s) => s.value), 1);
  return (
    <div className="flex h-full w-full flex-col justify-center gap-2">
      {steps.map((s, i) => {
        const pct = Math.round((s.value / max) * 100);
        const color = CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length];
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="w-16 flex-none text-right text-[11px] text-foreground-secondary">{s.label}</span>
            <div className="relative h-7 flex-1 overflow-hidden rounded bg-surface-hover">
              <div
                className="flex h-full items-center justify-end rounded px-2 text-[10px] font-medium text-white"
                style={{
                  width: `${Math.max(pct, 12)}%`,
                  background: `linear-gradient(90deg, ${color}, ${color}CC)`,
                }}
              >
                {s.value}
              </div>
            </div>
            <span className="w-10 flex-none text-right text-[10px] text-foreground-muted">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------- creator work metrics ------------------------- */
// ≈PRD CMP-B18。单达人作品数据指标：grid / strip / card / detailed。

export function CreatorWorkMetrics({ data }: { data: CreatorWorkMetricsData }) {
  const { variant = 'grid', title, subtitle, cover, workName, metrics = [] } = data;

  if (variant === 'strip') {
    return (
      <div className="flex h-full w-full flex-col gap-1.5 rounded-xl border border-border-default bg-surface-primary p-3">
        {(title || subtitle) && (
          <div className="flex flex-none flex-col">
            {title && <div className="text-sm font-semibold text-foreground-primary">{title}</div>}
            {subtitle && <div className="text-[11px] text-foreground-secondary">{subtitle}</div>}
          </div>
        )}
        <div className="flex flex-1 flex-wrap items-stretch">
          {metrics.map((m, i) => (
            <div
              key={i}
              className={`flex flex-1 flex-col justify-center px-3 ${i > 0 ? 'border-l border-border-subtle' : ''}`}
            >
              <div className="text-[10px] text-foreground-muted">{m.label}</div>
              <div
                className="font-data text-lg font-bold"
                style={{ color: m.color ?? 'var(--color-foreground-primary, #1A1A1A)' }}
              >
                {m.value}
              </div>
              {m.sub && (
                <div className="text-[10px] font-medium" style={{ color: m.color ?? '#22C55E' }}>{m.sub}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className="flex h-full w-full flex-col gap-2 rounded-xl border border-border-default bg-surface-primary p-3">
        {(title || subtitle) && (
          <div className="flex flex-none flex-col">
            {title && <div className="text-sm font-semibold text-foreground-primary">{title}</div>}
            {subtitle && <div className="text-[11px] text-foreground-secondary">{subtitle}</div>}
          </div>
        )}
        <div className="flex flex-1 gap-3">
          {(cover || workName) && (
            <div className="flex flex-none flex-col items-center justify-center gap-1.5" style={{ width: 96 }}>
              <ImgOrPlaceholder url={cover ?? ''} label={workName ?? ''} cls="h-20 w-20" />
              {workName && (
                <div className="line-clamp-2 text-center text-[11px] font-medium text-foreground-primary">{workName}</div>
              )}
            </div>
          )}
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
            {metrics.map((m, i) => (
              <div key={i} className="flex flex-col justify-center">
                <div className="text-[10px] text-foreground-muted">{m.label}</div>
                <div
                  className="font-data text-base font-bold"
                  style={{ color: m.color ?? 'var(--color-foreground-primary, #1A1A1A)' }}
                >
                  {m.value}
                </div>
                {m.sub && (
                  <div className="text-[10px] font-medium" style={{ color: m.color ?? '#22C55E' }}>{m.sub}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'detailed') {
    // 详细：每个指标卡片带彩色左边框强调。
    return (
      <div className="flex h-full w-full flex-col gap-1.5 rounded-xl border border-border-default bg-surface-primary p-3">
        {(title || subtitle) && (
          <div className="flex flex-none flex-col">
            {title && <div className="text-sm font-semibold text-foreground-primary">{title}</div>}
            {subtitle && <div className="text-[11px] text-foreground-secondary">{subtitle}</div>}
          </div>
        )}
        <div className="grid flex-1 grid-cols-3 gap-2">
          {metrics.map((m, i) => {
            const color = m.color ?? CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length];
            return (
              <div
                key={i}
                className="flex flex-col justify-center rounded-lg bg-surface-secondary p-2.5"
                style={{ borderLeft: `3px solid ${color}` }}
              >
                <div className="text-[10px] text-foreground-muted">{m.label}</div>
                <div className="font-data text-lg font-bold" style={{ color }}>{m.value}</div>
                {m.sub && <div className="text-[10px] font-medium" style={{ color: m.sub.startsWith('-') ? '#EF4444' : '#22C55E' }}>{m.sub}</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // grid（默认）：3 列指标网格，label 小号灰 / value 大号粗（按 color 染色）/ sub 小号绿红。
  return (
    <div className="flex h-full w-full flex-col gap-1.5 rounded-xl border border-border-default bg-surface-primary p-3">
      {(title || subtitle) && (
        <div className="flex flex-none flex-col">
          {title && <div className="text-sm font-semibold text-foreground-primary">{title}</div>}
          {subtitle && <div className="text-[11px] text-foreground-secondary">{subtitle}</div>}
        </div>
      )}
      <div className="grid flex-1 grid-cols-3 gap-2">
        {metrics.map((m, i) => (
          <div key={i} className="flex flex-col justify-center">
            <div className="text-[10px] text-foreground-muted">{m.label}</div>
            <div
              className="font-data text-lg font-bold"
              style={{ color: m.color ?? 'var(--color-foreground-primary, #1A1A1A)' }}
            >
              {m.value}
            </div>
            {m.sub && (
              <div className="text-[10px] font-medium" style={{ color: m.sub.startsWith('-') ? '#EF4444' : '#22C55E' }}>
                {m.sub}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------- creator works table -------------------------- */
// ≈PRD CMP-B19。达人作品列表：list / cards / compact。
// 列顺序 [封面URL, 作品名, 播放, 点赞, 评论, 转发, 完播率]。

export function CreatorWorksTable({ data }: { data: CreatorWorksTableData }) {
  const { variant = 'list', title, subtitle, headers = [], rows = [] } = data;
  const items = rows.map((r) => ({
    cover: r[0] ?? '',
    name: r[1] ?? '',
    play: r[2] ?? '',
    like: r[3] ?? '',
    comment: r[4] ?? '',
    share: r[5] ?? '',
    completion: r[6] ?? '',
  }));

  if (variant === 'compact') {
    // 纯文本紧凑行，无图片。
    return (
      <div className="flex h-full w-full flex-col gap-1 rounded-xl border border-border-default bg-surface-primary p-3">
        {(title || subtitle) && (
          <div className="flex flex-none flex-col">
            {title && <div className="text-sm font-semibold text-foreground-primary">{title}</div>}
            {subtitle && <div className="text-[11px] text-foreground-secondary">{subtitle}</div>}
          </div>
        )}
        <div className="flex flex-1 flex-col overflow-auto">
          <div className="flex border-b border-border-default pb-1 text-[10px] font-medium text-foreground-muted">
            <span className="min-w-0 flex-1 truncate">{headers[1] ?? '作品'}</span>
            <span className="w-14 flex-none text-right">{headers[2] ?? '播放'}</span>
            <span className="w-14 flex-none text-right">{headers[3] ?? '点赞'}</span>
            <span className="w-14 flex-none text-right">{headers[6] ?? '完播'}</span>
          </div>
          {items.map((it, i) => (
            <div key={i} className="flex items-center border-b border-border-subtle py-1 last:border-b-0">
              <span className="min-w-0 flex-1 truncate text-xs text-foreground-primary">{it.name}</span>
              <span className="w-14 flex-none text-right font-data text-xs text-foreground-secondary">{it.play}</span>
              <span className="w-14 flex-none text-right font-data text-xs text-foreground-secondary">{it.like}</span>
              <span className="w-14 flex-none text-right font-data text-xs text-foreground-secondary">{it.completion}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'cards') {
    // 横向卡片网格：每张卡含封面 + 作品名 + 关键指标。
    return (
      <div className="flex h-full w-full flex-col gap-1.5 rounded-xl border border-border-default bg-surface-primary p-3">
        {(title || subtitle) && (
          <div className="flex flex-none flex-col">
            {title && <div className="text-sm font-semibold text-foreground-primary">{title}</div>}
            {subtitle && <div className="text-[11px] text-foreground-secondary">{subtitle}</div>}
          </div>
        )}
        <div className="grid flex-1 grid-cols-2 gap-2 overflow-auto">
          {items.map((it, i) => (
            <div key={i} className="flex flex-col gap-1 rounded-lg border border-border-subtle p-2">
              <ImgOrPlaceholder url={it.cover} label={it.name} cls="h-14 w-full" />
              <div className="line-clamp-1 text-xs font-medium text-foreground-primary">{it.name}</div>
              <div className="flex justify-between text-[10px] text-foreground-secondary">
                <span>{headers[2] ?? '播放'} {it.play}</span>
                <span>{headers[3] ?? '点赞'} {it.like}</span>
              </div>
              <div className="flex justify-between text-[10px] text-foreground-muted">
                <span>{it.comment} 评论</span>
                <span>{it.completion}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // list（默认）：表头 + 行，含封面缩略图，数字列右对齐。
  const numHeaders = headers.slice(2);
  return (
    <div className="flex h-full w-full flex-col gap-1 rounded-xl border border-border-default bg-surface-primary p-3">
      {(title || subtitle) && (
        <div className="flex flex-none flex-col">
          {title && <div className="text-sm font-semibold text-foreground-primary">{title}</div>}
          {subtitle && <div className="text-[11px] text-foreground-secondary">{subtitle}</div>}
        </div>
      )}
      <div className="flex flex-1 flex-col overflow-auto">
        <div className="flex items-center gap-2 border-b border-border-default pb-1.5">
          <span className="w-10 flex-none" />
          <span className="min-w-0 flex-1 text-[10px] font-medium uppercase tracking-wide text-foreground-muted">
            {headers[1] ?? '作品'}
          </span>
          {numHeaders.map((h, i) => (
            <span key={i} className="w-14 flex-none text-right text-[10px] font-medium uppercase tracking-wide text-foreground-muted">
              {h}
            </span>
          ))}
        </div>
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2 border-b border-border-subtle py-1.5 last:border-b-0">
            <ImgOrPlaceholder url={it.cover} label={it.name} cls="h-10 w-10 flex-none" />
            <div className="min-w-0 flex-1 truncate text-xs text-foreground-primary">{it.name}</div>
            <span className="w-14 flex-none text-right font-data text-xs font-semibold text-foreground-primary">{it.play}</span>
            <span className="w-14 flex-none text-right font-data text-xs text-foreground-secondary">{it.like}</span>
            <span className="w-14 flex-none text-right font-data text-xs text-foreground-secondary">{it.comment}</span>
            <span className="w-14 flex-none text-right font-data text-xs text-foreground-secondary">{it.share}</span>
            <span className="w-14 flex-none text-right font-data text-xs text-foreground-secondary">{it.completion}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
