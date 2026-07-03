import { create } from 'zustand';
import type {
  ComponentBinding,
  ComponentData,
  ComponentType,
  Datasource,
  EditorComponent,
  Page,
  ProjectDetail,
} from '@mediakit/shared';
import {
  DEFAULT_SIZES,
  getDefaultData,
  HISTORY_CAP,
  MIN_H,
  MIN_W,
  MOVE_SNAP,
} from './defaults';
import { getBusinessItem, getLayout } from './business/catalog';

/** history 快照：仅 pages + currentPageId（忠实 demo：zoom/尺寸/选中不进 history）。 */
export interface Snapshot {
  pages: Page[];
  currentPageId: string | null;
}

export type ResizeDir = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
export type Alignment = 'left' | 'center-h' | 'right' | 'top' | 'middle-v' | 'bottom';

export interface EditorState {
  projectId: string | null;
  projectName: string;
  /** 项目元数据（业务线/场景等），供顶栏展示。 */
  projectMeta: import('@mediakit/shared').ProjectMeta | null;
  canvasWidth: number;
  canvasHeight: number;
  pages: Page[];
  currentPageId: string | null;
  selectedIds: string[];

  history: Snapshot[];
  historyIndex: number;
  clipboard: EditorComponent[] | null;

  zoom: number;
  panX: number;
  panY: number;
  isPanning: boolean;

  /** 数据源（M5，会话级，未持久化到后端）。 */
  datasources: Datasource[];

  loaded: boolean;
  /** 自上次保存后是否有未落库变更（供 autosave）。 */
  dirty: boolean;

  // ---- selectors ----
  currentPage: () => Page | null;
  currentComponents: () => EditorComponent[];
  canUndo: () => boolean;
  canRedo: () => boolean;

  // ---- lifecycle ----
  loadProject: (detail: ProjectDetail, name: string) => void;
  setProjectName: (name: string) => void;
  /** 报告维度：更新主题（品牌色等），合并进 projectMeta 并标记 dirty。 */
  setTheme: (theme: Partial<import('@mediakit/shared').ProjectTheme>) => void;
  markSaved: () => void;

  // ---- view ----
  setZoom: (z: number) => void;
  zoomByDelta: (delta: number) => void;
  setPan: (x: number, y: number) => void;
  setPanning: (p: boolean) => void;

  // ---- selection ----
  select: (id: string, additive?: boolean) => void;
  clearSelection: () => void;
  selectAll: () => void;

  // ---- components ----
  addComponent: (type: ComponentType) => void;
  addComponentAt: (type: ComponentType, x: number, y: number) => void;
  addBusinessBlock: (kind: string) => void;
  addBusinessBlockAt: (kind: string, x: number, y: number) => void;
  updateComponent: (id: string, patch: Partial<EditorComponent>) => void;
  updateComponentData: (id: string, dataPatch: Record<string, unknown>) => void;
  move: (ids: string[], dx: number, dy: number) => void;
  resize: (
    id: string,
    dir: ResizeDir,
    dx: number,
    dy: number,
    start: { x: number; y: number; w: number; h: number },
  ) => void;
  commit: () => void; // 拖动结束落 history
  deleteSelected: () => void;
  duplicateSelected: () => void;
  nudge: (dx: number, dy: number) => void;
  copy: () => void;
  cut: () => void;
  paste: () => void;

  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  toggleLock: (id: string) => void;

  // ---- 多选：对齐 / 分布 / 等宽等高 ----
  alignComponents: (ids: string[], alignment: Alignment) => void;
  distributeH: (ids: string[]) => void;
  distributeV: (ids: string[]) => void;
  equalWidth: (ids: string[]) => void;
  equalHeight: (ids: string[]) => void;

  // ---- pages ----
  setPage: (id: string) => void;
  addPage: () => void;
  addPageWithComponents: (name: string, components: EditorComponent[]) => void;
  addPagesBatch: (pages: { name: string; components: EditorComponent[] }[]) => void;
  copyPage: (id: string) => void;
  deletePage: (id: string) => void;
  renamePage: (id: string, name: string) => void;
  updatePage: (id: string, patch: Partial<Pick<Page, 'name' | 'bgColor' | 'bgImage'>>) => void;
  reorderPage: (from: number, to: number) => void;

  // ---- history ----
  undo: () => void;
  redo: () => void;

  // ---- 数据源（M5）----
  addDatasource: (ds: Datasource) => void;
  removeDatasource: (id: string) => void;
  bindComponent: (id: string, binding: ComponentBinding | null) => void;

