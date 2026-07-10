import type { EditorComponent, StrategyBlockData } from '@mediakit/shared';
import { FieldGroup, useDataUpdate } from '../helpers';
import { TableCellIconPicker } from '../fields/TableField';
import { RichTextField } from '../fields/RichTextField';

/** strategy-block 专属编辑：每行 = 图标 key + 标题 + 富文本内容；可增删行。 */
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
      {/* 全局高亮词：渲染时对各行命中词包强调 span；编辑器内未聚焦时即时预览。 */}
      <label className="block text-xs text-foreground-secondary">
        <span className="mb-1 block">高亮词（逗号分隔）</span>
        <input
          value={data.highlights ?? ''}
          placeholder="高亮词（逗号分隔）"
          onChange={(e) => update('highlights', e.target.value)}
          className="w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-primary outline-none focus:border-foreground-primary"
        />
      </label>
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
              highlights={data.highlights}
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
