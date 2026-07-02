import { useEffect } from 'react';
import { useEditorStore } from './store';

/** 是否聚焦在可编辑元素（输入框等），键盘快捷键需跳过。 */
function isEditing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.isContentEditable === true
  );
}

/** 全局键盘快捷键（忠实 demo.html :2495-2581）。 */
export function useEditorKeyboard(): void {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const st = useEditorStore.getState();
      // 空格 pan（允许在任何地方触发，但避免与输入冲突）。
      if (e.code === 'Space' && !isEditing(e.target)) {
        e.preventDefault();
        if (!st.isPanning) st.setPanning(true);
        return;
      }
      if (e.code === 'Space') return; // 在输入框里不拦截空格

      if (isEditing(e.target)) return;

      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        st.redo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        st.duplicateSelected();
        return;
      }
      if (mod && e.key.toLowerCase() === 'c') {
        st.copy();
        return;
      }
      if (mod && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        st.paste();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        st.deleteSelected();
        return;
      }
      if (e.key === 'Escape') {
        st.clearSelection();
        return;
      }
      if (e.key.startsWith('Arrow')) {
        if (st.selectedIds.length === 0) return;
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowUp') st.nudge(0, -d);
        else if (e.key === 'ArrowDown') st.nudge(0, d);
        else if (e.key === 'ArrowLeft') st.nudge(-d, 0);
        else if (e.key === 'ArrowRight') st.nudge(d, 0);
        return;
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') {
        useEditorStore.getState().setPanning(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);
}
