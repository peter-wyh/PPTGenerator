import type { EditorComponent, WorkScreenshotData, WorkScreenshotStyle } from '@mediakit/shared';
import { useEditorStore } from '../../store';
import { ImageInput } from '@/components/ImageInput';
import { FieldGroup } from '../helpers';
import { ReportWorkScreenshotImporter } from '../importers';

const STYLE_OPTIONS: { value: WorkScreenshotStyle; label: string }[] = [
  { value: 'grid', label: '网格' },
  { value: 'skew', label: '斜切拼接' },
  { value: 'overlap', label: '重叠堆叠' },
  { value: 'filmstrip', label: '胶片条' },
];

/** 作品截图：每张图 ImageInput + 说明 + 显隐 + 删除，底部添加；视觉样式选择器。 */
export function WorkScreenshotFields({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const data = comp.data as WorkScreenshotData;
  const images = data.images ?? [];
  const style = data.style ?? 'grid';

  const write = (next: Partial<WorkScreenshotData>) => {
    updateComponentData(comp.id, next);
    commit();
  };
  const writeImages = (next: WorkScreenshotData['images']) => write({ images: next });
  const setItem = (i: number, patch: Partial<{ src: string; caption: string; captionHidden: boolean }>) =>
    writeImages(images.map((im, idx) => (idx === i ? { ...im, ...patch } : im)));
  const add = () => writeImages([...images, { src: '', caption: '' }]);
  const remove = (i: number) => writeImages(images.filter((_, idx) => idx !== i));

  return (
    <>
      <ReportWorkScreenshotImporter comp={comp} />

      {/* 视觉样式选择器 */}
      <FieldGroup title="视觉样式">
        <div className="flex flex-wrap gap-1.5">
          {STYLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => write({ style: opt.value })}
              className={`rounded border px-2.5 py-1 text-xs transition ${
                style === opt.value
                  ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                  : 'border-border-default text-foreground-secondary hover:border-foreground-muted'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </FieldGroup>

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
                {/* 显隐切换：保留数据，仅切换渲染层显示 */}
                <button
                  onClick={() => setItem(i, { captionHidden: !im.captionHidden })}
                  className={`shrink-0 rounded px-1.5 py-1 text-xs ${
                    im.captionHidden
                      ? 'text-foreground-muted line-through'
                      : 'text-accent-primary'
                  }`}
                  title={im.captionHidden ? '点击显示说明' : '点击隐藏说明'}
                >
                  {im.captionHidden ? '隐' : '显'}
                </button>
                <button onClick={() => remove(i)} className="shrink-0 text-foreground-muted hover:text-red">
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
