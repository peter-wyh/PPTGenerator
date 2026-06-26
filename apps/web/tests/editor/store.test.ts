import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore, newId } from '../../src/editor/store'
import type { EditorPage } from '@ppt-generator/shared'

function seed() {
  const page: EditorPage = { id: 'p1', name: '封面', components: [] }
  useEditorStore.setState({
    projectId: 'proj1',
    canvasWidth: 1280,
    canvasHeight: 720,
    zoom: 1,
    pages: [page],
    currentPageId: 'p1',
    selectedIds: [],
    saveStatus: 'idle',
  })
}

describe('editor store', () => {
  beforeEach(seed)

  it('addComponent adds a text component to the current page and selects it', () => {
    useEditorStore.getState().addComponent('text')
    const c = useEditorStore.getState().pages[0].components[0]
    expect(c.type).toBe('text')
    expect(c.w).toBeGreaterThan(0)
    expect(useEditorStore.getState().selectedIds).toEqual([c.id])
  })

  it('updateComponent merges fields and deep-merges data', () => {
    useEditorStore.getState().addComponent('text')
    const id = useEditorStore.getState().pages[0].components[0].id
    useEditorStore.getState().updateComponent(id, { data: { content: '你好' } as never })
    const c = useEditorStore.getState().pages[0].components[0]
    expect((c.data as { content: string }).content).toBe('你好')
  })

  it('removeComponent drops by id and clears selection', () => {
    useEditorStore.getState().addComponent('text')
    const id = useEditorStore.getState().pages[0].components[0].id
    useEditorStore.getState().removeComponent(id)
    expect(useEditorStore.getState().pages[0].components).toHaveLength(0)
    expect(useEditorStore.getState().selectedIds).toEqual([])
  })

  it('move applies canvas-space delta', () => {
    useEditorStore.getState().addComponent('text')
    const id = useEditorStore.getState().pages[0].components[0].id
    const before = useEditorStore.getState().pages[0].components[0]
    useEditorStore.getState().move(id, 30, 50)
    const c = useEditorStore.getState().pages[0].components[0]
    expect(c.x).toBe(before.x + 30)
    expect(c.y).toBe(before.y + 50)
  })

  it('resize east grows width (min 40)', () => {
    useEditorStore.getState().addComponent('text')
    const id = useEditorStore.getState().pages[0].components[0].id
    useEditorStore.getState().resize(id, 'e', 100, 0)
    expect(useEditorStore.getState().pages[0].components[0].w).toBe(340) // 默认 240 + 100
    useEditorStore.getState().resize(id, 'e', -1000, 0)
    expect(useEditorStore.getState().pages[0].components[0].w).toBe(40) // 下限
  })

  it('resize west moves x and keeps right edge', () => {
    useEditorStore.getState().addComponent('text')
    const c0 = useEditorStore.getState().pages[0].components[0]
    const right = c0.x + c0.w
    useEditorStore.getState().resize(c0.id, 'w', 50, 0)
    const c = useEditorStore.getState().pages[0].components[0]
    expect(c.x).toBe(c0.x + 50)
    expect(c.x + c.w).toBe(right)
  })

  it('newId is unique-ish and a string', () => {
    expect(typeof newId()).toBe('string')
    expect(newId()).not.toBe(newId())
  })
})
