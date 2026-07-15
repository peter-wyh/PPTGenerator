# 业绩看板·图标统一显示开关 + 每指标默认图标 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给业绩看板（`kpi-board`）加「统一显示/不显示图标」的全局开关，并让每个指标在未设图标时按指标名智能匹配一个默认图标（仅 `card` 变体消费）。

**Architecture:** 新增纯函数 `defaultIconFor(label)`（关键词→icon catalog key）；`KpiBoardData` 加 `showIcons?: boolean`（缺省 true）；`card` 变体渲染时有效图标 = `icons[i] ?? defaultIconFor(label)`，被开关 gate；属性面板加全局开关按钮 + 逐行图标预览改为显示有效图标。

**Tech Stack:** TypeScript + React + Tailwind + Vitest（jsdom）。`@mediakit/shared` 以源码被 apps/web 直接消费，无需构建。

**Spec:** `docs/superpowers/specs/2026-07-15-kpi-icon-show-hide-toggle-design.md`

**执行环境提示：** 在 `main` 上直接做（用户已确认）。所有 `pnpm` 命令在 `apps/web` 下用绝对路径执行（记忆 web-vitest-run-from-root）。每个提交只 `git add` 本任务列出的文件（用户有并发未提交改动，勿整体 add）。

---

## File Structure

| 文件 | 责任 | 动作 |
|---|---|---|
| `apps/web/src/editor/kpiIcons.ts` | `defaultIconFor(label)` 关键词→默认图标 | 新建 |
| `apps/web/tests/kpi-icons.test.ts` | `defaultIconFor` 单测 | 新建 |
| `packages/shared/src/types/editor.ts` | `KpiBoardData` 加 `showIcons?: boolean` | 改 |
| `apps/web/src/editor/components/report/KpiBoard.tsx` | `card` 变体图标解析（开关 gate + 默认图标） | 改 |
| `apps/web/src/editor/property-panel/custom-fields.tsx` | 全局开关按钮 + 逐行有效图标预览 | 改 |
| `apps/web/tests/editor.kpi-board.test.tsx` | card 变体 showIcons 行为 + 开关交互测试 | 改 |

不改动：其余 6 个变体（不渲染图标）、server Zod（`components: z.any()`）、`defaults.ts`（已有种子图标，作显式覆盖）。

---

### Task 1: `defaultIconFor` 智能默认图标（TDD）

**Files:**
- Create: `apps/web/src/editor/kpiIcons.ts`
- Create: `apps/web/tests/kpi-icons.test.ts`

- [ ] **Step 1: 写失败测试** — 新建 `apps/web/tests/kpi-icons.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { defaultIconFor } from '@/editor/kpiIcons';

describe('defaultIconFor', () => {
  it('金额类 → currency', () => {
    expect(defaultIconFor('GMV')).toBe('currency');
    expect(defaultIconFor('Spend')).toBe('currency');
    expect(defaultIconFor('AOV')).toBe('currency');
    expect(defaultIconFor('sales')).toBe('currency');
  });

  it('曝光/浏览类 → eye', () => {
    expect(defaultIconFor('Impressions')).toBe('eye');
    expect(defaultIconFor('曝光')).toBe('eye');
  });

  it('点击类 → target', () => {
    expect(defaultIconFor('Clicks')).toBe('target');
    expect(defaultIconFor('点击')).toBe('target');
  });

  it('比率类 → percent', () => {
    expect(defaultIconFor('CVR')).toBe('percent');
    expect(defaultIconFor('CTR')).toBe('percent');
    expect(defaultIconFor('ROAS')).toBe('percent');
  });

  it('转化/销量类 → cart', () => {
    expect(defaultIconFor('Conversions')).toBe('cart');
    expect(defaultIconFor('销量')).toBe('cart');
  });

  it('粉丝/互动类 → users / heart', () => {
    expect(defaultIconFor('粉丝数')).toBe('users');
    expect(defaultIconFor('点赞')).toBe('heart');
  });

  it('未知指标回退 target', () => {
    expect(defaultIconFor('自定义指标 X')).toBe('target');
  });
});
```

- [ ] **Step 2: 跑测试，确认失败** — 在 `apps/web` 下：

Run: `pnpm test tests/kpi-icons.test.ts`
Expected: FAIL — 模块 `@/editor/kpiIcons` 不存在（导入解析失败）。

- [ ] **Step 3: 实现** — 新建 `apps/web/src/editor/kpiIcons.ts`：

