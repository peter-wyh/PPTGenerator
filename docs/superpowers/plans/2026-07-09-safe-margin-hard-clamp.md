# 安全区硬约束（禁止越界）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `safeMargin > 0` 时，所有几何变更（拖拽/缩放/方向键/属性面板/新增/复制粘贴/对齐分布）把组件硬夹紧在安全区内，不准越界；夹紧独立于 `showSafeArea`。

**Architecture:** 在 `snap.ts` 加两个纯函数 `clampRect`（无出血夹紧，塞不下则收缩）/ `clampResize`（方向感知、保留对边）；在 `store.ts` 加 `clampSafeFrom`（只看 `margin>0`，不看 `showSafeArea`），在 8 类几何变更点套用；`Canvas.tsx` 拖拽分支与 `PropertyPanel.tsx` 失焦处各接一处。`updateComponent` 保持裸合并。

**Tech Stack:** React + Zustand + TypeScript + Vitest（jsdom）。纯前端运行时行为，**不新增持久化字段、不动 server Zod**。

**Spec:** `docs/superpowers/specs/2026-07-09-safe-margin-hard-clamp-design.md`

**执行前：** 按用户惯例先用 `superpowers:using-git-worktrees` 开隔离 worktree（主工作区有未提交的 `demo.html`），所有任务在 worktree 内进行。提交一律用 `git add <具体文件> && git commit` 单条原子命令（IDE 会跨调用清暂存区）。

**测试命令（从仓库根）：**
- 单文件：`pnpm -C apps/web test -- tests/snap.test.ts`
- 全量：`pnpm -C apps/web test`
- 类型：`pnpm -C apps/web typecheck`

---

### Task 1: `clampRect` + `clampResize` 纯函数（TDD）

**Files:**
- Modify: `apps/web/tests/snap.test.ts`（追加测试）
- Modify: `apps/web/src/editor/snap.ts`（追加两个导出函数）

- [ ] **Step 1: 写失败测试** — 在 `apps/web/tests/snap.test.ts` 末尾追加：

```ts
import { clampRect, clampResize } from '@/editor/snap';

describe('clampRect', () => {
  const safe = { left: 48, top: 48, right: 1232, bottom: 672 }; // safeWidth=1184, safeHeight=624
  it('returns rect unchanged when safe is null', () => {
    expect(clampRect({ x: -50, y: -50, w: 10, h: 10 }, null)).toEqual({ x: -50, y: -50, w: 10, h: 10 });
  });
  it('leaves a fully-inside rect unchanged', () => {
    expect(clampRect({ x: 100, y: 100, w: 200, h: 80 }, safe)).toEqual({ x: 100, y: 100, w: 200, h: 80 });
  });
  it('clamps x/y to safe origin when left/top outside', () => {
    const r = clampRect({ x: 10, y: 10, w: 200, h: 80 }, safe);
    expect(r).toEqual({ x: 48, y: 48, w: 200, h: 80 });
  });
  it('clamps so right/bottom edges do not exceed safe far edge', () => {
    const r = clampRect({ x: 1200, y: 700, w: 200, h: 80 }, safe);
    expect(r.x).toBe(1032); // 1232-200
    expect(r.y + r.h).toBe(672);
  });
  it('shrinks an oversized rect to fit and anchors at top-left', () => {
    const r = clampRect({ x: 0, y: 0, w: 2000, h: 1000 }, safe);
    expect(r).toEqual({ x: 48, y: 48, w: 1184, h: 624 });
  });
  it('never shrinks below MIN_W/MIN_H even in a tiny safe area', () => {
    const tiny = { left: 0, top: 0, right: 30, bottom: 20 };
    const r = clampRect({ x: 0, y: 0, w: 100, h: 100 }, tiny);
    expect(r.w).toBe(40); // MIN_W
    expect(r.h).toBe(20); // MIN_H
  });
});

describe('clampResize', () => {
  const safe = { left: 48, top: 48, right: 1232, bottom: 672 };
  it('returns rect unchanged when safe is null', () => {
    expect(clampResize({ x: 10, y: 10, w: 200, h: 80 }, 'se', null)).toEqual({ x: 10, y: 10, w: 200, h: 80 });
  });
  it('clamps moving east edge to safe right, x unchanged', () => {
    const r = clampResize({ x: 1100, y: 100, w: 200, h: 80 }, 'e', safe); // x+w=1300>1232
    expect(r).toEqual({ x: 1100, y: 100, w: 132, h: 80 }); // 1232-1100
  });
  it('clamps moving west edge to safe left, preserving right edge', () => {
    const r = clampResize({ x: 10, y: 100, w: 200, h: 80 }, 'w', safe); // right=210
    expect(r.x).toBe(48);
    expect(r.w).toBe(162); // 210-48
    expect(r.x + r.w).toBe(210); // 对边不动
  });
  it('clamps moving south edge to safe bottom, y unchanged', () => {
    const r = clampResize({ x: 100, y: 650, w: 200, h: 80 }, 's', safe); // y+h=730>672
    expect(r).toEqual({ x: 100, y: 650, w: 200, h: 22 }); // 672-650
  });
  it('clamps moving north edge to safe top, preserving bottom edge', () => {
    const r = clampResize({ x: 100, y: 10, w: 200, h: 80 }, 'n', safe); // bottom=90
    expect(r.y).toBe(48);
    expect(r.h).toBe(42); // 90-48
    expect(r.y + r.h).toBe(90);
  });
  it('does NOT clamp the non-moving edge', () => {
    // east handle：左边 x=10<48 不在动 → 不夹左边
    const r = clampResize({ x: 10, y: 100, w: 200, h: 80 }, 'e', safe); // x+w=210<1232 也不夹右边
    expect(r.x).toBe(10);
  });
  it('respects MIN_W when clamping east into a tiny safe area', () => {
    const tiny = { left: 0, top: 0, right: 10, bottom: 100 };
    const r = clampResize({ x: 0, y: 0, w: 200, h: 80 }, 'e', tiny); // w=max(40,10-0)=40
    expect(r.w).toBe(40);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm -C apps/web test -- tests/snap.test.ts`
