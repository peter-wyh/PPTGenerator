import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useEditorStore } from '../../src/editor/store'
import { Canvas } from '../../src/editor/Canvas'
import type { EditorComponent } from '@ppt-generator/shared'

const text: EditorComponent = {
  id: 'c1', type: 'text', x: 10, y: 20, w: 100, h: 40,
  data: { content: '你好', fontSize: 18 },
}

describe('Canvas', () => {
  beforeEach(() => {
    useEditorStore.setState({
      projectId: 'p', canvasWidth: 1280, canvasHeight: 720, zoom: 1,
      pages: [{ id: 'pg', name: '封面', components: [text] }],
      currentPageId: 'pg', selectedIds: [], saveStatus: 'idle',
    })
  })

  it('renders components positioned by canvas coords', () => {
    render(<Canvas />)
    const comp = document.querySelector('[data-comp-id="c1"]') as HTMLElement
    expect(comp.style.left).toBe('10px')
    expect(comp.style.top).toBe('20px')
    expect(comp.style.width).toBe('100px')
  })

  it('shows 0 resize handles when not selected, 8 when selected', () => {
    const { container } = render(<Canvas />)
    expect(container.querySelectorAll('[data-resize-dir]')).toHaveLength(0)
    useEditorStore.getState().select('c1')
    const { container: c2 } = render(<Canvas />)
    expect(c2.querySelectorAll('[data-resize-dir]')).toHaveLength(8)
  })
})
