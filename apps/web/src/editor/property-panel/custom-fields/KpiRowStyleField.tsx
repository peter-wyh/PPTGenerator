import { useState } from 'react';
import type { EditorComponent, IconWeight, KpiBoardData, KpiColorToken, KpiTrendDirection } from '@mediakit/shared';
import { IconPickerOverlay } from '../../icons/IconPickerOverlay';
import { findIcon } from '../../icons/catalog';
import { KPI_COLOR_OPTIONS, KPI_COLOR_TOKENS } from '../../kpiTokens';
import { FieldGroup, useDataUpdate } from '../helpers';

/** kpi-board：每行配图标 + 数值主题色（写 data.icons / data.valueColors）。 */
export function KpiRowStyleField({ comp }: { comp: EditorComponent }) {
  const update = useDataUpdate(comp);
  const data = comp.data as KpiBoardData;
  const rows = data.rows ?? [];
  const icons = data.icons ?? [];
  const valueColors = data.valueColors ?? [];
  const weight: IconWeight = data.iconWeight ?? 'regular';
  const [pickingRow, setPickingRow] = useState<number | null>(null);

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
  const directions = data.trendDirections ?? [];
  function setDirection(i: number, d: KpiTrendDirection | null) {
    update('trendDirections', withAt(ensureLen(directions), i, d));
  }

  return (
    <FieldGroup title="卡片样式（每行）">
      <div className="text-[11px] text-foreground-muted">图标仅在「卡片」变体下显示。</div>
      {rows.map((r, i) => {
        const iconKey = icons[i] ?? null;
        const Icon = findIcon(iconKey ?? undefined)?.Comp;
        const color = valueColors[i] ?? null;
        const direction: KpiTrendDirection = directions[i] ?? 'positive';
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="w-20 truncate text-[11px] text-foreground-secondary">{r[0] ?? `行${i + 1}`}</span>
            <button
              onClick={() => setPickingRow(i)}
              title={iconKey ? (findIcon(iconKey)?.label ?? '选图标') : '选图标'}
              className="flex h-7 w-7 items-center justify-center rounded border border-border-default hover:bg-surface-hover"
            >
              {Icon ? <Icon size={16} /> : <span className="text-[10px] text-foreground-muted">+</span>}
            </button>
            {iconKey && (
              <button
                onClick={() => setIcon(i, null)}
                className="text-[10px] text-foreground-muted hover:text-foreground-primary"
              >
                清除
              </button>
            )}
            <div className="ml-auto flex gap-1">
              {KPI_COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.token}
                  title={opt.label}
                  onClick={() => setColor(i, color === opt.token ? null : opt.token)}
                  className={`h-4 w-4 rounded-full border ${
                    color === opt.token ? 'border-foreground-primary' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: KPI_COLOR_TOKENS[opt.token].fg }}
                />
              ))}
            </div>
            <button
              title={
                direction === 'inverse'
                  ? '逆向指标：下降为好（CPA/CPC 等）— 点击切回正向'
                  : '正向指标：上升为好 — 点击切为逆向'
              }
              onClick={() => setDirection(i, direction === 'inverse' ? null : 'inverse')}
              className={`rounded border px-1.5 text-[10px] font-medium ${
                direction === 'inverse'
                  ? 'border-[var(--green)] text-[var(--green)]'
                  : 'border-border-default text-foreground-muted'
              }`}
            >
              {direction === 'inverse' ? '降好' : '升好'}
            </button>
          </div>
        );
      })}
      {pickingRow !== null && (
        <IconPickerOverlay
          value={icons[pickingRow] ?? undefined}
          weight={weight}
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
