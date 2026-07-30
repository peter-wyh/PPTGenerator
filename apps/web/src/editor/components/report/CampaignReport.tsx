/**
 * Campaign 报告核心组件（5 个）：
 * - CampaignSummaryBoard  — 总览看板
 * - FunnelChartView       — 转化漏斗
 * - RevenueTimelineChart  — 收入趋势线图
 * - PublisherTable        — Publisher 效果宽表
 * - GeoDistribution       — GEO 国家收入分布
 */
import type {
  CampaignSummaryData,
  FunnelChartData,
  RevenueTimelineData,
  PublisherTableData,
  GeoDistributionData,
} from '@mediakit/shared';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useChartColors, STATUS_DOT_STYLES } from './shared';

/* ============================ Campaign Summary ============================ */

export function CampaignSummaryBoard({ data }: { data: CampaignSummaryData }) {
  const { title, campaignName, period, metrics = [], customerSplit } = data;
  return (
    <div className="flex h-full w-full flex-col gap-2 skin-card skin-pad-md">
      {(title || campaignName) && (
        <div className="flex flex-none items-baseline justify-between">
          <div>
            {title && <div className="text-[10px] uppercase tracking-wide text-foreground-muted">{title}</div>}
            <div className="text-sm font-bold text-foreground-primary">{campaignName}</div>
          </div>
          {period && <div className="text-[11px] text-foreground-secondary">{period}</div>}
        </div>
      )}
      <div className="grid flex-1 grid-cols-4 gap-2">
        {metrics.map((m, i) => {
          const isPositive = m.compare?.startsWith('+');
          const isNegative = m.compare?.startsWith('-');
          return (
            <div key={i} className="flex flex-col justify-center rounded-lg bg-surface-hover p-2">
              <div className="text-[10px] text-foreground-muted">{m.label}</div>
              <div className="text-base font-bold text-foreground-primary">{m.value}</div>
              {m.compare && (
                <div className={`text-[10px] font-medium ${isNegative ? 'skin-text-negative' : isPositive ? 'skin-text-positive' : 'text-foreground-muted'}`}>
                  {m.compare}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {customerSplit && (
        <div className="flex flex-none items-center gap-2 rounded-lg bg-primary/5 p-2">
          <span className="text-[11px] font-medium text-primary">New {customerSplit.newCustomerRate}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-hover">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: customerSplit.newCustomerRate }}
            />
          </div>
          <span className="text-[10px] text-foreground-muted">
            {customerSplit.newCustomers} new / {customerSplit.returningCustomers} returning
          </span>
        </div>
      )}
    </div>
  );
}

/* ============================ Funnel Chart ============================ */

export function FunnelChartView({ data }: { data: FunnelChartData }) {
  const { title, subtitle, steps = [], insight } = data;
  const max = Math.max(...steps.map((s) => s.value), 1);

  return (
    <div className="flex h-full w-full flex-col gap-2 skin-card skin-pad-sm">
      {(title || subtitle) && (
        <div className="flex flex-none flex-col">
          {title && <div className="text-sm font-semibold text-foreground-primary">{title}</div>}
          {subtitle && <div className="text-[11px] text-foreground-secondary">{subtitle}</div>}
        </div>
      )}
      <div className="flex flex-1 flex-col justify-center gap-1.5">
        {steps.map((s, i) => {
          const widthPct = (s.value / max) * 100;
          const nextVal = steps[i + 1]?.value;
          return (
            <div key={i} className="flex items-center gap-2">
              <div className="flex-1">
                <div
                  className="flex items-center justify-center rounded-md py-1.5 text-[11px] font-semibold text-white"
                  style={{
                    width: `${Math.max(widthPct, 15)}%`,
                    margin: '0 auto',
                    background: `color-mix(in srgb, var(--color-primary) ${100 - i * 12}%, var(--color-secondary))`,
                  }}
                >
                  {s.label} · {s.value.toLocaleString()}
                </div>
              </div>
              <div className="flex w-16 flex-none flex-col items-end">
                {s.rate && <span className="text-[10px] font-medium text-foreground-secondary">{s.rate}</span>}
                {nextVal !== undefined && (
                  <span className="text-[9px] text-foreground-muted">
                    ↓{(((nextVal / s.value) * 100) || 0).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {insight && (
        <div className="flex-none rounded-lg bg-primary/5 p-2">
          <div className="mb-0.5 text-[10px] font-semibold text-primary">Insight</div>
          <div className="text-[11px] text-foreground-secondary">{insight}</div>
        </div>
      )}
    </div>
  );
}

/* ============================ Revenue Timeline ============================ */

export function RevenueTimelineChart({ data }: { data: RevenueTimelineData }) {
  const { title, subtitle, points = [], series = ['revenue', 'spend'] } = data;
  const colors = useChartColors();
  const seriesConfig: Record<string, { color: string; label: string }> = {
    revenue: { color: colors[0] ?? 'var(--color-primary)', label: 'Revenue' },
    spend: { color: colors[1] ?? 'var(--color-secondary)', label: 'Spend' },
    commission: { color: colors[2] ?? 'var(--foreground-muted)', label: 'Commission' },
    orders: { color: colors[3] ?? 'var(--foreground-secondary)', label: 'Orders' },
  };

  return (
    <div className="flex h-full w-full flex-col gap-2 skin-card skin-pad-sm">
      {(title || subtitle) && (
        <div className="flex flex-none flex-col">
          {title && <div className="text-sm font-semibold text-foreground-primary">{title}</div>}
          {subtitle && <div className="text-[11px] text-foreground-secondary">{subtitle}</div>}
        </div>
      )}
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" opacity={0.3} />
            <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="var(--foreground-muted)" />
            <YAxis tick={{ fontSize: 9 }} stroke="var(--foreground-muted)" />
            <Tooltip
              contentStyle={{
                fontSize: '11px',
                background: 'var(--surface-primary)',
                border: '1px solid var(--border-primary)',
                borderRadius: '8px',
              }}
            />
            {series.includes('revenue') && (
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke={seriesConfig.revenue.color} fill={seriesConfig.revenue.color} fillOpacity={0.15} strokeWidth={2} />
            )}
            {series.includes('spend') && (
              <Line type="monotone" dataKey="spend" name="Spend" stroke={seriesConfig.spend.color} strokeWidth={1.5} dot={false} />
            )}
            {series.includes('commission') && (
              <Line type="monotone" dataKey="commission" name="Commission" stroke={seriesConfig.commission.color} strokeWidth={1.5} dot={false} />
            )}
            {series.includes('orders') && (
              <Line type="monotone" dataKey="orders" name="Orders" stroke={seriesConfig.orders.color} strokeWidth={1.5} dot={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ============================ Publisher Table ============================ */

export function PublisherTable({ data }: { data: PublisherTableData }) {
  const { title, columns, rows = [] } = data;
  const cols = columns ?? [
    { key: 'publisher', label: 'Publisher' },
    { key: 'clicks', label: 'Clicks' },
    { key: 'ctr', label: 'CTR' },
    { key: 'conversions', label: 'Conv.' },
    { key: 'revenue', label: 'Revenue' },
    { key: 'roas', label: 'ROAS' },
  ];

  return (
    <div className="flex h-full w-full flex-col gap-1.5 skin-card skin-pad-sm">
      {title && <div className="flex-none text-sm font-semibold text-foreground-primary">{title}</div>}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-left text-[11px]">
          <thead className="sticky top-0 bg-surface-primary">
            <tr className="border-b border-border-primary">
              <th className="py-1 pr-2 text-[9px] font-medium uppercase text-foreground-muted">Status</th>
              {cols.map((c) => (
                <th key={c.key} className="py-1 pr-2 text-[9px] font-medium uppercase text-foreground-muted">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-border-primary/50">
                <td className="py-1 pr-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT_STYLES[r.status]}`} />
                </td>
                {cols.map((c) => (
                  <td key={c.key} className={`py-1 pr-2 ${c.key === 'publisher' ? 'font-medium text-foreground-primary' : 'text-foreground-secondary'}`}>
                    {(r as Record<string, string>)[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================ Geo Distribution ============================ */

export function GeoDistribution({ data }: { data: GeoDistributionData }) {
  const { title, subtitle, items = [], variant = 'bars' } = data;
  const max = Math.max(...items.map((d) => d.value), 1);

  if (variant === 'list') {
    return (
      <div className="flex h-full w-full flex-col gap-1.5 skin-card skin-pad-sm">
        {(title || subtitle) && (
          <div className="flex flex-none flex-col">
            {title && <div className="text-sm font-semibold text-foreground-primary">{title}</div>}
            {subtitle && <div className="text-[11px] text-foreground-secondary">{subtitle}</div>}
          </div>
        )}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-[11px]">
            <tbody>
              {items.map((d, i) => (
                <tr key={i} className="border-b border-border-primary/40">
                  <td className="py-1 font-medium text-foreground-primary">{d.name}</td>
                  <td className="py-1 text-right text-foreground-secondary">{d.display}</td>
                  <td className="py-1 pl-2 text-right text-[10px] text-foreground-muted">{d.share}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-1.5 skin-card skin-pad-sm">
      {(title || subtitle) && (
        <div className="flex flex-none flex-col">
          {title && <div className="text-sm font-semibold text-foreground-primary">{title}</div>}
          {subtitle && <div className="text-[11px] text-foreground-secondary">{subtitle}</div>}
        </div>
      )}
      <div className="flex flex-1 flex-col justify-center gap-1.5">
        {items.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-16 flex-none text-[10px] font-medium text-foreground-secondary">{d.name}</span>
            <div className="h-3 flex-1 overflow-hidden rounded-sm bg-surface-hover">
              <div
                className="flex h-full items-center justify-end rounded-sm px-1 text-[8px] font-bold text-white"
                style={{
                  width: `${Math.max((d.value / max) * 100, 8)}%`,
                  background: `color-mix(in srgb, var(--color-primary) ${100 - i * 8}%, var(--color-secondary))`,
                }}
              >
                {d.share}
              </div>
            </div>
            <span className="w-14 flex-none text-right text-[10px] text-foreground-muted">{d.display}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
