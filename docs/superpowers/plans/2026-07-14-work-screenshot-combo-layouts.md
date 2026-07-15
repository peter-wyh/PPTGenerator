# 作品截图「组合版式」选择器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `work-screenshot` 组件的 `mosaic` 视觉风格新增一个「组合版式」选择器，提供命名组合（1大2小 / 1大3小 / 1大4小 / 错落 / 九宫格），并按当前图片数智能过滤可选项。

**Architecture:** 新增一个可选持久化字段 `mosaicLayout`（仅在 `style==='mosaic'` 时生效，缺省 `'auto'`）。渲染器在 `mosaic` 分支按该字段分流：`auto` 沿用现有按张数模板（不变）；命名组合映射到 cell 模板（复用 `MosaicCell`/`MosaicTemplate`）；`staggered` 走独立偏移渲染。属性面板按 `MOSAIC_LAYOUT_OPTIONS`（单一事实源，渲染器与面板共用）渲染按钮组，并在有效张数不足时禁用。无服务端改动（组件数据以 `z.any()` 持久化）。

**Tech Stack:** React + TypeScript + Tailwind + Vitest + @testing-library/react。共享类型在 `packages/shared/src/types/editor.ts`。

**Context — 隔离执行：** 当前分支 `design/template-project-linking` 的 HEAD（提交 `2d3af39`）已包含本计划依赖的基线（6 种 style、`MOSAIC_TEMPLATES`、`WorkScreenshotFields` 选择器）。但 `WorksComponents.tsx` / `works.test.tsx` / `editor.ts` 上有**与本特性无关的未提交改动**（并发特性）。为避免把这些无关改动扫进本特性的提交，**必须在一个从当前 HEAD 新建的 worktree 中执行**（参见 `superpowers:using-git-worktrees`；worktree 不带这些未提交行，本特性也不依赖它们）。worktree 缺 `node_modules` —— 按记忆 `worktree-node-modules-symlink` 软链主仓库 `node_modules`。所有 `git add` 只 add 本特性改动的具体文件。

---

## File Structure

- **Modify** `packages/shared/src/types/editor.ts` — 新增 `WorkScreenshotMosaicLayout` 类型 + `WorkScreenshotData.mosaicLayout?` 字段（持久化 schema 的一部分）。
- **Modify** `apps/web/src/editor/components/WorksComponents.tsx` — 新增 `MOSAIC_LAYOUTS`（cell 模板）+ 导出 `MOSAIC_LAYOUT_OPTIONS`（按钮组元数据）；改造 `mosaic` 分支按 `mosaicLayout` 分流；新增 `staggered` 渲染。
- **Modify** `apps/web/src/editor/property-panel/custom-fields/WorkScreenshotFields.tsx` — 在 `style==='mosaic'` 时渲染「组合版式」按钮组，按张数禁用。
- **Modify** `apps/web/tests/works.test.tsx` — 渲染器测试（hero-4 / grid-3x3 / hero-5 截断 / staggered / auto 回归）。
- **Modify** `apps/web/tests/property-works.test.tsx` — 面板测试（写入 mosaicLayout / 张数不足禁用）。
- **不改动** `defaults.ts`（已大量改动且可选；渲染器 `data.mosaicLayout ?? 'auto'` 已兜底）。
- **不改动** 服务端（组件数据 `z.any()`）。

---

## Task 1: 共享类型 — 新增 `WorkScreenshotMosaicLayout`

**Files:**
- Modify: `packages/shared/src/types/editor.ts:713`（新增类型）与 `:726-736`（`WorkScreenshotData` 接口）

- [ ] **Step 1: 在 `WorkScreenshotStyle` 之后新增类型**

定位到 `editor.ts:713`：
```ts
export type WorkScreenshotStyle = 'grid' | 'skew' | 'overlap' | 'filmstrip' | 'diagonal' | 'mosaic';
```
在其**下方**插入：
```ts

/** 作品截图「组合版式」预设（仅 style==='mosaic' 时生效；缺省 'auto' = 按张数自动选模板）。 */
export type WorkScreenshotMosaicLayout =
  | 'auto' | 'hero-3' | 'hero-4' | 'hero-5' | 'staggered' | 'grid-3x3';
```

