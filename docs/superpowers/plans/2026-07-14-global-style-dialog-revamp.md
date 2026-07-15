# 全局样式弹窗改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把「全局样式设置」浮层改成左侧分类导航(max-w-4xl)、移除「皮肤质感」控件并迁移持久化 `skinPreset`、在弹窗标题栏右上角显示当前业务线 Logo。

**Architecture:** 数据层先动(shared `normalizeTheme` 迁移 + 预设换 shadow)→ 渲染层(`theme.tsx` 删 CSS 覆盖)→ store(`ThemePatch`/`setTheme` 删 skinPreset)→ 类型+server schema(删字段)→ 浮层(删皮肤质感 UI + 重构左导航 + 业务线 Logo)。每个 task 在干净基线上用 pathspec 提交,只含本 task 文件。`skinPreset` 是被防御式解析的样式标志(非注册查找键),删除 + `normalizeTheme` 迁移即可兼容存量项目。

**Tech Stack:** TypeScript · Zod(server)· React 18 + Zustand(web)· vitest(web/server;shared 从 `apps/web/tests/` 测)。

**Spec:** [`docs/superpowers/specs/2026-07-14-global-style-dialog-revamp-design.md`](../specs/2026-07-14-global-style-dialog-revamp-design.md)

---

## 文件结构（创建 / 修改清单）

**shared**
- Modify `packages/shared/src/theme/utils.ts`(`normalizeTheme`:skinPreset 迁移 + 不再输出)
- Modify `packages/shared/src/theme/presets.ts`(`tech-minimal`/`vibrant-trendy` 换 `shadow`,删 `skinPreset`)
- Modify `packages/shared/src/types/theme.ts`(删 `skinPreset` 字段 + `SkinPreset` 类型)

**server**
- Modify `apps/server/src/modules/projects/projects.schema.ts`(删 `skinPreset` Zod 字段)

**web**
- Modify `apps/web/src/editor/theme.tsx`(删 skinPreset→`--skin-*` 覆盖分支)
- Modify `apps/web/src/editor/store-types.ts`(删 `ThemePatch.skinPreset`)
- Modify `apps/web/src/editor/store.ts`(删 `setTheme` 的 skinPreset 合并)
- Modify `apps/web/src/editor/components/ReportSettingsOverlay.tsx`(删皮肤质感 UI + skinPreset 引用 + applyPreset 透传 shadow + 重构左导航 + 业务线 Logo)

**测试**
- Modify `apps/web/tests/theme-layout.test.ts`(normalizeTheme 迁移 + 预设 shadow)
- Modify `apps/web/tests/theme-style-v2.test.ts`(themeToCssVars 不再输出 `--skin-*`)
- Modify `apps/server/tests/projects.schema.test.ts`(skinPreset 字段移除后旧 payload 仍合法)
- Create `apps/web/tests/report-settings-overlay.test.tsx`(浮层渲染:无皮肤质感 / 左导航 4 项 / 业务线 Logo)

---

## 约定

- **测试命令**:web 单测 `pnpm --filter web test -- <file>`;server 单测 `pnpm --filter server test -- <file>`;全量类型 `pnpm -r typecheck`。
- **recharts 在 jsdom 被整体 mock**(见仓库记忆):浮层测试不渲染图表,无需 mock recharts;但 `ImageInput` 用 file/crop,需 mock。
- **提交(关键)**:本仓库工作树常驻大批已暂存文件,且 IDE 会跨调用重置暂存区。**每个 task 只提交本 task 的文件,用 pathspec**:只改已存在文件 → `git commit -m "..." -- <file1> <file2>`;含新建文件 → `git add <newfile> && git commit -m "..." -- <all task files>`。提交后 `git show --stat HEAD` 硬校验只含预期文件。**绝不**用裸 `git commit`(会卷进整个暂存区)或 `git add -A`。
- **基线**:Task 0 先把现有未提交 grafts 提交干净(见下),之后 8 个目标文件在干净基线上,每个 task 的 pathspec 提交只含本 task 改动。
- **新字段/迁移一律可选 + normalize 兜底**,老项目零迁移。

---

## Task 0:建立干净基线（提交现有 grafts）

**Files:** 无代码改动;仅 git 操作。

> 现工作树有 ~84 个未提交文件(67 改 + 17 新),跨多个 feature(heading/audience/page-binding/skinPreset 正交化等),其中 8 个目标文件带 grafts 且 `theme.tsx` 的 graft 直接改写了 skinPreset 覆盖块。本 plan 的代码片段按「grafts 已提交」的当前工作树状态编写,故必须先把 grafts 提交,得到干净基线,后续 task 的 pathspec 提交才能只含本 task 改动。

