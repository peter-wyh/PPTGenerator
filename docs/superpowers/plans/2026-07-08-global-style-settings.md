# 全局样式设置：布局尺寸（安全距离 + 网格）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给编辑器加"布局尺寸"全局设置——安全距离（参考线 + 磁吸，可出血）与网格大小（单一值统一驱动可见网格、移动/拖拽/键盘/缩放吸附），并入 `ProjectTheme` 由 4 套预设覆盖，并修掉现有"可见网格 20px ≠ 吸附 10px"等散落不一致。

**Architecture:** 沿用现有 `ProjectTheme` → `themeToCssVars`(CSS 变量) + `ThemeContext` 双通道。新增 `ProjectTheme.layout` 子对象（safeMargin/gridSize/showGrid/showSafeArea），由 `normalizeTheme` 兜底、4 套 `STYLE_PRESETS` 各自带值、`ReportSettingsOverlay` 暴露编辑。吸附逻辑抽到纯函数模块 `apps/web/src/editor/snap.ts`（`snapMove`/`snapResize`/`safeRectFrom`），被 `store.move/resize` 与 `Canvas` 拖拽复用（DRY + 可单测）。导出路径（Puppeteer → `SharePage`/`PageView`）天然不渲染 `Canvas` overlay，无需改导出。

**Tech Stack:** React 18 + Zustand + Vite + Vitest（web）、Zod（server 校验）、TypeScript 5 共享类型（`@mediakit/shared`）。

**Spec:** `docs/superpowers/specs/2026-07-08-global-style-settings-design.md`

---

## File Structure

**新建：**
- `apps/web/src/editor/snap.ts` — 吸附纯函数 + 阈值常量 + `SafeRect` 类型。`safeRectFrom` / `snapMove` / `snapResize`。无 React、无 store 依赖（仅从 `defaults.ts` 取 `MIN_W/MIN_H`），可单测。
- `apps/web/tests/theme-layout.test.ts` — `normalizeTheme` 对 `layout` 的兜底/部分覆盖、`DEFAULT_THEME.layout`、4 套 `STYLE_PRESETS` 各含 `layout`。
- `apps/web/tests/snap.test.ts` — `snapMove`/`snapResize`/`safeRectFrom` 行为。
- `apps/server/src/modules/projects/projects.schema.test.ts` — `projectThemeSchema` 接受含 `layout` 主题、拒绝越界值。

**修改：**
- `packages/shared/src/index.ts` — `ProjectTheme.layout` 类型、`DEFAULT_THEME.layout`、`normalizeTheme` 解析 `layout`、4 套 `STYLE_PRESETS` 补 `layout`。
- `apps/server/src/modules/projects/projects.schema.ts` — `projectThemeSchema` 增 `layout` Zod。
- `apps/web/src/editor/defaults.ts` — `MOVE_SNAP` → `DEFAULT_GRID_SIZE`。
- `apps/web/src/editor/store.ts` — `ThemePatch.layout`、`setTheme` 合并 `layout`、`placed()` 取 grid、`move()`/`resize()` 走 snap 纯函数。
- `apps/web/src/editor/Canvas.tsx` — 删本地 `SNAP`，拖拽走 `snapMove`，网格 overlay 用 `gridSize`+`showGrid`，新增安全区虚线 overlay。
- `apps/web/src/editor/useEditorKeyboard.ts` — `Shift+方向键` 步长 = `gridSize`。
- `apps/web/src/editor/theme.tsx` — `themeToCssVars` 增 `--grid-size` / `--safe-margin`。
- `apps/web/src/editor/components/ReportSettingsOverlay.tsx` — 新增「布局」分区、`applyPreset` 带 `layout`、头部改名。
- `apps/web/src/editor/EditorTopbar.tsx` — 按钮文案/标题改名。

---

## Task 1: shared 数据模型 — `ProjectTheme.layout` + 默认值 + `normalizeTheme` + 预设

**Files:**
- Modify: `packages/shared/src/index.ts`（`ProjectTheme` 约第 192 行、`DEFAULT_THEME` 第 274 行、`STYLE_PRESETS` 第 293 行、`normalizeTheme` 第 394 行）
- Test: `apps/web/tests/theme-layout.test.ts`（Create）

- [ ] **Step 1: 写失败测试 `apps/web/tests/theme-layout.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_THEME,
  STYLE_PRESETS,
  normalizeTheme,
} from '@mediakit/shared';

describe('ProjectTheme.layout defaults', () => {
  it('DEFAULT_THEME.layout has expected defaults', () => {
    expect(DEFAULT_THEME.layout).toBeDefined();
    expect(DEFAULT_THEME.layout!.safeMargin).toBe(48);
    expect(DEFAULT_THEME.layout!.gridSize).toBe(10);
    expect(DEFAULT_THEME.layout!.showGrid).toBe(true);
    expect(DEFAULT_THEME.layout!.showSafeArea).toBe(true);
  });

  it('every STYLE_PRESETS entry carries a layout block', () => {
    for (const p of STYLE_PRESETS) {
      expect(p.theme.layout).toBeDefined();
      expect(p.theme.layout!.safeMargin).toBeGreaterThan(0);
      expect(p.theme.layout!.gridSize).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('normalizeTheme layout tolerance', () => {
  it('fills layout defaults when missing (new-shape theme without layout)', () => {
    const t = normalizeTheme({ color: { primary: '#FF5C00' }, font: { text: 'inter', number: 'inter' } });
    expect(t.layout).toBeDefined();
    expect(t.layout!.safeMargin).toBe(48);
    expect(t.layout!.gridSize).toBe(10);
  });

  it('fills layout defaults for legacy flat theme', () => {
    const t = normalizeTheme({ primary: '#FF5C00', secondary: '#FF8533', fontFamily: "'Inter', sans-serif" });
    expect(t.layout).toBeDefined();
    expect(t.layout!.gridSize).toBe(10);
  });

  it('keeps provided layout fields and fills the rest', () => {
    const t = normalizeTheme({ layout: { safeMargin: 100 } });
    expect(t.layout!.safeMargin).toBe(100);
    expect(t.layout!.gridSize).toBe(10);
    expect(t.layout!.showGrid).toBe(true);
  });

  it('replaces non-positive gridSize with default', () => {
    const t = normalizeTheme({ layout: { safeMargin: 40, gridSize: 0 } });
    expect(t.layout!.gridSize).toBe(10);
  });

  it('returns layout for empty input', () => {
    expect(normalizeTheme({}).layout).toBeDefined();
    expect(normalizeTheme(null).layout).toBeDefined();
  });
});
```

