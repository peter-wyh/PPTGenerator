import type { EditorComponent, ImageGroupData } from '@mediakit/shared';
import { useEditorStore } from '../../store';
import { ImageInput } from '@/components/ImageInput';
import { FieldGroup } from '../helpers';

/** 组图：每张图 ImageInput + 删除，底部添加；数量自由，版式自适应或手动锁定。 */
export function ImageGroupFields({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const data = comp.data as ImageGroupData;
  const images = data.images ?? [];

  const write = (next: ImageGroupData['images']) => {
    updateComponentData(comp.id, { images: next } as Partial<ImageGroupData>);
    commit();
  };
  const setSrc = (i: number, src: string) =>
    write(images.map((im, idx) => (idx === i ? { ...im, src } : im)));
  const add = () => write([...images, { src: '' }]);
  const remove = (i: number) => write(images.filter((_, idx) => idx !== i));

  return (
    <FieldGroup title="图片">
      <div className="space-y-2">
        {images.map((im, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className="flex-1">
              <ImageInput value={im.src} onChange={(url) => setSrc(i, url)} />
            </div>
            <button onClick={() => remove(i)} className="text-foreground-muted hover:text-red">
              ✕
            </button>
          </div>
        ))}
      </div>
      <button onClick={add} className="text-xs text-accent-primary hover:underline">
        + 添加图片
      </button>
    </FieldGroup>
  );
}
