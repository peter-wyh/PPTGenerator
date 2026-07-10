import { ImageInput } from '@/components/ImageInput';
import type { EditorComponent } from '@mediakit/shared';
import type { PropertyField } from '../../registry';
import { readValue, useDataUpdate } from '../helpers';

/** 图片 URL 字段：文本 + 上传(裁剪)，复用 ImageInput。 */
export function ImageUrlField({ comp, field }: { comp: EditorComponent; field: PropertyField }) {
  const update = useDataUpdate(comp);
  const value = (readValue(comp, field) as string) ?? '';
  return (
    <div className="text-xs text-foreground-secondary">
      <div className="mb-1">{field.label}</div>
      <ImageInput value={value} onChange={(url) => update(field.key, url)} />
    </div>
  );
}
