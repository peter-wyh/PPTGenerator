# 编辑器内核 MVP 设计文档

**日期**：2026-06-26
**作者**：ap + Claude（结对设计）
**状态**：设计已确认，待编写实现计划
**视觉/交互参考**：`demo.html`（原生 JS 原型，已由子代理完成架构梳理）
**依赖**：P0 后端（项目 CRUD + 认证）、前端薄 UI（`apps/web` 已交付）

---

## 1. 背景与目标

前端薄 UI 已交付登录 + 项目管理。本期把 `/projects/:id` 从「外壳占位」升级为**可用的画布编辑器 MVP**：拖入文本/图片组件、选中、拖动、8 向缩放、右侧改属性、debounce 自动保存到后端。

打通最难的「画布交互 + 持久化」闭环，能做出一份简单报告并存后端。后续在此外扩到完整 P1（多选/撤销重做/更多组件）。

### 1.1 范围（MVP 含）

- 1280×720 画布 + zoom（0.5–1.5，Ctrl/⌘+滚轮）
- 组件：**文本**、**图片**
- 单击选中、拖动移动、8 向缩放（min 40×20）
- 右侧属性面板编辑选中组件
- debounce 1.5s 自动保存 `PATCH /projects/:id { pages }`
- 左侧页面缩略图**切换**（项目自带 3 空页；仅切换，不增删）
- 顶部工具栏：返回项目列表、保存状态、添加文本/图片、撤销/重做**占位按钮**（非功能）

### 1.2 非目标（YAGNI，留后续）

- 多选 / 框选 marquee、复制粘贴、功能性撤销重做（demo 为 50 步深拷贝快照）
- 页面增删 / 改名 / 拖拽排序
- 更多组件（指标卡 / 柱状 / 折线 / 饼图 / 表格 / business-block）
- 数据源 binding（demo 里其实是空壳，需从零设计）
- 导出、预览模式、画布尺寸拖拽、对齐分布、图层顺序、锁定

---

## 2. 技术方案：原生 DOM 鼠标事件（不引拖拽库）

| 方案 | 取舍 |
|---|---|
| **原生事件（采用）** | mousedown/move/up 自绘 8 向 resize handle；零依赖、完全可控；与 demo.html 一致；未来加多选/框选/zoom 不会被库挡路 |
| react-rnd | 拖拽+缩放开箱即用，但多选/框选/zoom 要绕过库，扩 P1 全交互会打架 |
| react-dnd | 偏列表拖拽，不适合画布自由变换 |

**选原生事件**：MVP 会长成完整 P1，原生事件是唯一不撞墙的地基。

---

## 3. 数据模型（对齐 demo.html + 后端 pages JSON）

后端 `Project.pages` 是不透明 JSON 字段；前端定义强类型并存取：

```ts
// packages/shared（新增/扩展）
export interface EditorComponent {
  id: string
  type: 'text' | 'image'
  x: number
  y: number
  w: number
  h: number
  data: TextData | ImageData
}

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

export interface EditorPage {
  id: string
  name: string
  components: EditorComponent[]
}
```

> 字段命名对齐 demo.html（`content`/`fontSize`/`color`/`src`），方便日后迁业务组件。坐标为**画布像素绝对值**（非屏幕像素）。

---

## 4. 状态：新增 Zustand `editor` store（独立于 auth store）

```ts
interface EditorState {
  projectId: string
  canvasWidth: number   // 1280
  canvasHeight: number  // 720
  zoom: number          // 0.5–1.5
  pages: EditorPage[]
  currentPageId: string
  selectedIds: string[]
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  // 动作
  load: (project: ProjectDetail) => void
  addComponent: (type: 'text' | 'image') => void
  updateComponent: (id: string, patch: Partial<EditorComponent>) => void   // 含 data patch
  removeComponent: (id: string) => void
  select: (id: string | null) => void
  move: (id: string, dx: number, dy: number) => void     // dx/dy 已为画布坐标
  resize: (id: string, dir: ResizeDir, dx: number, dy: number) => void
  setCurrentPage: (id: string) => void
  setZoom: (z: number) => void
  setSaveStatus: (s: EditorState['saveStatus']) => void
}
```

**临时交互态**（拖拽中 `dragId/dragType/resizeDir/dragStart`）放 `useRef`，不进 store（避免每次 mousemove 触发全局重渲染）。`dragType = 'move' | 'resize' | null`。

**MVP 不含 history**（撤销重做仅占位按钮）；`pages` 变更即「完成态」，直接触发自动保存。

