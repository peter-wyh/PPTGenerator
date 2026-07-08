# 页面渐变背景（Page Gradient Background）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为编辑器页面背景增加线性/径向渐变能力（2–6 色标），与纯色/图片以「类型单选」共存。

**Architecture:** shared 层加 `PageGradient` 类型 + 防御式 `gradientToCss`；web 层新增纯函数模块 `background.ts`（`resolvePageBackground` / `backgroundType` / `buildBackgroundTypePatch`），三处渲染点（Canvas / PageView / PageThumbnail）统一走它；store 的 `updatePage`/`patchPageLive` patch 类型扩到含 `bgGradient`；PropertyPanel 加类型 chip + `<GradientFields>` 编辑器。纯新增字段，零迁移。

**Tech Stack:** TypeScript、React 18、Zustand、Vitest（web 单测）；pnpm monorepo（`@mediakit/shared` 以源码被 web 直接消费，无构建步骤）。

**参考设计文档：** `docs/superpowers/specs/2026-07-08-page-gradient-background-design.md`

---

## 文件结构

| 文件 | 动作 | 职责 |
|---|---|---|
| `packages/shared/src/index.ts` | 修改 | 新增 `GradientStop` / `PageGradient` 类型；`Page` 加 `bgGradient?`；新增纯函数 `gradientToCss` |
| `apps/web/src/editor/background.ts` | 新建 | `resolvePageBackground` / `backgroundType` / `buildBackgroundTypePatch`（纯函数，背景优先级 + 类型切换） |
| `apps/web/src/editor/Canvas.tsx` | 修改 | 背景表达式改用 `resolvePageBackground` |
| `apps/web/src/editor/preview/PageView.tsx` | 修改 | 背景表达式改用 `resolvePageBackground` |
| `apps/web/src/editor/components/PageThumbnail.tsx` | 修改 | 删本地 `pageBg`，改用 `resolvePageBackground` |
| `apps/web/src/editor/store.ts` | 修改 | `updatePage` / `patchPageLive` patch 类型加 `'bgGradient'` |
| `apps/web/src/editor/PropertyPanel.tsx` | 修改 | `PageProperties` 加类型 chip + `<GradientFields>` 组件 |
| `apps/web/tests/shared.gradient.test.ts` | 新建 | `gradientToCss` 单测 |
| `apps/web/tests/background.test.ts` | 新建 | `resolvePageBackground` / `backgroundType` / `buildBackgroundTypePatch` 单测 |
| `apps/web/tests/editor.pages.background.test.ts` | 新建 | store `updatePage` 写 `bgGradient` 单测 |
| `apps/web/tests/property-panel.background.test.tsx` | 新建 | PropertyPanel 类型 chip + 渐变编辑器组件测 |

**测试约定（来自项目记忆）：** web 用 vitest，测试在 `apps/web/tests/`；从 web 测 shared 函数（`import ... from '@mediakit/shared'`）；组件测用 `@testing-library/react`，store 用 `useEditorStore.setState(...)` 预置后 `render(<PropertyPanel />)`。`PageProperties`/`GradientFields` 是纯 DOM（无 recharts），可断言任意文本与 store 状态。

**运行命令：**
- 单文件测试：`pnpm --filter @mediakit/web exec vitest run tests/<file>`
- 全量 web 测试：`pnpm --filter @mediakit/web test`
- 类型检查（shared + web）：`pnpm -r run typecheck`

---

## Task 1: shared — 渐变类型 + `gradientToCss`

**Files:**
- Modify: `packages/shared/src/index.ts`
- Test: `apps/web/tests/shared.gradient.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `apps/web/tests/shared.gradient.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { gradientToCss, type PageGradient } from '@mediakit/shared';