- [ ] **Step 2: 运行测试，确认失败（red）**

Run: `pnpm --filter @mediakit/web exec vitest run tests/theme-layout.test.ts`
Expected: FAIL — `DEFAULT_THEME.layout` 为 `undefined`，断言 `toBeDefined()` 不通过。

- [ ] **Step 3: 扩展 `ProjectTheme` 类型（约第 192 行，`radius` 之后、`preset` 之前加 `layout?`，并在 `radius` 这一行后面接 `layout` 字段）**

把 `ProjectTheme` 接口改为：

```ts
export interface ProjectTheme {
  color: {
    primary: string;
    secondary: string;
    chartPalette: string[];
    neutralText: string;
    neutralBg: string;
  };
  font: {
    text: string;
    number: string;
    heading?: string;
  };
  density: ThemeDensity;
  radius: ThemeRadius;
  /** 布局尺寸：安全距离 + 网格；并入主题，由 4 套预设覆盖。 */
  layout?: {
    safeMargin: number;     // 四面统一内缩 px；0=不画安全区
    gridSize: number;       // 网格大小 px；驱动可见网格 + 移动/拖拽/键盘/缩放吸附
    showGrid?: boolean;     // 显示可见网格叠加；缺省 true
    showSafeArea?: boolean; // 显示安全区虚线；缺省 true
  };
  preset?: string;
}
```

- [ ] **Step 4: 给 `DEFAULT_THEME` 加 `layout`（约第 274 行，在 `preset: 'business-sober',` 之前插入）**

```ts
export const DEFAULT_THEME: ProjectTheme = {
  color: {
    primary: '#FF5C00',
    secondary: '#FF8533',
    chartPalette: [...DEFAULT_CHART_PALETTE],
    neutralText: '#1A1A1A',
    neutralBg: '#FFFFFF',
  },
  font: {
    text: 'noto-sans-sc',
    number: 'inter',
    heading: undefined,
  },
  density: 'standard',
  radius: 'small',
  layout: { safeMargin: 48, gridSize: 10, showGrid: true, showSafeArea: true },
  preset: 'business-sober',
};
```

- [ ] **Step 5: 给 4 套 `STYLE_PRESETS` 各加 `layout`（约第 293–366 行，每套 `theme` 对象内、`preset:` 之前插入 `layout`）**

逐套加入对应 `layout` 值：

- `business-sober`：`layout: { safeMargin: 48, gridSize: 10, showGrid: true, showSafeArea: true },`
- `tech-minimal`：`layout: { safeMargin: 40, gridSize: 8, showGrid: true, showSafeArea: true },`
- `vibrant-trendy`：`layout: { safeMargin: 64, gridSize: 12, showGrid: true, showSafeArea: true },`
- `minimal-elegant`：`layout: { safeMargin: 56, gridSize: 10, showGrid: true, showSafeArea: true },`

- [ ] **Step 6: 扩展 `normalizeTheme` 解析 `layout`（约第 394–458 行）**

在 `normalizeTheme` 内、`return {` 之前插入 layout 解析（紧挨现有 `const radius = ...; const preset = ...;` 之后）：

```ts
  // ---- 布局 layout：缺对象整体补默认；部分缺字段按字段补；非法值回退 ----
  const layoutRaw = obj.layout as Record<string, unknown> | undefined;
  const dLayout = d.layout!;
  const parseGridNum = (v: unknown, def: number, min: number): number => {
    const n = Number(v);
    return Number.isFinite(n) && n >= min ? Math.round(n) : def;
  };
  const layout = {
    safeMargin: parseGridNum(layoutRaw?.safeMargin, dLayout.safeMargin, 0),
    gridSize: parseGridNum(layoutRaw?.gridSize, dLayout.gridSize, 1),
    showGrid: typeof layoutRaw?.showGrid === 'boolean' ? layoutRaw.showGrid : dLayout.showGrid,
    showSafeArea: typeof layoutRaw?.showSafeArea === 'boolean' ? layoutRaw.showSafeArea : dLayout.showSafeArea,
  };
```

并在 `return { ... }` 对象里、`preset,` 之后追加一行 `layout,`，使返回的 `ProjectTheme` 始终带 `layout`。

- [ ] **Step 7: 运行测试，确认通过（green）**

Run: `pnpm --filter @mediakit/web exec vitest run tests/theme-layout.test.ts`
Expected: PASS（全部用例）。

- [ ] **Step 8: 全量 typecheck**

Run: `pnpm typecheck`
Expected: 通过（shared 类型变更联动 store/overlay 等暂未消费 `layout`，不破坏现有类型）。

- [ ] **Step 9: 提交**

```bash
git add packages/shared/src/index.ts apps/web/tests/theme-layout.test.ts
git commit -m "$(cat <<'EOF'
feat(shared): ProjectTheme.layout（安全距离+网格）+ 预设覆盖 + normalizeTheme 兜底

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 吸附纯函数模块 `snap.ts`

**Files:**
- Create: `apps/web/src/editor/snap.ts`
- Test: `apps/web/tests/snap.test.ts`（Create）

- [ ] **Step 1: 写失败测试 `apps/web/tests/snap.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { safeRectFrom, snapMove, snapResize, SAFE_SNAP_THRESHOLD } from '@/editor/snap';

