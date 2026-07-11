import { useEffect, useMemo } from 'react';
import { useEditorStore } from '../store';
import { PageView, fitScale } from './PageView';
import { themeToCssVars } from '../theme';
import { DEFAULT_THEME } from '@mediakit/shared';

/**
 * 全屏只读预览 overlay（M6）。
 * 忠实 demo：固定全屏深色背景，白盒渲染当前页，←/→ 翻页，Esc/按钮关闭。
 * 键盘仅 previewOpen 时响应（demo 行 2629-2634）。
 */
export function PreviewOverlay() {
  const open = useEditorStore((s) => s.previewOpen);
  const pages = useEditorStore((s) => s.pages);
  const pageIndex = useEditorStore((s) => s.previewPageIndex);
  const canvasWidth = useEditorStore((s) => s.canvasWidth);
  const canvasHeight = useEditorStore((s) => s.canvasHeight);
  const exitPreview = useEditorStore((s) => s.exitPreview);
  const previewPrev = useEditorStore((s) => s.previewPrev);
  const previewNext = useEditorStore((s) => s.previewNext);

  const theme = useEditorStore((s) => s.projectMeta?.theme ?? DEFAULT_THEME);
  const themeStyle = useMemo(() => themeToCssVars(theme), [theme]);

  // 键盘：Esc 关闭 / ← 上一页 / → 下一页（仅 open 时）
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        exitPreview();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        previewPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        previewNext();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, exitPreview, previewPrev, previewNext]);

  if (!open) return null;

  const page = pages[pageIndex];
  // 视口留出 chrome（顶栏 48 + 底栏 56 + 边距）
  const viewportW = Math.min(window.innerWidth - 80, 1280);
  const viewportH = Math.min(window.innerHeight - 160, 720);
  const scale = fitScale(canvasWidth, canvasHeight, viewportW, viewportH);

  return (
    <div className="fixed inset-0 z-[5000] flex flex-col bg-black/90">
      {/* 顶栏 */}
      <div className="flex h-12 items-center justify-end px-4">
        <button
          onClick={exitPreview}
          className="rounded px-3 py-1 text-sm text-white/80 hover:bg-white/10"
        >
          ✕ 关闭预览
        </button>
      </div>

      {/* 内容区 */}
      <div className="flex flex-1 items-center justify-center overflow-hidden px-4">
        {page ? (
          <div className="rounded-lg bg-white shadow-2xl" style={{ width: canvasWidth * scale, height: canvasHeight * scale, ...themeStyle }}>
            <PageView page={page} canvasWidth={canvasWidth} canvasHeight={canvasHeight} scale={scale} />
          </div>
        ) : (
          <div className="text-white/60">无页面</div>
        )}
      </div>

      {/* 翻页 */}
      <div className="flex h-14 items-center justify-center gap-6">
        <button
          onClick={previewPrev}
          disabled={pageIndex <= 0}
          className="rounded px-4 py-1.5 text-white/80 hover:bg-white/10 disabled:opacity-30"
        >
          ←
        </button>
        <span className="text-sm text-white/70">
          第 {pages.length > 0 ? pageIndex + 1 : 0} 页 / 共 {pages.length} 页
        </span>
        <button
          onClick={previewNext}
          disabled={pageIndex >= pages.length - 1}
          className="rounded px-4 py-1.5 text-white/80 hover:bg-white/10 disabled:opacity-30"
        >
          →
        </button>
      </div>
    </div>
  );
}
