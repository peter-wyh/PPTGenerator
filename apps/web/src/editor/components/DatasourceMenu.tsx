import { useRef, useState, useEffect } from 'react';
import { useEditorStore } from '../store';
import { parseFile } from '../datasource/parse';

/** 工具栏数据源下拉：列出已上传数据源 + 上传 CSV/Excel 入口 + 删除。 */
export function DatasourceMenu() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const datasources = useEditorStore((s) => s.datasources);
  const addDatasource = useEditorStore((s) => s.addDatasource);
  const removeDatasource = useEditorStore((s) => s.removeDatasource);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setErr(null);
    try {
      for (const f of Array.from(files)) {
        addDatasource(await parseFile(f));
      }
    } catch {
      setErr('解析失败，请检查文件格式');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`rounded-lg px-3 py-1.5 text-sm transition ${
          open ? 'bg-accent-primary/10 text-accent-primary' : 'text-foreground-secondary hover:bg-surface-hover'
        }`}
      >
        数据源 ▾
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-72 rounded-xl border border-border-default bg-surface-primary p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">数据源</span>
            <button
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="rounded bg-accent-primary px-2 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary disabled:opacity-50"
            >
              {busy ? '解析中…' : '+ 上传 CSV/Excel'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv"
              multiple
              className="hidden"
              onChange={(e) => void handleFiles(e.target.files)}
            />
          </div>
          {err && <p className="mb-2 text-xs text-red">{err}</p>}
          {datasources.length === 0 ? (
            <p className="py-3 text-center text-xs text-foreground-muted">尚无数据源，上传 CSV/Excel 开始。</p>
          ) : (
            <ul className="space-y-1">
              {datasources.map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded border border-border-subtle px-2 py-1.5">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-foreground-primary">{d.name}</div>
                    <div className="text-[10px] text-foreground-muted">
                      {d.columns.length} 列 · {d.rows.length} 行
                    </div>
                  </div>
                  <button onClick={() => removeDatasource(d.id)} className="text-foreground-muted hover:text-red">
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