```ts
// kpi-board 默认图标：按指标名关键词匹配 catalog key。纯字符串匹配，无外部依赖。

interface Rule {
  re: RegExp;
  icon: string;
}

// 顺序敏感：先 cart 再 currency，避免「销量」误判为金额；sales→currency、销量→cart 分开。
// percent 规则只用「率」，避免「环比/对比」里的「比」误匹配。
const RULES: Rule[] = [
  { re: /转化|conversion|convert|order|订单|purchase|购买|销量|成交|cart/i, icon: 'cart' },
  { re: /曝光|impression|view|reach|展示|观看|播放|play/i, icon: 'eye' },
  { re: /点击|click|tap/i, icon: 'target' },
  { re: /粉丝|follower|fan|关注|受众|audience/i, icon: 'users' },
  { re: /点赞|like|heart|互动|engagement/i, icon: 'heart' },
  { re: /分享|share/i, icon: 'share' },
  { re: /评论|comment|chat/i, icon: 'chat' },
  { re: /roas|roi|cvr|ctr|rate|ratio|率/i, icon: 'percent' },
  { re: /gmv|revenue|sales|销售|commission|spend|cost|aov|收入|营收|佣金|花费|消耗|客单|金额|预算|投放|费用|成本/i, icon: 'currency' },
  { re: /增长|trend|上升|growth/i, icon: 'trend-up' },
  { re: /达成|trophy|完成/i, icon: 'trophy' },
  { re: /热度|hot|fire|热门/i, icon: 'fire' },
];

const FALLBACK = 'target';

/** 按指标名返回默认图标 catalog key；无匹配回退 'target'。 */
export function defaultIconFor(label: string): string {
  for (const { re, icon } of RULES) {
    if (re.test(label)) return icon;
  }
  return FALLBACK;
}
```

- [ ] **Step 4: 跑测试，确认通过** — 在 `apps/web` 下：

Run: `pnpm test tests/kpi-icons.test.ts`
Expected: PASS（全部 it 通过）。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/kpiIcons.ts apps/web/tests/kpi-icons.test.ts
git commit -m "$(cat <<'EOF'
feat(web): kpi-board 默认图标 defaultIconFor（按指标名关键词匹配）

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `showIcons` 字段 + card 变体渲染（TDD）

**Files:**
- Modify: `packages/shared/src/types/editor.ts`（`KpiBoardData`，约 :567）
- Modify: `apps/web/src/editor/components/report/KpiBoard.tsx`（card 变体，约 :163-167；顶部派生值）
- Modify: `apps/web/tests/editor.kpi-board.test.tsx`（替换 :43-49 的测试）

- [ ] **Step 1: 写失败测试** — 在 `apps/web/tests/editor.kpi-board.test.tsx` 中，把第 43-49 行的 `it('无图标时不渲染图标块（无 svg）', ...)` **整块替换**为下面两个测试：

替换前（删掉）：
```tsx
  it('无图标时不渲染图标块（无 svg）', () => {
    const { container } = render(
      <KpiBoard data={{ variant: 'card', headers: ['指标', '数值', '对比'], rows: [['Sales', '$1.24M', '']] }} />,
    );
    expect(screen.getByText('$1.24M')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
  });
```

替换后（新增两个测试）：
```tsx
  it('showIcons:false 时即使有显式 icons 也不渲染图标', () => {
    const { container } = render(
      <KpiBoard
        data={{
          variant: 'card',
          showIcons: false,
          headers: ['指标', '数值', '对比'],
          rows: [['Sales', '$1.24M', '']],
          icons: ['currency'],
        }}
      />,
    );
    expect(screen.getByText('$1.24M')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('showIcons 缺省(true) 且无 icons 时渲染默认图标', () => {
    const { container } = render(
      <KpiBoard data={{ variant: 'card', headers: ['指标', '数值', '对比'], rows: [['GMV', '$1.24M', '']] }} />,
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });
```

- [ ] **Step 2: 跑测试，确认失败** — 在 `apps/web` 下：

Run: `pnpm test tests/editor.kpi-board.test.tsx`
Expected: FAIL —
- `showIcons:false` 用例：当前代码无视 `showIcons`，`icons:['currency']` 仍渲染 svg → `querySelector('svg')` 非 null，`toBeNull()` 失败。
- `showIcons 缺省 且无 icons` 用例：当前代码无 icons → 无 svg → `toBeTruthy()` 失败。

