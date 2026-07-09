# 作品截图组件：复用组图样式 + 接入达人作品 mock — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the existing `work-screenshot` component to reuse 组图's count-based mosaic layout engine (`resolveLayout`), keep its title/caption shell, and wire in 达人作品截图 mock data (default seed + a "从达人数据导入" importer).

**Architecture:** Pure frontend change inside `apps/web` + a shared-type widening. No new ComponentType, no server changes. The 组图 layout math (`buildGridStyle`/`cellStyle`) is extracted from `ImageGroupComponent` and shared. A new synchronous helper `campaignWorkScreenshots(campaignId)` reads the existing `MOCK_PERFORMANCE` to produce `{src, caption}` screenshots; the importer calls the existing async `listCreatorPerformance`. Old saved `variant` values (grid/masonry/hero/skew) are not in the new mosaic table and gracefully fall back to count-based auto-selection via `resolveLayout`.

**Tech Stack:** React 18 + TypeScript, Zustand store, vitest + @testing-library/react (jsdom, recharts mocked). Monorepo: `@mediakit/web` (`apps/web`), `@mediakit/shared` (`packages/shared`). Commands: `pnpm --filter @mediakit/web exec vitest run <file>` (single test), `pnpm --filter @mediakit/web test` (all web), `pnpm --filter @mediakit/web typecheck`, `pnpm --filter @mediakit/web build`.

**Spec:** `docs/superpowers/specs/2026-07-09-work-screenshot-image-group-style-design.md`

**Isolation:** Execute inside a worktree (per project memory: user runs concurrent features with uncommitted changes; never `git add` a whole dirty file; do `git add <exact paths> && git commit` as one atomic command because the IDE resets the git index across CLI calls).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `apps/web/src/editor/components/ImageGroupComponent.tsx` | 组图 layout math + render | Modify: extract+export `buildGridStyle`, `cellStyle` |
| `apps/web/src/api/creatorPerformance.ts` | 达人效果 mock 上游 | Modify: add+export `campaignWorkScreenshots` |
| `packages/shared/src/index.ts` | shared types | Modify: widen `WorkScreenshotData.variant` + add `gap?` |
| `apps/web/src/editor/components/WorksComponents.tsx` | `WorkScreenshot` renderer | Modify: rewrite using mosaic engine |
| `apps/web/src/editor/defaults.ts` | component default data/sizes | Modify: seed `work-screenshot` with mock screenshots |
| `apps/web/src/editor/registry.tsx` | `REGISTRY` block defs | Modify: `work-screenshot` variants → 9 mosaics |
| `apps/web/src/editor/PropertyPanel.tsx` | property panel | Modify: add `ReportWorkScreenshotImporter` |
| `apps/web/tests/campaign-work-screenshots.test.ts` | helper unit test | Create |
| `apps/web/tests/works.test.tsx` | renderer test | Modify: new variants + mosaic-grid assertions |
| `apps/web/tests/property-works.test.tsx` | panel test | Modify: default 9 images + importer test |

---

## Task 1: Extract shared mosaic-grid helpers from 组图

Refactor only — 组图 behavior must stay identical. Ends with `editor.image-group.test.tsx` still green.

**Files:**
- Modify: `apps/web/src/editor/components/ImageGroupComponent.tsx`

- [ ] **Step 1: Replace the inline `gridStyle`/`cellStyle` computation in `ImageGroupComponent` with exported helpers.**

Replace the function body of `ImageGroupComponent` (lines 87–135) and insert two exported helpers above it. Final relevant section of the file becomes:

