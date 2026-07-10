import type { EditorComponent } from '@mediakit/shared';
import type { PropertyField } from '../../registry';
import { readValue, useDataUpdate } from '../helpers';

export function DataNumberField({ comp, field }: { comp: EditorComponent; field: PropertyField }) {
  const update = useDataUpdate(comp);
  const value = Number(readValue(comp, field) ?? 0);
  return (
    <label className="block text-xs text-foreground-secondary">
      <span className="mb-1 block">{field.label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => update(field.key, Number(e.target.value))}
        className="w-full rounded border border-border-default px-2 py-1 text-foreground-primary"
      />
    </label>
  );
}
