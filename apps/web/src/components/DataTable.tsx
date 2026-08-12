import type { ReactNode } from 'react';

interface DataTableProps {
  loading: boolean;
  headers: string[];
  rows: ReactNode[][];
  /** 行点击回调(传入则行可点击 + cursor-pointer)。 */
  onRowClick?: (rowIndex: number) => void;
}

/** 通用数据表:loading/空态占位 + 首列强调 + 行 hover;可选行点击。 */
export function DataTable({ loading, headers, rows, onRowClick }: DataTableProps) {
  if (loading) {
    return <p className="rounded-lg border border-border-default bg-surface-primary px-4 py-6 text-sm text-foreground-muted">Loading…</p>;
  }
  if (rows.length === 0) {
    return <p className="rounded-lg border border-border-default bg-surface-primary px-4 py-6 text-sm text-foreground-muted">No data</p>;
  }
  return (
    <div className="overflow-auto rounded-lg border border-border-default">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="bg-surface-hover text-left text-xs text-foreground-muted">
            {headers.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              onClick={onRowClick ? () => onRowClick(ri) : undefined}
              className={`border-t border-border-subtle hover:bg-surface-hover/50 ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`px-3 py-2 ${
                    ci === 0
                      ? 'font-medium text-foreground-primary'
                      : 'whitespace-nowrap text-foreground-secondary'
                  }`}
                >
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
