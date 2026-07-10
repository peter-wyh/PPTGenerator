import { useState } from 'react';
import type { EditorComponent } from '@mediakit/shared';
import { IconPickerOverlay } from '../../icons/IconPickerOverlay';
import { findIcon } from '../../icons/catalog';
import { useDataUpdate } from '../helpers';

/** 表格编辑器：表头 + 行。 */
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

/** 表格单元格内的图标选择器：点击弹出 IconPickerOverlay，选中后写入 cell。 */
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
