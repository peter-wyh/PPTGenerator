import { useEffect, useState } from 'react';
import type { EditorComponent, ComponentData } from '@mediakit/shared';
import { useEditorStore } from './store';
import { GEOMETRY_FIELDS, REGISTRY, type PropertyField } from './registry';
import { Button } from '@/components/Button';

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

  if (!comp) {
    return (
      <div className="flex h-full w-[300px] items-center justify-center border-l border-border-default bg-surface-primary p-4 text-center text-sm text-foreground-muted">
        {selectedIds.length === 0 ? '选中组件以编辑属性' : `已选中 ${selectedIds.length} 个组件`}
      </div>
    );
  }

  const def = REGISTRY[comp.type];
  return (
    <div className="flex h-full w-[300px] flex-col gap-4 overflow-auto border-l border-border-default bg-surface-primary p-4">
      <div className="font-headings text-sm font-semibold text-foreground-primary">
        {LABELS[comp.type] ?? comp.type}
      </div>

      <FieldGroup title="位置与尺寸">
        <div className="grid grid-cols-2 gap-2">
          {GEOMETRY_FIELDS.map((f) => (
            <NumberField key={f.key} comp={comp} field={f} />
          ))}
        </div>
      </FieldGroup>

      <FieldGroup title="属性">
        {def.propertySchema.map((f) => (
          <FieldEditor key={f.key + f.kind} comp={comp} field={f} />
        ))}
        {def.propertySchema.length === 0 && (
          <p className="text-xs text-foreground-muted">该组件无可编辑属性。</p>
        )}
      </FieldGroup>

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
};

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground-muted">{title}</div>
      <div className="space-y-2">{children}</div>
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