describe('safeRectFrom', () => {
  it('returns null for non-positive margin', () => {
    expect(safeRectFrom(0, 1280, 720)).toBeNull();
    expect(safeRectFrom(-5, 1280, 720)).toBeNull();
  });
  it('returns null when margin would invert the rect', () => {
    expect(safeRectFrom(400, 1280, 720)).toBeNull(); // 2*400 < min(1280,720)=720? 800>720 → null
  });
  it('builds a rect for a normal margin', () => {
    expect(safeRectFrom(48, 1280, 720)).toEqual({ left: 48, top: 48, right: 1232, bottom: 672 });
  });
});

describe('snapMove', () => {
  const safe = { left: 48, top: 48, right: 1232, bottom: 672 };
  it('aligns to grid', () => {
    const r = snapMove({ x: 53, y: 9, w: 100, h: 50 }, 10, null);
    expect(r).toEqual({ x: 50, y: 10 });
  });
  it('magnetically snaps left edge to safe line when within threshold', () => {
    const r = snapMove({ x: 52, y: 100, w: 100, h: 50 }, 10, safe); // 52→grid 50, |50-48|=2 ≤ 6 → 48
    expect(r.x).toBe(48);
  });
  it('magnetically snaps right edge to safe line', () => {
    // 右边 = x+100；想吸到 1232 → x=1132；给 x=1130（grid 对齐后 1130，|1230-1232|=2）
    const r = snapMove({ x: 1130, y: 100, w: 100, h: 50 }, 10, safe);
    expect(r.x).toBe(1132);
  });
  it('does NOT snap when far from safe line (bleed allowed)', () => {
    const r = snapMove({ x: 300, y: 300, w: 100, h: 50 }, 10, safe);
    expect(r).toEqual({ x: 300, y: 300 });
  });
  it('default threshold is SAFE_SNAP_THRESHOLD', () => {
    expect(SAFE_SNAP_THRESHOLD).toBe(6);
  });
});

describe('snapResize', () => {
  const safe = { left: 48, top: 48, right: 1232, bottom: 672 };
  it('aligns w/h and x/y to grid', () => {
    const r = snapResize({ x: 100, y: 100, w: 53, h: 47 }, 'se', 10, null);
    expect(r).toEqual({ x: 100, y: 100, w: 50, h: 50 });
  });
  it('snaps moving west edge to safe left line', () => {
    // west 边在动：x=50（|50-48|=2≤6）→ x=48，w 增 2
    const r = snapResize({ x: 50, y: 100, w: 200, h: 100 }, 'w', 10, safe);
    expect(r.x).toBe(48);
    expect(r.w).toBe(202);
  });
  it('snaps moving east edge to safe right line', () => {
    // east 边在动：x+w=1230（|1230-1232|=2）→ w=1232-1000=232
    const r = snapResize({ x: 1000, y: 100, w: 230, h: 100 }, 'e', 10, safe);
    expect(r.w).toBe(232);
  });
  it('respects MIN_W floor even when snapping', () => {
    const r = snapResize({ x: 48, y: 100, w: 30, h: 100 }, 'w', 10, null);
    expect(r.w).toBeGreaterThanOrEqual(40); // MIN_W
  });
});
```

> 注：`MIN_W=40`、`MIN_H=20` 来自 `defaults.ts`（snapResize 内部引用）。

- [ ] **Step 2: 运行测试，确认失败（red）**

Run: `pnpm --filter @mediakit/web exec vitest run tests/snap.test.ts`
Expected: FAIL — `@/editor/snap` 解析不到模块。

- [ ] **Step 3: 实现 `apps/web/src/editor/snap.ts`**

```ts
/**
 * 布局吸附纯函数：grid 对齐 + 安全区磁吸（仅靠近时吸，可出血）。
 * 被 store.move/resize 与 Canvas 拖拽复用，无 React/store 依赖，便于单测。
 */
import { MIN_W, MIN_H } from './defaults';

/** 安全区磁吸阈值（px）：组件边落在安全线 ±该值内时吸到安全线。 */
export const SAFE_SNAP_THRESHOLD = 6;

export interface SafeRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * 由 safeMargin + 画布尺寸构造安全区矩形。
 * - margin ≤ 0 → null（不画安全区、不吸附）；
 * - margin*2 ≥ 短边 → null（安全区大于等于画布，避免负宽高/无意义）。
 */
export function safeRectFrom(margin: number, cw: number, ch: number): SafeRect | null {
  if (!margin || margin <= 0) return null;
  if (margin * 2 >= Math.min(cw, ch)) return null;
  return { left: margin, top: margin, right: cw - margin, bottom: ch - margin };
}

/**
 * 移动落点吸附：先 grid 对齐，再把靠近安全区边线的边吸过去（可出血，仅靠近时吸）。
 * 入参 box.x/y 为「c.x + dx」之后、网格对齐之前的值；返回吸附后的 {x,y}（w/h 不变）。
 */
export function snapMove(
  box: { x: number; y: number; w: number; h: number },
  grid: number,
  safe: SafeRect | null,
  threshold: number = SAFE_SNAP_THRESHOLD,
): { x: number; y: number } {
  const g = grid > 0 ? grid : 1;
  let x = Math.round(box.x / g) * g;
  let y = Math.round(box.y / g) * g;
  if (safe) {
    if (Math.abs(x - safe.left) <= threshold) x = safe.left;
    else if (Math.abs(x + box.w - safe.right) <= threshold) x = safe.right - box.w;
    if (Math.abs(y - safe.top) <= threshold) y = safe.top;
    else if (Math.abs(y + box.h - safe.bottom) <= threshold) y = safe.bottom - box.h;
  }
  return { x, y };
}

/**
 * 缩放吸附：grid 对齐 x/y/w/h，再按 dir 把「动边」吸到安全线。
 * dir 为 'n'|'ne'|'e'|'se'|'s'|'sw'|'w'|'nw' 之一（字符串，避免与 store 的 ResizeDir 循环依赖）。
 */
