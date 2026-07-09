# strategy-block 内容富文本化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `strategy-block` 每一项的内容从纯文本升级为轻量富文本（加粗、斜体、无序列表、换行），不引入第三方库。

**Architecture:** 内容仍以受限 HTML 字符串存储在现有 `rows[i][2]`（`StrategyBlockData` 结构零改动 → 向后兼容、无需迁移、无需改服务端 schema）。新增两个纯函数 `sanitizeRichText`（白名单清洗）与 `renderHtmlWithHighlights`（清洗 + 高亮词作用于文本节点）；渲染层 3 个变体改用它们；属性面板新增 `RichTextField`（contentEditable + toolbar）与 `StrategyBlockFields` 专属编辑器。

**Tech Stack:** React、TypeScript、Tailwind（arbitrary variant 给富文本列表样式）、`document.execCommand`（免依赖）、Vitest + jsdom + @testing-library/react。

**执行前提：** 用 `superpowers:using-git-worktrees` 建隔离 worktree 后再执行（用户环境多并发 feature + IDE 会重置 git index）。每个 task 一次原子 commit，只 `git add` 该 task 涉及的具体文件。

**关键不变量：**
- `ComponentType` 不新增/不改名（持久化兼容）。
- `StrategyBlockData` 结构不改（`rows: string[][]` 第三列仍是 `string`，仅语义从纯文本 → 受限 HTML）。
- 服务端 schema 不改（`projects.schema.ts` 的 `components` 是 `z.array(z.any())` 透传）。
- 旧项目数据（纯文本 content）自动兼容：经 `sanitizeRichText` 后原样输出。

---

## File Structure

| 文件 | 责任 | 动作 |
|---|---|---|
| `apps/web/src/editor/richText.ts` | 纯函数 `sanitizeRichText` + `renderHtmlWithHighlights`（含内部 helpers） | 新建 |
| `apps/web/tests/richText.test.ts` | 上述纯函数的单测 | 新建 |
| `apps/web/src/editor/components/ReportComponents.tsx` | strategy-block 3 变体内容渲染接入富文本；移除已死的 `renderHighlighted` | 改 |
| `apps/web/src/editor/PropertyPanel.tsx` | 新增 `RichTextField` + `StrategyBlockFields`；分发到 strategy-block | 改 |
| `apps/web/src/editor/registry.tsx` | `strategy-block` 的 `propertySchema` 去掉 `table` 字段 | 改 |
| `apps/web/tests/editor.strategy-block.test.tsx` | 确认现有 6 用例不破 + 新增富文本渲染用例 | 改 |
| `packages/shared/src/index.ts` | `StrategyBlockData` 注释（说明 content 为受限 HTML） | 改 |

---

## Task 1: sanitizeRichText 纯函数（TDD）

**Files:**
- Create: `apps/web/src/editor/richText.ts`
- Test: `apps/web/tests/richText.test.ts`

- [ ] **Step 1: 写失败测试（新建 `apps/web/tests/richText.test.ts`）**

```ts
import { describe, it, expect } from 'vitest';
import { sanitizeRichText } from '@/editor/richText';

describe('sanitizeRichText', () => {
  it('纯文本原样返回', () => {
    expect(sanitizeRichText('focus on tips')).toBe('focus on tips');
  });

  it('保留白名单标签', () => {
    expect(sanitizeRichText('<b>bold</b>')).toBe('<b>bold</b>');
    expect(sanitizeRichText('<i>i</i><strong>s</strong><em>e</em>')).toBe('<i>i</i><strong>s</strong><em>e</em>');
    expect(sanitizeRichText('<ul><li>a</li></ul>')).toBe('<ul><li>a</li></ul>');
    expect(sanitizeRichText('<p>p</p>')).toBe('<p>p</p>');
  });

  it('移除白名单标签上的所有属性', () => {
    expect(sanitizeRichText('<b style="color:red" class="x">b</b>')).toBe('<b>b</b>');
    expect(sanitizeRichText('<p class="c" data-x="1">p</p>')).toBe('<p>p</p>');
  });

  it('非白名单标签 unpack（保留文本，丢标签）', () => {
    expect(sanitizeRichText('<a href="x">click</a>')).toBe('click');
    expect(sanitizeRichText('<span style="color:red">s</span>')).toBe('s');
  });

  it('div（contentEditable 换行产物）unpack 并补 <br> 保留换行', () => {
    expect(sanitizeRichText('<div>line1<br>line2</div>')).toBe('line1<br>line2<br>');
  });

  it('危险标签连同内容整体移除', () => {
    expect(sanitizeRichText('<script>alert(1)</script>safe')).toBe('safe');
    expect(sanitizeRichText('<style>body{}</style>ok')).toBe('ok');
  });

  it('嵌套：外层非白名单、内层白名单', () => {
    expect(sanitizeRichText('<div><b>x</b></div>')).toBe('<b>x</b><br>');
  });

  it('空输入返回空字符串', () => {
    expect(sanitizeRichText('')).toBe('');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm -C apps/web exec vitest run tests/richText.test.ts`
