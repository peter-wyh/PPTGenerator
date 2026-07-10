import type { EditorComponent } from '@mediakit/shared';
import type { PropertyField } from '../../registry';
import { readValue, useDataUpdate } from '../helpers';

export function TextareaField({ comp, field }: { comp: EditorComponent; field: PropertyField }) {
  const update = useDataUpdate(comp);
  const value = (readValue(comp, field) as string) ?? '';
  return (
    <label className="block text-xs text-foreground-secondary">
      <span className="mb-1 block">{field.label}</span>
      <textarea
        value={value}
        onChange={(e) => update(field.key, e.target.value)}
        rows={3}
        className="w-full resize-y rounded border border-border-default px-2 py-1 text-foreground-primary"
      />
    </label>
  );
}