describe('gradientToCss', () => {
  it('线性渐变：angle + 两色标', () => {
    const g: PageGradient = {
      type: 'linear',
      angle: 90,
      stops: [
        { color: '#FF5C00', position: 0 },
        { color: '#FFFFFF', position: 100 },
      ],
    };
    expect(gradientToCss(g)).toBe('linear-gradient(90deg, #FF5C00 0%, #FFFFFF 100%)');
  });

  it('径向渐变：忽略 angle，circle at center', () => {
    const g: PageGradient = {
      type: 'radial',
      angle: 90,
      stops: [
        { color: '#FF5C00', position: 0 },
        { color: '#FFFFFF', position: 100 },
      ],
    };
    expect(gradientToCss(g)).toBe('radial-gradient(circle at center, #FF5C00 0%, #FFFFFF 100%)');
  });

  it('按 position 升序排序色标', () => {
    const g: PageGradient = {
      type: 'linear',
      angle: 0,
      stops: [
        { color: '#FFFFFF', position: 100 },
        { color: '#000000', position: 50 },
        { color: '#FF5C00', position: 0 },
      ],
    };
    expect(gradientToCss(g)).toBe('linear-gradient(0deg, #FF5C00 0%, #000000 50%, #FFFFFF 100%)');
  });

  it('position 超界 clamp 到 0–100', () => {
    const g: PageGradient = {
      type: 'linear',
      angle: 0,
      stops: [
        { color: '#FF5C00', position: -20 },
        { color: '#FFFFFF', position: 150 },
      ],
    };
    expect(gradientToCss(g)).toBe('linear-gradient(0deg, #FF5C00 0%, #FFFFFF 100%)');
  });

  it('单色标补齐到 2（同色 0/100）', () => {
    const g = { type: 'linear', angle: 0, stops: [{ color: '#FF5C00', position: 0 }] } as PageGradient;
    expect(gradientToCss(g)).toBe('linear-gradient(0deg, #FF5C00 0%, #FF5C00 100%)');
  });

  it('多于 6 色标截断到 6（先排序后截断）', () => {
    const g: PageGradient = {
      type: 'linear',
      angle: 0,
      stops: [
        { color: '#111111', position: 0 },
        { color: '#222222', position: 20 },
        { color: '#333333', position: 40 },
        { color: '#444444', position: 60 },
        { color: '#555555', position: 80 },
        { color: '#666666', position: 100 },
        { color: '#777777', position: 90 },
      ],
    };
    // 升序：0,20,40,60,80,90,100 → 截断 6 个 = 0,20,40,60,80,90（100 那个被丢弃）
    expect(gradientToCss(g)).toBe(
      'linear-gradient(0deg, #111111 0%, #222222 20%, #333333 40%, #444444 60%, #555555 80%, #777777 90%)',
    );
  });

  it('angle 缺省回退 180', () => {
    const g = {
      type: 'linear',
      stops: [
        { color: '#FF5C00', position: 0 },
        { color: '#FFFFFF', position: 100 },
      ],
    } as PageGradient;
    expect(gradientToCss(g)).toBe('linear-gradient(180deg, #FF5C00 0%, #FFFFFF 100%)');
  });

  it('angle 超界 clamp 0–360', () => {
    const g = {
      type: 'linear',
      angle: 400,
      stops: [
        { color: '#FF5C00', position: 0 },
        { color: '#FFFFFF', position: 100 },
      ],
    } as PageGradient;
    expect(gradientToCss(g)).toBe('linear-gradient(360deg, #FF5C00 0%, #FFFFFF 100%)');
  });

  it('异常输入不抛错，回退纯白线性', () => {
    const fallback = 'linear-gradient(180deg, #FFFFFF 0%, #FFFFFF 100%)';
    expect(gradientToCss(null)).toBe(fallback);
    expect(gradientToCss(undefined)).toBe(fallback);
    expect(gradientToCss({})).toBe(fallback);
  });

  it('非法颜色回退白', () => {
    const g = {
      type: 'linear',
      angle: 0,
      stops: [
        { color: 'not-a-color', position: 0 },
        { color: '#FFFFFF', position: 100 },
      ],
    } as unknown as PageGradient;
    expect(gradientToCss(g)).toBe('linear-gradient(0deg, #FFFFFF 0%, #FFFFFF 100%)');
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm --filter @mediakit/web exec vitest run tests/shared.gradient.test.ts`
Expected: FAIL — `gradientToCss is not a function`（导出不存在）。

- [ ] **Step 3: 在 shared 加类型与函数**

修改 `packages/shared/src/index.ts`。

**3a. 在 `Page` interface 之前（约 937 行，`/** 编辑器数据模型... */` 段落内）插入类型：**

```ts
/** 渐变色标：颜色（HEX）+ 位置（百分比 0–100）。 */
export interface GradientStop {
  color: string;
  position: number;
}

/** 页面背景渐变：线性 / 径向，2–6 色标；线性带角度。 */
export interface PageGradient {
  type: 'linear' | 'radial';
  angle?: number;
  stops: GradientStop[];
}
```

**3b. 给 `Page` interface 加字段（在 `bgColor` / `bgImage` 之间）：**

```ts
export interface Page {
  id: string;
  name: string;
  components: EditorComponent[];
  bgColor?: string;
  /** 页面背景渐变；优先级在 bgImage 之下、bgColor 之上。 */
  bgGradient?: PageGradient;
  bgImage?: string;
}
```

**3c. 在文件末尾（`Page` 之后）加 `gradientToCss` 与私有 helper：**

```ts
function clampNum(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function validHex(c: unknown): string {
  return typeof c === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c) ? c : '#FFFFFF';
}

/**
 * 把 PageGradient 对象转成 CSS 渐变字符串。防御式归一（渲染层最后一道防线）：
 * - position clamp 到 0–100 并按升序排序；
 * - 色标少于 2 → 补齐到 2；多于 6 → 截断到 6；
 * - 非法颜色回退 #FFFFFF；
 * - angle 缺省 180、clamp 到 0–360；type 非 radial 一律按 linear。
 * 输入为空 / 异常时不抛错，返回纯白线性渐变。
 */
export function gradientToCss(g: unknown): string {
  const raw = (g && typeof g === 'object' ? g : {}) as Partial<PageGradient>;
  const type: 'linear' | 'radial' = raw.type === 'radial' ? 'radial' : 'linear';

  let stops = (Array.isArray(raw.stops) ? raw.stops : [])
    .filter((s): s is GradientStop => !!s && typeof s === 'object')
    .map((s) => ({
      color: validHex(s.color),
      position: clampNum(Math.round(Number(s.position) || 0), 0, 100),
    }))
    .sort((a, b) => a.position - b.position);

  if (stops.length === 0) {
    stops = [
      { color: '#FFFFFF', position: 0 },
      { color: '#FFFFFF', position: 100 },
    ];
  } else if (stops.length === 1) {
    const c = stops[0].color;
    stops = [
      { color: c, position: 0 },
      { color: c, position: 100 },
    ];
  }
  if (stops.length > 6) stops = stops.slice(0, 6);

  const stopStr = stops.map((s) => `${s.color} ${s.position}%`).join(', ');
  if (type === 'radial') return `radial-gradient(circle at center, ${stopStr})`;
  const angle = clampNum(Math.round(Number(raw.angle ?? 180)), 0, 360);
  return `linear-gradient(${angle}deg, ${stopStr})`;
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run tests/shared.gradient.test.ts`
Expected: PASS（10 个用例全过）。

- [ ] **Step 5: 类型检查 + 提交**

Run: `pnpm -r run typecheck`
Expected: 无错误。

```bash
git add packages/shared/src/index.ts apps/web/tests/shared.gradient.test.ts
git commit -m "feat(shared): 页面渐变背景类型 + gradientToCss 防御式归一"
```

---

## Task 2: web — `background.ts` 纯函数模块

**Files:**
- Create: `apps/web/src/editor/background.ts`
- Test: `apps/web/tests/background.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `apps/web/tests/background.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { resolvePageBackground, backgroundType, buildBackgroundTypePatch } from '@/editor/background';
import type { Page } from '@mediakit/shared';

type BgFields = Pick<Page, 'bgColor' | 'bgGradient' | 'bgImage'>;
const P = (over: Partial<BgFields>): BgFields => over as BgFields;

describe('resolvePageBackground — 优先级 bgImage > bgGradient > bgColor > #fff', () => {
  it('bgImage 最高', () => {
    expect(
      resolvePageBackground(
        P({ bgImage: 'a.png', bgGradient: { type: 'linear', stops: [] }, bgColor: '#000' }),
      ),
    ).toBe('#fff url(a.png) center/cover no-repeat');
  });
  it('bgGradient 高于 bgColor', () => {
    expect(
      resolvePageBackground(
        P({
          bgGradient: { type: 'linear', angle: 0, stops: [{ color: '#FF5C00', position: 0 }, { color: '#fff', position: 100 }] },
          bgColor: '#000',
        }),
      ),
    ).toBe('linear-gradient(0deg, #FF5C00 0%, #FFFFFF 100%)');
  });
  it('仅 bgColor', () => {
    expect(resolvePageBackground(P({ bgColor: '#FF5C00' }))).toBe('#FF5C00');
  });
  it('全空回白', () => {
    expect(resolvePageBackground(P({}))).toBe('#fff');
  });
});

describe('backgroundType — 由数据推导', () => {
  it('image / gradient / color / none', () => {
    expect(backgroundType(P({ bgImage: 'a.png' }))).toBe('image');
    expect(backgroundType(P({ bgGradient: { type: 'linear', stops: [] } }))).toBe('gradient');
    expect(backgroundType(P({ bgColor: '#000' }))).toBe('color');
    expect(backgroundType(P({}))).toBe('none');
  });
});

describe('buildBackgroundTypePatch — 单选切换', () => {
  it('切到 color：写 bgColor（缺省白），清 gradient/image', () => {
    const p = P({ bgGradient: { type: 'linear', stops: [] }, bgImage: 'a.png' });
    expect(buildBackgroundTypePatch(p, 'color')).toEqual({
      bgColor: '#FFFFFF',
      bgGradient: undefined,
      bgImage: undefined,
    });
  });
  it('切到 color：保留已有 bgColor', () => {
    const p = P({ bgColor: '#FF5C00' });
    expect(buildBackgroundTypePatch(p, 'color')).toEqual({
      bgColor: '#FF5C00',
      bgGradient: undefined,
      bgImage: undefined,
    });
  });
  it('切到 gradient：用旧 bgColor 做第一 stop，清 color/image', () => {
    const p = P({ bgColor: '#FF5C00', bgImage: 'a.png' });
    expect(buildBackgroundTypePatch(p, 'gradient')).toEqual({
      bgColor: undefined,
      bgGradient: {
        type: 'linear',
        angle: 180,
        stops: [
          { color: '#FF5C00', position: 0 },
          { color: '#E5E7EB', position: 100 },
        ],
      },
      bgImage: undefined,
    });
  });
  it('切到 gradient：无旧 bgColor 时第一 stop 白', () => {
    expect(buildBackgroundTypePatch(P({}), 'gradient')).toEqual({
      bgColor: undefined,
      bgGradient: {
        type: 'linear',
        angle: 180,
        stops: [
          { color: '#FFFFFF', position: 0 },
          { color: '#E5E7EB', position: 100 },
        ],
      },
      bgImage: undefined,
    });
  });
  it('切到 image：清 color/gradient，保留 bgImage', () => {
    const p = P({ bgColor: '#FF5C00', bgGradient: { type: 'linear', stops: [] }, bgImage: 'a.png' });
    expect(buildBackgroundTypePatch(p, 'image')).toEqual({
      bgColor: undefined,
      bgGradient: undefined,
      bgImage: 'a.png',
    });
  });
  it('切到 none：全清', () => {
    const p = P({ bgColor: '#FF5C00', bgGradient: { type: 'linear', stops: [] }, bgImage: 'a.png' });
    expect(buildBackgroundTypePatch(p, 'none')).toEqual({
      bgColor: undefined,
      bgGradient: undefined,
      bgImage: undefined,
    });
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm --filter @mediakit/web exec vitest run tests/background.test.ts`
Expected: FAIL — 模块 `@/editor/background` 不存在。

- [ ] **Step 3: 创建 `apps/web/src/editor/background.ts`**

```ts
import type { Page, PageGradient } from '@mediakit/shared';
import { gradientToCss } from '@mediakit/shared';

export type BackgroundType = 'color' | 'gradient' | 'image' | 'none';

/** 页面背景 CSS：bgImage > bgGradient > bgColor > #fff。 */
export function resolvePageBackground(page: Pick<Page, 'bgColor' | 'bgGradient' | 'bgImage'>): string {
  if (page.bgImage) return `#fff url(${page.bgImage}) center/cover no-repeat`;
  if (page.bgGradient) return gradientToCss(page.bgGradient);
  return page.bgColor ?? '#fff';
}

/** 由数据推导当前背景类型。 */
export function backgroundType(page: Pick<Page, 'bgColor' | 'bgGradient' | 'bgImage'>): BackgroundType {
  if (page.bgImage) return 'image';
  if (page.bgGradient) return 'gradient';
  if (page.bgColor) return 'color';
  return 'none';
}

/**
 * 切换背景类型应写入页面的 patch（单选语义：清掉非目标字段，目标字段给默认值）。
 * 持久化对象里始终最多一个背景字段。
 */
export function buildBackgroundTypePatch(
  page: Pick<Page, 'bgColor' | 'bgGradient' | 'bgImage'>,
  type: BackgroundType,
): Partial<Pick<Page, 'bgColor' | 'bgGradient' | 'bgImage'>> {
  switch (type) {
    case 'color':
      return { bgColor: page.bgColor ?? '#FFFFFF', bgGradient: undefined, bgImage: undefined };
    case 'gradient': {
      const first = page.bgColor ?? '#FFFFFF';
      const grad: PageGradient = {
        type: 'linear',
        angle: 180,
        stops: [
          { color: first, position: 0 },
          { color: '#E5E7EB', position: 100 },
        ],
      };
      return { bgColor: undefined, bgGradient: grad, bgImage: undefined };
    }
    case 'image':
      return { bgColor: undefined, bgGradient: undefined, bgImage: page.bgImage };
    case 'none':
    default:
      return { bgColor: undefined, bgGradient: undefined, bgImage: undefined };
  }
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run tests/background.test.ts`
Expected: PASS（全部用例）。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/background.ts apps/web/tests/background.test.ts
git commit -m "feat(web): background 解析模块（resolvePageBackground/类型切换 patch）"
```

---

## Task 3: 三处渲染点统一走 `resolvePageBackground`

**Files:**
- Modify: `apps/web/src/editor/Canvas.tsx`（约 264–266 行）
- Modify: `apps/web/src/editor/preview/PageView.tsx`（约 22–25 行）
- Modify: `apps/web/src/editor/components/PageThumbnail.tsx`（约 19–23、38 行）

> 这是消除重复的纯重构，无新增测试；用 typecheck + 全量 web 测试兜底回归。

- [ ] **Step 1: 改 `Canvas.tsx`**

在文件顶部 import 区加（与其它 `./...` 同级）：

```ts
import { resolvePageBackground } from './background';
```

把约 264–266 行的内联表达式：

```ts
          background: currentPage?.bgImage
            ? `#fff url(${currentPage.bgImage}) center/cover no-repeat`
            : currentPage?.bgColor ?? '#fff',
```

替换为：

```ts
          background: currentPage ? resolvePageBackground(currentPage) : '#fff',
```

- [ ] **Step 2: 改 `PageView.tsx`**

顶部 import 区加（PageView 在 `preview/` 下，背景模块在 `editor/` 根）：

```ts
import { resolvePageBackground } from '../background';
```

把约 22–25 行：

```ts
  // 背景与编辑器 Canvas 一致：bgImage 优先，否则 bgColor，缺省白。
  const background = page.bgImage
    ? `#fff url(${page.bgImage}) center/cover no-repeat`
    : page.bgColor ?? '#fff';
```

替换为：

```ts
  // 背景与编辑器 Canvas 一致：统一走 resolvePageBackground（图 > 渐变 > 纯色 > 白）。
  const background = resolvePageBackground(page);
```

- [ ] **Step 3: 改 `PageThumbnail.tsx`**

顶部 import 区加（PageThumbnail 在 `editor/components/` 下）：

```ts
import { resolvePageBackground } from '../background';
```

删除约 19–23 行的本地 helper（含注释）：

```ts
/** 页面背景样式（与 Canvas 一致：图优先于色，默认白）。 */
function pageBg(page: Page): string {
  if (page.bgImage) return `#fff url(${page.bgImage}) center/cover no-repeat`;
  return page.bgColor ?? '#fff';
}
```

把约 38 行的 `background: pageBg(page)` 改为：

```ts
                background: resolvePageBackground(page),
```

> 删除 `pageBg` 后，`Page` 类型若不再被该文件其它处使用，保留 import 无害；若 typecheck 报未使用，则从 import 中移除 `Page`。

- [ ] **Step 4: 类型检查 + 全量测试**

Run: `pnpm -r run typecheck`
Expected: 无错误。

Run: `pnpm --filter @mediakit/web test`
Expected: 全部通过（无回归）。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/Canvas.tsx apps/web/src/editor/preview/PageView.tsx apps/web/src/editor/components/PageThumbnail.tsx
git commit -m "refactor(web): 三处页面背景渲染统一走 resolvePageBackground"
```

---

## Task 4: store — `updatePage` / `patchPageLive` 支持 `bgGradient`

**Files:**
- Modify: `apps/web/src/editor/store.ts`（约 148、152 行）
- Test: `apps/web/tests/editor.pages.background.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `apps/web/tests/editor.pages.background.test.ts`：

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '@/editor/store';
import type { ProjectDetail, PageGradient } from '@mediakit/shared';

const grad: PageGradient = {
  type: 'linear',
  angle: 90,
  stops: [
    { color: '#FF5C00', position: 0 },
    { color: '#FFFFFF', position: 100 },
  ],
};

const detail: ProjectDetail = {
  id: 'p',
  name: 'p',
  width: 1280,
  height: 720,
  pages: [{ id: 'pg', name: '第 1 页', components: [] }],
  createdAt: '',
  updatedAt: '',
};

describe('editor store — page bgGradient', () => {
  beforeEach(() => useEditorStore.getState().loadProject(detail, 'p'));

  it('updatePage 写入 bgGradient 并落 history + 标脏', () => {
    const before = useEditorStore.getState().historyIndex;
    useEditorStore.getState().updatePage('pg', { bgGradient: grad });
    const page = useEditorStore.getState().pages[0];
    expect(page.bgGradient).toEqual(grad);
    expect(useEditorStore.getState().historyIndex).toBe(before + 1);
    expect(useEditorStore.getState().dirty).toBe(true);
  });

  it('updatePage 可清空 bgGradient（传 undefined）', () => {
    useEditorStore.getState().updatePage('pg', { bgGradient: grad });
    useEditorStore.getState().updatePage('pg', { bgGradient: undefined });
    expect(useEditorStore.getState().pages[0].bgGradient).toBeUndefined();
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm --filter @mediakit/web exec vitest run tests/editor.pages.background.test.ts`
Expected: FAIL — 类型错误（`bgGradient` 不在 `updatePage` 的 patch Pick 内，TS 编译报错 → 测试不通过）。

- [ ] **Step 3: 扩展 store patch 类型**

修改 `apps/web/src/editor/store.ts`，把两处签名（约 148、152 行）的 Pick 加 `'bgGradient'`：

```ts
  updatePage: (id: string, patch: Partial<Pick<Page, 'name' | 'bgColor' | 'bgGradient' | 'bgImage'>>) => void;
```

```ts
  patchPageLive: (id: string, patch: Partial<Pick<Page, 'name' | 'bgColor' | 'bgGradient' | 'bgImage'>>) => void;
```

（实现体 `pages: s.pages.map((p) => p.id === id ? { ...p, ...patch } : p)` 已是浅合并，无需改动。）

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run tests/editor.pages.background.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/store.ts apps/web/tests/editor.pages.background.test.ts
git commit -m "feat(web): store updatePage/patchPageLive patch 类型支持 bgGradient"
```

---

## Task 5: PropertyPanel — 类型 chip + `<GradientFields>`

**Files:**
- Modify: `apps/web/src/editor/PropertyPanel.tsx`
- Test: `apps/web/tests/property-panel.background.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `apps/web/tests/property-panel.background.test.tsx`：

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PropertyPanel } from '@/editor/PropertyPanel';
import { useEditorStore } from '@/editor/store';
import type { PageGradient } from '@mediakit/shared';

function setPage(over: Record<string, unknown> = {}) {
  useEditorStore.setState({
    pages: [{ id: 'p1', name: 'P1', components: [], ...over }],
    currentPageId: 'p1',
    selectedIds: [],
  } as any);
}

describe('PropertyPanel — 页面背景类型单选 + 渐变编辑器', () => {
  beforeEach(() => setPage());

  it('无选中时渲染三个背景类型 chip', () => {
    render(<PropertyPanel />);
    expect(screen.getByText('纯色')).toBeInTheDocument();
    expect(screen.getByText('渐变')).toBeInTheDocument();
    expect(screen.getByText('图片')).toBeInTheDocument();
  });

  it('点击「渐变」写入 bgGradient（默认 2 stop）并清掉 bgColor/bgImage', () => {
    setPage({ bgColor: '#FF5C00', bgImage: 'a.png' });
    render(<PropertyPanel />);
    fireEvent.click(screen.getByText('渐变'));
    const page = useEditorStore.getState().pages[0];
    expect(page.bgGradient).toBeDefined();
    expect((page.bgGradient as PageGradient).stops).toHaveLength(2);
    expect(page.bgColor).toBeUndefined();
    expect(page.bgImage).toBeUndefined();
  });

  it('已有 bgGradient 时渲染渐变编辑器（线性 / 径向 / 添加色标）', () => {
    setPage({
      bgGradient: {
        type: 'linear',
        angle: 180,
        stops: [
          { color: '#FFFFFF', position: 0 },
          { color: '#E5E7EB', position: 100 },
        ],
      },
    });
    render(<PropertyPanel />);
    expect(screen.getByText('线性')).toBeInTheDocument();
    expect(screen.getByText('径向')).toBeInTheDocument();
    expect(screen.getByText('+ 添加色标')).toBeInTheDocument();
  });

  it('点击「+ 添加色标」增加一个色标（2 → 3）', () => {
    setPage({
      bgGradient: {
        type: 'linear',
        angle: 180,
        stops: [
          { color: '#FFFFFF', position: 0 },
          { color: '#E5E7EB', position: 100 },
        ],
      },
    });
    render(<PropertyPanel />);
    fireEvent.click(screen.getByText('+ 添加色标'));
    const page = useEditorStore.getState().pages[0];
    expect((page.bgGradient as PageGradient).stops).toHaveLength(3);
  });

  it('6 个色标时禁用「+ 添加色标」', () => {
    const stops = Array.from({ length: 6 }, (_, i) => ({ color: '#FFFFFF', position: i * 20 }));
    setPage({ bgGradient: { type: 'linear', angle: 180, stops } });
    render(<PropertyPanel />);
    expect(screen.getByText('+ 添加色标')).toBeDisabled();
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm --filter @mediakit/web exec vitest run tests/property-panel.background.test.tsx`
Expected: FAIL — 找不到「渐变」「+ 添加色标」等文本（UI 尚未实现）。

- [ ] **Step 3a: 扩充 PropertyPanel 的 import**

修改 `apps/web/src/editor/PropertyPanel.tsx` 顶部。

把现有 `import type { ... } from '@mediakit/shared';` 的类型列表加入 `Page`、`PageGradient`、`GradientStop`：

```ts
import type {
  CommentWordcloudData,
  CreatorAvatarCardData,
  EditorComponent,
  ComponentData,
  CreatorStatItem,
  CreatorStatsStripData,
  KpiBoardData,
  KpiColorToken,
  Sentiment,
  WorkMetricsData,
  WorkScreenshotData,
  ShapeData,
  ShapeKind,
  Page,
  PageGradient,
  GradientStop,
} from '@mediakit/shared';
```

在 import 区新增背景模块：

```ts
import { backgroundType, buildBackgroundTypePatch, type BackgroundType } from './background';
```

- [ ] **Step 3b: 用新版替换 `PageProperties` 函数**

把 `apps/web/src/editor/PropertyPanel.tsx` 中现有的 `PageProperties` 函数（从 `function PageProperties() {` 到其对应 `}`）整体替换为：

```tsx
function PageProperties() {
  const page = useEditorStore((s) => s.currentPage());
  const updatePage = useEditorStore((s) => s.updatePage);
  const patchPageLive = useEditorStore((s) => s.patchPageLive);

  // 本地缓冲：色板拖动/文本输入时实时更新视觉，但只在 onBlur 时落 history。
  const [bgColorDraft, setBgColorDraft] = useState<string>(page?.bgColor ?? '');
  const [nameDraft, setNameDraft] = useState<string>(page?.name ?? '');
  // 背景类型（单选）：初始由数据推导，切页 / 背景字段变化时重算；点击 chip 切换。
  const [bgType, setBgType] = useState<BackgroundType>(() => (page ? backgroundType(page) : 'none'));

  useEffect(() => {
    setBgColorDraft(page?.bgColor ?? '');
    setNameDraft(page?.name ?? '');
    setBgType(page ? backgroundType(page) : 'none');
  }, [page?.id, page?.bgColor, page?.bgGradient, page?.bgImage, page?.name]);

  if (!page) {
    return (
      <div className="flex h-full w-[300px] items-center justify-center border-l border-border-default bg-surface-primary p-4 text-center text-sm text-foreground-muted">
        选中组件以编辑属性
      </div>
    );
  }

  const onBgColorInput = (v: string) => {
    setBgColorDraft(v);
    patchPageLive(page.id, { bgColor: v || undefined });
  };
  const commitBgColor = () => updatePage(page.id, { bgColor: bgColorDraft || undefined });

  const onNameInput = (v: string) => {
    setNameDraft(v);
    patchPageLive(page.id, { name: v });
  };
  const commitName = () => updatePage(page.id, { name: nameDraft });

  // 切换背景类型：单选语义，清掉非目标字段 + 写默认值，一次落 history。
  const switchType = (t: BackgroundType) => {
    setBgType(t);
    updatePage(page.id, buildBackgroundTypePatch(page, t));
  };
  const clearBg = () => {
    setBgType('none');
    updatePage(page.id, { bgColor: undefined, bgGradient: undefined, bgImage: undefined });
  };

  const TYPE_LABELS: Record<Exclude<BackgroundType, 'none'>, string> = {
    color: '纯色',
    gradient: '渐变',
    image: '图片',
  };

  return (
    <div className="flex h-full w-[300px] flex-col gap-4 overflow-auto border-l border-border-default bg-surface-primary p-4">
      <div className="font-headings text-sm font-semibold text-foreground-primary">页面属性</div>

      <FieldGroup title="页面名">
        <input
          value={nameDraft}
          onChange={(e) => onNameInput(e.target.value)}
          onBlur={commitName}
          className="w-full rounded border border-border-default px-2 py-1 text-sm text-foreground-primary"
        />
      </FieldGroup>

      <FieldGroup title="背景">
        <div className="flex flex-wrap gap-1">
          {(['color', 'gradient', 'image'] as const).map((t) => (
            <button
              key={t}
              onClick={() => switchType(t)}
              className={`rounded border px-2 py-1 text-xs ${
                bgType === t
                  ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                  : 'border-border-default text-foreground-secondary hover:bg-surface-hover'
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {bgType === 'color' && (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={bgColorDraft || '#ffffff'}
              onChange={(e) => onBgColorInput(e.target.value)}
              onBlur={commitBgColor}
              className="h-8 w-10 rounded border border-border-default p-1"
            />
            <input
              value={bgColorDraft}
              placeholder="#FFFFFF（留空=白）"
              onChange={(e) => onBgColorInput(e.target.value)}
              onBlur={commitBgColor}
              className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-primary"
            />
          </div>
        )}

        {bgType === 'gradient' && <GradientFields page={page} />}

        {bgType === 'image' && (
          <ImageInput
            value={page.bgImage ?? ''}
            onChange={(url) => updatePage(page.id, { bgImage: url || undefined })}
          />
        )}

        {(page.bgColor || page.bgGradient || page.bgImage) && (
          <button onClick={clearBg} className="mt-1 text-xs text-foreground-muted hover:text-red">
            清除背景
          </button>
        )}
      </FieldGroup>

      <p className="mt-auto text-xs text-foreground-muted">提示：点选画布上的组件以编辑组件属性。</p>
    </div>
  );
}
```

- [ ] **Step 3c: 新增 `<GradientFields>` 组件**

在 `PropertyPanel.tsx` 中（建议放在 `PageProperties` 之后、`/* 通用样式变体 */` 注释之前）新增：

```tsx
/* ------------------------------ 渐变背景 ------------------------------ */

const GRADIENT_ANGLE_PRESETS: { angle: number; label: string }[] = [
  { angle: 0, label: '→' },
  { angle: 45, label: '↘' },
  { angle: 90, label: '↓' },
  { angle: 135, label: '↙' },
  { angle: 180, label: '←' },
  { angle: 225, label: '↖' },
  { angle: 270, label: '↑' },
  { angle: 315, label: '↗' },
];

function clampAngle(a: number): number {
  return Math.max(0, Math.min(360, Math.round(a) || 0));
}
function clampPos(p: number): number {
  return Math.max(0, Math.min(100, Math.round(p) || 0));
}

/**
 * 渐变背景编辑器：子类型 + （线性）角度快捷/数字 + 预览条 + 色标增删。
 * 连续输入（颜色拖动 / 角度 / 位置数字）用 patchPageLive 实时预览、不落 history，
 * 交互结束（onBlur）/ 离散动作（切类型、方向按钮、增删色标）再 updatePage 落一次 history。
 * 与 PageProperties.bgColor 的 live-draft → onBlur commit 模式一致，避免色板拖动刷爆 history。
 */
function GradientFields({ page }: { page: Page }) {
  const updatePage = useEditorStore((s) => s.updatePage);
  const patchPageLive = useEditorStore((s) => s.patchPageLive);
  const grad = page.bgGradient;
  if (!grad) return null;

  const live = (next: PageGradient) => patchPageLive(page.id, { bgGradient: next });
  const commit = (next: PageGradient) => updatePage(page.id, { bgGradient: next });

  const setType = (type: 'linear' | 'radial') => commit({ ...grad, type });
  const commitAngle = (angle: number) => commit({ ...grad, angle: clampAngle(angle) });
  const onAngleInput = (angle: number) => live({ ...grad, angle: clampAngle(angle) });

  const mapStop = (i: number, patch: Partial<GradientStop>) =>
    grad.stops.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
  const onStopColor = (i: number, color: string) => live({ ...grad, stops: mapStop(i, { color }) });
  const onStopPos = (i: number, position: number) =>
    live({ ...grad, stops: mapStop(i, { position: clampPos(position) }) });
  const commitStops = () => commit({ ...grad, stops: grad.stops });

  const addStop = () => {
    if (grad.stops.length >= 6) return;
    const last = grad.stops[grad.stops.length - 1];
    const pos = clampPos((last?.position ?? 0) + (100 - (last?.position ?? 0)) / 2);
    commit({ ...grad, stops: [...grad.stops, { color: last?.color ?? '#FFFFFF', position: pos }] });
  };
  const removeStop = (i: number) => {
    if (grad.stops.length <= 2) return;
    commit({ ...grad, stops: grad.stops.filter((_, idx) => idx !== i) });
  };

  const angle = grad.angle ?? 180;
  const stopStr = grad.stops
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((s) => `${s.color} ${s.position}%`)
    .join(', ');
  const preview =
    grad.type === 'radial'
      ? `radial-gradient(circle at center, ${stopStr})`
      : `linear-gradient(${angle}deg, ${stopStr})`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {(['linear', 'radial'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded border px-2 py-1 text-xs ${
              grad.type === t
                ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                : 'border-border-default text-foreground-secondary hover:bg-surface-hover'
            }`}
          >
            {t === 'linear' ? '线性' : '径向'}
          </button>
        ))}
      </div>

      <div className="h-6 w-full rounded border border-border-default" style={{ background: preview }} />

      {grad.type === 'linear' && (
        <div className="space-y-1">
          <div className="flex flex-wrap gap-1">
            {GRADIENT_ANGLE_PRESETS.map((p) => (
              <button
                key={p.angle}
                onClick={() => commitAngle(p.angle)}
                className={`h-7 w-7 rounded border text-xs ${
                  angle === p.angle ? 'border-accent-primary bg-accent-primary/10' : 'border-border-default hover:bg-surface-hover'
                }`}
                title={`${p.angle}°`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-foreground-secondary">
            <span>角度</span>
            <input
              type="number"
              min={0}
              max={360}
              value={angle}
              onChange={(e) => onAngleInput(Number(e.target.value))}
              onBlur={(e) => commitAngle(Number(e.target.value))}
              className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-primary"
            />
          </label>
        </div>
      )}

      <div className="space-y-1">
        <div className="text-xs text-foreground-secondary">色标</div>
        {grad.stops.map((s, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              type="color"
              value={s.color}
              onChange={(e) => onStopColor(i, e.target.value)}
              onBlur={commitStops}
              className="h-6 w-6 rounded border border-border-default"
            />
            <input
              type="number"
              min={0}
              max={100}
              value={s.position}
              onChange={(e) => onStopPos(i, Number(e.target.value))}
              onBlur={commitStops}
              className="w-14 rounded border border-border-default px-1 py-0.5 text-xs text-foreground-primary"
            />
            <button
              onClick={() => removeStop(i)}
              disabled={grad.stops.length <= 2}
              className="text-foreground-muted hover:text-red disabled:opacity-30"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addStop}
        disabled={grad.stops.length >= 6}
        className="text-xs text-accent-primary hover:underline disabled:opacity-30"
      >
        + 添加色标
      </button>
    </div>
  );
}
```

- [ ] **Step 4: 运行组件测试，确认通过**

Run: `pnpm --filter @mediakit/web exec vitest run tests/property-panel.background.test.tsx`
Expected: PASS（5 个用例）。

- [ ] **Step 5: 类型检查 + 全量测试**

Run: `pnpm -r run typecheck`
Expected: 无错误。

Run: `pnpm --filter @mediakit/web test`
Expected: 全部通过。

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/editor/PropertyPanel.tsx apps/web/tests/property-panel.background.test.tsx
git commit -m "feat(web): 页面属性渐变背景编辑器（类型单选 + 色标编辑）"
```

---

## Task 6: 最终验证

- [ ] **Step 1: 全量类型检查**

Run: `pnpm -r run typecheck`
Expected: shared + web（+ server）均无错误。

- [ ] **Step 2: 全量 web 测试**

Run: `pnpm --filter @mediakit/web test`
Expected: 全部通过。

- [ ] **Step 3: 构建**

Run: `pnpm --filter @mediakit/web build`
Expected: 构建成功（`tsc -b && vite build` 无错误）。

- [ ] **Step 4: 手动冒烟（dev）**

Run: `pnpm --filter @mediakit/web dev`，打开编辑器，确认：
1. 未选中组件时，页面属性面板出现 [纯色][渐变][图片] 三个 chip。
2. 点「渐变」→ 画布背景立刻变成默认线性渐变；面板出现 线性/径向、方向按钮、角度框、预览条、2 个色标、+ 添加色标。
3. 改角度 / 拖方向按钮 → 画布渐变方向实时变。
4. 切「径向」→ 画布变径向。
5. 加色标到 6 → 「+ 添加色标」禁用；删到 2 → 删除按钮禁用。
6. 改某色标颜色/位置 → 画布 + 预览条同步变。
7. 切回「纯色」「图片」→ 之前渐变字段被清掉（类型单选）。
8. 「清除背景」→ 全清，回到白底。
9. 缩略图（侧栏）与预览页背景与画布一致。
10. 撤销/重做（Cmd+Z / Cmd+Shift+Z）能回退/重做渐变操作。

- [ ] **Step 5（可选）: 提交收尾**

如 Step 4 过程中无改动则跳过；若有微调：

```bash
git add -A
git commit -m "chore(web): 渐变背景冒烟微调"
```

---

## 完成定义（DoD）

- 页面背景支持线性（带角度）/ 径向渐变，2–6 色标可增删改。
- 与纯色/图片背景「类型单选」互斥共存；切换不残留多背景字段。
- 三处渲染（Canvas / PageView 预览分享PDF / 缩略图）一致，统一走 `resolvePageBackground`。
- 已保存项目（无 `bgGradient`）零迁移、不崩。
- `pnpm -r run typecheck` 与 `pnpm --filter @mediakit/web test` 全绿。
