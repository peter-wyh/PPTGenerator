# 业绩看板·指标数值颜色限定为黑/白/品牌色 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把业绩看板（`kpi-board`）指标数值的拾色器从 5 色（默认/绿/橙/红/蓝）收窄为 黑/白/品牌色 三项，旧色保留渲染、不再可选。

**Architecture:** 扩充 `KpiColorToken` 联合类型 + `KPI_COLOR_TOKENS` 映射表（新增 `black`/`white`/`brand` 三条），把可选项数组 `KPI_COLOR_OPTIONS` 替换为这三项。旧 5 个 token 保留在类型与映射表中以渲染历史数据、避免崩溃；渲染端 `KpiBoard.tsx` 的 token→`fg` 解析对任意 token 通用，无需改动。

**Tech Stack:** TypeScript + React + Tailwind + Vitest（jsdom）。`@mediakit/shared` 以源码（`./src/index.ts`）被 apps/web 直接消费，无需构建。

**Spec:** `docs/superpowers/specs/2026-07-15-kpi-value-color-black-white-brand-design.md`

**执行环境提示：** 项目约定在 worktree 里隔离特性开发（见记忆 isolate-feature-work-in-worktree / worktree-broken-head-snapshot-baseline）。执行前可用 superpowers:using-git-worktrees 建工作树；改动仅 3 文件，亦可直接在 main 上做。所有 `pnpm` 命令须在 `apps/web` 下用绝对路径执行（记忆 web-vitest-run-from-root）。

---

## File Structure

| 文件 | 责任 | 动作 |
|---|---|---|
| `packages/shared/src/types/editor.ts` | `KpiColorToken` 联合类型（持久化 schema） | 追加 `black`/`white`/`brand` |
| `apps/web/src/editor/kpiTokens.ts` | token→CSS 映射 + 可选项数组 | 加 3 条映射；`KPI_COLOR_OPTIONS` 替换为 3 项 |
| `apps/web/src/editor/property-panel/custom-fields.tsx` | 拾色器色块渲染 | 未选中色块边框 `border-transparent`→`border-black/10`（白色可见） |
| `apps/web/tests/kpi-tokens.test.ts` | token 映射与可选项的单测 | 改断言为 3 项 + 新映射 |

不改动：`KpiBoard.tsx`（解析通用）、`custom-fields/KpiRowStyleField.tsx`（死代码副本，导入同一常量自动收窄）、server Zod（`components: z.any()`）。

颜色映射沿用代码库既有约定（`BasicComponents.tsx:425,458,554`）：`black`→`#000000`、`white`→`#fff`、`brand`→`var(--color-primary)`。

---

### Task 1: 收窄调色板为黑/白/品牌色（TDD）

**Files:**
- Modify: `apps/web/tests/kpi-tokens.test.ts`（全文替换）
- Modify: `packages/shared/src/types/editor.ts:556`
- Modify: `apps/web/src/editor/kpiTokens.ts:9-23`

- [ ] **Step 1: 写失败测试** — 全文替换 `apps/web/tests/kpi-tokens.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { KPI_COLOR_TOKENS, KPI_COLOR_OPTIONS, resolveKpiColor } from '@/editor/kpiTokens';

describe('kpiTokens', () => {
  it('旧 token 仍有 fg 与 softBg（历史数据继续渲染，不再出现在拾色器）', () => {
    for (const token of ['primary', 'success', 'warning', 'danger', 'info'] as const) {
      const c = KPI_COLOR_TOKENS[token];
      expect(typeof c.fg).toBe('string');
      expect(c.fg.length).toBeGreaterThan(0);
      expect(c.softBg).toMatch(/color-mix|^#/);
    }
  });

  it('黑/白/品牌色 token 映射到既有约定的 CSS 值', () => {
    expect(KPI_COLOR_TOKENS.black.fg).toBe('#000000');
    expect(KPI_COLOR_TOKENS.white.fg).toBe('#fff');
    expect(KPI_COLOR_TOKENS.brand.fg).toBe('var(--color-primary)');
    for (const token of ['black', 'white', 'brand'] as const) {
      expect(KPI_COLOR_TOKENS[token].softBg).toMatch(/color-mix/);
    }
  });

  it('resolveKpiColor 缺省/null 回退 primary', () => {
    expect(resolveKpiColor(undefined)).toEqual(KPI_COLOR_TOKENS.primary);
    expect(resolveKpiColor(null)).toEqual(KPI_COLOR_TOKENS.primary);
    expect(resolveKpiColor('success')).toEqual(KPI_COLOR_TOKENS.success);
  });

  it('KPI_COLOR_OPTIONS 仅露出 黑/白/品牌色', () => {
    expect(KPI_COLOR_OPTIONS.map((o) => o.token)).toEqual(['black', 'white', 'brand']);
  });
});
```

