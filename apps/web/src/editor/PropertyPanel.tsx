import { useEffect, useRef, useState } from 'react';
import type {
  CreatorAvatarCardData,
  EditorComponent,
  ComponentData,
  CreatorStatItem,
  CreatorStatsStripData,
} from '@mediakit/shared';
import { CREATOR_METRIC_CATALOG } from '@mediakit/shared';
import { useEditorStore } from './store';
import { GEOMETRY_FIELDS, REGISTRY, type PropertyField, type VariantOption } from './registry';
import type { Alignment } from './store';
import { getStyleOptions, type VariantId } from './business/catalog';
import { Button } from '@/components/Button';
import { ImageInput } from '@/components/ImageInput';
import { parseCreatorLink } from './creatorLink';
import { ImportDataModal } from './components/ImportDataModal';
import type { ChartData } from './datasource/resolve';

/** 读取组件某字段值（data 字段 vs 几何字段）。 */
function readValue(comp: EditorComponent, field: PropertyField): unknown {
  if (field.inData === false) {
    return (comp as unknown as Record<string, unknown>)[field.key];
  }
  return (comp.data as unknown as Record<string, unknown>)[field.key];
}

export function PropertyPanel() {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const comp = useEditorStore((s) => {
    if (selectedIds.length !== 1) return null;
    return s.currentComponents().find((c) => c.id === selectedIds[0]) ?? null;
  });

  if (selectedIds.length > 1) {
    return <MultiSelectPanel ids={selectedIds} />;
  }

  if (!comp) {
    return <PageProperties />;
  }

  const def = REGISTRY[comp.type];
  return (
    <div className="flex h-full w-[300px] flex-col gap-4 overflow-auto border-l border-border-default bg-surface-primary p-4">
      <div className="font-headings text-sm font-semibold text-foreground-primary">
        {LABELS[comp.type] ?? comp.type}
      </div>

      {(comp.type === 'bar-chart' ||
        comp.type === 'line-chart' ||
        comp.type === 'pie-chart') && <ChartImportButton comp={comp} />}

      {comp.type === 'creator-avatar-card' && <CreatorLinkImporter comp={comp} />}

      <FieldGroup title="位置与尺寸">
        <div className="grid grid-cols-2 gap-2">
          {GEOMETRY_FIELDS.map((f) => (
            <NumberField key={f.key} comp={comp} field={f} />
          ))}
        </div>
      </FieldGroup>

      <FieldGroup title="属性">
        {def.variants && def.variants.length > 0 && (
          <VariantSelector comp={comp} variants={def.variants} />
        )}
        {def.propertySchema.map((f) => (
          <FieldEditor key={f.key + f.kind} comp={comp} field={f} />
        ))}
        {def.propertySchema.length === 0 && (def.variants?.length ?? 0) === 0 && (
          <p className="text-xs text-foreground-muted">该组件无可编辑属性。</p>
        )}
      </FieldGroup>

      {comp.type === 'business-block' && <BusinessFields comp={comp} />}

      {comp.type === 'creator-stats-strip' && <CreatorStatsFields comp={comp} />}

      <div className="mt-auto border-t border-border-subtle pt-3">
        <Button
          variant="danger"
          className="w-full"
          onClick={() => {
            useEditorStore.getState().select(comp.id);
            useEditorStore.getState().deleteSelected();
          }}
        >
          删除组件
        </Button>
      </div>
    </div>
  );
}

const LABELS: Record<string, string> = {
  text: '文本',
  image: '图片',
  'indicator-card': '指标卡',
  'bar-chart': '柱状图',
  'line-chart': '折线图',
  'pie-chart': '饼图',
  table: '表格',
  'business-block': '业务组件',
  'creator-avatar-card': '达人头像卡',
  'creator-stats-strip': '达人数据条',
  'creator-works-list': '达人作品列表',
  'brand-wall': '品牌墙',
  'package-card': '套餐卡',
  'kpi-board': '业绩看板',
  'timeline-compare': '周期对比表',
  'product-performance': '商品表现',
  'placement-display': '广告位展示',
  'post-list': 'Post 列表',
};

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground-muted">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

