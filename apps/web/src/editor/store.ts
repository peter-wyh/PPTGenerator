import { create } from 'zustand';
import type {
  ComponentData,
  ComponentType,
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

/** history 快照：仅 pages + currentPageId（忠实 demo：zoom/尺寸/选中不进 history）。 */
export interface Snapshot {
  pages: Page[];
  currentPageId: string | null;
}

export type ResizeDir = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export interface EditorState {
  projectId: string | null;
  projectName: string;
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

  // ---- pages ----
  setPage: (id: string) => void;
  addPage: () => void;
  deletePage: (id: string) => void;
  renamePage: (id: string, name: string) => void;
  reorderPage: (from: number, to: number) => void;

  // ---- history ----
  undo: () => void;
  redo: () => void;
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
    loaded: false,
    dirty: false,

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
        loaded: true,
        dirty: false,
      });
    },

    markSaved: () => set({ dirty: false }),

    setProjectName: (name) => set({ projectName: name, dirty: true }),

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

    setPage: (id) => mutateAndCommit(() => ({ currentPageId: id, selectedIds: [] })),

    addPage: () =>
      mutateAndCommit((s) => {
        const page: Page = { id: newId(), name: `第 ${s.pages.length + 1} 页`, components: [] };
        return { pages: [...s.pages, page], currentPageId: page.id, selectedIds: [] };
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
