/**
 * 内容分析报告组件（4 个）：
 * - DeviceBreakdownView     — 设备分布
 * - ContentTopicView        — 内容主题效果
 * - SearchTermTableView     — 搜索词效果表
 * - HourlyHeatmapView       — 24h 时段热力图
 */
import type {
  DeviceBreakdownData,
  ContentTopicPerformanceData,
  SearchTermTableData,
  HourlyHeatmapData,
} from '@mediakit/shared';

const STATUS_STYLES: Record<string, string> = {
  good: 'skin-dot-good',
  warn: 'skin-dot-warn',
  bad: 'skin-dot-bad',
};

/* ============================ Device Breakdown ============================ */

export function DeviceBreakdownView({ data }: { data: DeviceBreakdownData }) {
  const { title, items } = data;
  return (
    <div className="flex h-full w-full flex-col gap-1.5 skin-card skin-pad-sm">
      {title && <div className="flex-none text-sm font-semibold text-foreground-primary">{title}</div>}
      <div className="grid flex-1 grid-cols-3 gap-2">
        {items.map((d, i) => (
          <div key={i} className="flex flex-col items-center justify-center gap-1 rounded-lg bg-surface-hover p-2 text-center">
            <div className="text-[10px] uppercase tracking-wide text-foreground-muted">{d.device}</div>
            <div className="text-lg font-bold text-foreground-primary">{d.share}</div>
            <div className="text-[10px] text-foreground-secondary">{d.revenue}</div>
            <div className="text-[9px] text-foreground-muted">{d.sessions} sessions</div>
            <span className={`text-[9px] font-medium ${d.trend.startsWith('-') ? 'skin-text-negative' : 'skin-text-positive'}`}>{d.trend}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================ Content Topic Performance ============================ */

export function ContentTopicView({ data }: { data: ContentTopicPerformanceData }) {
  const { title, items } = data;
  return (
    <div className="flex h-full w-full flex-col gap-1.5 skin-card skin-pad-sm">
      {title && <div className="flex-none text-sm font-semibold text-foreground-primary">{title}</div>}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-left text-[11px]">
          <thead className="sticky top-0 bg-surface-primary">
            <tr className="border-b border-border-primary">
              <th className="py-1 pr-2 text-[9px] font-medium uppercase text-foreground-muted" />
              {['Topic', 'Posts', 'Impressions', 'Engagement', 'Revenue', 'ROAS'].map((h) => (
                <th key={h} className="py-1 pr-2 text-[9px] font-medium uppercase text-foreground-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="border-b border-border-primary/50">
                <td className="py-1 pr-2"><span className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_STYLES[it.status]}`} /></td>
                <td className="py-1 pr-2 font-medium text-foreground-primary">{it.topic}</td>
                <td className="py-1 pr-2 text-foreground-secondary">{it.posts}</td>
                <td className="py-1 pr-2 text-right text-foreground-secondary">{it.impressions}</td>
                <td className="py-1 pr-2 text-right text-foreground-secondary">{it.engagement}</td>
                <td className="py-1 pr-2 text-right font-semibold text-foreground-primary">{it.revenue}</td>
                <td className="py-1 pr-2 text-right text-foreground-secondary">{it.roas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================ Search Term Table ============================ */

export function SearchTermTableView({ data }: { data: SearchTermTableData }) {
  const { title, items } = data;
  return (
    <div className="flex h-full w-full flex-col gap-1.5 skin-card skin-pad-sm">
      {title && <div className="flex-none text-sm font-semibold text-foreground-primary">{title}</div>}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-left text-[11px]">
          <thead className="sticky top-0 bg-surface-primary">
            <tr className="border-b border-border-primary">
              <th className="py-1 pr-2 text-[9px] font-medium uppercase text-foreground-muted" />
              {['Keyword', 'Clicks', 'Conv.', 'CTR', 'Revenue'].map((h) => (
                <th key={h} className="py-1 pr-2 text-[9px] font-medium uppercase text-foreground-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="border-b border-border-primary/50">
                <td className="py-1 pr-2"><span className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_STYLES[it.status]}`} /></td>
                <td className="py-1 pr-2 font-medium text-foreground-primary">{it.term}</td>
                <td className="py-1 pr-2 text-right text-foreground-secondary">{it.clicks}</td>
                <td className="py-1 pr-2 text-right text-foreground-secondary">{it.conversions}</td>
                <td className="py-1 pr-2 text-right text-foreground-secondary">{it.ctr}</td>
                <td className="py-1 pr-2 text-right font-semibold text-foreground-primary">{it.revenue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================ Hourly Heatmap ============================ */

export function HourlyHeatmapView({ data }: { data: HourlyHeatmapData }) {
  const { title, subtitle, hours, metric = 'clicks' } = data;
  const values = hours.map((h) => h[metric]);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  /** 0-1 intensity → brand-color opacity */
  function intensity(v: number): number {
    return 0.1 + ((v - min) / range) * 0.9;
  }

  return (
    <div className="flex h-full w-full flex-col gap-2 skin-card skin-pad-sm">
      {(title || subtitle) && (
        <div className="flex flex-none flex-col">
          {title && <div className="text-sm font-semibold text-foreground-primary">{title}</div>}
          {subtitle && <div className="text-[11px] text-foreground-secondary">{subtitle}</div>}
        </div>
      )}
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="grid flex-1 content-center" style={{ gridTemplateColumns: 'repeat(24, 1fr)', gap: '2px' }}>
          {hours.map((h, i) => {
            const op = intensity(h[metric]);
            return (
              <div
                key={i}
                className="flex aspect-square items-center justify-center rounded-sm text-[7px] font-bold text-white"
                style={{
                  background: `color-mix(in srgb, var(--color-primary) ${(op * 100).toFixed(0)}%, var(--surface-hover))`,
                }}
                title={`${h.hour}:00 — ${metric}: ${h[metric].toLocaleString()}`}
              >
                {h[metric] > max * 0.6 ? h[metric] : ''}
              </div>
            );
          })}
        </div>
        <div className="flex flex-none items-center justify-between text-[8px] text-foreground-muted">
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>23:00</span>
        </div>
      </div>
    </div>
  );
}
