# 策略块：高亮工具栏化 + 卡片列表多卡网格 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 strategy-block 的高亮从「全局高亮词字段」改为「富文本工具栏内联 `<mark>`」；把「卡片列表」(bulleted) 变体重写为多卡网格（每行一张卡 = 图标+标题+正文）。

**Architecture:** 高亮 `<mark>` 作为受限 HTML 内联标签持久化进 `rows[i][2]` 正文，渲染端只做 `sanitizeRichText`（不再按词包 span）。富文本工具栏新增「高亮」按钮做选区 `<mark>` 包裹/解包。卡片列表渲染从「header + bullet 列表」改为 `grid-cols-2` 卡片网格。`StrategyBlockData.highlights` 类型字段**保留为可选未用**（避免破坏重构期死代码的 typecheck）。

**Tech Stack:** React 18 + TypeScript + Vite + Vitest(jsdom) + Tailwind；图标 `@phosphor-icons/react`（已在 `icons/catalog.ts` 使用）；富文本走自研 `sanitizeRichText` 白名单清洗。

**关键事实（避免改错文件）：**
- **live 链路**：`Editor.tsx → ./property-panel → property-panel/PropertyPanel.tsx(158 行) → flat custom-fields.tsx`。
- live 富文本控件 = `property-panel/fields.tsx` 的 `RichTextField`（line 200）。
- live strategy-block 编辑器 = `property-panel/custom-fields.tsx` 的 `StrategyBlockFields`（line 437）。
- **死代码（不动）**：root `editor/PropertyPanel.tsx`、`property-panel/custom-fields/StrategyBlockFields.tsx`、`property-panel/fields/RichTextField.tsx`。它们仍引用 `highlights`，故类型字段保留。

---

## File Structure

| 文件 | 责任 | 本计划改动 |
|---|---|---|
| `apps/web/src/editor/richText.ts` | 富文本白名单清洗 | `ALLOWED_TAGS` 加 `MARK` |
| `apps/web/src/index.css` | 全局样式 / 设计 token | 加 `mark {}` 染色规则 |
| `apps/web/src/editor/property-panel/fields.tsx` | live `RichTextField`（line 200） | 去 `highlights` 入参；加高亮按钮 + `toggleHighlight`；同步改 `sanitizeRichText` |
| `apps/web/src/editor/property-panel/custom-fields.tsx` | live `StrategyBlockFields`（line 437） | 删全局高亮词 input；不再传 `highlights` 给 RichTextField |
| `apps/web/src/editor/components/report/StrategyBlock.tsx` | 3 变体渲染器 | 内容渲染改 `sanitizeRichText`；重写 `StrategyBulleted` 为多卡网格 |
| `apps/web/src/editor/defaults.ts` | 组件默认数据 | strategy-block 默认数据去 `highlights`、样例正文内嵌 `<mark>` |
| `apps/web/tests/richText.test.ts` | sanitize 单测 | 加 `<mark>` 保留用例 |
| `apps/web/tests/editor.strategy-block.test.tsx` | 渲染断言 | 去 highlights、翻转 bulleted、`<mark>` 断言 |
| `apps/web/tests/editor.strategy-panel.test.tsx` | 面板断言 | 去 highlights 字段用例、加高亮按钮用例 |
| `packages/shared/src/types/editor.ts` | 类型 | **不动**（`highlights?` 保留） |

---

## Task 1: sanitizer 放行 `<mark>` + 全局 `mark` 样式

**Files:**
- Modify: `apps/web/src/editor/richText.ts`（`ALLOWED_TAGS`，line 10）
- Modify: `apps/web/src/index.css`（末尾追加）
- Test: `apps/web/tests/richText.test.ts`（`sanitizeRichText` describe 内新增用例）

- [ ] **Step 1: 写失败测试** — 在 `apps/web/tests/richText.test.ts` 的 `describe('sanitizeRichText', ...)` 内（line 42 的 `});` 之前）插入：

