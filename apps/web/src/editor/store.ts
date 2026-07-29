import { create } from 'zustand';
import type {
  ComponentData,
  EditorComponent,
  Page,
  PageGradient,
  ProjectMeta,
  ProjectTheme,
  ReportDataContext,
  ReportCreator,
  TitleBlockData,
} from '@mediakit/shared';
import { buildReportTitle, DEFAULT_THEME, normalizeTheme, pageCategory } from '@mediakit/shared';
import {
  DEFAULT_SIZES,
  getDefaultData,
  getDefaultShapeData,
  HISTORY_CAP,
  MIN_H,
  MIN_W,
  DEFAULT_GRID_SIZE,
  titleHeightForFontSize,
} from './defaults';
import { snapMove, snapResize, clampRect, clampResize } from './snap';
import { getBusinessItem, getLayout } from './business/catalog';
import { getTemplate, getTemplateByPageType } from './templates';
import { applyPageBinding as applyPageBindingReducer } from './pageBinding';
import { projectsApi } from '@/api/projects';
import { templatesApi } from '@/api/templates';
import { creatorAvatarUrl } from '@/api/creatorAvatar';
import { getAccessToken } from '@/api/client';
import { toast } from '../components/Toast';

// 拆分的类型 + 工具函数（re-export 保持向后兼容）
export type { ThemePatch, Snapshot, ResizeDir, Alignment, EditorState } from './store-types';
import type { EditorState } from './store-types';
import type { Snapshot } from './store-types';
import {
  newId,
  clone,
  withCurrentComponents,
  centered,
  placed,
  snapCtx,
  clampSafeFrom,
  moveItem,
  alignInPlace,
  distribute,
  equalize,
} from './store-helpers';

/**
 * 合并 reportData 中两类达人（campaignCreators + creators），按 id 去重。
 * campaignCreators 优先（靠前）。
 *
 * 回填 avatar：旧项目持久化的达人可能没有 avatar 字段（修复前导入的），
 * 按 name 确定性补一张 picsum 占位图，保证所有消费方（头像卡/达人列表/…）
 * 取到的达人都有头像，不会落到字母兜底。
 */
export function allReportCreators(reportData: ReportDataContext): ReportCreator[] {
  const cc = reportData.campaignCreators ?? [];
  const lc = reportData.creators ?? [];
  const seen = new Set(cc.map((c) => c.id));
  const enrich = (c: ReportCreator): ReportCreator => {
    let enriched = c.avatar ? c : { ...c, avatar: creatorAvatarUrl(c.name) };
    // 旧项目达人数据可能缺少 audience（历史 DataConfigOverlay 未映射）
    // 用确定性哈希生成 fallback audience，保证同一达人 ID 始终生成相同数据
    if (!enriched.audience || (!enriched.audience.ageRange?.length && !enriched.audience.genderSplit?.length)) {
      enriched = { ...enriched, audience: buildFallbackAudience(c.id) };
    }
    return enriched;
  };
  return [...cc, ...lc.filter((c) => !seen.has(c.id))].map(enrich);
}

/**
 * 基于达人 ID 的确定性哈希生成 fallback audience 数据。
 * 用于补全旧项目达人缺失的受众画像。
 *
 * 使用双重哈希（高位+低位）产生足够分散的随机值，
 * 确保不同达人之间的画像数据有明显差异。
 */
function buildFallbackAudience(id: string): NonNullable<ReportCreator['audience']> {
  // 双重哈希：取 ID 不同区段产生独立随机种子
  let h1 = 0, h2 = 0;
  for (let i = 0; i < id.length; i++) {
    const ch = id.charCodeAt(i);
    h1 = ((h1 << 5) - h1 + ch) | 0;
    h2 = ((h2 << 7) - h2 + ch * 31) | 0;
  }
  const seed1 = Math.abs(h1);
  const seed2 = Math.abs(h2);

  // 性别：30%~80% 女性分布
  const female = 30 + (seed1 % 51);
  // 年龄分布基线（可被 seed2 偏移）
  const ageBases = [
    { label: '18-24', base: 15 + (seed2 % 20) },
    { label: '25-34', base: 30 + (seed1 % 20) },
    { label: '35-44', base: 15 + (seed2 % 18) },
    { label: '45+', base: 8 + (seed1 % 15) },
  ];
  const ageSum = ageBases.reduce((s, x) => s + x.base, 0) || 1;
  // 城市
  const cityPool = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Miami', 'Seattle'];
  const cityStart = seed1 % cityPool.length;
  const cities = [0, 1, 2, 3].map((i) => cityPool[(cityStart + i) % cityPool.length]);
  const cityBases = [
    25 + (seed2 % 12),
    18 + (seed1 % 10),
    12 + (seed2 % 8),
    8 + (seed1 % 7),
  ];
  const citySum = cityBases.reduce((s, x) => s + x, 0) || 1;
  return {
    genderSplit: [
      { label: 'Female', value: female },
      { label: 'Male', value: 100 - female },
    ],
    ageRange: ageBases.map((a) => ({ label: a.label, value: Math.round((a.base / ageSum) * 100) })),
    topCities: cities.map((label, i) => ({ label, value: Math.round((cityBases[i] / citySum) * 100) })),
  };
}

/**
 * HMR 回填 / 刷盘 时需要保留的「数据字段」白名单。
 * 故意排除 action 函数（save / loadProject / …）：它们的闭包绑定到具体 store 实例，
 * 回填旧 action 会让它指向已废弃的旧 store。新 store 自带全新 action。
 */
export const PERSIST_KEYS = [
  'projectId', 'projectName', 'projectMeta', 'canvasWidth', 'canvasHeight',
  'pages', 'currentPageId', 'selectedIds', 'history', 'historyIndex', 'clipboard',
  'zoom', 'panX', 'panY', 'isPanning', 'loaded', 'dirty', 'dirtyTick',
  'saving', 'saveError', 'saveMode', 'reportData', 'previewOpen', 'previewPageIndex',
] as const;

/** 从 EditorState 中挑出数据字段（不含 action），用于 HMR 回填。 */
export function pickPersistableState(s: EditorState): Partial<EditorState> {
  const out: Partial<EditorState> = {};
  const sink = out as Record<string, unknown>;
  for (const k of PERSIST_KEYS) sink[k] = s[k];
  return out;
}