/* ------------------------------ 页面属性 ------------------------------ */
// 未选中组件时展示：页面名 + 背景色/图（页面维度编辑）。

function PageProperties() {
  const page = useEditorStore((s) => s.currentPage());
  const updatePage = useEditorStore((s) => s.updatePage);
  if (!page) {
    return (
      <div className="flex h-full w-[300px] items-center justify-center border-l border-border-default bg-surface-primary p-4 text-center text-sm text-foreground-muted">
        选中组件以编辑属性
      </div>
    );
  }
  const set = (patch: Partial<{ name: string; bgColor: string; bgImage: string }>) =>
    updatePage(page.id, patch);

  return (
    <div className="flex h-full w-[300px] flex-col gap-4 overflow-auto border-l border-border-default bg-surface-primary p-4">
      <div className="font-headings text-sm font-semibold text-foreground-primary">页面属性</div>

      <FieldGroup title="页面名">
        <input
          value={page.name}
          onChange={(e) => set({ name: e.target.value })}
          className="w-full rounded border border-border-default px-2 py-1 text-sm text-foreground-primary"
        />
      </FieldGroup>

      <FieldGroup title="背景色">
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={page.bgColor ?? '#ffffff'}
            onChange={(e) => set({ bgColor: e.target.value })}
            className="h-8 w-10 rounded border border-border-default p-1"
          />
          <input
            value={page.bgColor ?? ''}
            placeholder="#FFFFFF（留空=白）"
            onChange={(e) => set({ bgColor: e.target.value || undefined })}
            className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-primary"
          />
        </div>
      </FieldGroup>

      <FieldGroup title="背景图 URL">
        <ImageInput value={page.bgImage ?? ''} onChange={(url) => set({ bgImage: url || undefined })} />
        {(page.bgColor || page.bgImage) && (
          <button
            onClick={() => set({ bgColor: undefined, bgImage: undefined })}
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

/* --------------------------- 通用样式变体 ---------------------------- */

/** 通用变体 chip 选择器：任何 BlockDef 声明了 variants 的组件都生效，写入 data.variant。 */
function VariantSelector({ comp, variants }: { comp: EditorComponent; variants: VariantOption[] }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const current = (comp.data as { variant?: string }).variant ?? variants[0]?.id ?? '';
  return (
    <div className="flex flex-wrap gap-1">
      {variants.map((v) => (
        <button
          key={v.id}
          onClick={() => updateComponentData(comp.id, { variant: v.id })}
          className={`rounded border px-2 py-1 text-xs ${
            current === v.id
              ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
              : 'border-border-default text-foreground-secondary hover:bg-surface-hover'
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

/* --------------------------- 达人链接解析 ---------------------------- */

/** 达人头像卡：粘贴达人链接 → 自动解析填充 handle/粉丝/获赞/互动等字段。 */
function CreatorLinkImporter({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const data = comp.data as CreatorAvatarCardData;
  const [url, setUrl] = useState(data.sourceUrl ?? '');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    setUrl(data.sourceUrl ?? '');
  }, [data.sourceUrl]);

  const onParse = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setStatus('error');
      setError('请粘贴达人链接');
      return;
    }
    setStatus('loading');
    setError('');
    try {
      const parsed = await parseCreatorLink(trimmed);
      updateComponentData(comp.id, parsed);
      commit();
      setStatus('idle');
    } catch {
      setStatus('error');
      setError('暂仅支持 TikTok / Instagram / YouTube / 微博 链接');
    }
  };

  return (
    <FieldGroup title="达人链接解析">
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="粘贴达人主页/视频链接…"
        className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-primary"
      />
      <button
        onClick={onParse}
        disabled={status === 'loading'}
        className="mt-1 rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover disabled:opacity-50"
      >
        {status === 'loading' ? '解析中…' : '解析'}
      </button>
      {status === 'error' && <div className="mt-1 text-xs text-red">{error}</div>}
    </FieldGroup>
  );
}

/* --------------------------- 业务组件字段 ---------------------------- */

function BusinessFields({ comp }: { comp: EditorComponent }) {
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

const ALIGN_BUTTONS: { label: string; alignment: Alignment }[] = [
  { label: '左对齐', alignment: 'left' },
  { label: '水平居中', alignment: 'center-h' },
  { label: '右对齐', alignment: 'right' },
  { label: '顶对齐', alignment: 'top' },
  { label: '垂直居中', alignment: 'middle-v' },
  { label: '底对齐', alignment: 'bottom' },
];

function MultiSelectPanel({ ids }: { ids: string[] }) {
  const align = useEditorStore((s) => s.alignComponents);
  const distributeH = useEditorStore((s) => s.distributeH);
  const distributeV = useEditorStore((s) => s.distributeV);
  const equalWidth = useEditorStore((s) => s.equalWidth);
  const equalHeight = useEditorStore((s) => s.equalHeight);
  const deleteSelected = useEditorStore((s) => s.deleteSelected);

  return (
    <div className="flex h-full w-[300px] flex-col gap-4 overflow-auto border-l border-border-default bg-surface-primary p-4">
      <div className="font-headings text-sm font-semibold text-foreground-primary">
        已选中 {ids.length} 个组件
      </div>

      <FieldGroup title="对齐">
        <div className="grid grid-cols-3 gap-1">
          {ALIGN_BUTTONS.map((b) => (
            <button
              key={b.alignment}
              onClick={() => align(ids, b.alignment)}
              className="rounded border border-border-default px-1 py-1.5 text-xs text-foreground-secondary hover:bg-surface-hover"
            >
              {b.label}
            </button>
          ))}
        </div>
      </FieldGroup>

      <FieldGroup title="分布">
        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={() => distributeH(ids)}
            className="rounded border border-border-default px-1 py-1.5 text-xs text-foreground-secondary hover:bg-surface-hover"
          >
            水平分布
          </button>
          <button
            onClick={() => distributeV(ids)}
            className="rounded border border-border-default px-1 py-1.5 text-xs text-foreground-secondary hover:bg-surface-hover"
          >
            垂直分布
          </button>
        </div>
      </FieldGroup>

      <FieldGroup title="等尺寸">
        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={() => equalWidth(ids)}
            className="rounded border border-border-default px-1 py-1.5 text-xs text-foreground-secondary hover:bg-surface-hover"
          >
            等宽
          </button>
          <button
            onClick={() => equalHeight(ids)}
            className="rounded border border-border-default px-1 py-1.5 text-xs text-foreground-secondary hover:bg-surface-hover"
          >
            等高
          </button>
        </div>
      </FieldGroup>

      <div className="mt-auto border-t border-border-subtle pt-3">
        <Button variant="danger" className="w-full" onClick={() => deleteSelected()}>
          删除选中
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------- 字段编辑器 ------------------------------- */

/** 数值字段（几何 + 字号等）。onChange 实时更新不进 history，onBlur commit。 */
function NumberField({ comp, field }: { comp: EditorComponent; field: PropertyField }) {
  const updateComponent = useEditorStore((s) => s.updateComponent);
  const commit = useEditorStore((s) => s.commit);
  const value = readValue(comp, field) as number;
  const [v, setV] = useState(String(value ?? 0));

  useEffect(() => setV(String(value ?? 0)), [value]);

  return (
    <label className="flex items-center gap-1 text-xs text-foreground-secondary">
      <span className="w-4">{field.label}</span>
      <input
        type="number"
        value={v}
        onChange={(e) => {
          setV(e.target.value);
          if (field.inData === false) {
            updateComponent(comp.id, { [field.key]: Number(e.target.value) } as Partial<EditorComponent>);
          }
        }}
        onBlur={() => commit()}
        className="w-full rounded border border-border-default px-1.5 py-1 text-foreground-primary"
      />
    </label>
  );
}

export function FieldEditor({ comp, field }: { comp: EditorComponent; field: PropertyField }) {
  switch (field.kind) {
    case 'text':
    case 'color':
      return <TextField comp={comp} field={field} type={field.kind === 'color' ? 'color' : 'text'} />;
    case 'image-url':
      return <ImageUrlField comp={comp} field={field} />;
    case 'textarea':
      return <TextareaField comp={comp} field={field} />;
    case 'number':
      return <DataNumberField comp={comp} field={field} />;
    case 'select':
      return <SelectField comp={comp} field={field} />;
    case 'list':
      return <ListField comp={comp} field={field} />;
    case 'table':
      return <TableField comp={comp} />;
    default:
      return null;
  }
}

function useDataUpdate(comp: EditorComponent) {
  const updateComponent = useEditorStore((s) => s.updateComponent);
  const commit = useEditorStore((s) => s.commit);
  return (key: string, value: unknown) => {
    updateComponent(comp.id, {
      data: { ...(comp.data as object), [key]: value } as unknown as ComponentData,
    });
    commit();
  };
}

function TextField({ comp, field, type }: { comp: EditorComponent; field: PropertyField; type: 'text' | 'color' }) {
  const update = useDataUpdate(comp);
  const value = (readValue(comp, field) as string) ?? '';
  return (
    <label className="block text-xs text-foreground-secondary">
      <span className="mb-1 block">{field.label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => update(field.key, e.target.value)}
        className={`w-full rounded border border-border-default px-2 py-1 text-foreground-primary ${
          type === 'color' ? 'h-8 p-1' : ''
        }`}
      />
    </label>
  );
}

/** 图片 URL 字段：文本 + 上传(裁剪)，复用 ImageInput。 */
function ImageUrlField({ comp, field }: { comp: EditorComponent; field: PropertyField }) {
  const update = useDataUpdate(comp);
  const value = (readValue(comp, field) as string) ?? '';
  return (
    <div className="text-xs text-foreground-secondary">
      <div className="mb-1">{field.label}</div>
      <ImageInput value={value} onChange={(url) => update(field.key, url)} />
    </div>
  );
}

function TextareaField({ comp, field }: { comp: EditorComponent; field: PropertyField }) {
  const update = useDataUpdate(comp);
  const value = (readValue(comp, field) as string) ?? '';
  return (
    <label className="block text-xs text-foreground-secondary">
      <span className="mb-1 block">{field.label}</span>
      <textarea
        value={value}
        onChange={(e) => update(field.key, e.target.value)}
        rows={3}
        className="w-full resize-y rounded border border-border-default px-2 py-1 text-foreground-primary"
      />
    </label>
  );
}

function DataNumberField({ comp, field }: { comp: EditorComponent; field: PropertyField }) {
  const update = useDataUpdate(comp);
  const value = Number(readValue(comp, field) ?? 0);
  return (
    <label className="block text-xs text-foreground-secondary">
      <span className="mb-1 block">{field.label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => update(field.key, Number(e.target.value))}
        className="w-full rounded border border-border-default px-2 py-1 text-foreground-primary"
      />
    </label>
  );
}

function SelectField({ comp, field }: { comp: EditorComponent; field: PropertyField }) {
  const update = useDataUpdate(comp);
  const value = String(readValue(comp, field) ?? '');
  return (
    <label className="block text-xs text-foreground-secondary">
      <span className="mb-1 block">{field.label}</span>
      <select
        value={value}
        onChange={(e) => {
          // trendUp 存布尔；其余存原值。
          const raw = readValue(comp, field);
          const v = typeof raw === 'boolean' ? e.target.value === 'true' : e.target.value;
          update(field.key, v);
        }}
        className="w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-foreground-primary"
      >
        {field.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** {label,value,color}[] 列表编辑器（柱状图 bars / 饼图 slices）。 */
function ListField({ comp, field }: { comp: EditorComponent; field: PropertyField }) {
  const update = useDataUpdate(comp);
  const items = (readValue(comp, field) as { label: string; value: number; color: string }[]) ?? [];
  const key = field.key;

  const setItem = (i: number, patch: Partial<{ label: string; value: number; color: string }>) => {
    const next = items.map((it, idx) => (idx === i ? { ...it, ...patch } : it));
    update(key, next);
  };
  const add = () => update(key, [...items, { label: '新', value: 50, color: '#FF5C00' }]);
  const remove = (i: number) => update(key, items.filter((_, idx) => idx !== i));

  return (
    <div className="text-xs text-foreground-secondary">
      <div className="mb-1">{field.label}</div>
      <div className="space-y-1">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              value={it.label}
              onChange={(e) => setItem(i, { label: e.target.value })}
              className="w-16 rounded border border-border-default px-1 py-0.5"
            />
            <input
              type="number"
              value={it.value}
              onChange={(e) => setItem(i, { value: Number(e.target.value) })}
              className="w-14 rounded border border-border-default px-1 py-0.5"
            />
            <input
              type="color"
              value={it.color}
              onChange={(e) => setItem(i, { color: e.target.value })}
              className="h-6 w-6 rounded border border-border-default"
            />
            <button onClick={() => remove(i)} className="text-foreground-muted hover:text-red">
              ✕
            </button>
          </div>
        ))}
      </div>
      <button onClick={add} className="mt-1 text-accent-primary hover:underline">
        + 添加
      </button>
    </div>
  );
}

/** 表格编辑器：表头 + 行。 */
function TableField({ comp }: { comp: EditorComponent }) {
  const update = useDataUpdate(comp);
  const data = comp.data as { headers: string[]; rows: string[][] };
  const headers = data.headers;
  const rows = data.rows;

  const setHeader = (i: number, v: string) => {
    const headers2 = headers.map((h, idx) => (idx === i ? v : h));
    update('headers', headers2);
  };
  const setCell = (r: number, c: number, v: string) => {
    const rows2 = rows.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? v : cell)) : row));
    update('rows', rows2);
  };
  const addRow = () => update('rows', [...rows, headers.map(() => '--')]);
  const addCol = () => {
    update('headers', [...headers, `列${headers.length + 1}`]);
    update('rows', rows.map((r) => [...r, '--']));
  };

  return (
    <div className="text-xs text-foreground-secondary">
      <div className="mb-1">表格内容</div>
      <div className="space-y-1">
        <div className="flex gap-1">
          {headers.map((h, i) => (
            <input
              key={i}
              value={h}
              onChange={(e) => setHeader(i, e.target.value)}
              className="w-16 rounded border border-border-default px-1 py-0.5"
            />
          ))}
        </div>
        {rows.map((row, ri) => (
          <div key={ri} className="flex gap-1">
            {row.map((cell, ci) => (
              <input
                key={ci}
                value={cell}
                onChange={(e) => setCell(ri, ci, e.target.value)}
                className="w-16 rounded border border-border-default px-1 py-0.5"
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-3">
        <button onClick={addRow} className="text-accent-primary hover:underline">
          + 行
        </button>
        <button onClick={addCol} className="text-accent-primary hover:underline">
          + 列
        </button>
      </div>
    </div>
  );
}

/* --------------------------- 达人数据条字段 ---------------------------- */

/** 达人数据条：指标库勾选筛选 + 已选指标文案编辑。 */
function CreatorStatsFields({ comp }: { comp: EditorComponent }) {
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

/** 柱/折/饼图：导入 Excel/CSV → 映射列 → 写入 comp.data。 */
function ChartImportButton({ comp }: { comp: EditorComponent }) {
  const setComponentData = useEditorStore((s) => s.setComponentData);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const chartType = comp.type as 'bar-chart' | 'line-chart' | 'pie-chart';
  const prevTitle = (comp.data as { title?: string }).title;

  return (
    <FieldGroup title="数据导入">
      <button
        onClick={() => fileRef.current?.click()}
        className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
      >
        导入 Excel/CSV
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setFile(f);
          if (fileRef.current) fileRef.current.value = '';
        }}
      />
      {file && (
        <ImportDataModal
          file={file}
          chartType={chartType}
          prevTitle={prevTitle}
          onConfirm={(data: ChartData) => {
            setComponentData(comp.id, data);
            setFile(null);
          }}
          onCancel={() => setFile(null)}
        />
      )}
    </FieldGroup>
  );
}
