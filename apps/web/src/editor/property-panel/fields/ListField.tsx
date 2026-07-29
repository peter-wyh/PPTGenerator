import type { EditorComponent } from '@mediakit/shared';
import type { PropertyField } from '../../registry';
import { readValue, useDataUpdate } from '../helpers';

/** "auto" 等非 hex 颜色值的默认占位色（用于 input[type=color] 回退显示）。 */
const COLOR_FALLBACK = '#888888';
const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

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
        {items.map((it, i) => {
          const isAuto = !HEX_RE.test(it.color ?? '');
          return (
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
              {isAuto ? (
                <button
                  title={`当前: ${it.color}（点击选择具体颜色）`}
                  onClick={() => setItem(i, { color: COLOR_FALLBACK })}
                  className="flex h-6 w-6 items-center justify-center rounded border border-border-default bg-gradient-to-br from-pink-400 via-yellow-300 to-blue-400 text-[9px] font-medium text-white"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                >
                  自
                </button>
              ) : (
                <input
                  type="color"
                  value={it.color}
                  onChange={(e) => setItem(i, { color: e.target.value })}
                  className="h-6 w-6 rounded border border-border-default"
                />
              )}
              <button onClick={() => remove(i)} className="text-foreground-muted hover:text-red">
                ✕
              </button>
            </div>
          );
        })}
      </div>
      <button onClick={add} className="mt-1 text-accent-primary hover:underline">
        + 添加
      </button>
    </div>
  );
}
