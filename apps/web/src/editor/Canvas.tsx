import { useEffect, useRef, useState } from 'react';
import { useEditorStore, type ResizeDir } from './store';
import type { EditorComponent } from '@mediakit/shared';
import { CanvasComponent } from './components/CanvasComponent';
import { ContextMenu, type MenuItem } from './components/ContextMenu';
import { PALETTE_MIME, type PalettePayload } from './ComponentPanel';

type DragState =
  | { kind: 'move'; mouseX: number; mouseY: number; comps: { id: string; x: number; y: number; locked?: boolean }[] }
  | { kind: 'resize'; mouseX: number; mouseY: number; comp: { x: number; y: number; w: number; h: number }; id: string; dir: ResizeDir }
  | { kind: 'pan'; mouseX: number; mouseY: number; panX0: number; panY0: number }
  | { kind: 'marquee'; startCanvasX: number; startCanvasY: number; shift: boolean };

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
  const [marqueeRect, setMarqueeRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; compId: string } | null>(null);

  /** 屏幕 → 画布坐标（含 pan，因为 viewport 的 rect 反映了 translate）。 */
  function clientToCanvas(clientX: number, clientY: number) {
    const rect = viewportRef.current!.getBoundingClientRect();
    const z = useEditorStore.getState().zoom;
    return { x: (clientX - rect.left) / z, y: (clientY - rect.top) / z };
  }

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
      } else if (drag.kind === 'marquee') {
        const cur = clientToCanvas(e.clientX, e.clientY);
        setMarqueeRect({
          x: Math.min(drag.startCanvasX, cur.x),
          y: Math.min(drag.startCanvasY, cur.y),
          w: Math.abs(cur.x - drag.startCanvasX),
          h: Math.abs(cur.y - drag.startCanvasY),
        });
      }
    }
    function onUp() {
      const drag = dragRef.current;
      if (drag?.kind === 'move' || drag?.kind === 'resize') {
        useEditorStore.getState().commit();
      } else if (drag?.kind === 'marquee') {
        const rect = marqueeRect;
        const st = useEditorStore.getState();
        if (rect && (rect.w > 5 || rect.h > 5)) {
          // 框选：选中完全落入矩形的组件。
          const enclosed = st
            .currentComponents()
            .filter(
              (c) =>
                c.x >= rect.x &&
                c.y >= rect.y &&
                c.x + c.w <= rect.x + rect.w &&
                c.y + c.h <= rect.y + rect.h,
            )
            .map((c) => c.id);
          if (drag.shift) {
            const base = new Set(st.selectedIds);
            for (const id of enclosed) base.add(id);
            useEditorStore.setState({ selectedIds: [...base] });
          } else {
            useEditorStore.setState({ selectedIds: enclosed });
          }
        } else {
          // 纯点击空白 → 取消选中。
          st.clearSelection();
        }
        setMarqueeRect(null);
      }
      dragRef.current = null;
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [marqueeRect]);

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

  function handleContextMenu(e: React.MouseEvent, comp: EditorComponent) {
    e.preventDefault();
    e.stopPropagation();
    useEditorStore.getState().select(comp.id);
    setMenu({ x: e.clientX, y: e.clientY, compId: comp.id });
  }

  function handleHoverCopy(comp: EditorComponent) {
    const st = useEditorStore.getState();
    st.select(comp.id);
    st.duplicateSelected();
  }

  function handleHoverDelete(comp: EditorComponent) {
    const st = useEditorStore.getState();
    st.select(comp.id);
    st.deleteSelected();
  }

  const menuItems: (MenuItem | 'separator')[] = menu
    ? (() => {
        const st = useEditorStore.getState();
        const comp = st.currentComponents().find((c) => c.id === menu.compId);
        const id = menu.compId;
        return [
          { label: '复制', onClick: () => { st.select(id); st.copy(); } },
          { label: '剪切', onClick: () => { st.select(id); st.cut(); } },
          { label: '删除', danger: true, onClick: () => { st.select(id); st.deleteSelected(); } },
          'separator',
          { label: '上移一层', onClick: () => st.bringForward(id) },
          { label: '下移一层', onClick: () => st.sendBackward(id) },
          { label: '置顶', onClick: () => st.bringToFront(id) },
          { label: '置底', onClick: () => st.sendToBack(id) },
          'separator',
          { label: comp?.locked ? '解锁位置' : '锁定位置', onClick: () => st.toggleLock(id) },
        ];
      })()
    : [];

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
    // 空白处：开始框选（mouseup 时据位移决定框选或取消选中）。
    const start = clientToCanvas(e.clientX, e.clientY);
    dragRef.current = { kind: 'marquee', startCanvasX: start.x, startCanvasY: start.y, shift: e.shiftKey };
  }

  /** 从组件库面板拖入：在落点创建组件。 */
  function handleDrop(e: React.DragEvent) {
    const raw = e.dataTransfer.getData(PALETTE_MIME);
    if (!raw) return;
    let payload: PalettePayload;
    try {
      payload = JSON.parse(raw) as PalettePayload;
    } catch {
      return;
    }
    e.preventDefault();
    const { x, y } = clientToCanvas(e.clientX, e.clientY);
    const st = useEditorStore.getState();
    if (payload.op === 'component') st.addComponentAt(payload.type, x, y);
    else st.addBusinessBlockAt(payload.kind, x, y);
  }

  return (
    <div
      className="relative flex flex-1 items-center justify-center overflow-hidden bg-surface-subtle"
      style={{ cursor: isPanning ? 'grab' : 'default' }}
    >
      <div
        ref={viewportRef}
        onMouseDown={handleBackgroundMouseDown}
        onDragOver={(e) => {
          if (Array.from(e.dataTransfer.types).includes(PALETTE_MIME)) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }
        }}
        onDrop={handleDrop}
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
              onContextMenu={handleContextMenu}
              onHoverCopy={handleHoverCopy}
              onHoverDelete={handleHoverDelete}
            />
          ))}
          {marqueeRect && (
            <div
              className="pointer-events-none absolute border border-accent-primary bg-accent-primary/10"
              style={{
                left: marqueeRect.x,
                top: marqueeRect.y,
                width: marqueeRect.w,
                height: marqueeRect.h,
              }}
            />
          )}
        </div>
      </div>
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />
      )}
    </div>
  );
}
