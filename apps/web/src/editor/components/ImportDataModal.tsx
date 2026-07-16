import { useEffect, useMemo, useState } from 'react';
import type { BarChartData, LineChartData, PieChartData } from '@mediakit/shared';
import { parseFile, type ParsedSheet } from '../datasource/parse';
import {
  buildChartData,
  countNonNumeric,
  type ChartData,
  type ChartType,
} from '../datasource/resolve';
import { BarChartComponent, LineChartComponent, PieChartComponent } from './BasicComponents';

interface Props {
  file: File;
  chartType: ChartType;
  prevTitle?: string;
  onConfirm: (data: ChartData) => void;
  onCancel: () => void;
}

export function ImportDataModal({ file, chartType, prevTitle, onConfirm, onCancel }: Props) {
  const [sheets, setSheets] = useState<ParsedSheet[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [labelColumn, setLabelColumn] = useState('');
  const [valueColumns, setValueColumns] = useState<string[]>([]);

  const isLine = chartType === 'line-chart';

  useEffect(() => {
    let alive = true;
    setError(null);
    setSheets(null);
    parseFile(file)
      .then((parsed) => {
        if (!alive) return;
        if (parsed.length === 0 || parsed.every((s) => s.columns.length === 0)) {
          setError('文件无有效表头，请检查内容');
          return;
        }
        setSheets(parsed);
        setSheetIndex(0);
        const first = parsed[0];
        const label = first.columns[0] ?? '';
        const values = isLine
          ? first.columns.slice(1)
          : [first.columns[1] ?? first.columns[0] ?? ''].filter(Boolean);
        setLabelColumn(label);
        setValueColumns(values);
      })
      .catch(() => alive && setError('解析失败，请检查文件格式'));
    return () => {
      alive = false;
    };
  }, [file, isLine]);

  const sheet = sheets?.[sheetIndex] ?? null;
  const columns = sheet?.columns ?? [];

  const preview = useMemo<ChartData | null>(() => {
    if (!sheet || !labelColumn || valueColumns.length === 0) return null;
    return buildChartData(chartType, sheet, { labelColumn, valueColumns }, prevTitle);
  }, [sheet, chartType, labelColumn, valueColumns, prevTitle]);

  const nonNumeric = sheet ? countNonNumeric(sheet, valueColumns.filter(Boolean)) : 0;
  const tooManyBars = chartType === 'bar-chart' && (sheet?.rows.length ?? 0) > 20;

  function toggleValueColumn(col: string) {
    setValueColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        className="flex max-h-[90vh] w-[640px] flex-col gap-3 overflow-auto rounded-xl bg-surface-primary p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-headings text-sm font-semibold text-foreground-primary">
          导入数据 · {file.name}
        </div>

        {error && <p className="text-xs text-red">{error}</p>}

        {!sheets && !error && (
          <p className="text-xs text-foreground-muted">解析中…</p>
        )}

        {sheet && (
          <>
            {sheets && sheets.length > 1 && (
              <label className="block text-xs text-foreground-secondary">
                <span className="mb-1 block">工作表</span>
                <select
                  value={sheetIndex}
                  onChange={(e) => setSheetIndex(Number(e.target.value))}
                  className="w-full rounded border border-border-default bg-surface-primary px-2 py-1"
                >
                  {sheets.map((s, i) => (
                    <option key={i} value={i}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs text-foreground-secondary">
                <span className="mb-1 block">标签列</span>
                <select
                  value={labelColumn}
                  onChange={(e) => setLabelColumn(e.target.value)}
                  className="w-full rounded border border-border-default bg-surface-primary px-2 py-1"
                >
                  {columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              {isLine ? (
                <div className="text-xs text-foreground-secondary">
                  <span className="mb-1 block">数值列（可多选）</span>
                  <div className="flex max-h-32 flex-wrap gap-2 overflow-auto rounded border border-border-default p-1">
                    {columns.map((c) => (
                      <label key={c} className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={valueColumns.includes(c)}
                          onChange={() => toggleValueColumn(c)}
                        />
                        <span>{c}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <label className="block text-xs text-foreground-secondary">
                  <span className="mb-1 block">数值列</span>
                  <select
                    value={valueColumns[0] ?? ''}
                    onChange={(e) => setValueColumns(e.target.value ? [e.target.value] : [])}
                    className="w-full rounded border border-border-default bg-surface-primary px-2 py-1"
                  >
                    {columns.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {nonNumeric > 0 && (
              <p className="text-xs skin-text-warning">{nonNumeric} 个单元格非数值，已按 0 计算</p>
            )}
            {tooManyBars && (
              <p className="text-xs text-foreground-muted">数据超过 20 行，柱状图将只取前 20 行。</p>
            )}

            <div className="rounded border border-border-default p-2">
              <div className="mb-1 text-xs text-foreground-muted">预览</div>
              <div className="h-48">
                {preview ? (
                  <PreviewChart type={chartType} data={preview} />
                ) : (
                  <p className="text-xs text-foreground-muted">请选择标签列与数值列</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={onCancel}
                className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
              >
                取消
              </button>
              <button
                disabled={!preview}
                onClick={() => preview && onConfirm(preview)}
                className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary disabled:opacity-50"
              >
                确认导入
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PreviewChart({ type, data }: { type: ChartType; data: ChartData }) {
  if (type === 'bar-chart') return <BarChartComponent data={data as BarChartData} />;
  if (type === 'line-chart') return <LineChartComponent data={data as LineChartData} />;
  return <PieChartComponent data={data as PieChartData} />;
}