- [ ] **Step 1: 选择提交方式(二选一)**

  - **方式 A(推荐:你来按 feature 拆分提交)**:你把现有未提交工作按 feature 提交(你清楚边界),完成后告知。只有你能正确拆分这些交织的多 feature grafts。
  - **方式 B(快:一次性 WIP 快照,可回滚)**:把全部未提交工作作为一个 WIP 快照提交,后续可 `git reset --soft HEAD~1` 拆分。

    ```bash
    git add -A && git commit -m "wip: snapshot in-progress grafts before global-style-dialog-revamp

    Co-Authored-By: Claude <noreply@anthropic.com>"
    ```

    > 无 pre-commit hook(已确认 `.husky`/husky/lint-staged 均无),不会被拦。

- [ ] **Step 2: 校验 8 个目标文件已干净**

  Run:
  ```bash
  git diff HEAD --stat -- \
    packages/shared/src/types/theme.ts \
    packages/shared/src/theme/presets.ts \
    packages/shared/src/theme/utils.ts \
    apps/server/src/modules/projects/projects.schema.ts \
    apps/web/src/editor/theme.tsx \
    apps/web/src/editor/store.ts \
    apps/web/src/editor/store-types.ts \
    apps/web/src/editor/components/ReportSettingsOverlay.tsx
  ```
  Expected: 空输出(8 个目标文件与 HEAD 一致 = 干净)。若非空,回到 Step 1 把残留 grafts 提交后再校验。

- [ ] **Step 3: 全量基线测试(确认 grafts 自洽)**

  Run: `pnpm --filter web test && pnpm --filter server test`
  Expected: 全绿(grafts 是已完成工作;若挂,说明 grafts 不自洽,需你先修,不要进入 Task 1)。

---

## Task 1：`normalizeTheme` 迁移 skinPreset → radius/shadow

**Files:**
- Modify: `packages/shared/src/theme/utils.ts`(`normalizeTheme` skinPreset 块 ~162-167 + return ~197-207)
- Test: `apps/web/tests/theme-layout.test.ts`(末尾追加)

- [ ] **Step 1: 写失败测试（红）**

在 `apps/web/tests/theme-layout.test.ts` 末尾追加(`normalizeTheme` 已在顶部 import):

```ts
describe('normalizeTheme skinPreset 迁移', () => {
  it('flat → radius=sharp + shadow=none，且不再输出 skinPreset', () => {
    const t = normalizeTheme({ skinPreset: 'flat' });
    expect(t.radius).toBe('sharp');
    expect(t.shadow).toBe('none');
    expect('skinPreset' in t).toBe(false);
  });

  it('elevated → radius=large + shadow=strong', () => {
    const t = normalizeTheme({ skinPreset: 'elevated' });
    expect(t.radius).toBe('large');
    expect(t.shadow).toBe('strong');
    expect('skinPreset' in t).toBe(false);
  });

  it('default / 无 skinPreset → 不改 radius/shadow', () => {
    const t = normalizeTheme({ radius: 'large', shadow: 'subtle' });
    expect(t.radius).toBe('large');
    expect(t.shadow).toBe('subtle');
    expect('skinPreset' in t).toBe(false);
  });
});
```

- [ ] **Step 2: 跑测试确认红**

Run: `pnpm --filter web test -- theme-layout.test.ts`
Expected: FAIL(`flat` 仍输出 `skinPreset='flat'`、radius/shadow 未迁移;`'skinPreset' in t` 为 true)。

- [ ] **Step 3: 替换 skinPreset 解析块为迁移逻辑**

在 `packages/shared/src/theme/utils.ts` 的 `normalizeTheme` 内,把这段(现 ~162-167):

```ts
  const skinPresetRaw = typeof obj.skinPreset === 'string' ? obj.skinPreset : undefined;
  const validSkins = ['default', 'flat', 'elevated'] as const;
  const skinPreset: 'default' | 'flat' | 'elevated' | undefined =
    validSkins.includes(skinPresetRaw as (typeof validSkins)[number])
      ? (skinPresetRaw as 'default' | 'flat' | 'elevated')
      : (d.skinPreset ?? 'default');
```

替换为:

```ts
  // 旧 skinPreset 迁移：flat→sharp/none、elevated→large/strong（skinPreset 字段已移除，圆角+阴影为唯一真源）。
  const legacySkin =
    obj.skinPreset === 'flat' || obj.skinPreset === 'elevated' ? (obj.skinPreset as 'flat' | 'elevated') : undefined;
  const finalRadius: ThemeRadius = legacySkin === 'flat' ? 'sharp' : legacySkin === 'elevated' ? 'large' : radius;
  const finalShadow: ThemeShadow = legacySkin === 'flat' ? 'none' : legacySkin === 'elevated' ? 'strong' : shadow;
```

> `ThemeRadius`/`ThemeShadow` 已在该文件 import(顶部 `import type { ProjectTheme, ThemeDensity, ThemeRadius, ProjectMeta, ThemeShadow, ThemeFormat }`)。`radius`/`shadow` 是上文已解析的局部变量。

- [ ] **Step 4: 改 return——用 finalRadius/finalShadow，删 skinPreset**

在同一个 `return { ... }` 里做三处改动:

