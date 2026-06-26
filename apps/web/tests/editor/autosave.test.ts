import { describe, it, expect, beforeEach, vi } from 'vitest'
import MockAdapter from 'axios-mock-adapter'
import { api } from '../../src/api/client'
import { useEditorStore } from '../../src/editor/store'
import { useAutosave } from '../../src/editor/useAutosave'
import { renderHook } from '@testing-library/react'

describe('useAutosave', () => {
  let mock: MockAdapter
  beforeEach(() => {
    mock = new MockAdapter(api)
    useEditorStore.setState({
      projectId: 'p1', canvasWidth: 1280, canvasHeight: 720, zoom: 1,
      pages: [{ id: 'pg', name: '封面', components: [] }],
      currentPageId: 'pg', selectedIds: [], saveStatus: 'idle',
    })
  })

  it('PATCHes pages 1.5s after a change', async () => {
    vi.useFakeTimers()
    mock.onPatch('/projects/p1').reply(200, { project: { id: 'p1' } })
    renderHook(() => useAutosave())
    useEditorStore.getState().addComponent('text')
    await vi.advanceTimersByTimeAsync(1500)
    expect(mock.history.patch.length).toBe(1)
    vi.useRealTimers()
  })

  it('sets saveStatus error on failure', async () => {
    vi.useFakeTimers()
    mock.onPatch('/projects/p1').reply(500)
    renderHook(() => useAutosave())
    useEditorStore.getState().addComponent('text')
    await vi.advanceTimersByTimeAsync(1500)
    expect(useEditorStore.getState().saveStatus).toBe('error')
    vi.useRealTimers()
  })
})
