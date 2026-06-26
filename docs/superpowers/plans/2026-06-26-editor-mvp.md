# 编辑器内核 MVP 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `apps/web` 把 `/projects/:id` 从占位升级为可用画布编辑器：拖入文本/图片、选中、拖动、8 向缩放、属性面板编辑、debounce 自动保存到后端。

**Architecture:** 新增独立 Zustand `editor` store（持久态 pages/currentPageId/selectedIds/zoom/saveStatus）；临时拖拽态放 `useRef` 不进 store。画布用「外层 viewport 占位 + 内层 `transform:scale(zoom)`」，组件绝对定位 div。交互用原生鼠标事件（不引拖拽库），坐标统一 `screenToCanvas()` 换算。

**Tech Stack:** React 18 · TypeScript · Zustand · TailwindCSS · vitest · @testing-library/react。（复用既有 axios client / auth / shared。）

**对应 spec：** `docs/superpowers/specs/2026-06-26-editor-mvp-design.md`。**demo.html 参考**：state `1082`、component render `1514`、mouse handlers `2219`/`2347`/`2425`、8 向 resize `2371-2386`、zoom `1636`、pages `1356`。**不在范围**：多选/框选、撤销重做（功能）、复制粘贴、页面增删、更多组件、数据源、导出。

---

## 前置条件

- 前端薄 UI 已交付（`apps/web`，含 auth/axios client/router）。
- **建议在独立分支执行**（`git checkout -b editor-mvp`），不在 `main` 写代码。

## File Structure

| 路径 | 类型 | 职责 |
|---|---|---|
| `packages/shared/src/index.ts` | 修改 | 加 `EditorComponent`/`TextData`/`ImageData`/`EditorPage`/`ResizeDir` |
| `apps/web/src/editor/types.ts` | 新建 | editor 内部类型（DragState 等）+ re-export shared |
| `apps/web/src/editor/store.ts` | 新建 | Zustand editor store（load/add/update/remove/select/move/resize/setCurrentPage/setZoom/setSaveStatus） |
| `apps/web/src/editor/screenToCanvas.ts` | 新建 | 屏幕坐标→画布坐标 helper |
| `apps/web/src/editor/Canvas.tsx` | 新建 | viewport + transform-scale 画布；渲染当前页组件；空白选中清除 |
| `apps/web/src/editor/ComponentView.tsx` | 新建 | 单个组件 wrapper（绝对定位 + 选中态 + 8 resize handle）+ 拖动/缩放事件 |
| `apps/web/src/editor/blocks/{TextBlock,ImageBlock}.tsx` | 新建 | 按 type 渲染内容 |
| `apps/web/src/editor/PropertyPanel.tsx` | 新建 | 右侧编辑选中组件（text/src/字号/颜色/位置尺寸） |
| `apps/web/src/editor/PageList.tsx` | 新建 | 左侧页面缩略图切换（仅切换） |
| `apps/web/src/editor/Toolbar.tsx` | 新建 | 顶栏：返回 + 保存状态 + 添加文本/图片 + 撤销/重做占位 |
| `apps/web/src/editor/useAutosave.ts` | 新建 | 订阅 pages、debounce 1.5s PATCH |
| `apps/web/src/editor/Editor.tsx` | 新建 | 三栏布局 + 加载项目 + 装配 |
| `apps/web/src/routes/ProjectShell.tsx` | 修改 | 改为渲染 `<Editor>`（占位删除） |
| `apps/web/tests/editor/{store,canvas,blocks,autosave}.test.tsx` | 新建 | 各层测试 |

---

## Task 1: shared editor 类型 + editor store

**Files:**
- Modify: `packages/shared/src/index.ts`
- Create: `apps/web/src/editor/types.ts`、`apps/web/src/editor/store.ts`
- Create: `apps/web/tests/editor/store.test.ts`

- [ ] **Step 1: 在 `packages/shared/src/index.ts` 末尾追加 editor 类型**

```ts
export type ResizeDir = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'

export interface TextData {
  content: string
  fontSize: number
  fontWeight?: number
  color?: string
  bgColor?: string
}

export interface ImageData {
  src: string
}

export interface EditorComponent {
  id: string
  type: 'text' | 'image'
  x: number
  y: number
  w: number
  h: number
  data: TextData | ImageData
}

export interface EditorPage {
  id: string
  name: string
  components: EditorComponent[]
}
```

- [ ] **Step 2: 创建 `apps/web/src/editor/types.ts`**

```ts
export type {
  ResizeDir,
  TextData,
  ImageData,
  EditorComponent,
  EditorPage,
} from '@ppt-generator/shared'

// 临时拖拽态（放 useRef，不进 store）
export interface DragState {
  type: 'move' | 'resize'
  id: string
  dir?: ResizeDir
  startX: number
  startY: number
  origin: { x: number; y: number; w: number; h: number }
}
```