- [ ] **Step 2: 在 `WorkScreenshotData` 接口里新增字段**

定位到（约 `editor.ts:728-729`）：
```ts
  /** 视觉风格预设，与 variant 正交。 */
  style?: WorkScreenshotStyle;
```
在其**下方**插入：
```ts
  /** 组合版式预设（仅 style==='mosaic' 生效）；缺省 'auto' = 按张数自动选模板。 */
  mosaicLayout?: WorkScreenshotMosaicLayout;
```

- [ ] **Step 3: 类型检查通过**

Run: `pnpm --filter @mediakit/web run typecheck`
Expected: 无新增错误（PASS）。

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/editor.ts
git commit -m "feat(shared): add WorkScreenshotMosaicLayout type + mosaicLayout field"
```

---

## Task 2: 渲染器 — 命名组合模板 + mosaic 分流（hero-3/4/5、grid-3x3）

**Files:**
- Modify: `apps/web/src/editor/components/WorksComponents.tsx`（import + `MOSAIC_LAYOUTS`/`MOSAIC_LAYOUT_OPTIONS` + 改造 `mosaic` 分支）
- Test: `apps/web/tests/works.test.tsx`

- [ ] **Step 1: 写失败测试**

在 `works.test.tsx` 的 `describe('WorkScreenshot', ...)` 内（例如紧跟在 `:78` 的 `mosaic style: 4 images` 测试之后）插入：
```ts
  it('mosaicLayout hero-4 (1大3小): 4 imgs → 2 cols × 3 rows, big cell spans 3 rows', () => {
    const { container } = render(
      <WorkScreenshot
        data={{
          style: 'mosaic',
          mosaicLayout: 'hero-4',
          images: Array.from({ length: 4 }, (_, i) => ({ src: `${i}.jpg` })),
        }}
      />,
    );
    const grid = container.querySelector('[style*="grid-template-columns"]') as HTMLElement;
    expect(grid?.style.gridTemplateColumns).toBe('repeat(2, 1fr)');
    expect(grid?.style.gridTemplateRows).toBe('repeat(3, 1fr)');
    expect(screen.getAllByRole('img').length).toBe(4);
    // 大格 gridRow 跨 3 行
    expect(container.querySelector('[style*="span 3"]')).not.toBeNull();
  });

  it('mosaicLayout grid-3x3 (九宫格): 9 imgs → 3 cols × 3 rows', () => {
    const { container } = render(
      <WorkScreenshot
        data={{
          style: 'mosaic',
          mosaicLayout: 'grid-3x3',
          images: Array.from({ length: 9 }, (_, i) => ({ src: `${i}.jpg` })),
        }}
      />,
    );
    const grid = container.querySelector('[style*="grid-template-columns"]') as HTMLElement;
    expect(grid?.style.gridTemplateColumns).toBe('repeat(3, 1fr)');
    expect(grid?.style.gridTemplateRows).toBe('repeat(3, 1fr)');
    expect(screen.getAllByRole('img').length).toBe(9);
  });

  it('mosaicLayout hero-5 truncates extra images to its 5 cells', () => {
    render(
      <WorkScreenshot
        data={{
          style: 'mosaic',
          mosaicLayout: 'hero-5',
          images: Array.from({ length: 6 }, (_, i) => ({ src: `${i}.jpg` })),
        }}
      />,
    );
    // hero-5 只有 5 个 cell，第 6 张被忽略
    expect(screen.getAllByRole('img').length).toBe(5);
  });

  it('mosaicLayout auto (explicit) keeps count-based template for 4 imgs', () => {
    const { container } = render(
      <WorkScreenshot
        data={{
          style: 'mosaic',
          mosaicLayout: 'auto',
          images: Array.from({ length: 4 }, (_, i) => ({ src: `${i}.jpg` })),
        }}
      />,
    );
    const grid = container.querySelector('[style*="grid-template-columns"]') as HTMLElement;
    // auto 4 张 = MOSAIC_TEMPLATES[3]（3 cols × 2 rows 的 L 型），行为不变
    expect(grid?.style.gridTemplateRows).toBe('repeat(2, 1fr)');
    expect(screen.getAllByRole('img').length).toBe(4);
  });
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm --filter @mediakit/web exec vitest run tests/works.test.tsx`
Expected: 上面 4 个新测试 FAIL（`mosaicLayout` 传入但渲染器忽略，仍按张数出 L 型 / 不裁剪；hero-4 期望 `repeat(3,1fr)` 行但实际 `repeat(2,1fr)`）。

- [ ] **Step 3: 扩展 import**

`WorksComponents.tsx` 顶部的类型 import（约 `:6-11`）：
```ts
import type {
  CommentWordcloudData,
  Sentiment,
  WorkMetricsData,
  WorkScreenshotData,
} from '@mediakit/shared';
```
改为（增加 `WorkScreenshotMosaicLayout`）：
```ts
import type {
  CommentWordcloudData,
  Sentiment,
  WorkMetricsData,
  WorkScreenshotData,
  WorkScreenshotMosaicLayout,
} from '@mediakit/shared';
```

- [ ] **Step 4: 在 `MOSAIC_TEMPLATES` 之后新增 `MOSAIC_LAYOUTS` 与导出的 `MOSAIC_LAYOUT_OPTIONS`**

定位到 `MOSAIC_TEMPLATES` 数组结束的 `];`（约 `:189`），在其**下方**插入：
```ts