export function snapResize(
  raw: { x: number; y: number; w: number; h: number },
  dir: string,
  grid: number,
  safe: SafeRect | null,
  threshold: number = SAFE_SNAP_THRESHOLD,
): { x: number; y: number; w: number; h: number } {
  const g = grid > 0 ? grid : 1;
  let x = Math.round(raw.x / g) * g;
  let y = Math.round(raw.y / g) * g;
  let w = Math.max(MIN_W, Math.round(raw.w / g) * g);
  let h = Math.max(MIN_H, Math.round(raw.h / g) * g);
  if (safe) {
    if (dir.includes('w') && Math.abs(x - safe.left) <= threshold) {
      const nx = safe.left;
      w = Math.max(MIN_W, w + (x - nx));
      x = nx;
    } else if (dir.includes('e') && Math.abs(x + w - safe.right) <= threshold) {
      w = Math.max(MIN_W, safe.right - x);
    }
    if (dir.includes('n') && Math.abs(y - safe.top) <= threshold) {
      const ny = safe.top;
      h = Math.max(MIN_H, h + (y - ny));
      y = ny;
    } else if (dir.includes('s') && Math.abs(y + h - safe.bottom) <= threshold) {
      h = Math.max(MIN_H, safe.bottom - y);
    }
  }
  return { x, y, w, h };
}
```

- [ ] **Step 4: 运行测试，确认通过（green）**

Run: `pnpm --filter @mediakit/web exec vitest run tests/snap.test.ts`
Expected: PASS（全部用例）。

- [ ] **Step 5: typecheck**

Run: `pnpm --filter @mediakit/web typecheck`
Expected: 通过。

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/editor/snap.ts apps/web/tests/snap.test.ts
git commit -m "$(cat <<'EOF'
feat(web): 布局吸附纯函数 snap.ts（grid+安全区磁吸）+ 单测

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: store 接线 — `ThemePatch.layout` + `move`/`resize`/`placed` 走 snap

**Files:**
- Modify: `apps/web/src/editor/defaults.ts:40`、`apps/web/src/editor/store.ts`（imports 第 14–23 行、`ThemePatch` 第 29 行、`placed` 第 191 行、`setTheme` 第 324 行、`addComponentAt/addBusinessBlockAt/addShapeAt` 第 408/419/465 行、`move` 第 504 行、`resize` 第 517 行）

- [ ] **Step 1: `defaults.ts` 把 `MOVE_SNAP` 改名为 `DEFAULT_GRID_SIZE`**

把：
```ts
/** 移动吸附步长（demo：10px 网格）。 */
export const MOVE_SNAP = 10;
```
改为：
```ts
/** 兜底网格大小（theme.layout.gridSize 不可得时回退，如未加载项目态）。 */
export const DEFAULT_GRID_SIZE = 10;
```

- [ ] **Step 2: `store.ts` 调整 imports（第 14–23 行）**

把 `import { DEFAULT_THEME, normalizeTheme } from '@mediakit/shared';`（第 14 行）保持不变；把 `defaults` 具名导入里的 `MOVE_SNAP,` 改为 `DEFAULT_GRID_SIZE,`；并在该 import 块之后新增一行：

```ts
import { snapMove, snapResize, safeRectFrom } from './snap';
```

- [ ] **Step 3: `store.ts` 扩展 `ThemePatch`（第 29 行）**

```ts
export type ThemePatch = {
  color?: Partial<ProjectTheme['color']>;
  font?: Partial<ProjectTheme['font']>;
  density?: ThemeDensity;
  radius?: ThemeRadius;
  layout?: Partial<NonNullable<ProjectTheme['layout']>>;
  preset?: string;
};
```

- [ ] **Step 4: `store.ts` 新增模块级 snap 上下文 helper（紧挨 `placed` 函数之后，约第 203 行后）**

```ts
/** 从当前 meta + 画布尺寸解析吸附上下文（grid + safe）。showSafeArea=false → 不吸附（参考线也隐藏）。 */
function snapCtx(
  meta: ProjectMeta | null,
  cw: number,
  ch: number,
): { grid: number; safe: ReturnType<typeof safeRectFrom> } {
  const layout = meta?.theme?.layout;
  const grid = layout?.gridSize ?? DEFAULT_GRID_SIZE;
  const safe =
    layout && layout.showSafeArea !== false
      ? safeRectFrom(layout.safeMargin ?? DEFAULT_THEME.layout!.safeMargin, cw, ch)
      : null;
  return { grid, safe };
}
```

- [ ] **Step 5: `store.ts` 改 `placed()` 取 grid（第 191–202 行）**

```ts
function placed(
  w: number,
  h: number,
  cx: number,
  cy: number,
  cw: number,
  ch: number,
  grid: number,
): { x: number; y: number } {
  const g = grid > 0 ? grid : DEFAULT_GRID_SIZE;
  const x = Math.round(Math.max(0, Math.min(cx - w / 2, cw - w)) / g) * g;
  const y = Math.round(Math.max(0, Math.min(cy - h / 2, ch - h)) / g) * g;
  return { x, y };
}
```

- [ ] **Step 6: `store.ts` 三处 `placed` 调用补 grid（第 411、423、468 行附近）**

在 `addComponentAt`、`addBusinessBlockAt`、`addShapeAt` 各自的 `mutateAndCommit((s) => {` 内、调用 `placed(...)` 之前加：
```ts
const grid = s.projectMeta?.theme?.layout?.gridSize ?? DEFAULT_GRID_SIZE;
```
并把 `placed(size.w, size.h, cx, cy, s.canvasWidth, s.canvasHeight)`（或 `layout.w/layout.h`）改为末尾追加 `, grid`。

例（`addComponentAt`）：
```ts
const grid = s.projectMeta?.theme?.layout?.gridSize ?? DEFAULT_GRID_SIZE;
const { x, y } = placed(size.w, size.h, cx, cy, s.canvasWidth, s.canvasHeight, grid);
```

- [ ] **Step 7: `store.ts` 改 `setTheme`（第 324–340 行）合并 `layout`**

```ts
    setTheme: (patch) =>
      set((s) => {
        const current = s.projectMeta?.theme ?? DEFAULT_THEME;
        const merged: ProjectTheme = {
          color: { ...current.color, ...patch.color },
          font: { ...current.font, ...patch.font },
          density: patch.density ?? current.density,
          radius: patch.radius ?? current.radius,
          layout: { ...(current.layout ?? DEFAULT_THEME.layout), ...patch.layout },
          preset: 'preset' in patch ? patch.preset : current.preset,
        };
        return {
          dirty: true,
          projectMeta: { ...(s.projectMeta ?? {}), theme: merged } as ProjectMeta,
        };
      }),
```

- [ ] **Step 8: `store.ts` 改 `move`（第 504–515 行）走 `snapMove`**

```ts
    move: (ids, dx, dy) =>
      set((s) => {
        const { grid, safe } = snapCtx(s.projectMeta, s.canvasWidth, s.canvasHeight);
        return {
          dirty: true,
          pages: withCurrentComponents(s.pages, s.currentPageId, (cs) =>
            cs.map((c) => {
              if (!ids.includes(c.id) || c.locked) return c;
              const { x, y } = snapMove({ x: c.x + dx, y: c.y + dy, w: c.w, h: c.h }, grid, safe);
              return { ...c, x, y };
            }),
          ),
        };
      }),
```

- [ ] **Step 9: `store.ts` 改 `resize`（第 517–537 行）走 `snapResize`**

```ts
    resize: (id, dir, dx, dy, start) =>
      set((s) => {
        const { grid, safe } = snapCtx(s.projectMeta, s.canvasWidth, s.canvasHeight);
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
              const snapped = snapResize({ x, y, w, h }, dir, grid, safe);
              return { ...c, ...snapped };
            }),
          ),
        };
      }),
