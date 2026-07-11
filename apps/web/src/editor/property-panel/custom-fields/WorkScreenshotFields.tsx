import type {
  EditorComponent,
  WorkScreenshotData,
  WorkScreenshotStyle,
} from '@mediakit/shared';
import { useEditorStore } from '../../store';
import { ImageInput } from '@/components/ImageInput';
import { FieldGroup, VariantSelector } from '../helpers';
import { ReportWorkScreenshotImporter } from '../importers';

const STYLE_OPTIONS: { value: WorkScreenshotStyle; label: string; hint: string }[] = [
  { value: 'grid', label: '网格', hint: '标准马赛克' },
  { value: 'diagonal', label: '斜切网格', hint: '规整网格 + 行间斜切' },
  { value: 'skew', label: '斜切拼接', hint: '自由交错倾斜' },
  { value: 'overlap', label: '重叠堆叠', hint: '扇形展开' },
  { value: 'filmstrip', label: '胶片条', hint: '横向条带' },
];

/** 样式 → 是否使用网格版式选择器（variant），否则用列数选择器。 */
const USES_VARIANT: WorkScreenshotStyle[] = ['grid'];

/** 非网格样式下的可选列数。 */
const COLS_OPTIONS = [2, 3, 4, 5, 6];

const VARIANT_LIST = [
  { id: 'auto', label: '自适应' },
  { id: 'duo', label: '2 张' },
  { id: 'trio', label: '3 张' },
  { id: 'quad', label: '4 张' },
  { id: 'mosaic-5', label: '5 张' },
  { id: 'hex', label: '6 张' },
  { id: 'septet', label: '7 张' },
  { id: 'nona', label: '9 张' },
  { id: 'duoza', label: '12 张' },
] as const;

/** 作品截图：样式 + 数量联动 + 每张图编辑。 */
export function WorkScreenshotFields({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const data = comp.data as WorkScreenshotData;
  const images = data.images ?? [];
  const style = data.style ?? 'grid';
  const cols = data.cols ?? 3;

  const write = (next: Partial<WorkScreenshotData>) => {
    updateComponentData(comp.id, next);
    commit();
  };
  const writeImages = (next: WorkScreenshotData['images']) => write({ images: next });
  const setItem = (i: number, patch: Partial<{ src: string; caption: string; captionHidden: boolean }>) =>
    writeImages(images.map((im, idx) => (idx === i ? { ...im, ...patch } : im)));
  const add = () => writeImages([...images, { src: '', caption: '' }]);
  const remove = (i: number) => writeImages(images.filter((_, idx) => idx !== i));

  const usesVariant = USES_VARIANT.includes(style);

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

      {/* 数量/列数联动：grid & diagonal → variant 版式选择器；其余 → 列数选择器 */}
      {usesVariant ? (
        <FieldGroup title="版式（张数）">
          <VariantSelector
            comp={comp}
            variants={VARIANT_LIST.map((v) => ({ id: v.id as string, label: v.label }))}
          />
        </FieldGroup>
      ) : (
        <FieldGroup title="列数">
          <div className="flex gap-1.5">
            {COLS_OPTIONS.map((c) => (
              <button
                key={c}
                onClick={() => write({ cols: c })}
                className={`rounded border px-2.5 py-1 text-xs transition ${
                  cols === c
                    ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                    : 'border-border-default text-foreground-secondary hover:border-foreground-muted'
                }`}
              >
                {c} 列
              </button>
            ))}
          </div>
        </FieldGroup>
      )}

      <FieldGroup title={`作品截图（${images.length} 张）`}>
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
