import type {
  EditorComponent,
  WorkScreenshotData,
  WorkScreenshotStyle,
} from '@mediakit/shared';
import { useEditorStore } from '../../store';
import { ImageInput } from '@/components/ImageInput';
import { FieldGroup } from '../helpers';
import { ReportWorkScreenshotImporter } from '../importers';
import { MOSAIC_LAYOUT_OPTIONS } from '@/editor/components/WorksComponents';

const STYLE_OPTIONS: { value: WorkScreenshotStyle; label: string; hint: string }[] = [
  { value: 'grid', label: '网格', hint: '标准马赛克' },
  { value: 'mosaic', label: '拼图', hint: '1大2小等不规则组合' },
  { value: 'diagonal', label: '斜切网格', hint: '规整网格 + 行间斜切' },
  { value: 'skew', label: '斜切拼接', hint: '自由交错倾斜' },
  { value: 'overlap', label: '重叠堆叠', hint: '扇形展开' },
  { value: 'filmstrip', label: '胶片条', hint: '横向条带' },
];

const DISPLAY_OPTIONS = [1, 2, 3, 4, 6, 8, 9, 12];

/** 作品截图：样式 + 显示数量联动 + 每张图编辑。 */
export function WorkScreenshotFields({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const data = comp.data as WorkScreenshotData;
  const images = data.images ?? [];
  const style = data.style ?? 'grid';
  const mosaicLayout = data.mosaicLayout;
  const total = images.length;
  // displayCount 未设或 > total 时显示全部
  const displayCount = data.displayCount ?? total;

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

      {/* 视觉样式 */}
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
        <p className="mt-1 text-[10px] text-foreground-muted">
          {STYLE_OPTIONS.find((o) => o.value === style)?.hint}
        </p>
      </FieldGroup>

      {/* 组合版式（仅 mosaic 风格） */}
      {style === 'mosaic' && (
        <FieldGroup title="组合版式">
          <div className="flex flex-wrap gap-1.5">
            {MOSAIC_LAYOUT_OPTIONS.map((opt) => {
              const enabled = displayCount >= opt.minImages;
              const active = mosaicLayout === opt.value || (!mosaicLayout && opt.value === 'auto');
              return (
                <button
                  key={opt.value}
                  disabled={!enabled}
                  onClick={() => write({ mosaicLayout: opt.value === 'auto' ? undefined : opt.value })}
                  title={!enabled ? `需 ${opt.minImages} 张` : undefined}
                  className={`rounded border px-2.5 py-1 text-xs transition ${
                    active
                      ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                      : 'border-border-default text-foreground-secondary hover:border-foreground-muted'
                  } ${!enabled ? 'cursor-not-allowed opacity-40' : ''}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-[10px] text-foreground-muted">
            {!mosaicLayout || mosaicLayout === 'auto'
              ? '按张数自动选择版式'
              : `${MOSAIC_LAYOUT_OPTIONS.find((o) => o.value === mosaicLayout)?.label} · 当前显示 ${displayCount} 张`}
          </p>
        </FieldGroup>
      )}

      {/* 显示数量 */}
      <FieldGroup title="显示数量">
        <div className="flex flex-wrap gap-1.5">
          {DISPLAY_OPTIONS.filter((n) => n <= total || n === total).map((n) => (
            <button
              key={n}
              onClick={() => write({ displayCount: n })}
              className={`rounded border px-2.5 py-1 text-xs transition ${
                displayCount === n
                  ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                  : 'border-border-default text-foreground-secondary hover:border-foreground-muted'
              }`}
            >
              {n} 张
            </button>
          ))}
          {total > 0 && !DISPLAY_OPTIONS.includes(total) && (
            <button
              onClick={() => write({ displayCount: undefined })}
              className={`rounded border px-2.5 py-1 text-xs transition ${
                displayCount === total
                  ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                  : 'border-border-default text-foreground-secondary hover:border-foreground-muted'
              }`}
            >
              全部 {total} 张
            </button>
          )}
        </div>
        <p className="mt-1 text-[10px] text-foreground-muted">
          当前显示 {displayCount} 张 / 共 {total} 张，布局自动适配
        </p>
      </FieldGroup>

      <FieldGroup title={`作品截图（${total} 张）`}>
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