Expected: FAIL（`Failed to resolve import '@/editor/richText'`）

- [ ] **Step 3: 写实现（新建 `apps/web/src/editor/richText.ts`）**

```ts
/**
 * 轻量富文本处理（strategy-block 内容）。
 *
 * 内容以「受限 HTML 字符串」存储于组件 data（如 StrategyBlockData.rows[i][2]）。
 * 仅允许白名单标签、无属性；编辑端 contentEditable 产出的 <div>（换行）
 * 在清洗时补 <br> 以保留换行语义。无第三方依赖。
 */

/** 允许保留的标签（无属性）。 */
const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'UL', 'OL', 'LI', 'BR', 'P']);

/** 连同内容整体移除的标签（避免 script/style 等通过 unpack 泄漏文本或执行）。 */
const DROP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'HEAD', 'META', 'LINK', 'TITLE', 'NOSCRIPT',
  'OBJECT', 'EMBED', 'IFRAME', 'TEMPLATE', 'SVG',
]);

/**
 * 清洗 HTML：白名单内标签去属性；非白名单标签 unpack（保留子节点），
 * 其中 <DIV>（contentEditable 常见换行产物）在 unpack 后补一个 <br>；
 * DROP_TAGS 整体移除。基于 document.createElement（jsdom 兼容，无需 DOMParser）。
 */
export function sanitizeRichText(html: string): string {
  if (!html) return '';
  const root = document.createElement('div');
  root.innerHTML = html;
  cleanNode(root);
  return root.innerHTML;
}

function cleanNode(node: Element): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      const tag = el.tagName;
      if (DROP_TAGS.has(tag)) {
        el.remove();
        continue;
      }
      // 先递归清理子节点（unpack 前确保子节点已干净）。
      cleanNode(el);
      if (ALLOWED_TAGS.has(tag)) {
        // 白名单：移除所有属性，保留标签与已清理的子节点。
        for (const attr of Array.from(el.attributes)) el.removeAttribute(attr.name);
      } else {
        // 非白名单：用子节点 fragment 替换（unpack）。DIV 补 <br>。
        const frag = document.createDocumentFragment();
        while (el.firstChild) frag.appendChild(el.firstChild);
        if (tag === 'DIV') frag.appendChild(document.createElement('br'));
        el.replaceWith(frag);
      }
    } else if (child.nodeType !== Node.TEXT_NODE) {
      // 注释等非文本/元素节点移除。
      child.parentNode?.removeChild(child);
    }
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm -C apps/web exec vitest run tests/richText.test.ts`
Expected: PASS（8 用例全绿）

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/editor/richText.ts apps/web/tests/richText.test.ts
git commit -m "feat(web): add sanitizeRichText for strategy-block content"
```

---

## Task 2: renderHtmlWithHighlights 纯函数（TDD）

**Files:**
- Modify: `apps/web/src/editor/richText.ts`（追加导出）
- Test: `apps/web/tests/richText.test.ts`（追加用例）

- [ ] **Step 1: 追加失败测试（在 `richText.test.ts` 末尾追加）**

```ts
import { renderHtmlWithHighlights } from '@/editor/richText';