1. `radius: ['sharp', 'small', 'large'].includes(radius) ? radius : d.radius,` →
   `radius: ['sharp', 'small', 'large'].includes(finalRadius) ? finalRadius : d.radius,`
2. 删除整行 `skinPreset,`
3. `shadow,` → `shadow: finalShadow,`

> return 里其它行(含 grafts 加的 `heading,`)不动。

- [ ] **Step 5: 跑测试确认绿**

Run: `pnpm --filter web test -- theme-layout.test.ts`
Expected: PASS(含新 `normalizeTheme skinPreset 迁移` 块;既有用例不破)。

- [ ] **Step 6: 类型检查**

Run: `pnpm --filter shared typecheck && pnpm --filter web typecheck`
Expected: 通过(`skinPreset` 仍在 ProjectTheme 类型里(可选),只是 normalizeTheme 不再输出,不影响类型)。

- [ ] **Step 7: 提交（pathspec）**

```bash
git commit -m "refactor(shared): normalizeTheme 迁移 skinPreset→radius/shadow

Co-Authored-By: Claude <noreply@anthropic.com>" -- packages/shared/src/theme/utils.ts apps/web/tests/theme-layout.test.ts
```

校验: `git show --stat HEAD` 只含上述 2 文件。

---

## Task 2：预设 `tech-minimal`/`vibrant-trendy` 换 `shadow`

**Files:**
- Modify: `packages/shared/src/theme/presets.ts`(`STYLE_PRESETS` tech-minimal ~159、vibrant-trendy ~179)
- Test: `apps/web/tests/theme-layout.test.ts`

- [ ] **Step 1: 写失败测试（红）**

在 `apps/web/tests/theme-layout.test.ts` 末尾追加(`STYLE_PRESETS` 已在顶部 import):

```ts
describe('STYLE_PRESETS skinPreset→shadow', () => {
  it('tech-minimal：shadow=none、无 skinPreset', () => {
    const t = STYLE_PRESETS.find((p) => p.key === 'tech-minimal')!.theme;
    expect(t.shadow).toBe('none');
    expect('skinPreset' in t).toBe(false);
  });

  it('vibrant-trendy：shadow=strong、无 skinPreset', () => {
    const t = STYLE_PRESETS.find((p) => p.key === 'vibrant-trendy')!.theme;
    expect(t.shadow).toBe('strong');
    expect('skinPreset' in t).toBe(false);
  });
});
```

- [ ] **Step 2: 跑测试确认红**

Run: `pnpm --filter web test -- theme-layout.test.ts`
Expected: FAIL(tech-minimal 现 `skinPreset:'flat'`、无 `shadow`;vibrant-trendy 同理)。

- [ ] **Step 3: tech-minimal 换字段**

在 `packages/shared/src/theme/presets.ts` 的 `tech-minimal` 预设 `theme` 内,把:

```ts
      radius: 'sharp',
      skinPreset: 'flat',
      layout: { safeMargin: 40, gridSize: 8, showGrid: true, showSafeArea: true },
```

改为:

```ts
      radius: 'sharp',
      shadow: 'none',
      layout: { safeMargin: 40, gridSize: 8, showGrid: true, showSafeArea: true },
```

- [ ] **Step 4: vibrant-trendy 换字段**

在 `vibrant-trendy` 预设 `theme` 内,把:

```ts
      radius: 'large',
      skinPreset: 'elevated',
      layout: { safeMargin: 64, gridSize: 12, showGrid: true, showSafeArea: true },
```

改为:

```ts
      radius: 'large',
      shadow: 'strong',
      layout: { safeMargin: 64, gridSize: 12, showGrid: true, showSafeArea: true },
```

- [ ] **Step 5: 跑测试确认绿**

Run: `pnpm --filter web test -- theme-layout.test.ts`
Expected: PASS。

- [ ] **Step 6: 类型检查 + 提交**

Run: `pnpm --filter shared typecheck`

```bash
git commit -m "refactor(shared): tech-minimal/vibrant-trendy 用 shadow 替代 skinPreset

Co-Authored-By: Claude <noreply@anthropic.com>" -- packages/shared/src/theme/presets.ts apps/web/tests/theme-layout.test.ts
```

校验: `git show --stat HEAD` 只含上述 2 文件。

---

## Task 3：`theme.tsx` 删 skinPreset CSS 覆盖分支

**Files:**
- Modify: `apps/web/src/editor/theme.tsx`(`themeToCssVars` skinPreset 块 ~94-103)
- Test: `apps/web/tests/theme-style-v2.test.ts`

- [ ] **Step 1: 写失败测试（红）**

在 `apps/web/tests/theme-style-v2.test.ts` 末尾追加(`themeToCssVars`/`DEFAULT_THEME` 已在顶部 import,`vars` helper 已存在):