/** 命名组合版式：用户在属性面板显式挑选（仅 style==='mosaic' 生效）。
 *  auto / staggered 不走 cell 模板（auto 用 MOSAIC_TEMPLATES；staggered 走偏移渲染）。 */
const MOSAIC_LAYOUTS: Record<Exclude<WorkScreenshotMosaicLayout, 'auto' | 'staggered'>, MosaicTemplate> = {
  // 1大2小（3 张）：左大 1×2 + 右侧 2 张竖排
  'hero-3': { gridCols: 2, gridRows: 2, cells: [
    { col: 0, row: 0, colSpan: 1, rowSpan: 2 },
    { col: 1, row: 0, colSpan: 1, rowSpan: 1 },
    { col: 1, row: 1, colSpan: 1, rowSpan: 1 },
  ]},
  // 1大3小（4 张）：左大 1×3 + 右侧 3 张竖排
  'hero-4': { gridCols: 2, gridRows: 3, cells: [
    { col: 0, row: 0, colSpan: 1, rowSpan: 3 },
    { col: 1, row: 0, colSpan: 1, rowSpan: 1 },
    { col: 1, row: 1, colSpan: 1, rowSpan: 1 },
    { col: 1, row: 2, colSpan: 1, rowSpan: 1 },
  ]},
  // 1大4小（5 张）：左大 2×2（半宽全高）+ 右侧 2×2 小图
  'hero-5': { gridCols: 4, gridRows: 2, cells: [
    { col: 0, row: 0, colSpan: 2, rowSpan: 2 },
    { col: 2, row: 0, colSpan: 1, rowSpan: 1 },
    { col: 3, row: 0, colSpan: 1, rowSpan: 1 },
    { col: 2, row: 1, colSpan: 1, rowSpan: 1 },
    { col: 3, row: 1, colSpan: 1, rowSpan: 1 },
  ]},
  // 九宫格（9 张）：均匀 3×3
  'grid-3x3': { gridCols: 3, gridRows: 3, cells: Array.from({ length: 9 }, (_, i) => ({
    col: i % 3, row: Math.floor(i / 3), colSpan: 1, rowSpan: 1,
  })) },
};

