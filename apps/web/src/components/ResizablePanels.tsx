/**
 * ResizablePanels — 三栏可拉伸布局组件。
 * 左 | 中 | 右三栏，中间和右栏可拖拽调整宽度。
 *
 * 用法：
 * <ResizablePanels
 *   left={<ChatPanel />}
 *   center={<Canvas />}
 *   right={<ConfigPanel />}
 *   leftWidth={380}  // 左栏初始宽度（px）
 *   rightWidth={300} // 右栏初始宽度（px）
 *   minLeft={280} maxLeft={600}
 *   minRight={240} maxRight={500}
 * />
 */
import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react';

interface ResizablePanelsProps {
  left: ReactNode;
  center: ReactNode;
  right?: ReactNode;
  leftWidth?: number;
  rightWidth?: number;
  minLeft?: number;
  maxLeft?: number;
  minRight?: number;
  maxRight?: number;
  /** 左栏是否可隐藏 */
  leftCollapsed?: boolean;
  /** 右栏是否可隐藏 */
  rightCollapsed?: boolean;
}

export function ResizablePanels({
  left,
  center,
  right,
  leftWidth = 380,
  rightWidth = 300,
  minLeft = 280,
  maxLeft = 600,
  minRight = 240,
  maxRight = 500,
  leftCollapsed = false,
  rightCollapsed = false,
}: ResizablePanelsProps) {
  const [lw, setLw] = useState(leftWidth);
  const [rw, setRw] = useState(rightWidth);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<'left' | 'right' | null>(null);

  const onMouseDown = useCallback((which: 'left' | 'right') => {
    dragging.current = which;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    // 创建 overlay 防止 iframe 拦截 mousemove
    const overlay = document.createElement('div');
    overlay.id = 'resize-overlay';
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:9999;cursor:col-resize;';
    document.body.appendChild(overlay);
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      if (dragging.current === 'left') {
        const newW = Math.max(minLeft, Math.min(maxLeft, e.clientX - rect.left));
        setLw(newW);
      } else if (dragging.current === 'right') {
        // 右栏宽度 = 容器右边 - 鼠标 x
        const newW = Math.max(
          minRight,
          Math.min(maxRight, rect.right - e.clientX),
        );
        setRw(newW);
      }
    };

    const onMouseUp = () => {
      if (dragging.current) {
        dragging.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.getElementById('resize-overlay')?.remove();
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [minLeft, maxLeft, minRight, maxRight]);

  return (
    <div ref={containerRef} className="flex flex-1 overflow-hidden">
      {/* 左栏 */}
      {!leftCollapsed && (
        <>
          <div style={{ width: `${lw}px` }} className="shrink-0 overflow-hidden">
            {left}
          </div>
          {/* 拖拽手柄 */}
          <div
            onMouseDown={() => onMouseDown('left')}
            className="group relative w-1 shrink-0 cursor-col-resize bg-border-default transition hover:bg-accent-primary"
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>
        </>
      )}

      {/* 中间 */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {center}
      </div>

      {/* 右栏 */}
      {right && !rightCollapsed && (
        <>
          <div
            onMouseDown={() => onMouseDown('right')}
            className="group relative w-1 shrink-0 cursor-col-resize bg-border-default transition hover:bg-accent-primary"
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>
          <div style={{ width: `${rw}px` }} className="shrink-0 overflow-hidden">
            {right}
          </div>
        </>
      )}
    </div>
  );
}