```ts
describe('themeToCssVars 不再输出 skin 变量', () => {
  it('skinPreset=flat 不再设 --skin-radius-card / --skin-shadow-card', () => {
    const v = vars({ ...DEFAULT_THEME, skinPreset: 'flat' } as never);
    expect(v['--skin-radius-card']).toBeUndefined();
    expect(v['--skin-shadow-card']).toBeUndefined();
  });

  it('skinPreset=elevated 不再设 --skin-*', () => {
    const v = vars({ ...DEFAULT_THEME, skinPreset: 'elevated' } as never);
    expect(v['--skin-radius-card']).toBeUndefined();
    expect(v['--skin-shadow-card']).toBeUndefined();
  });
});
```

> `skinPreset` 仍在 ProjectTheme 类型(Task 6 才删),故 `{...DEFAULT_THEME, skinPreset:'flat'}` 合法。

- [ ] **Step 2: 跑测试确认红**

Run: `pnpm --filter web test -- theme-style-v2.test.ts`
Expected: FAIL(flat 时 `--skin-radius-card` 仍为 `'4px'`)。

- [ ] **Step 3: 删除 skinPreset 覆盖分支**

在 `apps/web/src/editor/theme.tsx` 的 `themeToCssVars` 内,删除整段(现 ~94-103):

```ts
  // v3：skinPreset → 独立的圆角/阴影修饰层（不覆盖主题级 --radius-card/--shadow-card）。
  // skinPreset 与 t.radius/t.shadow 正交：主题控制基础档位，skinPreset 做微调覆盖。
  const skin = t.skinPreset ?? 'default';
  if (skin === 'flat') {
    vars['--skin-radius-card'] = '4px';
    vars['--skin-shadow-card'] = 'none';
  } else if (skin === 'elevated') {
    vars['--skin-radius-card'] = '20px';
    vars['--skin-shadow-card'] = SHADOW_MAP.strong;
  }
```

> `index.css` 的 `.skin-card*` 用 `var(--skin-radius-card, var(--radius-card, 12px))` 回退链——`--skin-*` 不再被设,自然回退到 `--radius-card`/`--shadow-card`,零行为变化,**不动 index.css**。

- [ ] **Step 4: 跑测试确认绿**

Run: `pnpm --filter web test -- theme-style-v2.test.ts`
Expected: PASS。

- [ ] **Step 5: 类型检查 + 提交**

Run: `pnpm --filter web typecheck`

```bash
git commit -m "refactor(web): themeToCssVars 移除 skinPreset 覆盖分支

Co-Authored-By: Claude <noreply@anthropic.com>" -- apps/web/src/editor/theme.tsx apps/web/tests/theme-style-v2.test.ts
```

校验: `git show --stat HEAD` 只含上述 2 文件。

---

## Task 4：浮层删「皮肤质感」UI + skinPreset 引用 + applyPreset 透传 shadow

**Files:**
- Modify: `apps/web/src/editor/components/ReportSettingsOverlay.tsx`
- Test: Create `apps/web/tests/report-settings-overlay.test.tsx`

> 本 task 只做 skinPreset 相关删除 + applyPreset 换 shadow;**不做**左导航重构(Task 7)。改完浮层仍是单列,但少了「皮肤质感」分区。

- [ ] **Step 1: 写失败测试（红）**

新建 `apps/web/tests/report-settings-overlay.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReportSettingsOverlay } from '@/editor/components/ReportSettingsOverlay';
import { useEditorStore } from '@/editor/store';
import { DEFAULT_THEME } from '@mediakit/shared';

vi.mock('@/components/ImageInput', () => ({
  ImageInput: ({ value }: { value?: string }) => (value ? <img alt="img" src={value} /> : null),
}));

const noop = () => {};

describe('ReportSettingsOverlay skinPreset 移除', () => {
  it('不渲染「皮肤质感」分区；弹窗正常渲染', () => {
    useEditorStore.setState({ projectMeta: { theme: DEFAULT_THEME } } as never);
    render(<ReportSettingsOverlay onClose={noop} />);
    expect(screen.queryByText('皮肤质感')).toBeNull();
    expect(screen.getByText('全局样式设置')).toBeInTheDocument();
    expect(screen.getByText('卡片阴影')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 跑测试确认红**

Run: `pnpm --filter web test -- report-settings-overlay.test.tsx`
Expected: FAIL(「皮肤质感」仍渲染 → `queryByText` 非 null)。

- [ ] **Step 3: 删 `SKIN_PRESET_OPTIONS` 常量 + `SkinPreset` import**

在 `apps/web/src/editor/components/ReportSettingsOverlay.tsx`:

- 顶部 `@mediakit/shared` import 中删 `type SkinPreset`(保留 `DEFAULT_THEME`/`FONT_OPTIONS`/`STYLE_PRESETS`/`type ProjectTheme` 等)。
- 删除常量:

```ts
const SKIN_PRESET_OPTIONS: { value: SkinPreset; label: string }[] = [
  { value: 'default', label: '标准' },
  { value: 'flat', label: '扁平' },
  { value: 'elevated', label: '浮起' },
];
```

- [ ] **Step 4: 删 `updateSkinPreset` 函数**

删除:

```ts
  function updateSkinPreset(s: SkinPreset) {
    setTheme({ skinPreset: s, preset: undefined });
  }