  // ---- 预览（M6，不入 history，与 zoom/pan 同理）----
  previewOpen: boolean;
  previewPageIndex: number;
  enterPreview: () => void;
  exitPreview: () => void;
  previewPrev: () => void;
  previewNext: () => void;
  setPreviewPageIndex: (index: number) => void;
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function clone<T>(v: T): T {
  return structuredClone ? structuredClone(v) : JSON.parse(JSON.stringify(v));
}

/** 在当前页上不可变地变换组件数组。 */
function withCurrentComponents(
  pages: Page[],
  currentPageId: string | null,
  fn: (comps: EditorComponent[]) => EditorComponent[],
): Page[] {
  return pages.map((p) => (p.id === currentPageId ? { ...p, components: fn(p.components) } : p));
}

function centered(w: number, h: number, cw: number, ch: number): { x: number; y: number } {
  return { x: Math.max(0, Math.floor((cw - w) / 2)), y: Math.max(0, Math.floor((ch - h) / 2)) };
}

/** 把拖放落点 (鼠标位置) 转为组件左上角坐标：以落点为中心、网格吸附、钳制在画布内。 */
function placed(
  w: number,
  h: number,
  cx: number,
  cy: number,
  cw: number,
  ch: number,
): { x: number; y: number } {
  const x = Math.round(Math.max(0, Math.min(cx - w / 2, cw - w)) / MOVE_SNAP) * MOVE_SNAP;
  const y = Math.round(Math.max(0, Math.min(cy - h / 2, ch - h)) / MOVE_SNAP) * MOVE_SNAP;
  return { x, y };
}

export const useEditorStore = create<EditorState>((set, get) => {
  /** 把当前 {pages, currentPageId} 推入 history（丢弃 redo 尾，限 50）。 */
  function pushHistory(): void {
    const { pages, currentPageId, history, historyIndex } = get();
    const snapshot: Snapshot = { pages: clone(pages), currentPageId };
    const next = history.slice(0, historyIndex + 1);
    next.push(snapshot);
    while (next.length > HISTORY_CAP) next.shift();
    set({ history: next, historyIndex: next.length - 1 });
  }

  /** 变换后自动落 history + 标脏（用于离散动作：增删/改属性/页面操作）。 */
  function mutateAndCommit(updater: (s: EditorState) => Partial<EditorState>): void {
    set(updater);
    pushHistory();
    set({ dirty: true });
  }

  return {
    projectId: null,
    projectName: '未命名项目',
    projectMeta: null,
    canvasWidth: 1280,
    canvasHeight: 720,
    pages: [],
    currentPageId: null,
    selectedIds: [],
    history: [],
    historyIndex: -1,
    clipboard: null,
    zoom: 1,
    panX: 0,
    panY: 0,
    isPanning: false,
    datasources: [],
    loaded: false,
    dirty: false,
    previewOpen: false,
    previewPageIndex: 0,

    currentPage: () => get().pages.find((p) => p.id === get().currentPageId) ?? null,
    currentComponents: () => get().currentPage()?.components ?? [],
    canUndo: () => get().historyIndex > 0,
    canRedo: () => get().historyIndex < get().history.length - 1,

    loadProject(detail, name) {
      const pages = detail.pages.length
        ? detail.pages
        : [{ id: newId(), name: '第 1 页', components: [] }];
      const snapshot: Snapshot = { pages: clone(pages), currentPageId: pages[0].id };
      set({
        projectId: detail.id,
        projectName: name,
        projectMeta: detail.meta ?? null,
        canvasWidth: detail.width,
        canvasHeight: detail.height,
        pages,
        currentPageId: pages[0].id,
        selectedIds: [],
        history: [snapshot],
        historyIndex: 0,
        clipboard: null,
        zoom: 1,
        panX: 0,
        panY: 0,
        datasources: [],
        loaded: true,
        dirty: false,
      });
    },

    markSaved: () => set({ dirty: false }),

    setProjectName: (name) => set({ projectName: name, dirty: true }),

    setTheme: (theme) =>
      set((s) => ({
        dirty: true,
        projectMeta: {
          ...(s.projectMeta ?? {}),
          theme: { ...(s.projectMeta?.theme ?? {}), ...theme },
        },
      })),

    setZoom: (z) => set({ zoom: Math.round(z * 100) / 100 }),
    zoomByDelta: (delta) =>
      set((s) => ({
        zoom: Math.max(0.1, Math.min(2, Math.round((s.zoom - delta * 0.001) * 100) / 100)),
      })),
    setPan: (x, y) => set({ panX: x, panY: y }),
    setPanning: (p) => set({ isPanning: p }),

    select: (id, additive) =>
      set((s) => {
        if (additive) {
          const has = s.selectedIds.includes(id);
          return { selectedIds: has ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id] };
        }
        return { selectedIds: [id] };
      }),
    clearSelection: () => set({ selectedIds: [] }),
    selectAll: () =>
      set((s) => ({ selectedIds: (s.currentPage()?.components ?? []).map((c) => c.id) })),

    addComponent: (type) =>
      mutateAndCommit((s) => {
        const size = DEFAULT_SIZES[type] ?? { w: 300, h: 200 };
        const { x, y } = centered(size.w, size.h, s.canvasWidth, s.canvasHeight);
        const comp: EditorComponent = {
          id: newId(),
          type,
          x,
          y,
          w: size.w,
          h: size.h,
          data: getDefaultData(type),
        };
        return {
          pages: withCurrentComponents(s.pages, s.currentPageId, (cs) => [...cs, comp]),
          selectedIds: [comp.id],
        };
      }),

    addBusinessBlock: (kind) =>
      mutateAndCommit((s) => {
        const layout = getLayout(kind);
        const item = getBusinessItem(kind);
        const { x, y } = centered(layout.w, layout.h, s.canvasWidth, s.canvasHeight);
        const comp: EditorComponent = {
          id: newId(),
          type: 'business-block',
          x,
          y,
          w: layout.w,
          h: layout.h,
          data: {
            businessKind: kind,
            layoutForm: layout.form,
            title: item.title,
            meta: item.meta,
            details: [...item.details],
            variant: 'standard',
          },
        };
        return {
          pages: withCurrentComponents(s.pages, s.currentPageId, (cs) => [...cs, comp]),
          selectedIds: [comp.id],
        };
      }),

    addComponentAt: (type, cx, cy) =>
      mutateAndCommit((s) => {
        const size = DEFAULT_SIZES[type] ?? { w: 300, h: 200 };
        const { x, y } = placed(size.w, size.h, cx, cy, s.canvasWidth, s.canvasHeight);
        const comp: EditorComponent = { id: newId(), type, x, y, w: size.w, h: size.h, data: getDefaultData(type) };
        return {
          pages: withCurrentComponents(s.pages, s.currentPageId, (cs) => [...cs, comp]),
          selectedIds: [comp.id],
        };
      }),

    addBusinessBlockAt: (kind, cx, cy) =>
      mutateAndCommit((s) => {
        const layout = getLayout(kind);
        const item = getBusinessItem(kind);
        const { x, y } = placed(layout.w, layout.h, cx, cy, s.canvasWidth, s.canvasHeight);
        const comp: EditorComponent = {
          id: newId(),
          type: 'business-block',
          x,
          y,
          w: layout.w,
          h: layout.h,
          data: {
            businessKind: kind,
            layoutForm: layout.form,
            title: item.title,
            meta: item.meta,
            details: [...item.details],
            variant: 'standard',
          },
        };
        return {
          pages: withCurrentComponents(s.pages, s.currentPageId, (cs) => [...cs, comp]),
          selectedIds: [comp.id],
        };
      }),

    // 拖动期间的实时更新：不落 history（在 commit() 统一落）。
    updateComponent: (id, patch) =>
      set((s) => ({
        dirty: true,
        pages: withCurrentComponents(s.pages, s.currentPageId, (cs) =>
          cs.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        ),
      })),

    updateComponentData: (id, dataPatch) =>
      mutateAndCommit((s) => ({
        pages: withCurrentComponents(s.pages, s.currentPageId, (cs) =>
          cs.map((c) =>
            c.id === id
              ? { ...c, data: { ...(c.data as object), ...dataPatch } as unknown as ComponentData }
              : c,
          ),
        ),
      })),

    move: (ids, dx, dy) =>
      set((s) => ({
        dirty: true,
        pages: withCurrentComponents(s.pages, s.currentPageId, (cs) =>
          cs.map((c) => {
            if (!ids.includes(c.id) || c.locked) return c;
            const nx = Math.round((c.x + dx) / MOVE_SNAP) * MOVE_SNAP;
            const ny = Math.round((c.y + dy) / MOVE_SNAP) * MOVE_SNAP;
            return { ...c, x: nx, y: ny };
          }),
        ),
      })),

    resize: (id, dir, dx, dy, start) =>
      set((s) => ({
        dirty: true,
        pages: withCurrentComponents(s.pages, s.currentPageId, (cs) =>
          cs.map((c) => {
            if (c.id !== id) return c;
            let { x, y, w, h } = start;
            if (dir.includes('e')) w = Math.max(MIN_W, start.w + dx);
            if (dir.includes('w')) {
              w = Math.max(MIN_W, start.w - dx);
              x = start.x + start.w - w;
            }
            if (dir.includes('s')) h = Math.max(MIN_H, start.h + dy);
            if (dir.includes('n')) {
              h = Math.max(MIN_H, start.h - dy);
              y = start.y + start.h - h;
            }
            return { ...c, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
          }),
        ),
      })),

    commit: () => {
      pushHistory();
    },

    deleteSelected: () =>
      mutateAndCommit((s) => ({
        pages: withCurrentComponents(s.pages, s.currentPageId, (cs) =>
          cs.filter((c) => !s.selectedIds.includes(c.id)),
        ),
        selectedIds: [],
      })),

    duplicateSelected: () =>
      mutateAndCommit((s) => {
        const cur = s.currentPage()?.components ?? [];
        const dupes = cur
          .filter((c) => s.selectedIds.includes(c.id))
          .map((c) => ({ ...clone(c), id: newId(), x: c.x + 20, y: c.y + 20 }));
        return {
          pages: withCurrentComponents(s.pages, s.currentPageId, (cs) => [...cs, ...dupes]),
          selectedIds: dupes.map((c) => c.id),
        };
      }),

    nudge: (dx, dy) =>
      mutateAndCommit((s) => ({
        pages: withCurrentComponents(s.pages, s.currentPageId, (cs) =>
          cs.map((c) =>
            s.selectedIds.includes(c.id) && !c.locked ? { ...c, x: c.x + dx, y: c.y + dy } : c,
          ),
        ),
      })),

    copy: () =>
      set((s) => {
        const cur = s.currentPage()?.components ?? [];
        return { clipboard: cur.filter((c) => s.selectedIds.includes(c.id)).map((c) => clone(c)) };
      }),

    cut: () =>
      mutateAndCommit((s) => {
        const cur = s.currentPage()?.components ?? [];
        return {
          clipboard: cur.filter((c) => s.selectedIds.includes(c.id)).map((c) => clone(c)),
          pages: withCurrentComponents(s.pages, s.currentPageId, (cs) =>
            cs.filter((c) => !s.selectedIds.includes(c.id)),
          ),
          selectedIds: [],
        };
      }),

    paste: () => {
      const clip = get().clipboard;
      if (!clip || clip.length === 0) return;
      mutateAndCommit((s) => {
        const pasted = clip.map((c) => ({ ...clone(c), id: newId(), x: c.x + 20, y: c.y + 20 }));
        return {
          pages: withCurrentComponents(s.pages, s.currentPageId, (cs) => [...cs, ...pasted]),
          selectedIds: pasted.map((c) => c.id),
        };
      });
    },

    bringForward: (id) =>
      mutateAndCommit((s) => ({
        pages: withCurrentComponents(s.pages, s.currentPageId, (cs) => moveItem(cs, id, 1)),
      })),
    sendBackward: (id) =>
      mutateAndCommit((s) => ({
        pages: withCurrentComponents(s.pages, s.currentPageId, (cs) => moveItem(cs, id, -1)),
      })),
    bringToFront: (id) =>
      mutateAndCommit((s) => ({
        pages: withCurrentComponents(s.pages, s.currentPageId, (cs) => [
          ...cs.filter((c) => c.id !== id),
          ...cs.filter((c) => c.id === id),
        ]),
      })),
    sendToBack: (id) =>
      mutateAndCommit((s) => ({
        pages: withCurrentComponents(s.pages, s.currentPageId, (cs) => [
          ...cs.filter((c) => c.id === id),
          ...cs.filter((c) => c.id !== id),
        ]),
      })),

    toggleLock: (id) =>
      mutateAndCommit((s) => ({
        pages: withCurrentComponents(s.pages, s.currentPageId, (cs) =>
          cs.map((c) => (c.id === id ? { ...c, locked: !c.locked } : c)),
        ),
      })),

    alignComponents: (ids, alignment) =>
      mutateAndCommit((s) => ({
        pages: withCurrentComponents(s.pages, s.currentPageId, (cs) => alignInPlace(cs, ids, alignment)),
      })),

    distributeH: (ids) =>
      mutateAndCommit((s) => ({
        pages: withCurrentComponents(s.pages, s.currentPageId, (cs) => distribute(cs, ids, 'h')),
      })),

    distributeV: (ids) =>
      mutateAndCommit((s) => ({
        pages: withCurrentComponents(s.pages, s.currentPageId, (cs) => distribute(cs, ids, 'v')),
      })),

    equalWidth: (ids) =>
      mutateAndCommit((s) => ({
        pages: withCurrentComponents(s.pages, s.currentPageId, (cs) => equalize(cs, ids, 'w')),
      })),

    equalHeight: (ids) =>
      mutateAndCommit((s) => ({
        pages: withCurrentComponents(s.pages, s.currentPageId, (cs) => equalize(cs, ids, 'h')),
      })),

    setPage: (id) => mutateAndCommit(() => ({ currentPageId: id, selectedIds: [] })),

    addPage: () =>
      mutateAndCommit((s) => {
        const page: Page = { id: newId(), name: `第 ${s.pages.length + 1} 页`, components: [] };
        return { pages: [...s.pages, page], currentPageId: page.id, selectedIds: [] };
      }),

    addPageWithComponents: (name, components) =>
      mutateAndCommit((s) => {
        // 模板带入的组件重新分配 id，避免与现有冲突。
        const reid = components.map((c) => ({ ...clone(c), id: newId() }));
        const page: Page = { id: newId(), name, components: reid };
        return { pages: [...s.pages, page], currentPageId: page.id, selectedIds: [] };
      }),

    addPagesBatch: (pages) =>
      mutateAndCommit((s) => {
        // 一次生成多页（场景模板用），每页组件重新分配 id，单个 history 条目。
        const built: Page[] = pages.map((p) => ({
          id: newId(),
          name: p.name,
          components: p.components.map((c) => ({ ...clone(c), id: newId() })),
        }));
        if (built.length === 0) return {};
        return { pages: [...s.pages, ...built], currentPageId: built[0].id, selectedIds: [] };
      }),

    copyPage: (id) =>
      mutateAndCommit((s) => {
        const src = s.pages.find((p) => p.id === id);
        if (!src) return {};
        const copied: Page = {
          id: newId(),
          name: `${src.name} (副本)`,
          components: src.components.map((c) => ({ ...clone(c), id: newId() })),
        };
        // 插入到原页之后。
        const idx = s.pages.findIndex((p) => p.id === id);
        const pages = [...s.pages];
        pages.splice(idx + 1, 0, copied);
        return { pages };
      }),

    deletePage: (id) =>
      mutateAndCommit((s) => {
        if (s.pages.length <= 1) return {};
        const pages = s.pages.filter((p) => p.id !== id);
        const currentPageId =
          s.currentPageId === id ? pages[0].id : s.currentPageId ?? pages[0].id;
        return { pages, currentPageId, selectedIds: [] };
      }),

    renamePage: (id, name) =>
      mutateAndCommit((s) => ({
        pages: s.pages.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p)),
      })),

    updatePage: (id, patch) =>
      mutateAndCommit((s) => ({
        pages: s.pages.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      })),

    reorderPage: (from, to) =>
      mutateAndCommit((s) => {
        const pages = [...s.pages];
        const [moved] = pages.splice(from, 1);
        pages.splice(to, 0, moved);
        return { pages };
      }),

    undo: () => {
      const { historyIndex, history } = get();
      if (historyIndex <= 0) return;
      const i = historyIndex - 1;
      const snap = history[i];
      set({
        pages: clone(snap.pages),
        currentPageId: snap.currentPageId,
        selectedIds: [],
        historyIndex: i,
      });
    },

    redo: () => {
      const { historyIndex, history } = get();
      if (historyIndex >= history.length - 1) return;
      const i = historyIndex + 1;
      const snap = history[i];
      set({
        pages: clone(snap.pages),
        currentPageId: snap.currentPageId,
        selectedIds: [],
        historyIndex: i,
      });
    },

    addDatasource: (ds) => set((s) => ({ datasources: [...s.datasources, ds] })),

    removeDatasource: (id) =>
      set((s) => ({ datasources: s.datasources.filter((d) => d.id !== id) })),

    bindComponent: (id, binding) =>
      mutateAndCommit((s) => ({
        pages: withCurrentComponents(s.pages, s.currentPageId, (cs) =>
          cs.map((c) => (c.id === id ? { ...c, binding: binding ?? undefined } : c)),
        ),
      })),

    // ---- 预览（M6）：纯视图，set() 不入 history ----
    enterPreview: () => {
      const { pages, currentPageId } = get();
      const idx = pages.findIndex((p) => p.id === currentPageId);
      set({ previewOpen: true, previewPageIndex: idx < 0 ? 0 : idx });
    },
    exitPreview: () => set({ previewOpen: false }),
    previewPrev: () =>
      set((s) => ({ previewPageIndex: Math.max(0, s.previewPageIndex - 1) })),
    previewNext: () =>
      set((s) => ({
        previewPageIndex: Math.min(Math.max(0, s.pages.length - 1), s.previewPageIndex + 1),
      })),
    setPreviewPageIndex: (index) =>
      set((s) => ({
        previewPageIndex: Math.min(Math.max(0, s.pages.length - 1), Math.max(0, index)),
      })),
  };
});

