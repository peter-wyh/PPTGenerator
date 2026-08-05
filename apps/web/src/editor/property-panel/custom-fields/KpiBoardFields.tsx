import { useState } from 'react';
import type {
  ComponentData,
  EditorComponent,
  IconWeight,
  KpiBoardData,
  KpiColorToken,
  KpiTrendDirection,
} from '@mediakit/shared';
import { useEditorStore } from '../../store';
import { IconPickerOverlay } from '../../icons/IconPickerOverlay';
import { findIcon } from '../../icons/catalog';
import { KPI_COLOR_OPTIONS, KPI_COLOR_TOKENS } from '../../kpiTokens';
import { FieldGroup, useDataUpdate } from '../helpers';

/**
 * kpi-board: unified table editor — integrates label/value/compare text inputs
 * with per-row styling (icon, value color, trend direction) in a single table.
 *
 * Previously this was split across two separate FieldGroups:
 *   - KpiBoardFields (label/value/compare text)
 *   - KpiRowStyleField (icon + color + trend)
 * Merged to reduce panel clutter and keep all KPI row info in one place.
 *
 * Color options are labeled with clear semantic names (not just "white/black"):
 *   - 黑 = 强调色（默认深色文字）
 *   - 白 = 高亮色（深色/渐变背景上使用）
 *   - 品牌 = 品牌主色
 */