Expected: FAIL — `clampRect is not a function`（未导出）。

- [ ] **Step 3: 实现两个纯函数** — 在 `apps/web/src/editor/snap.ts` 末尾（`snapResize` 之后）追加：

```ts
/**
 * 硬夹紧：把矩形完全关进安全区，塞不下则收缩 w/h（保 MIN_W/MIN_H）。
 * 与 snapMove/snapResize 的「磁吸（可出血）」互补——这是兜底硬墙。
 * 用于 move/nudge/add/duplicate/paste/align/distribute/属性面板失焦。
 * safe=null（margin=0 或安全区≥画布）时原样返回。
 */
export function clampRect(
  rect: { x: number; y: number; w: number; h: number },
  safe: SafeRect | null,
): { x: number; y: number; w: number; h: number } {
  if (!safe) return rect;
  const w = Math.max(MIN_W, Math.min(rect.w, safe.right - safe.left));
  const h = Math.max(MIN_H, Math.min(rect.h, safe.bottom - safe.top));
  const x = Math.max(safe.left, Math.min(rect.x, safe.right - w));
  const y = Math.max(safe.top, Math.min(rect.y, safe.bottom - h));
  return { x, y, w, h };
}

/**
 * 缩放硬夹紧：按 dir 把「动边」限制在安全区内，对边不动。
 * w/e 触界时分别钉 left=right-w 或 right=left+w；n/s 同理。MIN_W/MIN_H 优先。
 * dir 结构同 snapResize（含 'n','e','s','w' 子串）。safe=null 原样返回。
 */
export function clampResize(
  rect: { x: number; y: number; w: number; h: number },
  dir: string,
  safe: SafeRect | null,
): { x: number; y: number; w: number; h: number } {
  if (!safe) return rect;
  let { x, y, w, h } = rect;
  if (dir.includes('w') && x < safe.left) { w = Math.max(MIN_W, x + w - safe.left); x = safe.left; }
  else if (dir.includes('e') && x + w > safe.right) { w = Math.max(MIN_W, safe.right - x); }
  if (dir.includes('n') && y < safe.top) { h = Math.max(MIN_H, y + h - safe.top); y = safe.top; }
  else if (dir.includes('s') && y + h > safe.bottom) { h = Math.max(MIN_H, safe.bottom - y); }
  return { x, y, w, h };
}
```

> `MIN_W`/`MIN_H` 已在文件顶部 import（`snap.ts:5`）；`SafeRect` 已定义（`snap.ts:10-15`）。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm -C apps/web test -- tests/snap.test.ts`
Expected: PASS（含原有 safeRectFrom/snapMove/snapResize 用例 + 新增 clampRect/clampResize）。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/snap.ts apps/web/tests/snap.test.ts && git commit -m "feat(web): 安全区硬夹紧纯函数 clampRect/clampResize"
```