/** 在数组中把 id 项朝 end 方向移动 step（越界保持原位）。返回新数组。 */
function moveItem(comps: EditorComponent[], id: string, step: 1 | -1): EditorComponent[] {
  const idx = comps.findIndex((c) => c.id === id);
  if (idx === -1) return comps;
  const target = idx + step;
  if (target < 0 || target >= comps.length) return comps;
  const next = [...comps];
  [next[idx], next[target]] = [next[target], next[idx]];
  return next;
}

/** 多选对齐：按选中组件 bbox 计算，原地改 x/y。 */
function alignInPlace(comps: EditorComponent[], ids: string[], alignment: Alignment): EditorComponent[] {
  const sel = comps.filter((c) => ids.includes(c.id));
  if (sel.length < 2) return comps;
  const minX = Math.min(...sel.map((c) => c.x));
  const maxX = Math.max(...sel.map((c) => c.x + c.w));
  const minY = Math.min(...sel.map((c) => c.y));
  const maxY = Math.max(...sel.map((c) => c.y + c.h));
  return comps.map((c) => {
    if (!ids.includes(c.id)) return c;
    let { x, y } = c;
    if (alignment === 'left') x = minX;
    else if (alignment === 'right') x = maxX - c.w;
    else if (alignment === 'center-h') x = Math.round((minX + maxX) / 2 - c.w / 2);
    else if (alignment === 'top') y = minY;
    else if (alignment === 'bottom') y = maxY - c.h;
    else if (alignment === 'middle-v') y = Math.round((minY + maxY) / 2 - c.h / 2);
    return { ...c, x: Math.round(x), y: Math.round(y) };
  });
}

