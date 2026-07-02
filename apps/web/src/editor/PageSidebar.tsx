import { useState } from 'react';
import { useEditorStore } from './store';

export function PageSidebar() {
  const pages = useEditorStore((s) => s.pages);
  const currentPageId = useEditorStore((s) => s.currentPageId);
  const setPage = useEditorStore((s) => s.setPage);
  const addPage = useEditorStore((s) => s.addPage);
  const deletePage = useEditorStore((s) => s.deletePage);
  const renamePage = useEditorStore((s) => s.renamePage);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  return (
    <div className="flex w-[200px] flex-col border-r border-border-default bg-surface-primary">
      <div className="flex items-center justify-between px-3 py-2 text-xs font-medium uppercase tracking-wide text-foreground-muted">
        <span>页面 ({pages.length})</span>
      </div>
      <div className="flex-1 space-y-1 overflow-auto px-2">
        {pages.map((p, i) => (
          <div
            key={p.id}
            onClick={() => setPage(p.id)}
            className={`cursor-pointer rounded-lg border px-2 py-1.5 text-sm ${
              p.id === currentPageId
                ? 'border-accent-primary bg-accent-primary/5 text-foreground-primary'
                : 'border-transparent text-foreground-secondary hover:bg-surface-hover'
            }`}
          >
            <div className="flex items-center justify-between">
              {editingId === p.id ? (
                <input
                  autoFocus
                  value={draft}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => {
                    renamePage(p.id, draft);
                    setEditingId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      renamePage(p.id, draft);
                      setEditingId(null);
                    }
                  }}
                  className="w-full rounded border border-border-default px-1 py-0.5 text-xs"
                />
              ) : (
                <span
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingId(p.id);
                    setDraft(p.name);
                  }}
                  className="truncate"
                >
                  {i + 1}. {p.name}
                </span>
              )}
              {pages.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deletePage(p.id);
                  }}
                  className="ml-1 text-foreground-muted hover:text-red"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={() => addPage()}
        className="m-2 rounded-lg border border-dashed border-border-default px-2 py-1.5 text-sm text-foreground-secondary hover:bg-surface-hover"
      >
        + 新建页面
      </button>
    </div>
  );
}
