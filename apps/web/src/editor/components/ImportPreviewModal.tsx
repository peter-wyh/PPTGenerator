import type { ImportKind, PreviewItem } from '../dataImport';
import { PREVIEW_COLUMNS } from '../dataImport';

interface Props {
  kind: ImportKind;
  items: PreviewItem[];
  onConfirm: (validItems: Record<string, unknown>[]) => void;
  onCancel: () => void;
}

/** 导入预览弹窗:展示解析行 + 逐行必填校验,确认后只回传有效行。 */
export function ImportPreviewModal({ kind, items, onConfirm, onCancel }: Props) {
  const valid = items.filter((i) => i.valid);
  const columns = PREVIEW_COLUMNS[kind];
  const labelMap: Record<string, string> = {
    campaign: 'Campaign',
    creator: '达人库',
    creatorAudience: '达人画像',
    creatorWorks: '达人作品',
    collaboration: '达人合作',
    collaborationDaily: '合作每日互动',
    cps: 'CPS 链接效果',
    cpsDaily: 'CPS 每日明细',
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        className="flex max-h-[90vh] w-[860px] flex-col gap-3 overflow-auto rounded-xl bg-surface-primary p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-headings text-sm font-semibold text-foreground-primary">
          导入预览 · {labelMap[kind] ?? kind} · 共 {items.length} 行(有效 {valid.length})
        </div>
        <div className="overflow-auto rounded-lg border border-border-default">
          <table className="w-full min-w-[640px] border-collapse text-xs">
            <thead>
              <tr className="bg-surface-hover text-left text-foreground-muted">
                {columns.map((c) => (
                  <th key={c} className="whitespace-nowrap px-2 py-1.5 font-medium">{c}</th>
                ))}
                <th className="px-2 py-1.5 font-medium">校验</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-t border-border-subtle">
                  {columns.map((c) => (
                    <td key={c} className="whitespace-nowrap px-2 py-1 text-foreground-secondary">
                      {String(it.data[c] ?? '')}
                    </td>
                  ))}
                  <td className={`px-2 py-1 ${it.valid ? 'text-accent-primary' : 'text-red'}`}>
                    {it.valid ? '✓' : it.error}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
          >
            取消
          </button>
          <button
            disabled={valid.length === 0}
            onClick={() => onConfirm(valid.map((v) => v.data))}
            className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary disabled:opacity-50"
          >
            确认导入({valid.length})
          </button>
        </div>
      </div>
    </div>
  );
}
