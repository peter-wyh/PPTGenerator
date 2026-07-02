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
  children?: ReactNode;
}

export function CanvasComponent({ comp, selected, onMouseDown, onResizeStart }: Props) {
  return (
    <div
      data-comp-id={comp.id}
      onMouseDown={(e) => onMouseDown(e, comp)}
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
              background: '#fff',
              border: '2px solid var(--accent-primary)',
              borderRadius: 2,
              cursor: h.cursor,
              ...h.style,
            }}
          />
        ))}
    </div>
  );
}
