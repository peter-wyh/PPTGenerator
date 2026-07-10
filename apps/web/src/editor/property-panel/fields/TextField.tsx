import type { EditorComponent } from '@mediakit/shared';
import type { PropertyField } from '../../registry';
import { readValue, useDataUpdate } from '../helpers';

export function TextField({ comp, field, type }: { comp: EditorComponent; field: PropertyField; type: 'text' | 'color' }) {
  const update = useDataUpdate(comp);
  const value = (readValue(comp, field) as string) ?? '';
  return (
    <label className="block text-xs text-foreground-secondary">
      <span className="mb-1 block">{field.label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => update(field.key, e.target.value)}
        className={`w-full rounded border border-border-default px-2 py-1 text-foreground-primary ${
          type === 'color' ? 'h-8 p-1' : ''
        }`}
      />
    </label>
  );
}
