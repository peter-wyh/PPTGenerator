/**
 * 投放位报告组件（2 个）：
 * - PlacementWideTableView — 投放位宽表（9 列）
 * - PlacementTypeSummaryView — 投放位类型汇总（带迷你趋势线）
 */
import type { PlacementWideTableData, PlacementTypeSummaryData } from '@mediakit/shared';
import { Line, LineChart, ResponsiveContainer } from 'recharts';
import { STATUS_DOT_STYLES } from './shared';

/* ============================ Placement Wide Table ============================ */

export function PlacementWideTableView({ data }: { data: PlacementWideTableData }) {
  const { title, rows = [] } = data;
  return (
    <div className="flex h-full w-full flex-col gap-1.5 skin-card skin-pad-sm">
      {title && <div className="flex-none text-sm font-semibold text-foreground-primary">{title}</div>}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-left text-[10px]">
          <thead className="sticky top-0 bg-surface-primary">
            <tr className="border-b border-border-primary">
              <th className="py-1 pr-2 text-[8px] font-medium uppercase text-foreground-muted" />
              {['Placement', 'Publisher', 'Clicks', 'CTR', 'Conv.', 'CVR', 'Revenue', 'EPC'].map((h) => (
                <th key={h} className="py-1 pr-2 text-[8px] font-medium uppercase text-foreground-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-border-primary/50">
                <td className="py-1 pr-2">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT_STYLES[r.status]}`} />
                </td>
                <td className="py-1 pr-2 font-medium text-foreground-primary">{r.placement}</td>
                <td className="py-1 pr-2 text-foreground-secondary">{r.publisher}</td>
                <td className="py-1 pr-2 text-right text-foreground-secondary">{r.clicks}</td>
                <td className="py-1 pr-2 text-right text-foreground-secondary">{r.ctr}</td>
                <td className="py-1 pr-2 text-right text-foreground-secondary">{r.conversions}</td>
                <td className="py-1 pr-2 text-right text-foreground-secondary">{r.cvr}</td>
                <td className="py-1 pr-2 text-right font-semibold text-foreground-primary">{r.revenue}</td>
                <td className="py-1 pr-2 text-right text-foreground-secondary">{r.epc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================ Placement Type Summary ============================ */

export function PlacementTypeSummaryView({ data }: { data: PlacementTypeSummaryData }) {
  const { title, subtitle, items = [] } = data;

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
          <thead className="sticky top-0 bg-surface-primary">
            <tr className="border-b border-border-primary">
              <th className="py-1 pr-2 text-[9px] font-medium uppercase text-foreground-muted">Type</th>
              <th className="py-1 pr-2 text-[9px] font-medium uppercase text-foreground-muted">Revenue</th>
              <th className="py-1 pr-2 text-[9px] font-medium uppercase text-foreground-muted">Share</th>
              <th className="py-1 pr-2 text-[9px] font-medium uppercase text-foreground-muted">ROAS</th>
              <th className="py-1 pr-2 text-[9px] font-medium uppercase text-foreground-muted">Trend</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="border-b border-border-primary/50">
                <td className="py-1 pr-2 font-medium text-foreground-primary">{it.type}</td>
                <td className="py-1 pr-2 font-semibold text-foreground-primary">{it.revenue}</td>
                <td className="py-1 pr-2 text-foreground-secondary">{it.revenueShare}</td>
                <td className="py-1 pr-2 text-foreground-secondary">{it.roas}</td>
                <td className="py-1 pr-2">
                  {it.trend && it.trend.length > 1 ? (
                    <div className="h-5 w-14">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={it.trend}>
                          <Line dataKey="value" stroke="var(--color-primary)" strokeWidth={1.2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <span className="text-[9px] text-foreground-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
