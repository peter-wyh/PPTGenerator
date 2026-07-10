import { useState } from 'react';
import type {
  CommentWordcloudData,
  ComponentData,
  CreatorStatItem,
  CreatorStatsStripData,
  EditorComponent,
  IconWeight,
  ImageGroupData,
  KpiBoardData,
  KpiColorToken,
  KpiTrendDirection,
  Sentiment,
  ShapeData,
  ShapeKind,
  StrategyBlockData,
  WorkMetricsData,
  WorkScreenshotData,
} from '@mediakit/shared';
import { CREATOR_METRIC_CATALOG } from '@mediakit/shared';
import { useEditorStore } from '../store';
import { getStyleOptions, type VariantId } from '../business/catalog';
import { IconPickerOverlay } from '../icons/IconPickerOverlay';
import { findIcon } from '../icons/catalog';
import { useDataUpdate, withAt } from './helpers';
import { FieldGroup } from './helpers';
import { TableCellIconPicker, RichTextField } from './fields';
import { SHAPE_OPTIONS } from './constants';
import { KPI_COLOR_OPTIONS, KPI_COLOR_TOKENS } from '../kpiTokens';
import { ReportWorkScreenshotImporter } from './importers';
import { ImageInput } from '@/components/ImageInput';

export function BusinessFields({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const data = comp.data as {
    businessKind: string;
    variant: VariantId;
    details: string[];
  };
  const options = getStyleOptions(data.businessKind);

  const setDetail = (i: number, v: string) => {
    const next = [...(data.details ?? [])];
    next[i] = v;
    updateComponentData(comp.id, { details: next });
  };
  const addDetail = () => updateComponentData(comp.id, { details: [...(data.details ?? []), '新条目'] });
  const removeDetail = (i: number) =>
    updateComponentData(comp.id, { details: (data.details ?? []).filter((_, idx) => idx !== i) });

  return (
    <>
      <FieldGroup title="变体">
        <div className="flex flex-wrap gap-1">
          {options.map(([id, label]) => (
            <button
              key={id}
              onClick={() => updateComponentData(comp.id, { variant: id })}
              className={`rounded border px-2 py-1 text-xs ${
                data.variant === id
                  ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                  : 'border-border-default text-foreground-secondary hover:bg-surface-hover'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </FieldGroup>

      <FieldGroup title="条目">
        <div className="space-y-1">
          {(data.details ?? []).map((d, i) => (
            <div key={i} className="flex items-center gap-1">
              <input
                value={d}
                onChange={(e) => setDetail(i, e.target.value)}
                className="w-full rounded border border-border-default px-1.5 py-1 text-xs"
              />
              <button onClick={() => removeDetail(i)} className="text-foreground-muted hover:text-red">
                ✕
              </button>
            </div>
          ))}
        </div>
        <button onClick={addDetail} className="mt-1 text-xs text-accent-primary hover:underline">
          + 添加条目
        </button>
      </FieldGroup>
    </>
  );
}

/* ----------------------------- 多选对齐面板 ----------------------------- */

export function CreatorStatsFields({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const data = comp.data as CreatorStatsStripData;
  const stats = data.stats ?? [];

  const write = (next: CreatorStatItem[]) => {
    updateComponentData(comp.id, { stats: next } as Partial<CreatorStatsStripData>);
    commit();
  };

  // 命中指标库：存在同 key 且 selected !== false 视为启用。
  const isEnabled = (key: string) => stats.some((s) => s.key === key && s.selected !== false);

  const toggle = (key: string) => {
    const meta = CREATOR_METRIC_CATALOG.find((m) => m.key === key)!;
    const existing = stats.find((s) => s.key === key);
    if (existing) {
      // 切换 selected（保留文案）。
      write(stats.map((s) => (s.key === key ? { ...s, selected: s.selected === false } : s)));
    } else {
      // 首次启用：用指标库默认 label/color，value 留空待用户填。
      write([...stats, { key, label: meta.label, value: '', color: meta.color, selected: true }]);
    }
  };

  const setItem = (i: number, patch: Partial<CreatorStatItem>) =>
    write(stats.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const visible = stats.filter((s) => s.selected !== false);

  return (
    <FieldGroup title="达人数据">
      <div className="text-xs text-foreground-secondary">
        <div className="mb-1">筛选指标</div>
        <div className="grid grid-cols-2 gap-1">
          {CREATOR_METRIC_CATALOG.map((m) => (
            <label key={m.key} className="flex items-center gap-1">
              <input type="checkbox" checked={isEnabled(m.key)} onChange={() => toggle(m.key)} className="h-3 w-3" />
              <span>{m.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="text-xs text-foreground-secondary">
        <div className="mb-1">文案修改</div>
        {visible.length === 0 && <p className="text-foreground-muted">请先勾选要展示的指标。</p>}
        <div className="space-y-1">
          {visible.map((s) => {
            const idx = stats.indexOf(s);
            return (
              <div key={s.key ?? idx} className="flex items-center gap-1">
                <input
                  value={s.label}
                  onChange={(e) => setItem(idx, { label: e.target.value })}
                  className="w-16 rounded border border-border-default px-1 py-0.5"
                />
                <input
                  value={s.value}
                  placeholder={CREATOR_METRIC_CATALOG.find((m) => m.key === s.key)?.placeholder ?? ''}
                  onChange={(e) => setItem(idx, { value: e.target.value })}
                  className="w-16 rounded border border-border-default px-1 py-0.5"
                />
                <input
                  type="color"
                  value={s.color}
                  onChange={(e) => setItem(idx, { color: e.target.value })}
                  className="h-6 w-6 rounded border border-border-default"
                />
              </div>
            );
          })}
        </div>
      </div>
    </FieldGroup>
  );
}

/* ----------------------------- 图表数据导入 ----------------------------- */


export function KpiRowStyleField({ comp }: { comp: EditorComponent }) {
  const update = useDataUpdate(comp);
  const data = comp.data as KpiBoardData;
  const rows = data.rows ?? [];
  const icons = data.icons ?? [];
  const valueColors = data.valueColors ?? [];
  const weight: IconWeight = data.iconWeight ?? 'regular';
  const [pickingRow, setPickingRow] = useState<number | null>(null);

  function ensureLen<T>(arr: T[]): T[] {
    const next = [...arr];
    while (next.length < rows.length) next.push(null as unknown as T);
    return next;
  }
  function setIcon(i: number, key: string | null) {
    update('icons', withAt(ensureLen(icons), i, key));
  }
  function setColor(i: number, token: KpiColorToken | null) {
    update('valueColors', withAt(ensureLen(valueColors), i, token));
  }
  const directions = data.trendDirections ?? [];
  function setDirection(i: number, d: KpiTrendDirection | null) {
    update('trendDirections', withAt(ensureLen(directions), i, d));
  }

  return (
    <FieldGroup title="卡片样式（每行）">
      <div className="text-[11px] text-foreground-muted">图标仅在「卡片」变体下显示。</div>
      {rows.map((r, i) => {
        const iconKey = icons[i] ?? null;
        const Icon = findIcon(iconKey ?? undefined)?.Comp;
        const color = valueColors[i] ?? null;
        const direction: KpiTrendDirection = directions[i] ?? 'positive';
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="w-20 truncate text-[11px] text-foreground-secondary">{r[0] ?? `行${i + 1}`}</span>
            <button
              onClick={() => setPickingRow(i)}
              title={iconKey ? (findIcon(iconKey)?.label ?? '选图标') : '选图标'}
              className="flex h-7 w-7 items-center justify-center rounded border border-border-default hover:bg-surface-hover"
            >
              {Icon ? <Icon size={16} /> : <span className="text-[10px] text-foreground-muted">+</span>}
            </button>
            {iconKey && (
              <button
                onClick={() => setIcon(i, null)}
                className="text-[10px] text-foreground-muted hover:text-foreground-primary"
              >
                清除
              </button>
            )}
            <div className="ml-auto flex gap-1">
              {KPI_COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.token}
                  title={opt.label}
                  onClick={() => setColor(i, color === opt.token ? null : opt.token)}
                  className={`h-4 w-4 rounded-full border ${
                    color === opt.token ? 'border-foreground-primary' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: KPI_COLOR_TOKENS[opt.token].fg }}
                />
              ))}
            </div>
            <button
              title={
                direction === 'inverse'
                  ? '逆向指标：下降为好（CPA/CPC 等）— 点击切回正向'
                  : '正向指标：上升为好 — 点击切为逆向'
              }
              onClick={() => setDirection(i, direction === 'inverse' ? null : 'inverse')}
              className={`rounded border px-1.5 text-[10px] font-medium ${
                direction === 'inverse'
                  ? 'border-[#22C55E] text-[#22C55E]'
                  : 'border-border-default text-foreground-muted'
              }`}
            >
              {direction === 'inverse' ? '降好' : '升好'}
            </button>
          </div>
        );
      })}
      {pickingRow !== null && (
        <IconPickerOverlay
          value={icons[pickingRow] ?? undefined}
          weight={weight}
          onPick={(key) => {
            setIcon(pickingRow, key);
            setPickingRow(null);
          }}
          onClear={() => {
            setIcon(pickingRow, null);
            setPickingRow(null);
          }}
          onClose={() => setPickingRow(null)}
        />
      )}
    </FieldGroup>
  );
}

