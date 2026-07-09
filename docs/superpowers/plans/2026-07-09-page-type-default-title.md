# 页面类型与投放报告默认标题 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Worktree:** 按本项目约定，在隔离 worktree 内执行（`superpowers:using-git-worktrees`）。工作区另有未提交改动时切勿整文件 `git add`；每个 commit 用单条原子命令 `git add <具体文件> && git commit`（IDE git 面板会在 CLI 调用间清空暂存）。

**Goal:** 给 `Page` 增加 `pageType` 字段；当页面类型为 `media-report`（投放报告）时，按 `{商家名}'s MEDIA REPORT · {周期}` 从项目 meta 自动生成标题，写入画布标题组件与 `Page.name`，自动跟随 meta、手改后停止（可恢复）。

**Architecture:** 纯函数 `buildReportTitle(meta)` 放 `packages/shared`（web+server 共用）；`Page` 新增三个可选字段（`pageType`/`titleComponentId`/`titleOverridden`，向后兼容、无 Prisma 迁移）；编辑器 store 内部维护「标题组件 + 自动跟随 + 手改停跟随」生命周期；封面/场景模板在应用时声明哪个组件是标题，落库即带 `media-report`。

**Tech Stack:** React 18 + Zustand + Vite + TS（apps/web）；Express + Prisma + zod（apps/server）；type-only `@mediakit/shared`；vitest + jsdom（测试）。

**Spec:** `docs/superpowers/specs/2026-07-09-page-type-default-title-design.md`

---

## File Structure

| 文件 | 责任 | 动作 |
|---|---|---|
| `packages/shared/src/index.ts` | `PageType`/`Page` 字段；`formatCampaignDate`/`buildWrapUpPeriod`/`buildReportTitle` 纯函数 | 改 |
| `apps/server/src/modules/projects/projects.schema.ts` | `pageSchema` 镜像三个可选字段 | 改 |
| `apps/web/src/editor/store.ts` | `makeTitleComponent`/`refreshReportTitle`/`refreshAllReportTitles` 内部 helper；`setPageType`/`restoreReportTitle` 动作；`updateComponent`/`copyPage`/`addPageWithComponents`/`addPagesBatch`/`loadProject` 接入 | 改 |
| `apps/web/src/editor/templates.ts` | `Template.pageTitleIndex`；`cover-page` 声明 `pageTitleIndex: 0` | 改 |
| `apps/web/src/editor/components/ScenarioOverlay.tsx` | 应用场景时透传 `titleComponentIndex` | 改 |
| `apps/web/src/editor/PageSidebar.tsx` | `applyTemplate` 透传 `titleComponentIndex`；悬停菜单加「页面类型」按钮 | 改 |
| `apps/web/src/editor/PropertyPanel.tsx` | 选中 overridden 标题组件时显示「恢复自动标题」 | 改 |
| `apps/web/tests/shared.report-title.test.ts` | 纯函数测试 | 新建 |
| `apps/web/tests/shared.types.test.ts` | `Page` 新字段类型断言 | 改（追加） |
| `apps/web/tests/editor.page-type.test.ts` | store 页面类型生命周期测试 | 新建 |
| `apps/server/tests/projects.schema.test.ts` | `pageSchema` 新字段测试 | 新建（或追加） |
| `apps/web/tests/templates.cover.test.ts` | `cover-page` 的 `pageTitleIndex` 断言 | 新建 |

---

## Task 1: 纯函数 `formatCampaignDate` / `buildWrapUpPeriod` / `buildReportTitle`

**Files:**
- Modify: `packages/shared/src/index.ts`（在 `ProjectMeta` 接口结束处 `:695` 之后插入）
- Test: `apps/web/tests/shared.report-title.test.ts`（新建）