```ts
  it('保留 <mark> 高亮标签（去属性）', () => {
    expect(sanitizeRichText('<mark>tips</mark>')).toBe('<mark>tips</mark>');
    expect(sanitizeRichText('<mark class="x" style="color:red">tips</mark>')).toBe('<mark>tips</mark>');
  });
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @mediakit/web test -- richText.test.ts`
Expected: FAIL — `<mark>` 被当非白名单标签 unpack，`sanitizeRichText('<mark>tips</mark>')` 返回 `'tips'`（丢标签）。

- [ ] **Step 3: 放行 MARK** — 编辑 `apps/web/src/editor/richText.ts` line 10：

旧：
```ts
const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'UL', 'OL', 'LI', 'BR', 'P']);
```
新：
```ts
const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'UL', 'OL', 'LI', 'BR', 'P', 'MARK']);
```

- [ ] **Step 4: 全局 mark 样式** — 在 `apps/web/src/index.css` 末尾追加：

```css

/* strategy-block 富文本高亮：内联 <mark> 染色（accent-secondary，复刻旧全局高亮观感）。 */
mark {
  color: var(--accent-secondary);
  font-weight: 500;
  background: transparent;
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm --filter @mediakit/web test -- richText.test.ts`
Expected: PASS（含新增 `<mark>` 用例；既有 `renderHtmlWithHighlights` 用例仍通过——函数保留）。

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/editor/richText.ts apps/web/src/index.css apps/web/tests/richText.test.ts
git commit -m "feat(strategy-block): sanitizer 放行 <mark> + 全局 mark 染色"
```

---

## Task 2: RichTextField 高亮工具栏按钮 + 去掉 highlights 入参

**Files:**
- Modify: `apps/web/src/editor/property-panel/fields.tsx`（import 区 + `RichTextField` line 200–~285）
- Modify: `apps/web/src/editor/property-panel/custom-fields.tsx`（`StrategyBlockFields` line 437–495：删高亮词 input + 去掉 `highlights` prop）
- Test: `apps/web/tests/editor.strategy-panel.test.tsx`

- [ ] **Step 1: 改面板测试（红）** — 编辑 `apps/web/tests/editor.strategy-panel.test.tsx`：

(a) `setStrategyBlock`（line 13–29）去掉 `highlights`：将
```ts
    data: {
      headers: ['图标', '标题', '内容'],
      rows,
      highlights: 'tips',
    } as any,
```
改为
```ts
    data: {
      headers: ['图标', '标题', '内容'],
      rows,
    } as any,
```

(b) 删除 3 个高亮相关用例（line 87–117 整段，即 `it('高亮词输入…', …)`、`it('RichTextField 未聚焦时对命中词渲染高亮 span…', …)`、`it('改高亮词 → 未聚焦的编辑器即时重算高亮…', …)`）。

(c) 在 `describe` 内（删除处）新增按钮存在性用例：
```ts
  it('富文本工具栏渲染「高亮」按钮（title=高亮）', () => {
    setStrategyBlock([['sparkle', 'INSIGHT', 'focus on tips']]);
    render(<PropertyPanel />);
    expect(screen.getByTitle('高亮')).toBeInTheDocument();
  });
```

- [ ] **Step 2: 跑面板测试确认新用例失败**

Run: `pnpm --filter @mediakit/web test -- editor.strategy-panel.test.tsx`
Expected: FAIL — `getByTitle('高亮')` 找不到（按钮尚未加）；其余用例（删除按钮/添加项/sync）通过。

- [ ] **Step 3: 改 RichTextField** — 编辑 `apps/web/src/editor/property-panel/fields.tsx`：

(a) line 9 import 改为只用 sanitize（RichTextField 不再用 `renderHtmlWithHighlights`；该文件内仅 line 218 用过它）：
旧：`import { sanitizeRichText, renderHtmlWithHighlights } from '../richText';`
新：`import { sanitizeRichText } from '../richText';`

(b) 在文件顶部 import 区新增（与既有 import 同区，放在 `../richText` import 附近）：
```ts
import { Highlighter } from '@phosphor-icons/react';
```

(c) 替换整个 `RichTextField` 函数（line 200 起至其 `}` 结束，含 JSDoc）。新内容：

```tsx
/**
 * 轻量富文本字段：toolbar（加粗/斜体/列表/高亮）+ contentEditable。
 * 不受控：挂载/外部 value 变更时以 sanitize 后的 HTML 初始化（仅未聚焦时写回）；onInput/onBlur 时清洗并写回。
 * 高亮：选中文字点「高亮」→ 包 <mark>（持久化进 HTML，渲染由全局 mark 样式染色）；
 *   选区完全覆盖已有 <mark> 再点 → 解包（toggle）。需先选中文本（折叠选区为 no-op）。
 * contentEditable / execCommand / 选区操作在 jsdom 不可用，编辑交互不单测。
 */
