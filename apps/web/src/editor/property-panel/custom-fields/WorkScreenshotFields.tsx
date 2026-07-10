import type { EditorComponent, WorkScreenshotData } from '@mediakit/shared';
import { useEditorStore } from '../../store';
import { ImageInput } from '@/components/ImageInput';
import { FieldGroup } from '../helpers';
import { ReportWorkScreenshotImporter } from '../importers';

/** 作品截图：每张图 ImageInput + 说明 + 删除，底部添加。 */
export function WorkScreenshotFields({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const data = comp.data as WorkScreenshotData;
  const images = data.images ?? [];

  const write = (next: WorkScreenshotData['images']) => {
    updateComponentData(comp.id, { images: next } as Partial<WorkScreenshotData>);
    commit();
  };
  const setItem = (i: number, patch: Partial<{ src: string; caption: string }>) =>
    write(images.map((im, idx) => (idx === i ? { ...im, ...patch } : im)));
  const add = () => write([...images, { src: '', caption: '' }]);
  const remove = (i: number) => write(images.filter((_, idx) => idx !== i));

  return (
    <>
      <ReportWorkScreenshotImporter comp={comp} />
      <FieldGroup title="作品截图">
        <div className="space-y-2">
          {images.map((im, i) => (
            <div key={i} className="space-y-1 rounded border border-border-subtle p-1.5">
              <ImageInput value={im.src} onChange={(url) => setItem(i, { src: url })} />
              <div className="flex items-center gap-1">
                <input
                  value={im.caption ?? ''}
                  placeholder="说明"
                  onChange={(e) => setItem(i, { caption: e.target.value })}
                  className="w-full rounded border border-border-default px-1.5 py-1 text-xs text-foreground-primary"
                />
                <button onClick={() => remove(i)} className="text-foreground-muted hover:text-red">
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
        <button onClick={add} className="text-xs text-accent-primary hover:underline">
          + 添加图片
        </button>
      </FieldGroup>
    </>
  );
}
