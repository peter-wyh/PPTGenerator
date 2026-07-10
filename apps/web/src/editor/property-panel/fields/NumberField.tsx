import { useEffect, useState } from 'react';
import type { EditorComponent } from '@mediakit/shared';
import { useEditorStore } from '../../store';
import type { PropertyField } from '../../registry';
import { readValue } from '../helpers';

/** 数值字段（几何 + 字号等）。onChange 实时更新不进 history，onBlur commit。 */
export function NumberField({ comp, field }: { comp: EditorComponent; field: PropertyField }) {
  const updateComponent = useEditorStore((s) => s.updateComponent);
  const sanitizeComponent = useEditorStore((s) => s.sanitizeComponent);
  const commit = useEditorStore((s) => s.commit);
  const value = readValue(comp, field) as number;
  const [v, setV] = useState(String(value ?? 0));

  useEffect(() => setV(String(value ?? 0)), [value]);

  return (
    <label className="flex items-center gap-1 text-xs text-foreground-secondary">
      <span className="w-4">{field.label}</span>
      <input
        type="number"
        value={v}
        onChange={(e) => {
          setV(e.target.value);
          if (field.inData === false) {
            updateComponent(comp.id, { [field.key]: Number(e.target.value) } as Partial<EditorComponent>);
          }
        }}
        onBlur={() => {
          if (field.inData === false) sanitizeComponent(comp.id); // 几何字段失焦夹进安全区
          commit();
        }}
        className="w-full rounded border border-border-default px-1.5 py-1 text-foreground-primary"
      />
    </label>
  );
}