- [ ] **Step 1: 写失败测试** — 新建 `apps/web/tests/shared.report-title.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import {
  formatCampaignDate,
  buildWrapUpPeriod,
  buildReportTitle,
  type ProjectMeta,
} from '@mediakit/shared';

const meta = (over: Partial<ProjectMeta> = {}): ProjectMeta => ({
  advertiser: 'GlowLab',
  scenarioSub: 'weekly',
  ...over,
});

describe('formatCampaignDate', () => {
  it('把 ISO 日期格式化为 YYYY.MM.DD', () => {
    expect(formatCampaignDate('2026-10-12')).toBe('2026.10.12');
  });
  it('截取前 10 位（容忍带时间的 ISO）', () => {
    expect(formatCampaignDate('2026-10-12T08:00:00Z')).toBe('2026.10.12');
  });
  it('空/非法返回空串', () => {
    expect(formatCampaignDate(undefined)).toBe('');
    expect(formatCampaignDate('')).toBe('');
    expect(formatCampaignDate('nope')).toBe('');
  });
});

describe('buildWrapUpPeriod', () => {
  it('两端齐全返回区间（半角破折号）', () => {
    expect(
      buildWrapUpPeriod(
        meta({ scenarioSub: 'wrap-up', campaignInfo: { startDate: '2026-10-12', endDate: '2026-11-10' } }),
      ),
    ).toBe('2026.10.12–2026.11.10');
  });
  it('缺一端回落 结案报告', () => {
    expect(buildWrapUpPeriod(meta({ scenarioSub: 'wrap-up', campaignInfo: { startDate: '2026-10-12' } }))).toBe(
      '结案报告',
    );
    expect(buildWrapUpPeriod(meta({ scenarioSub: 'wrap-up' }))).toBe('结案报告');
  });
});

describe('buildReportTitle', () => {
  it('周报', () => {
    expect(buildReportTitle(meta({ scenarioSub: 'weekly' }))).toBe("GlowLab's MEDIA REPORT · 上周");
  });
  it('月报', () => {
    expect(buildReportTitle(meta({ scenarioSub: 'monthly' }))).toBe("GlowLab's MEDIA REPORT · 上月");
  });
  it('结案取 campaign 区间', () => {
    expect(
      buildReportTitle(
        meta({ scenarioSub: 'wrap-up', campaignInfo: { startDate: '2026-10-12', endDate: '2026-11-10' } }),
      ),
    ).toBe("GlowLab's MEDIA REPORT · 2026.10.12–2026.11.10");
  });
  it('advertiser 空去掉前缀', () => {
    expect(buildReportTitle({ scenarioSub: 'weekly' })).toBe('MEDIA REPORT · 上周');
  });
  it('无 scenarioSub 不带周期', () => {
    expect(buildReportTitle({ advertiser: 'GlowLab' })).toBe("GlowLab's MEDIA REPORT");
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm --filter @mediakit/web test -- shared.report-title`
Expected: FAIL — `formatCampaignDate is not a function`（导入不存在）。

- [ ] **Step 3: 实现** — 在 `packages/shared/src/index.ts` 的 `ProjectMeta` 接口（约 `:695`）之后插入：

```ts
/** 把 campaign 日期 '2026-10-12' 格式化为 '2026.10.12'；非法/空返回 ''。 */
export function formatCampaignDate(iso: string | undefined): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : '';
}

/** 结案周期：两端齐全 → '2026.10.12–2026.11.10'；否则回落 '结案报告'。 */
export function buildWrapUpPeriod(meta: ProjectMeta): string {
  const start = formatCampaignDate(meta.campaignInfo?.startDate);
  const end = formatCampaignDate(meta.campaignInfo?.endDate);
  return start && end ? `${start}–${end}` : '结案报告';
}

/**
 * 投放报告页默认标题。
 *   周报 → "{advertiser}'s MEDIA REPORT · 上周"
 *   月报 → "{advertiser}'s MEDIA REPORT · 上月"
 *   结案 → "{advertiser}'s MEDIA REPORT · {campaign 起止}"
 * 兜底：advertiser 空 → 'MEDIA REPORT'；无 scenarioSub → 不带周期。
 */
export function buildReportTitle(meta: ProjectMeta): string {
  const advertiser = meta.advertiser?.trim();
  const base = advertiser ? `${advertiser}'s MEDIA REPORT` : 'MEDIA REPORT';
  let period = '';
  if (meta.scenarioSub === 'weekly') period = '上周';
  else if (meta.scenarioSub === 'monthly') period = '上月';
  else if (meta.scenarioSub === 'wrap-up') period = buildWrapUpPeriod(meta);
  return period ? `${base} · ${period}` : base;
}
```

> 注：`–` 为 U+2013（en dash），`·` 为 U+00B7，照原样复制。`ProjectMeta`/`CampaignInfo` 已在本文件上方定义，类型引用可前向使用。

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm --filter @mediakit/web test -- shared.report-title`
Expected: PASS（全部用例）。

- [ ] **Step 5: 提交**

```bash
git add packages/shared/src/index.ts apps/web/tests/shared.report-title.test.ts && git commit -m "feat(shared): 投放报告默认标题纯函数 formatCampaignDate/buildWrapUpPeriod/buildReportTitle

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: `Page` 类型新增字段

**Files:**
- Modify: `packages/shared/src/index.ts:1258`（`Page` 接口）
- Test: `apps/web/tests/shared.types.test.ts`（追加 `describe`）

- [ ] **Step 1: 写失败测试** — 在 `apps/web/tests/shared.types.test.ts` 末尾追加（若文件不存在则新建并包含 `import { describe, it, expect } from 'vitest';`）：

```ts
import type { Page, PageType } from '@mediakit/shared';