```

- [ ] **Step 10: typecheck + 既有测试不回归**

Run: `pnpm --filter @mediakit/web typecheck && pnpm --filter @mediakit/web exec vitest run`
Expected: typecheck 通过；全部 web 测试 PASS（含 Task 1/2 新增与既有 `editor.m3.test.tsx`）。

- [ ] **Step 11: 提交**

```bash
git add apps/web/src/editor/defaults.ts apps/web/src/editor/store.ts
git commit -m "$(cat <<'EOF'
feat(web): store 接线 layout（move/resize 走 grid+安全区磁吸，placed 取 grid）

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Canvas — 拖拽走 `snapMove` + 网格 overlay 用 `gridSize` + 安全区虚线

**Files:**
- Modify: `apps/web/src/editor/Canvas.tsx`（imports 第 1–7 行、`SNAP` 第 15 行、`DragState` 第 9 行、拖拽 `onMove` move 分支第 46–55 行、selectors 第 21–30 行、网格 overlay 第 276–284 行）

> 此任务无纯逻辑可单测（Canvas 是 React+DOM），验证用 typecheck + 手动（见 Task 9 回归清单）。

- [ ] **Step 1: 调整 imports**

第 1–7 行 import 块顶部追加：
```ts
import { useMemo } from 'react';
```
把第 1 行 `import { useEffect, useRef, useState } from 'react';` 改为 `import { useEffect, useMemo, useRef, useState } from 'react';`。

在第 7 行（`import { resolvePageBackground } from './background';`）之后追加：
```ts
import { DEFAULT_THEME } from '@mediakit/shared';
import { DEFAULT_GRID_SIZE } from './defaults';
import { snapMove, safeRectFrom } from './snap';
```

- [ ] **Step 2: 删除本地 `const SNAP = 10;`（第 15 行）**

整行删除。

- [ ] **Step 3: `DragState` 的 `move` 分支 comps 加 `w/h`（第 9–10 行）**

把：
```ts
  | { kind: 'move'; mouseX: number; mouseY: number; comps: { id: string; x: number; y: number; locked?: boolean }[] }
```
改为：
```ts
  | {
      kind: 'move';
      mouseX: number;
      mouseY: number;
      comps: { id: string; x: number; y: number; w: number; h: number; locked?: boolean }[];
    }
```

- [ ] **Step 4: `handleComponentMouseDown` 的 comps map 加 `w/h`（第 148–152 行）**

把 `.map((c) => ({ id: c.id, x: c.x, y: c.y, locked: c.locked }));` 改为：
```ts
      .map((c) => ({ id: c.id, x: c.x, y: c.y, w: c.w, h: c.h, locked: c.locked }));
```

- [ ] **Step 5: 新增 layout selectors（第 30 行附近，与其它 `useEditorStore` selectors 并列）**

```ts
  const gridSize = useEditorStore((s) => s.projectMeta?.theme?.layout?.gridSize ?? DEFAULT_GRID_SIZE);
  const safeMargin = useEditorStore(
    (s) => s.projectMeta?.theme?.layout?.safeMargin ?? DEFAULT_THEME.layout!.safeMargin,
  );
  const showGrid = useEditorStore((s) => s.projectMeta?.theme?.layout?.showGrid ?? true);
  const showSafeArea = useEditorStore((s) => s.projectMeta?.theme?.layout?.showSafeArea ?? true);
  const safeRect = useMemo(
    () => safeRectFrom(safeMargin, canvasWidth, canvasHeight),
    [safeMargin, canvasWidth, canvasHeight],
  );
```

- [ ] **Step 6: `onMove` move 分支走 `snapMove`（第 46–55 行）**

