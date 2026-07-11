import type { EditorComponent } from '@mediakit/shared';
import type { PropertyField } from '../../registry';
import { readValue, useDataUpdate } from '../helpers';

/** {label,value,color}[] 列表编辑器（柱状图 bars / 饼图 slices）。 */
export function ListField({ comp, field }: { comp: EditorComponent; field: PropertyField }) {
  const update = useDataUpdate(comp);
  const items = (readValue(comp, field) as { label: string; value: number; color: string }[]) ?? [];
  const key = field.key;

  const setItem = (i: number, patch: Partial<{ label: string; value: number; color: string }>) => {
    const next = items.map((it, idx) => (idx === i ? { ...it, ...patch } : it));
    update(key, next);
  };
  const add = () => update(key, [...items, { label: '新', value: 50, color: 'auto' }]);
  const remove = (i: number) => update(key, items.filter((_, idx) => idx !== i));

  return (
    <div className="text-xs text-foreground-secondary">
      <div className="mb-1">{field.label}</div>
      <div className="space-y-1">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              value={it.label}
              onChange={(e) => setItem(i, { label: e.target.value })}
              className="w-16 rounded border border-border-default px-1 py-0.5"
            />
            <input
              type="number"
              value={it.value}
              onChange={(e) => setItem(i, { value: Number(e.target.value) })}
              className="w-14 rounded border border-border-default px-1 py-0.5"
            />
            <input
              type="color"
              value={it.color}
              onChange={(e) => setItem(i, { color: e.target.value })}
              className="h-6 w-6 rounded border border-border-default"
            />
            <button onClick={() => remove(i)} className="text-foreground-muted hover:text-red">
              ✕
            </button>
          </div>
        ))}
      </div>
      <button onClick={add} className="mt-1 text-accent-primary hover:underline">
        + 添加
      </button>
    </div>
  );
}
