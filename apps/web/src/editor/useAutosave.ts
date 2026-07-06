import { useEffect, useRef } from 'react';
import { useEditorStore } from './store';

/** pages / 尺寸 / 名称 / meta(含主题) 变更后 debounce 1.5s → 落库（store.save）；保存后清 dirty。 */
export function useAutosave(): void {
  const projectId = useEditorStore((s) => s.projectId);
  const dirty = useEditorStore((s) => s.dirty);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!projectId || !dirty) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void useEditorStore.getState().save();
    }, 1500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [dirty, projectId]);
}