（`showIcons` 字段尚未定义，TypeScript 会报 `Object literal may only specify known properties`；这也算失败信号。）

- [ ] **Step 3: 给类型加字段** — 修改 `packages/shared/src/types/editor.ts` 的 `KpiBoardData`，在 `icons` 字段下方（约 :567 后）加一行：

```ts
  /** 卡片变体是否统一显示图标；缺省 true（显示）。false 时所有行图标统一隐藏。 */
  showIcons?: boolean;
```

- [ ] **Step 4: 改 card 变体渲染** — 修改 `apps/web/src/editor/components/report/KpiBoard.tsx`。

4a. 顶部 import（第 7 行附近，已有 kpiTokens import 旁）加：

```ts
import { defaultIconFor } from '../../kpiIcons';
```

4b. 在函数体顶部派生值区（`const hidden = new Set(data.hiddenIndices ?? []);` 下一行）加：

```ts
  const showIcons = data.showIcons !== false;
```

4c. card 变体内（约 :167）把这一行：

```ts
          const Icon = findIcon(data.icons?.[i] ?? undefined)?.Comp;
```

改为：

```ts
          const Icon = showIcons ? findIcon((data.icons?.[i] ?? defaultIconFor(it.label)) ?? undefined)?.Comp : undefined;
```

- [ ] **Step 5: 跑测试，确认通过** — 在 `apps/web` 下：

Run: `pnpm test tests/editor.kpi-board.test.tsx`
Expected: PASS（含两个新测试 + 既有测试，含 line 28-41 的显式图标用例仍过）。

- [ ] **Step 6: 提交**

```bash
git add packages/shared/src/types/editor.ts apps/web/src/editor/components/report/KpiBoard.tsx apps/web/tests/editor.kpi-board.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): kpi-board card 变体 showIcons 开关 + 默认图标渲染

showIcons 缺省 true；false 时统一不显示图标。无显式图标时按
defaultIconFor(label) 回退默认图标。

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 属性面板全局开关 + 逐行有效图标预览（TDD）

**Files:**
- Modify: `apps/web/src/editor/property-panel/custom-fields.tsx`（`KpiRowStyleField`，约 :334-396）
- Modify: `apps/web/tests/editor.kpi-board.test.tsx`（`KpiRowStyleField` describe，约 :271 后）

- [ ] **Step 1: 写失败测试** — 在 `apps/web/tests/editor.kpi-board.test.tsx` 的 `describe('KpiRowStyleField', ...)` 块内，最后一个测试（`点色块写入 valueColors[i]`）之后、块的闭合 `});`（:272）之前，加：

```tsx
  it('全局开关切换 showIcons', () => {
    const store = useEditorStore.getState();
    store.addComponent('kpi-board');
    const id = store.currentComponents()[0].id;
    store.select(id);
    render(
      <MemoryRouter>
        <PropertyPanel />
      </MemoryRouter>,
    );
    // 默认显示图标（showIcons 缺省 true）
    const toggle = screen.getByRole('button', { name: '显示图标' });
    fireEvent.click(toggle);
    const data = useEditorStore.getState().currentComponents()[0].data as KpiBoardData;
    expect(data.showIcons).toBe(false);
    expect(screen.getByRole('button', { name: '已隐藏' })).toBeInTheDocument();
  });
```

- [ ] **Step 2: 跑测试，确认失败** — 在 `apps/web` 下：

Run: `pnpm test tests/editor.kpi-board.test.tsx`
Expected: FAIL — 找不到 `button` with name `显示图标`（`getByRole` 抛 Unable to find）。

- [ ] **Step 3: 实现 UI** — 修改 `apps/web/src/editor/property-panel/custom-fields.tsx` 的 `KpiRowStyleField`。

3a. import 区（第 31 行附近，已有 `from '../kpiTokens'` 旁）加：

```ts
import { defaultIconFor } from '../kpiIcons';
```

3b. 函数体内（`const weight: IconWeight = data.iconWeight ?? 'regular';` 下一行，约 :340 后）加：

```ts
  const showIcons = data.showIcons !== false;
```

3c. 把 FieldGroup 内的提示语那行（约 :360-361）：

```tsx
      <div className="text-[11px] text-foreground-muted">图标仅在「卡片」变体下显示。</div>
