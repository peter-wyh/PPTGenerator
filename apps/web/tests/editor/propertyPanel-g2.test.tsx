import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useEditorStore } from '../../src/editor/store'
import { PropertyPanel } from '../../src/editor/PropertyPanel'
import { REGISTRY } from '../../src/editor/blocks'
import type { BasicComponentType, EditorComponent } from '@ppt-generator/shared'

function renderPanelWith(type: BasicComponentType) {
  const comp: EditorComponent = {
    id: 'c1', type, x: 0, y: 0, w: 200, h: 120,
    data: REGISTRY[type].defaultData() as never,
  }
  useEditorStore.setState({
    projectId: 'p', canvasWidth: 1280, canvasHeight: 720, zoom: 1,
    pages: [{ id: 'pg', name: '封面', components: [comp] }],
    currentPageId: 'pg', selectedIds: ['c1'], saveStatus: 'idle',
  })
  return render(<MemoryRouter><PropertyPanel /></MemoryRouter>)
}

describe('PropertyPanel (G2 schema-driven)', () => {
  it('edits indicator-card value', () => {
    renderPanelWith('indicator-card')
    fireEvent.change(screen.getByLabelText('数值'), { target: { value: '12.6M' } })
    expect((useEditorStore.getState().pages[0].components[0].data as { value: string }).value).toBe('12.6M')
  })

  it('adds a bar to the bar-chart list', () => {
    renderPanelWith('bar-chart')
    const before = (useEditorStore.getState().pages[0].components[0].data as { bars: unknown[] }).bars.length
    fireEvent.click(screen.getByText('+ 添加'))
    const after = (useEditorStore.getState().pages[0].components[0].data as { bars: unknown[] }).bars.length
    expect(after).toBe(before + 1)
  })

  it('adds a column to the table', () => {
    renderPanelWith('table')
    const before = (useEditorStore.getState().pages[0].components[0].data as { headers: string[] }).headers.length
    fireEvent.click(screen.getByText('+ 列'))
    const after = (useEditorStore.getState().pages[0].components[0].data as { headers: string[] }).headers.length
    expect(after).toBe(before + 1)
  })
})
