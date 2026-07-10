import type { EditorComponent } from '@mediakit/shared';
import { useEditorStore } from '../../store';
import { getStyleOptions, type VariantId } from '../../business/catalog';
import { FieldGroup } from '../helpers';

export function BusinessFields({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const data = comp.data as {
    businessKind: string;
    variant: VariantId;
    details: string[];
  };
  const options = getStyleOptions(data.businessKind);

  const setDetail = (i: number, v: string) => {
    const next = [...(data.details ?? [])];
    next[i] = v;
    updateComponentData(comp.id, { details: next });
  };
  const addDetail = () => updateComponentData(comp.id, { details: [...(data.details ?? []), '新条目'] });
  const removeDetail = (i: number) =>
    updateComponentData(comp.id, { details: (data.details ?? []).filter((_, idx) => idx !== i) });

  return (
    <>
      <FieldGroup title="变体">
        <div className="flex flex-wrap gap-1">
          {options.map(([id, label]) => (
            <button
              key={id}
              onClick={() => updateComponentData(comp.id, { variant: id })}
              className={`rounded border px-2 py-1 text-xs ${
                data.variant === id
                  ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                  : 'border-border-default text-foreground-secondary hover:bg-surface-hover'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </FieldGroup>

      <FieldGroup title="条目">
        <div className="space-y-1">
          {(data.details ?? []).map((d, i) => (
            <div key={i} className="flex items-center gap-1">
              <input
                value={d}
                onChange={(e) => setDetail(i, e.target.value)}
                className="w-full rounded border border-border-default px-1.5 py-1 text-xs"
              />
              <button onClick={() => removeDetail(i)} className="text-foreground-muted hover:text-red">
                ✕
              </button>
            </div>
          ))}
        </div>
        <button onClick={addDetail} className="mt-1 text-xs text-accent-primary hover:underline">
          + 添加条目
        </button>
      </FieldGroup>
    </>
  );
}
