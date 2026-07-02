import { useEffect, useRef } from 'react';
import { useEditorStore } from './store';
import { projectsApi } from '@/api/projects';

/** pages / 尺寸 / 名称 变更后 debounce 1.5s → PATCH；保存后清 dirty。 */
export function useAutosave(): void {
  const projectId = useEditorStore((s) => s.projectId);
  const dirty = useEditorStore((s) => s.dirty);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!projectId || !dirty) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const s = useEditorStore.getState();
      projectsApi
        .update(s.projectId!, {
          name: s.projectName,
          width: s.canvasWidth,
          height: s.canvasHeight,
          pages: s.pages,
        })
        .then(() => useEditorStore.getState().markSaved())
        .catch(() => {
          /* 保存失败保 dirty，下轮重试 */
        });
    }, 1500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [dirty, projectId]);
}
