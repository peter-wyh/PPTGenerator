import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditorStore, type ResizeDir } from './store';
import type { EditorComponent } from '@mediakit/shared';
import { CanvasComponent } from './components/CanvasComponent';
import { ContextMenu, type MenuItem } from './components/ContextMenu';
import { PALETTE_MIME, type PalettePayload } from './ComponentPanel';
import { resolvePageBackground } from './background';
import { DEFAULT_THEME } from '@mediakit/shared';
import { themeToCssVars } from './theme';
import { DEFAULT_GRID_SIZE } from './defaults';
import { snapMove, clampRect, safeRectFrom } from './snap';

type DragState =
  | {
      kind: 'move';
      mouseX: number;
      mouseY: number;
      comps: { id: string; x: number; y: number; w: number; h: number; locked?: boolean }[];
    }
  | { kind: 'resize'; mouseX: number; mouseY: number; comp: { x: number; y: number; w: number; h: number }; id: string; dir: ResizeDir }
  | { kind: 'pan'; mouseX: number; mouseY: number; panX0: number; panY0: number }
  | { kind: 'marquee'; startCanvasX: number; startCanvasY: number; shift: boolean };

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
  const currentPage = useEditorStore((s) => s.currentPage());
  const [marqueeRect, setMarqueeRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; compId: string } | null>(null);

  const gridSize = useEditorStore((s) => s.projectMeta?.theme?.layout?.gridSize ?? DEFAULT_GRID_SIZE);
  const safeMargin = useEditorStore(
    (s) => s.projectMeta?.theme?.layout?.safeMargin ?? DEFAULT_THEME.layout!.safeMargin,
  );
  const showGrid = useEditorStore((s) => s.projectMeta?.theme?.layout?.showGrid ?? true);
  const showSafeArea = useEditorStore((s) => s.projectMeta?.theme?.layout?.showSafeArea ?? true);

  // 全局主题 CSS vars — 只作用于画板内容（不影响编辑器 UI）。
  const theme = useEditorStore((s) => s.projectMeta?.theme ?? DEFAULT_THEME);
  const themeStyle = useMemo(() => themeToCssVars(theme), [theme]);
  const safeRect = useMemo(
    () => safeRectFrom(safeMargin, canvasWidth, canvasHeight),
    [safeMargin, canvasWidth, canvasHeight],
  );

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
        const layout = st.projectMeta?.theme?.layout;
        const grid = layout?.gridSize ?? DEFAULT_GRID_SIZE;
        const safe =
          layout && layout.showSafeArea !== false
            ? safeRectFrom(layout.safeMargin ?? DEFAULT_THEME.layout!.safeMargin, st.canvasWidth, st.canvasHeight)
            : null;
        const clampSafe = layout
          ? safeRectFrom(layout.safeMargin ?? DEFAULT_THEME.layout!.safeMargin, st.canvasWidth, st.canvasHeight)
          : null;
        for (const c of drag.comps) {
          if (c.locked) continue;
          const { x: sx, y: sy } = snapMove({ x: c.x + dx, y: c.y + dy, w: c.w, h: c.h }, grid, safe);
          const cl = clampRect({ x: sx, y: sy, w: c.w, h: c.h }, clampSafe);
          st.updateComponent(c.id, { x: cl.x, y: cl.y, w: cl.w, h: cl.h });
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
  const handleComponentMouseDown = useCallback(function handleComponentMouseDown(e: React.MouseEvent, comp: EditorComponent) {
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
      .map((c) => ({ id: c.id, x: c.x, y: c.y, w: c.w, h: c.h, locked: c.locked }));
    dragRef.current = { kind: 'move', mouseX: e.clientX, mouseY: e.clientY, comps };
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleResizeStart = useCallback(function handleResizeStart(e: React.MouseEvent, comp: EditorComponent, dir: ResizeDir) {
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
  }, []);

  const handleContextMenu = useCallback(function handleContextMenu(e: React.MouseEvent, comp: EditorComponent) {
    e.preventDefault();
    e.stopPropagation();
    useEditorStore.getState().select(comp.id);
    setMenu({ x: e.clientX, y: e.clientY, compId: comp.id });
  }, []);

  const handleHoverCopy = useCallback(function handleHoverCopy(comp: EditorComponent) {
    const st = useEditorStore.getState();
    st.select(comp.id);
    st.duplicateSelected();
  }, []);

  const handleHoverDelete = useCallback(function handleHoverDelete(comp: EditorComponent) {
    const st = useEditorStore.getState();
    st.select(comp.id);
    st.deleteSelected();
  }, []);

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
    else if (payload.op === 'shape') st.addShapeAt(payload.shape, x, y);
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
          background: currentPage ? resolvePageBackground(currentPage) : 'var(--surface-primary)',
        }}
      >
        <div
          className="relative origin-top-left"
          style={{
            width: canvasWidth,
            height: canvasHeight,
            transform: `scale(${zoom})`,
            ...themeStyle,
          }}
        >
          {/* 网格叠加：大小 = theme.layout.gridSize */}
          {showGrid && (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  'linear-gradient(to right, var(--grid-line, rgba(0,0,0,0.03)) 1px, transparent 1px), linear-gradient(to bottom, var(--grid-line, rgba(0,0,0,0.03)) 1px, transparent 1px)',
                backgroundSize: `${gridSize}px ${gridSize}px`,
              }}
            />
          )}
          {/* 安全区参考线（仅编辑画布；导出走 PageView，不渲染） */}
          {showSafeArea && safeRect && (
            <div
              className="pointer-events-none absolute"
              style={{
                left: safeRect.left,
                top: safeRect.top,
                width: safeRect.right - safeRect.left,
                height: safeRect.bottom - safeRect.top,
                border: '1px dashed var(--safe-area-border, rgba(0,0,0,0.25))',
              }}
            />
          )}
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

      {/* 缩放百分比指示器 */}
      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-md border border-border-default bg-surface px-1.5 py-1 text-xs text-foreground-secondary shadow-sm">
        <button
          type="button"
          className="flex h-5 w-5 items-center justify-center rounded hover:bg-surface-subtle disabled:opacity-40"
          onClick={() => useEditorStore.getState().setZoom(Math.max(0.1, zoom - 0.1))}
          disabled={zoom <= 0.1}
          title="缩小"
        >
          −
        </button>
        <span className="w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          className="flex h-5 w-5 items-center justify-center rounded hover:bg-surface-subtle disabled:opacity-40"
          onClick={() => useEditorStore.getState().setZoom(Math.min(2, zoom + 0.1))}
          disabled={zoom >= 2}
          title="放大"
        >
          +
        </button>
      </div>
    </div>
  );
}