```tsx
/** 网格容器样式：列/行模板按版式铺满。 */
export function buildGridStyle(layout: LayoutDef, gap: number): CSSProperties {
  return {
    display: 'grid',
    gap,
    gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
    gridTemplateRows: layout.rowHeights
      ? layout.rowHeights.map((h) => `${h}fr`).join(' ')
      : `repeat(${layout.rows}, 1fr)`,
    width: '100%',
    height: '100%',
  };
}

/** 单元格样式：列/行起点 + 跨度 + 圆角。 */
export function cellStyle(cell: LayoutCell): CSSProperties {
  return {
    gridColumn: `${cell.c} / span ${cell.cs ?? 1}`,
    gridRow: `${cell.r} / span ${cell.rs ?? 1}`,
    overflow: 'hidden',
    borderRadius: 8,
  };
}

export function ImageGroupComponent({ data }: { data: ImageGroupData }) {
  const { variant, images = [], gap = 8 } = data;

  // 无图 → 整块占位。
  if (!images || images.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-xl border border-border-default bg-surface-hover text-xs text-foreground-muted">
        组图
      </div>
    );
  }

  const layout = resolveLayout(variant, images.length);

  return (
    <div className="h-full w-full" style={buildGridStyle(layout, gap)}>
      {layout.cells.map((cell, i) => {
        const src = images[i]?.src;
        return (
          <div key={i} style={cellStyle(cell)} className="bg-surface-hover">
            {src ? (
              <img src={src} alt="" draggable={false} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-foreground-muted">
                图片
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

(`resolveLayout`, `LAYOUTS`, `BY_ID`, `LayoutDef`, `LayoutCell` stay as-is above this section. `CSSProperties` is already imported at the top of the file.)

- [ ] **Step 2: Verify 组图 tests still pass + typecheck.**

Run: `pnpm --filter @mediakit/web exec vitest run tests/editor.image-group.test.tsx && pnpm --filter @mediakit/web typecheck`
Expected: PASS (all image-group tests), typecheck clean.

- [ ] **Step 3: Commit.**

```bash
git add apps/web/src/editor/components/ImageGroupComponent.tsx && git commit -m "refactor(web): 抽取组图 buildGridStyle/cellStyle 共享工具"
```

---

## Task 2: Add `campaignWorkScreenshots` mock helper (TDD)

**Files:**
- Modify: `apps/web/src/api/creatorPerformance.ts`
- Create: `apps/web/tests/campaign-work-screenshots.test.ts`

- [ ] **Step 1: Write the failing test.**

Create `apps/web/tests/campaign-work-screenshots.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { campaignWorkScreenshots } from '@/api/creatorPerformance';

