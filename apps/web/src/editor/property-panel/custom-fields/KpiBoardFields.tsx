import type { ComponentData, EditorComponent, KpiBoardData } from '@mediakit/shared';
import { useEditorStore } from '../../store';
import { FieldGroup, useDataUpdate } from '../helpers';

/**
 * kpi-board：指标行选择 + 文本编辑。
 * 每行提供 显示/隐藏 勾选框，以及 label/value/compare 三个文本输入；
 * 支持新增与删除行。隐藏的行不会在渲染层显示（见 ReportComponents KpiBoard 的 hiddenIndices 过滤）。
 */
export function KpiBoardFields({ comp }: { comp: EditorComponent }) {
  const update = useDataUpdate(comp);
  const data = comp.data as KpiBoardData;
  const rows = data.rows ?? [];
  const hidden = new Set(data.hiddenIndices ?? []);

  const setHidden = (next: number[]) => update('hiddenIndices', next.length ? next : undefined);
  const toggleHidden = (i: number) =>
    setHidden(hidden.has(i) ? [...hidden].filter((x) => x !== i) : [...hidden, i].sort((a, b) => a - b));

  const setRow = (i: number, col: number, value: string) => {
    const next = rows.map((r, idx) => (idx === i ? r.map((c, cidx) => (cidx === col ? value : c)) : r));
    update('rows', next);
  };

  const addRow = () => {
    const next = [...rows, ['', '', '']];
    update('rows', next);
  };

  const removeRow = (i: number) => {
    // 删除行后，把大于 i 的 hidden 索引整体下移，删掉等于 i 的。
    const nextHidden = [...hidden]
      .filter((x) => x !== i)
      .map((x) => (x > i ? x - 1 : x));
    const next = rows.filter((_, idx) => idx !== i);
    // 同步下移 icons/valueColors/trendDirections，保持对齐。
    const icons = data.icons ? data.icons.filter((_, idx) => idx !== i) : undefined;
    const valueColors = data.valueColors ? data.valueColors.filter((_, idx) => idx !== i) : undefined;
    const trendDirections = data.trendDirections ? data.trendDirections.filter((_, idx) => idx !== i) : undefined;
    useEditorStore.getState().updateComponent(comp.id, {
      data: {
        ...(comp.data as object),
        rows: next,
        hiddenIndices: nextHidden.length ? nextHidden : undefined,
        icons,
        valueColors,
        trendDirections,
      } as unknown as ComponentData,
    });
    useEditorStore.getState().commit();
  };

  return (
    <FieldGroup title="KPI 指标">
      <div className="space-y-2">
        {rows.map((r, i) => {
          const isHidden = hidden.has(i);
          return (
            <div
              key={i}
              className={`rounded border border-border-default p-1.5 ${isHidden ? 'opacity-50' : ''}`}
            >
              <div className="mb-1 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!isHidden}
                  onChange={() => toggleHidden(i)}
                  className="h-3 w-3"
                  title={isHidden ? '显示该指标' : '隐藏该指标'}
                />
                <span className="text-[11px] text-foreground-muted">指标 {i + 1}</span>
                <button
                  onClick={() => removeRow(i)}
                  className="ml-auto text-[10px] text-foreground-muted hover:text-foreground-danger"
                >
                  删除
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <input
                  value={r[0] ?? ''}
                  placeholder="指标"
                  onChange={(e) => setRow(i, 0, e.target.value)}
                  className="rounded border border-border-default bg-surface-primary px-1 py-0.5 text-[11px] text-foreground-primary outline-none focus:border-foreground-primary"
                />
                <input
                  value={r[1] ?? ''}
                  placeholder="数值"
                  onChange={(e) => setRow(i, 1, e.target.value)}
                  className="rounded border border-border-default bg-surface-primary px-1 py-0.5 text-[11px] text-foreground-primary outline-none focus:border-foreground-primary"
                />
                <input
                  value={r[2] ?? ''}
                  placeholder="对比"
                  onChange={(e) => setRow(i, 2, e.target.value)}
                  className="rounded border border-border-default bg-surface-primary px-1 py-0.5 text-[11px] text-foreground-primary outline-none focus:border-foreground-primary"
                />
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <p className="text-[11px] text-foreground-muted">暂无指标，点击下方添加。</p>}
      </div>
      <button
        onClick={addRow}
        className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
      >
        + 添加指标
      </button>
    </FieldGroup>
  );
}
