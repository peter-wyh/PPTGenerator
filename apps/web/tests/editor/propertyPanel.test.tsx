import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useEditorStore } from '../../src/editor/store'
import { PropertyPanel } from '../../src/editor/PropertyPanel'
import type { EditorComponent } from '@ppt-generator/shared'

const text: EditorComponent = {
  id: 'c1', type: 'text', x: 10, y: 20, w: 100, h: 40,
  data: { content: '你好', fontSize: 18 },
}

function renderPanel() {
  return render(
    <MemoryRouter>
      <PropertyPanel />
    </MemoryRouter>,
  )
}

describe('PropertyPanel', () => {
  beforeEach(() => {
    useEditorStore.setState({
      projectId: 'p', canvasWidth: 1280, canvasHeight: 720, zoom: 1,
      pages: [{ id: 'pg', name: '封面', components: [text] }],
      currentPageId: 'pg', selectedIds: ['c1'], saveStatus: 'idle',
    })
  })

  it('edits text content via the textarea', () => {
    renderPanel()
    const ta = screen.getByLabelText('文本') as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: '新内容' } })
    const c = useEditorStore.getState().pages[0].components[0]
    expect((c.data as { content: string }).content).toBe('新内容')
  })

  it('removes the component on delete click', () => {
    renderPanel()
    fireEvent.click(screen.getByText('删除组件'))
    expect(useEditorStore.getState().pages[0].components).toHaveLength(0)
  })

  it('shows placeholder when nothing selected', () => {
    useEditorStore.setState({ selectedIds: [] })
    renderPanel()
    expect(screen.getByText('未选中组件')).toBeInTheDocument()
  })
})