---

### Task 2: `clampSafeFrom` + 接入 `move` / `resize` / `nudge`（TDD）

**Files:**
- Modify: `apps/web/src/editor/store.ts`（加 `clampSafeFrom`；改 `move` 543-556 / `resize` 558-582 / `nudge` 608-615）
- Modify: `apps/web/tests/editor.store.test.ts`（追加 describe 块）

- [ ] **Step 1: 写失败测试** — 在 `apps/web/tests/editor.store.test.ts` 末尾追加：

```ts
describe('editor store — safe-area hard clamp (move/resize/nudge)', () => {
  function loadWithSafe(components: ReturnType<typeof comp>[], showSafeArea = true) {
    useEditorStore.getState().loadProject(
      makeDetail({
        meta: { theme: { layout: { safeMargin: 48, gridSize: 10, showGrid: true, showSafeArea } } },
        pages: [{ id: 'p1', name: 'p', components }],
      }),
      'p',
    );
  }
  // safeRectFrom(48,1280,720) = {left:48,top:48,right:1232,bottom:672}

  it('move clamps a component dragged past the safe edge', () => {
    loadWithSafe([comp('c1', 100, 100)]);
    useEditorStore.getState().move(['c1'], -200, -200); // → -100,-100 → clamp 48,48
    const c = currentComps()[0];
    expect(c.x).toBe(48);
    expect(c.y).toBe(48);
  });

  it('move still clamps when showSafeArea is false (decoupled from guide)', () => {
    loadWithSafe([comp('c1', 100, 100)], false);
    useEditorStore.getState().move(['c1'], -200, -200);
    const c = currentComps()[0];
    expect(c.x).toBe(48);
    expect(c.y).toBe(48);
  });

  it('move shrinks an oversized component to fit on first touch', () => {
    loadWithSafe([comp('c1', 0, 0, 2000, 1000)]);
    useEditorStore.getState().move(['c1'], 5, 5);
    const c = currentComps()[0];
    expect(c.w).toBe(1184);
    expect(c.h).toBe(624);
    expect(c.x).toBe(48);
    expect(c.y).toBe(48);
  });

  it('resize clamps the east edge to the safe right line', () => {
    loadWithSafe([comp('c1', 1100, 100, 100, 80)]);
    useEditorStore.getState().resize('c1', 'e', 500, 0, { x: 1100, y: 100, w: 100, h: 80 });
    const c = currentComps()[0];
    expect(c.x).toBe(1100);
    expect(c.w).toBe(132); // 1232-1100（clamp 在 grid snap 之后，不重新对齐）
    expect(c.x + c.w).toBe(1232);
  });

  it('resize clamps west edge, preserving the right edge', () => {
    loadWithSafe([comp('c1', 100, 100)]); // w=200, right=300
    useEditorStore.getState().resize('c1', 'w', -200, 0, { x: 100, y: 100, w: 200, h: 80 });
    const c = currentComps()[0];
    expect(c.x).toBe(48);
    expect(c.x + c.w).toBe(300); // 对边不动
  });

  it('nudge clamps into safe area', () => {
    loadWithSafe([comp('c1', 50, 50)]);
    useEditorStore.getState().nudge(-100, -100); // → -50,-50 → clamp 48,48
    const c = currentComps()[0];
    expect(c.x).toBe(48);
    expect(c.y).toBe(48);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm -C apps/web test -- tests/editor.store.test.ts`
Expected: FAIL — move/resize/nudge 仍允许越界（断言 48 不成立）。

- [ ] **Step 3: 加 `clampSafeFrom` 并接入 move/resize/nudge**

3a. 在 `apps/web/src/editor/store.ts` 的 `snapCtx`（214-226）之后追加：

```ts
/** 夹紧用的安全区：只看 safeMargin>0，不看 showSafeArea（隐藏参考线仍夹紧）。与 snapCtx 的磁吸 safe 解耦。 */
function clampSafeFrom(meta: ProjectMeta | null, cw: number, ch: number): SafeRect | null {
  const margin = meta?.theme?.layout?.safeMargin ?? DEFAULT_THEME.layout!.safeMargin;
  return safeRectFrom(margin, cw, ch);
}
```