export function RichTextField({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // 同步外部 value → contentEditable：仅在未聚焦时写入，避免覆盖正在编辑的光标。
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return; // 聚焦中：不干预编辑。
    const html = sanitizeRichText(value);
    if (el.innerHTML !== html) el.innerHTML = html;
  }, [value]);

  const exec = (cmd: string) => {
    document.execCommand(cmd);
    ref.current?.focus();
  };

  const commit = () => {
    if (!ref.current) return;
    const next = sanitizeRichText(ref.current.innerHTML);
    if (next !== sanitizeRichText(value)) onChange(next);
  };

  // 高亮 toggle：选中文字 → 包 <mark>；选区完全覆盖已有 <mark> → 解包。
  const toggleHighlight = () => {
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return;

    // 收集被选区完全包含的 <mark>；有则全部解包（toggle off）。
    const fullyContained = Array.from(el.querySelectorAll('mark')).filter((m) => {
      const r = document.createRange();
      r.selectNodeContents(m);
      const startOk = range.compareBoundaryPoints(Range.START_TO_START, r) <= 0;
      const endOk = range.compareBoundaryPoints(Range.END_TO_END, r) >= 0;
      return startOk && endOk;
    });
    if (fullyContained.length > 0) {
      for (const m of fullyContained) {
        const parent = m.parentNode;
        if (!parent) continue;
        while (m.firstChild) parent.insertBefore(m.firstChild, m);
        parent.removeChild(m);
      }
    } else {
      const mark = document.createElement('mark');
      try {
        range.surroundContents(mark);
      } catch {
        // 跨节点边界 → extractContents 包进 <mark> 再插回。
        const frag = range.extractContents();
        mark.appendChild(frag);
        range.insertNode(mark);
      }
    }
    sel.removeAllRanges();
    commit();
    el.focus();
  };

  return (
    <div className="rounded border border-border-default">
      <div className="flex items-center gap-1 border-b border-border-subtle px-1 py-0.5">
        <button
          type="button"
          title="加粗"
          onMouseDown={(e) => {
            e.preventDefault();
            exec('bold');
          }}
          className="font-bold px-1.5 text-xs text-foreground-secondary hover:bg-surface-hover rounded"
        >
          B
        </button>
        <button
          type="button"
          title="斜体"
          onMouseDown={(e) => {
            e.preventDefault();
            exec('italic');
          }}
          className="italic px-1.5 text-xs text-foreground-secondary hover:bg-surface-hover rounded"
        >
          I
        </button>
        <button
          type="button"
          title="列表"
          onMouseDown={(e) => {
            e.preventDefault();
            exec('insertUnorderedList');
          }}
          className="px-1.5 text-xs text-foreground-secondary hover:bg-surface-hover rounded"
        >
          •
        </button>
        <button
          type="button"
          title="高亮"
          onMouseDown={(e) => {
            e.preventDefault();
            toggleHighlight();
          }}
          className="flex items-center px-1.5 text-xs text-foreground-secondary hover:bg-surface-hover rounded"
        >
          <Highlighter size={13} weight="fill" />
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={commit}
        onBlur={commit}
        className="min-h-[60px] px-2 py-1 text-xs text-foreground-primary focus:outline-none [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4"
      />
    </div>
  );
}
```

> 注意：保留 `useRef`/`useEffect` 的既有 import（文件顶部已有 `import { useEffect, useRef, useState } from 'react';`）。

- [ ] **Step 4: 改 StrategyBlockFields** — 编辑 `apps/web/src/editor/property-panel/custom-fields.tsx` 的 `StrategyBlockFields`（line 437–495）：

(a) 删除高亮词 input（line 450–459，即 `{/* 全局高亮词… */}` 注释 + 紧随的 `<label>…</label>` 整块）。

(b) `<RichTextField>`（line 482–486）去掉 `highlights` prop：将
```tsx
            <RichTextField
              value={row[2] ?? ''}
              highlights={data.highlights}
              onChange={(html) => setRow(i, [row[0] ?? '', row[1] ?? '', html])}
            />