把：
```ts
      if (drag.kind === 'move') {
        const dx = (e.clientX - drag.mouseX) / st.zoom;
        const dy = (e.clientY - drag.mouseY) / st.zoom;
        for (const c of drag.comps) {
          if (c.locked) continue;
          st.updateComponent(c.id, {
            x: Math.round((c.x + dx) / SNAP) * SNAP,
            y: Math.round((c.y + dy) / SNAP) * SNAP,
          });
        }
      }
```
改为：
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
        for (const c of drag.comps) {
          if (c.locked) continue;
          const { x, y } = snapMove({ x: c.x + dx, y: c.y + dy, w: c.w, h: c.h }, grid, safe);
          st.updateComponent(c.id, { x, y });
        }
      }
```

- [ ] **Step 7: 网格 overlay 用 `gridSize` + `showGrid` 开关（第 276–284 行）**

把：
```tsx
          {/* 20px 网格 */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.03) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />
```
改为：
```tsx
          {/* 网格叠加：大小 = theme.layout.gridSize */}
          {showGrid && (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  'linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.03) 1px, transparent 1px)',
                backgroundSize: `${gridSize}px ${gridSize}px`,
              }}
            />
          )}
```

- [ ] **Step 8: 新增安全区虚线 overlay（紧接网格 overlay 之后、`{components.map(...)}` 之前）**

```tsx
          {/* 安全区参考线（仅编辑画布；导出走 PageView，不渲染） */}
          {showSafeArea && safeRect && (
            <div
              className="pointer-events-none absolute"
              style={{
                left: safeRect.left,
                top: safeRect.top,
                width: safeRect.right - safeRect.left,
                height: safeRect.bottom - safeRect.top,
                border: '1px dashed rgba(0,0,0,0.25)',
              }}
            />
          )}
```

- [ ] **Step 9: typecheck + 既有测试**

Run: `pnpm --filter @mediakit/web typecheck && pnpm --filter @mediakit/web exec vitest run`
Expected: typecheck 通过；测试 PASS。

- [ ] **Step 10: 提交**

```bash
git add apps/web/src/editor/Canvas.tsx
git commit -m "$(cat <<'EOF'
feat(web): Canvas 网格用 gridSize + 安全区虚线 + 拖拽走 snapMove

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 键盘微调 `Shift+方向键` = `gridSize`

**Files:**
- Modify: `apps/web/src/editor/useEditorKeyboard.ts`（imports 第 2 行、第 91 行）

- [ ] **Step 1: 调整 imports（第 2 行后追加）**

```ts
import { DEFAULT_GRID_SIZE } from './defaults';
```

- [ ] **Step 2: 第 91 行的 `const d = e.shiftKey ? 10 : 1;` 改为读 `gridSize`**

```ts
        const layout = st.projectMeta?.theme?.layout;
        const d = e.shiftKey ? layout?.gridSize ?? DEFAULT_GRID_SIZE : 1;
```

> `st` 已在第 21 行取到（`const st = useEditorStore.getState();`）。

- [ ] **Step 3: typecheck**

Run: `pnpm --filter @mediakit/web typecheck`
Expected: 通过。

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/editor/useEditorKeyboard.ts
git commit -m "$(cat <<'EOF'
feat(web): Shift+方向键微调步长跟随 gridSize

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: theme CSS 变量 `--grid-size` / `--safe-margin`

**Files:**
- Modify: `apps/web/src/editor/theme.tsx:54-73`（`themeToCssVars` 的 `vars` 对象）

- [ ] **Step 1: 在 `vars` 对象里、`'--accent-secondary': t.color.secondary,` 之后追加两行**

```ts
    // 布局
    '--grid-size': `${t.layout?.gridSize ?? DEFAULT_THEME.layout!.gridSize}px`,
    '--safe-margin': `${t.layout?.safeMargin ?? DEFAULT_THEME.layout!.safeMargin}px`,
```

> `DEFAULT_THEME` 已在该文件 import（第 17 行区）。`t = theme ?? DEFAULT_THEME`，老 theme 无 `layout` 时回退默认。

- [ ] **Step 2: typecheck**

Run: `pnpm --filter @mediakit/web typecheck`
Expected: 通过。

- [ ] **Step 3: 提交**

```bash
git add apps/web/src/editor/theme.tsx
git commit -m "$(cat <<'EOF'
feat(web): themeToCssVars 暴露 --grid-size / --safe-margin

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: server Zod — `projectThemeSchema` 增 `layout`

**Files:**
- Modify: `apps/server/src/modules/projects/projects.schema.ts:34-56`
- Test: `apps/server/src/modules/projects/projects.schema.test.ts`（Create，与 `templates.service.test.ts` 同一 co-located 约定）

- [ ] **Step 1: 写失败测试 `apps/server/src/modules/projects/projects.schema.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { createProjectSchema } from './projects.schema';

/** 取 createProjectSchema 内嵌的 projectThemeSchema 解析结果（meta.theme）。 */
function parseTheme(theme: unknown) {
  return createProjectSchema.parse({
    name: 'p',
    width: 1280,
    height: 720,
    meta: { theme: theme as never },
  });
}

describe('projectThemeSchema.layout', () => {
  it('accepts a theme with a valid layout', () => {
    const r = parseTheme({ layout: { safeMargin: 48, gridSize: 10, showGrid: true, showSafeArea: true } });
    expect(r.meta?.theme?.layout).toEqual({ safeMargin: 48, gridSize: 10, showGrid: true, showSafeArea: true });
  });

  it('accepts a theme without layout (optional)', () => {
    const r = parseTheme({ color: { primary: '#FF5C00' } });
    expect(r.meta?.theme?.layout).toBeUndefined();
  });

  it('rejects gridSize out of range (0)', () => {
    expect(() => parseTheme({ layout: { safeMargin: 40, gridSize: 0 } })).toThrow();
  });

  it('rejects safeMargin out of range (negative)', () => {
    expect(() => parseTheme({ layout: { safeMargin: -5, gridSize: 10 } })).toThrow();
  });
});
```

- [ ] **Step 2: 运行测试，确认失败（red）**

Run: `pnpm --filter @mediakit/server exec vitest run src/modules/projects/projects.schema.test.ts`
Expected: FAIL — `layout` 字段被 Zod 剥掉（`r.meta?.theme?.layout` 为 `undefined`，第一个用例 `toEqual(...)` 不通过；越界用例不 throw）。

- [ ] **Step 3: `projects.schema.ts` 的 `projectThemeSchema` 增 `layout`（第 52–54 行 `preset` 之后、对象收尾之前）**

把：
```ts
    density: z.enum(['compact', 'standard', 'spacious']).optional(),
    radius: z.enum(['sharp', 'small', 'large']).optional(),
    preset: z.string().max(120).optional(),
  })
  .optional();