describe('campaignWorkScreenshots', () => {
  it('returns deterministic creator-work screenshots for a known campaign', () => {
    const shots = campaignWorkScreenshots('camp-glowlow-q4');
    // Mia(头部,4) + Sofia(腰部,3) + Tom(KOC,2) = 9
    expect(shots).toHaveLength(9);
    expect(shots.every((s) => s.src.startsWith('https://picsum.photos/seed/'))).toBe(true);
    expect(shots[0].caption ?? '').toContain('·');
    // 同输入 → 同输出（确定性）
    expect(campaignWorkScreenshots('camp-glowlow-q4')).toEqual(shots);
  });

  it('returns [] for an unknown campaign', () => {
    expect(campaignWorkScreenshots('does-not-exist')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `pnpm --filter @mediakit/web exec vitest run tests/campaign-work-screenshots.test.ts`
Expected: FAIL — `campaignWorkScreenshots is not exported` / undefined.

- [ ] **Step 3: Implement the helper.**

In `apps/web/src/api/creatorPerformance.ts`, add `WorkScreenshotItem` to the existing `import type { ... } from '@mediakit/shared';` block (line 1), then append this export at the end of the file (after `listPlacementTypeSummary`):

```ts
/**
 * 取某 campaign 下各合作达人作品的截图（mock，同步、确定性）。
 * 把 MOCK_PERFORMANCE 中各达人 posts 的 cover 拍平为 { src, caption }，
 * 供 work-screenshot 组件默认种子 / 导入复用。
 */
export function campaignWorkScreenshots(campaignId: string): WorkScreenshotItem[] {
  const perfs = MOCK_PERFORMANCE[campaignId] ?? [];
  const out: WorkScreenshotItem[] = [];
  for (const p of perfs) {
    for (const post of p.posts) {
      out.push({ src: post.cover ?? '', caption: `${p.creatorName} · ${post.title}` });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes.**

Run: `pnpm --filter @mediakit/web exec vitest run tests/campaign-work-screenshots.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add apps/web/src/api/creatorPerformance.ts apps/web/tests/campaign-work-screenshots.test.ts && git commit -m "feat(web): 新增 campaignWorkScreenshots 达人作品截图 mock 取数"
```

---

## Task 3: Switch `work-screenshot` to the mosaic engine (type + renderer + defaults + registry + tests)

This is one atomic change: the shared type widens, the renderer is rewritten, registry variants change, defaults seed from the helper, and tests are updated together so every intermediate compiles. The new mosaic-grid assertions are the red→green signal.

**Files:**
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/web/src/editor/components/WorksComponents.tsx`
- Modify: `apps/web/src/editor/defaults.ts`
- Modify: `apps/web/src/editor/registry.tsx`
- Modify: `apps/web/tests/works.test.tsx`
- Modify: `apps/web/tests/property-works.test.tsx`

- [ ] **Step 1: Widen the shared type.**

In `packages/shared/src/index.ts`, replace the `WorkScreenshotData` interface (lines 1180–1185):

```ts
/** 作品截图墙。复用组图版式引擎（variant = ImageGroupLayoutId）；缺省 'auto'。 */
export interface WorkScreenshotData {
  variant?: ImageGroupLayoutId;
  title?: string;
  images: WorkScreenshotItem[];
  /** 单元格间距（px）；可选，缺省 8（与组图一致）。 */
  gap?: number;
}
```

(`ImageGroupLayoutId` is defined earlier in the same file at line ~802, no new import needed. `WorkScreenshotItem` already exists at line ~1175.)

- [ ] **Step 2: Update `works.test.tsx` to the new variant set + add mosaic-grid assertions (this goes red until Step 3).**

Replace the entire `describe('WorkScreenshot', ...)` block (the first describe, lines 7–40) with:

```tsx
describe('WorkScreenshot', () => {
  it('renders the title and a placeholder tile for each image lacking src', () => {
    const data: WorkScreenshotData = {
      variant: 'auto',
      title: '代表作',
      images: [{ src: '' }, { src: '' }],
    };
    render(<WorkScreenshot data={data} />);
    expect(screen.getByText('代表作')).toBeInTheDocument();
    // 每张缺 src 的图各渲染一个占位
    expect(screen.getAllByText('作品截图').length).toBe(2);
  });

  it('renders provided screenshot images', () => {
    const data: WorkScreenshotData = {
      variant: 'auto',
      images: [{ src: 'a.jpg' }, { src: 'b.jpg' }],
    };
    render(<WorkScreenshot data={data} />);
    const imgs = screen.getAllByRole('img');
    expect(imgs.map((i) => i.getAttribute('src'))).toEqual(['a.jpg', 'b.jpg']);
  });

  it('uses count-based mosaic layout: 2 images → 2 columns (duo)', () => {
    const { container } = render(
      <WorkScreenshot data={{ variant: 'auto', images: [{ src: 'a.jpg' }, { src: 'b.jpg' }] }} />,
    );
    const grid = container.querySelector('[style*="grid-template-columns"]') as HTMLElement;
    expect(grid?.style.gridTemplateColumns).toBe('repeat(2, 1fr)');
  });

  it('uses count-based mosaic layout: 9 images → 3 columns (nona)', () => {
    const { container } = render(
      <WorkScreenshot
        data={{ variant: 'auto', images: Array.from({ length: 9 }, () => ({ src: 'x.jpg' })) }}
      />,
    );
    const grid = container.querySelector('[style*="grid-template-columns"]') as HTMLElement;
    expect(grid?.style.gridTemplateColumns).toBe('repeat(3, 1fr)');
  });

  it('every image-group variant renders the images without throwing', () => {
    for (const v of [
      'auto', 'duo', 'trio', 'quad', 'mosaic-5', 'hex', 'septet', 'nona', 'duoza',
    ] as const) {
      const { unmount } = render(
        <WorkScreenshot data={{ variant: v, images: [{ src: 'x.jpg' }, { src: 'y.jpg' }] }} />,
      );
      expect(screen.getAllByRole('img').length).toBeGreaterThanOrEqual(1);
      unmount();
    }
  });

  it('shows an empty hint when there are no images', () => {
    render(<WorkScreenshot data={{ variant: 'auto', images: [] }} />);
    expect(screen.getByText('暂无作品截图')).toBeInTheDocument();
  });
});
```

Leave the `WorkMetrics` and `CommentWordcloud` describes below unchanged.

- [ ] **Step 3: Run test to verify the mosaic assertions fail (red).**

Run: `pnpm --filter @mediakit/web exec vitest run tests/works.test.tsx`
Expected: FAIL — the two `grid-template-columns` tests fail because the old renderer uses a Tailwind `grid-cols-3` class (no inline style). (`works.test.tsx` may not compile yet because `WorkScreenshotData.variant: 'auto'` is now valid after Step 1, and the renderer still references `'masonry'`/`'hero'`/`'skew'` — those comparisons error in typecheck, but vitest uses esbuild transpile which strips types without type-checking, so the test will run and fail on the assertion. Proceed to Step 4 to fix both.)

- [ ] **Step 4: Rewrite the `WorkScreenshot` renderer.**

In `apps/web/src/editor/components/WorksComponents.tsx`:

First, add the import (after the existing `import type { ... } from '@mediakit/shared';` at line 12):

```tsx
import { resolveLayout, buildGridStyle, cellStyle } from './ImageGroupComponent';
```

Then replace the entire `/* work screenshot */` section — the `Screenshot` helper stays, but delete `WorkScreenshot`, `GridGallery`, `MasonryGallery`, `HeroGallery`, `SkewGallery` (lines 48–129) — and replace with:

```tsx
/** 作品截图墙：复用组图按张数自动选版的马赛克引擎；外壳保留标题 + 截图说明。 */
export function WorkScreenshot({ data }: { data: WorkScreenshotData }) {
  const { variant, title, images = [], gap = 8 } = data;

  if (images.length === 0) {
    return (
      <Shell title={title}>
        <div className="flex h-full w-full items-center justify-center text-xs text-foreground-muted">
          暂无作品截图
        </div>
      </Shell>
    );
  }

  const layout = resolveLayout(variant, images.length);
  return (
    <Shell title={title}>
      <div className="h-full w-full" style={buildGridStyle(layout, gap)}>
        {layout.cells.map((cell, i) => {
          const im = images[i];
          return (
            <div key={i} style={cellStyle(cell)} className="bg-surface-hover">
              <Screenshot src={im?.src ?? ''} caption={im?.caption} />
            </div>
          );
        })}
      </div>
    </Shell>
  );
}
```

(Keep the `Shell` helper above and the `Screenshot` helper exactly as they are. The `WorkMetrics` / `CommentWordcloud` sections below stay unchanged.)

- [ ] **Step 5: Update registry variants.**

In `apps/web/src/editor/registry.tsx`, replace the `variants` array inside the `'work-screenshot'` block (lines 459–464) with:

```tsx
    variants: [
      { id: 'auto', label: '自适应' },
      { id: 'duo', label: '2 张' },
      { id: 'trio', label: '3 张' },
      { id: 'quad', label: '4 张' },
      { id: 'mosaic-5', label: '5 张' },
      { id: 'hex', label: '6 张' },
      { id: 'septet', label: '7 张' },
      { id: 'nona', label: '9 张' },
      { id: 'duoza', label: '12 张' },
    ],
```

- [ ] **Step 6: Seed default data from the helper.**

In `apps/web/src/editor/defaults.ts`, add the import near the top imports (with the other `@/` or relative imports — place after the existing editor imports):

```tsx
import { campaignWorkScreenshots } from '@/api/creatorPerformance';
```

Then replace the `case 'work-screenshot':` block (lines 398–407) with:

```tsx
    case 'work-screenshot':
      return {
        variant: 'auto',
        title: '达人作品截图',
        images: campaignWorkScreenshots('camp-glowlow-q4'),
      };
```

- [ ] **Step 7: Update `property-works.test.tsx` default-image count (3 → 9) + caption edit still works.**

In `apps/web/tests/property-works.test.tsx`, in the `WorkScreenshotFields` describe, change the first test's assertion (the comment says "默认 3 张"):

```tsx
    expect(screen.getAllByPlaceholderText('说明').length).toBe(9); // 默认 9 张（camp-glowlow-q4）
```

The "edits a caption" test needs no change (it writes to `images[0].caption` regardless of seed).

- [ ] **Step 8: Run all affected tests + typecheck.**

Run: `pnpm --filter @mediakit/web exec vitest run tests/works.test.tsx tests/property-works.test.tsx tests/editor.image-group.test.tsx tests/registry.test.ts && pnpm --filter @mediakit/web typecheck`
Expected: all PASS, typecheck clean.

- [ ] **Step 9: Commit.**

```bash
git add packages/shared/src/index.ts apps/web/src/editor/components/WorksComponents.tsx apps/web/src/editor/defaults.ts apps/web/src/editor/registry.tsx apps/web/tests/works.test.tsx apps/web/tests/property-works.test.tsx && git commit -m "feat(web): work-screenshot 换用组图马赛克版式 + 默认达人作品种子"
```

---

## Task 4: Add "从达人数据导入" importer to the property panel (TDD)

**Files:**
- Modify: `apps/web/src/editor/PropertyPanel.tsx`
- Modify: `apps/web/tests/property-works.test.tsx`

- [ ] **Step 1: Write the failing importer test.**

In `apps/web/tests/property-works.test.tsx`, add `waitFor` to the testing-library import:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
```

Add `ReportCampaign` to the `@mediakit/shared` type import, then append this test inside the `describe('WorkScreenshotFields', ...)` block:

```tsx
  it('imports creator work screenshots from a bound campaign', async () => {
    const store = useEditorStore.getState();
    store.loadProject(emptyProject, 'p');
    store.setReportData({
      campaign: { id: 'camp-glowlow-q4', name: 'GlowLab Q4' } as unknown as ReportCampaign,
      creators: [],
    });
    store.addComponent('work-screenshot');
    const id = store.currentComponents()[0].id;
    store.select(id);
    // 先清空，验证导入确实写入 9 张
    store.updateComponentData(id, { images: [] });
    store.commit();

    render(
      <MemoryRouter>
        <PropertyPanel />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /导入「GlowLab Q4」/ }));

    await waitFor(() => {
      const data = useEditorStore.getState().currentComponents()[0].data as WorkScreenshotData;
      expect(data.images).toHaveLength(9);
      expect(data.images[0].src).toContain('picsum.photos');
    });
  });
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `pnpm --filter @mediakit/web exec vitest run tests/property-works.test.tsx`
Expected: FAIL — no button matching `导入「GlowLab Q4」` (importer not implemented yet).

- [ ] **Step 3: Add the importer to `PropertyPanel.tsx`.**

Add imports near the existing `@/` imports (after line 30, `import { ImageInput } from '@/components/ImageInput';`):

```tsx
import { listCampaigns } from '@/api/campaigns';
import { listCreatorPerformance } from '@/api/creatorPerformance';
```

Add `Campaign` and `WorkScreenshotItem` to the `import type { ... } from '@mediakit/shared';` block (line 2–22). (`Campaign` is the campaign-list item type; `WorkScreenshotItem` is `{ src: string; caption?: string }`.)

Add the importer component just above `WorkScreenshotFields` (before line 1555):

```tsx
/** work-screenshot：从已绑 Campaign（或全部 mock campaign）导入达人作品截图。 */
function ReportWorkScreenshotImporter({ comp }: { comp: EditorComponent }) {
  const campaign = useEditorStore((s) => s.reportData.campaign);
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(false);

  // 未绑定 Campaign 时，拉取全部 mock campaign 供下拉兜底。
  useEffect(() => {
    if (campaign) return;
    let alive = true;
    listCampaigns()
      .then((list) => alive && setCampaigns(list))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [campaign]);

  async function importFrom(campaignId: string) {
    if (!campaignId || loading) return;
    setLoading(true);
    const perfs = await listCreatorPerformance(campaignId);
    const images: WorkScreenshotItem[] = [];
    for (const p of perfs) {
      for (const post of p.posts) {
        images.push({ src: post.cover ?? '', caption: `${p.creatorName} · ${post.title}` });
      }
    }
    if (images.length) {
      updateComponentData(comp.id, { images });
      commit();
    }
    setLoading(false);
  }

  return (
    <FieldGroup title="从达人数据导入">
      {campaign ? (
        <button
          onClick={() => importFrom(campaign.id)}
          disabled={loading}
          className="w-full rounded border border-accent-primary bg-accent-primary px-2 py-1 text-xs text-white hover:opacity-90 disabled:opacity-60"
        >
          {loading ? '导入中…' : `⚡ 导入「${campaign.name}」作品`}
        </button>
      ) : (
        <div className="space-y-1">
          <div className="text-[11px] text-foreground-muted">未绑定 Campaign，可选一个导入：</div>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-xs"
          >
            <option value="">选择 Campaign…</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {selected && (
            <button
              onClick={() => importFrom(selected)}
              disabled={loading}
              className="w-full rounded border border-accent-primary bg-accent-primary px-2 py-1 text-xs text-white hover:opacity-90 disabled:opacity-60"
            >
              {loading ? '导入中…' : '⚡ 导入'}
            </button>
          )}
        </div>
      )}
    </FieldGroup>
  );
}
```

Then render it at the top of `WorkScreenshotFields`'s return — change the existing return (line 1570 `return (`) to wrap in a fragment:

```tsx
  return (
    <>
      <ReportWorkScreenshotImporter comp={comp} />
      <FieldGroup title="作品截图">
        {/* …existing image list editor unchanged… */}
      </FieldGroup>
    </>
  );
```

(Only the outer `return (` line and its closing `)` change — the `<FieldGroup title="作品截图">…</FieldGroup>` body stays exactly as-is.)

- [ ] **Step 4: Run test to verify it passes.**

Run: `pnpm --filter @mediakit/web exec vitest run tests/property-works.test.tsx`
Expected: PASS (the importer resolves `listCreatorPerformance` after its 250ms mock delay; `waitFor` covers it).

- [ ] **Step 5: Commit.**

```bash
git add apps/web/src/editor/PropertyPanel.tsx apps/web/tests/property-works.test.tsx && git commit -m "feat(web): work-screenshot 新增从达人数据导入作品截图"
```

---

## Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole web test suite + typecheck + build.**

Run:
```bash
pnpm --filter @mediakit/web test && pnpm --filter @mediakit/web typecheck && pnpm --filter @mediakit/web build
```
Expected: all tests PASS, typecheck clean, build succeeds.

- [ ] **Step 2: Manual sanity (optional, if a dev server is available).**

Run `pnpm --filter @mediakit/web dev`, open the editor, drag a 作品截图 component onto the canvas → it should appear pre-filled with 9 creator-work screenshots in a 3×3 mosaic, with a title "达人作品截图". Select it → property panel shows the image editor + a "从达人数据导入" group. Changing the variant chip reshapes the mosaic. (If `reportData.campaign` is unset, the importer shows the campaign dropdown fallback.)

- [ ] **Step 3: If anything remains uncommitted, commit.**

```bash
git status
```
If clean, done. The feature is complete on the worktree branch; merge per the user's normal flow.

---

## Self-Review (run after writing — already done)

1. **Spec coverage:** D1→Task 3 Step 1; D2→Task 2; D3→Task 1; D4→Task 3 Step 4; D5→Task 3 Step 6; D6→Task 3 Step 5; D7→Task 4; D8→Tasks 2/3/4 tests. All spec sections covered. No new ComponentType / server change (correctly omitted).
2. **Placeholder scan:** No TBD/TODO. All code shown in full. Test commands exact.
3. **Type consistency:** `campaignWorkScreenshots` returns `WorkScreenshotItem[]` (Task 2) — consumed identically in defaults (Task 3.6) and importer (Task 4.3). `buildGridStyle`/`cellStyle` signatures match between Task 1 (definition) and Task 3.4 (use). Variant ids `auto/duo/…/duoza` identical in registry (3.5) and works.test (3.2). Button label `导入「{name}」作品` matches the test regex `/导入「GlowLab Q4」/`.
