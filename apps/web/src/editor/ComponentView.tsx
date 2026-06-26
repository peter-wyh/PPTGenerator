import { useRef, type CSSProperties, type PointerEvent as RPointerEvent } from 'react'
import type { EditorComponent, ResizeDir } from '@ppt-generator/shared'
import { useEditorStore } from './store'
import { screenToCanvas } from './screenToCanvas'
import type { DragState } from './types'
import { TextBlock } from './blocks/TextBlock'
import { ImageBlock } from './blocks/ImageBlock'

const HANDLES: ResizeDir[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']

export function ComponentView({ comp }: { comp: EditorComponent }) {
  const selected = useEditorStore((s) => s.selectedIds.includes(comp.id))
  const select = useEditorStore((s) => s.select)
  const move = useEditorStore((s) => s.move)
  const resize = useEditorStore((s) => s.resize)
  const zoom = useEditorStore((s) => s.zoom)
  const drag = useRef<DragState | null>(null)

  function canvasRect(e: RPointerEvent): DOMRect {
    return (e.currentTarget.ownerDocument.getElementById('canvas') as HTMLElement).getBoundingClientRect()
  }

  function onPointerDown(e: RPointerEvent) {
    if ((e.target as HTMLElement).dataset.resizeDir) return // handle 自己处理
    e.stopPropagation()
    select(comp.id)
    const rect = canvasRect(e)
    const start = { x: e.clientX, y: e.clientY }
    drag.current = {
      type: 'move', id: comp.id, startX: start.x, startY: start.y,
      origin: { x: comp.x, y: comp.y, w: comp.w, h: comp.h },
    }
    const onMove = (ev: globalThis.PointerEvent) => {
      const a = screenToCanvas(ev.clientX, ev.clientY, rect, zoom)
      const b = screenToCanvas(start.x, start.y, rect, zoom)
      move(comp.id, a.x - b.x, a.y - b.y)
    }
    const onUp = () => {
      drag.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function onHandleDown(e: RPointerEvent, dir: ResizeDir) {
    e.stopPropagation()
    select(comp.id)
    const rect = canvasRect(e)
    const start = { x: e.clientX, y: e.clientY }
    const onMove = (ev: globalThis.PointerEvent) => {
      const a = screenToCanvas(ev.clientX, ev.clientY, rect, zoom)
      const b = screenToCanvas(start.x, start.y, rect, zoom)
      resize(comp.id, dir, a.x - b.x, a.y - b.y)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const style: CSSProperties = {
    position: 'absolute', left: comp.x, top: comp.y, width: comp.w, height: comp.h,
    outline: selected ? '2px solid #FF099E' : 'none', cursor: 'move',
  }
  return (
    <div data-comp-id={comp.id} style={style} className="select-none" onPointerDown={onPointerDown}>
      {comp.type === 'text' ? <TextBlock data={comp.data as never} /> : <ImageBlock data={comp.data as never} />}
      {selected &&
        HANDLES.map((dir) => (
          <span
            key={dir}
            data-resize-dir={dir}
            onPointerDown={(e) => onHandleDown(e, dir)}
            style={{ position: 'absolute', width: 10, height: 10, background: '#FF099E', borderRadius: 2, ...handlePos(dir) }}
          />
        ))}
    </div>
  )
}

function handlePos(dir: ResizeDir): CSSProperties {
  const p: CSSProperties = {}
  if (dir.includes('n')) p.top = -5
  if (dir.includes('s')) p.bottom = -5
  if (dir.includes('w')) p.left = -5
  if (dir.includes('e')) p.right = -5
  if (dir === 'n' || dir === 's') p.left = 'calc(50% - 5px)'
  if (dir === 'e' || dir === 'w') p.top = 'calc(50% - 5px)'
  return p
}