```
改为：
```ts
    density: z.enum(['compact', 'standard', 'spacious']).optional(),
    radius: z.enum(['sharp', 'small', 'large']).optional(),
    layout: z
      .object({
        safeMargin: z.number().min(0).max(500),
        gridSize: z.number().min(1).max(100),
        showGrid: z.boolean().optional(),
        showSafeArea: z.boolean().optional(),
      })
      .optional(),
    preset: z.string().max(120).optional(),
  })
  .optional();
```

- [ ] **Step 4: 运行测试，确认通过（green）**

Run: `pnpm --filter @mediakit/server exec vitest run src/modules/projects/projects.schema.test.ts`
Expected: PASS。

- [ ] **Step 5: server typecheck**

Run: `pnpm --filter @mediakit/server typecheck`
Expected: 通过。

- [ ] **Step 6: 提交**

```bash
git add apps/server/src/modules/projects/projects.schema.ts apps/server/src/modules/projects/projects.schema.test.ts
git commit -m "$(cat <<'EOF'
feat(server): projectThemeSchema 增 layout（safeMargin/gridSize）Zod 校验

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 设置 UI —「布局」分区 + 预设带 layout + 改名

**Files:**
- Modify: `apps/web/src/editor/components/ReportSettingsOverlay.tsx`（imports 第 2–9 行、`applyPreset` 第 40 行、头部第 103 行、在「⑤ 圆角」section 第 245 行之后插入新区、底部解析参考图之前）
- Modify: `apps/web/src/editor/EditorTopbar.tsx:89-95`

> 此任务为 UI，验证用 typecheck + 手动（见 Task 9）。

- [ ] **Step 1: `ReportSettingsOverlay.tsx` imports 增 `ProjectTheme` 类型（第 2–9 行已 import `type ProjectTheme`，确认存在；若无需补）**

确认第 4–9 行的 `import { ..., type ProjectTheme, ... } from '@mediakit/shared';` 含 `ProjectTheme`（当前已含）。无需改动。

- [ ] **Step 2: `applyPreset` 的 patch 增 `layout`（第 40–51 行）**

把 patch 改为：
```ts
    const patch: ThemePatch = {
      color: { ...preset.theme.color },
      font: { ...preset.theme.font },
      density: preset.theme.density,
      radius: preset.theme.radius,
      layout: { ...preset.theme.layout },
      preset: preset.key,
    };
```

- [ ] **Step 3: 新增 layout 编辑 handler（在 `updateRadius` 之后，约第 77 行后）**

```ts
  /** 手改布局字段：清空 preset 高亮。 */
  function updateLayout<K extends keyof NonNullable<ProjectTheme['layout']>>(
    field: K,
    value: NonNullable<ProjectTheme['layout']>[K],
  ) {
    setTheme({ layout: { [field]: value }, preset: undefined });
  }
```

- [ ] **Step 4: 取当前 layout（在 `const theme = ...` 之后，约第 36 行后）**

```ts
  const layout = theme.layout ?? DEFAULT_THEME.layout!;
```

> `DEFAULT_THEME` 已 import（第 3 行）。

- [ ] **Step 5: 头部改名（第 103 行）**

把：
```tsx
            <div className="font-headings text-lg font-semibold text-foreground-primary">报告设置</div>
            <p className="text-xs text-foreground-secondary">整体风格驱动整份报告的配色、字体与密度。</p>
```
改为：
```tsx
            <div className="font-headings text-lg font-semibold text-foreground-primary">全局样式设置</div>
            <p className="text-xs text-foreground-secondary">整体风格驱动整份报告的配色、字体、密度与布局。</p>
```

- [ ] **Step 6: 在「⑤ 圆角」section 之后、「⑥ 解析参考图」之前插入「布局」section（第 245 行后）**

```tsx
          {/* ⑥ 布局：安全距离 + 网格 */}
          <section className="space-y-3">
            <div className="text-xs font-semibold text-foreground-secondary">布局</div>

            {/* 安全距离 */}
            <div>
              <div className="mb-1.5 text-[11px] font-medium text-foreground-secondary">安全距离（px）</div>
              <div className="flex flex-wrap gap-1">
                {[24, 48, 64, 96].map((m) => (
                  <Chip key={m} active={layout.safeMargin === m} onClick={() => updateLayout('safeMargin', m)}>
                    {m}
                  </Chip>
                ))}
              </div>
              <input
                type="number"
                min={0}
                max={500}
                value={layout.safeMargin}
                onChange={(e) =>
                  updateLayout('safeMargin', Math.max(0, Math.min(500, Number(e.target.value) || 0)))
                }
                className="mt-1.5 w-24 rounded border border-border-default px-2 py-1 text-xs text-foreground-primary"
              />
            </div>

            {/* 网格大小 */}
            <div>
              <div className="mb-1.5 text-[11px] font-medium text-foreground-secondary">网格大小（px）</div>
              <div className="flex flex-wrap gap-1">
                {[8, 10, 12, 20].map((g) => (
                  <Chip key={g} active={layout.gridSize === g} onClick={() => updateLayout('gridSize', g)}>
                    {g}
                  </Chip>
                ))}
              </div>
              <input
                type="number"
                min={1}
                max={100}
                value={layout.gridSize}
                onChange={(e) =>
                  updateLayout('gridSize', Math.max(1, Math.min(100, Number(e.target.value) || 1)))
                }
                className="mt-1.5 w-24 rounded border border-border-default px-2 py-1 text-xs text-foreground-primary"
              />
            </div>

            {/* 显示开关 */}
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-xs text-foreground-secondary">
                <input
                  type="checkbox"
                  checked={layout.showGrid ?? true}
                  onChange={(e) => updateLayout('showGrid', e.target.checked)}
                />
                显示网格
              </label>
              <label className="flex items-center gap-1.5 text-xs text-foreground-secondary">
                <input
                  type="checkbox"
                  checked={layout.showSafeArea ?? true}
                  onChange={(e) => updateLayout('showSafeArea', e.target.checked)}
                />
                显示安全区
              </label>
            </div>
          </section>
```

