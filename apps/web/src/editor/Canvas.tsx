import { useEffect, useRef } from 'react';
import { useEditorStore, type ResizeDir } from './store';
import type { EditorComponent } from '@mediakit/shared';
import { CanvasComponent } from './components/CanvasComponent';

type DragState =
  | { kind: 'move'; mouseX: number; mouseY: number; comps: { id: string; x: number; y: number; locked?: boolean }[] }
  | { kind: 'resize'; mouseX: number; mouseY: number; comp: { x: number; y: number; w: number; h: number }; id: string; dir: ResizeDir }
  | { kind: 'pan'; mouseX: number; mouseY: number; panX0: number; panY0: number };

const SNAP = 10;

export function Canvas() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const zoom = useEditorStore((s) => s.zoom);
  const panX = useEditorStore((s) => s.panX);
  const panY = useEditorStore((s) => s.panY);
  const canvasWidth = useEditorStore((s) => s.canvasWidth);
  const canvasHeight = useEditorStore((s) => s.canvasHeight);
  const components = useEditorStore((s) => s.currentComponents());
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const isPanning = useEditorStore((s) => s.isPanning);

  /* ----------------------------- 拖动编排 ----------------------------- */
  useEffect(() => {
    function onMove(e: MouseEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const st = useEditorStore.getState();
      if (drag.kind === 'move') {
        const dx = (e.clientX - drag.mouseX) / st.zoom;
        const dy = (e.clientY - drag.mouseY) / st.zoom;
        for (const c of drag.comps) {
          if (c.locked) continue;
          st.updateComponent(c.id, {
            x: Math.round((c.x + dx) / SNAP) * SNAP,
            y: Math.round((c.y + dy) / SNAP) * SNAP,
          });
        }
      } else if (drag.kind === 'resize') {
        const dx = (e.clientX - drag.mouseX) / st.zoom;
        const dy = (e.clientY - drag.mouseY) / st.zoom;
        st.resize(drag.id, drag.dir, dx, dy, drag.comp);
      } else if (drag.kind === 'pan') {
        st.setPan(drag.panX0 + (e.clientX - drag.mouseX), drag.panY0 + (e.clientY - drag.mouseY));
      }
    }
    function onUp() {
      const drag = dragRef.current;
      if (drag && (drag.kind === 'move' || drag.kind === 'resize')) {
        useEditorStore.getState().commit();
      }
      dragRef.current = null;
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  /* ----------------------------- wheel 缩放 ---------------------------- */
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        useEditorStore.getState().zoomByDelta(e.deltaY);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  /* ----------------------- 首次挂载：fit 到视口 ------------------------ */
  useEffect(() => {
    const area = viewportRef.current?.parentElement;
    if (!area) return;
    const { canvasWidth: cw, canvasHeight: ch } = useEditorStore.getState();
    const fit = Math.min((area.clientWidth - 48) / cw, (area.clientHeight - 48) / ch, 1);
    useEditorStore.getState().setZoom(Math.max(0.1, fit));
  }, []);

  /* ------------------------------ 交互入口 ----------------------------- */
  function handleComponentMouseDown(e: React.MouseEvent, comp: EditorComponent) {
    if (e.button !== 0) return;
    const st = useEditorStore.getState();
    // 未选中且非 shift → 单选该组件；否则保留多选。
    if (!st.selectedIds.includes(comp.id)) {
      st.select(comp.id, e.shiftKey);
    } else if (e.shiftKey) {
      st.select(comp.id, true); // 取消
    }
    const ids = useEditorStore.getState().selectedIds;
    const comps = useEditorStore
      .getState()
      .currentComponents()
      .filter((c) => ids.includes(c.id))
      .map((c) => ({ id: c.id, x: c.x, y: c.y, locked: c.locked }));
    dragRef.current = { kind: 'move', mouseX: e.clientX, mouseY: e.clientY, comps };
    e.preventDefault();
    e.stopPropagation();
  }

  function handleResizeStart(e: React.MouseEvent, comp: EditorComponent, dir: ResizeDir) {
    const st = useEditorStore.getState();
    st.select(comp.id);
    dragRef.current = {
      kind: 'resize',
      mouseX: e.clientX,
      mouseY: e.clientY,
      comp: { x: comp.x, y: comp.y, w: comp.w, h: comp.h },
      id: comp.id,
      dir,
    };
  }

  function handleBackgroundMouseDown(e: React.MouseEvent) {
    const st = useEditorStore.getState();
    if (st.isPanning) {
      dragRef.current = {
        kind: 'pan',
        mouseX: e.clientX,
        mouseY: e.clientY,
        panX0: st.panX,
        panY0: st.panY,
      };
      return;
    }
    // 点空白：取消选中。
    st.clearSelection();
  }

  return (
    <div
      className="relative flex flex-1 items-center justify-center overflow-hidden bg-surface-subtle"
      style={{ cursor: isPanning ? 'grab' : 'default' }}
    >
      <div
        ref={viewportRef}
        onMouseDown={handleBackgroundMouseDown}
        className="relative shadow-lg"
        style={{
          width: canvasWidth * zoom,
          height: canvasHeight * zoom,
          transform: `translate(${panX}px, ${panY}px)`,
          background: '#fff',
        }}
      >
        <div
          className="relative origin-top-left"
          style={{
            width: canvasWidth,
            height: canvasHeight,
            transform: `scale(${zoom})`,
          }}
        >
          {/* 20px 网格 */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(to right, #F3F4F6 1px, transparent 1px), linear-gradient(to bottom, #F3F4F6 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />
          {components.map((comp) => (
            <CanvasComponent
              key={comp.id}
              comp={comp}
              selected={selectedIds.includes(comp.id)}
              onMouseDown={handleComponentMouseDown}
              onResizeStart={handleResizeStart}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