/** 组合版式可选项：属性面板按钮组与渲染分流共用（单一事实源）。minImages 用于按张数禁用。 */
export const MOSAIC_LAYOUT_OPTIONS: { value: WorkScreenshotMosaicLayout; label: string; minImages: number }[] = [
  { value: 'auto', label: '自动', minImages: 1 },
  { value: 'hero-3', label: '1大2小', minImages: 3 },
  { value: 'hero-4', label: '1大3小', minImages: 4 },
  { value: 'hero-5', label: '1大4小', minImages: 5 },
  { value: 'staggered', label: '错落', minImages: 4 },
  { value: 'grid-3x3', label: '九宫格', minImages: 9 },
];
```

- [ ] **Step 5: 改造 `mosaic` 分支，按 `mosaicLayout` 分流**

定位到整个 `mosaic` 分支（注释 `/* ---- mosaic: ...` 起，到该分支 `return (...)` 的 `}` 止；约 `:327-359`）。将其**整体替换**为：
```tsx
  /* ---- mosaic: 非对称拼图（命名组合 / auto 按张数 / staggered 错落）---- */
  if (style === 'mosaic') {
    const layout = data.mosaicLayout ?? 'auto';

    // staggered（错落）：3 列，按列交替竖向偏移、不旋转；取前 6 张。
    if (layout === 'staggered') {
      const shown = images.slice(0, 6);
      const COL_OFFSET = ['0%', '10%', '5%'];
      return (
        <Shell title={title}>
          <div
            className="grid h-full w-full content-stretch gap-2 overflow-hidden"
            style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}
          >
            {shown.map((im, i) => (
              <div
                key={i}
                className="relative h-full overflow-hidden rounded-lg"
                style={{ transform: `translateY(${COL_OFFSET[i % 3]})` }}
              >
                <Screenshot src={im?.src ?? ''} caption={im?.caption} captionHidden={im?.captionHidden} />
              </div>
            ))}
          </div>
        </Shell>
      );
    }

    // 命名组合（非 auto）：取对应模板，按 cells 渲染前 N 张（多出忽略，绝不留空位）。
    if (layout !== 'auto') {
      const tpl = MOSAIC_LAYOUTS[layout];
      const shown = images.slice(0, tpl.cells.length);
      return (
        <Shell title={title}>
          <div
            className="grid h-full w-full overflow-hidden"
            style={{
              gridTemplateColumns: `repeat(${tpl.gridCols}, 1fr)`,
              gridTemplateRows: `repeat(${tpl.gridRows}, 1fr)`,
              gap: '4px',
            }}
          >
            {tpl.cells.map((cell, i) => {
              const im = shown[i];
              if (!im) return null;
              return (
                <div
                  key={i}
                  className="relative overflow-hidden rounded-lg"
                  style={{
                    gridColumn: `${cell.col + 1} / span ${cell.colSpan}`,
                    gridRow: `${cell.row + 1} / span ${cell.rowSpan}`,
                  }}
                >
                  <Screenshot src={im.src} caption={im.caption} captionHidden={im.captionHidden} />
                </div>
              );
            })}
          </div>
        </Shell>
      );
    }

    // auto：模板按张数 1 基存储（MOSAIC_TEMPLATES[i] 容纳 i+1 张图，N 张取下标 N-1）。
    const idx = Math.min(Math.max(images.length - 1, 0), MOSAIC_TEMPLATES.length - 1);
    const tpl = MOSAIC_TEMPLATES[idx];
    const { gridCols, gridRows, cells } = tpl;
    return (
      <Shell title={title}>
        <div
          className="grid h-full w-full overflow-hidden"
          style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gridTemplateRows: `repeat(${gridRows}, 1fr)`, gap: '4px' }}
        >
          {cells.map((cell, i) => {
            const im = images[i];
            if (!im) return null;
            return (
              <div
                key={i}
                className="relative overflow-hidden rounded-lg"
                style={{
                  gridColumn: `${cell.col + 1} / span ${cell.colSpan}`,
                  gridRow: `${cell.row + 1} / span ${cell.rowSpan}`,
                }}
              >
                <Screenshot src={im.src} caption={im.caption} captionHidden={im.captionHidden} />
              </div>
            );
          })}
        </div>
      </Shell>
    );
  }
```

- [ ] **Step 6: 运行测试，确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run tests/works.test.tsx`
Expected: 全部 PASS（含 4 个新测试与既有回归测试）。

- [ ] **Step 7: 类型检查**

