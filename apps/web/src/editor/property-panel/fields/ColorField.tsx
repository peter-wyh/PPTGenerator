import type { EditorComponent } from '@mediakit/shared';
import type { PropertyField } from '../../registry';
import { TextField } from './TextField';

/**
 * Color field: delegates to TextField with type='color'.
 * FieldEditor dispatches 'color' kind to this for parity with TextField('color').
 */
export function ColorField({ comp, field }: { comp: EditorComponent; field: PropertyField }) {
  return <TextField comp={comp} field={field} type="color" />;
}
