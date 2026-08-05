import type { EditorComponent } from '@mediakit/shared';
import type { PropertyField } from '../../registry';
import { useEditorStore } from '../../store';
import { TextField } from './TextField';
import { ImageUrlField } from './ImageUrlField';
import { TextareaField } from './TextareaField';
import { RichTextField } from './RichTextField';
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
    case 'rich-text':
      return <RichTextPropertyField comp={comp} field={field} />;
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

/** Adapter: bridges the generic (comp, field) property-panel contract to the
 *  existing RichTextField's (value, onChange) contract. */
function RichTextPropertyField({ comp, field }: { comp: EditorComponent; field: PropertyField }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const value = (comp.data[field.key as keyof typeof comp.data] as string) ?? '';
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-foreground-secondary">{field.label}</label>
      <RichTextField value={value} onChange={(html) => updateComponentData(comp.id, { [field.key]: html })} />
    </div>
  );
}