export function KpiBoardFields({ comp }: { comp: EditorComponent }) {
  const update = useDataUpdate(comp);
  const data = comp.data as KpiBoardData;
  const rows = data.rows ?? [];
  const icons = data.icons ?? [];
  const valueColors = data.valueColors ?? [];
  const directions = data.trendDirections ?? [];
  const hidden = new Set(data.hiddenIndices ?? []);
  const [pickingRow, setPickingRow] = useState<number | null>(null);

  // --- row text helpers ---
  const setHidden = (next: number[]) => update('hiddenIndices', next.length ? next : undefined);
  const toggleHidden = (i: number) =>
    setHidden(hidden.has(i) ? [...hidden].filter((x) => x !== i) : [...hidden, i].sort((a, b) => a - b));

  const setRow = (i: number, col: number, value: string) => {
    const next = rows.map((r, idx) => (idx === i ? r.map((c, cidx) => (cidx === col ? value : c)) : r));
    update('rows', next);
  };

  // --- row style helpers (ensureLen keeps parallel arrays aligned) ---
  function ensureLen<T>(arr: T[]): T[] {
    const next = [...arr];
    while (next.length < rows.length) next.push(null as unknown as T);
    return next;
  }
  function setIcon(i: number, key: string | null) {
    update('icons', withAt(ensureLen(icons), i, key));
  }
  function setColor(i: number, token: KpiColorToken | null) {
    update('valueColors', withAt(ensureLen(valueColors), i, token));
  }
  function setDirection(i: number, d: KpiTrendDirection | null) {
    update('trendDirections', withAt(ensureLen(directions), i, d));
  }

  const addRow = () => {
    update('rows', [...rows, ['', '', '']]);
  };

  const removeRow = (i: number) => {
    // 删除行后，把大于 i 的 hidden 索引整体下移，删掉等于 i 的。
    const nextHidden = [...hidden]
      .filter((x) => x !== i)
      .map((x) => (x > i ? x - 1 : x));
    const next = rows.filter((_, idx) => idx !== i);
    // 同步下移 icons/valueColors/trendDirections，保持对齐。
    const nextIcons = data.icons ? data.icons.filter((_, idx) => idx !== i) : undefined;
    const nextValueColors = data.valueColors ? data.valueColors.filter((_, idx) => idx !== i) : undefined;
    const nextTrendDirections = data.trendDirections ? data.trendDirections.filter((_, idx) => idx !== i) : undefined;
    useEditorStore.getState().updateComponent(comp.id, {
      data: {
        ...(comp.data as object),
        rows: next,
        hiddenIndices: nextHidden.length ? nextHidden : undefined,
        icons: nextIcons,
        valueColors: nextValueColors,
        trendDirections: nextTrendDirections,
      } as unknown as ComponentData,
    });
    useEditorStore.getState().commit();
  };

  return (
    <FieldGroup title="KPI 指标">
      <div className="space-y-2">
        {rows.map((r, i) => {
          const isHidden = hidden.has(i);
          const iconKey = icons[i] ?? null;
          const Icon = findIcon(iconKey ?? undefined)?.Comp;
          const color = valueColors[i] ?? null;
          const direction: KpiTrendDirection = directions[i] ?? 'positive';
          return (
            <div
              key={i}
              className={`rounded border border-border-default p-1.5 ${isHidden ? 'opacity-50' : ''}`}
            >
              {/* Row header: visibility toggle + label + delete */}
              <div className="mb-1 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!isHidden}
                  onChange={() => toggleHidden(i)}
                  className="h-3 w-3"
                  title={isHidden ? '显示该指标' : '隐藏该指标'}
                />
                <span className="truncate text-[11px] text-foreground-secondary">{r[0] || `指标 ${i + 1}`}</span>
                <button
                  onClick={() => removeRow(i)}
                  className="ml-auto text-[10px] text-foreground-muted hover:text-foreground-danger"
                >
                  删除
                </button>
              </div>

              {/* Text inputs: label / value / compare */}
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

              {/* Style row: icon picker + color + trend direction — merged from KpiRowStyleField */}
              <div className="mt-1 flex items-center gap-2 border-t border-border-subtle pt-1">
                <span className="text-[10px] text-foreground-muted">样式</span>
                <button
                  onClick={() => setPickingRow(i)}
                  title={iconKey ? (findIcon(iconKey)?.label ?? '选图标') : '选图标'}
                  className="flex h-6 w-6 items-center justify-center rounded border border-border-default hover:bg-surface-hover"
                >
                  {Icon ? <Icon size={14} /> : <span className="text-[9px] text-foreground-muted">+</span>}
                </button>
                {iconKey && (
                  <button
                    onClick={() => setIcon(i, null)}
                    className="text-[10px] text-foreground-muted hover:text-foreground-primary"
                  >
                    清除
                  </button>
                )}

                {/* Color picker — labeled with semantic tooltips */}
                <div className="flex items-center gap-1">
                  {KPI_COLOR_OPTIONS.map((opt) => (
                    <button
                      key={opt.token}
                      title={opt.desc}
                      onClick={() => setColor(i, color === opt.token ? null : opt.token)}
                      className={`h-4 w-4 rounded-full border ${color === opt.token ? 'border-foreground-primary ring-1 ring-foreground-primary/30' : 'border-border-default'}`}
                      style={{ backgroundColor: KPI_COLOR_TOKENS[opt.token].fg }}
                    />
                  ))}
                </div>

                {/* Trend direction toggle */}
                <button
                  title={
                    direction === 'inverse'
                      ? '逆向指标：下降为好（CPA/CPC 等）— 点击切回正向'
                      : '正向指标：上升为好 — 点击切为逆向'
                  }
                  onClick={() => setDirection(i, direction === 'inverse' ? null : 'inverse')}
                  className={`ml-auto rounded border px-1.5 text-[10px] font-medium ${
                    direction === 'inverse'
                      ? 'border-[var(--green)] text-[var(--green)]'
                      : 'border-border-default text-foreground-muted'
                  }`}
                >
                  {direction === 'inverse' ? '降好' : '升好'}
                </button>
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

      {pickingRow !== null && (
        <IconPickerOverlay
          value={icons[pickingRow] ?? undefined}
          weight={(data.iconWeight ?? 'regular') as IconWeight}
          onPick={(key) => {
            setIcon(pickingRow, key);
            setPickingRow(null);
          }}
          onClear={() => {
            setIcon(pickingRow, null);
            setPickingRow(null);
          }}
          onClose={() => setPickingRow(null)}
        />
      )}
    </FieldGroup>
  );
}

/** 不可变写入：返回新数组，index i 置为 v。 */
function withAt<T>(arr: T[], i: number, v: T): T[] {
  const next = [...arr];
  next[i] = v;
  return next;
}
