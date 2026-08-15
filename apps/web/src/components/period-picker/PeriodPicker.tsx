import { useEffect, useRef } from 'react';
import { PRESETS, resolvePreset, validatePeriod, type Period, type Preset } from './periodRange';
import { todayIso } from './today';

export interface PeriodPickerProps {
  value: Period;
  onChange: (v: Period) => void;
  /** 有效窗口下/上界，YYYY-MM-DD；缺省=该侧无界(降级模式)。 */
  minDate?: string;
  maxDate?: string;
  /** 为 true 时空值非法。 */
  required?: boolean;
  /** 预设列表，默认 PRESETS。 */
  presets?: Preset[];
  /** 预设相对基准日；缺省读系统时钟。测试时传定值。 */
  today?: string;
  /** 合法性变化时回调，供调用方 gate 提交按钮。 */
  onValidityChange?: (ok: boolean) => void;
}

export function PeriodPicker({
  value,
  onChange,
  minDate,
  maxDate,
  required,
  presets = PRESETS,
  today,
  onValidityChange,
}: PeriodPickerProps) {
  const min = minDate ?? '';
  const max = maxDate ?? '';
  const now = today ?? todayIso();
  const result = validatePeriod(value, { min, max, required });

  // 仅在合法性翻转时回调，避免每次渲染触发 setState 循环。
  const lastOk = useRef<boolean | null>(null);
  useEffect(() => {
    if (lastOk.current !== result.ok) {
      lastOk.current = result.ok;
      onValidityChange?.(result.ok);
    }
  }, [result.ok, onValidityChange]);

  return (
    <div className="mt-3">
      {(min || max) && (
        <p className="text-[10px] text-foreground-muted">
          投放区间 {min || '—'} ~ {max || '—'}
        </p>
      )}
      <div className="mt-1 flex flex-wrap gap-1">
        {presets.map((p) => {
          const resolved = resolvePreset(p.id, min, max, now);
          const disabled = resolved === null;
          return (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              onClick={() => resolved && onChange(resolved)}
              className="rounded border border-border-default px-2 py-0.5 text-[11px] text-foreground-secondary enabled:hover:bg-surface-hover disabled:opacity-40"
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="block text-xs text-foreground-secondary">
          起始日期
          <input
            aria-label="起始日期"
            type="date"
            value={value.startDate}
            min={min || undefined}
            max={max || undefined}
            onChange={(e) => onChange({ ...value, startDate: e.target.value })}
            className="mt-0.5 w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-primary"
          />
        </label>
        <label className="block text-xs text-foreground-secondary">
          结束日期
          <input
            aria-label="结束日期"
            type="date"
            value={value.endDate}
            min={min || undefined}
            max={max || undefined}
            onChange={(e) => onChange({ ...value, endDate: e.target.value })}
            className="mt-0.5 w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-primary"
          />
        </label>
      </div>
      {result.error && <p className="mt-1 text-[11px] text-red">{result.error}</p>}
    </div>
  );
}