> 确认文件顶部已 import `safeRectFrom` 与 `SafeRect`（现有 `snapCtx` 已用 `safeRectFrom`，类型 `ReturnType<typeof safeRectFrom>`；`SafeRect` 需补 import——见 3b）。

3b. 更新 `apps/web/src/editor/store.ts` 顶部 snap 的 import，加入 `clampRect`、`clampResize`、`SafeRect`：

```ts
import { snapMove, snapResize, clampRect, clampResize, safeRectFrom, type SafeRect } from './snap';
```

> 核对现有 import 行实际写法（可能已 import `safeRectFrom`/`snapMove`/`snapResize`），在其基础上补 `clampRect`、`clampResize`、`SafeRect`，勿重复。

3c. 改 `move`（store.ts:543-556）为：

```ts
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
```

3d. 改 `resize`（store.ts:558-582）的收尾——把现有的 `const snapped = snapResize({ x, y, w, h }, dir, grid, safe); return { ...c, ...snapped };` 改为追加 `clampResize`：

```ts
        const { grid, safe: snapSafe } = snapCtx(s.projectMeta, s.canvasWidth, s.canvasHeight);
        const clampSafe = clampSafeFrom(s.projectMeta, s.canvasWidth, s.canvasHeight);
        return {
          dirty: true,
          pages: withCurrentComponents(s.pages, s.currentPageId, (cs) =>
            cs.map((c) => {
              if (c.id !== id) return c;
              let { x, y, w, h } = start;
              if (dir.includes('e')) w = Math.max(MIN_W, start.w + dx);
              if (dir.includes('w')) { w = Math.max(MIN_W, start.w - dx); x = start.x + start.w - w; }
              if (dir.includes('s')) h = Math.max(MIN_H, start.h + dy);
              if (dir.includes('n')) { h = Math.max(MIN_H, start.h - dy); y = start.y + start.h - h; }
              const snapped = snapResize({ x, y, w, h }, dir, grid, snapSafe);
              const cl = clampResize(snapped, dir, clampSafe);
              return { ...c, ...cl };
            }),
          ),
        };
```

> 即：把 `resize` 内现有的 `const { grid, safe } = snapCtx(...)` 行替换为上面两行（`snapSafe` + `clampSafe`），并把末尾 `snapped` 那两行替换为 `snapped` + `cl` 两行。其余 resize 数学不动。

3e. 改 `nudge`（store.ts:608-615）为：

```ts
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
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm -C apps/web test -- tests/editor.store.test.ts`
Expected: PASS（新 clamp 块 + 原有 lifecycle/move/resize/nudge/clipboard 等全过——原用例组件都在安全区内，clamp 不改值）。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/store.ts apps/web/tests/editor.store.test.ts && git commit -m "feat(web): move/resize/nudge 接入安全区硬夹紧（与参考线解耦）"
```

---

### Task 3: 接入 `duplicateSelected` / `paste` / 6 个 `add*`

**Files:**
- Modify: `apps/web/src/editor/store.ts`（`addComponent` 398 / `addBusinessBlock` 417 / `addComponentAt` 444 / `addBusinessBlockAt` 456 / `addShape` 484 / `addShapeAt` 503 / `duplicateSelected` 596 / `paste` 635）
- Modify: `apps/web/tests/editor.store.test.ts`（追加用例）

- [ ] **Step 1: 写失败测试** — 在 Task 2 的 `safe-area hard clamp` describe 块里（或新块）追加：

```ts
  it('addComponentAt clamps the drop point into safe area', () => {
    loadWithSafe([]);
    useEditorStore.getState().addComponentAt('text', 1270, 710); // 落在右下角外
    const c = currentComps()[0];
    expect(c.x).toBeGreaterThanOrEqual(48);
    expect(c.y).toBeGreaterThanOrEqual(48);
    expect(c.x + c.w).toBeLessThanOrEqual(1232);
    expect(c.y + c.h).toBeLessThanOrEqual(672);
  });

  it('duplicateSelected clamps the +20 offset clone into safe area', () => {
    loadWithSafe([comp('c1', 1220, 660)]); // 本身越界（懒加载不动），副本要夹
    useEditorStore.getState().select('c1');
    useEditorStore.getState().duplicateSelected();
    const dupe = currentComps()[1];
    expect(dupe.x + dupe.w).toBeLessThanOrEqual(1232);
    expect(dupe.y + dupe.h).toBeLessThanOrEqual(672);
  });

  it('paste clamps pasted components into safe area', () => {
    loadWithSafe([comp('c1', 1220, 660)]);
    useEditorStore.getState().select('c1');
    useEditorStore.getState().copy();
    useEditorStore.getState().paste();
    const pasted = currentComps()[1];
    expect(pasted.x + pasted.w).toBeLessThanOrEqual(1232);
    expect(pasted.y + pasted.h).toBeLessThanOrEqual(672);
  });
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm -C apps/web test -- tests/editor.store.test.ts`
Expected: FAIL（add/duplicate/paste 仍允许越界）。

- [ ] **Step 3: 接入夹紧**

3a. `duplicateSelected`（store.ts:596-606）——把 `dupes` 的 map 改为夹紧：

```ts
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
```

3b. `paste`（store.ts:635-645）——同理：

```ts
    paste: () => {
      const clip = get().clipboard;
      if (!clip || clip.length === 0) return;
      mutateAndCommit((s) => {
        const clampSafe = clampSafeFrom(s.projectMeta, s.canvasWidth, s.canvasHeight);
        const pasted = clip.map((c) => {
          const cl = clampRect({ x: c.x + 20, y: c.y + 20, w: c.w, h: c.h }, clampSafe);
          return { ...clone(c), id: newId(), x: cl.x, y: cl.y, w: cl.w, h: cl.h };
        });
        return {
          pages: withCurrentComponents(s.pages, s.currentPageId, (cs) => [...cs, ...pasted]),
          selectedIds: pasted.map((c) => c.id),
        };
      });
    },