```
改为
```tsx
            <RichTextField
              value={row[2] ?? ''}
              onChange={(html) => setRow(i, [row[0] ?? '', row[1] ?? '', html])}
            />
```

- [ ] **Step 5: 跑面板测试 + typecheck 确认通过**

Run: `pnpm --filter @mediakit/web test -- editor.strategy-panel.test.tsx`
Expected: PASS（含「高亮」按钮用例）。

Run: `pnpm --filter @mediakit/web typecheck`
Expected: PASS（RichTextField 去掉 `highlights` 入参后，唯一调用方 custom-fields.tsx 已同步去掉该 prop；死代码仍能编译，因类型字段保留）。

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/editor/property-panel/fields.tsx apps/web/src/editor/property-panel/custom-fields.tsx apps/web/tests/editor.strategy-panel.test.tsx
git commit -m "feat(strategy-block): 高亮改为富文本工具栏内联 <mark>，移除全局高亮词字段"
```

---

## Task 3: 渲染器改 sanitizeRichText + 卡片列表多卡网格

**Files:**
- Modify: `apps/web/src/editor/components/report/StrategyBlock.tsx`（import + 3 处内容渲染 + 重写 `StrategyBulleted`）
- Test: `apps/web/tests/editor.strategy-block.test.tsx`

- [ ] **Step 1: 重写渲染测试（红）** — 用以下完整内容替换 `apps/web/tests/editor.strategy-block.test.tsx`：

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StrategyBlockComponent } from '@/editor/components/report';
import type { StrategyBlockData } from '@mediakit/shared';

/* strategy-block 无图表，按 [[web-chart-test-convention]] 断言 shell 文本。 */

const baseRows = [
  ['lightbulb', 'INSIGHT', 'My audience values authenticity.'],
  ['target', 'STRATEGY', 'Focus on practical beauty tips.'],
];
const headers = ['图标', '标题', '内容'];

