import { useEffect, useRef } from 'react';
import { useEditorStore } from './store';

/**
 * pages / 尺寸 / 名称 / meta(含主题) 变更后 debounce 1.5s → 落库（store.save）；保存后清 dirty。
 *
 * 依赖 dirtyTick（每次标脏时递增）而非 dirty 布尔值：
 * 如果 save 正在进行时用户又做了新编辑，dirty 本来就是 true（save 还没清它），
 * React 不会重新触发 effect → 新改动永远不会被保存（race condition）。
 * dirtyTick 每次标脏都递增，确保 effect 总能重新触发。
 */
export function useAutosave(): void {
  const projectId = useEditorStore((s) => s.projectId);
  const dirtyTick = useEditorStore((s) => s.dirtyTick);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!projectId || dirtyTick === 0) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void useEditorStore.getState().save();
    }, 1500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [dirtyTick, projectId]);

  // 堵住「debounce 还没 fire 就被刷新/切走」的丢数据窗口：
  // - beforeunload（整页刷新/关闭）：走 flushSync，keepalive fetch 能活过 unload（body ≤ 64KB）。
  // - visibilitychange（切到后台 / 切去 IDE）：页面还活着，直接 save()（走常规 axios）。
  useEffect(() => {
    const flush = () => {
      const s = useEditorStore.getState();
      if (!s.projectId || !s.dirty || s.saving) return;
      s.flushSync();
    };
    const saveNow = () => {
      const s = useEditorStore.getState();
      if (!s.projectId || !s.dirty || s.saving) return;
      void s.save();
    };
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', saveNow);
    return () => {
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', saveNow);
    };
  }, []);
}