export const useEditorStore = create<EditorState>((set, get) => {
  /** 把当前 {pages, currentPageId} 推入 history（丢弃 redo 尾，限 50）。 */
  function pushHistory(): void {
    const { pages, currentPageId, projectMeta, history, historyIndex } = get();
    const snapshot: Snapshot = { pages: clone(pages), currentPageId, projectMeta: clone(projectMeta) };
    const next = history.slice(0, historyIndex + 1);
    next.push(snapshot);
    while (next.length > HISTORY_CAP) next.shift();
    set({ history: next, historyIndex: next.length - 1 });
  }

  /** 变换后自动落 history + 标脏（用于离散动作：增删/改属性/页面操作）。 */
  function mutateAndCommit(updater: (s: EditorState) => Partial<EditorState>): void {
    const result = updater(get());
    if (Object.keys(result).length === 0) return; // 空操作不污染历史栈
    set(result);
    pushHistory();
    markDirty();
  }

  /** 标脏：设 dirty=true 并递增 dirtyTick（确保 useAutosave effect 重新触发）。 */
  function markDirty(): void {
    set((s) => ({ dirty: true, dirtyTick: s.dirtyTick + 1 }));
  }

  /** 构造一个大号文本组件作为页面标题。 */
  function makeTitleComponent(content: string): EditorComponent {
    return {
      id: newId(),
      type: 'text',
      x: 120,
      y: 240,
      w: 1000,
      h: 120,
      data: { content, fontSize: 56, fontWeight: 700, fontFamily: '', color: 'var(--foreground-primary)' },
    };
  }

  /** 重算并写回某投放报告页的标题（仅 pageType='media-report' 且未 overridden）。 */
  function refreshReportTitle(pageId: string) {
    const s = get();
    const p = s.pages.find((pg) => pg.id === pageId);
    if (!p || pageCategory(p.pageType) !== 'media-report' || p.titleOverridden) return;
    const title = buildReportTitle(s.projectMeta ?? {});
    const titleId = p.titleComponentId;
    const titleComp = titleId ? p.components.find((c) => c.id === titleId && c.type === 'text') : undefined;
    const currentContent = titleComp ? (titleComp.data as { content?: string }).content : undefined;
    if (p.name === title && currentContent === title) return; // 无变化不标脏
    set((s) => ({
      dirty: true,
      dirtyTick: s.dirtyTick + 1,
      pages: s.pages.map((pg) => {
        if (pg.id !== pageId) return pg;
        if (!titleComp) {
          const created = makeTitleComponent(title);
          return { ...pg, name: title, components: [created, ...pg.components], titleComponentId: created.id };
        }
        return {
          ...pg,
          name: title,
          components: pg.components.map((c) =>
            c.id === titleId ? { ...c, data: { ...(c.data as object), content: title } as unknown as ComponentData } : c,
          ),
        };
      }),
    }));
  }
  function refreshAllReportTitles() {
    get().pages.forEach((p) => {
      if (pageCategory(p.pageType) === 'media-report' && !p.titleOverridden) refreshReportTitle(p.id);
    });
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
    _pasteCount: 0,
    zoom: 1,
    panX: 0,
    panY: 0,
    isPanning: false,
    loaded: false,
    dirty: false,
    dirtyTick: 0,
    saving: false,
    saveError: null,
    saveMode: 'project',
    reportData: {},
    previewOpen: false,
    previewPageIndex: 0,

    currentPage: () => get().pages.find((p) => p.id === get().currentPageId) ?? null,
    currentComponents: () => get().currentPage()?.components ?? [],
    canUndo: () => get().historyIndex > 0,
    canRedo: () => get().historyIndex < get().history.length - 1,

    loadProject(detail, name, mode) {
      const pages = detail.pages.length
        ? detail.pages
        : [{ id: newId(), name: '第 1 页', components: [] }];
      // 加载项目时归一化主题：兼容旧扁平形状 { primary, secondary, fontFamily }。
      const rawMeta: ProjectMeta | null = detail.meta ?? null;
      const projectMeta = rawMeta
        ? { ...rawMeta, theme: normalizeTheme(rawMeta.theme) }
        : null;
      const snapshot: Snapshot = { pages: clone(pages), currentPageId: pages[0].id, projectMeta: clone(projectMeta) };
      set({
        projectId: detail.id,
        projectName: name,
        projectMeta,
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
        saving: false,
        saveError: null,
        // 编辑模式：决定 save() 落库到 projects 还是 templates。
        saveMode: mode ?? 'project',
        // 报告全局数据上下文：从 projectMeta.reportData 初始化。
        reportData: projectMeta?.reportData ?? {},
      });
      refreshAllReportTitles();
    },

    markSaved: () => set({ dirty: false }),

    setReportData(data) {
      const s = get();
      const nextMeta: ProjectMeta = { ...(s.projectMeta ?? {}), reportData: data };
      // 当达人列表更新时，为未绑定 creatorId 的 creator-case / creator-collab 页面自动分配达人
      const allCr = allReportCreators(data);
      let crIdx = 0;
      let pages = s.pages.map((p) => {
        const cat = pageCategory(p.pageType);
        if ((cat === 'creator-case' || cat === 'creator-collab') && !p.creatorId && allCr.length > 0) {
          const cr = allCr[crIdx % allCr.length];
          crIdx++;
          return { ...p, creatorId: cr.id };
        }
        return p;
      });
      // 如果有页面被更新了 creatorId，重新跑一次绑定填充数据
      if (crIdx > 0) {
        for (const p of pages) {
          const cat = pageCategory(p.pageType);
          if (cat === 'creator-case' || cat === 'creator-collab') {
            pages = applyPageBindingReducer(pages, p.id, data, new Set(p.components.map((c) => c.id)), s.projectMeta);
          }
        }
      }
      set({ reportData: data, projectMeta: nextMeta, pages, dirty: true, dirtyTick: s.dirtyTick + 1 });
    },

    async save() {
      const s = get();
      // 无项目 / 无未保存改动 / 已有保存进行中 → 跳过。
      if (!s.projectId || !s.dirty || s.saving) return;
      const payload = {
        name: s.projectName,
        width: s.canvasWidth,
        height: s.canvasHeight,
        pages: s.pages,
        meta: s.projectMeta ?? undefined,
      };
      // 用序列化签名判断保存期间是否有新改动：若一致才清 dirty，否则保留待 autosave 重试。
      const sig = JSON.stringify(payload);
      set({ saving: true });
      try {
        // 按编辑模式分流：模板落 templates，项目落 projects。
        if (s.saveMode === 'template') {
          await templatesApi.update(s.projectId, payload);
        } else {
          await projectsApi.update(s.projectId, payload);
        }
        const after = get();
        const afterSig = JSON.stringify({
          name: after.projectName,
          width: after.canvasWidth,
          height: after.canvasHeight,
          pages: after.pages,
          meta: after.projectMeta ?? undefined,
        });
        // 保存期间有新改动 → 保留 dirty（保持 true），待 autosave 重试；否则清 dirty。
        set(afterSig === sig ? { dirty: false, saving: false, saveError: null } : { saving: false, saveError: null });
      } catch (err) {
        // 失败保 dirty，下轮 autosave 重试；记录错误供顶栏展示。
        const msg =
          err instanceof Error ? err.message : typeof err === 'string' ? err : '未知错误';
        console.error('[editor save] 保存失败:', err);
        set({ saving: false, saveError: msg });
      }
    },

    /** 卸载/隐藏前的尽力刷盘：keepalive fetch 让请求活过页面 unload（body ≤ 64KB）。 */
    flushSync() {
      const s = get();
      if (!s.projectId || !s.dirty || s.saving) return;
      const body = JSON.stringify({
        name: s.projectName,
        width: s.canvasWidth,
        height: s.canvasHeight,
        pages: s.pages,
        meta: s.projectMeta ?? undefined,
      });
      const url =
        s.saveMode === 'template'
          ? `/api/v1/templates/${s.projectId}`
          : `/api/v1/projects/${s.projectId}`;
      const token = getAccessToken();
      // 故意不 await / 不动 saving·dirty：调用点即 unload，store 即将销毁。
      // keepalive fetch 对 body 有 ~64KB 限制；大 payload 静默丢失。
      // 超过阈值 → 回退同步 XMLHttpRequest（能携带任意大小，且阻塞 unload 直到发出）。
      const LARGE = 60_000; // 60KB 安全阈值（留余量）
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      if (body.length > LARGE) {
        console.warn(
          `[autosave] payload ${body.length}B 超过 keepalive 阈值，回退同步 XHR`,
        );
        toast.warning('数据较大，请手动保存');
        try {
          const xhr = new XMLHttpRequest();
          xhr.open('PATCH', url, false); // 同步：阻塞 unload 直到请求发出
          for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
          xhr.withCredentials = true;
          xhr.send(body);
        } catch {
          // best-effort：忽略。
        }
        return;
      }
      try {
        void fetch(url, {
          method: 'PATCH',
          keepalive: true,
          credentials: 'include',
          headers,
          body,
        }).catch(() => {});
      } catch {
        // best-effort：忽略。
      }
    },

    setProjectName: (name) => set((s) => ({ projectName: name, dirty: true, dirtyTick: s.dirtyTick + 1 })),

    setTheme: (patch) =>
      mutateAndCommit((s) => {
        const current = s.projectMeta?.theme ?? DEFAULT_THEME;
        // 深合并 color / font / layout / branding / background 子对象；density / radius / preset 直接替换。
        // preset: 若 patch 显式含 preset key（含 undefined=清空），则用 patch 值；否则保留当前。
        const merged: ProjectTheme = {
          color: { ...current.color, ...patch.color },
          font: { ...current.font, ...patch.font },
          density: patch.density ?? current.density,
          radius: patch.radius ?? current.radius,
          layout: { ...(current.layout ?? DEFAULT_THEME.layout), ...patch.layout } as NonNullable<
            ProjectTheme['layout']
          >,
          lineHeight: {
            ...(current.lineHeight ?? DEFAULT_THEME.lineHeight),
            ...patch.lineHeight,
          } as NonNullable<ProjectTheme['lineHeight']>,
          heading: {
            ...(current.heading ?? DEFAULT_THEME.heading),
            ...patch.heading,
          } as NonNullable<ProjectTheme['heading']>,
          format: {
            ...(current.format ?? DEFAULT_THEME.format),
            ...patch.format,
          } as NonNullable<ProjectTheme['format']>,
          chart: {
            ...(current.chart ?? DEFAULT_THEME.chart),
            ...patch.chart,
          } as NonNullable<ProjectTheme['chart']>,
          shadow: patch.shadow ?? current.shadow,
          branding:
            patch.branding || current.branding
              ? { ...(current.branding ?? DEFAULT_THEME.branding), ...patch.branding }
              : undefined,
          background:
            patch.background || current.background
              ? {
                  type: patch.background?.type ?? current.background?.type ?? 'none',
                  ...(current.background ?? {}),
                  ...patch.background,
                }
              : undefined,
          preset: 'preset' in patch ? patch.preset : current.preset,
        };
        // 钩子3：全局标题字号变化 → 重排所有「未单组件覆盖字号」的 title-block 高度（动态行高）。
        const newFs = patch.heading?.fontSize;
        const prevFs = (current.heading ?? DEFAULT_THEME.heading)?.fontSize;
        let pagesOut = s.pages;
        if (newFs !== undefined && newFs !== prevFs) {
          pagesOut = s.pages.map((pg) => ({
            ...pg,
            components: pg.components.map((c) => {
              if (c.type !== 'title-block') return c;
              const d = c.data as { fontSize?: number; subtitle?: string; divider?: boolean };
              if (d.fontSize !== undefined) return c; // 单组件已覆盖字号,不随全局变
              return {
                ...c,
                h: titleHeightForFontSize(newFs, { subtitle: !!d.subtitle, divider: !!d.divider }),
              };
            }),
          }));
        }
        const out: Partial<EditorState> = {
          projectMeta: { ...(s.projectMeta ?? {}), theme: merged } as ProjectMeta,
        };
        if (pagesOut !== s.pages) out.pages = pagesOut;
        return out;
      }),

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
        const cl = clampRect({ x, y, w: size.w, h: size.h }, clampSafeFrom(s.projectMeta, s.canvasWidth, s.canvasHeight));
        let comp: EditorComponent = {
          id: newId(),
          type,
          x: cl.x,
          y: cl.y,
          w: cl.w,
          h: cl.h,
          data: getDefaultData(type),
        };
        // 钩子1:title-block 新建时按全局 heading 字号动态定高,并继承全局变体/主色作初始(可单组件改)。
        if (type === 'title-block') {
          const theme = s.projectMeta?.theme;
          const gFs = theme?.heading?.fontSize ?? 32;
          const d = comp.data as TitleBlockData;
          comp = {
            ...comp,
            h: titleHeightForFontSize(gFs, { subtitle: !!d.subtitle, divider: !!d.divider }),
            data: {
              ...d,
              ...(theme?.heading?.variant ? { variant: theme.heading.variant } : {}),
              ...(theme?.heading?.color ? { color: theme.heading.color } : {}),
            },
          };
        }
        const pages = withCurrentComponents(s.pages, s.currentPageId, (cs) => [...cs, comp]);
        return {
          pages: s.currentPageId ? applyPageBindingReducer(pages, s.currentPageId, s.reportData, new Set([comp.id]), s.projectMeta) : pages,
          selectedIds: [comp.id],
        };
      }),

    addBusinessBlock: (kind) =>
      mutateAndCommit((s) => {
        const layout = getLayout(kind);
        const item = getBusinessItem(kind);
        const { x, y } = centered(layout.w, layout.h, s.canvasWidth, s.canvasHeight);
        const cl = clampRect({ x, y, w: layout.w, h: layout.h }, clampSafeFrom(s.projectMeta, s.canvasWidth, s.canvasHeight));
        const comp: EditorComponent = {
          id: newId(),
          type: 'business-block',
          x: cl.x,
          y: cl.y,
          w: cl.w,
          h: cl.h,
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
        const grid = s.projectMeta?.theme?.layout?.gridSize ?? DEFAULT_GRID_SIZE;
        const { x, y } = placed(size.w, size.h, cx, cy, s.canvasWidth, s.canvasHeight, grid);
        const cl = clampRect({ x, y, w: size.w, h: size.h }, clampSafeFrom(s.projectMeta, s.canvasWidth, s.canvasHeight));
        const comp: EditorComponent = { id: newId(), type, x: cl.x, y: cl.y, w: cl.w, h: cl.h, data: getDefaultData(type) };
        const pages = withCurrentComponents(s.pages, s.currentPageId, (cs) => [...cs, comp]);
        return {
          pages: s.currentPageId ? applyPageBindingReducer(pages, s.currentPageId, s.reportData, new Set([comp.id]), s.projectMeta) : pages,
          selectedIds: [comp.id],
        };
      }),

    addBusinessBlockAt: (kind, cx, cy) =>
      mutateAndCommit((s) => {
        const layout = getLayout(kind);
        const item = getBusinessItem(kind);
        const grid = s.projectMeta?.theme?.layout?.gridSize ?? DEFAULT_GRID_SIZE;
        const { x, y } = placed(layout.w, layout.h, cx, cy, s.canvasWidth, s.canvasHeight, grid);
        const cl = clampRect({ x, y, w: layout.w, h: layout.h }, clampSafeFrom(s.projectMeta, s.canvasWidth, s.canvasHeight));
        const comp: EditorComponent = {
          id: newId(),
          type: 'business-block',
          x: cl.x,
          y: cl.y,
          w: cl.w,
          h: cl.h,
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

    addShape: (shape) =>
      mutateAndCommit((s) => {
        const size = shape === 'line' ? { w: 200, h: 4 } : DEFAULT_SIZES['shape'];
        const { x, y } = centered(size.w, size.h, s.canvasWidth, s.canvasHeight);
        const cl = clampRect({ x, y, w: size.w, h: size.h }, clampSafeFrom(s.projectMeta, s.canvasWidth, s.canvasHeight));
        const comp: EditorComponent = {
          id: newId(),
          type: 'shape',
          x: cl.x,
          y: cl.y,
          w: cl.w,
          h: cl.h,
          data: getDefaultShapeData(shape),
        };
        return {
          pages: withCurrentComponents(s.pages, s.currentPageId, (cs) => [...cs, comp]),
          selectedIds: [comp.id],
        };
      }),

    addShapeAt: (shape, cx, cy) =>
      mutateAndCommit((s) => {
        const size = shape === 'line' ? { w: 200, h: 4 } : DEFAULT_SIZES['shape'];
        const grid = s.projectMeta?.theme?.layout?.gridSize ?? DEFAULT_GRID_SIZE;
        const { x, y } = placed(size.w, size.h, cx, cy, s.canvasWidth, s.canvasHeight, grid);
        const cl = clampRect({ x, y, w: size.w, h: size.h }, clampSafeFrom(s.projectMeta, s.canvasWidth, s.canvasHeight));
        const comp: EditorComponent = {
          id: newId(),
          type: 'shape',
          x: cl.x,
          y: cl.y,
          w: cl.w,
          h: cl.h,
          data: getDefaultShapeData(shape),
        };
        return {
          pages: withCurrentComponents(s.pages, s.currentPageId, (cs) => [...cs, comp]),
          selectedIds: [comp.id],
        };
      }),

    // 拖动期间的实时更新：不落 history（在 commit() 统一落）。
    updateComponent: (id, patch) =>
      set((s) => {
        const cur = s.pages.find((p) => p.id === s.currentPageId);
        const isTitleComp = pageCategory(cur?.pageType) === 'media-report' && cur?.titleComponentId === id;
        const pages = withCurrentComponents(s.pages, s.currentPageId, (cs) =>
          cs.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        );
        let finalPages = pages;
        if (isTitleComp && patch.data && cur) {
          const oldContent = (cur.components.find((c) => c.id === id)?.data as { content?: string } | undefined)?.content;
          const newContent = (patch.data as { content?: string }).content;
          if (newContent !== undefined && newContent !== oldContent) {
            finalPages = pages.map((p) =>
              p.id === s.currentPageId ? { ...p, titleOverridden: true, name: newContent } : p,
            );
          }
        }
        return { dirty: true, pages: finalPages };
      }),

    /** 把组件当前几何夹进安全区（不入 history；PropertyPanel 失焦时调用，紧接 commit()）。 */
    sanitizeComponent: (id) =>
      set((s) => {
        const safe = clampSafeFrom(s.projectMeta, s.canvasWidth, s.canvasHeight);
        return {
          dirty: true,
          dirtyTick: s.dirtyTick + 1,
          pages: withCurrentComponents(s.pages, s.currentPageId, (cs) =>
            cs.map((c) => {
              if (c.id !== id) return c;
              const cl = clampRect({ x: c.x, y: c.y, w: c.w, h: c.h }, safe);
              return { ...c, x: cl.x, y: cl.y, w: cl.w, h: cl.h };
            }),
          ),
        };
      }),

    updateComponentData: (id, dataPatch) =>
      mutateAndCommit((s) => ({
        pages: withCurrentComponents(s.pages, s.currentPageId, (cs) =>
          cs.map((c) => {
            if (c.id !== id) return c;
            const nextData = { ...(c.data as object), ...dataPatch } as unknown as ComponentData;
            let next: EditorComponent = { ...c, data: nextData };
            // 钩子2:title-block 改 fontSize → 同步重算 h(动态行高)。
            if (c.type === 'title-block' && Object.prototype.hasOwnProperty.call(dataPatch, 'fontSize')) {
              const d = nextData as TitleBlockData;
              const fs =
                typeof d.fontSize === 'number' && d.fontSize > 0
                  ? d.fontSize
                  : (s.projectMeta?.theme?.heading?.fontSize ?? 32);
              next = { ...next, h: titleHeightForFontSize(fs, { subtitle: !!d.subtitle, divider: !!d.divider }) };
            }
            return next;
          }),
        ),
      })),

    move: (ids, dx, dy) =>
      set((s) => {
        const { grid, safe: snapSafe } = snapCtx(s.projectMeta, s.canvasWidth, s.canvasHeight);
        const clampSafe = clampSafeFrom(s.projectMeta, s.canvasWidth, s.canvasHeight);
        return {
          dirty: true,
          pages: withCurrentComponents(s.pages, s.currentPageId, (cs) =>
            cs.map((c) => {
              if (!ids.includes(c.id) || c.locked) return c;
              const { x: sx, y: sy } = snapMove({ x: c.x + dx, y: c.y + dy, w: c.w, h: c.h }, grid, snapSafe);
              const cl = clampRect({ x: sx, y: sy, w: c.w, h: c.h }, clampSafe);
              return { ...c, x: cl.x, y: cl.y, w: cl.w, h: cl.h };
            }),
          ),
        };
      }),

    resize: (id, dir, dx, dy, start) =>
      set((s) => {
        const { grid, safe: snapSafe } = snapCtx(s.projectMeta, s.canvasWidth, s.canvasHeight);
        const clampSafe = clampSafeFrom(s.projectMeta, s.canvasWidth, s.canvasHeight);
        return {
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
              const snapped = snapResize({ x, y, w, h }, dir, grid, snapSafe);
              const cl = clampResize(snapped, dir, clampSafe);
              return { ...c, ...cl };
            }),
          ),
        };
      }),

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
        const clampSafe = clampSafeFrom(s.projectMeta, s.canvasWidth, s.canvasHeight);
        const cur = s.currentPage()?.components ?? [];
        const dupes = cur
          .filter((c) => s.selectedIds.includes(c.id))
          .map((c) => {
            const cl = clampRect({ x: c.x + 20, y: c.y + 20, w: c.w, h: c.h }, clampSafe);
            return { ...clone(c), id: newId(), x: cl.x, y: cl.y, w: cl.w, h: cl.h };
          });
        return {
          pages: withCurrentComponents(s.pages, s.currentPageId, (cs) => [...cs, ...dupes]),
          selectedIds: dupes.map((c) => c.id),
        };
      }),

    nudge: (dx, dy) =>
      mutateAndCommit((s) => {
        const clampSafe = clampSafeFrom(s.projectMeta, s.canvasWidth, s.canvasHeight);
        return {
          pages: withCurrentComponents(s.pages, s.currentPageId, (cs) =>
            cs.map((c) => {
              if (!s.selectedIds.includes(c.id) || c.locked) return c;
              const cl = clampRect({ x: c.x + dx, y: c.y + dy, w: c.w, h: c.h }, clampSafe);
              return { ...c, x: cl.x, y: cl.y, w: cl.w, h: cl.h };
            }),
          ),
        };
      }),

    copy: () =>
      set((s) => {
        const cur = s.currentPage()?.components ?? [];
        return { clipboard: cur.filter((c) => s.selectedIds.includes(c.id)).map((c) => clone(c)), _pasteCount: 0 };
      }),

    cut: () =>
      mutateAndCommit((s) => {
        const cur = s.currentPage()?.components ?? [];
        return {
          clipboard: cur.filter((c) => s.selectedIds.includes(c.id)).map((c) => clone(c)),
          _pasteCount: 0,
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
        const clampSafe = clampSafeFrom(s.projectMeta, s.canvasWidth, s.canvasHeight);
        // 连续粘贴时累加偏移量，避免完全重叠。
        const pasteCount = s._pasteCount ?? 0;
        const offset = 20 * (pasteCount + 1);
        const pasted = clip.map((c) => {
          const cl = clampRect({ x: c.x + offset, y: c.y + offset, w: c.w, h: c.h }, clampSafe);
          return { ...clone(c), id: newId(), x: cl.x, y: cl.y, w: cl.w, h: cl.h };
        });
        return {
          pages: withCurrentComponents(s.pages, s.currentPageId, (cs) => [...cs, ...pasted]),
          selectedIds: pasted.map((c) => c.id),
          _pasteCount: pasteCount + 1,
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
      mutateAndCommit((s) => {
        const safe = clampSafeFrom(s.projectMeta, s.canvasWidth, s.canvasHeight);
        return { pages: withCurrentComponents(s.pages, s.currentPageId, (cs) => alignInPlace(cs, ids, alignment, safe)) };
      }),

    distributeH: (ids) =>
      mutateAndCommit((s) => {
        const safe = clampSafeFrom(s.projectMeta, s.canvasWidth, s.canvasHeight);
        return { pages: withCurrentComponents(s.pages, s.currentPageId, (cs) => distribute(cs, ids, 'h', safe)) };
      }),

    distributeV: (ids) =>
      mutateAndCommit((s) => {
        const safe = clampSafeFrom(s.projectMeta, s.canvasWidth, s.canvasHeight);
        return { pages: withCurrentComponents(s.pages, s.currentPageId, (cs) => distribute(cs, ids, 'v', safe)) };
      }),

    equalWidth: (ids) =>
      mutateAndCommit((s) => {
        const safe = clampSafeFrom(s.projectMeta, s.canvasWidth, s.canvasHeight);
        return { pages: withCurrentComponents(s.pages, s.currentPageId, (cs) => equalize(cs, ids, 'w', safe)) };
      }),

    equalHeight: (ids) =>
      mutateAndCommit((s) => {
        const safe = clampSafeFrom(s.projectMeta, s.canvasWidth, s.canvasHeight);
        return { pages: withCurrentComponents(s.pages, s.currentPageId, (cs) => equalize(cs, ids, 'h', safe)) };
      }),

    setPage: (id) => mutateAndCommit(() => ({ currentPageId: id, selectedIds: [] })),

    addPage: () =>
      mutateAndCommit((s) => {
        const page: Page = { id: newId(), name: `第 ${s.pages.length + 1} 页`, components: [] };
        // 自动应用全局默认背景到新页面
        const bg = s.projectMeta?.theme?.background;
        if (bg && bg.type !== 'none') {
          if (bg.type === 'color' && bg.color) page.bgColor = bg.color;
          else if (bg.type === 'gradient' && bg.gradient) page.bgGradient = bg.gradient;
          else if (bg.type === 'image' && bg.image) page.bgImage = bg.image;
        }
        return { pages: [...s.pages, page], currentPageId: page.id, selectedIds: [] };
      }),

    addPageWithComponents: (name, components, opts) => {
      let pageId: string | undefined;
      mutateAndCommit((s) => {
        const reid = components.map((c) => ({ ...clone(c), id: newId() }));
        const page: Page = { id: newId(), name, components: reid };
        // 自动应用全局默认背景到新页面
        const bg = s.projectMeta?.theme?.background;
        if (bg && bg.type !== 'none') {
          if (bg.type === 'color' && bg.color) page.bgColor = bg.color;
          else if (bg.type === 'gradient' && bg.gradient) page.bgGradient = bg.gradient;
          else if (bg.type === 'image' && bg.image) page.bgImage = bg.image;
        }
        pageId = page.id;
        const idx = opts?.titleComponentIndex;
        if (idx != null && reid[idx]) {
          page.pageType = 'cover';
          page.titleComponentId = reid[idx].id;
          page.titleOverridden = false;
        } else if (opts?.pageType) {
          page.pageType = opts.pageType;
          // campaign-report / creator-collab 自动绑定全局 Campaign
          if ((pageCategory(opts.pageType) === 'campaign-report' || pageCategory(opts.pageType) === 'creator-collab') && !page.campaignId) {
            page.campaignId = s.reportData?.campaign?.id ?? '';
          }
          // creator-case / creator-collab 自动绑定第一个可用达人
          if ((pageCategory(opts.pageType) === 'creator-case' || pageCategory(opts.pageType) === 'creator-collab') && !page.creatorId) {
            const cr = allReportCreators(s.reportData)[0];
            if (cr) page.creatorId = cr.id;
          }
        }
        const pages = [...s.pages, page];
        return {
          pages: applyPageBindingReducer(pages, page.id, s.reportData, new Set(page.components.map((c) => c.id)), s.projectMeta),
          currentPageId: page.id,
          selectedIds: [],
        };
      });
      if (pageId) refreshReportTitle(pageId);
    },

    addPagesBatch: (pages) => {
      const newIds: string[] = [];
      mutateAndCommit((s) => {
        const allCr = allReportCreators(s.reportData);
        let crIdx = 0; // 多个达人页依次分配不同达人
        const built: Page[] = pages.map((p) => {
          const reid = p.components.map((c) => ({ ...clone(c), id: newId() }));
          const page: Page = { id: newId(), name: p.name, components: reid };
          // 自动应用全局默认背景到新页面
          const bg = s.projectMeta?.theme?.background;
          if (bg && bg.type !== 'none') {
            if (bg.type === 'color' && bg.color) page.bgColor = bg.color;
            else if (bg.type === 'gradient' && bg.gradient) page.bgGradient = bg.gradient;
            else if (bg.type === 'image' && bg.image) page.bgImage = bg.image;
          }
          newIds.push(page.id);
          const idx = p.titleComponentIndex;
          if (idx != null && reid[idx]) {
            page.pageType = p.pageType ?? 'cover';
            page.titleComponentId = reid[idx].id;
            page.titleOverridden = false;
          } else if (p.pageType) {
            page.pageType = p.pageType;
            if ((pageCategory(p.pageType) === 'campaign-report' || pageCategory(p.pageType) === 'creator-collab') && !page.campaignId) {
              page.campaignId = s.reportData?.campaign?.id ?? '';
            }
            // creator-case / creator-collab 自动绑定达人（多个达人页依次轮询分配）
            if (pageCategory(p.pageType) === 'creator-case' || pageCategory(p.pageType) === 'creator-collab') {
              if (allCr.length > 0) {
                page.creatorId = allCr[crIdx % allCr.length].id;
                crIdx++;
              }
            }
          }
          return page;
        });
        if (built.length === 0) return {};
        let allPages = [...s.pages, ...built];
        for (const pg of built) {
          allPages = applyPageBindingReducer(allPages, pg.id, s.reportData, new Set(pg.components.map((c) => c.id)), s.projectMeta);
        }
        return { pages: allPages, currentPageId: built[0].id, selectedIds: [] };
      });
      newIds.forEach((id) => refreshReportTitle(id));
    },

    copyPage: (id) => {
      let newPageId: string | undefined;
      mutateAndCommit((s) => {
        const src = s.pages.find((p) => p.id === id);
        if (!src) return {};
        const idMap = new Map<string, string>();
        const copiedComps = src.components.map((c) => {
          const nid = newId();
          idMap.set(c.id, nid);
          return { ...clone(c), id: nid };
        });
        const copied: Page = {
          id: newId(),
          name: `${src.name} (副本)`,
          components: copiedComps,
          ...(src.bgColor ? { bgColor: src.bgColor } : {}),
          ...(src.bgGradient ? { bgGradient: src.bgGradient } : {}),
          ...(src.bgImage ? { bgImage: src.bgImage } : {}),
          ...(src.pageType ? { pageType: src.pageType } : {}),
          ...(src.titleComponentId ? { titleComponentId: idMap.get(src.titleComponentId) } : {}),
          ...(src.titleOverridden ? { titleOverridden: src.titleOverridden } : {}),
          ...(src.campaignId ? { campaignId: src.campaignId } : {}),
          ...(src.creatorId ? { creatorId: src.creatorId } : {}),
        };
        newPageId = copied.id;
        const idx = s.pages.findIndex((p) => p.id === id);
        const pages = [...s.pages];
        pages.splice(idx + 1, 0, copied);
        return { pages };
      });
      if (newPageId) refreshReportTitle(newPageId);
    },

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
        pages: s.pages.map((p) => {
          if (p.id !== id) return p;
          const next = name.trim() || p.name;
          if (next === p.name) return p; // 无变化不改状态
          if (pageCategory(p.pageType) !== 'media-report' || !p.titleComponentId) return { ...p, name: next };
          return {
            ...p,
            name: next,
            titleOverridden: true,
            components: p.components.map((c) =>
              c.id === p.titleComponentId
                ? { ...c, data: { ...(c.data as object), content: next } as unknown as ComponentData }
                : c,
            ),
          };
        }),
      })),

    updatePage: (id, patch) =>
      mutateAndCommit((s) => ({
        pages: s.pages.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      })),

    /** 批量应用背景到所有页面（一次性 history 快照）。 */
    applyBackgroundBatch: (patch: { bgColor?: string; bgGradient?: PageGradient; bgImage?: string }) =>
      mutateAndCommit((s) => ({
        pages: s.pages.map((p) => ({ ...p, ...patch })),
      })),

    patchPageLive: (id, patch) =>
      set((s) => ({
        dirty: true,
        dirtyTick: s.dirtyTick + 1,
        pages: s.pages.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      })),

    reorderPage: (from, to) =>
      mutateAndCommit((s) => {
        const pages = [...s.pages];
        const [moved] = pages.splice(from, 1);
        pages.splice(to, 0, moved);
        return { pages };
      }),

    setPageType: (pageId, pageType) => {
      mutateAndCommit((s) => {
        // 非 media-report 类型不自动创建/维护标题组件。
        if (pageCategory(pageType) === 'media-report') {
          return {
            pages: s.pages.map((p) => {
              if (p.id !== pageId) return p;
              const title = buildReportTitle(s.projectMeta ?? {});
              const titleId = p.titleComponentId;
              const hasTitleComp = !!titleId && !!p.components.find((c) => c.id === titleId && c.type === 'text');
              // 空页时从模板填充默认内容（保留标题组件逻辑）
              if (p.components.length === 0) {
                const tpl = getTemplateByPageType(pageType!, s.projectMeta?.businessLine);
                if (tpl) {
                  const comps = tpl.components().map((c) => ({ ...clone(c), id: newId() }));
                  // 确保 title 组件存在
                  const titleIdx = tpl.pageTitleIndex;
                  let titleCompId: string | undefined;
                  let components = comps;
                  if (titleIdx != null && comps[titleIdx]) {
                    titleCompId = comps[titleIdx].id;
                    // 覆盖标题文案为项目报告标题
                    (comps[titleIdx].data as { content?: string }).content = title;
                  } else {
                    // 模板没有 pageTitleIndex，手动在前面插入标题组件
                    const created = makeTitleComponent(title);
                    titleCompId = created.id;
                    components = [created, ...comps];
                  }
                  return {
                    ...p,
                    pageType: pageType ?? p.pageType,
                    titleComponentId: titleCompId,
                    titleOverridden: false,
                    components,
                    name: title,
                  };
                }
              }
              if (!hasTitleComp) {
                const created = makeTitleComponent(title);
                return {
                  ...p,
                  pageType: pageType ?? p.pageType,
                  titleComponentId: created.id,
                  titleOverridden: false,
                  components: [created, ...p.components],
                  name: title,
                };
              }
              return {
                ...p,
                pageType: pageType ?? p.pageType,
                titleComponentId: titleId,
                titleOverridden: false,
                name: title,
                components: p.components.map((c) =>
                  c.id === titleId ? { ...c, data: { ...(c.data as object), content: title } as unknown as ComponentData } : c,
                ),
              };
            }),
          };
        }
        // 新类型（campaign-report / creator-case / creator-collab）：设置类型，不清已有标题。
        // campaign-report 默认绑定全局 Campaign；creator-collab 同理。
        if (!pageType) {
          return {
            pages: s.pages.map((p) =>
              p.id === pageId
                ? { ...p, pageType: undefined, titleComponentId: undefined, titleOverridden: undefined }
                : p,
            ),
          };
        }
        const patchCampaign = pageCategory(pageType) === 'campaign-report' || pageCategory(pageType) === 'creator-collab';
        const patchCreator = pageCategory(pageType) === 'creator-case' || pageCategory(pageType) === 'creator-collab';
        const mapped = s.pages.map((p) => {
          if (p.id !== pageId) return p;
          const next: Page = { ...p, pageType };
          if (patchCampaign && !p.campaignId) {
            next.campaignId = s.reportData?.campaign?.id ?? '';
          }
          // creator-case / creator-collab 自动绑定第一个可用达人
          if (patchCreator && !p.creatorId) {
            const cr = allReportCreators(s.reportData)[0];
            if (cr) next.creatorId = cr.id;
          }
          // 页面组件为空时，从对应模板填充默认内容
          if (p.components.length === 0) {
            const tpl = getTemplateByPageType(pageType, s.projectMeta?.businessLine);
            if (tpl) {
              const comps = tpl.components().map((c) => ({ ...clone(c), id: newId() }));
              next.components = comps;
              // 如果模板有 pageTitleIndex，设置标题组件
              if (tpl.pageTitleIndex != null && comps[tpl.pageTitleIndex]) {
                next.titleComponentId = comps[tpl.pageTitleIndex].id;
                next.titleOverridden = false;
              }
              // 用模板名称作为页面名
              if (tpl.name) next.name = tpl.name;
            }
          }
          return next;
        });
        // 切到 campaign-report/creator-collab 后，按页面绑定把页内组件当「新增」填充（落地即有数据）。
        const target = mapped.find((p) => p.id === pageId);
        const patched = target
          ? applyPageBindingReducer(mapped, pageId, s.reportData, new Set(target.components.map((c) => c.id)), s.projectMeta)
          : mapped;
        return { pages: patched };
      });
    },

    restoreReportTitle: (pageId) => {
      mutateAndCommit((s) => {
        const p = s.pages.find((pg) => pg.id === pageId);
        if (!p || pageCategory(p.pageType) !== 'media-report') return {};
        const title = buildReportTitle(s.projectMeta ?? {});
        const titleId = p.titleComponentId;
        const titleComp = titleId ? p.components.find((c) => c.id === titleId && c.type === 'text') : undefined;
        return {
          pages: s.pages.map((pg) => {
            if (pg.id !== pageId) return pg;
            if (!titleComp) {
              const created = makeTitleComponent(title);
              return { ...pg, titleOverridden: false, name: title, components: [created, ...pg.components], titleComponentId: created.id };
            }
            return {
              ...pg,
              titleOverridden: false,
              name: title,
              components: pg.components.map((c) =>
                c.id === titleId ? { ...c, data: { ...(c.data as object), content: title } as unknown as ComponentData } : c,
              ),
            };
          }),
        };
      });
    },

    /**
     * 替换整页版式：用指定模板的 components 覆盖当前页。
     * - 深拷贝模板 components + 重生成 id（避免引用模板常量）。
     * - 保留页面既有 pageType / campaignId / creatorId / 背景绑定，除非模板自带 pageType。
     * - 记录 layoutTemplateId 以追溯版式来源；落 history + 标脏。
     * - 替换后立即跑一次 applyPageBinding（让组件按数据上下文填充）。
     */
    replacePageLayout: (pageId, templateId) => {
      const tpl = getTemplate(templateId);
      if (!tpl) return;
      mutateAndCommit((s) => {
        if (!s.pages.find((p) => p.id === pageId)) return {};
        const reid = tpl.components().map((c) => ({ ...clone(c), id: newId() }));
        const mapped = s.pages.map((p) => {
          if (p.id !== pageId) return p;
          const next: Page = {
            ...p,
            components: reid,
            layoutTemplateId: templateId,
            // 模板自带 pageType 则覆盖（同步来源），否则保留原页面类型。
            ...(tpl.pageType ? { pageType: tpl.pageType } : {}),
          };
          // 清理失效的 titleComponentId（旧标题组件已被替换）
          if (p.titleComponentId && !reid.find((c) => c.id === p.titleComponentId)) {
            next.titleComponentId = undefined;
            next.titleOverridden = undefined;
          }
          // 模板标记了 pageTitleIndex → 同步标题组件 id
          if (tpl.pageTitleIndex != null && reid[tpl.pageTitleIndex]) {
            next.titleComponentId = reid[tpl.pageTitleIndex].id;
            next.titleOverridden = false;
            // media-report 类模板：用项目报告标题覆盖标题文案
            if (pageCategory(tpl.pageType) === 'media-report') {
              const title = buildReportTitle(s.projectMeta ?? {});
              (reid[tpl.pageTitleIndex].data as { content?: string }).content = title;
              next.name = title;
            }
          }
          return next;
        });
        // 替换后立即按页面绑定把组件当「新增」填充数据
        const patched = applyPageBindingReducer(mapped, pageId, s.reportData, new Set(reid.map((c) => c.id)), s.projectMeta);
        return { pages: patched, selectedIds: [] };
      });
    },

    applyPageBinding: (pageId) => {
      const pid = pageId ?? get().currentPageId;
      if (!pid) return;
      mutateAndCommit((s) => ({
        pages: applyPageBindingReducer(s.pages, pid, s.reportData, new Set(), s.projectMeta),
      }));
    },

    undo: () => {
      const { historyIndex, history } = get();
      if (historyIndex <= 0) return;
      const i = historyIndex - 1;
      const snap = history[i];
      set({
        pages: clone(snap.pages),
        currentPageId: snap.currentPageId,
        projectMeta: clone(snap.projectMeta),
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
        projectMeta: clone(snap.projectMeta),
        selectedIds: [],
        historyIndex: i,
      });
    },

    setComponentData: (id, data) =>
      mutateAndCommit((s) => ({
        pages: withCurrentComponents(s.pages, s.currentPageId, (cs) =>
          cs.map((c) => (c.id === id ? { ...c, data } : c)),
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

// ---- Vite HMR：避免改代码触发 HMR 时 store 被重置成空白 ----
// store.ts 是模块级单例；Vite 重新求值本模块（或其 import 图）会再跑一遍 create()
// → 全新空 store → 画布变白。dispose 前抓数据快照、新模块求值后回填；
// 仅回填数据字段（见 pickPersistableState），action 用新 store 自带的。accept() 自接收，
// 阻止冒泡到 Editor 触发重挂载（否则 loadProject 会用旧 detail 覆盖当前编辑）。
// 注意：vitest 也暴露 import.meta.hot 但无 .data，用 import.meta.hot?.data 兜住，仅在真 Vite 下生效。
if (import.meta.hot?.data) {
  import.meta.hot.dispose((data) => {
    data.editorState = pickPersistableState(useEditorStore.getState());
  });
  if (import.meta.hot.data.editorState) {
    useEditorStore.setState(import.meta.hot.data.editorState as Partial<EditorState>);
  }
  import.meta.hot.accept();
}