Run: `pnpm --filter @mediakit/web run typecheck`
Expected: PASS。

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/editor/components/WorksComponents.tsx apps/web/tests/works.test.tsx
git commit -m "feat(work-screenshot): named mosaic layouts (1大3小 / 1大4小 / 九宫格)"
```

---

## Task 3: 渲染器 — staggered（错落）验证

`staggered` 渲染已在 Task 2 Step 5 一并加入。本任务补一个冒烟测试锁定行为。

**Files:**
- Test: `apps/web/tests/works.test.tsx`

- [ ] **Step 1: 写失败→通过的测试**

在 `works.test.tsx` 的 `describe('WorkScreenshot', ...)` 内追加（若 Step 2 先跑应为 FAIL，因当时还没跑；此处与 Task 2 同批实现，直接验证）：
```ts
  it('mosaicLayout staggered (错落): 5 imgs → 3 cols, per-column vertical offset, 5 rendered', () => {
    const { container } = render(
      <WorkScreenshot
        data={{
          style: 'mosaic',
          mosaicLayout: 'staggered',
          images: Array.from({ length: 5 }, (_, i) => ({ src: `${i}.jpg` })),
        }}
      />,
    );
    const grid = container.querySelector('[style*="grid-template-columns"]') as HTMLElement;
    expect(grid?.style.gridTemplateColumns).toBe('repeat(3, 1fr)');
    expect(screen.getAllByRole('img').length).toBe(5);
    // staggered 独有：列偏移 translateY
    expect(container.querySelector('[style*="translateY"]')).not.toBeNull();
  });
```

- [ ] **Step 2: 运行测试，确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run tests/works.test.tsx`
Expected: PASS（staggered 渲染已在 Task 2 落地）。

- [ ] **Step 3: Commit**

```bash
git add apps/web/tests/works.test.tsx
git commit -m "test(work-screenshot): lock staggered (错落) mosaic layout"
```

---

## Task 4: 属性面板 — 「组合版式」按钮组（按张数禁用）

**Files:**
- Modify: `apps/web/src/editor/property-panel/custom-fields/WorkScreenshotFields.tsx`
- Test: `apps/web/tests/property-works.test.tsx`

- [ ] **Step 1: 写失败测试**

在 `property-works.test.tsx` 的 `describe('WorkScreenshotFields', ...)` 内（如 `:58` 之后）追加两个测试：
```ts
  it('mosaic 组合版式 picker writes mosaicLayout on click', () => {
    const store = useEditorStore.getState();
    store.loadProject(emptyProject, 'p');
    store.addComponent('work-screenshot');
    const id = store.currentComponents()[0].id;
    store.select(id);
    store.updateComponentData(id, { style: 'mosaic' });
    store.commit();

    render(
      <MemoryRouter>
        <PropertyPanel />
      </MemoryRouter>,
    );

    const btn = screen.getByRole('button', { name: '1大3小' });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);

    const data = useEditorStore.getState().currentComponents()[0].data as WorkScreenshotData;
    expect(data.mosaicLayout).toBe('hero-4');
  });

  it('mosaic 组合版式 disables layouts when too few images', () => {
    const store = useEditorStore.getState();
    store.loadProject(emptyProject, 'p');
    store.addComponent('work-screenshot');
    const id = store.currentComponents()[0].id;
    store.select(id);
    store.updateComponentData(id, { style: 'mosaic', images: [{ src: 'a' }, { src: 'b' }] });
    store.commit();

    render(
      <MemoryRouter>
        <PropertyPanel />
      </MemoryRouter>,
    );

    // 仅 2 张：1大3小(需4)、九宫格(需9) 应禁用；自动(需1) 可用
    expect(screen.getByRole('button', { name: '1大3小' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '九宫格' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '自动' })).not.toBeDisabled();
  });
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm --filter @mediakit/web exec vitest run tests/property-works.test.tsx`
Expected: 两个新测试 FAIL（「组合版式」按钮组尚不存在 → `getByRole('button', { name: '1大3小' })` 抛 Unable to find）。

- [ ] **Step 3: 扩展 import**

`WorkScreenshotFields.tsx` 顶部（约 `:1-9`），在现有 import 之后新增一行：
```ts
import { MOSAIC_LAYOUT_OPTIONS } from '@/editor/components/WorksComponents';
```
（放在 `import { ReportWorkScreenshotImporter } from '../importers';` 之后即可。）

- [ ] **Step 4: 新增「组合版式」FieldGroup（仅 mosaic 时显示）**

