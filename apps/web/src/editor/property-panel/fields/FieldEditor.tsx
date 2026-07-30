import type { EditorComponent } from '@mediakit/shared';
import type { PropertyField } from '../../registry';
import { TextField } from './TextField';
import { ImageUrlField } from './ImageUrlField';
import { TextareaField } from './TextareaField';
import { DataNumberField } from './DataNumberField';
import { SelectField } from './SelectField';
import { MultiSelectField } from './MultiSelectField';
import { ListField } from './ListField';
import { TableField } from './TableField';
import { IconPickerField } from './IconPickerField';

export function FieldEditor({ comp, field }: { comp: EditorComponent; field: PropertyField }) {
  switch (field.kind) {
    case 'text':
    case 'color':
      return <TextField comp={comp} field={field} type={field.kind === 'color' ? 'color' : 'text'} />;
    case 'image-url':
      return <ImageUrlField comp={comp} field={field} />;
    case 'textarea':
      return <TextareaField comp={comp} field={field} />;
    case 'number':
      return <DataNumberField comp={comp} field={field} />;
    case 'select':
      return <SelectField comp={comp} field={field} />;
    case 'multi-select':
      return <MultiSelectField comp={comp} field={field} />;
    case 'list':
      return <ListField comp={comp} field={field} />;
    case 'table':
      return <TableField comp={comp} />;
    case 'icon':
      return <IconPickerField comp={comp} />;
    default:
      return null;
  }
}