describe('StrategyBlockComponent variants', () => {
  it('default（无 variant）→ 平铺，两标题都在', () => {
    render(<StrategyBlockComponent data={{ headers, rows: baseRows } as StrategyBlockData} />);
    expect(screen.getByText('INSIGHT')).toBeInTheDocument();
    expect(screen.getByText('STRATEGY')).toBeInTheDocument();
  });

  it('variant:default 显式 → 等同默认', () => {
    render(
      <StrategyBlockComponent data={{ variant: 'default', headers, rows: baseRows } as StrategyBlockData} />,
    );
    expect(screen.getByText('INSIGHT')).toBeInTheDocument();
    expect(screen.getByText('STRATEGY')).toBeInTheDocument();
  });

  it('labeled → 两标题都在', () => {
    render(
      <StrategyBlockComponent data={{ variant: 'labeled', headers, rows: baseRows } as StrategyBlockData} />,
    );
    expect(screen.getByText('INSIGHT')).toBeInTheDocument();
    expect(screen.getByText('STRATEGY')).toBeInTheDocument();
  });

  it('bulleted（卡片列表）→ 每行渲染为独立卡片，标题均在，无项目符号', () => {
    render(
      <StrategyBlockComponent data={{ variant: 'bulleted', headers, rows: baseRows } as StrategyBlockData} />,
    );
    expect(screen.getByText('INSIGHT')).toBeInTheDocument();
    expect(screen.getByText('STRATEGY')).toBeInTheDocument();
    expect(screen.queryByText('•')).not.toBeInTheDocument();
  });

  it('bulleted 单行 → 1 张卡片、标题出现', () => {
    render(
      <StrategyBlockComponent
        data={{ variant: 'bulleted', headers, rows: [baseRows[0]] } as StrategyBlockData}
      />,
    );
    expect(screen.getByText('INSIGHT')).toBeInTheDocument();
  });

  it('default 富文本内容：渲染 <b>', () => {
    const { container } = render(
      <StrategyBlockComponent
        data={{ headers, rows: [['sparkle', 'INSIGHT', 'focus on <b>beauty tips</b>']] } as StrategyBlockData}
      />,
    );
    expect(container.querySelector('b')).not.toBeNull();
  });

  it('default 富文本内容：<ul> 列表渲染', () => {
    const { container } = render(
      <StrategyBlockComponent
        data={{ headers, rows: [['target', 'STRATEGY', '<ul><li>a</li><li>b</li></ul>']] } as StrategyBlockData}
      />,
    );
    expect(container.querySelector('ul')).not.toBeNull();
    expect(container.querySelectorAll('li').length).toBe(2);
  });

  it('default 内联高亮 <mark> 经 sanitize 保留并渲染', () => {
    const { container } = render(
      <StrategyBlockComponent
        data={{ headers, rows: [['sparkle', 'INSIGHT', 'focus on <mark>beauty</mark>']] } as StrategyBlockData}
      />,
    );
    expect(container.querySelector('mark')).not.toBeNull();
  });

  it('bulleted 多行 → 每行一张卡片，grid-cols-2 网格', () => {
    const { container } = render(
      <StrategyBlockComponent
        data={{
          variant: 'bulleted',
          headers,
          rows: [
            ['target', 'ONE', 'item1'],
            ['sparkle', 'TWO', 'item2'],
            ['sparkle', 'THREE', 'item3'],
            ['sparkle', 'FOUR', 'item4'],
          ],
        } as StrategyBlockData}
      />,
    );
    expect(screen.getByText('ONE')).toBeInTheDocument();
    expect(screen.getByText('FOUR')).toBeInTheDocument();
    expect(container.querySelector('.grid-cols-2')).not.toBeNull();
  });
});
```

- [ ] **Step 2: 跑渲染测试确认失败**

Run: `pnpm --filter @mediakit/web test -- editor.strategy-block.test.tsx`
Expected: FAIL — bulleted 用例断言「STRATEGY 出现 / 无 `•`」，但旧 `StrategyBulleted` 把首行当 header、`STRATEGY` 丢弃且产出 `•`；多卡网格用例断言 `ONE`/`FOUR` 都在，旧实现只渲染 header。

- [ ] **Step 3: 改渲染器** — 用以下完整内容替换 `apps/web/src/editor/components/report/StrategyBlock.tsx`：

```tsx
/**
 * StrategyBlockComponent — 策略块：default / labeled / bulleted。
 */
import type { StrategyBlockData } from '@mediakit/shared';
import { findIcon } from '../../icons/catalog';
import { sanitizeRichText } from '../../richText';

export function StrategyBlockComponent({ data }: { data: StrategyBlockData }) {
  const { variant = 'default' } = data;
  if (variant === 'labeled') return <StrategyLabeled data={data} />;
  if (variant === 'bulleted') return <StrategyBulleted data={data} />;
  return <StrategyDefault data={data} />;
}

/** default：平铺，图标 + 深色大写标题 + 正文（<mark> 由全局 CSS 染色）。 */
function StrategyDefault({ data }: { data: StrategyBlockData }) {
  const rows = data.rows ?? [];
  return (
    <div className="flex h-full w-full flex-col gap-3 overflow-auto">
      {rows.map((r, i) => {
        const iconKey = r[0] ?? '';
        const title = r[1] ?? '';
        const content = r[2] ?? '';
        const Icon = findIcon(iconKey)?.Comp;
        return (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              {Icon && <Icon size={16} className="text-secondary" />}
              <span className="text-xs font-semibold uppercase tracking-wide text-foreground-primary">
                {title}
              </span>
            </div>
            <div
              className="text-sm text-foreground-secondary [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_li]:my-0.5 [&_b]:font-semibold [&_strong]:font-semibold"
              dangerouslySetInnerHTML={{ __html: sanitizeRichText(content) }}
            />
          </div>
        );
      })}
    </div>
  );
}

