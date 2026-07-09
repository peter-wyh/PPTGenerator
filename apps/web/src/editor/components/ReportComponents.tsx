/**
 * 业务组件（试点：Campaign 报告域）渲染器。
 *
 * 周报/月报/结案核心页的两个可复用锚点：
 *  - KpiBoard 业绩看板（≈PRD CMP-B1）：KPI 矩阵
 *  - TimelineCompare 周期对比表（≈PRD CMP-B13）：本期 vs 上期 + 状态
 * 复用 TableData 形状（headers+rows），table 字段兼作对象列表编辑器。
 */
import type {
  KpiBoardData,
  MetaStripData,
  PlacementData,
  PostListData,
  ProductPerformanceData,
  StrategyBlockData,
  TimelineCompareData,
} from '@mediakit/shared';
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { findIcon } from '../icons/catalog';
import { renderHtmlWithHighlights } from '../richText';
import { KPI_COLOR_TOKENS } from '../kpiTokens';

/* -------------------------------- kpi board ------------------------------- */

/** 对比文本按首字符上色：+ 绿 / - 红 / 其他灰。 */
function compareColor(compare: string): string {
  if (!compare) return 'transparent';
  return compare.trim().startsWith('-') ? '#EF4444' : '#22C55E';
}

export function KpiBoard({ data }: { data: KpiBoardData }) {
  const { variant = 'grid', rows = [] } = data;
  const items = rows.map((r, i) => {
    const token = data.valueColors?.[i] ?? null;
    const color = token && token !== 'primary' ? KPI_COLOR_TOKENS[token].fg : undefined;
    return { label: r[0] ?? '', value: r[1] ?? '', compare: r[2] ?? '', color };
  });

  const Card = ({
    label, value, compare, color,
  }: { label: string; value: string; compare: string; color?: string }) => (
    <div className="flex flex-col justify-center">
      <div className="text-[11px] text-foreground-secondary">{label}</div>
      <div
        className="font-data text-xl font-bold text-foreground-primary"
        style={color ? { color } : undefined}
      >
        {value}
      </div>
      {compare && (
        <div className="text-[11px] font-medium" style={{ color: compareColor(compare) }}>
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
              <span className="text-[10px]" style={{ color: compareColor(it.compare) }}>
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
                <div className="text-[11px] font-medium" style={{ color: compareColor(it.compare) }}>
                  {it.compare}
                </div>
              )}
            </div>
          );
        })}
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
                  <div className="text-xs font-medium" style={{ color: compareColor(it.compare) }}>
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

  // grid（默认 3 列）
  return (
    <div className="grid h-full w-full grid-cols-3 gap-2 overflow-auto">
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
              {Icon && <Icon size={16} className="text-accent-secondary" />}
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
              {Icon && <Icon size={16} className="text-accent-secondary" />}
              <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
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

/** bulleted（参考#5）：卡片 + 首行作小标题（图标+标题、下方分隔）+ 其余行 • 项目符号列表。 */
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
        {HeaderIcon && <HeaderIcon size={16} className="text-accent-secondary" />}
        <span className="text-xs font-semibold uppercase tracking-wide text-foreground-primary">
          {hTitle}
        </span>
      </div>
      {bodyRows.length > 0 && (
        <div className="mt-3 border-t border-border-subtle pt-3">
          {bodyRows.map((r, i) => {
            const content = r[2] || r[1] || '';
            return (
              <div key={i} className="flex gap-2 py-0.5 text-sm text-foreground-secondary">
                <span className="flex-none text-accent-secondary">•</span>
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
              <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="var(--color-accent-primary, #FF5C00)">
                <LabelList dataKey="sold" position="right" style={{ fontSize: 11 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {insight && (
          <div className="flex w-[220px] flex-none flex-col justify-center rounded-lg bg-accent-primary/5 p-3">
            <div className="mb-1 text-[11px] font-semibold text-accent-primary">Insight</div>
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
        <div className="flex w-[260px] flex-none flex-col justify-center rounded-lg bg-accent-primary/5 p-3">
          <div className="mb-1 text-[11px] font-semibold text-accent-primary">Insight</div>
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
          <div className="mt-1 font-data text-lg font-bold text-accent-primary">{it.metric}</div>
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
              <div className="text-[11px] font-semibold text-accent-primary">Highlights</div>
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