---

## 5. 画布渲染与交互

### 5.1 渲染（参考 demo.html `renderCanvas`）
- 外层 `#canvasViewport`：`width/height = 画布尺寸 × zoom`（占位）
- 内层 `#canvas`：`transform: scale(zoom)`、`transform-origin: 0 0`、固定 `1280×720`
- 每个组件 = `position:absolute` 的 div，`left/top/width/height` 用画布像素
- 选中组件外层加选中样式 + 8 个 `.resize-handle[data-dir]`（n/ne/e/se/s/sw/w/nw）

### 5.2 坐标换算（关键，demo 里散落各处，统一封装）
```ts
function screenToCanvas(e: MouseEvent, zoom: number) {
  const rect = canvasEl.getBoundingClientRect()
  return { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom }
}
```
所有拖拽 `dx/dy` 必须 `/ zoom` 转回画布坐标再进 `move/resize`。

### 5.3 交互
| 交互 | 实现 |
|---|---|
| 选中 | 组件 mousedown → `select(id)`；画布空白 mousedown → `select(null)` |
| 拖动 | 组件 mousedown 设 dragType='move' + 起点；window mousemove 算 `dx/dy` → `move`；window mouseup 清拖拽态 |
| 8 向缩放 | resize-handle mousedown 设 dragType='resize'+dir；mousemove 按 dir（含 e/w/s/n）算新 w/h/x/y（反向固定对边）；min 40×20 |
| zoom | canvas 容器 onWheel + Ctrl/⌘ → `setZoom(clamp(z + deltaY*-0.001, 0.5, 1.5))`；preventDefault |

> 移动过程不存 history（MVP 无 history）；mouseup 即终态。

---

## 6. 组件渲染 + 属性面板

- `<TextBlock data>`：渲染 `content`，`fontSize/fontWeight/color/bgColor` 内联样式；白底。
- `<ImageBlock data>`：`<img src>`，`object-fit: contain`，无 src 时占位。
- **属性面板**（右侧，仅选中时显示）：文本→`content`(textarea)/`fontSize`/`color`/`bgColor`；图片→`src`(input)；通用→`x/y/w/h`(数字输入)。改值 → `updateComponent`。

---

## 7. 自动保存

- 订阅 store 的 `pages`（浅比较序列化变化）；变更后 **debounce 1.5s** → `PATCH /projects/:id { pages }`。
- 顶栏显示 `saveStatus`：`保存中… / 已保存 / 保存失败`。
- 复用现有 axios client（含 401 自动 refresh）；失败 → `error` 态 + 不丢本地编辑（下次变更重试）。

---

## 8. 路由集成

- `/projects/:id` 由 `ProjectShell.tsx`（占位）改为 `<Editor>` 真编辑器。
- 进入时 `GET /projects/:id` 取 `pages` → `editor.load(project)` 填充 store。
- 顶栏「返回」→ `/projects`（离开前 flush 保存）。

---

## 9. 错误处理

- **加载失败**（404/无权）：编辑区显示「项目不存在或无权访问」+ 返回按钮。
- **保存失败**：顶栏 `保存失败`，保留本地编辑，下次变更重试；连续失败 toast。
- **图片 src 无效**：`<img onError>` 显示占位灰块。

---

## 10. 测试（vitest + @testing-library）

- **store**：`addComponent`/`updateComponent`/`removeComponent`/`move`/`resize` 对 `pages` 的变更正确（含 8 向 resize 各方向、min 尺寸）。
- **组件**：`<TextBlock>`/`<ImageBlock>` 按 data 渲染；属性面板改值触发 `updateComponent`。
- **自动保存**：`pages` 变更 → debounce 后触发 `PATCH`（mock axios；用 `vi.useFakeTimers` 推进 1.5s）。
- 不写 E2E（手动冒烟：登录→进项目→加文本/图片→拖动/缩放/改属性→刷新页面数据还在）。

---

## 11. 待定（实现阶段决定）

- resize 网格吸附（demo 有 10px 吸附）——MVP 先不做，纯自由。
- 属性面板数字输入的步长/单位。
- 离开页面未保存提示（beforeunload）——MVP 靠 debounce + flush，可选加。

---

## 12. demo.html 关键参考行号（供 plan 使用）

state `demo.html:1082`｜history `1312`｜canvas render `1411`｜component render `1514`｜mouse handlers `2219`/`2347`/`2425`｜8 向 resize `2371-2386`｜zoom `1636`｜pages `1356`。