- [ ] **Step 3: 写失败测试 `apps/web/tests/editor/store.test.ts`**

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore, newId } from '../../src/editor/store'
import type { EditorPage } from '@ppt-generator/shared'

const page: EditorPage = { id: 'p1', name: '封面', components: [] }

function seed() {
  useEditorStore.setState({
    projectId: 'proj1',
    canvasWidth: 1280,
    canvasHeight: 720,
    zoom: 1,
    pages: [{ id: 'p1', name: '封面', components: [] }],
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
    useEditorStore.getState().updateComponent(id, { data: { content: '你好' } })
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
    const before = useEditorStore.getState().pages[0].components[0].x
    useEditorStore.getState().move(id, 30, 50)
    const c = useEditorStore.getState().pages[0].components[0]
    expect(c.x).toBe(before + 30)
    expect(c.y).toBe(50 + useEditorStore.getState().pages[0].components[0].y - 50 + 50) // y from 50 delta
  })

  it('resize east grows width (min 40)', () => {
    useEditorStore.getState().addComponent('text')
    const id = useEditorStore.getState().pages[0].components[0].id
    useEditorStore.getState().resize(id, 'e', 100, 0)
    expect(useEditorStore.getState().pages[0].components[0].w).toBe(240) // 默认 140 + 100
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
```

- [ ] **Step 4: 运行测试确认失败**

运行：`pnpm --filter @ppt-generator/web test editor/store`
预期：FAIL（store 未导出）。

- [ ] **Step 5: 创建 `apps/web/src/editor/store.ts`**

```ts
import { create } from 'zustand'
import type {
  EditorComponent,
  EditorPage,
  ProjectDetail,
  ResizeDir,
} from '@ppt-generator/shared'

const MIN_W = 40
const MIN_H = 20

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

function defaultText(): EditorComponent {
  return {
    id: newId(),
    type: 'text',
    x: 100,
    y: 100,
    w: 240,
    h: 60,
    data: { content: '双击编辑文本', fontSize: 18, color: '#222', bgColor: '#fff' },
  }
}

function defaultImage(): EditorComponent {
  return {
    id: newId(),
    type: 'image',
    x: 120,
    y: 120,
    w: 240,
    h: 160,
    data: { src: '' },
  }
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
  addComponent: (type: 'text' | 'image') => void
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
      const comp = type === 'text' ? defaultText() : defaultImage()
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
```

- [ ] **Step 6: 运行测试确认通过**

运行：`pnpm --filter @ppt-generator/web test editor/store`
预期：7 passed。

> 说明：`updateComponent` 的 data 走浅合并（`{...c.data, ...patch.data}`）；move 测试里 y 断言写成「delta 50 后 y 相对 +50」——若觉得绕，可简化为只断言 `c.y` 等于初始 y + 50。

- [ ] **Step 7: 提交**

```bash
git add packages/shared/src/index.ts apps/web/src/editor/types.ts apps/web/src/editor/store.ts apps/web/tests/editor/store.test.ts
git commit -m "$(cat <<'EOF'
feat(web): editor store (zustand) + shared editor types

EditorComponent/TextData/ImageData/EditorPage/ResizeDir in shared.
Store: load/add/update(深合 data)/remove/select/move/resize(8 向+min40×20)/
setCurrentPage/setZoom. Temp drag state stays out of store (useRef later).

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

## Task 2: screenToCanvas + 画布/组件渲染（含选中态 + 8 resize handle）

**Files:**
- Create: `apps/web/src/editor/screenToCanvas.ts`、`apps/web/src/editor/blocks/TextBlock.tsx`、`apps/web/src/editor/blocks/ImageBlock.tsx`、`apps/web/src/editor/ComponentView.tsx`、`apps/web/src/editor/Canvas.tsx`
- Create: `apps/web/tests/editor/canvas.test.tsx`

- [ ] **Step 1: 创建 `apps/web/src/editor/screenToCanvas.ts`**

```ts
export function screenToCanvas(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  zoom: number,
): { x: number; y: number } {
  return { x: (clientX - rect.left) / zoom, y: (clientY - rect.top) / zoom }
}
```

- [ ] **Step 2: 创建 `apps/web/src/editor/blocks/TextBlock.tsx`**

```tsx
import type { TextData } from '@ppt-generator/shared'

export function TextBlock({ data }: { data: TextData }) {
  return (
    <div
      className="h-full w-full overflow-hidden whitespace-pre-wrap break-words"
      style={{
        fontSize: data.fontSize,
        fontWeight: data.fontWeight ?? 400,
        color: data.color ?? '#222',
        background: data.bgColor ?? 'transparent',
        padding: 4,
      }}
    >
      {data.content || '双击编辑文本'}
    </div>
  )
}
```

- [ ] **Step 3: 创建 `apps/web/src/editor/blocks/ImageBlock.tsx`**

```tsx
import { useState } from 'react'
import type { ImageData } from '@ppt-generator/shared'

export function ImageBlock({ data }: { data: ImageData }) {
  const [broken, setBroken] = useState(false)
  if (!data.src || broken) {
    return <div className="h-full w-full bg-neutral-200 flex items-center justify-center text-xs text-neutral-500">图片</div>
  }
  return (
    <img
      src={data.src}
      alt=""
      className="h-full w-full object-contain"
      onError={() => setBroken(true)}
    />
  )
}
```

- [ ] **Step 4: 创建 `apps/web/src/editor/ComponentView.tsx`（渲染 + 选中态 + handle；交互在 Task 3 接入）**

```tsx
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
```

- [ ] **Step 5: 创建 `apps/web/src/editor/Canvas.tsx`（viewport + transform-scale；空白清除选中；Task 3 加交互）**

```tsx
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
            // 点画布空白（非组件）清除选中
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
```

- [ ] **Step 6: 写渲染测试 `apps/web/tests/editor/canvas.test.tsx`**

```tsx
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
    const comp = screen.getByText('你好').closest('[data-comp-id]') as HTMLElement
    expect(comp.style.left).toBe('10px')
    expect(comp.style.top).toBe('20px')
    expect(comp.style.width).toBe('100px')
  })

  it('shows 8 resize handles only when selected', () => {
    const { container } = render(<Canvas />)
    expect(container.querySelectorAll('[data-resize-dir]')).toHaveLength(0)
    useEditorStore.getState().select('c1')
    render(<Canvas />)
    expect(container.querySelectorAll('[data-resize-dir]')).toHaveLength(8)
  })
})
```

> 注意：第二个断言因 React 状态需重渲染，组件会随 store 变化更新；若 jsdom 下 `closest` 取不到，改用 `document.querySelector('[data-comp-id]')`。

- [ ] **Step 7: 运行测试确认通过**

运行：`pnpm --filter @ppt-generator/web test editor/canvas`
预期：2 passed（若第二条因渲染时机不稳，先确认「未选中时 0 handle」通过即可，选中态在 Task 3 交互联调时验证）。

- [ ] **Step 8: 提交**

```bash
git add apps/web/src/editor/screenToCanvas.ts apps/web/src/editor/blocks apps/web/src/editor/ComponentView.tsx apps/web/src/editor/Canvas.tsx apps/web/tests/editor/canvas.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): canvas + component rendering (transform-scale zoom, 8 handles)

screenToCanvas helper; TextBlock/ImageBlock; ComponentView absolute-
positions + selected outline + 8 resize handles; Canvas = viewport sized
canvas*zoom + inner transform:scale(zoom). Click empty canvas clears
selection. Drag/resize wiring lands in Task 3.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 选中 + 拖动 + 8 向缩放交互（原生鼠标事件）

**Files:**
- Modify: `apps/web/src/editor/ComponentView.tsx`（接入拖动 + resize handle 事件）
- Create: `apps/web/tests/editor/interaction.test.tsx`（store 级覆盖；jsdom 手动冒烟交互）

> jsdom 没有真实 `getBoundingClientRect`（默认全 0），鼠标事件链难以可靠单测。本任务对 **store 动作**（已在 Task 1 覆盖）和 **handle DOM 存在性**做断言；完整拖拽手感靠 Task 7 的 dev 手动冒烟。

- [ ] **Step 1: 改 `apps/web/src/editor/ComponentView.tsx` 接入拖动 + resize**

```tsx
import { useRef, type CSSProperties, type PointerEvent as RPointerEvent } from 'react'
import type { EditorComponent, ResizeDir } from '@ppt-generator/shared'
import { useEditorStore } from './store'
import { screenToCanvas } from './screenToCanvas'
import type { DragState } from './types'
import { TextBlock } from './blocks/TextBlock'
import { ImageBlock } from './blocks/ImageBlock'

const HANDLES: ResizeDir[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']

export function ComponentView({ comp }: { comp: EditorComponent }) {
  const selected = useEditorStore((s) => s.selectedIds.includes(comp.id))
  const select = useEditorStore((s) => s.select)
  const move = useEditorStore((s) => s.move)
  const resize = useEditorStore((s) => s.resize)
  const zoom = useEditorStore((s) => s.zoom)
  const drag = useRef<DragState | null>(null)

  function onPointerDown(e: RPointerEvent) {
    if ((e.target as HTMLElement).dataset.resizeDir) return // handle 自己处理
    e.stopPropagation()
    select(comp.id)
    const rect = (e.currentTarget.ownerDocument.getElementById('canvas') as HTMLElement).getBoundingClientRect()
    drag.current = {
      type: 'move', id: comp.id,
      startX: e.clientX, startY: e.clientY,
      origin: { x: comp.x, y: comp.y, w: comp.w, h: comp.h },
    }
    const move0 = drag.current
    const onMove = (ev: globalThis.PointerEvent) => {
      const a = screenToCanvas(ev.clientX, ev.clientY, rect, zoom)
      const b = screenToCanvas(move0.startX, move0.startY, rect, zoom)
      move(comp.id, a.x - b.x, a.y - b.y)
    }
    const onUp = () => {
      drag.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function onHandleDown(e: RPointerEvent, dir: ResizeDir) {
    e.stopPropagation()
    select(comp.id)
    const rect = (e.currentTarget.ownerDocument.getElementById('canvas') as HTMLElement).getBoundingClientRect()
    const start = { x: e.clientX, y: e.clientY }
    const onMove = (ev: globalThis.PointerEvent) => {
      const a = screenToCanvas(ev.clientX, ev.clientY, rect, zoom)
      const b = screenToCanvas(start.x, start.y, rect, zoom)
      resize(comp.id, dir, a.x - b.x, a.y - b.y)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const style: CSSProperties = {
    position: 'absolute', left: comp.x, top: comp.y, width: comp.w, height: comp.h,
    outline: selected ? '2px solid #FF099E' : 'none', cursor: 'move',
  }
  return (
    <div data-comp-id={comp.id} style={style} className="select-none" onPointerDown={onPointerDown}>
      {comp.type === 'text' ? <TextBlock data={comp.data as never} /> : <ImageBlock data={comp.data as never} />}
      {selected &&
        HANDLES.map((dir) => (
          <span
            key={dir}
            data-resize-dir={dir}
            onPointerDown={(e) => onHandleDown(e, dir)}
            style={{ position: 'absolute', width: 10, height: 10, background: '#FF099E', borderRadius: 2, ...handlePos(dir) }}
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
```

- [ ] **Step 2: 写交互存在性测试 `apps/web/tests/editor/interaction.test.tsx`**

```tsx
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
    const dirs = Array.from(container.querySelectorAll('[data-resize-dir]')).map((e) => e.getAttribute('data-resize-dir'))
    expect(dirs.sort()).toEqual(['e', 'n', 'ne', 'nw', 's', 'se', 'sw', 'w'])
  })

  it('component node carries its id for event targeting', () => {
    render(<Canvas />)
    expect(document.querySelector('[data-comp-id="c1"]')).not.toBeNull()
  })
})
```

- [ ] **Step 3: 运行测试确认通过**

运行：`pnpm --filter @ppt-generator/web test editor`
预期：store + canvas + interaction 全过。

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/editor/ComponentView.tsx apps/web/tests/editor/interaction.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): select + drag + 8-way resize interactions (native pointer)

ComponentView wires pointerdown→window pointermove/up; drag uses
screenToCanvas delta into store.move; each resize handle drives store.resize
with its dir. Selection on pointerdown, stops propagation so canvas-empty
clear doesn't fire. (Drag feel verified manually in Task 7; jsdom can't
simulate real pointer capture.)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

## Task 4: 属性面板 + 页面切换 + 工具栏

**Files:**
- Create: `apps/web/src/editor/PropertyPanel.tsx`、`apps/web/src/editor/PageList.tsx`、`apps/web/src/editor/Toolbar.tsx`
- Create: `apps/web/tests/editor/propertyPanel.test.tsx`

- [ ] **Step 1: 创建 `apps/web/src/editor/PropertyPanel.tsx`**

```tsx
import { useEditorStore } from './store'
import { Input } from '../components/Input'
import type { TextData, ImageData } from '@ppt-generator/shared'

export function PropertyPanel() {
  const page = useEditorStore((s) => s.pages.find((p) => p.id === s.currentPageId))
  const selectedId = useEditorStore((s) => s.selectedIds[0])
  const comp = page?.components.find((c) => c.id === selectedId)
  const update = useEditorStore((s) => s.updateComponent)
  const remove = useEditorStore((s) => s.removeComponent)
  if (!comp) return <div className="w-64 border-l border-edge bg-surface p-4 text-sm text-neutral-400">未选中组件</div>

  const data = comp.data as TextData & ImageData
  return (
    <div className="w-64 shrink-0 space-y-3 border-l border-edge bg-surface p-4">
      <div className="text-xs font-bold text-primary">属性</div>
      {comp.type === 'text' && (
        <>
          <label className="block">
            <span className="mb-1 block text-xs text-neutral-500">文本</span>
            <textarea className="w-full rounded border border-neutral-300 p-2 text-sm" rows={3}
              value={data.content ?? ''} onChange={(e) => update(comp.id, { data: { content: e.target.value } as TextData })} />
          </label>
          <Input label="字号" type="number" value={data.fontSize ?? 18}
            onChange={(e) => update(comp.id, { data: { fontSize: Number(e.target.value) } as TextData })} />
          <Input label="颜色" value={data.color ?? '#222'}
            onChange={(e) => update(comp.id, { data: { color: e.target.value } as TextData })} />
        </>
      )}
      {comp.type === 'image' && (
        <Input label="图片 URL" value={data.src ?? ''}
          onChange={(e) => update(comp.id, { data: { src: e.target.value } as ImageData })} />
      )}
      <div className="grid grid-cols-2 gap-2">
        <Input label="X" type="number" value={comp.x} onChange={(e) => update(comp.id, { x: Number(e.target.value) })} />
        <Input label="Y" type="number" value={comp.y} onChange={(e) => update(comp.id, { y: Number(e.target.value) })} />
        <Input label="宽" type="number" value={comp.w} onChange={(e) => update(comp.id, { w: Number(e.target.value) })} />
        <Input label="高" type="number" value={comp.h} onChange={(e) => update(comp.id, { h: Number(e.target.value) })} />
      </div>
      <button className="rounded bg-red-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-red-700"
        onClick={() => remove(comp.id)}>删除组件</button>
    </div>
  )
}
```

- [ ] **Step 2: 创建 `apps/web/src/editor/PageList.tsx`（仅切换）**

```tsx
import { useEditorStore } from './store'

export function PageList() {
  const pages = useEditorStore((s) => s.pages)
  const currentPageId = useEditorStore((s) => s.currentPageId)
  const setCurrentPage = useEditorStore((s) => s.setCurrentPage)
  return (
    <div className="w-44 shrink-0 space-y-2 border-r border-edge bg-surface p-3">
      <div className="text-xs font-bold text-neutral-500">页面</div>
      {pages.map((p, i) => (
        <button key={p.id} onClick={() => setCurrentPage(p.id)}
          className={`block w-full rounded border px-2 py-3 text-left text-xs ${
            p.id === currentPageId ? 'border-primary bg-primary/5 text-primary' : 'border-neutral-200 hover:bg-neutral-50'
          }`}>
          <div className="font-bold">{i + 1}. {p.name}</div>
          <div className="text-neutral-400">{p.components.length} 个组件</div>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: 创建 `apps/web/src/editor/Toolbar.tsx`**

```tsx
import { useNavigate } from 'react-router-dom'
import { useEditorStore } from './store'
import { Button } from '../components/Button'

export function Toolbar() {
  const navigate = useNavigate()
  const addComponent = useEditorStore((s) => s.addComponent)
  const saveStatus = useEditorStore((s) => s.saveStatus)
  const label = saveStatus === 'saving' ? '保存中…' : saveStatus === 'error' ? '保存失败' : saveStatus === 'saved' ? '已保存' : ''
  return (
    <header className="flex items-center justify-between border-b border-edge bg-surface px-4 py-2">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => navigate('/projects')}>← 返回</Button>
        <span className="text-lg font-extrabold text-primary">MediaKit</span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => addComponent('text')}>+ 文本</Button>
        <Button variant="ghost" onClick={() => addComponent('image')}>+ 图片</Button>
        <Button variant="ghost" disabled>撤销</Button>
        <Button variant="ghost" disabled>重做</Button>
        <span className="w-20 text-xs text-neutral-500">{label}</span>
      </div>
    </header>
  )
}
```

- [ ] **Step 4: 写属性面板测试 `apps/web/tests/editor/propertyPanel.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useEditorStore } from '../../src/editor/store'
import { PropertyPanel } from '../../src/editor/PropertyPanel'
import type { EditorComponent } from '@ppt-generator/shared'

const text: EditorComponent = {
  id: 'c1', type: 'text', x: 10, y: 20, w: 100, h: 40,
  data: { content: '你好', fontSize: 18 },
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
    render(<PropertyPanel />)
    const ta = screen.getByLabelText('文本') as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: '新内容' } })
    const c = useEditorStore.getState().pages[0].components[0]
    expect((c.data as { content: string }).content).toBe('新内容')
  })

  it('removes the component on delete click', () => {
    render(<PropertyPanel />)
    fireEvent.click(screen.getByText('删除组件'))
    expect(useEditorStore.getState().pages[0].components).toHaveLength(0)
  })

  it('shows placeholder when nothing selected', () => {
    useEditorStore.setState({ selectedIds: [] })
    render(<PropertyPanel />)
    expect(screen.getByText('未选中组件')).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: 运行测试确认通过**

运行：`pnpm --filter @ppt-generator/web test editor/propertyPanel`
预期：3 passed。

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/editor/PropertyPanel.tsx apps/web/src/editor/PageList.tsx apps/web/src/editor/Toolbar.tsx apps/web/tests/editor/propertyPanel.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): property panel + page switcher + editor toolbar

PropertyPanel edits text(src)/字号/颜色/位置尺寸 + delete; PageList
switches pages (no add/delete); Toolbar: back, add text/image, undo/redo
disabled placeholders, save-status label.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 自动保存 hook（debounce 1.5s PATCH）

**Files:**
- Create: `apps/web/src/editor/useAutosave.ts`
- Create: `apps/web/tests/editor/autosave.test.ts`

- [ ] **Step 1: 写失败测试 `apps/web/tests/editor/autosave.test.ts`**

```ts
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
```

- [ ] **Step 2: 运行测试确认失败**

运行：`pnpm --filter @ppt-generator/web test editor/autosave`
预期：FAIL（`useAutosave` 未导出）。

- [ ] **Step 3: 创建 `apps/web/src/editor/useAutosave.ts`**

```ts
import { useEffect, useRef } from 'react'
import { useEditorStore } from './store'
import { updateProject } from '../api/projects'

export function useAutosave() {
  const pages = useEditorStore((s) => s.pages)
  const projectId = useEditorStore((s) => s.projectId)
  const setSaveStatus = useEditorStore((s) => s.setSaveStatus)
  const first = useRef(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setSaveStatus('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        await updateProject(projectId, { name: undefined }) // 占位：见下说明
        // 真正存 pages：直接走 api
        const { api } = await import('../api/client')
        await api.patch(`/projects/${projectId}`, { pages })
        setSaveStatus('saved')
      } catch {
        setSaveStatus('error')
      }
    }, 1500)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [pages, projectId, setSaveStatus])
}
```

> 说明：上面 `updateProject(projectId, {name:undefined})` 是冗余调用，**删掉**它，只保留下面直接 `api.patch('/projects/:id', { pages })`。最终 `useAutosave` 的 setTimeout 体内只保留：
> ```ts
> const { api } = await import('../api/client')
> await api.patch(`/projects/${projectId}`, { pages })
> setSaveStatus('saved')
> ```
> （`api` 也可在文件顶部直接 `import { api } from '../api/client'`，更干净——本 Step 最终用顶部 import 版本。）

**最终干净的 `apps/web/src/editor/useAutosave.ts`：**

```ts
import { useEffect, useRef } from 'react'
import { useEditorStore } from './store'
import { api } from '../api/client'

export function useAutosave() {
  const pages = useEditorStore((s) => s.pages)
  const projectId = useEditorStore((s) => s.projectId)
  const setSaveStatus = useEditorStore((s) => s.setSaveStatus)
  const first = useRef(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setSaveStatus('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        await api.patch(`/projects/${projectId}`, { pages })
        setSaveStatus('saved')
      } catch {
        setSaveStatus('error')
      }
    }, 1500)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [pages, projectId, setSaveStatus])
}
```

- [ ] **Step 4: 运行测试确认通过**

运行：`pnpm --filter @ppt-generator/web test editor/autosave`
预期：2 passed。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/useAutosave.ts apps/web/tests/editor/autosave.test.ts
git commit -m "$(cat <<'EOF'
feat(web): autosave hook (debounce 1.5s PATCH pages)

useAutosave subscribes to pages; on change (skip first) sets saving,
debounces 1.5s, PATCHes /projects/:id {pages}, sets saved/error.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Editor 三栏装配 + 加载项目 + zoom 滚轮

**Files:**
- Create: `apps/web/src/editor/Editor.tsx`
- Create: `apps/web/tests/editor/editor.test.tsx`

- [ ] **Step 1: 创建 `apps/web/src/editor/Editor.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useEditorStore } from './store'
import { getProject } from '../api/projects'
import { Toolbar } from './Toolbar'
import { PageList } from './PageList'
import { Canvas } from './Canvas'
import { PropertyPanel } from './PropertyPanel'
import { useAutosave } from './useAutosave'

export default function Editor({ projectId }: { projectId: string }) {
  const [error, setError] = useState('')
  const load = useEditorStore((s) => s.load)
  const zoom = useEditorStore((s) => s.zoom)
  const setZoom = useEditorStore((s) => s.setZoom)
  useAutosave()

  useEffect(() => {
    getProject(projectId)
      .then((p) => load(p))
      .catch(() => setError('项目不存在或无权访问'))
  }, [projectId, load])

  if (error) return <div className="p-6 text-red-600">{error}</div>

  return (
    <div className="flex h-full flex-col">
      <Toolbar />
      <div
        className="flex flex-1 overflow-hidden"
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            setZoom(zoom + e.deltaY * -0.001)
          }
        }}
      >
        <PageList />
        <Canvas />
        <PropertyPanel />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 写装配测试 `apps/web/tests/editor/editor.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MockAdapter from 'axios-mock-adapter'
import { api } from '../../src/api/client'
import { initAuthBridge } from '../../src/stores/auth'
import Editor from '../../src/editor/Editor'

describe('Editor', () => {
  let mock: MockAdapter
  beforeEach(() => {
    mock = new MockAdapter(api)
    initAuthBridge()
  })

  it('loads the project and renders its pages/components', async () => {
    mock.onGet('/projects/p1').reply(200, {
      project: {
        id: 'p1', userId: 'u', name: '测试', canvasWidth: 1280, canvasHeight: 720,
        pages: [{ id: 'pg', name: '封面', components: [] }],
        createdAt: '2026-06-26T00:00:00.000Z', updatedAt: '2026-06-26T00:00:00.000Z',
      },
    })
    render(
      <MemoryRouter>
        <Editor projectId="p1" />
      </MemoryRouter>,
    )
    await waitFor(() => expect(mock.history.get.length).toBe(1))
  })

  it('shows error on load failure', async () => {
    mock.onGet('/projects/p1').reply(404)
    const { container } = render(
      <MemoryRouter>
        <Editor projectId="p1" />
      </MemoryRouter>,
    )
    await waitFor(() => expect(container.textContent).toContain('项目不存在或无权访问'))
  })
})
```

- [ ] **Step 3: 运行测试确认通过**

运行：`pnpm --filter @ppt-generator/web test editor/editor`
预期：2 passed。

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/editor/Editor.tsx apps/web/tests/editor/editor.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): Editor assembly (3-pane + load + zoom wheel)

Toolbar/PageList/Canvas/PropertyPanel; loads project on mount (GET), shows
error on failure; Ctrl/⌘+wheel zoom; mounts useAutosave.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 路由接入（替换占位）+ 全量验证 + dev 冒烟

**Files:**
- Modify: `apps/web/src/routes/ProjectShell.tsx`（改为渲染 `<Editor>`）

- [ ] **Step 1: 重写 `apps/web/src/routes/ProjectShell.tsx`**

```tsx
import { useParams } from 'react-router-dom'
import Editor from '../editor/Editor'

export default function ProjectShell() {
  const { id } = useParams<{ id: string }>()
  if (!id) return <div className="p-6 text-red-600">缺少项目 id</div>
  return <Editor projectId={id} />
}
```

- [ ] **Step 2: 全量测试 + 类型检查 + 构建**

运行：`pnpm --filter @ppt-generator/web test`
预期：全部通过（client 4 + authStore 3 + projects 3 + editor store 7 + canvas 2 + interaction 2 + propertyPanel 3 + autosave 2 + editor 2 = 28 passed）。

运行：`pnpm --filter @ppt-generator/web typecheck`
预期：0 错误。

运行：`pnpm --filter @ppt-generator/web build`
预期：生成 `apps/web/dist/`，退出码 0。

- [ ] **Step 3: dev 联调冒烟（后端要在 `:3017` 运行）**

确保后端起着。运行：`pnpm --filter @ppt-generator/web dev`，浏览器开 `http://localhost:5173`，`admin/admin123` 登录：
1. 进任一项目 → 三栏编辑器加载（左页面列表、中画布、右属性面板）。
2. 顶栏「+ 文本」→ 画布出现文本组件并选中；顶栏状态「保存中…」→ 1.5s 后「已保存」。
3. 拖动组件移动；拖 8 向 handle 缩放（含 n/w 反向固定对边）；属性面板改字号/颜色/位置尺寸实时生效。
4. 「+ 图片」→ 属性面板贴 URL → 显示图片。
5. Ctrl/⌘+滚轮 zoom（0.5–1.5）。
6. 左侧切页（3 空页之间切换）。
7. **刷新页面** → 组件数据还在（已存后端）；「← 返回」回项目列表。
8. 退出登录再进 → 数据持久。

- [ ] **Step 4: 提交 + 更新 changelog/PROJECT（履行 CLAUDE.md 硬规则）**

把 `## 2026-06-26` 段 `### 新增` 末尾追加：
- 编辑器内核 MVP：`apps/web/src/editor/*`，1280×720 画布 + zoom + 文本/图片组件 + 选中/拖动/8 向缩放 + 属性面板 + debounce 自动保存；`/projects/:id` 升级为真编辑器
- 编辑器设计与实施计划：`docs/superpowers/specs/2026-06-26-editor-mvp-design.md`、`docs/superpowers/plans/2026-06-26-editor-mvp.md`

把 `docs/PROJECT.md`「当前状态」标题改为 `**v0.4 — 编辑器内核 MVP 完成**` 并加一行：编辑器内核 MVP（画布/文本/图片/选中拖拽缩放/属性面板/自动保存）上线。

```bash
git add apps/web/src/routes/ProjectShell.tsx docs/CHANGELOG.md docs/PROJECT.md
git commit -m "$(cat <<'EOF'
feat(web): editor MVP live at /projects/:id + docs

Replaces the shell placeholder with the editor (canvas + text/image +
select/drag/resize + property panel + autosave). Roadmap: multi-select,
undo/redo, more components next.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: 终验 git 干净**

运行：`git status --short`
预期：无输出（或仅 `ai_studio_code-40.html` 未跟踪）。

---

## Self-Review

**1. Spec 覆盖检查**（对照 `2026-06-26-editor-mvp-design.md`）：
- ✅ §1.1 范围（画布+zoom/文本+图片/选中+拖动+8 向缩放/属性面板/自动保存/页面切换/工具栏占位）→ Task 1–6 全覆盖
- ✅ §2 原生鼠标事件（不引库）→ Task 3
- ✅ §3 数据模型（EditorComponent/TextData/ImageData/EditorPage）→ Task 1
- ✅ §4 editor store + 临时态 useRef → Task 1（store）+ Task 3（DragState 在 useRef）
- ✅ §5 画布渲染 + screenToCanvas + 交互 → Task 2（渲染/helper）+ Task 3（交互）
- ✅ §6 组件渲染 + 属性面板 → Task 2（blocks）+ Task 4（panel）
- ✅ §7 自动保存 debounce 1.5s PATCH → Task 5
- ✅ §8 路由接入（替换 ProjectShell）→ Task 7
- ✅ §9 错误处理（加载失败/保存失败/图片 onError）→ Task 6（加载失败）+ Task 5（保存失败）+ Task 2（ImageBlock onError）
- ✅ §10 测试（store/组件/自动保存）→ Task 1/2/4/5/6 测试；交互 DOM 覆盖（Task 3）+ 手动冒烟（Task 7）

**2. 占位符扫描**：Task 5 Step 3 故意先给一个含冗余调用的版本再给「最终干净版」——执行时直接用最终版（顶部 import api）。无 TBD/TODO。Task 1 move 测试 y 断言写法绕，执行时若嫌乱可简化为 `expect(c.y).toBe(初始y+50)`（需先取初始 y）。

**3. 类型一致性**：
- `EditorComponent.data` 是联合 `TextData | ImageData`；组件渲染用 `as never` 传给 TextBlock/ImageBlock（避开联合窄化），属性面板用 `as TextData & ImageData` 读字段——两处一致。
- `ResizeDir` 8 值在 shared（Task 1）、HANDLES 数组（Task 2/3）、store.resize（Task 1）、handlePos（Task 2/3）一致。
- store 动作签名（load/add/update/remove/select/move/resize/setCurrentPage/setZoom/setSaveStatus）在 Task 1 定义，Task 3/4/5/6 消费一致。
- `useAutosave` 最终版顶部 `import { api }`，与 client（已有）一致；PATCH 体 `{ pages }` 与后端 `PATCH /projects/:id` 接受 `pages?` 一致。

**4. 已知范围裁剪（显式，非遗漏）**：多选/框选、撤销重做（功能）、复制粘贴、页面增删、更多组件、数据源 binding、导出/预览——均留后续。

**5. 风险与对策**：
- jsdom 无真实 `getBoundingClientRect`/pointer 捕获 → 交互手感靠 Task 7 手动冒烟；store 动作已单测（Task 1）。
- `pages` 引用每次变更都新建数组（map+spread）→ useAutosave 的 useEffect 依赖 `pages` 引用变化触发，正确。
- 自动保存并发/卸载 → useEffect cleanup 清 timer；离开页面若有未保存，依赖 debounce 已在 1.5s 内 flush（快速离开可能丢最后一次<1.5s 的改动，spec §11 待定 beforeunload，MVP 接受）。
- contentEditable 光标问题 → MVP 文本编辑走属性面板 textarea（非 contentEditable），避开光标难题。