/** 多选分布：沿水平/垂直方向均匀排布间距（保持顺序，首尾不动）。 */
function distribute(comps: EditorComponent[], ids: string[], axis: 'h' | 'v'): EditorComponent[] {
  const sel = comps.filter((c) => ids.includes(c.id));
  if (sel.length < 3) return comps;
  const pos = (c: EditorComponent, start: boolean) => (axis === 'h' ? (start ? c.x : c.x + c.w) : start ? c.y : c.y + c.h);
  const sorted = [...sel].sort((a, b) => pos(a, true) - pos(b, true));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const startEdge = pos(first, true);
  const endEdge = pos(last, false);
  const totalSize = sorted.reduce((acc, c) => acc + (axis === 'h' ? c.w : c.h), 0);
  const gap = (endEdge - startEdge - totalSize) / (sorted.length - 1);
  let cursor = startEdge;
  const newPos = new Map<string, number>();
  for (const c of sorted) {
    newPos.set(c.id, cursor);
    cursor += (axis === 'h' ? c.w : c.h) + gap;
  }
  return comps.map((c) => {
    if (!ids.includes(c.id)) return c;
    const np = newPos.get(c.id);
    if (np === undefined) return c;
    return axis === 'h' ? { ...c, x: Math.round(np) } : { ...c, y: Math.round(np) };
  });
}

/** 多选等宽/等高：全部设为均值。 */
function equalize(comps: EditorComponent[], ids: string[], dim: 'w' | 'h'): EditorComponent[] {
  const sel = comps.filter((c) => ids.includes(c.id));
  if (sel.length < 2) return comps;
  const avg = Math.round(sel.reduce((acc, c) => acc + c[dim], 0) / sel.length);
  return comps.map((c) => (ids.includes(c.id) ? { ...c, [dim]: avg } : c));
}
