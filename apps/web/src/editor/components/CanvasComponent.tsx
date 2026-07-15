import { memo } from 'react';
import type { ReactNode } from 'react';
import type { EditorComponent } from '@mediakit/shared';
import type { ResizeDir } from '../store';
import { ComponentRenderer } from './ComponentRenderer';

const HANDLES: { dir: ResizeDir; style: React.CSSProperties; cursor: string }[] = [
  { dir: 'nw', style: { left: -4, top: -4 }, cursor: 'nw-resize' },
  { dir: 'n', style: { left: '50%', top: -4, marginLeft: -4 }, cursor: 'n-resize' },
  { dir: 'ne', style: { right: -4, top: -4 }, cursor: 'ne-resize' },
  { dir: 'e', style: { right: -4, top: '50%', marginTop: -4 }, cursor: 'e-resize' },
  { dir: 'se', style: { right: -4, bottom: -4 }, cursor: 'se-resize' },
  { dir: 's', style: { left: '50%', bottom: -4, marginLeft: -4 }, cursor: 's-resize' },
  { dir: 'sw', style: { left: -4, bottom: -4 }, cursor: 'sw-resize' },
  { dir: 'w', style: { left: -4, top: '50%', marginTop: -4 }, cursor: 'w-resize' },
];

interface Props {
  comp: EditorComponent;
  selected: boolean;
  onMouseDown: (e: React.MouseEvent, comp: EditorComponent) => void;
  onResizeStart: (e: React.MouseEvent, comp: EditorComponent, dir: ResizeDir) => void;
  onContextMenu: (e: React.MouseEvent, comp: EditorComponent) => void;
  onHoverCopy: (comp: EditorComponent) => void;
  onHoverDelete: (comp: EditorComponent) => void;
  children?: ReactNode;
}

/**
 * 画布上的单个组件实例。
 *
 * memo 自定义比较：仅比较 comp 引用 + selected 状态。
 * 回调函数由 Canvas 用 useCallback 稳定化，不纳入比较。
 * 这样拖拽组件 A 时，组件 B 的 CanvasComponent 因 comp 引用 + selected 不变而跳过渲染。
 */
export const CanvasComponent = memo(
  function CanvasComponent({
    comp,
    selected,
    onMouseDown,
    onResizeStart,
    onContextMenu,
    onHoverCopy,
    onHoverDelete,
  }: Props) {
    return (
      <div
        data-comp-id={comp.id}
        className="group"
        onMouseDown={(e) => onMouseDown(e, comp)}
        onContextMenu={(e) => onContextMenu(e, comp)}
        style={{
          position: 'absolute',
          left: comp.x,
          top: comp.y,
          width: comp.w,
          height: comp.h,
          cursor: comp.locked ? 'default' : 'move',
          outline: selected ? '2px solid var(--accent-primary)' : 'none',
          outlineOffset: 0,
        }}
      >
        <div className="pointer-events-none h-full w-full overflow-hidden">
          <ComponentRenderer comp={comp} />
        </div>

        {comp.locked && (
          <div className="absolute right-1 top-1 rounded bg-black/40 px-1 text-[10px] text-white">🔒</div>
        )}

        {/* 悬浮快键：复制 / 删除 */}
        {!comp.locked && (
          <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
            <button
              title="Copy"
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onClick={(e) => {
                e.stopPropagation();
                onHoverCopy(comp);
              }}
              className="rounded bg-black/50 px-1 text-[10px] text-white hover:bg-black/70"
            >
              📋
            </button>
            <button
              title="Delete"
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onClick={(e) => {
                e.stopPropagation();
                onHoverDelete(comp);
              }}
              className="rounded bg-black/50 px-1 text-[10px] text-white hover:bg-red"
            >
              ✕
            </button>
          </div>
        )}

        {selected &&
          !comp.locked &&
          HANDLES.map((h) => (
            <div
              key={h.dir}
              data-resize-dir={h.dir}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onResizeStart(e, comp, h.dir);
              }}
              style={{
                position: 'absolute',
                width: 8,
                height: 8,
                background: 'var(--surface-primary)',
                border: '2px solid var(--accent-primary)',
                borderRadius: 2,
                cursor: h.cursor,
                ...h.style,
              }}
            />
          ))}
      </div>
    );
  },
  // 自定义比较：comp 引用 + selected 变化时才重渲染（忽略 callback 引用变化）。
  (prev, next) => prev.comp === next.comp && prev.selected === next.selected,
);