在 `WorkScreenshotFields.tsx` 的「视觉样式」`FieldGroup`（约 `:48-67`）之后、「显示数量」`FieldGroup`（约 `:70`）之前，插入：
```tsx
      {/* 组合版式（仅 mosaic 风格） */}
      {style === 'mosaic' && (
        <FieldGroup title="组合版式">
          <div className="flex flex-wrap gap-1.5">
            {MOSAIC_LAYOUT_OPTIONS.map((opt) => {
              const enabled = displayCount >= opt.minImages;
              const active = mosaicLayout === opt.value || (!mosaicLayout && opt.value === 'auto');
              return (
                <button
                  key={opt.value}
                  disabled={!enabled}
                  onClick={() => write({ mosaicLayout: opt.value === 'auto' ? undefined : opt.value })}
                  title={!enabled ? `需 ${opt.minImages} 张` : undefined}
                  className={`rounded border px-2.5 py-1 text-xs transition ${
                    active
                      ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                      : 'border-border-default text-foreground-secondary hover:border-foreground-muted'
                  } ${!enabled ? 'cursor-not-allowed opacity-40' : ''}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-[10px] text-foreground-muted">
            {!mosaicLayout || mosaicLayout === 'auto'
              ? '按张数自动选择版式'
              : `${MOSAIC_LAYOUT_OPTIONS.find((o) => o.value === mosaicLayout)?.label} · 当前显示 ${displayCount} 张`}
          </p>
        </FieldGroup>
      )}
```

并在组件函数体顶部（约 `:28` `const style = data.style ?? 'grid';` 附近）新增一行读取字段：
```ts
  const mosaicLayout = data.mosaicLayout;
```

- [ ] **Step 5: 运行测试，确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run tests/property-works.test.tsx`
Expected: 全部 PASS（含两个新测试与既有 3 个测试）。

- [ ] **Step 6: 类型检查**

Run: `pnpm --filter @mediakit/web run typecheck`
Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/editor/property-panel/custom-fields/WorkScreenshotFields.tsx apps/web/tests/property-works.test.tsx
git commit -m "feat(work-screenshot): mosaic 组合版式 picker with count-aware disabling"
```

---

## Task 5: 全量验证

**Files:** 无（只跑检查）

- [ ] **Step 1: web 全量测试**

Run: `pnpm --filter @mediakit/web test`
Expected: 全部 PASS（含 works / property-works / 其它既有套件）。注意记忆 `web-chart-test-convention`：recharts 在 jsdom 被 mock，只断言外壳文本——本计划的测试均符合（只断言 grid 样式、img 数量、按钮态）。

- [ ] **Step 2: web 类型检查**

Run: `pnpm --filter @mediakit/web run typecheck`
Expected: PASS。

- [ ] **Step 3: 仓库全量测试（可选，确认无跨包回归）**

Run: `pnpm test`
Expected: 全部 PASS。

---

## Self-Review

- **Spec coverage:** 组合集（auto/hero-3/hero-4/hero-5/staggered/grid-3x3）→ Task 2+3 ✓；count-aware 过滤 → Task 4 ✓；数据模型 `mosaicLayout` → Task 1 ✓；仅 mosaic 生效 → Task 2/4 ✓；多出图片忽略不渲染空位 → Task 2 hero-5 截断测试 ✓；向后兼容（auto 回归）→ Task 2 ✓；无服务端改动 → 明确跳过 ✓。
- **Placeholder scan:** 无 TBD/TODO；每个代码步骤均含完整代码与确切文件:行。
- **Type consistency:** `WorkScreenshotMosaicLayout`（Task 1 定义）在 Task 2 import、`MOSAIC_LAYOUT_OPTIONS` 导出值类型一致；`MOSAIC_LAYOUTS` 的键 `Exclude<…,'auto'|'staggered'>` 与分流逻辑（staggered/auto 单独处理、其余查表）一致；`mosaicLayout` 字段名在渲染器、面板、测试中一致。
- **风险点：** worktree 从 HEAD 新建会缺少 `WorksComponents.tsx`/`works.test.tsx`/`editor.ts` 的未提交行——本计划不依赖这些行（依赖的基线 6-style/MOSAIC_TEMPLATES 已在 HEAD）。Edit 锚点（`WorkScreenshotStyle` 行、`MOSAIC_TEMPLATES` 的 `];`、`mosaic` 分支整块、`STYLE_OPTIONS` 后的 FieldGroup）在 HEAD 版本中均存在。
