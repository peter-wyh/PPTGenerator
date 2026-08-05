import type { EditorComponent, CreatorWorksListData, GalleryStyle } from '@mediakit/shared';
import { useEditorStore } from '../../store';
import { FieldGroup } from '../helpers';

const GALLERY_STYLE_OPTIONS: { value: GalleryStyle; label: string; hint: string }[] = [
  { value: 'grid', label: '网格', hint: '标准等分网格' },
  { value: 'mosaic', label: '拼图', hint: '1大2小等非对称组合' },
  { value: 'skew', label: '斜切', hint: '自由交错倾斜' },
  { value: 'overlap', label: '重叠', hint: '扇形堆叠展开' },
  { value: 'filmstrip', label: '胶片条', hint: '横向条带' },
  { value: 'diagonal', label: '斜切网格', hint: '规整网格+行间斜切' },
];

/** 达人-作品列表：gallery 子风格选择器（仅在 variant=gallery 时显示）。 */
export function CreatorWorksListFields({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const data = comp.data as CreatorWorksListData;

  if (data.variant !== 'gallery') return null;

  const galleryStyle = data.galleryStyle ?? 'grid';

  const write = (next: Partial<CreatorWorksListData>) => {
    updateComponentData(comp.id, next);
    commit();
  };

  return (
    <FieldGroup title="展示风格">
      <div className="flex flex-wrap gap-1.5">
        {GALLERY_STYLE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => write({ galleryStyle: opt.value })}
            className={`rounded border px-2.5 py-1 text-xs transition ${
              galleryStyle === opt.value
                ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                : 'border-border-default text-foreground-secondary hover:border-foreground-muted'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-foreground-muted">
        {GALLERY_STYLE_OPTIONS.find((o) => o.value === galleryStyle)?.hint}
      </p>
    </FieldGroup>
  );
}