```

替换为带开关的一行：

```tsx
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-foreground-muted">图标仅在「卡片」变体下显示；关闭后统一不显示</span>
        <button
          type="button"
          onClick={() => update('showIcons', !showIcons)}
          className={`rounded border px-2 py-0.5 text-[11px] font-medium ${
            showIcons ? 'border-foreground-primary text-foreground-primary' : 'border-border-default text-foreground-muted'
          }`}
        >
          {showIcons ? '显示图标' : '已隐藏'}
        </button>
      </div>
```

3d. 逐行图标按钮显示有效图标。把 `rows.map` 回调开头的图标解析（约 :363-364）：

```tsx
        const iconKey = icons[i] ?? null;
        const Icon = findIcon(iconKey ?? undefined)?.Comp;
```

改为：

```tsx
        const iconKey = icons[i] ?? null;
        const effectiveIcon = iconKey ?? defaultIconFor(r[0] ?? `行${i + 1}`);
        const Icon = findIcon(effectiveIcon)?.Comp;
```

并把图标按钮内的渲染（约 :375）：

```tsx
              {Icon ? <Icon size={16} /> : <span className="text-[10px] text-foreground-muted">+</span>}
```

改为（加 `weight`，与渲染层一致）：

```tsx
              {Icon ? <Icon size={16} weight={weight} /> : <span className="text-[10px] text-foreground-muted">+</span>}
```

> 「清除」按钮（`{iconKey && ...}`）保持不变 —— 仅当用户设过自定义图标（`iconKey` 非空）时出现，点击 `setIcon(i, null)` 恢复默认。`title` 属性保持原样即可。

- [ ] **Step 4: 跑测试，确认通过** — 在 `apps/web` 下：

Run: `pnpm test tests/editor.kpi-board.test.tsx`
Expected: PASS（含新开关测试 + 既有 KpiRowStyleField 测试）。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/property-panel/custom-fields.tsx apps/web/tests/editor.kpi-board.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): kpi-board 属性面板加「显示图标」全局开关 + 逐行有效图标预览

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: 全量验证

**Files:** 无改动，仅验证。

- [ ] **Step 1: 全量单测** — 在 `apps/web` 下：

Run: `pnpm test`
Expected: 全部通过（含 kpi-icons、editor.kpi-board 等套件）。

- [ ] **Step 2: 全量类型检查** — 在 `apps/web` 下：

Run: `pnpm typecheck`
Expected: 0 error。

- [ ] **Step 3: 手测（可选）** — `pnpm dev`，插入 kpi-board：
  - 属性面板「卡片样式（每行）」顶部出现「显示图标/已隐藏」开关；切换后 card 变体图标统一显/隐。
  - 逐行图标按钮显示有效图标；点开可覆盖；「清除」恢复默认。
  - 新看板（defaults 种子图标）各行图标正常；切到非 card 变体无图标。

> 注意记忆 dev-server-cwd-may-be-worktree：看效果前先 `lsof -p <PID> | grep cwd` 确认 dev server 跑在哪个目录。

---

## Self-Review

**1. Spec coverage:**
- `KpiBoardData.showIcons?: boolean` → Task 2 Step 3。
- `defaultIconFor(label)` 新文件 + 关键词表 → Task 1 Step 3。
- card 变体渲染 gate + 默认图标（有效图标 = `icons[i] ?? defaultIconFor(label)`） → Task 2 Step 4。
- 属性面板全局开关 → Task 3 Step 3c。
- 逐行有效图标预览 + 「清除」恢复默认 → Task 3 Step 3d。
- `showIcons` 缺省 true（向后兼容） → Task 2 Step 4b（`data.showIcons !== false`）。
- 仅 card 变体 → 不改其余变体（File Structure 已声明）。
- server schema 不改 → File Structure 已声明。
- 测试：`defaultIconFor` 单测（Task 1）、card 渲染 showIcons 行为（Task 2）、开关交互（Task 3）。
- 无缺口。

**2. Placeholder scan:** 无 TBD/TODO；每步含完整代码或确切命令与预期输出。

**3. Type consistency:** `showIcons` 在 Task 2 定义、Task 3 使用一致；`defaultIconFor` 在 Task 1 定义、Task 2/3 import 一致（`../../kpiIcons` from report、`../kpiIcons` from property-panel）；`update('showIcons', ...)` 与既有 `update('icons', ...)` 签名一致；测试用的 `KpiBoardData.showIcons` 字段名与类型定义一致。无命名漂移。