/** labeled（参考#4）：卡片 + 主题色大写标签标题 + 正文 + 块间发丝分隔。 */
function StrategyLabeled({ data }: { data: StrategyBlockData }) {
  const rows = data.rows ?? [];
  return (
    <div className="flex h-full w-full flex-col rounded-xl border border-border-default bg-surface-primary p-4 shadow-sm">
      {rows.map((r, i) => {
        const iconKey = r[0] ?? '';
        const title = r[1] ?? '';
        const content = r[2] ?? '';
        const Icon = findIcon(iconKey)?.Comp;
        return (
          <div key={i} className={`flex flex-col gap-1 ${i > 0 ? 'mt-3 border-t border-border-subtle pt-3' : ''}`}>
            <div className="flex items-center gap-1.5">
              {Icon && <Icon size={16} className="text-secondary" />}
              <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
                {title}
              </span>
            </div>
            <div
              className="text-sm text-foreground-secondary [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_li]:my-0.5 [&_b]:font-semibold [&_strong]:font-semibold"
              dangerouslySetInnerHTML={{ __html: sanitizeRichText(content) }}
            />
          </div>
        );
      })}
    </div>
  );
}

/** bulleted（卡片列表）：每行 = 一张独立卡片（图标+标题+正文），grid-cols-2 网格。 */
function StrategyBulleted({ data }: { data: StrategyBlockData }) {
  const rows = data.rows ?? [];
  if (rows.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-xl border border-border-default bg-surface-primary p-4 shadow-sm text-xs text-foreground-muted">
        策略块
      </div>
    );
  }
  return (
    <div className="grid h-full w-full grid-cols-2 gap-3 overflow-auto">
      {rows.map((r, i) => {
        const iconKey = r[0] ?? '';
        const title = r[1] ?? '';
        const content = r[2] ?? '';
        const Icon = findIcon(iconKey)?.Comp;
        return (
          <div key={i} className="flex flex-col gap-1 rounded-xl border border-border-default bg-surface-primary p-3 shadow-sm">
            <div className="flex items-center gap-1.5">
              {Icon && <Icon size={16} className="text-secondary" />}
              <span className="text-xs font-semibold uppercase tracking-wide text-foreground-primary">
                {title}
              </span>
            </div>
            <div
              className="text-sm text-foreground-secondary [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_li]:my-0.5 [&_b]:font-semibold [&_strong]:font-semibold"
              dangerouslySetInnerHTML={{ __html: sanitizeRichText(content) }}
            />
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: 跑渲染测试确认通过**

Run: `pnpm --filter @mediakit/web test -- editor.strategy-block.test.tsx`
Expected: PASS（全部用例，含 bulleted 翻转后的断言与 `<mark>` 断言）。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/components/report/StrategyBlock.tsx apps/web/tests/editor.strategy-block.test.tsx
git commit -m "feat(strategy-block): 渲染改 sanitizeRichText；卡片列表重写为多卡网格"
```

---

## Task 4: 默认数据去 highlights、样例内嵌 `<mark>`

**Files:**
- Modify: `apps/web/src/editor/defaults.ts`（`case 'strategy-block'`，line 302–311）

- [ ] **Step 1: 改默认数据** — 编辑 `apps/web/src/editor/defaults.ts` 的 strategy-block case：

旧：
```ts
    case 'strategy-block':
      return {
        // variant 缺省 = 'default'（见 StrategyBlockComponent）；此处省略以避开与 PlacementData 的联合类型歧义。
        headers: ['图标', '标题', '内容'],
        rows: [
          ['sparkle', 'INSIGHT', 'My audience values authenticity and practical beauty tips.'],
          ['target', 'STRATEGY', 'Focus on practical beauty tips and authentic product reviews.'],
        ],
        highlights: 'beauty, tips',
      };
```
新：
```ts
    case 'strategy-block':
      return {
        // variant 缺省 = 'default'（见 StrategyBlockComponent）；此处省略以避开与 PlacementData 的联合类型歧义。
        headers: ['图标', '标题', '内容'],
        rows: [
          ['sparkle', 'INSIGHT', 'My audience values authenticity and practical <mark>beauty tips</mark>.'],
          ['target', 'STRATEGY', 'Focus on practical <mark>beauty tips</mark> and authentic product reviews.'],
        ],
      };
```

- [ ] **Step 2: typecheck + 全量测试确认无回归**

Run: `pnpm --filter @mediakit/web typecheck`
Expected: PASS。

Run: `pnpm --filter @mediakit/web test`
Expected: PASS（全量；`editor.gap-components`/`registry`/`strategy-sync`/`report` 等未断言 highlights/`•`/span，应不受影响）。

- [ ] **Step 3: 提交**

```bash
git add apps/web/src/editor/defaults.ts
git commit -m "chore(strategy-block): 默认数据去 highlights，样例正文内嵌 <mark>"
```

---

## Task 5: 整体校验 + 本地预览人工核验

**Files:** 无（仅运行校验 + 截图）

- [ ] **Step 1: 全量 typecheck**

Run: `pnpm --filter @mediakit/web typecheck`
Expected: PASS（含死代码文件——类型字段保留故仍编译）。

- [ ] **Step 2: 全量测试**

Run: `pnpm --filter @mediakit/web test`
Expected: PASS。

- [ ] **Step 3: 确认无 live 代码残留 `data.highlights` / `renderHtmlWithHighlights`（strategy-block 链路）**

Run:
```bash
grep -n "data.highlights\|highlights={" apps/web/src/editor/property-panel/custom-fields.tsx apps/web/src/editor/property-panel/fields.tsx apps/web/src/editor/components/report/StrategyBlock.tsx apps/web/src/editor/defaults.ts
```
Expected: 无输出（live 链路已不再读写 highlights）。
> 死代码（`editor/PropertyPanel.tsx`、`property-panel/custom-fields/StrategyBlockFields.tsx`、`property-panel/fields/RichTextField.tsx`）仍可能出现 `highlights`，属预期、不动。

- [ ] **Step 4: 本地预览人工核验**

dev 已在后台运行（web :5173 / server :4000）。浏览器打开 `http://localhost:5173/login`，用 `admin@mediakit.local` / `admin123` 登录，进任意含 strategy-block 的页面（或拖入一个 strategy-block 组件、切到「卡片列表」变体）：
- 富文本工具栏出现「高亮」按钮（荧光笔图标）；选中正文文字点按钮 → 文字变 accent-secondary 橙色；再选中同段点按钮 → 取消。
- 「卡片列表」变体：每行渲染为独立卡片（图标+标题+正文），不再有 `•` bullet 列表。

如需截图：
```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --no-sandbox --window-size=1440,900 --screenshot=/tmp/strategy-preview.png "http://localhost:5173/login"
```
（登录态需 cookie，截图仅能看登录页；UI 交互建议人工在浏览器核验。）

- [ ] **Step 5: 无新增提交（本任务为校验）** — 若 Step 1–3 全绿、Step 4 人工确认 OK，则实现完成。

---

## 自检（spec 覆盖）

- spec §5 高亮工具栏化 → Task 1（MARK 放行 + CSS）、Task 2（按钮 + 去 highlights 入参/输入）。✓
- spec §6 卡片列表多卡网格 → Task 3（StrategyBulleted 重写）。✓
- spec §4 数据模型（highlights 保留为可选未用，live 不再读写）→ Task 2（编辑器）、Task 3（渲染）、Task 4（默认值）；类型字段不动。✓
- spec §7 服务端 schema 不改（`components: z.array(z.any())` 透传）→ 无任务（已核实）。✓
- spec §8 测试 → Task 1/2/3 内联更新。✓
- 死代码不清理（spec §10）→ 仅类型字段保留以保 typecheck；无清理任务。✓