describe('Page 页面类型字段', () => {
  it('支持 pageType / titleComponentId / titleOverridden', () => {
    const p: Page = {
      id: 'p1',
      name: 'n',
      components: [],
      pageType: 'media-report',
      titleComponentId: 'c1',
      titleOverridden: false,
    };
    expect(p.pageType).toBe('media-report');
    expect(p.titleComponentId).toBe('c1');
    expect(p.titleOverridden).toBe(false);
    const t: PageType = 'media-report';
    expect(t).toBe('media-report');
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm --filter @mediakit/web test -- shared.types`
Expected: FAIL — TS 编译错误：`Page` 无 `pageType` 字段、`PageType` 未导出。

- [ ] **Step 3: 实现** — 在 `packages/shared/src/index.ts` 的 `Page` 接口（`:1258-1268`）改为：

```ts
/** 页面类型；命中 'media-report' 触发默认标题规则。 */
export type PageType = 'media-report';

export interface Page {
  id: string;
  name: string;
  components: EditorComponent[];
  /** 页面背景色（HEX）；与 bgImage 二选一，未设时画布默认白。 */
  bgColor?: string;
  /** 页面背景渐变；优先级在 bgImage 之下、bgColor 之上。 */
  bgGradient?: PageGradient;
  /** 页面背景图 URL（cover 铺满）；优先于 bgColor。 */
  bgImage?: string;
  /** 页面类型；命中 'media-report' 触发默认标题规则。 */
  pageType?: PageType;
  /** 作为「页面标题」的 text 组件 id（pageType='media-report' 时由标题逻辑维护）。 */
  titleComponentId?: string;
  /** 用户曾手改标题 → 停止自动跟随 meta。 */
  titleOverridden?: boolean;
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm --filter @mediakit/web test -- shared.types`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add packages/shared/src/index.ts apps/web/tests/shared.types.test.ts && git commit -m "feat(shared): Page 新增 pageType/titleComponentId/titleOverridden 可选字段

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: 服务端 `pageSchema` 镜像新字段

**Files:**
- Modify: `apps/server/src/modules/projects/projects.schema.ts:4-20`（`pageSchema`）
- Test: `apps/server/tests/projects.schema.test.ts`（新建；若已存在同名文件则把下面 `describe` 追加进去）

- [ ] **Step 1: 写失败测试** — 新建 `apps/server/tests/projects.schema.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { pageSchema } from '../src/modules/projects/projects.schema';

describe('pageSchema — 页面类型字段', () => {
  it('接受带 pageType/titleComponentId/titleOverridden 的页面', () => {
    const r = pageSchema.parse({
      id: 'p1',
      name: '封面',
      components: [],
      pageType: 'media-report',
      titleComponentId: 'c1',
      titleOverridden: false,
    });
    expect(r.pageType).toBe('media-report');
    expect(r.titleComponentId).toBe('c1');
    expect(r.titleOverridden).toBe(false);
  });

  it('接受无 pageType 的旧页面（向后兼容）', () => {
    const r = pageSchema.parse({ id: 'p1', name: 'n', components: [] });
    expect(r.pageType).toBeUndefined();
    expect(r.titleComponentId).toBeUndefined();
    expect(r.titleOverridden).toBeUndefined();
  });

  it('拒绝非法 pageType 取值', () => {
    expect(() => pageSchema.parse({ id: 'p1', name: 'n', components: [], pageType: 'bogus' })).toThrow();
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm --filter @mediakit/server test -- projects.schema`
Expected: FAIL — `r.pageType` 为 `undefined`（schema 未声明，zod 默认 strip 未知 key）。

- [ ] **Step 3: 实现** — 在 `apps/server/src/modules/projects/projects.schema.ts` 的 `pageSchema`（`:4-20`）的 `components: z.array(z.any()),` 之后、`});` 之前追加：

```ts
  components: z.array(z.any()),
  /** 页面类型；命中 'media-report' 触发标题规则。 */
  pageType: z.enum(['media-report']).optional(),
  /** 标题组件 id。 */
  titleComponentId: z.string().max(64).optional(),
  /** 用户手改过标题。 */
  titleOverridden: z.boolean().optional(),
});
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm --filter @mediakit/server test -- projects.schema`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/server/src/modules/projects/projects.schema.ts apps/server/tests/projects.schema.test.ts && git commit -m "feat(server): pageSchema 增 pageType/titleComponentId/titleOverridden 校验

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: store — 标题生命周期（refresh / setPageType / restore / load 刷新）

**Files:**
- Modify: `apps/web/src/editor/store.ts`（imports、`EditorState` 接口、`mutateAndCommit` 后插入 helper、`loadProject` 末尾、`renamePage` 附近新增动作）
- Test: `apps/web/tests/editor.page-type.test.ts`（新建）

- [ ] **Step 1: 写失败测试** — 新建 `apps/web/tests/editor.page-type.test.ts`：

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '@/editor/store';
import type { ProjectDetail, ProjectMeta } from '@mediakit/shared';

function makeDetail(overrides: Partial<ProjectDetail> = {}): ProjectDetail {
  return {
    id: 'proj-1',
    name: '测试项目',
    width: 1280,
    height: 720,
    pages: [{ id: 'p1', name: '第 1 页', components: [] }],
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}
function load(meta: Partial<ProjectMeta> = {}) {
  const detail = makeDetail({ meta: meta as ProjectMeta });
  useEditorStore.getState().loadProject(detail, detail.name);
}
function page(id = 'p1') {
  return useEditorStore.getState().pages.find((p) => p.id === id)!;
}

describe('setPageType — 投放报告标题', () => {
  beforeEach(() => load({ advertiser: 'GlowLab', scenarioSub: 'weekly' }));

  it('设为 media-report：创建标题组件并写入生成标题', () => {
    useEditorStore.getState().setPageType('p1', 'media-report');
    const p = page();
    expect(p.pageType).toBe('media-report');
    expect(p.titleOverridden).toBe(false);
    expect(p.name).toBe("GlowLab's MEDIA REPORT · 上周");
    expect(p.titleComponentId).toBeDefined();
    const titleComp = p.components.find((c) => c.id === p.titleComponentId)!;
    expect((titleComp.data as { content: string }).content).toBe("GlowLab's MEDIA REPORT · 上周");
  });

  it('清除 pageType：保留组件', () => {
    const s = useEditorStore.getState();
    s.setPageType('p1', 'media-report');
    s.setPageType('p1', undefined);
    const p = page();
    expect(p.pageType).toBeUndefined();
    expect(p.components.length).toBeGreaterThan(0);
  });

  it('结案：标题取 campaign 区间', () => {
    load({ advertiser: 'GlowLab', scenarioSub: 'wrap-up', campaignInfo: { startDate: '2026-10-12', endDate: '2026-11-10' } });
    useEditorStore.getState().setPageType('p1', 'media-report');
    expect(page().name).toBe("GlowLab's MEDIA REPORT · 2026.10.12–2026.11.10");
  });
});

describe('restoreReportTitle', () => {
  beforeEach(() => load({ advertiser: 'GlowLab', scenarioSub: 'weekly' }));

  it('清除 overridden 标记', () => {
    const s = useEditorStore.getState();
    s.setPageType('p1', 'media-report');
    // 模拟「已手改」状态
    useEditorStore.setState((st) => ({
      pages: st.pages.map((p) => (p.id === 'p1' ? { ...p, titleOverridden: true } : p)),
    }));
    s.restoreReportTitle('p1');
    expect(page().titleOverridden).toBe(false);
  });
});

describe('loadProject 刷新投放报告标题', () => {
  it('加载带 media-report 的页：按 meta 重算标题', () => {
    const detail = makeDetail({
      meta: { advertiser: 'GlowLab', scenarioSub: 'monthly' } as ProjectMeta,
      pages: [
        {
          id: 'p1',
          name: '封面',
          components: [
            { id: 'c1', type: 'text', x: 0, y: 0, w: 100, h: 50, data: { content: 'Report Title', fontSize: 56, color: '#000' } },
          ],
          pageType: 'media-report',
          titleComponentId: 'c1',
          titleOverridden: false,
        },
      ],
    });
    useEditorStore.getState().loadProject(detail, detail.name);
    const p = page();
    expect(p.name).toBe("GlowLab's MEDIA REPORT · 上月");
    expect((p.components[0].data as { content: string }).content).toBe("GlowLab's MEDIA REPORT · 上月");
  });

  it('overridden 的页加载后不被重算', () => {
    const detail = makeDetail({
      meta: { advertiser: 'GlowLab', scenarioSub: 'monthly' } as ProjectMeta,
      pages: [
        {
          id: 'p1',
          name: '自定义标题',
          components: [
            { id: 'c1', type: 'text', x: 0, y: 0, w: 100, h: 50, data: { content: '自定义标题', fontSize: 56, color: '#000' } },
          ],
          pageType: 'media-report',
          titleComponentId: 'c1',
          titleOverridden: true,
        },
      ],
    });
    useEditorStore.getState().loadProject(detail, detail.name);
    expect(page().name).toBe('自定义标题');
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm --filter @mediakit/web test -- editor.page-type`
Expected: FAIL — `s.setPageType is not a function`。

- [ ] **Step 3a: 补 imports** — 在 `apps/web/src/editor/store.ts` 顶部，把已有的从 `@mediakit/shared` 的**值导入**（已含 `normalizeTheme`）加入 `buildReportTitle`；把已有的**类型导入**加入 `PageType`：

```ts
// 值导入（与 normalizeTheme 同处）：追加 buildReportTitle
import { normalizeTheme, buildReportTitle } from '@mediakit/shared';
// 类型导入（与 Page/EditorComponent/ComponentData 同处）：追加 PageType
import type { Page, EditorComponent, ComponentData, PageType } from '@mediakit/shared';
```

> 实际导入语句可能合并为一行或多行；执行时读文件后把 `buildReportTitle` 加到现有的值导入列表、`PageType` 加到现有的类型导入列表即可。若 store 现仅有 `import type {...}`，则新增一行 `import { buildReportTitle } from '@mediakit/shared';`。

- [ ] **Step 3b: `EditorState` 接口加签名** — 在 `apps/web/src/editor/store.ts` 的 `EditorState`（`updatePage`/`patchPageLive` 附近，约 `:155-159`）追加：

```ts
  /** 设页面类型；'media-report' 会确保存在标题组件并生成默认标题。 */
  setPageType: (pageId: string, pageType: PageType | undefined) => void;
  /** 「恢复自动」：清除 overridden 并重算标题。 */
  restoreReportTitle: (pageId: string) => void;
```

- [ ] **Step 3c: 插入内部 helper** — 在 `apps/web/src/editor/store.ts` 的 `mutateAndCommit` 定义之后、`return {`（状态对象开头，约 `:246`）之前插入：

```ts
  /** 构造一个大号文本组件作为页面标题。 */
  function makeTitleComponent(content: string): EditorComponent {
    return {
      id: newId(),
      type: 'text',
      x: 120,
      y: 240,
      w: 1000,
      h: 120,
      data: { content, fontSize: 56, fontWeight: 700, fontFamily: '', color: '#1A1A1A' },
    };
  }

  /** 重算并写回某投放报告页的标题（仅 pageType='media-report' 且未 overridden）。 */
  function refreshReportTitle(pageId: string) {
    const s = get();
    const p = s.pages.find((pg) => pg.id === pageId);
    if (!p || p.pageType !== 'media-report' || p.titleOverridden) return;
    const title = buildReportTitle(s.projectMeta ?? {});
    const titleId = p.titleComponentId;
    const titleComp = titleId ? p.components.find((c) => c.id === titleId) : undefined;
    const currentContent = titleComp ? (titleComp.data as { content?: string }).content : undefined;
    if (p.name === title && currentContent === title) return; // 无变化不标脏
    set({
      dirty: true,
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
    });
  }

  /** 遍历所有未 overridden 的投放报告页，重算标题。 */
  function refreshAllReportTitles() {
    get().pages.forEach((p) => {
      if (p.pageType === 'media-report' && !p.titleOverridden) refreshReportTitle(p.id);
    });
  }
```

- [ ] **Step 3d: `loadProject` 末尾刷新** — 在 `apps/web/src/editor/store.ts` 的 `loadProject`（`set({...})` 之后、`},` 之前，约 `:307`）追加一行：

```ts
      });
      refreshAllReportTitles();
    },
```

- [ ] **Step 3e: 新增 `setPageType` / `restoreReportTitle` 动作** — 在 `apps/web/src/editor/store.ts` 的 `renamePage`（`:755`）之前（或 `updatePage` 之后任意位置）插入：

```ts
    setPageType: (pageId, pageType) => {
      mutateAndCommit((s) => ({
        pages: s.pages.map((p) => {
          if (p.id !== pageId) return p;
          if (pageType !== 'media-report') {
            return { ...p, pageType: undefined, titleComponentId: undefined, titleOverridden: undefined };
          }
          const title = buildReportTitle(s.projectMeta ?? {});
          const titleId = p.titleComponentId;
          const hasTitleComp = !!titleId && !!p.components.find((c) => c.id === titleId);
          if (!hasTitleComp) {
            const created = makeTitleComponent(title);
            return {
              ...p,
              pageType: 'media-report',
              titleComponentId: created.id,
              titleOverridden: false,
              components: [created, ...p.components],
              name: title,
            };
          }
          return {
            ...p,
            pageType: 'media-report',
            titleComponentId: titleId,
            titleOverridden: false,
            name: title,
            components: p.components.map((c) =>
              c.id === titleId ? { ...c, data: { ...(c.data as object), content: title } as unknown as ComponentData } : c,
            ),
          };
        }),
      }));
    },

    restoreReportTitle: (pageId) => {
      mutateAndCommit((s) => ({
        pages: s.pages.map((p) => (p.id === pageId ? { ...p, titleOverridden: false } : p)),
      }));
      refreshReportTitle(pageId);
    },
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm --filter @mediakit/web test -- editor.page-type`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/store.ts apps/web/tests/editor.page-type.test.ts && git commit -m "feat(web): store 支持 pageType 标题生命周期（setPageType/restore/refresh/load 刷新）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: store — 手改标题停止自动跟随（`updateComponent` + `renamePage`）

**Files:**
- Modify: `apps/web/src/editor/store.ts:524-530`（`updateComponent`）、`:755-758`（`renamePage`）
- Test: `apps/web/tests/editor.page-type.test.ts`（追加 `describe`）

- [ ] **Step 1: 写失败测试** — 在 `apps/web/tests/editor.page-type.test.ts` 末尾追加：

```ts
describe('手改标题停止自动跟随', () => {
  beforeEach(() => load({ advertiser: 'GlowLab', scenarioSub: 'weekly' }));

  it('编辑标题组件 content → titleOverridden=true 且 name 同步', () => {
    const s = useEditorStore.getState();
    s.setPageType('p1', 'media-report');
    const titleId = page().titleComponentId!;
    const data = page().components.find((c) => c.id === titleId)!.data as { content: string; fontSize: number; color: string };
    s.updateComponent(titleId, { data: { ...data, content: '自定义标题' } });
    s.commit();
    const p = page();
    expect(p.titleOverridden).toBe(true);
    expect(p.name).toBe('自定义标题');
  });

  it('改标题组件字号（非 content）不触发 overridden', () => {
    const s = useEditorStore.getState();
    s.setPageType('p1', 'media-report');
    const titleId = page().titleComponentId!;
    const data = page().components.find((c) => c.id === titleId)!.data as { content: string; fontSize: number; color: string };
    s.updateComponent(titleId, { data: { ...data, fontSize: 40 } });
    s.commit();
    expect(page().titleOverridden).toBe(false);
  });

  it('拖拽标题组件（非 data patch）不触发 overridden', () => {
    const s = useEditorStore.getState();
    s.setPageType('p1', 'media-report');
    const titleId = page().titleComponentId!;
    s.updateComponent(titleId, { x: 200, y: 100 });
    expect(page().titleOverridden).toBe(false);
  });

  it('侧栏改名 media-report 页 → overridden=true 且标题组件同步', () => {
    const s = useEditorStore.getState();
    s.setPageType('p1', 'media-report');
    s.renamePage('p1', '我的封面');
    const p = page();
    expect(p.titleOverridden).toBe(true);
    expect(p.name).toBe('我的封面');
    expect(
      (p.components.find((c) => c.id === p.titleComponentId)!.data as { content: string }).content,
    ).toBe('我的封面');
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm --filter @mediakit/web test -- editor.page-type`
Expected: FAIL — 手改 content 后 `titleOverridden` 仍为 `false`。

- [ ] **Step 3: 实现** — 把 `apps/web/src/editor/store.ts` 的 `updateComponent`（`:524-530`）替换为：

```ts
    updateComponent: (id, patch) =>
      set((s) => {
        const cur = s.pages.find((p) => p.id === s.currentPageId);
        const isTitleComp = cur?.pageType === 'media-report' && cur?.titleComponentId === id;
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
```

- [ ] **Step 3b: `renamePage` 同步标题组件并停跟随** — 把 `apps/web/src/editor/store.ts:755-758` 的 `renamePage` 替换为：

```ts
    renamePage: (id, name) =>
      mutateAndCommit((s) => ({
        pages: s.pages.map((p) => {
          if (p.id !== id) return p;
          const next = name.trim() || p.name;
          if (next === p.name) return p; // 无变化不改状态
          if (p.pageType !== 'media-report' || !p.titleComponentId) return { ...p, name: next };
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
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm --filter @mediakit/web test -- editor.page-type`
Expected: PASS（含原有 Task 4 用例 + 新增 4 条）。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/store.ts apps/web/tests/editor.page-type.test.ts && git commit -m "feat(web): 手改投放报告标题（content 或侧栏改名）后停止自动跟随并同步

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: store — 复制页重指向标题组件 + 模板应用接受 titleComponentIndex

**Files:**
- Modify: `apps/web/src/editor/store.ts`（`EditorState` 中 `addPageWithComponents`/`addPagesBatch` 签名 `:150-151`；二者实现 `:710-728`；`copyPage` 实现 `:730-744`）
- Test: `apps/web/tests/editor.page-type.test.ts`（追加 `describe`）

- [ ] **Step 1: 写失败测试** — 在 `apps/web/tests/editor.page-type.test.ts` 末尾追加：

```ts
describe('addPageWithComponents / copyPage — 模板与复制', () => {
  beforeEach(() => load({ advertiser: 'GlowLab', scenarioSub: 'weekly' }));

  it('addPageWithComponents 带 titleComponentIndex → media-report + 标题', () => {
    const comp = {
      id: 'x',
      type: 'text' as const,
      x: 0,
      y: 0,
      w: 100,
      h: 50,
      data: { content: 'Report Title', fontSize: 56, color: '#000' },
    };
    useEditorStore.getState().addPageWithComponents('封面', [comp], { titleComponentIndex: 0 });
    const p = useEditorStore.getState().pages[1];
    expect(p.pageType).toBe('media-report');
    expect(p.name).toBe("GlowLab's MEDIA REPORT · 上周");
    expect((p.components[0].data as { content: string }).content).toBe("GlowLab's MEDIA REPORT · 上周");
  });

  it('copyPage 复制 media-report 页：保留 pageType 并重指向标题组件', () => {
    const s = useEditorStore.getState();
    s.setPageType('p1', 'media-report');
    const srcTitleId = page().titleComponentId!;
    s.copyPage('p1');
    const copy = useEditorStore.getState().pages[1];
    expect(copy.pageType).toBe('media-report');
    expect(copy.titleComponentId).toBeTruthy();
    expect(copy.titleComponentId).not.toBe(srcTitleId);
    expect(copy.components.find((c) => c.id === copy.titleComponentId)).toBeTruthy();
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm --filter @mediakit/web test -- editor.page-type`
Expected: FAIL — `addPageWithComponents` 不接受第三参；`copyPage` 后副本无 `pageType`。

- [ ] **Step 3a: 改签名** — 在 `EditorState`（`:150-151`）替换这两行：

```ts
  addPageWithComponents: (name: string, components: EditorComponent[], opts?: { titleComponentIndex?: number }) => void;
  addPagesBatch: (pages: { name: string; components: EditorComponent[]; titleComponentIndex?: number }[]) => void;
```

- [ ] **Step 3b: 实现 `addPageWithComponents`** — 替换 `:710-716`：

```ts
    addPageWithComponents: (name, components, opts) => {
      let pageId: string | undefined;
      mutateAndCommit((s) => {
        const reid = components.map((c) => ({ ...clone(c), id: newId() }));
        const page: Page = { id: newId(), name, components: reid };
        pageId = page.id;
        const idx = opts?.titleComponentIndex;
        if (idx != null && reid[idx]) {
          page.pageType = 'media-report';
          page.titleComponentId = reid[idx].id;
          page.titleOverridden = false;
        }
        return { pages: [...s.pages, page], currentPageId: page.id, selectedIds: [] };
      });
      if (pageId) refreshReportTitle(pageId);
    },
```

- [ ] **Step 3c: 实现 `addPagesBatch`** — 替换 `:718-728`：

```ts
    addPagesBatch: (pages) => {
      const newIds: string[] = [];
      mutateAndCommit((s) => {
        const built: Page[] = pages.map((p) => {
          const reid = p.components.map((c) => ({ ...clone(c), id: newId() }));
          const page: Page = { id: newId(), name: p.name, components: reid };
          newIds.push(page.id);
          const idx = p.titleComponentIndex;
          if (idx != null && reid[idx]) {
            page.pageType = 'media-report';
            page.titleComponentId = reid[idx].id;
            page.titleOverridden = false;
          }
          return page;
        });
        if (built.length === 0) return {};
        return { pages: [...s.pages, ...built], currentPageId: built[0].id, selectedIds: [] };
      });
      newIds.forEach((id) => refreshReportTitle(id));
    },
```

- [ ] **Step 3d: 实现 `copyPage`** — 替换 `:730-744`：

```ts
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
          ...(src.pageType ? { pageType: src.pageType } : {}),
          ...(src.titleComponentId ? { titleComponentId: idMap.get(src.titleComponentId) } : {}),
          ...(src.titleOverridden ? { titleOverridden: src.titleOverridden } : {}),
        };
        newPageId = copied.id;
        const idx = s.pages.findIndex((p) => p.id === id);
        const pages = [...s.pages];
        pages.splice(idx + 1, 0, copied);
        return { pages };
      });
      if (newPageId) refreshReportTitle(newPageId);
    },
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm --filter @mediakit/web test -- editor.page-type`
Expected: PASS（全部用例）。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/store.ts apps/web/tests/editor.page-type.test.ts && git commit -m "feat(web): addPageWithComponents/addPagesBatch 支持 titleComponentIndex；copyPage 重指向标题组件

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: 模板 — `Template.pageTitleIndex` + `cover-page`

**Files:**
- Modify: `apps/web/src/editor/templates.ts:9-14`（`Template` 接口）、cover-page 模板（约 `:214`）
- Test: `apps/web/tests/templates.cover.test.ts`（新建）

- [ ] **Step 1: 写失败测试** — 新建 `apps/web/tests/templates.cover.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { getTemplate } from '@/editor/templates';

describe('cover-page 模板', () => {
  it('声明 pageTitleIndex=0（首个组件为标题）', () => {
    expect(getTemplate('cover-page')?.pageTitleIndex).toBe(0);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm --filter @mediakit/web test -- templates.cover`
Expected: FAIL — `pageTitleIndex` 为 `undefined`。

- [ ] **Step 3a: 扩展 `Template` 接口** — 把 `apps/web/src/editor/templates.ts:9-14` 改为：

```ts
export interface Template {
  id: string;
  name: string;
  description: string;
  components: () => EditorComponent[];
  /** 标题组件在 components() 返回数组中的下标；命中则应用时该页为投放报告页（media-report）。 */
  pageTitleIndex?: number;
}
```

- [ ] **Step 3b: 给 cover-page 加 `pageTitleIndex`** — 找到 `id: 'cover-page'` 的模板对象（约 `:214-228`），在 `description: '大标题 + 副标题',` 之后加一行：

```ts
  {
    id: 'cover-page',
    name: '封面页',
    description: '大标题 + 副标题',
    pageTitleIndex: 0,
    components: () => {
      // ... 不变
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm --filter @mediakit/web test -- templates.cover`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/templates.ts apps/web/tests/templates.cover.test.ts && git commit -m "feat(web): Template 增 pageTitleIndex；cover-page 声明标题组件下标

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: UI 接线 — 场景/模板应用透传 + 页面类型切换按钮

**Files:**
- Modify: `apps/web/src/editor/components/ScenarioOverlay.tsx`（`applyScenario`）
- Modify: `apps/web/src/editor/PageSidebar.tsx`（`applyTemplate` + 悬停按钮行 `:95-118`）

> 本任务无新增自动化测试（接线层）；由 Task 6 的 store 测试覆盖数据流，本任务以 typecheck 验证。

- [ ] **Step 1: `ScenarioOverlay.applyScenario` 透传** — 把 `apps/web/src/editor/components/ScenarioOverlay.tsx` 的 `applyScenario` 替换为：

```ts
function applyScenario(scenario: ScenarioTemplate) {
  const pages = scenario.pages.map((sp) => {
    const tpl = getTemplate(sp.templateId);
    return {
      name: sp.name,
      components: tpl?.components() ?? [],
      ...(tpl?.pageTitleIndex != null ? { titleComponentIndex: tpl.pageTitleIndex } : {}),
    };
  });
  useEditorStore.getState().addPagesBatch(pages);
}
```

- [ ] **Step 2: `PageSidebar.applyTemplate` 透传** — 把 `apps/web/src/editor/PageSidebar.tsx:26-33` 的 `applyTemplate` 替换为：

```ts
  function applyTemplate(tpl: Template) {
    if (tpl.id === 'blank') {
      useEditorStore.getState().addPage();
    } else {
      useEditorStore
        .getState()
        .addPageWithComponents(
          tpl.name,
          tpl.components(),
          tpl.pageTitleIndex != null ? { titleComponentIndex: tpl.pageTitleIndex } : undefined,
        );
    }
    setShowTemplates(false);
  }
```

- [ ] **Step 3: 悬停菜单加「页面类型」切换按钮** — 在 `apps/web/src/editor/PageSidebar.tsx:95` 的悬停按钮行 `<div className="flex items-center gap-1 opacity-0 ...">` 内、复制按钮**之前**插入：

```tsx
              <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                <button
                  title={p.pageType === 'media-report' ? '取消投放报告标题' : '设为投放报告标题'}
                  onClick={(e) => {
                    e.stopPropagation();
                    useEditorStore
                      .getState()
                      .setPageType(p.id, p.pageType === 'media-report' ? undefined : 'media-report');
                  }}
                  className="rounded px-1 py-0.5 text-xs hover:bg-surface-hover"
                >
                  {p.pageType === 'media-report' ? '🔹' : '⚪'}
                </button>
                {/* 原有复制 / 删除按钮保持不变 */}
```

- [ ] **Step 4: typecheck**

Run: `pnpm --filter @mediakit/web exec tsc --noEmit`
Expected: 无错误。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/components/ScenarioOverlay.tsx apps/web/src/editor/PageSidebar.tsx && git commit -m "feat(web): 场景/封面模板应用透传标题组件；页面栏加投放报告类型切换

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: UI — 选中 overridden 标题组件时显示「恢复自动标题」

**Files:**
- Modify: `apps/web/src/editor/PropertyPanel.tsx`（`PropertyPanel` 顶部 hook + 标题标签后插入按钮，约 `:51-90`）

> 无新增自动化测试；typecheck + 手动验证。

- [ ] **Step 1: 加订阅 hook** — 在 `apps/web/src/editor/PropertyPanel.tsx` 的 `PropertyPanel` 内、`const comp = ...` 之后（约 `:56`）插入：

```ts
  const currentPage = useEditorStore((s) => s.pages.find((p) => p.id === s.currentPageId));
  const restoreReportTitle = useEditorStore((s) => s.restoreReportTitle);
```

- [ ] **Step 2: 插入「恢复自动标题」按钮** — 在组件标题 `<div className="font-headings text-sm font-semibold ...">{LABELS[comp.type] ?? comp.type}</div>`（约 `:84-86`）之后插入：

```tsx
      {currentPage?.pageType === 'media-report' &&
        currentPage.titleComponentId === comp.id &&
        currentPage.titleOverridden && (
          <button
            onClick={() => restoreReportTitle(currentPage.id)}
            className="rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
          >
            🔄 恢复自动标题
          </button>
        )}
```

- [ ] **Step 3: typecheck**

Run: `pnpm --filter @mediakit/web exec tsc --noEmit`
Expected: 无错误。

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/editor/PropertyPanel.tsx && git commit -m "feat(web): 选中已手改的投放报告标题组件时显示恢复自动标题

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 10: 全量验证

- [ ] **Step 1: 类型检查（全部包）**

Run: `pnpm -r typecheck`
Expected: 无错误。

- [ ] **Step 2: 全量测试**

Run: `pnpm -r test`
Expected: 全绿（含新增 `shared.report-title` / `shared.types` / `editor.page-type` / `projects.schema` / `templates.cover`，且原有用例不受影响）。

- [ ] **Step 3: 手动回归**（`pnpm dev` 后浏览器）：

1. 新建 campaign-report 项目：advertiser=`GlowLab`、scenarioSub=`周报`、选一个带起止日期的 campaign。
2. 在编辑器加「封面页」→ 画布大标题与侧栏名都变为 `GlowLab's MEDIA REPORT · 上周`。
3. 用「+ 报告」应用 Campaign Biweekly Report 场景 → 其 Cover / Back Cover 页同样自动带标题。
4. 在侧栏某页悬停点 ⚪ 设为投放报告 → 生成标题；再点 🔹 取消。
5. 选中封面标题组件、改「内容」为自定义文本 → 侧栏名同步、出现「🔄 恢复自动标题」；点恢复 → 回到自动标题。
6. 双击侧栏某 media-report 页名改成自定义 → 画布标题同步、停止自动跟随。
7. 编辑项目改为月报（项目编辑弹窗）→ 重新打开 → 封面标题变 `· 上月`。
8. 结案子类 + campaign 起止 → 标题变 `· YYYY.MM.DD–YYYY.MM.DD`。

- [ ] **Step 4: 收尾**

按 `superpowers:finishing-a-development-branch` 决定合并/PR/清理。

---

## 风险与回滚

- 全部为**新增可选字段**，存量项目反序列化与 zod 校验兼容；若线上发现问题，回滚本分支即可，不影响存量数据。
- `PageType` 取值集合发布后勿改名/删除（会破坏存量 `Project.pages` JSON）。
- `loadProject` 末尾的 `refreshAllReportTitles` 仅在标题确有变化时置脏；标题已正确时不会把项目标脏。
