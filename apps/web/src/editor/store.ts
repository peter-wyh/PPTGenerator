import { create } from 'zustand'
import type {
  BasicComponentType,
  EditorComponent,
  EditorPage,
  ProjectDetail,
  ResizeDir,
} from '@ppt-generator/shared'
import { getBlock } from './blocks'

const MIN_W = 40
const MIN_H = 20

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

interface EditorState {
  projectId: string
  canvasWidth: number
  canvasHeight: number
  zoom: number
  pages: EditorPage[]
  currentPageId: string
  selectedIds: string[]
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  load: (project: ProjectDetail) => void
  addComponent: (type: BasicComponentType) => void
  updateComponent: (id: string, patch: Partial<EditorComponent>) => void
  removeComponent: (id: string) => void
  select: (id: string | null) => void
  move: (id: string, dx: number, dy: number) => void
  resize: (id: string, dir: ResizeDir, dx: number, dy: number) => void
  setCurrentPage: (id: string) => void
  setZoom: (z: number) => void
  setSaveStatus: (s: EditorState['saveStatus']) => void
  currentPage: () => EditorPage | undefined
}

export const useEditorStore = create<EditorState>((set, get) => ({
  projectId: '',
  canvasWidth: 1280,
  canvasHeight: 720,
  zoom: 1,
  pages: [],
  currentPageId: '',
  selectedIds: [],
  saveStatus: 'idle',

  load: (project) =>
    set({
      projectId: project.id,
      canvasWidth: project.canvasWidth,
      canvasHeight: project.canvasHeight,
      pages: (project.pages as unknown as EditorPage[]) ?? [],
      currentPageId: (project.pages as unknown as EditorPage[])[0]?.id ?? '',
      selectedIds: [],
      saveStatus: 'idle',
    }),

  addComponent: (type) =>
    set((s) => {
      const def = getBlock(type)
      const comp: EditorComponent = {
        id: newId(),
        type,
        x: 140,
        y: 140,
        w: def.defaultSize.w,
        h: def.defaultSize.h,
        data: def.defaultData() as EditorComponent['data'],
      }
      const pages = s.pages.map((p) =>
        p.id === s.currentPageId ? { ...p, components: [...p.components, comp] } : p,
      )
      return { pages, selectedIds: [comp.id] }
    }),

  updateComponent: (id, patch) =>
    set((s) => ({
      pages: s.pages.map((p) =>
        p.id === s.currentPageId
          ? {
              ...p,
              components: p.components.map((c) =>
                c.id === id
                  ? { ...c, ...patch, data: { ...c.data, ...(patch.data as object) } }
                  : c,
              ),
            }
          : p,
      ),
    })),

  removeComponent: (id) =>
    set((s) => ({
      pages: s.pages.map((p) =>
        p.id === s.currentPageId
          ? { ...p, components: p.components.filter((c) => c.id !== id) }
          : p,
      ),
      selectedIds: s.selectedIds.filter((x) => x !== id),
    })),

  select: (id) => set({ selectedIds: id ? [id] : [] }),

  move: (id, dx, dy) =>
    set((s) => ({
      pages: s.pages.map((p) =>
        p.id === s.currentPageId
          ? {
              ...p,
              components: p.components.map((c) =>
                c.id === id ? { ...c, x: c.x + dx, y: c.y + dy } : c,
              ),
            }
          : p,
      ),
    })),

  resize: (id, dir, dx, dy) =>
    set((s) => ({
      pages: s.pages.map((p) =>
        p.id === s.currentPageId
          ? {
              ...p,
              components: p.components.map((c) => {
                if (c.id !== id) return c
                let { x, y, w, h } = c
                if (dir.includes('e')) w = Math.max(MIN_W, c.w + dx)
                if (dir.includes('s')) h = Math.max(MIN_H, c.h + dy)
                if (dir.includes('w')) {
                  const newW = Math.max(MIN_W, c.w - dx)
                  x = c.x + (c.w - newW)
                  w = newW
                }
                if (dir.includes('n')) {
                  const newH = Math.max(MIN_H, c.h - dy)
                  y = c.y + (c.h - newH)
                  h = newH
                }
                return { ...c, x, y, w, h }
              }),
            }
          : p,
      ),
    })),

  setCurrentPage: (id) => set({ currentPageId: id, selectedIds: [] }),

  setZoom: (z) => set({ zoom: Math.min(1.5, Math.max(0.5, z)) }),

  setSaveStatus: (saveStatus) => set({ saveStatus }),

  currentPage: () => get().pages.find((p) => p.id === get().currentPageId),
}))