```

3c. 6 个 `add*`——每个在 `const comp: EditorComponent = {...}` 构造后、`return` 前，插入夹紧并覆盖 comp 的 x/y/w/h。统一模式（以 `addComponent` 为例，store.ts:398-415）：

```ts
    addComponent: (type) =>
      mutateAndCommit((s) => {
        const size = DEFAULT_SIZES[type] ?? { w: 300, h: 200 };
        const { x, y } = centered(size.w, size.h, s.canvasWidth, s.canvasHeight);
        const cl = clampRect({ x, y, w: size.w, h: size.h }, clampSafeFrom(s.projectMeta, s.canvasWidth, s.canvasHeight));
        const comp: EditorComponent = {
          id: newId(),
          type,
          x: cl.x,
          y: cl.y,
          w: cl.w,
          h: cl.h,
          data: getDefaultData(type),
        };
        return {
          pages: withCurrentComponents(s.pages, s.currentPageId, (cs) => [...cs, comp]),
          selectedIds: [comp.id],
        };
      }),
```

对其余 5 个（`addBusinessBlock` 417 / `addComponentAt` 444 / `addBusinessBlockAt` 456 / `addShape` 484 / `addShapeAt` 503）做**同构改动**：在 `centered(...)`/`placed(...)` 得到 `{x,y}` 后、构造 `comp` 前，加一行

```ts
        const cl = clampRect({ x, y, w: <该函数用的 w>, h: <该函数用的 h> }, clampSafeFrom(s.projectMeta, s.canvasWidth, s.canvasHeight));
