/**
 * TimelineCompare — 周期对比表（≈PRD CMP-B13）：本期 vs 上期 + 状态。
 */
import type { TimelineCompareData } from '@mediakit/shared';

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
            <div key={ri} className="flex flex-col gap-2 skin-card skin-pad-sm">
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
      <div className="flex h-full w-full flex-col gap-1 overflow-auto skin-card skin-pad-sm">
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
    <div className="h-full w-full overflow-auto skin-card">
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