> 「⑥ 解析参考图」section 上方原有的 `border-t border-border-subtle pt-4` 保留；该 section 现在顺延为「⑦」。

- [ ] **Step 7: `EditorTopbar.tsx` 改名（第 92–94 行）**

把：
```tsx
          title="报告设置（品牌色等）"
        >
          报告设置
```
改为：
```tsx
          title="全局样式设置（风格 / 布局）"
        >
          全局样式设置
```

- [ ] **Step 8: typecheck + 既有测试**

Run: `pnpm --filter @mediakit/web typecheck && pnpm --filter @mediakit/web exec vitest run`
Expected: typecheck 通过；测试 PASS。

- [ ] **Step 9: 提交**

```bash
git add apps/web/src/editor/components/ReportSettingsOverlay.tsx apps/web/src/editor/EditorTopbar.tsx
git commit -m "$(cat <<'EOF'
feat(web): 全局样式设置增「布局」分区（安全距离+网格）+ 预设带 layout + 改名

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: 全量回归 — typecheck + 手动清单 + 导出验证

**Files:** 无（验证-only；发现问题再回到对应 Task 修复）

- [ ] **Step 1: 全量 typecheck + 全量测试**

Run: `pnpm typecheck && pnpm test`
Expected: shared/web/server typecheck 全过；web/server vitest 全 PASS（含新增 `theme-layout`/`snap`/`projects.schema` 三套测试）。

- [ ] **Step 2: 起本地预览**

Run（后台）: `pnpm --filter @mediakit/web dev`（后端 `:4000` 与 DB 若已在跑则跳过）
打开 `http://localhost:5173/`，进入任一项目编辑器。

- [ ] **Step 3: 手动回归清单（逐项确认）**

1. 顶栏按钮文案为「全局样式设置」；点开浮层标题为「全局样式设置」，含「布局」分区。
2. 切 4 个预设（商务沉稳/科技简约/活力潮流/极简素雅）→ 安全区虚线 + 可见网格间距随之变化；预设 chip 高亮正确。
3. 手改「安全距离」或「网格大小」任一字段 → 预设 chip 高亮取消。
4. 拖一组件靠近安全区左边/上边（约 6px 内）→ 吸到安全线；继续往画布边缘拖 → 可越过安全线（出血不受阻）。
5. 拖动组件 / 拖角缩放 → 落点对齐到 `gridSize`（如网格 10 则坐标为 10 的倍数）。
6. 选中组件按 `Shift+方向键` → 移动一个 `gridSize`；普通方向键 → 1px。
7. 关闭「显示网格」→ 网格消失；关闭「显示安全区」→ 虚线消失且不再磁吸；「安全距离」设 0 → 不画安全区。
8. 任一老项目（meta.theme 无 `layout`）打开 → `normalizeTheme` 补默认，画布出现安全区/网格，无报错。
9. 改布局后等 autosave（~1.5s）→ 刷新页面 → `layout` 往返不丢。

- [ ] **Step 4: 导出无 overlay 验证（重点）**

1. 顶栏「导出 PDF」→ 下载并打开 PDF。
2. Expected: **导出页面中无安全区虚线、无网格**（导出走 `SharePage`/`PageView`，不经 `Canvas`）。若出现残留，回 Task 4 检查 overlay 是否误植到 `PageView`（应只在 `Canvas.tsx`）。

- [ ] **Step 5: 若全部通过，无需额外提交；若 Step 3/4 发现问题，修复后回到对应 Task 重提。**

---

## Self-Review（写完后自检）

- **Spec 覆盖**：§1 数据模型→T1；§2 预设→T1；§3 常量统一（MOVE_SNAP/SNAP/键盘/缩放）→T3/T4/T5；§4 安全区参考线+磁吸→T4（渲染）+T2/T3（吸附）；§5 CSS 变量→T6；§6 UI→T8；§7 Zod→T7；§8 回归→T9。全部覆盖。
- **占位符**：无 TBD/TODO；每步含完整代码或精确命令。
- **类型一致**：`ProjectTheme.layout` 形状在 T1 定义后，T3(`ThemePatch.layout`/`snapCtx`/`setTheme`)、T4(selectors)、T6(CSS var)、T7(Zod)、T8(UI) 均用同一字段名 `safeMargin`/`gridSize`/`showGrid`/`showSafeArea`；`snapMove`/`snapResize`/`safeRectFrom` 签名在 T2 定义后被 T3(store)、T4(Canvas) 一致调用。
- **`placed()` 签名变更**：T1 不动 `placed`；T3 Step 5 改签名加 `grid`，T3 Step 6 同步三处调用点（addComponentAt/addBusinessBlockAt/addShapeAt）——无遗漏（`addComponent`/`addBusinessBlock`/`addShape` 用 `centered` 不走 `placed`，不受影响）。
- **DragState 变更**：T4 Step 3 改 `move.comps` 形状加 `w/h`，T4 Step 4 同步 `handleComponentMouseDown` 的 map——一致。