- [ ] **Step 2: 跑测试，确认失败** — 在 `apps/web` 下：

Run: `pnpm test tests/kpi-tokens.test.ts`
Expected: FAIL — `KPI_COLOR_OPTIONS` 仍是 5 个旧 token（断言期望 `['black','white','brand']`），且 `KPI_COLOR_TOKENS.black` 为 `undefined`（访问 `.fg` 抛 TypeError）。

- [ ] **Step 3: 扩充类型** — 修改 `packages/shared/src/types/editor.ts:556`，把单行联合改为多行并追加三 token（旧五个保留）：

```ts
export type KpiColorToken =
  | 'primary' | 'success' | 'warning' | 'danger' | 'info'
  | 'black' | 'white' | 'brand';
```

- [ ] **Step 4: 更新映射表与可选项** — 修改 `apps/web/src/editor/kpiTokens.ts`。

`KPI_COLOR_TOKENS`（第 9-15 行）在旧 5 条之后追加 3 条：

```ts
export const KPI_COLOR_TOKENS: Record<KpiColorToken, { fg: string; softBg: string }> = {
  primary: { fg: 'var(--foreground-primary)', softBg: 'color-mix(in srgb, var(--foreground-muted) 12%, transparent)' },
  success: { fg: 'var(--green)',   softBg: 'color-mix(in srgb, var(--green) 12%, transparent)' },
  warning: { fg: 'var(--yellow)',  softBg: 'color-mix(in srgb, var(--yellow) 12%, transparent)' },
  danger:  { fg: 'var(--red)',     softBg: 'color-mix(in srgb, var(--red) 12%, transparent)' },
  info:    { fg: 'var(--blue)',    softBg: 'color-mix(in srgb, var(--blue) 12%, transparent)' },
  black:   { fg: '#000000',        softBg: 'color-mix(in srgb, #000000 12%, transparent)' },
  white:   { fg: '#fff',           softBg: 'color-mix(in srgb, #fff 12%, transparent)' },
  brand:   { fg: 'var(--color-primary)', softBg: 'color-mix(in srgb, var(--color-primary) 12%, transparent)' },
};
```

`KPI_COLOR_OPTIONS`（第 17-23 行）替换为 3 项：

```ts
export const KPI_COLOR_OPTIONS: { token: KpiColorToken; label: string }[] = [
  { token: 'black', label: '黑色' },
  { token: 'white', label: '白色' },
  { token: 'brand', label: '品牌色' },
];
```

- [ ] **Step 5: 跑测试，确认通过** — 在 `apps/web` 下：

Run: `pnpm test tests/kpi-tokens.test.ts`
Expected: PASS（4 个 it 全过）。

- [ ] **Step 6: 提交**

