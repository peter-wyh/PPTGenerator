import { useEffect, useState, useRef } from 'react';
import type { EditorComponent } from '@mediakit/shared';
import type { PropertyField } from '../../registry';
import { readValue, useDataUpdate } from '../helpers';

/**
 * 多选标签字段：值存为 string[]。
 * 以 chip 形式展示已选项，点击 chip 取消选择；下拉框选择新项。
 */
export function MultiSelectField({ comp, field }: { comp: EditorComponent; field: PropertyField }) {
  const update = useDataUpdate(comp);
  const raw = readValue(comp, field);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 兼容旧数据：string[] | string(逗号分隔) | undefined
  let selected: string[] = [];
  if (Array.isArray(raw)) {
    selected = raw as string[];
  } else if (typeof raw === 'string' && raw.trim()) {
    selected = raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  }

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const options = field.options ?? [];
  const selectedLabels = options.filter((o) => selected.includes(o.value));
  const unselected = options.filter((o) => !selected.includes(o.value));

  function toggle(value: string) {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    update(field.key, next);
  }

  const labelMap = new Map(options.map((o) => [o.value, o.label]));

  return (
    <div className="block text-xs text-foreground-secondary">
      <span className="mb-1 block">{field.label}</span>
      <div ref={ref} className="relative">
        <div className="flex min-h-[28px] flex-wrap items-center gap-1 rounded border border-border-default bg-surface-primary px-1.5 py-1">
          {selectedLabels.length === 0 && (
            <span className="text-foreground-muted">点击选择…</span>
          )}
          {selected.map((v) => (
            <span
              key={v}
              onClick={() => toggle(v)}
              className="cursor-pointer rounded bg-accent-primary/10 px-1.5 py-0.5 text-[11px] text-accent-primary hover:bg-red-500/10 hover:text-red-500"
            >
              {labelMap.get(v) ?? v} ✕
            </span>
          ))}
          {unselected.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="ml-auto text-[11px] text-foreground-muted hover:text-foreground-primary"
            >
              {open ? '▲' : '▼'}
            </button>
          )}
        </div>
        {open && unselected.length > 0 && (
          <div className="absolute z-50 mt-0.5 w-full rounded border border-border-default bg-surface-primary py-0.5 shadow-lg">
            {unselected.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  toggle(o.value);
                }}
                className="block w-full px-2 py-1 text-left text-[11px] text-foreground-primary hover:bg-surface-hover"
              >
                + {o.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
