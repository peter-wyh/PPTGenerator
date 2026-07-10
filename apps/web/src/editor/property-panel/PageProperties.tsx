import { useState, useEffect } from 'react';
import type { Page, PageGradient, GradientStop } from '@mediakit/shared';
import { useEditorStore } from '../store';
import { backgroundType, buildBackgroundTypePatch, type BackgroundType } from '../background';
import { ImageInput } from '@/components/ImageInput';
import { GRADIENT_ANGLE_PRESETS } from './constants';
import { FieldGroup } from './helpers';

export function PageProperties() {
  const page = useEditorStore((s) => s.currentPage());
  const updatePage = useEditorStore((s) => s.updatePage);
  const patchPageLive = useEditorStore((s) => s.patchPageLive);

  // 本地 state 缓冲：色板拖动/文本输入时实时更新视觉，但只在 onBlur 时落 history。
  // 避免拖动一次选色器推几十次 history 快照、清空 redo 栈。
  const [bgColorDraft, setBgColorDraft] = useState<string>(page?.bgColor ?? '');
  const [nameDraft, setNameDraft] = useState<string>(page?.name ?? '');
  // 背景类型派生自数据（撤销/重做后立即同步）；imagePending 仅覆盖「选了图片但还没给 URL」这一瞬态，
  // 让「图片」chip 保持高亮、显示 ImageInput。
  const [imagePending, setImagePending] = useState(false);

  // 切换页面时把本地缓冲同步成最新 store 值。
  useEffect(() => {
    setBgColorDraft(page?.bgColor ?? '');
    setNameDraft(page?.name ?? '');
    setImagePending(false);
  }, [page?.id, page?.bgColor, page?.name]);

  if (!page) {
    return (
      <div className="flex h-full w-[300px] items-center justify-center border-l border-border-default bg-surface-primary p-4 text-center text-sm text-foreground-muted">
        选中组件以编辑属性
      </div>
    );
  }

  // 色板拖动 / 文本输入：实时写本地 + live 预览（不落 history）。
  const onBgColorInput = (v: string) => {
    setBgColorDraft(v);
    patchPageLive(page.id, { bgColor: v || undefined });
  };
  // 失焦提交：落一次 history（可撤销）+ 标脏（触发 autosave）。
  const commitBgColor = () => updatePage(page.id, { bgColor: bgColorDraft || undefined });

  const onNameInput = (v: string) => {
    setNameDraft(v);
    patchPageLive(page.id, { name: v });
  };
  const commitName = () => updatePage(page.id, { name: nameDraft });

  const set = (patch: Partial<Pick<Page, 'name' | 'bgColor' | 'bgGradient' | 'bgImage'>>) =>
    updatePage(page.id, patch);

  // 类型派生自数据；imagePending 覆盖「图片待选 URL」瞬态。
  const derived = backgroundType(page);
  const bgType: BackgroundType = imagePending && derived === 'none' ? 'image' : derived;

  const switchType = (t: BackgroundType) => {
    setImagePending(t === 'image');
    updatePage(page.id, buildBackgroundTypePatch(page, t));
  };

  const TYPE_LABELS: Record<Exclude<BackgroundType, 'none'>, string> = {
    color: '纯色',
    gradient: '渐变',
    image: '图片',
  };

  return (
    <div className="flex h-full w-[300px] flex-col gap-4 overflow-auto border-l border-border-default bg-surface-primary p-4">
      <div className="font-headings text-sm font-semibold text-foreground-primary">页面属性</div>

      <FieldGroup title="页面名">
        <input
          value={nameDraft}
          onChange={(e) => onNameInput(e.target.value)}
          onBlur={commitName}
          className="w-full rounded border border-border-default px-2 py-1 text-sm text-foreground-primary"
        />
      </FieldGroup>

      <FieldGroup title="背景">
        <div className="flex flex-wrap gap-1">
          {(['color', 'gradient', 'image'] as const).map((t) => (
            <button
              key={t}
              onClick={() => switchType(t)}
              className={`rounded border px-2 py-1 text-xs ${
                bgType === t
                  ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                  : 'border-border-default text-foreground-secondary hover:bg-surface-hover'
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {bgType === 'color' && (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={bgColorDraft || '#ffffff'}
              onChange={(e) => onBgColorInput(e.target.value)}
              onBlur={commitBgColor}
              className="h-8 w-10 rounded border border-border-default p-1"
            />
            <input
              value={bgColorDraft}
              placeholder="#FFFFFF（留空=白）"
              onChange={(e) => onBgColorInput(e.target.value)}
              onBlur={commitBgColor}
              className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-primary"
            />
          </div>
        )}

        {bgType === 'gradient' && <GradientFields page={page} />}

        {bgType === 'image' && (
          <ImageInput value={page.bgImage ?? ''} onChange={(url) => set({ bgImage: url || undefined })} />
        )}

        {(page.bgColor || page.bgGradient || page.bgImage) && (
          <button
            onClick={() => {
              setImagePending(false);
              set({ bgColor: undefined, bgGradient: undefined, bgImage: undefined });
            }}
            className="mt-1 text-xs text-foreground-muted hover:text-red"
          >
            清除背景
          </button>
        )}
      </FieldGroup>

      <p className="mt-auto text-xs text-foreground-muted">提示：点选画布上的组件以编辑组件属性。</p>
    </div>
  );
}

/* ------------------------------ 渐变背景 ------------------------------ */

function clampAngle(a: number): number {
  return Math.max(0, Math.min(360, Math.round(a) || 0));
}

function clampPos(p: number): number {
  return Math.max(0, Math.min(100, Math.round(p) || 0));
}

/**
 * 渐变背景编辑器：子类型 + （线性）角度 + 预览条 + 色标增删。
 * 离散动作每次 updatePage 落一次 history，与 PageProperties.bgColor / ListField 一致。
 */

export function GradientFields({ page }: { page: Page }) {
  const updatePage = useEditorStore((s) => s.updatePage);
  const grad = page.bgGradient;
  if (!grad) return null;

  const set = (next: PageGradient) => updatePage(page.id, { bgGradient: next });
  const setType = (type: 'linear' | 'radial') => set({ ...grad, type });
  const setAngle = (angle: number) => set({ ...grad, angle: clampAngle(angle) });
  const setStop = (i: number, patch: Partial<GradientStop>) =>
    set({ ...grad, stops: grad.stops.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  const addStop = () => {
    if (grad.stops.length >= 6) return;
    const last = grad.stops[grad.stops.length - 1];
    const pos = clampPos((last?.position ?? 0) + (100 - (last?.position ?? 0)) / 2);
    set({ ...grad, stops: [...grad.stops, { color: last?.color ?? '#FFFFFF', position: pos }] });
  };
  const removeStop = (i: number) => {
    if (grad.stops.length <= 2) return;
    set({ ...grad, stops: grad.stops.filter((_, idx) => idx !== i) });
  };

  const angle = grad.angle ?? 180;
  const stopStr = grad.stops
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((s) => `${s.color} ${s.position}%`)
    .join(', ');
  const preview =
    grad.type === 'radial'
      ? `radial-gradient(circle at center, ${stopStr})`
      : `linear-gradient(${angle}deg, ${stopStr})`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {(['linear', 'radial'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded border px-2 py-1 text-xs ${
              grad.type === t
                ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                : 'border-border-default text-foreground-secondary hover:bg-surface-hover'
            }`}
          >
            {t === 'linear' ? '线性' : '径向'}
          </button>
        ))}
      </div>

      <div className="h-6 w-full rounded border border-border-default" style={{ background: preview }} />

      {grad.type === 'linear' && (
        <div className="space-y-1">
          <div className="flex flex-wrap gap-1">
            {GRADIENT_ANGLE_PRESETS.map((p) => (
              <button
                key={p.angle}
                onClick={() => setAngle(p.angle)}
                className={`h-7 w-7 rounded border text-xs ${
                  angle === p.angle ? 'border-accent-primary bg-accent-primary/10' : 'border-border-default hover:bg-surface-hover'
                }`}
                title={`${p.angle}°`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-foreground-secondary">
            <span>角度</span>
            <input
              type="number"
              min={0}
              max={360}
              value={angle}
              onChange={(e) => setAngle(Number(e.target.value))}
              className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-primary"
            />
          </label>
        </div>
      )}

      <div className="space-y-1">
        <div className="text-xs text-foreground-secondary">色标</div>
        {grad.stops.map((s, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              type="color"
              value={s.color}
              onChange={(e) => setStop(i, { color: e.target.value })}
              className="h-6 w-6 rounded border border-border-default"
            />
            <input
              type="number"
              min={0}
              max={100}
              value={s.position}
              onChange={(e) => setStop(i, { position: clampPos(Number(e.target.value)) })}
              className="w-14 rounded border border-border-default px-1 py-0.5 text-xs text-foreground-primary"
            />
            <button
              onClick={() => removeStop(i)}
              disabled={grad.stops.length <= 2}
              className="text-foreground-muted hover:text-red disabled:opacity-30"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addStop}
        disabled={grad.stops.length >= 6}
        className="text-xs text-accent-primary hover:underline disabled:opacity-30"
      >
        + 添加色标
      </button>
    </div>
  );
}

/* --------------------------- 通用样式变体 ---------------------------- */