```bash
git add packages/shared/src/types/editor.ts apps/web/src/editor/kpiTokens.ts apps/web/tests/kpi-tokens.test.ts
git commit -m "$(cat <<'EOF'
feat(web): kpi-board 指标数值颜色限定为黑/白/品牌色

KPI_COLOR_OPTIONS 收窄为 black/white/brand 三项；旧 5 token 保留在
KpiColorToken 与 KPI_COLOR_TOKENS 中以渲染历史数据、避免崩溃。

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 白色色块在浅色面板上可见

新增白色后，未选中色块当前是 `border-transparent`，白色在浅色面板上不可见。给未选中色块加极淡常驻边框。

**Files:**
- Modify: `apps/web/src/editor/property-panel/custom-fields.tsx:391-393`

- [ ] **Step 1: 改色块未选中态边框** — 把第 391-393 行的 className 中 `'border-transparent'` 改为 `'border-black/10'`：

```tsx
                  className={`h-4 w-4 rounded-full border ${
                    color === opt.token ? 'border-foreground-primary' : 'border-black/10'
                  }`}
```

> 仅这一处改动；选中态 `border-foreground-primary` 不变，toggle 写入/清空逻辑不变。

- [ ] **Step 2: 类型检查 + 跑测试确认无回归** — 在 `apps/web` 下：

Run: `pnpm typecheck && pnpm test`
Expected: typecheck 0 error；测试全过。

- [ ] **Step 3: 手测（dev server）** — 启动 `pnpm dev`，打开一个 kpi-board 组件的属性面板「✏️ 内容」区，逐行点黑/白/品牌色色块，确认：三个色块都可见（白色块有淡边框）、数值文字色随之变为黑/白/品牌色、再次点击已选中色块可清空回默认。

> 注意记忆 dev-server-cwd-may-be-worktree：看效果前先 `lsof -p <PID> | grep cwd` 确认 dev server 跑在哪个目录，避免看到 stale 旧版。

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/editor/property-panel/custom-fields.tsx
git commit -m "$(cat <<'EOF'
style(web): kpi 色块未选中态加淡边框，保证白色可见

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 全量验证

**Files:** 无改动，仅验证。

- [ ] **Step 1: 全量单测** — 在 `apps/web` 下：

Run: `pnpm test`
Expected: 全部通过（含 kpi-tokens、editor.kpi-board、registry、palette 等套件）。重点关注是否有套件断言了旧 5 色拾色器内容而失败——若有，按 spec 同样原则（旧色保留渲染、拾色器只露 3 色）修正断言。

- [ ] **Step 2: 全量类型检查** — 在 `apps/web` 下：

Run: `pnpm typecheck`
Expected: 0 error。`@mediakit/shared` 以源码被消费，`KpiColorToken` 扩充会被 apps/web 的 tsc 直接校验。

- [ ] **Step 3（可选，双保险）: shared 自身类型检查** — 在 `packages/shared` 下：

Run: `pnpm typecheck`
Expected: 0 error（类型改动为纯追加联合成员，不应破坏 shared 自身编译）。

---

## Self-Review

**1. Spec coverage:**
- 拾色器仅露黑/白/品牌色 → Task 1 Step 4（`KPI_COLOR_OPTIONS` 替换）。
- 颜色映射 black=`#000000`/white=`#fff`/brand=`var(--color-primary)` → Task 1 Step 4（`KPI_COLOR_TOKENS` 加 3 条），与既有 `BasicComponents.tsx` 约定一致。
- 旧色保留渲染、不可选 → Task 1 Step 3/4（旧 token 留在类型+映射表，仅从 options 摘掉）+ 测试「旧 token 仍有 fg 与 softBg」。
- 白色色块可见 → Task 2。
- 测试更新 → Task 1 Step 1。
- 不改 server Zod / KpiBoard.tsx → File Structure 已声明，Task 3 验证无回归。
- 无缺口。

**2. Placeholder scan:** 无 TBD/TODO；每步含完整代码或确切命令与预期输出。

**3. Type consistency:** `KpiColorToken` 在 Task 1 Step 3 定义 `black|white|brand`；Task 1 Step 4 的 `KPI_COLOR_TOKENS: Record<KpiColorToken,...>` 与 `KPI_COLOR_OPTIONS: {token: KpiColorToken,...}` 引用一致；测试用同名 token 字面量。无命名漂移。
