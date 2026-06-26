import type { CSSProperties } from 'react'
import type { EditorComponent, ResizeDir } from '@ppt-generator/shared'
import { useEditorStore } from './store'
import { TextBlock } from './blocks/TextBlock'
import { ImageBlock } from './blocks/ImageBlock'

const HANDLES: ResizeDir[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']

export function ComponentView({ comp }: { comp: EditorComponent }) {
  const selected = useEditorStore((s) => s.selectedIds.includes(comp.id))
  const style: CSSProperties = {
    position: 'absolute',
    left: comp.x,
    top: comp.y,
    width: comp.w,
    height: comp.h,
    outline: selected ? '2px solid #FF099E' : 'none',
    cursor: 'move',
  }
  return (
    <div data-comp-id={comp.id} style={style} className="select-none">
      {comp.type === 'text' ? <TextBlock data={comp.data as never} /> : <ImageBlock data={comp.data as never} />}
      {selected &&
        HANDLES.map((dir) => (
          <span
            key={dir}
            data-resize-dir={dir}
            style={{
              position: 'absolute',
              width: 10,
              height: 10,
              background: '#FF099E',
              borderRadius: 2,
              ...handlePos(dir),
            }}
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
