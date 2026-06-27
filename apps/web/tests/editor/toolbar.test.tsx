import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useEditorStore } from '../../src/editor/store'
import { Toolbar } from '../../src/editor/Toolbar'
import { REGISTRY } from '../../src/editor/blocks'

describe('Toolbar', () => {
  beforeEach(() => {
    useEditorStore.setState({
      projectId: 'p', canvasWidth: 1280, canvasHeight: 720, zoom: 1,
      pages: [{ id: 'pg', name: '封面', components: [] }],
      currentPageId: 'pg', selectedIds: [], saveStatus: 'idle',
    })
  })

  it('renders one add button per registry entry', () => {
    render(<MemoryRouter><Toolbar /></MemoryRouter>)
    for (const def of Object.values(REGISTRY)) {
      expect(screen.getByText(`+ ${def.label}`)).toBeInTheDocument()
    }
  })

  it('adds a bar-chart component on click', () => {
    render(<MemoryRouter><Toolbar /></MemoryRouter>)
    fireEvent.click(screen.getByText('+ 柱状图'))
    const c = useEditorStore.getState().pages[0].components[0]
    expect(c.type).toBe('bar-chart')
  })
})
