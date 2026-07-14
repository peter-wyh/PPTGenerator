import { useEffect, useRef, useState } from 'react';
import type { EditorComponent, KpiBoardData, IconWeight } from '@mediakit/shared';
import { Highlighter } from '@phosphor-icons/react';
import { useEditorStore } from '../store';
import type { PropertyField } from '../registry';
import { REGISTRY } from '../registry';
import { IconPickerOverlay, ICON_WEIGHT_OPTIONS } from '../icons/IconPickerOverlay';
import { findIcon } from '../icons/catalog';
import { IconKit } from '../icons/IconKit';
import { sanitizeRichText } from '../richText';
import { ImageInput } from '@/components/ImageInput';
import { useDataUpdate, readValue, FieldGroup } from './helpers';

export function NumberField({ comp, field }: { comp: EditorComponent; field: PropertyField }) {
  const updateComponent = useEditorStore((s) => s.updateComponent);
  const sanitizeComponent = useEditorStore((s) => s.sanitizeComponent);
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
        onBlur={() => {
          if (field.inData === false) sanitizeComponent(comp.id); // 几何字段失焦夹进安全区
          commit();
        }}
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
    case 'icon':
      return <IconPickerField comp={comp} />;
    default:
      return null;
  }
}

export function TextField({ comp, field, type }: { comp: EditorComponent; field: PropertyField; type: 'text' | 'color' }) {
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


export function ImageUrlField({ comp, field }: { comp: EditorComponent; field: PropertyField }) {
  const update = useDataUpdate(comp);
  const value = (readValue(comp, field) as string) ?? '';
  return (
    <div className="text-xs text-foreground-secondary">
      <div className="mb-1">{field.label}</div>
      <ImageInput value={value} onChange={(url) => update(field.key, url)} />
    </div>
  );
}


export function IconPickerField({ comp }: { comp: EditorComponent }) {
  const update = useDataUpdate(comp);
  const data = comp.data as { icon?: string; iconWeight?: IconWeight };
  const def = REGISTRY[comp.type];
  const currentVariantId = (comp.data as { variant?: string }).variant ?? def.variants?.[0]?.id;
  const variantDef = def.variants?.find((v) => v.id === currentVariantId);
  const variantIconCfg = variantDef?.icon;

  // 回退顺序：data.iconWeight → variant.defaultWeight → 'regular'
  const weight: IconWeight = data.iconWeight ?? variantIconCfg?.defaultWeight ?? 'regular';
  // 显示的图标：data.icon → variant.defaultKey
  const effectiveKey = data.icon ?? variantIconCfg?.defaultKey;
  const [open, setOpen] = useState(false);

  return (
    <div className="block text-xs text-foreground-secondary">
      <div className="mb-1">图标</div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-default text-foreground-primary hover:bg-surface-hover"
          title="选择图标"
        >
          <IconKit name={effectiveKey} weight={weight} size={20} />
        </button>
        <button
          onClick={() => setOpen(true)}
          className="rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
        >
          选择
        </button>
        {data.icon && (
          <button
            onClick={() => update('icon', undefined)}
            className="rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
          >
            清除
          </button>
        )}
        <select
          value={weight}
          onChange={(e) => update('iconWeight', e.target.value)}
          className="ml-auto rounded border border-border-default px-1 py-1 text-xs text-foreground-primary"
          title="图标风格"
        >
          {ICON_WEIGHT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      {open && (
        <IconPickerOverlay
          value={data.icon}
          weight={weight}
          onPick={(key) => {
            update('icon', key);
            setOpen(false);
          }}
          onClear={() => {
            update('icon', undefined);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

export function TextareaField({ comp, field }: { comp: EditorComponent; field: PropertyField }) {
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

/**
 * 轻量富文本字段：toolbar（加粗/斜体/列表/高亮）+ contentEditable。
 * 不受控：挂载/外部 value 变更时以 sanitize 后的 HTML 初始化（仅未聚焦时写回）；onInput/onBlur 清洗写回。
 * 高亮：选中文字点「高亮」→ 包 <mark>（持久化进 HTML，渲染由全局 mark 样式染色）；
 *   选区完全覆盖已有 <mark> 再点 → 解包（toggle）。需先选中文本（折叠选区为 no-op）。
 * contentEditable / execCommand / 选区操作在 jsdom 不可用，编辑交互不单测。
 */
export function RichTextField({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // 同步外部 value → contentEditable：仅在未聚焦时写入，避免覆盖正在编辑的光标。
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return; // 聚焦中：不干预编辑。
    const html = sanitizeRichText(value);
    if (el.innerHTML !== html) el.innerHTML = html;
  }, [value]);

  const exec = (cmd: string) => {
    document.execCommand(cmd);
    ref.current?.focus();
  };

  const commit = () => {
    if (!ref.current) return;
    const next = sanitizeRichText(ref.current.innerHTML);
    if (next !== sanitizeRichText(value)) onChange(next);
  };

  // 高亮 toggle：选中文字 → 包 <mark>；选区完全覆盖已有 <mark> → 解包。
  const toggleHighlight = () => {
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return;

    // 收集被选区完全包含的 <mark>；有则全部解包（toggle off）。
    const fullyContained = Array.from(el.querySelectorAll('mark')).filter((m) => {
      const r = document.createRange();
      r.selectNodeContents(m);
      const startOk = range.compareBoundaryPoints(Range.START_TO_START, r) <= 0;
      const endOk = range.compareBoundaryPoints(Range.END_TO_END, r) >= 0;
      return startOk && endOk;
    });
    if (fullyContained.length > 0) {
      for (const m of fullyContained) {
        const parent = m.parentNode;
        if (!parent) continue;
        while (m.firstChild) parent.insertBefore(m.firstChild, m);
        parent.removeChild(m);
      }
    } else {
      const mark = document.createElement('mark');
      try {
        range.surroundContents(mark);
      } catch {
        // 跨节点边界 → extractContents 包进 <mark> 再插回。
        const frag = range.extractContents();
        mark.appendChild(frag);
        range.insertNode(mark);
      }
    }
    sel.removeAllRanges();
    commit();
    el.focus();
  };

  return (
    <div className="rounded border border-border-default">
      <div className="flex items-center gap-1 border-b border-border-subtle px-1 py-0.5">
        <button
          type="button"
          title="加粗"
          onMouseDown={(e) => {
            e.preventDefault();
            exec('bold');
          }}
          className="font-bold px-1.5 text-xs text-foreground-secondary hover:bg-surface-hover rounded"
        >
          B
        </button>
        <button
          type="button"
          title="斜体"
          onMouseDown={(e) => {
            e.preventDefault();
            exec('italic');
          }}
          className="italic px-1.5 text-xs text-foreground-secondary hover:bg-surface-hover rounded"
        >
          I
        </button>
        <button
          type="button"
          title="列表"
          onMouseDown={(e) => {
            e.preventDefault();
            exec('insertUnorderedList');
          }}
          className="px-1.5 text-xs text-foreground-secondary hover:bg-surface-hover rounded"
        >
          •
        </button>
        <button
          type="button"
          title="高亮"
          onMouseDown={(e) => {
            e.preventDefault();
            toggleHighlight();
          }}
          className="flex items-center px-1.5 text-xs text-foreground-secondary hover:bg-surface-hover rounded"
        >
          <Highlighter size={13} weight="fill" />
        </button>
      </div>
      {/* onInput 实时提交：Canvas 点击组件时 mousedown.preventDefault 会阻止 contentEditable 失焦，
          仅依赖 onBlur 会导致编辑后的内容永远无法同步到画板；onInput 使内容随输入即时入库。
          useEffect 仍在聚焦时跳过回写（见上），避免光标跳动。 */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={commit}
        onBlur={commit}
        className="min-h-[60px] px-2 py-1 text-xs text-foreground-primary focus:outline-none [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4"
      />
    </div>
  );
}

export function DataNumberField({ comp, field }: { comp: EditorComponent; field: PropertyField }) {
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

/**
 * 标题块字号:单组件 data.fontSize 缺省时回显「全局标题字号」(projectMeta.theme.heading.fontSize,默认 32),
 * 而非落到通用 DataNumberField 的 0。已覆盖时提供「跟随全局」复位。
 * label 文本恒为「字号」(提示文字置于 label 之外),保证 getByLabelText('字号') 精确匹配。
 */
export function TitleBlockFontSizeField({ comp }: { comp: EditorComponent }) {
  const update = useDataUpdate(comp);
  const globalSize = useEditorStore((s) => s.projectMeta?.theme?.heading?.fontSize) ?? 32;
  const data = comp.data as { fontSize?: number };
  const overridden = typeof data.fontSize === 'number' && data.fontSize > 0;
  const value = overridden ? data.fontSize! : globalSize;

  return (
    <div className="text-xs text-foreground-secondary">
      <label className="block">
        <span className="mb-1 block">字号</span>
        <input
          type="number"
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value);
            // 正数才落库;清空/非法 → 清除覆盖,恢复跟随全局。
            update('fontSize', Number.isFinite(n) && n > 0 ? n : undefined);
          }}
          className={`w-full rounded border border-border-default px-2 py-1 ${
            overridden ? 'text-foreground-primary' : 'text-foreground-muted'
          }`}
        />
      </label>
      <div className="mt-0.5 flex items-center justify-between">
        <span className="text-[10px] text-foreground-muted">
          {overridden ? '已覆盖全局字号' : '跟随全局标题字号'}
        </span>
        {overridden && (
          <button
            onClick={() => update('fontSize', undefined)}
            className="shrink-0 rounded border border-border-default px-1.5 py-0.5 text-foreground-secondary hover:bg-surface-hover"
            title="清除覆盖,恢复跟随全局"
          >
            跟随全局
          </button>
        )}
      </div>
    </div>
  );
}

export function SelectField({ comp, field }: { comp: EditorComponent; field: PropertyField }) {
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


export function ListField({ comp, field }: { comp: EditorComponent; field: PropertyField }) {
  const update = useDataUpdate(comp);
  const items = (readValue(comp, field) as { label: string; value: number; color: string }[]) ?? [];
  const key = field.key;

  const setItem = (i: number, patch: Partial<{ label: string; value: number; color: string }>) => {
    const next = items.map((it, idx) => (idx === i ? { ...it, ...patch } : it));
    update(key, next);
  };
  const add = () => update(key, [...items, { label: '新', value: 50, color: 'auto' }]);
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


export function TableField({ comp }: { comp: EditorComponent }) {
  const update = useDataUpdate(comp);
  const data = comp.data as { headers: string[]; rows: string[][] };
  const headers = data.headers;
  const rows = data.rows;

  /** 判断某列是否为图标列（列名匹配 icon/Icon/iconKey）。 */
  const isIconCol = (ci: number) => {
    const h = (headers[ci] ?? '').toLowerCase();
    return h === 'icon' || h === 'iconkey' || h === 'icon-key' || h === '图标';
  };

  const setHeader = (i: number, v: string) => {
    const headers2 = headers.map((h, idx) => (idx === i ? v : h));
    update('headers', headers2);
  };
  const setCell = (r: number, c: number, v: string) => {
    const rows2 = rows.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? v : cell)) : row));
    update('rows', rows2);
  };
  const addRow = () => update('rows', [...rows, headers.map(() => '--')]);
  const removeRow = (r: number) => update('rows', rows.filter((_, idx) => idx !== r));
  const addCol = () => {
    update('headers', [...headers, `列${headers.length + 1}`]);
    update('rows', rows.map((r) => [...r, '--']));
  };
  const removeCol = (c: number) => {
    update('headers', headers.filter((_, idx) => idx !== c));
    update('rows', rows.map((r) => r.filter((_, idx) => idx !== c)));
  };

  return (
    <div className="text-xs text-foreground-secondary">
      <div className="mb-1">表格内容</div>
      <div className="space-y-1">
        <div className="flex gap-1">
          {headers.map((h, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <input
                value={h}
                onChange={(e) => setHeader(i, e.target.value)}
                className="w-16 rounded border border-border-default px-1 py-0.5"
              />
              <button
                onClick={() => removeCol(i)}
                title="删除该列"
                className="text-[10px] text-foreground-muted hover:text-red"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        {rows.map((row, ri) => (
          <div key={ri} className="flex items-center gap-1">
            {row.map((cell, ci) =>
              isIconCol(ci) ? (
                <TableCellIconPicker
                  key={ci}
                  value={cell}
                  onChange={(v) => setCell(ri, ci, v)}
                />
              ) : (
                <input
                  key={ci}
                  value={cell}
                  onChange={(e) => setCell(ri, ci, e.target.value)}
                  className="w-16 rounded border border-border-default px-1 py-0.5"
                />
              ),
            )}
            <button
              onClick={() => removeRow(ri)}
              title="删除该行"
              className="text-foreground-muted hover:text-red"
            >
              ✕
            </button>
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


export function TableCellIconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const Icon = value ? findIcon(value)?.Comp : null;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={value ? (findIcon(value)?.label ?? '选择图标') : '选择图标'}
        className="flex h-6 w-16 items-center justify-center rounded border border-border-default text-foreground-primary hover:bg-surface-hover"
      >
        {Icon ? <Icon size={16} /> : <span className="text-[10px] text-foreground-muted">选图标</span>}
      </button>
      {open && (
        <IconPickerOverlay
          value={value || undefined}
          weight="regular"
          onPick={(key) => {
            onChange(key);
            setOpen(false);
          }}
          onClear={() => {
            onChange('');
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/* --------------------------- 达人数据条字段 ---------------------------- */


export function KpiCompareLabelField({ comp }: { comp: EditorComponent }) {
  const update = useDataUpdate(comp);
  const data = comp.data as KpiBoardData;
  return (
    <FieldGroup title="对比基准">
      <input
        value={data.compareLabel ?? ''}
        placeholder="vs 上期"
        onChange={(e) => update('compareLabel', e.target.value || undefined)}
        className="w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-primary outline-none focus:border-foreground-primary"
      />
      <div className="text-[11px] text-foreground-muted">显示在每行环比旁（平铺指标条等变体）；留空回退「vs 上期」。</div>
    </FieldGroup>
  );
}
