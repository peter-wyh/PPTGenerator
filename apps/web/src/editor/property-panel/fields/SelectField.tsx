import type { EditorComponent } from '@mediakit/shared';
import type { PropertyField } from '../../registry';
import { readValue, useDataUpdate } from '../helpers';

export function SelectField({ comp, field }: { comp: EditorComponent; field: PropertyField }) {
  const update = useDataUpdate(comp);
  const value = String(readValue(comp, field) ?? '');
  return (
    <label className="block text-xs text-foreground-secondary">
      <span className="mb-1 block">{field.label}</span>
      <select
        value={value}
        onChange={(e) => {
          // trendUp 存布尔；其余存原值。
          const raw = readValue(comp, field);
          const v = typeof raw === 'boolean' ? e.target.value === 'true' : e.target.value;
          update(field.key, v);
        }}
        className="w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-foreground-primary"
      >
        {field.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