/**
 * kpi-board：指标行选择 + 文本编辑。
 * 每行提供 显示/隐藏 勾选框，以及 label/value/compare 三个文本输入；
 * 支持新增与删除行。隐藏的行不会在渲染层显示（见 ReportComponents KpiBoard 的 hiddenIndices 过滤）。
 */
export function KpiBoardFields({ comp }: { comp: EditorComponent }) {
  const update = useDataUpdate(comp);
  const data = comp.data as KpiBoardData;
  const rows = data.rows ?? [];
  const hidden = new Set(data.hiddenIndices ?? []);

  const setHidden = (next: number[]) => update('hiddenIndices', next.length ? next : undefined);
  const toggleHidden = (i: number) =>
    setHidden(hidden.has(i) ? [...hidden].filter((x) => x !== i) : [...hidden, i].sort((a, b) => a - b));

  const setRow = (i: number, col: number, value: string) => {
    const next = rows.map((r, idx) => (idx === i ? r.map((c, cidx) => (cidx === col ? value : c)) : r));
    update('rows', next);
  };

  const addRow = () => {
    const next = [...rows, ['', '', '']];
    update('rows', next);
  };

  const removeRow = (i: number) => {
    // 删除行后，把大于 i 的 hidden 索引整体下移，删掉等于 i 的。
    const nextHidden = [...hidden]
      .filter((x) => x !== i)
      .map((x) => (x > i ? x - 1 : x));
    const next = rows.filter((_, idx) => idx !== i);
    // 同步下移 icons/valueColors/trendDirections，保持对齐。
    const icons = data.icons ? data.icons.filter((_, idx) => idx !== i) : undefined;
    const valueColors = data.valueColors ? data.valueColors.filter((_, idx) => idx !== i) : undefined;
    const trendDirections = data.trendDirections ? data.trendDirections.filter((_, idx) => idx !== i) : undefined;
    useEditorStore.getState().updateComponent(comp.id, {
      data: {
        ...(comp.data as object),
        rows: next,
        hiddenIndices: nextHidden.length ? nextHidden : undefined,
        icons,
        valueColors,
        trendDirections,
      } as unknown as ComponentData,
    });
    useEditorStore.getState().commit();
  };

  return (
    <FieldGroup title="KPI 指标">
      <div className="space-y-2">
        {rows.map((r, i) => {
          const isHidden = hidden.has(i);
          return (
            <div
              key={i}
              className={`rounded border border-border-default p-1.5 ${isHidden ? 'opacity-50' : ''}`}
            >
              <div className="mb-1 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!isHidden}
                  onChange={() => toggleHidden(i)}
                  className="h-3 w-3"
                  title={isHidden ? '显示该指标' : '隐藏该指标'}
                />
                <span className="text-[11px] text-foreground-muted">指标 {i + 1}</span>
                <button
                  onClick={() => removeRow(i)}
                  className="ml-auto text-[10px] text-foreground-muted hover:text-foreground-danger"
                >
                  删除
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <input
                  value={r[0] ?? ''}
                  placeholder="指标"
                  onChange={(e) => setRow(i, 0, e.target.value)}
                  className="rounded border border-border-default bg-surface-primary px-1 py-0.5 text-[11px] text-foreground-primary outline-none focus:border-foreground-primary"
                />
                <input
                  value={r[1] ?? ''}
                  placeholder="数值"
                  onChange={(e) => setRow(i, 1, e.target.value)}
                  className="rounded border border-border-default bg-surface-primary px-1 py-0.5 text-[11px] text-foreground-primary outline-none focus:border-foreground-primary"
                />
                <input
                  value={r[2] ?? ''}
                  placeholder="对比"
                  onChange={(e) => setRow(i, 2, e.target.value)}
                  className="rounded border border-border-default bg-surface-primary px-1 py-0.5 text-[11px] text-foreground-primary outline-none focus:border-foreground-primary"
                />
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <p className="text-[11px] text-foreground-muted">暂无指标，点击下方添加。</p>}
      </div>
      <button
        onClick={addRow}
        className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
      >
        + 添加指标
      </button>
    </FieldGroup>
  );
}

/* --------------------------- 业绩·商品 自定义字段 ---------------------------- */

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
      <FieldGroup title="Screenshots">
        <div className="space-y-2">
          {images.map((im, i) => (
            <div key={i} className="space-y-1 rounded border border-border-subtle p-1.5">
              <ImageInput value={im.src} onChange={(url) => setItem(i, { src: url })} />
              <div className="flex items-center gap-1">
                <input
                  value={im.caption ?? ''}
                  placeholder="Caption"
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
          + Add image
        </button>
      </FieldGroup>
    </>
  );
}

export function StrategyBlockFields({ comp }: { comp: EditorComponent }) {
  const update = useDataUpdate(comp);
  const data = comp.data as StrategyBlockData;
  const rows = data.rows ?? [];

  const setRow = (i: number, next: string[]) => {
    update('rows', rows.map((r, idx) => (idx === i ? next : r)));
  };
  const addRow = () => update('rows', [...rows, ['', '', '']]);
  const removeRow = (i: number) => update('rows', rows.filter((_, idx) => idx !== i));

  return (
    <FieldGroup title="策略块">
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="space-y-1 rounded border border-border-subtle p-1">
            <div className="flex items-center gap-1">
              <TableCellIconPicker
                value={row[0] ?? ''}
                onChange={(key) => setRow(i, [key, row[1] ?? '', row[2] ?? ''])}
              />
              <input
                value={row[1] ?? ''}
                onChange={(e) => setRow(i, [row[0] ?? '', e.target.value, row[2] ?? ''])}
                placeholder="标题"
                className="flex-1 rounded border border-border-default px-1 py-0.5 text-xs"
              />
              <button
                onClick={() => removeRow(i)}
                title="删除该项"
                className="text-foreground-muted hover:text-red"
              >
                ✕
              </button>
            </div>
            <RichTextField
              value={row[2] ?? ''}
              onChange={(html) => setRow(i, [row[0] ?? '', row[1] ?? '', html])}
            />
          </div>
        ))}
      </div>
      <button onClick={addRow} className="mt-1 text-xs text-accent-primary hover:underline">
        + 添加项
      </button>
    </FieldGroup>
  );
}


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


export function WorkMetricsFields({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const data = comp.data as WorkMetricsData;
  const metrics = data.metrics ?? [];

  const write = (next: WorkMetricsData['metrics']) => {
    updateComponentData(comp.id, { metrics: next } as Partial<WorkMetricsData>);
    commit();
  };
  const setItem = (i: number, patch: Partial<{ label: string; value: string; color: string }>) =>
    write(metrics.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  const add = () => write([...metrics, { label: '新指标', value: '--', color: '#FF5C00' }]);
  const remove = (i: number) => write(metrics.filter((_, idx) => idx !== i));

  return (
    <FieldGroup title="作品指标">
      <div className="space-y-1">
        {metrics.map((m, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              value={m.label}
              placeholder="指标"
              onChange={(e) => setItem(i, { label: e.target.value })}
              className="w-16 rounded border border-border-default px-1.5 py-0.5 text-xs text-foreground-primary"
            />
            <input
              value={m.value}
              placeholder="数值"
              onChange={(e) => setItem(i, { value: e.target.value })}
              className="w-16 rounded border border-border-default px-1.5 py-0.5 text-xs text-foreground-primary"
            />
            <input
              type="color"
              value={m.color ?? '#FF5C00'}
              onChange={(e) => setItem(i, { color: e.target.value })}
              className="h-6 w-6 rounded border border-border-default"
            />
            <button onClick={() => remove(i)} className="text-foreground-muted hover:text-red">
              ✕
            </button>
          </div>
        ))}
      </div>
      <button onClick={add} className="text-xs text-accent-primary hover:underline">
        + 添加指标
      </button>
    </FieldGroup>
  );
}

export const WORDCLOUD_SENTIMENT_OPTIONS: { value: Sentiment; label: string }[] = [
  { value: 'pos', label: '正面' },
  { value: 'neg', label: '负面' },
  { value: 'neutral', label: '中性' },
];

/** 评论词云：每个词 text + weight + 情感 + 删除，底部添加。 */
export function CommentWordcloudFields({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const data = comp.data as CommentWordcloudData;
  const words = data.words ?? [];

  const write = (next: CommentWordcloudData['words']) => {
    updateComponentData(comp.id, { words: next } as Partial<CommentWordcloudData>);
    commit();
  };
  const setItem = (i: number, patch: Partial<{ text: string; weight: number; sentiment: Sentiment }>) =>
    write(words.map((w, idx) => (idx === i ? { ...w, ...patch } : w)));
  const add = () => write([...words, { text: '新词', weight: 50, sentiment: 'neutral' }]);
  const remove = (i: number) => write(words.filter((_, idx) => idx !== i));

  return (
    <FieldGroup title="评论词">
      <div className="space-y-1">
        {words.map((w, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              value={w.text}
              placeholder="词"
              onChange={(e) => setItem(i, { text: e.target.value })}
              className="w-16 rounded border border-border-default px-1.5 py-0.5 text-xs text-foreground-primary"
            />
            <input
              type="number"
              value={w.weight}
              onChange={(e) => setItem(i, { weight: Number(e.target.value) })}
              className="w-12 rounded border border-border-default px-1 py-0.5 text-xs text-foreground-primary"
            />
            <select
              value={w.sentiment}
              onChange={(e) => setItem(i, { sentiment: e.target.value as Sentiment })}
              className="rounded border border-border-default px-1 py-0.5 text-xs text-foreground-primary"
            >
              {WORDCLOUD_SENTIMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button onClick={() => remove(i)} className="text-foreground-muted hover:text-red">
              ✕
            </button>
          </div>
        ))}
      </div>
      <button onClick={add} className="text-xs text-accent-primary hover:underline">
        + 添加词
      </button>
    </FieldGroup>
  );
}


export function ShapeFields({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const data = comp.data as ShapeData;
  const isLine = data.shape === 'line';

  function setShape(shape: ShapeKind) {
    const next: ShapeData = { ...data, shape };
    if (shape === 'line') {
      next.strokeWidth = next.strokeWidth || 1;
      next.dash = next.dash ?? false;
      delete (next as { fill?: string }).fill;
    }
    if (shape === 'rounded' && next.borderRadius == null) next.borderRadius = 12;
    updateComponentData(comp.id, next as unknown as Record<string, unknown>);
  }
  const set = (patch: Partial<ShapeData>) =>
    updateComponentData(comp.id, patch as unknown as Record<string, unknown>);

  return (
    <FieldGroup title="图形">
      <div className="flex flex-wrap gap-1">
        {SHAPE_OPTIONS.map((o) => (
          <button
            key={o.id}
            onClick={() => setShape(o.id)}
            className={`rounded border px-2 py-1 text-xs ${
              data.shape === o.id
                ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                : 'border-border-default text-foreground-secondary hover:bg-surface-hover'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {!isLine && (
        <label className="block text-xs text-foreground-secondary">
          <span className="mb-1 block">填充色</span>
          <input type="color" value={data.fill ?? '#ffffff'} onChange={(e) => set({ fill: e.target.value })} className="h-8 w-full rounded border border-border-default p-1" />
        </label>
      )}

      <label className="block text-xs text-foreground-secondary">
        <span className="mb-1 block">描边色</span>
        <input type="color" value={data.stroke ?? '#E5E7EB'} onChange={(e) => set({ stroke: e.target.value })} className="h-8 w-full rounded border border-border-default p-1" />
      </label>

      <label className="block text-xs text-foreground-secondary">
        <span className="mb-1 block">描边粗细</span>
        <input type="number" min={0} value={data.strokeWidth ?? 0} onChange={(e) => set({ strokeWidth: Number(e.target.value) })} className="w-full rounded border border-border-default px-2 py-1" />
      </label>

      <label className="block text-xs text-foreground-secondary">
        <span className="mb-1 block">透明度（0–1）</span>
        <input type="number" min={0} max={1} step={0.1} value={data.opacity ?? 1} onChange={(e) => set({ opacity: Number(e.target.value) })} className="w-full rounded border border-border-default px-2 py-1" />
      </label>

      <label className="block text-xs text-foreground-secondary">
        <span className="mb-1 block">旋转（度）</span>
        <input type="number" value={data.rotation ?? 0} onChange={(e) => set({ rotation: Number(e.target.value) })} className="w-full rounded border border-border-default px-2 py-1" />
      </label>

      {data.shape === 'rounded' && (
        <label className="block text-xs text-foreground-secondary">
          <span className="mb-1 block">圆角半径</span>
          <input type="number" min={0} value={data.borderRadius ?? 12} onChange={(e) => set({ borderRadius: Number(e.target.value) })} className="w-full rounded border border-border-default px-2 py-1" />
        </label>
      )}

      {isLine && (
        <label className="flex items-center gap-2 text-xs text-foreground-secondary">
          <input type="checkbox" checked={data.dash ?? false} onChange={(e) => set({ dash: e.target.checked })} />
          虚线
        </label>
      )}
    </FieldGroup>
  );
}
