/**
 * Editor store 类型定义（从 store.ts 拆出）。
 * 纯类型，无运行时依赖，减少 store.ts 体积。
 */
import type {
  EditorComponent,
  Page,
  PageType,
  ProjectDetail,
  ProjectMeta,
  ProjectTheme,
  ReportDataContext,
  ShapeKind,
  ThemeDensity,
  ThemeRadius,
} from '@mediakit/shared';
import type { ComponentData, ComponentType } from '@mediakit/shared';

/** 主题补丁：支持嵌套 color/font 部分更新（深合并），density/radius/preset 直接替换。 */
export type ThemePatch = {
  color?: Partial<ProjectTheme['color']>;
  font?: Partial<ProjectTheme['font']>;
  density?: ThemeDensity;
  radius?: ThemeRadius;
  layout?: Partial<NonNullable<ProjectTheme['layout']>>;
  lineHeight?: Partial<NonNullable<ProjectTheme['lineHeight']>>;
  format?: Partial<NonNullable<ProjectTheme['format']>>;
  chart?: Partial<NonNullable<ProjectTheme['chart']>>;
  shadow?: NonNullable<ProjectTheme['shadow']>;
  branding?: Partial<NonNullable<ProjectTheme['branding']>>;
  background?: Partial<Omit<NonNullable<ProjectTheme['background']>, 'type'>> & {
    type?: NonNullable<ProjectTheme['background']>['type'];
  };
  skinPreset?: NonNullable<ProjectTheme['skinPreset']>;
  preset?: string;
};

/** history 快照：仅 pages + currentPageId（忠实 demo：zoom/尺寸/选中不进 history）。 */
export interface Snapshot {
  pages: Page[];
  currentPageId: string | null;
  /** 快照时的 projectMeta（含主题 theme），用于 setTheme 撤销/重做。 */
  projectMeta: ProjectMeta | null;
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

  loaded: boolean;
  /** 自上次保存后是否有未落库变更（供顶栏展示）。 */
  dirty: boolean;
  /** 每次标脏时递增（即使 dirty 已为 true 也会变化），供 useAutosave effect 依赖。 */
  dirtyTick: number;
  /** 保存请求进行中（供顶栏状态展示）。 */
  saving: boolean;
  /** 最近一次保存失败时的错误信息（成功后清空）。null = 无错误。 */
  saveError: string | null;
  /** 编辑模式：项目（默认）或模板。决定 save() 调 projectsApi 还是 templatesApi。 */
  saveMode: 'project' | 'template';
  /** 报告全局数据上下文（Campaign + 达人）。由「数据配置」面板编辑，存入 projectMeta.reportData。 */
  reportData: ReportDataContext;
  /** 更新报告数据上下文（深合并 projectMeta.reportData，标脏）。 */
  setReportData: (data: ReportDataContext) => void;

  // ---- selectors ----
  currentPage: () => Page | null;
  currentComponents: () => EditorComponent[];
  canUndo: () => boolean;
  canRedo: () => boolean;

  // ---- lifecycle ----
  loadProject: (detail: ProjectDetail, name: string, mode?: 'project' | 'template') => void;
  setProjectName: (name: string) => void;
  /** 报告维度：更新主题（品牌色/字体/密度/圆角），深合并 color/font，标记 dirty。 */
  setTheme: (patch: ThemePatch) => void;
  markSaved: () => void;
  /** 立即把当前编辑结果落库（name/尺寸/pages/meta）。autosave 与手动保存共用此入口。 */
  save: () => Promise<void>;

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
  addShape: (shape: ShapeKind) => void;
  addShapeAt: (shape: ShapeKind, x: number, y: number) => void;
  updateComponent: (id: string, patch: Partial<EditorComponent>) => void;
  sanitizeComponent: (id: string) => void;
  updateComponentData: (id: string, dataPatch: Record<string, unknown>) => void;
  /** 整体替换组件 data（导入数据用），落 history + 标脏。 */
  setComponentData: (id: string, data: ComponentData) => void;
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
  addPageWithComponents: (name: string, components: EditorComponent[], opts?: { titleComponentIndex?: number; pageType?: PageType }) => void;
  addPagesBatch: (pages: { name: string; components: EditorComponent[]; titleComponentIndex?: number; pageType?: PageType }[]) => void;
  copyPage: (id: string) => void;
  deletePage: (id: string) => void;
  renamePage: (id: string, name: string) => void;
  updatePage: (id: string, patch: Partial<Pick<Page, 'name' | 'bgColor' | 'bgGradient' | 'bgImage' | 'pageType' | 'titleComponentId' | 'titleOverridden' | 'campaignId' | 'creatorId'>>) => void;
  /** 页面属性的实时预览更新（不落 history）：用于色板拖动/文本输入过程中。
   *  仅改 pages + 标脏，让画布即时反馈；调用方需在交互结束时（onBlur/onChange 提交）
   *  再调 updatePage() 推一次 history，否则无法撤销。 */
  patchPageLive: (id: string, patch: Partial<Pick<Page, 'name' | 'bgColor' | 'bgGradient' | 'bgImage'>>) => void;
  reorderPage: (from: number, to: number) => void;

  /** 设页面类型；'media-report' 会确保存在标题组件并生成默认标题。 */
  setPageType: (pageId: string, pageType: PageType | undefined) => void;
  /** 「恢复自动」：清除 overridden 并重算标题。 */
  restoreReportTitle: (pageId: string) => void;

  // ---- history ----
  undo: () => void;
  redo: () => void;

  // ---- 预览（M6，不入 history，与 zoom/pan 同理）----
  previewOpen: boolean;
  previewPageIndex: number;
  enterPreview: () => void;
  exitPreview: () => void;
  previewPrev: () => void;
  previewNext: () => void;
  setPreviewPageIndex: (index: number) => void;
}