```

然后把 `comp` 里的 `x, y` 改为 `x: cl.x, y: cl.y, w: cl.w, h: cl.h`。各函数的 w/h 来源对照：
- `addBusinessBlock` / `addBusinessBlockAt`：`layout.w` / `layout.h`
- `addComponentAt`：`size.w` / `size.h`
- `addShape` / `addShapeAt`：`size.w` / `size.h`（`size` 已按 line 形状算好）

> 注意：`addComponentAt`/`addBusinessBlockAt`/`addShapeAt` 已有 `const grid = ...` 行，保留；在其后加 `cl`。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm -C apps/web test -- tests/editor.store.test.ts`
Expected: PASS（含原 `addComponent centers` 用例——bar-chart 500×300 居中 390,210 在安全区内，clamp 不改值）。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/store.ts apps/web/tests/editor.store.test.ts && git commit -m "feat(web): add*/duplicate/paste 接入安全区硬夹紧"
```

---

### Task 4: 接入 `alignInPlace` / `distribute` / `equalize`

**Files:**
- Modify: `apps/web/src/editor/store.ts`（`alignInPlace` 844-862 / `distribute` 865-888 / `equalize` 891-896）
- Modify: `apps/web/tests/editor.align.test.ts`（追加用例）

- [ ] **Step 1: 写失败测试** — 在 `apps/web/tests/editor.align.test.ts` 末尾追加：

```ts
describe('align / distribute / equalize — safe-area clamp', () => {
  const safeMeta = { theme: { layout: { safeMargin: 48, gridSize: 10, showGrid: true, showSafeArea: true } } };
  // safe = {48,48,1232,672}
  function loadAtSafe(components: ReturnType<typeof comp>[]) {
    useEditorStore.getState().loadProject(
      { ...detail, meta: safeMeta, pages: [{ id: 'pg', name: 'pg', components }] },
      'p',
    );
  }

  it('align right clamps a component whose right edge would exceed safe area', () => {
    // c 越界（右 1500>1232，懒加载保留）；a 在内。align right 把 a 的右边对到 bbox max=1500 → 夹回 1232
    loadAtSafe([comp('a', 100, 100, 100, 50), comp('c', 1400, 100, 100, 50)]);
    useEditorStore.getState().alignComponents(['a', 'c'], 'right');
    const a = get('a');
    expect(a.x + a.w).toBeLessThanOrEqual(1232);
  });

  it('equalWidth clamps components back inside safe area', () => {
    loadAtSafe([comp('a', 100, 100, 100, 50), comp('c', 1400, 100, 100, 50)]);
    useEditorStore.getState().equalWidth(['a', 'c']);
    for (const id of ['a', 'c']) expect(get(id).x + get(id).w).toBeLessThanOrEqual(1232);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm -C apps/web test -- tests/editor.align.test.ts`
Expected: FAIL（align/equalize 后右边 >1232）。

- [ ] **Step 3: 接入夹紧** — `alignInPlace` / `distribute` / `equalize` 是模块级函数（store.ts:844-896），签名为 `(comps, ids, ...) => EditorComponent[]`，不持有 store。把它们改为额外接收 `safe`，在返回前对每个被改组件 `clampRect`。

3a. 改签名 + 夹紧。以 `alignInPlace` 为例：

```ts
function alignInPlace(
  comps: EditorComponent[],
  ids: string[],
  alignment: Alignment,
  safe: SafeRect | null,
): EditorComponent[] {
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
    const cl = clampRect({ x: Math.round(x), y: Math.round(y), w: c.w, h: c.h }, safe);
    return { ...c, x: cl.x, y: cl.y, w: cl.w, h: cl.h };
  });
}
```

`distribute`（865-888）与 `equalize`（891-896）同理：加 `safe: SafeRect | null` 末参；在最终 `return comps.map(...)` 里，对被改组件的 `{...c, x}` / `{...c, y}` / `{...c, [dim]}` 套 `clampRect({x,y,w,h}, safe)` 后再返回。`distribute` 只改单轴（x 或 y），`clampRect` 对另一轴及 w/h 在常规尺寸下不动。

3b. 更新 3 个调用点（store.ts:677-700）传入 `safe`：

```ts
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
```

> `Alignment` 类型已在文件内 import（现有 `alignInPlace` 已用）；`SafeRect` 在 Task 2 Step 3b 已 import。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm -C apps/web test -- tests/editor.align.test.ts`
Expected: PASS（新 clamp 用例 + 原 align/distribute/equalize 用例——原用例组件在画布左上角内、安全区也覆盖，clamp 不改值；若原 `align right` 用例的 maxRight=460 仍在 1232 内，不受影响）。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/store.ts apps/web/tests/editor.align.test.ts && git commit -m "feat(web): align/distribute/equalize 接入安全区硬夹紧"
```

---

### Task 5: `sanitizeComponent` action + PropertyPanel 失焦夹紧

**Files:**
- Modify: `apps/web/src/editor/store.ts`（`EditorState` 接口 ~114 加声明；实现 ~530 `updateComponent` 后加 `sanitizeComponent`）
- Modify: `apps/web/src/editor/PropertyPanel.tsx`（NumberField onBlur 725）
- Modify: `apps/web/tests/editor.store.test.ts`（追加用例）

- [ ] **Step 1: 写失败测试** — 在 `editor.store.test.ts` 的 safe-area 块追加：

```ts
  it('sanitizeComponent clamps current geometry into safe area (no history push)', () => {
    loadWithSafe([comp('c1', 100, 100)]);
    const before = useEditorStore.getState().historyIndex;
    useEditorStore.getState().updateComponent('c1', { x: 5, y: 5 }); // 裸写越界
    useEditorStore.getState().sanitizeComponent('c1');
    const c = currentComps()[0];
    expect(c.x).toBe(48);
    expect(c.y).toBe(48);
    expect(useEditorStore.getState().historyIndex).toBe(before); // 不入 history，由调用方 commit
  });
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm -C apps/web test -- tests/editor.store.test.ts`
Expected: FAIL — `sanitizeComponent is not a function`。

- [ ] **Step 3: 实现 `sanitizeComponent`**

3a. `EditorState` 接口（store.ts:114 `updateComponent` 声明处）后加一行：

```ts
  sanitizeComponent: (id: string) => void;
```

3b. 实现体（store.ts:530 `updateComponent` 实现后）加：

```ts
    /** 把组件当前几何夹进安全区（不入 history；PropertyPanel 失焦时调用，紧接 commit()）。 */
    sanitizeComponent: (id) =>
      set((s) => {
        const safe = clampSafeFrom(s.projectMeta, s.canvasWidth, s.canvasHeight);
        return {
          dirty: true,
          pages: withCurrentComponents(s.pages, s.currentPageId, (cs) =>
            cs.map((c) => {
              if (c.id !== id) return c;
              const cl = clampRect({ x: c.x, y: c.y, w: c.w, h: c.h }, safe);
              return { ...c, x: cl.x, y: cl.y, w: cl.w, h: cl.h };
            }),
          ),
        };
      }),
```

3c. PropertyPanel NumberField 失焦夹紧（`apps/web/src/editor/PropertyPanel.tsx`）——在 `NumberField`（705-729）里取 `sanitizeComponent`，`onBlur` 对几何字段调用：

```tsx
function NumberField({ comp, field }: { comp: EditorComponent; field: PropertyField }) {
  const updateComponent = useEditorStore((s) => s.updateComponent);
  const sanitizeComponent = useEditorStore((s) => s.sanitizeComponent);
  const commit = useEditorStore((s) => s.commit);
  const value = readValue(comp, field) as number;
  const [v, setV] = useState(String(value ?? 0));

  useEffect(() => setV(String(value ?? 0)), [value]);

  return (
    <label className="flex items-center gap-1 text-xs text-foreground-secondary">
      <span className="w-4">{field.label}</span>
      <input
        type="number"
        value={v}
        onChange={(e) => {
          setV(e.target.value);
          if (field.inData === false) {
            updateComponent(comp.id, { [field.key]: Number(e.target.value) } as Partial<EditorComponent>);
          }
        }}
        onBlur={() => {
          if (field.inData === false) sanitizeComponent(comp.id); // 几何字段失焦夹紧
          commit();
        }}
        className="w-full rounded border border-border-default px-1.5 py-1 text-foreground-primary"
      />
    </label>
  );
}
```

> 仅 `field.inData === false`（即 x/y/w/h 几何字段，见 `registry.tsx` `GEOMETRY`）触发；字号等 `inData` 字段不受影响。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm -C apps/web test -- tests/editor.store.test.ts && pnpm -C apps/web typecheck`
Expected: PASS + 类型无误。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/store.ts apps/web/src/editor/PropertyPanel.tsx apps/web/tests/editor.store.test.ts && git commit -m "feat(web): 属性面板失焦夹紧 + sanitizeComponent action"
```

---

### Task 6: Canvas 拖拽分支夹紧

**Files:**
- Modify: `apps/web/src/editor/Canvas.tsx`（move 分支 63-76；import 10）

> Canvas 拖拽走 `onMove` → 直接 `updateComponent`（不经 `store.move`），需在此对称夹紧。DOM/事件逻辑难单测，靠 typecheck + 手动回归（Task 7）。

- [ ] **Step 1: 改 import** — `apps/web/src/editor/Canvas.tsx:10` 现有

```ts
import { snapMove, safeRectFrom } from './snap';
```

改为：

```ts
import { snapMove, clampRect, safeRectFrom } from './snap';
```

- [ ] **Step 2: 改 move 分支** — `Canvas.tsx:63-76` 现有 `if (drag.kind === 'move') { ... }` 块改为：

```ts
      if (drag.kind === 'move') {
        const dx = (e.clientX - drag.mouseX) / st.zoom;
        const dy = (e.clientY - drag.mouseY) / st.zoom;
        const layout = st.projectMeta?.theme?.layout;
        const grid = layout?.gridSize ?? DEFAULT_GRID_SIZE;
        const safe =
          layout && layout.showSafeArea !== false
            ? safeRectFrom(layout.safeMargin ?? DEFAULT_THEME.layout!.safeMargin, st.canvasWidth, st.canvasHeight)
            : null;
        const clampSafe = safeRectFrom(
          layout?.safeMargin ?? DEFAULT_THEME.layout!.safeMargin,
          st.canvasWidth,
          st.canvasHeight,
        );
        for (const c of drag.comps) {
          if (c.locked) continue;
          const { x: sx, y: sy } = snapMove({ x: c.x + dx, y: c.y + dy, w: c.w, h: c.h }, grid, safe);
          const cl = clampRect({ x: sx, y: sy, w: c.w, h: c.h }, clampSafe);
          st.updateComponent(c.id, { x: cl.x, y: cl.y, w: cl.w, h: cl.h });
        }
      } else if (drag.kind === 'resize') {
```

> `safe`（磁吸）逻辑保留不变；新增 `clampSafe`（只看 margin）并在 `updateComponent` 回写完整 `{x,y,w,h}`。`DEFAULT_THEME` 已在文件顶部 import（`Canvas.tsx:8`）。

- [ ] **Step 3: typecheck**

Run: `pnpm -C apps/web typecheck`
Expected: 无错误。

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/editor/Canvas.tsx && git commit -m "feat(web): Canvas 拖拽分支接入安全区硬夹紧"
```

---

### Task 7: 全量验证 + 手动回归

**Files:** 无（验证）

- [ ] **Step 1: 全量类型检查**

Run: `pnpm -C apps/web typecheck`
Expected: 无错误。

- [ ] **Step 2: 全量测试**

Run: `pnpm -C apps/web test`
Expected: 全 PASS（snap / editor.store / editor.align 及其余既有用例）。

- [ ] **Step 3: 手动回归（`pnpm -C apps/web dev` 开编辑器）**

逐项核对 spec §6 行为变化表：
1. 设 safeMargin=48（全局样式设置 → 布局），拖组件越过安全边 → **被夹住、不能越界**。
2. 拖缩放柄拉过安全边 → 动边停在安全线，对边不动。
3. 选中组件按方向键移出安全区 → 被夹。
4. 属性面板 x/y/w/h 输入越界值、失焦 → 被夹回（输入过程不夹，能正常打多位数）。
5. 关闭「显示安全区」参考线、safeMargin 仍 >0 → **仍夹紧**（只不磁吸）。
6. 复制/粘贴越界组件 → 副本夹进安全区。
7. 从组件面板拖入新组件到画布右下角外 → 落点夹进安全区。
8. `safeMargin=0` → 不夹（自由摆放，行为同旧）。
9. 老项目打开（若有越界组件）→ 保持原位，首次拖拽/缩放被夹（超大组件收缩）。
10. 预览/导出（puppeteer 走 PageView）→ 无参考线/网格残留（夹紧只改数据，不动渲染层）。

- [ ] **Step 4: 收尾**

确认 worktree 内所有提交无误后，按 `superpowers:finishing-a-development-branch` 决定合并/PR。

---

## Self-Review

**1. Spec coverage：** spec §1 clampRect/clampResize → Task 1；§2 clampSafeFrom 解耦 → Task 2 Step 3a；§3 move/resize/nudge → Task 2，duplicate/paste/add* → Task 3，align/distribute/equalize → Task 4，updateComponent 不动（各调用方负责）→ 贯穿；§4 Canvas move 分支 → Task 6；§5 PropertyPanel onBlur → Task 5；§6 行为变化 → Task 7 回归。批量导入/loadProject 不夹（懒修正）→ 未接入，符合非目标。无遗漏。

**2. Placeholder scan：** 无 TBD/TODO；每个改动都给了完整代码。Task 3 Step 3c 对 5 个 add* 用「同构改动 + w/h 来源对照表」——因 5 个函数结构雷同，给出了精确的插入位置与各函数 w/h 变量名，非含糊指向。

**3. Type consistency：** `clampRect`/`clampResize`（Task 1 定义）签名 `{x,y,w,h}+safe(+dir)` → 全部调用点一致；`clampSafeFrom(meta,cw,ch)`（Task 2 定义）→ 所有调用点一致；`sanitizeComponent(id)`（Task 5 声明+实现）→ PropertyPanel 调用一致；`alignInPlace/distribute/equalize` 新增 `safe` 末参 → 调用点（Task 4 Step 3b）全部传入。`SafeRect` import 在 Task 2 Step 3b 补齐，后续 Task 不再重复 import。
