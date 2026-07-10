import type { ComponentData, EditorComponent } from '@mediakit/shared';
import { useEditorStore } from '../store';
import type { PropertyField, VariantOption } from '../registry';

export function readValue(comp: EditorComponent, field: PropertyField): unknown {
  if (field.inData === false) {
    return (comp as unknown as Record<string, unknown>)[field.key];
  }
  return (comp.data as unknown as Record<string, unknown>)[field.key];
}

export function useDataUpdate(comp: EditorComponent) {
  const updateComponent = useEditorStore((s) => s.updateComponent);
  const commit = useEditorStore((s) => s.commit);
  return (key: string, value: unknown) => {
    updateComponent(comp.id, {
      data: { ...(comp.data as object), [key]: value } as unknown as ComponentData,
    });
    commit();
  };
}

export function VariantSelector({ comp, variants }: { comp: EditorComponent; variants: VariantOption[] }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const current = (comp.data as { variant?: string }).variant ?? variants[0]?.id ?? '';
  return (
    <div className="flex flex-wrap gap-1">
      {variants.map((v) => (
        <button
          key={v.id}
          onClick={() => updateComponentData(comp.id, { variant: v.id })}
          className={`rounded border px-2 py-1 text-xs ${
            current === v.id
              ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
              : 'border-border-default text-foreground-secondary hover:bg-surface-hover'
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

/* --------------------------- 达人链接解析 ---------------------------- */


export function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground-muted">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}



/** 不可变写入：返回新数组，index i 置为 v。 */
export function withAt<T>(arr: T[], i: number, v: T): T[] {
  const next = [...arr];
  next[i] = v;
  return next;
}