describe('renderHtmlWithHighlights', () => {
  it('无高亮词 → 仅清洗', () => {
    expect(renderHtmlWithHighlights('<b>x</b>', '')).toBe('<b>x</b>');
    expect(renderHtmlWithHighlights('<a href="x">click</a>')).toBe('click');
  });

  it('纯文本命中 → 包强调 span', () => {
    expect(renderHtmlWithHighlights('focus on tips', 'tips')).toBe(
      'focus on <span class="text-accent-secondary font-medium">tips</span>',
    );
  });

  it('大小写无关命中', () => {
    expect(renderHtmlWithHighlights('Focus on TIPS', 'tips')).toBe(
      'Focus on <span class="text-accent-secondary font-medium">TIPS</span>',
    );
  });

  it('在富文本标签内的文本节点上高亮（不破坏标签）', () => {
    expect(renderHtmlWithHighlights('<b>big tips</b>', 'tips')).toBe(
      '<b>big <span class="text-accent-secondary font-medium">tips</span></b>',
    );
  });

  it('逗号分隔多词（中英文逗号）', () => {
    const out = renderHtmlWithHighlights('beauty and tips', 'beauty，tips');
    expect(out).toBe(
      '<span class="text-accent-secondary font-medium">beauty</span> and <span class="text-accent-secondary font-medium">tips</span>',
    );
  });

  it('先清洗后高亮：script 被剥离，剩余命中', () => {
    expect(renderHtmlWithHighlights('<script>x</script>tips', 'tips')).toBe(
      '<span class="text-accent-secondary font-medium">tips</span>',
    );
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm -C apps/web exec vitest run tests/richText.test.ts`
Expected: FAIL（`renderHtmlWithHighlights is not exported`）

- [ ] **Step 3: 追加实现（在 `richText.ts` 末尾追加）**

```ts
/**
 * 清洗 HTML 后，在「文本节点」上按高亮词（逗号分隔）切分，命中词包成强调 span。
 * 标签结构不被破坏；正则用捕获组配合 split，分隔（命中）片段保留在结果数组中。
 */
export function renderHtmlWithHighlights(html: string, highlights?: string): string {
  const safe = sanitizeRichText(html);
  const words = (highlights ?? '')
    .split(/[,，]/)
    .map((w) => w.trim())
    .filter(Boolean);
  if (words.length === 0 || !safe) return safe;

  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'i');
  const lower = words.map((w) => w.toLowerCase());

  const root = document.createElement('div');
  root.innerHTML = safe;
  highlightTextNodes(root, re, lower);
  return root.innerHTML;
}

function highlightTextNodes(node: Node, re: RegExp, lower: string[]): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? '';
      if (!text || !re.test(text)) continue;
      const parts = text.split(re);
      const frag = document.createDocumentFragment();
      for (const p of parts) {
        if (!p) continue;
        if (lower.includes(p.toLowerCase())) {
          const span = document.createElement('span');
          span.className = 'text-accent-secondary font-medium';
          span.textContent = p;
          frag.appendChild(span);
        } else {
          frag.appendChild(document.createTextNode(p));
        }
      }
      child.replaceWith(frag);
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      highlightTextNodes(child, re, lower);
    }
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm -C apps/web exec vitest run tests/richText.test.ts`
Expected: PASS（14 用例全绿）

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/editor/richText.ts apps/web/tests/richText.test.ts
git commit -m "feat(web): add renderHtmlWithHighlights"
```

---

## Task 3: 渲染层接入富文本（3 变体 + 移除死代码）

**Files:**
- Modify: `apps/web/src/editor/components/ReportComponents.tsx:9-17`（import）、`:355-372`（移除 `renderHighlighted`）、`:399-401` / `:427-429` / `:459-469`（3 变体内容渲染）
- Test: `apps/web/tests/editor.strategy-block.test.tsx`（确认现有 + 加富文本用例）

- [ ] **Step 1: 确认现有测试基线（改之前先跑）**

Run: `pnpm -C apps/web exec vitest run tests/editor.strategy-block.test.tsx`
Expected: PASS（6 用例，作为不破回归基线）

- [ ] **Step 2: 改 import（`ReportComponents.tsx:9-17` 的 type import 块后追加一行）**

在现有 `import { findIcon } from '../icons/catalog';`（`:18`）下方追加：

```ts
import { renderHtmlWithHighlights } from '../richText';
```

- [ ] **Step 3: 移除死函数 `renderHighlighted`（`:355-372`）**

删除整段：

```ts
/** 把 content 按 highlights 词（逗号分隔）切分，命中词包成高亮 span。 */
function renderHighlighted(content: string, highlights?: string) {
  const words = (highlights ?? '')
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (words.length === 0 || !content) return content;
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  const lower = words.map((w) => w.toLowerCase());
  return content.split(re).map((part, i) =>
    lower.includes(part.toLowerCase()) ? (
      <span key={i} className="font-medium text-accent-secondary">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}
```

（`renderHighlighted` 仅被本文件 strategy 3 变体使用，已确认无外部引用。）

- [ ] **Step 4: 改 `StrategyDefault` 内容渲染（`:399-401`）**

旧：

```tsx
            <div className="whitespace-pre-wrap text-sm text-foreground-secondary">
              {renderHighlighted(content, data.highlights)}
            </div>
```

新：

```tsx
            <div
              className="text-sm text-foreground-secondary [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_li]:my-0.5 [&_b]:font-semibold [&_strong]:font-semibold"
              dangerouslySetInnerHTML={{ __html: renderHtmlWithHighlights(content, data.highlights) }}
            />
```

- [ ] **Step 5: 改 `StrategyLabeled` 内容渲染（`:427-429`）**

旧：

```tsx
            <div className="whitespace-pre-wrap text-sm text-foreground-secondary">
              {renderHighlighted(content, data.highlights)}
            </div>
```

新：

```tsx
            <div
              className="text-sm text-foreground-secondary [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_li]:my-0.5 [&_b]:font-semibold [&_strong]:font-semibold"
              dangerouslySetInnerHTML={{ __html: renderHtmlWithHighlights(content, data.highlights) }}
            />
```

- [ ] **Step 6: 改 `StrategyBulleted` body 行渲染（`:459-469`）**

旧：

```tsx
          {bodyRows.map((r, i) => {
            const content = r[2] || r[1] || '';
            return (
              <div key={i} className="flex gap-2 py-0.5 text-sm text-foreground-secondary">
                <span className="flex-none text-accent-secondary">•</span>
                <span className="whitespace-pre-wrap">{renderHighlighted(content, data.highlights)}</span>
              </div>
            );
          })}
```

新（内容容器从 `<span>` 改 `<div>`，以合法承载块级 `ul/p`）：

```tsx
          {bodyRows.map((r, i) => {
            const content = r[2] || r[1] || '';
            return (
              <div key={i} className="flex gap-2 py-0.5 text-sm text-foreground-secondary">
                <span className="flex-none text-accent-secondary">•</span>
                <div
                  className="min-w-0 flex-1 [&_ul]:my-0.5 [&_ul]:list-disc [&_ul]:pl-4"
                  dangerouslySetInnerHTML={{ __html: renderHtmlWithHighlights(content, data.highlights) }}
                />
              </div>
            );
          })}
```

- [ ] **Step 7: 跑现有 strategy 测试确认不破**

Run: `pnpm -C apps/web exec vitest run tests/editor.strategy-block.test.tsx`
Expected: PASS（6 用例仍全绿——标题文本与 `•` 渲染未改，仅 content 渲染方式变，而现有用例不断言 content 文本）

- [ ] **Step 8: 加富文本渲染用例（在 `editor.strategy-block.test.tsx` 的 `describe` 块末尾追加）**

```ts
  it('default 富文本内容：渲染 <b> 与高亮 span', () => {
    const { container } = render(
      <StrategyBlockComponent
        data={{ headers, rows: [['sparkle', 'INSIGHT', 'focus on <b>beauty tips</b>']], highlights: 'beauty, tips' } as StrategyBlockData}
      />,
    );
    // 加粗标签保留。
    expect(container.querySelector('b')).not.toBeNull();
    // 高亮词（beauty、tips）包成强调 span。
    expect(container.querySelectorAll('.text-accent-secondary').length).toBeGreaterThanOrEqual(1);
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

  it('bulleted 变体保留外层 • 且内容富文本可含列表', () => {
    const { container } = render(
      <StrategyBlockComponent
        data={{ variant: 'bulleted', headers, rows: [['target', 'STRATEGY', ''], ['sparkle', 'X', '<ul><li>a</li></ul>']] } as StrategyBlockData}
      />,
    );
    // 外层项目符号仍在。
    expect(screen.getAllByText('•')).toHaveLength(1);
    // 富文本 ul 渲染。
    expect(container.querySelector('ul')).not.toBeNull();
  });
```

- [ ] **Step 9: 跑测试确认通过**

Run: `pnpm -C apps/web exec vitest run tests/editor.strategy-block.test.tsx`
Expected: PASS（6 现有 + 3 新增 = 9 用例）

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/editor/components/ReportComponents.tsx apps/web/tests/editor.strategy-block.test.tsx
git commit -m "feat(web): render strategy-block content as sanitized rich text"
```

---

## Task 4: RichTextField 编辑控件

> contentEditable / `document.execCommand` 在 jsdom 不支持，故本组件不做编辑交互的 TDD；只做「挂载初始化 + onBlur 清洗写回」实现 + 渲染冒烟（在 Task 5 一并验证）。

**Files:**
- Modify: `apps/web/src/editor/PropertyPanel.tsx`（import + 新增组件）

- [ ] **Step 1: 加 import（`PropertyPanel.tsx:1` 的 `useEffect, useRef, useState` 已有；在 `:31` `import { findIcon } ...` 附近追加）**

```ts
import { sanitizeRichText } from './richText';
```

并在顶部 type import 块（`:2-20`）的 `@mediakit/shared` 类型列表中加入 `StrategyBlockData`（若尚未存在）。

- [ ] **Step 2: 新增 `RichTextField` 组件（在 `TextareaField` 函数 `:858-872` 之后插入）**

```tsx
/**
 * 轻量富文本字段：toolbar（加粗/斜体/列表）+ contentEditable。
 * 不受控：挂载时以 sanitize 后的 HTML 初始化；onBlur 时清洗并写回。
 * contentEditable / execCommand 在 jsdom 不可用，编辑交互不单测。
 */
function RichTextField({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  // 仅挂载时初始化一次（避免重渲染覆盖用户正在编辑的内容）。
  useEffect(() => {
    if (ref.current && !initialized.current) {
      ref.current.innerHTML = sanitizeRichText(value);
      initialized.current = true;
    }
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

  const btnCls = 'px-1.5 text-xs text-foreground-secondary hover:bg-surface-hover rounded';

  return (
    <div className="rounded border border-border-default">
      <div className="flex gap-1 border-b border-border-subtle px-1 py-0.5">
        <button type="button" title="加粗" onMouseDown={(e) => { e.preventDefault(); exec('bold'); }} className="font-bold italic-0 ${btnCls}">B</button>
        <button type="button" title="斜体" onMouseDown={(e) => { e.preventDefault(); exec('italic'); }} className="italic ${btnCls}">I</button>
        <button type="button" title="列表" onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList'); }} className="${btnCls}">•</button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onBlur={commit}
        className="min-h-[60px] px-2 py-1 text-xs text-foreground-primary focus:outline-none [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4"
      />
    </div>
  );
}
```

> **注意：** 上面 `${btnCls}` 是占位写法——实际代码必须把 class 字符串写实，不要用模板拼接（Tailwind 需字面量）。实现时三个按钮 className 分别写全：
> - 加粗：`"font-bold px-1.5 text-xs text-foreground-secondary hover:bg-surface-hover rounded"`
> - 斜体：`"italic px-1.5 text-xs text-foreground-secondary hover:bg-surface-hover rounded"`
> - 列表：`"px-1.5 text-xs text-foreground-secondary hover:bg-surface-hover rounded"`

- [ ] **Step 3: typecheck 确认无类型错误**

Run: `pnpm -C apps/web run typecheck`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/editor/PropertyPanel.tsx
git commit -m "feat(web): add RichTextField (contentEditable + sanitize on blur)"
```

---

## Task 5: StrategyBlockFields 专属面板 + registry + 分发

**Files:**
- Modify: `apps/web/src/editor/PropertyPanel.tsx`（新增 `StrategyBlockFields` + 分发行 `:129` 附近）
- Modify: `apps/web/src/editor/registry.tsx:331-334`（`strategy-block` propertySchema 去 `table`）

- [ ] **Step 1: 改 `registry.tsx` 的 strategy-block propertySchema（`:331-334`）**

旧：

```tsx
    propertySchema: [
      { key: '', label: '策略块', kind: 'table' },
      { key: 'highlights', label: '高亮词（逗号分隔）', kind: 'textarea' },
    ],
```

新（去掉 `table`，行编辑交给专属面板；`highlights` 仍用通用 textarea）：

```tsx
    // 行编辑（图标/标题/富文本内容）由 PropertyPanel 的 StrategyBlockFields 负责。
    propertySchema: [{ key: 'highlights', label: '高亮词（逗号分隔）', kind: 'textarea' }],
```

- [ ] **Step 2: 新增 `StrategyBlockFields`（在 `PropertyPanel.tsx` 的 `ImageGroupFields` `:1389` 之前插入；复用同文件 `FieldGroup`、`useDataUpdate`、`RichTextField`）**

```tsx
/** strategy-block 专属编辑：每行 = 图标 key + 标题 + 富文本内容；可增删行。 */
function StrategyBlockFields({ comp }: { comp: EditorComponent }) {
  const update = useDataUpdate(comp);
  const data = comp.data as StrategyBlockData;
  const rows = data.rows ?? [];

  const setRow = (i: number, next: string[]) => {
    update('rows', rows.map((r, idx) => (idx === i ? next : r)));
  };
  const addRow = () => update('rows', [...rows, ['', '', '']]);
  const removeRow = (i: number) => update('rows', rows.filter((_, idx) => idx !== i));

  return (
    <FieldGroup title="策略块">
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="space-y-1 rounded border border-border-subtle p-1">
            <div className="flex items-center gap-1">
              <input
                value={row[0] ?? ''}
                onChange={(e) => setRow(i, [e.target.value, row[1] ?? '', row[2] ?? ''])}
                placeholder="图标 key"
                className="w-16 rounded border border-border-default px-1 py-0.5 text-xs"
              />
              <input
                value={row[1] ?? ''}
                onChange={(e) => setRow(i, [row[0] ?? '', e.target.value, row[2] ?? ''])}
                placeholder="标题"
                className="flex-1 rounded border border-border-default px-1 py-0.5 text-xs"
              />
              <button
                onClick={() => removeRow(i)}
                title="删除该项"
                className="text-foreground-muted hover:text-red"
              >
                ✕
              </button>
            </div>
            <RichTextField
              value={row[2] ?? ''}
              onChange={(html) => setRow(i, [row[0] ?? '', row[1] ?? '', html])}
            />
          </div>
        ))}
      </div>
      <button onClick={addRow} className="mt-1 text-xs text-accent-primary hover:underline">
        + 添加项
      </button>
    </FieldGroup>
  );
}
```

- [ ] **Step 3: 加分发（`PropertyPanel.tsx:129` `image-group` 行下方追加一行）**

```tsx
      {comp.type === 'image-group' && <ImageGroupFields comp={comp} />}
      {comp.type === 'strategy-block' && <StrategyBlockFields comp={comp} />}
```

- [ ] **Step 4: 加渲染冒烟测试（新建 `apps/web/tests/editor.strategy-panel.test.tsx`）**

> contentEditable 编辑交互不测；只验证面板结构（行数、增删按钮、富文本区渲染）。

```ts
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PropertyPanel } from '@/editor/PropertyPanel';
import type { EditorComponent, StrategyBlockData } from '@mediakit/shared';

const comp: EditorComponent = {
  id: 'c1',
  type: 'strategy-block',
  x: 0, y: 0, w: 600, h: 200,
  data: {
    headers: ['图标', '标题', '内容'],
    rows: [['sparkle', 'INSIGHT', 'focus on tips'], ['target', 'STRATEGY', 'do x']],
    highlights: 'tips',
  } as StrategyBlockData,
};

// PropertyPanel 需要编辑器 store；用最小 store setup。若 PropertyPanel 已有测试范式，
// 沿用之；否则用已有 editor.store.test 的 setup helper。下方假设可直接渲染。
describe('StrategyBlockFields', () => {
  it('渲染行数与富文本区', () => {
    const { container } = render(<PropertyPanel comp={comp} />);
    // 两个「删除该项」按钮 = 两行。
    const removeBtns = screen.getAllByTitle('删除该项');
    expect(removeBtns).toHaveLength(2);
    // 每行一个 contentEditable。
    expect(container.querySelectorAll('[contenteditable="true"]').length).toBeGreaterThanOrEqual(2);
  });

  it('点击「+ 添加项」增加一行', () => {
    render(<PropertyPanel comp={comp} />);
    fireEvent.click(screen.getByText('+ 添加项'));
    expect(screen.getAllByTitle('删除该项')).toHaveLength(3);
  });
});
```

> **实现注记：** 若 `PropertyPanel` 的 props 签名（如需要 `page` / store provider）与上面不符，执行时先读 `PropertyPanel` 的导出签名与既有面板测试（`apps/web/tests/` 下任何渲染 PropertyPanel 的用例）对齐 props 与 store setup；核心断言（行数 = rows.length、添加项 +1、每行有 contentEditable）不变。

- [ ] **Step 5: 跑面板测试**

Run: `pnpm -C apps/web exec vitest run tests/editor.strategy-panel.test.tsx`
Expected: PASS。若因 PropertyPanel props/store setup 不符而失败，按 Step 4 注记对齐 setup 后重跑。

- [ ] **Step 6: typecheck**

Run: `pnpm -C apps/web run typecheck`
Expected: 无错误

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/editor/PropertyPanel.tsx apps/web/src/editor/registry.tsx apps/web/tests/editor.strategy-panel.test.tsx
git commit -m "feat(web): add StrategyBlockFields editor for rich-text rows"
```

---

## Task 6: 类型注释 + 全量回归 + 收尾

**Files:**
- Modify: `packages/shared/src/index.ts:798-807`（`StrategyBlockData` 注释）

- [ ] **Step 1: 更新 `StrategyBlockData` 注释（`packages/shared/src/index.ts:798-807`）**

将：

```ts
  /** 每行 [iconKey?, title, content]。 */
  rows: string[][];
```

改为：

```ts
  /**
   * 每行 [iconKey?, title, content]。
   * content 为受限 HTML 字符串（允许 b/strong/i/em/ul/ol/li/br/p，无属性），
   * 渲染前经 sanitizeRichText 清洗；旧数据（纯文本）自动兼容。
   */
  rows: string[][];
```

- [ ] **Step 2: 跑全量 web 测试**

Run: `pnpm -C apps/web run test`
Expected: 全绿（含本特性的 richText、strategy-block、strategy-panel 用例；不破坏其他组件）

- [ ] **Step 3: 全量 typecheck（含 shared 包，确认注释改动不破类型）**

Run: `pnpm run typecheck`
Expected: 无错误

- [ ] **Step 4: （可选）dev 手测**

Run: `pnpm -C apps/web run dev`，在编辑器加一个 `strategy-block`，选中，在属性面板用富文本 toolbar 加粗/列表，切变体观察渲染。

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "docs(shared): note strategy-block content is sanitized rich text"
```

- [ ] **Step 6: 收尾（由 finishing-a-development-branch 决定 merge/PR/cleanup）**

---

## Self-Review

**Spec 覆盖：**
- §3 数据模型零改动 → Task 6 Step 1 仅改注释，结构不动 ✅
- §4 sanitizeRichText → Task 1 ✅；renderHtmlWithHighlights → Task 2 ✅
- §5 StrategyBlockFields 专属面板 → Task 5 ✅；RichTextField → Task 4 ✅
- §6 渲染 3 变体 → Task 3 Step 4/5/6 ✅；bulleted 保留外层 • → Step 6 ✅
- §7 测试：纯函数单测（Task 1/2）+ 渲染断言（Task 3 Step 8）+ 编辑交互不测（Task 4 注记）✅
- §8 改动清单逐项对应 ✅
- §9 非目标（无链接/图片/库/迁移）均未引入 ✅

**占位符扫描：** Task 4 Step 2 的 `${btnCls}` 已在同 step 显式标注「必须写实，不要拼接」并列出三按钮字面量——执行时写实即可，非遗留 TODO。

**类型一致性：** `sanitizeRichText(html): string`、`renderHtmlWithHighlights(html, highlights?): string` 在 Task 1/2 定义，Task 3/4 引用签名一致；`StrategyBlockData` 字段（`rows`、`highlights`）全链路一致；`RichTextField({value, onChange})` 与 `StrategyBlockFields` 调用一致。

**已知执行期需确认点（已在对应 step 注记，非占位符）：**
1. Task 5 Step 4 的 `PropertyPanel` props/store setup——执行时读 `PropertyPanel` 导出签名与既有面板测试对齐。
2. Task 1 Step 4 的 `jsdom` 是否支持 `document.createElement` + `Node` 常量——`vitest` jsdom 环境默认支持；若极旧 jsdom 缺 `Node.ELEMENT_NODE`，改用数字字面量（`1`=ELEMENT、`3`=TEXT）。
