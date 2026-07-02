import { useEditorStore } from './store';

/** 顶栏：项目名（可编辑）、撤销/重做、预览/导出桩（M6 接通）。 */
export function EditorTopbar() {
  const projectName = useEditorStore((s) => s.projectName);
  const setProjectName = useEditorStore((s) => s.setProjectName);
  const canUndo = useEditorStore((s) => s.canUndo());
  const canRedo = useEditorStore((s) => s.canRedo());
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  return (
    <header className="flex h-12 items-center justify-between border-b border-border-default bg-surface-primary px-3">
      <div className="flex items-center gap-2">
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="rounded px-1.5 py-0.5 text-sm text-foreground-primary outline-none hover:bg-surface-hover focus:bg-surface-hover"
        />
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => undo()}
          disabled={!canUndo}
          className="rounded px-2 py-1 text-sm text-foreground-secondary hover:bg-surface-hover disabled:opacity-40"
          title="撤销 (Ctrl+Z)"
        >
          ↶
        </button>
        <button
          onClick={() => redo()}
          disabled={!canRedo}
          className="rounded px-2 py-1 text-sm text-foreground-secondary hover:bg-surface-hover disabled:opacity-40"
          title="重做 (Ctrl+Shift+Z)"
        >
          ↷
        </button>
        <span className="mx-1 h-4 w-px bg-border-default" />
        <button
          disabled
          className="rounded px-2 py-1 text-sm text-foreground-muted disabled:opacity-50"
          title="M6 接通"
        >
          预览
        </button>
        <button
          disabled
          className="rounded px-2 py-1 text-sm text-foreground-muted disabled:opacity-50"
          title="M6 接通"
        >
          导出
        </button>
      </div>
    </header>
  );
}
