import { useRef } from 'react'
import { useEditorStore } from './store'
import { ComponentView } from './ComponentView'

export function Canvas() {
  const zoom = useEditorStore((s) => s.zoom)
  const canvasWidth = useEditorStore((s) => s.canvasWidth)
  const canvasHeight = useEditorStore((s) => s.canvasHeight)
  const page = useEditorStore((s) => s.pages.find((p) => p.id === s.currentPageId))
  const select = useEditorStore((s) => s.select)
  const viewportRef = useRef<HTMLDivElement>(null)

  return (
    <div className="flex flex-1 items-center justify-center overflow-auto bg-neutral-300 p-8">
      <div
        ref={viewportRef}
        id="canvasViewport"
        style={{ width: canvasWidth * zoom, height: canvasHeight * zoom }}
        className="relative shadow-lg"
      >
        <div
          id="canvas"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) select(null)
          }}
          style={{
            width: canvasWidth,
            height: canvasHeight,
            background: '#fff',
            transform: `scale(${zoom})`,
            transformOrigin: '0 0',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        >
          {page?.components.map((c) => <ComponentView key={c.id} comp={c} />)}
        </div>
      </div>
    </div>
  )
}
