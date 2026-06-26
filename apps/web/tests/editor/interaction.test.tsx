import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { useEditorStore } from '../../src/editor/store'
import { Canvas } from '../../src/editor/Canvas'
import type { EditorComponent } from '@ppt-generator/shared'

const text: EditorComponent = {
  id: 'c1', type: 'text', x: 10, y: 20, w: 100, h: 40,
  data: { content: '你好', fontSize: 18 },
}

describe('editor interactions (DOM wiring)', () => {
  beforeEach(() => {
    useEditorStore.setState({
      projectId: 'p', canvasWidth: 1280, canvasHeight: 720, zoom: 1,
      pages: [{ id: 'pg', name: '封面', components: [text] }],
      currentPageId: 'pg', selectedIds: ['c1'], saveStatus: 'idle',
    })
  })

  it('selected component exposes 8 resize handles with dirs', () => {
    const { container } = render(<Canvas />)
    const dirs = Array.from(container.querySelectorAll('[data-resize-dir]')).map((e) =>
      e.getAttribute('data-resize-dir'),
    )
    expect(dirs.sort()).toEqual(['e', 'n', 'ne', 'nw', 's', 'se', 'sw', 'w'])
  })

  it('component node carries its id for event targeting', () => {
    render(<Canvas />)
    expect(document.querySelector('[data-comp-id="c1"]')).not.toBeNull()
  })
})