```

- [ ] **Step 5: 删「皮肤质感」`<section>`**

删除整个 `{/* ⑤b 皮肤质感 */}` section(从 `<section>` 到对应 `</section>`,含其内 `<p>` 描述)。

- [ ] **Step 6: `applyPreset` 把 skinPreset 换成 shadow**

把 `applyPreset` 内的:

```ts
      layout: { ...preset.theme.layout },
      skinPreset: preset.theme.skinPreset,
      preset: preset.key,
```

改为:

```ts
      layout: { ...preset.theme.layout },
      shadow: preset.theme.shadow,
      preset: preset.key,
```

> `ThemePatch` 仍有 `shadow?`(v2 已加);预设未设 shadow 时 `preset.theme.shadow` 为 undefined → setTheme 保留当前,安全。

- [ ] **Step 7: `applyDraftPatch` 删 skinPreset 行**

删除 `applyDraftPatch` return 里的:

```ts
    skinPreset: 'skinPreset' in patch ? patch.skinPreset : prev.skinPreset,
```

- [ ] **Step 8: 跑测试确认绿 + 类型检查**

Run: `pnpm --filter web test -- report-settings-overlay.test.tsx && pnpm --filter web typecheck`
Expected: PASS + 类型通过(`skinPreset` 仍在 ThemePatch/ProjectTheme 类型(可选),浮层已无任何 skinPreset 引用)。

- [ ] **Step 9: 提交（含新建测试文件）**

```bash
git add apps/web/tests/report-settings-overlay.test.tsx && git commit -m "refactor(web): 浮层移除皮肤质感 UI + skinPreset 引用，applyPreset 透传 shadow

Co-Authored-By: Claude <noreply@anthropic.com>" -- apps/web/src/editor/components/ReportSettingsOverlay.tsx apps/web/tests/report-settings-overlay.test.tsx
```

校验: `git show --stat HEAD` 只含上述 2 文件。

---

## Task 5：store 删 `ThemePatch.skinPreset` + `setTheme` 合并

**Files:**
- Modify: `apps/web/src/editor/store-types.ts`(`ThemePatch.skinPreset` ~35)
- Modify: `apps/web/src/editor/store.ts`(`setTheme` skinPreset 行 ~339)
- Test: `apps/web/tests/editor.store.test.ts`(跑既有用例确认不破)

> Task 4 已让浮层不再构造含 skinPreset 的 ThemePatch,故可安全从 store 删。

- [ ] **Step 1: 删 `ThemePatch.skinPreset`**

在 `apps/web/src/editor/store-types.ts` 的 `ThemePatch` 里删除:

```ts
  skinPreset?: NonNullable<ProjectTheme['skinPreset']>;
```

- [ ] **Step 2: 删 `setTheme` 的 skinPreset 合并行**

在 `apps/web/src/editor/store.ts` 的 `setTheme`(`mutateAndCommit` 内 `merged` 对象)里删除:

```ts
          skinPreset: 'skinPreset' in patch ? patch.skinPreset : current.skinPreset,
```

- [ ] **Step 3: 类型检查 + 跑 store 测试**

Run: `pnpm --filter web typecheck && pnpm --filter web test -- editor.store.test.ts`
Expected: 类型通过(无任何 ThemePatch.skinPreset 引用了)+ store 测试全绿。

- [ ] **Step 4: 提交**

```bash
git commit -m "refactor(web): store 移除 ThemePatch.skinPreset 与 setTheme 合并

Co-Authored-By: Claude <noreply@anthropic.com>" -- apps/web/src/editor/store-types.ts apps/web/src/editor/store.ts
```

校验: `git show --stat HEAD` 只含上述 2 文件。

---

## Task 6：类型 + server schema 删 `skinPreset` 字段 + `SkinPreset` 类型

**Files:**
- Modify: `packages/shared/src/types/theme.ts`(删字段 ~126-131 + 类型 ~135-136)
- Modify: `apps/server/src/modules/projects/projects.schema.ts`(删 `skinPreset` Zod ~136)
- Test: `apps/server/tests/projects.schema.test.ts`

> 经 Tasks 1-5,`skinPreset`/`SkinPreset` 已无任何消费者(theme.tsx/store/overlay/presets 均已清),只剩定义本身。本 task 删定义。`normalizeTheme` 仍读 `obj.skinPreset`(字符串键,用于迁移)——`obj` 是 `Record<string,unknown>`,不依赖类型,保留。

- [ ] **Step 1: 写失败测试（红）**

在 `apps/server/tests/projects.schema.test.ts` 末尾追加(`createProjectSchema` 已在顶部 import):

```ts
describe('projectThemeSchema skinPreset 已移除', () => {
  it('旧 payload 携带 skinPreset 仍合法（Zod strip 未知键）', () => {
    const r = createProjectSchema.safeParse({
      name: 't',
      meta: { theme: { skinPreset: 'flat', color: { primary: '#FF5C00' } } },
    });
    expect(r.success).toBe(true);
  });

  it('旧 payload 携带非法 skinPreset 也合法（字段已不校验，被 strip）', () => {
    const r = createProjectSchema.safeParse({
      name: 't',
      meta: { theme: { skinPreset: 'bogus' } },
    });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: 跑测试确认红**

Run: `pnpm --filter server test -- projects.schema.test.ts`
Expected: 第二个 `it` FAIL(`skinPreset: 'bogus'` 现被 enum 拒绝 → `success=false`;第一个 `it` 绿)。

- [ ] **Step 3: 删 `skinPreset` 字段 + `SkinPreset` 类型**

在 `packages/shared/src/types/theme.ts`:

- 删除 `ProjectTheme` 内的字段及其文档注释(现 ~126-131):

```ts
  /**
   * 皮肤风格预设：控制组件整体视觉"感觉"（圆角幅度、卡片密度、品牌色用法等）。
   * 与 color/font/density 正交——可在任意主题色上叠加不同 skinPreset。
   * 'default' = 标准卡片；'flat' = 无边框扁平；'elevated' = 大圆角深阴影。
   */
  skinPreset?: SkinPreset;
```

- 删除类型定义(现 ~135-136):

```ts
/** 皮肤风格预设档位。 */
export type SkinPreset = 'default' | 'flat' | 'elevated';
```

- [ ] **Step 4: 删 server Zod `skinPreset` 字段**

在 `apps/server/src/modules/projects/projects.schema.ts` 的 `projectThemeSchema` 内,删除(现 ~136):

```ts
    skinPreset: z.enum(['default', 'flat', 'elevated']).optional(),
```

- [ ] **Step 5: 跑测试确认绿 + 全量类型**

Run: `pnpm --filter server test -- projects.schema.test.ts && pnpm -r typecheck`
Expected: server 测试 PASS;类型全绿(无任何 `skinPreset`/`SkinPreset` 残留引用)。

> 若 typecheck 报某处仍引用 `skinPreset`/`SkinPreset`:`grep -rn "skinPreset\|SkinPreset" packages/shared/src apps/web/src apps/server/src`。预期命中:`utils.ts`(`obj.skinPreset` 迁移用,合法)与 `apps/web/src/index.css`(注释提及 skinPreset,`.skin-card*` 回退链按 spec 保留不动,合法)。其余命中处补删。

- [ ] **Step 6: 提交**

```bash
git commit -m "refactor: 移除 skinPreset 字段与类型（含 server Zod）

Co-Authored-By: Claude <noreply@anthropic.com>" -- packages/shared/src/types/theme.ts apps/server/src/modules/projects/projects.schema.ts apps/server/tests/projects.schema.test.ts
```

校验: `git show --stat HEAD` 只含上述 3 文件。

---

## Task 7：浮层重构左导航分类 + max-w-4xl + 业务线 Logo

**Files:**
- Modify: `apps/web/src/editor/components/ReportSettingsOverlay.tsx`(外壳 + 导航 + 标题栏 Logo)
- Test: `apps/web/tests/report-settings-overlay.test.tsx`(追加用例)

> 把现有 13 个 `<section>` 按 4 个分类归并到右侧面板,左侧加分类导航,标题栏右上角加业务线 Logo。**所有现有 `updateX` 函数 / `draft` / `applyDraftPatch` / 子组件(`ColorField`/`FontSelect`/`Chip`/`BackgroundGradientFields`)保留**,只重组 JSX 外壳 + 搬运 section。

- [ ] **Step 1: 追加失败测试（红）**

先把 import 加到 `apps/web/tests/report-settings-overlay.test.tsx` **顶部 import 区**(紧接 `import { DEFAULT_THEME } from '@mediakit/shared';` 之后):

```ts
import { BUSINESS_LINE_META } from '@/projectsMeta';
```

然后在文件末尾追加 describe:

```ts
describe('ReportSettingsOverlay 左导航 + 业务线 Logo', () => {
  it('左导航 4 项可见；默认选「基础样式」（配色可见）', () => {
    useEditorStore.setState({ projectMeta: { theme: DEFAULT_THEME } } as never);
    render(<ReportSettingsOverlay onClose={noop} />);
    expect(screen.getByText('基础样式')).toBeInTheDocument();
    expect(screen.getByText('布局')).toBeInTheDocument();
    expect(screen.getByText('组件样式')).toBeInTheDocument();
    expect(screen.getByText('品牌')).toBeInTheDocument();
    expect(screen.getByText('配色')).toBeInTheDocument(); // 基础样式默认展开
  });

  it('标题栏右上角渲染当前业务线 Logo + 名称', () => {
    useEditorStore.setState({ projectMeta: { businessLine: 'FT', theme: DEFAULT_THEME } } as never);
    render(<ReportSettingsOverlay onClose={noop} />);
    const logo = screen.getByAltText(BUSINESS_LINE_META.FT.name);
    expect(logo).toHaveAttribute('src', BUSINESS_LINE_META.FT.logo);
  });

  it('无业务线时不渲染 Logo', () => {
    useEditorStore.setState({ projectMeta: { theme: DEFAULT_THEME } } as never);
    render(<ReportSettingsOverlay onClose={noop} />);
    expect(screen.queryByAltText(BUSINESS_LINE_META.FT.name)).toBeNull();
  });
});
```

- [ ] **Step 2: 跑测试确认红**

Run: `pnpm --filter web test -- report-settings-overlay.test.tsx`
Expected: FAIL(无左导航按钮「布局/组件样式/品牌」;无业务线 Logo img)。

- [ ] **Step 3: 加 import + 业务线 Logo 读取 + active 分类 state**

在 `apps/web/src/editor/components/ReportSettingsOverlay.tsx`:

顶部加 import:

```ts
import { BUSINESS_LINE_META } from '@/projectsMeta';
```

在组件体内(`const [toast, setToast] = ...` 附近)加:

```ts
  // 业务线 Logo（标题栏右上角，只读；取自 mock BUSINESS_LINE_META）
  const businessLine = useEditorStore((s) => s.projectMeta?.businessLine);
  const bl = businessLine ? BUSINESS_LINE_META[businessLine] : undefined;

  // 左导航分类
  type Cat = 'basic' | 'layout' | 'component' | 'brand';
  const [activeCat, setActiveCat] = useState<Cat>('basic');
  const CATS: { key: Cat; label: string }[] = [
    { key: 'basic', label: '基础样式' },
    { key: 'layout', label: '布局' },
    { key: 'component', label: '组件样式' },
    { key: 'brand', label: '品牌' },
  ];
```

- [ ] **Step 4: 改外壳——max-w-4xl + 标题栏 Logo + 左导航 + 右内容**

把现有最外层 dialog `<div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-surface-primary shadow-lg" ...>` 的 `max-w-lg` 改为 `max-w-4xl`。

把「标题栏」`<div className="flex items-center justify-between border-b ... px-6 py-4">` 的右侧(原仅 `<button onClick={onClose}>✕</button>`)替换为:

```tsx
        <div className="flex items-center gap-3">
          {bl?.logo && (
            <div className="flex items-center gap-2">
              <img
                src={bl.logo}
                alt={bl.name}
                className="h-8 w-8 rounded-lg object-contain"
                draggable={false}
              />
              <span className="text-xs text-foreground-secondary">{bl.name}</span>
            </div>
          )}
          <button onClick={onClose} className="text-foreground-muted hover:text-foreground-primary">✕</button>
        </div>
```

把原 `<div className="space-y-5 overflow-y-auto px-6 py-5"> ...13 个 section... </div>` 替换为「左导航 + 右内容」结构:

```tsx
        <div className="flex flex-1 overflow-hidden">
          {/* 左导航 */}
          <nav className="w-52 flex-none space-y-1 border-r border-border-subtle p-3">
            {CATS.map((c) => (
              <button
                key={c.key}
                onClick={() => setActiveCat(c.key)}
                className={`w-full rounded-lg px-3 py-1.5 text-left text-sm transition ${
                  activeCat === c.key
                    ? 'bg-accent-primary/10 font-medium text-accent-primary'
                    : 'text-foreground-secondary hover:bg-surface-hover'
                }`}
              >
                {c.label}
              </button>
            ))}
          </nav>

          {/* 右内容：按 activeCat 渲染对应 sections（现有 section JSX 原样搬入） */}
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {activeCat === 'basic' && (
              <>
                {/* 整体风格预设、配色、字体、标题样式、行高、币种与数字、密度、解析参考图 */}
              </>
            )}
            {activeCat === 'layout' && (
              <>
                {/* 布局（安全距离 + 网格 + 显示开关） */}
              </>
            )}
            {activeCat === 'component' && (
              <>
                {/* 圆角、卡片阴影、图表样式、默认页面背景 */}
              </>
            )}
            {activeCat === 'brand' && (
              <>
                {/* 品牌（Logo + 标题 + 副标题） */}
              </>
            )}
          </div>
        </div>
```

- [ ] **Step 5: 把现有 13 个 `<section>` 原样搬入对应分类**

把原 `<div className="space-y-5 ...">` 里的各 `<section>`(及其注释)按下表**原样**(不改 section 内部任何代码)剪贴进 Step 4 对应 `{/* ... */}` 注释处:

| 分类 | 搬入的现有 section(按注释定位) |
|---|---|
| `basic` | ① 整体风格预设、② 配色、③ 字体、标题样式、行高、币种与数字、④ 密度、⑨ 解析参考图 |
| `layout` | ⑥ 布局(安全距离 + 网格大小 + 显示开关) |
| `component` | ⑤ 圆角、卡片阴影、图表样式、⑧ 默认页面背景 |
| `brand` | ⑦ 品牌(Logo + 品牌标题 + 品牌副标题) |

> 「皮肤质感」section 已在 Task 4 删除,不搬。圆角/卡片阴影从原位置搬入 `component`。各 section 的 `className="space-y-3"` 等保留;外层 `space-y-5` 已由右内容容器提供。

- [ ] **Step 6: 跑测试确认绿 + 类型检查**

Run: `pnpm --filter web test -- report-settings-overlay.test.tsx && pnpm --filter web typecheck`
Expected: PASS(左导航 4 项 + 业务线 Logo)+ 类型通过。

- [ ] **Step 7: 提交**

```bash
git commit -m "feat(web): 全局样式浮层左导航分类 + max-w-4xl + 业务线 Logo

Co-Authored-By: Claude <noreply@anthropic.com>" -- apps/web/src/editor/components/ReportSettingsOverlay.tsx apps/web/tests/report-settings-overlay.test.tsx
```

校验: `git show --stat HEAD` 只含上述 2 文件。

---

## Task 8：全量验证 + 手动回归

**Files:** 无改动,仅验证。

- [ ] **Step 1: 全量类型 + 单测**

Run: `pnpm -r typecheck && pnpm --filter web test && pnpm --filter server test`
Expected: 全绿(含新增 theme-layout / theme-style-v2 / report-settings-overlay / projects.schema 用例)。

- [ ] **Step 2: grep 复核 skinPreset 残留**

Run: `grep -rn "skinPreset\|SkinPreset" packages/shared/src apps/web/src apps/server/src`
Expected: 命中 `packages/shared/src/theme/utils.ts`(`obj.skinPreset` 迁移用)与 `apps/web/src/index.css`(注释 + `.skin-card*` 回退链,按 spec 保留不动)。其它命中 = 漏删,补删。

- [ ] **Step 3: 手动回归清单（启动 `pnpm --filter web dev`）**

1. 打开「全局样式设置」→ 弹窗更宽(max-w-4xl),左侧 4 个分类,默认「基础样式」。
2. 切「布局/组件样式/品牌」→ 右侧内容切换,draft 不丢(改配色后切分类再切回,值仍在)。
3. 「组件样式」里有「圆角」「卡片阴影」「图表样式」「默认页面背景」,无「皮肤质感」。
4. 标题栏右上角显示当前业务线 Logo + 名称(如 FT→FineTech 蓝底 FT 图);无业务线时不显示。
5. 切预设:商务沉稳/极简素雅等正常;科技简约(原 flat)→ 阴影=无;活力潮流(原 elevated)→ 阴影=强烈;圆角随预设(sharp/large)。
6. 手改圆角/阴影 → preset 高亮清空;圆角+阴影是唯一真源,不再被静默覆盖。
7. 老项目(theme JSON 含 `skinPreset:'flat'`)打开 → 渲染为直角+无阴影(迁移生效),无报错,`skinPreset` 字段不再出现在主题对象。
8. 保存 → 刷新 → 往返不丢;预览/分享/导出业务线 Logo 仍在右上角(Canvas/PageView 未动)。

- [ ] **Step 4: 收尾提交（如有手动微调）**

```bash
git commit -m "chore: 全局样式弹窗改造手动回归微调

Co-Authored-By: Claude <noreply@anthropic.com>" -- apps/web/src/editor/components/ReportSettingsOverlay.tsx
```

> 仅当 Step 3 有微调时提交;无微调则跳过。

---

## 风险与回退

- **基线不干净**:Task 0 必须先把 8 个目标文件的 grafts 提交干净(`git diff HEAD --stat` 空)。否则后续 pathspec 提交会卷进 grafts。回退:`git reset --soft HEAD~1` 撤销误提交,保留暂存态。
- **`applyPreset` 透传 shadow 的行为变化**:仅 tech-minimal/vibrant-trendy 受影响(显式 shadow);其余预设 `preset.theme.shadow` 为 undefined → 保留当前 shadow,与既有一致。回归 Step 5 验证。
- **存量 `skinPreset` 迁移保真**:`flat`→sharp/none、`elevated`→large/strong 复刻原视觉意图;skinPreset 本就覆盖 radius,迁移覆盖不丢用户可见状态。`normalizeTheme` 仍读 `obj.skinPreset`(字符串键)做迁移,字段从类型/schema 删除不影响迁移。回归 Step 7 验证。
- **server schema 删字段**:`.optional()` 字段移除,旧 payload 多出的 `skinPreset` 键被 Zod 默认 strip(已确认 schema 非 `.strict()`),合法。Task 6 测试覆盖。
- **浮层重构丢 draft**:draft 在组件顶层 `useState`,与 `activeCat` 无关;分类切换不丢。Task 7 测试 + 回归 Step 2 验证。
- **提交卷进暂存区**:每个 task 用 pathspec `git commit -- <files>`,提交后 `git show --stat HEAD` 硬校验只含预期文件;不符则 `git reset --soft HEAD~1` 重来。
