# 基础图形组件（shape）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 编辑器基础组件新增矩形/圆角矩形/圆形/直线 4 种基础图形（单一 `shape` type + `data.shape` 字段）。

**Architecture:** 复用 `business-block` 的「1 type + 子类型」模式——一个 `ShapeComponent` 按 `data.shape` 分支渲染；`store.addShape(shape)` 仿 `addBusinessBlock(kind)`；`ComponentPanel` 列 4 入口、拖放 payload 加 `op:'shape'`；属性面板用自定义 `ShapeFields`（条件字段）。rectangle/rounded/circle 用 div，line 用 SVG。

**Tech Stack:** React 18 · TypeScript · Zustand · vitest + @testing-library（recharts 在 jsdom 被 mock，shape 不涉及 recharts，直接断言 DOM）。

**Spec:** `docs/superpowers/specs/2026-07-07-basic-shapes-design.md`

---

## Task 1: shared 类型 + ShapeComponent + defaults + registry

**Files:**
- Modify: `packages/shared/src/index.ts`（ComponentType + ShapeKind/ShapeData + ComponentData 联合）
- Modify: `apps/web/src/editor/defaults.ts`（DEFAULT_SIZES + getDefaultShapeData + getDefaultData case）
- Modify: `apps/web/src/editor/components/BasicComponents.tsx`（+ ShapeComponent）
- Modify: `apps/web/src/editor/registry.tsx`（+ 'shape' 条目）
- Modify: `apps/web/tests/shared.types.test.ts`（+ ShapeData 类型）
- Create: `apps/web/tests/editor.shape.test.tsx`

- [ ] **Step 1: shared 加类型（`packages/shared/src/index.ts`）**

在 `ComponentType` 联合（行 446 起）末尾 `'post-list'` 后追加：
```ts
  | 'post-list'
  | 'shape'
```

在 `TextData` 等 interface 附近（如 `TextData` 定义之后）新增：
```ts
export type ShapeKind = 'rectangle' | 'rounded' | 'circle' | 'line';

export interface ShapeData {
  shape: ShapeKind;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  rotation?: number;
  borderRadius?: number; // 仅 rounded
  dash?: boolean;        // 仅 line
}
```

在 `ComponentData` 联合（行 761 起）追加 `| ShapeData`：
```ts
export type ComponentData =
  | TextData
  | ImageData
  | IndicatorCardData
  // ... 其余现有 ...
  | ShapeData;
```

- [ ] **Step 2: defaults 加默认值（`apps/web/src/editor/defaults.ts`）**

`DEFAULT_SIZES`（行 7 起，`Record<ComponentType,...>`）追加：
```ts
  'shape': { w: 200, h: 120 },
```

文件末尾新增 `getDefaultShapeData`（按 shape 返回；line 不带 fill、带 dash，rounded 带 borderRadius）：
```ts
export function getDefaultShapeData(shape: ShapeKind): ShapeData {
  if (shape === 'line') {
    return { shape: 'line', stroke: '#E5E7EB', strokeWidth: 1, opacity: 1, rotation: 0, dash: false };
  }
  const base: ShapeData = {
    shape,
    fill: '#FF5C00',
    stroke: '#E5E7EB',
    strokeWidth: 0,
    opacity: 1,
    rotation: 0,
  };
  if (shape === 'rounded') return { ...base, borderRadius: 12 };
  return base;
}
```

`getDefaultData` switch（行 43 起）在 `default:` 之前加 case：
```ts
    case 'shape':
      return getDefaultShapeData('rectangle');
```

`defaults.ts` 顶部 import 块加 `ShapeKind`、`ShapeData`（从 `@mediakit/shared` 的现有 type import 中追加这两个标识符）。

- [ ] **Step 3: 写失败测试 `apps/web/tests/editor.shape.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ShapeComponent } from '@/editor/components/BasicComponents';
import type { ShapeData } from '@mediakit/shared';

describe('ShapeComponent', () => {
  it('rectangle 渲染填充色', () => {
    const data: ShapeData = { shape: 'rectangle', fill: '#FF5C00', stroke: '#E5E7EB', strokeWidth: 0, opacity: 1, rotation: 0 };
    const { container } = render(<ShapeComponent data={data} />);
    const inner = container.querySelector('.h-full.w-full > div');
    expect(inner?.getAttribute('style')).toContain('background-color');
  });

  it('rounded 应用 borderRadius', () => {
    const data: ShapeData = { shape: 'rounded', fill: '#FF5C00', strokeWidth: 0, opacity: 1, rotation: 0, borderRadius: 16 };
    const { container } = render(<ShapeComponent data={data} />);
    expect(container.innerHTML).toContain('border-radius');
    expect(container.innerHTML).toContain('16');
  });

  it('circle 用 50% 圆角', () => {
    const data: ShapeData = { shape: 'circle', fill: '#3B82F6', strokeWidth: 0, opacity: 1, rotation: 0 };
    const { container } = render(<ShapeComponent data={data} />);
    expect(container.innerHTML).toContain('50%');
  });

  it('line 渲染 SVG line 且无填充', () => {
    const data: ShapeData = { shape: 'line', stroke: '#E5E7EB', strokeWidth: 2, opacity: 1, rotation: 0, dash: true };
    const { container } = render(<ShapeComponent data={data} />);
    expect(container.querySelector('svg line')).not.toBeNull();
    expect(container.querySelector('svg line')?.getAttribute('stroke-dasharray')).toBe('8 4');
    expect(container.innerHTML).not.toContain('background-color');
  });

  it('rotation/opacity 应用到外层', () => {
    const data: ShapeData = { shape: 'rectangle', fill: '#000', strokeWidth: 0, opacity: 0.5, rotation: 45 };
    const { container } = render(<ShapeComponent data={data} />);
    expect(container.innerHTML).toContain('rotate(45deg)');
    expect(container.innerHTML).toContain('opacity');
  });
});
```

- [ ] **Step 4: 跑测试确认失败**

Run: `pnpm --filter @mediakit/web test editor.shape`
Expected: FAIL（`ShapeComponent` 未导出）。

- [ ] **Step 5: 实现 `ShapeComponent`（`apps/web/src/editor/components/BasicComponents.tsx`）**

顶部 `import type { ... } from '@mediakit/shared'` 块追加 `ShapeData`。文件末尾新增：
```tsx
/* --------------------------------- shape --------------------------------- */
export function ShapeComponent({ data }: { data: ShapeData }) {
  const { shape, fill, stroke, strokeWidth, opacity, rotation, borderRadius, dash } = data;
  const border = strokeWidth && stroke ? `${strokeWidth}px solid ${stroke}` : undefined;
  const inner =
    shape === 'line' ? (
      <svg className="h-full w-full" preserveAspectRatio="none">
        <line
          x1="0"
          y1="50%"
          x2="100%"
          y2="50%"
          stroke={stroke ?? '#E5E7EB'}
          strokeWidth={strokeWidth ?? 1}
          strokeDasharray={dash ? '8 4' : undefined}
        />
      </svg>
    ) : (
      <div
        className="h-full w-full"
        style={{
          backgroundColor: fill,
          border,
          borderRadius: shape === 'circle' ? '50%' : shape === 'rounded' ? borderRadius ?? 12 : undefined,
        }}
      />
    );
  return (
    <div
      className="h-full w-full"
      style={{
        opacity: opacity ?? 1,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
      }}
    >
      {inner}
    </div>
  );
}
```

- [ ] **Step 6: registry 注册（`apps/web/src/editor/registry.tsx`）**

顶部从 `./components/BasicComponents` 的 import 追加 `ShapeComponent`。在 REGISTRY 对象中（如 `'table'` 条目之后）新增：
```ts
  'shape': {
    Component: ShapeComponent,
    defaultSize: DEFAULT_SIZES['shape'],
    defaultData: () => getDefaultData('shape'),
    propertySchema: [], // 用自定义 ShapeFields
  },
```

- [ ] **Step 7: shared.types.test 加 ShapeData（`apps/web/tests/shared.types.test.ts`）**

先 `grep -n "Shape\|TextData\|interface" apps/web/tests/shared.types.test.ts` 看现有写法（类型 import 或快照），按相同风格追加对 `ShapeKind`/`ShapeData` 的 import 与一个最小构造断言：
```ts
import type { ShapeData, ShapeKind } from '@mediakit/shared';
// ...
it('ShapeData 可构造', () => {
  const d: ShapeData = { shape: 'rectangle', fill: '#000', strokeWidth: 0, opacity: 1, rotation: 0 };
  const k: ShapeKind[] = ['rectangle', 'rounded', 'circle', 'line'];
  expect(d.shape).toBe('rectangle');
  expect(k).toHaveLength(4);
});
```

- [ ] **Step 8: 跑 typecheck + 测试**

Run: `pnpm --filter @mediakit/web typecheck && pnpm --filter @mediakit/web test`
Expected: typecheck PASS，`editor.shape` 5 例 + shared.types + registry（registry.test 现有 8 例不应受影响）全绿。

- [ ] **Step 9: 提交**

```bash
git add packages/shared/src/index.ts apps/web/src/editor/defaults.ts apps/web/src/editor/components/BasicComponents.tsx apps/web/src/editor/registry.tsx apps/web/tests/shared.types.test.ts apps/web/tests/editor.shape.test.tsx
git commit -m "feat(web): 新增基础图形组件 shape（rectangle/rounded/circle/line）"
```

---

## Task 2: store addShape / addShapeAt

**Files:**
- Modify: `apps/web/src/editor/store.ts`（接口声明 + 实现）

- [ ] **Step 1: 接口声明**

`EditorState` 接口在 `addBusinessBlockAt` 声明（行 99）之后加：
```ts
  addShape: (shape: ShapeKind) => void;
  addShapeAt: (shape: ShapeKind, x: number, y: number) => void;
```

顶部 import 块：从 `@mediakit/shared` 的 type import 追加 `ShapeKind`；从 `./defaults` 的 import 追加 `getDefaultShapeData`。

- [ ] **Step 2: 实现（在 `addBusinessBlockAt` 实现之后）**

```ts
    addShape: (shape) =>
      mutateAndCommit((s) => {
        const size = shape === 'line' ? { w: 200, h: 4 } : DEFAULT_SIZES['shape'];
        const { x, y } = centered(size.w, size.h, s.canvasWidth, s.canvasHeight);
        const comp: EditorComponent = {
          id: newId(),
          type: 'shape',
          x,
          y,
          w: size.w,
          h: size.h,
          data: getDefaultShapeData(shape),
        };
        return {
          pages: withCurrentComponents(s.pages, s.currentPageId, (cs) => [...cs, comp]),
          selectedIds: [comp.id],
        };
      }),

    addShapeAt: (shape, cx, cy) =>
      mutateAndCommit((s) => {
        const size = shape === 'line' ? { w: 200, h: 4 } : DEFAULT_SIZES['shape'];
        const { x, y } = placed(size.w, size.h, cx, cy, s.canvasWidth, s.canvasHeight);
        const comp: EditorComponent = {
          id: newId(),
          type: 'shape',
          x,
          y,
          w: size.w,
          h: size.h,
          data: getDefaultShapeData(shape),
        };
        return {
          pages: withCurrentComponents(s.pages, s.currentPageId, (cs) => [...cs, comp]),
          selectedIds: [comp.id],
        };
      }),
```

- [ ] **Step 3: typecheck + 测试**

Run: `pnpm --filter @mediakit/web typecheck && pnpm --filter @mediakit/web test`
Expected: PASS（store 改动不影响现有测试；ShapeKind/getDefaultShapeData 已由 Task 1 提供）。

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/editor/store.ts
git commit -m "feat(web): store 新增 addShape/addShapeAt"
```

---

## Task 3: ComponentPanel 入口 + Canvas drop 分发

**Files:**
- Modify: `apps/web/src/editor/ComponentPanel.tsx`
- Modify: `apps/web/src/editor/Canvas.tsx`

- [ ] **Step 1: ComponentPanel payload + GROUPS（`apps/web/src/editor/ComponentPanel.tsx`）**

顶部 import：从 `@mediakit/shared` 追加 `type ShapeKind`；`useEditorStore` 已有。`PalettePayload` 改为：
```ts
type PalettePayload =
  | { op: 'component'; type: ComponentType }
  | { op: 'business'; kind: string }
  | { op: 'shape'; shape: ShapeKind };
```

`GROUPS` 的 item 类型加可选 `shape`，基础组追加 4 个 shape 入口：
```ts
const GROUPS: { group: string; items: { type: ComponentType; label: string; icon: string; shape?: ShapeKind }[] }[] = [
  {
    group: '基础',
    items: [
      { type: 'text', label: '文本', icon: 'T' },
      { type: 'image', label: '图片', icon: '▭' },
      { type: 'indicator-card', label: '指标卡', icon: '◉' },
      { type: 'table', label: '表格', icon: '▦' },
      { type: 'bar-chart', label: '柱状图', icon: '▮' },
      { type: 'line-chart', label: '折线图', icon: '╱' },
      { type: 'pie-chart', label: '饼图', icon: '◐' },
      { type: 'shape', shape: 'rectangle', label: '矩形', icon: '▭' },
      { type: 'shape', shape: 'rounded', label: '圆角矩形', icon: '▢' },
      { type: 'shape', shape: 'circle', label: '圆形', icon: '◯' },
      { type: 'shape', shape: 'line', label: '直线', icon: '─' },
    ],
  },
  // ... 其余分组不变
];
```

- [ ] **Step 2: ComponentPanel onDragStart + onClick**

`ComponentPanel` 组件内取 `addShape`：
```ts
const addComponent = useEditorStore((s) => s.addComponent);
const addShape = useEditorStore((s) => s.addShape);
```

`onDragStart` 改为接收 item 并按 shape 选 payload：
```ts
function onDragStart(e: React.DragEvent, it: { type: ComponentType; shape?: ShapeKind }) {
  const payload: PalettePayload = it.shape
    ? { op: 'shape', shape: it.shape }
    : { op: 'component', type: it.type };
  e.dataTransfer.setData(PALETTE_MIME, JSON.stringify(payload));
  e.dataTransfer.effectAllowed = 'copy';
}
```

button 的 `onDragStart` 与 `onClick` 改为传 it：
```tsx
          {g.items.map((it) => (
            <button
              key={it.type + (it.shape ?? '')}
              draggable
              onDragStart={(e) => onDragStart(e, it)}
              title={`添加${it.label}（拖到画布或点击）`}
              onClick={() => (it.shape ? addShape(it.shape) : addComponent(it.type))}
              className="..."
            >
```
（className 保持原样。）

- [ ] **Step 3: Canvas handleDrop 加 shape 分发（`apps/web/src/editor/Canvas.tsx:239-240`）**

```ts
    if (payload.op === 'component') st.addComponentAt(payload.type, x, y);
    else if (payload.op === 'shape') st.addShapeAt(payload.shape, x, y);
    else st.addBusinessBlockAt(payload.kind, x, y);
```

- [ ] **Step 4: typecheck + 测试**

Run: `pnpm --filter @mediakit/web typecheck && pnpm --filter @mediakit/web test`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/ComponentPanel.tsx apps/web/src/editor/Canvas.tsx
git commit -m "feat(web): 组件库新增矩形/圆角矩形/圆形/直线入口"
```

---

## Task 4: PropertyPanel LABELS + ShapeFields

**Files:**
- Modify: `apps/web/src/editor/PropertyPanel.tsx`
- Modify: `apps/web/tests/editor.shape.test.tsx`（加 ShapeFields 用例）

- [ ] **Step 1: 加 LABELS + import**

`PropertyPanel.tsx` 顶部 `import type { ... } from '@mediakit/shared'` 块追加 `ShapeData`、`ShapeKind`。

`LABELS` 加：
```ts
  'shape': '图形',
```

- [ ] **Step 2: 挂载 ShapeFields**

在属性面板 return 内（`{comp.type === 'creator-stats-strip' && <CreatorStatsFields comp={comp} />}` 那类挂载之后）加：
```tsx
      {comp.type === 'shape' && <ShapeFields comp={comp} />}
```

- [ ] **Step 3: 实现 ShapeFields（文件末尾，仿 `BusinessFields`）**

```tsx
/* ------------------------------- 图形字段 ------------------------------- */
const SHAPE_OPTIONS: { id: ShapeKind; label: string }[] = [
  { id: 'rectangle', label: '矩形' },
  { id: 'rounded', label: '圆角' },
  { id: 'circle', label: '圆形' },
  { id: 'line', label: '直线' },
];

function ShapeFields({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const data = comp.data as ShapeData;
  const isLine = data.shape === 'line';

  function setShape(shape: ShapeKind) {
    const next: ShapeData = { ...data, shape };
    if (shape === 'line') {
      next.strokeWidth = next.strokeWidth || 1;
      next.dash = next.dash ?? false;
      delete (next as { fill?: string }).fill;
    }
    if (shape === 'rounded' && next.borderRadius == null) next.borderRadius = 12;
    updateComponentData(comp.id, next);
  }
  const set = (patch: Partial<ShapeData>) => updateComponentData(comp.id, patch);

  return (
    <FieldGroup title="图形">
      <div className="flex flex-wrap gap-1">
        {SHAPE_OPTIONS.map((o) => (
          <button
            key={o.id}
            onClick={() => setShape(o.id)}
            className={`rounded border px-2 py-1 text-xs ${
              data.shape === o.id
                ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                : 'border-border-default text-foreground-secondary hover:bg-surface-hover'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {!isLine && (
        <label className="block text-xs text-foreground-secondary">
          <span className="mb-1 block">填充色</span>
          <input
            type="color"
            value={data.fill ?? '#ffffff'}
            onChange={(e) => set({ fill: e.target.value })}
            className="h-8 w-full rounded border border-border-default p-1"
          />
        </label>
      )}

      <label className="block text-xs text-foreground-secondary">
        <span className="mb-1 block">描边色</span>
        <input
          type="color"
          value={data.stroke ?? '#E5E7EB'}
          onChange={(e) => set({ stroke: e.target.value })}
          className="h-8 w-full rounded border border-border-default p-1"
        />
      </label>

      <label className="block text-xs text-foreground-secondary">
        <span className="mb-1 block">描边粗细</span>
        <input
          type="number"
          min={0}
          value={data.strokeWidth ?? 0}
          onChange={(e) => set({ strokeWidth: Number(e.target.value) })}
          className="w-full rounded border border-border-default px-2 py-1"
        />
      </label>

      <label className="block text-xs text-foreground-secondary">
        <span className="mb-1 block">透明度（0–1）</span>
        <input
          type="number"
          min={0}
          max={1}
          step={0.1}
          value={data.opacity ?? 1}
          onChange={(e) => set({ opacity: Number(e.target.value) })}
          className="w-full rounded border border-border-default px-2 py-1"
        />
      </label>

      <label className="block text-xs text-foreground-secondary">
        <span className="mb-1 block">旋转（度）</span>
        <input
          type="number"
          value={data.rotation ?? 0}
          onChange={(e) => set({ rotation: Number(e.target.value) })}
          className="w-full rounded border border-border-default px-2 py-1"
        />
      </label>

      {data.shape === 'rounded' && (
        <label className="block text-xs text-foreground-secondary">
          <span className="mb-1 block">圆角半径</span>
          <input
            type="number"
            min={0}
            value={data.borderRadius ?? 12}
            onChange={(e) => set({ borderRadius: Number(e.target.value) })}
            className="w-full rounded border border-border-default px-2 py-1"
          />
        </label>
      )}

      {isLine && (
        <label className="flex items-center gap-2 text-xs text-foreground-secondary">
          <input
            type="checkbox"
            checked={data.dash ?? false}
            onChange={(e) => set({ dash: e.target.checked })}
          />
          虚线
        </label>
      )}
    </FieldGroup>
  );
}
```

- [ ] **Step 4: ShapeFields 测试（追加到 `editor.shape.test.tsx`）**

```tsx
import { ShapeFields } from '@/editor/PropertyPanel'; // 若 PropertyPanel 未导出 ShapeFields，见下方 note
import userEvent from '@testing-library/user-event';

describe('ShapeFields', () => {
  it('line 不显示填充色，rounded 显示圆角', () => {
    const line = render(<ShapeFields comp={{ id: 'l', type: 'shape', x: 0, y: 0, w: 200, h: 4, data: { shape: 'line', stroke: '#E5E7EB', strokeWidth: 1, opacity: 1, rotation: 0, dash: false } } as any} />);
    expect(line.queryByText('填充色')).toBeNull();
    const rounded = render(<ShapeFields comp={{ id: 'r', type: 'shape', x: 0, y: 0, w: 200, h: 120, data: { shape: 'rounded', fill: '#000', strokeWidth: 0, opacity: 1, rotation: 0, borderRadius: 12 } } as any} />);
    expect(rounded.getByText('圆角半径')).toBeInTheDocument();
  });
});
```

> **Note：** 若 `ShapeFields` 未从 `PropertyPanel` 导出，把 `function ShapeFields` 改为 `export function ShapeFields`（与 `BusinessFields` 一致——先 `grep -n "function BusinessFields\|export function BusinessFields" apps/web/src/editor/PropertyPanel.tsx` 确认现有导出风格再对齐）。

- [ ] **Step 5: typecheck + 测试**

Run: `pnpm --filter @mediakit/web typecheck && pnpm --filter @mediakit/web test`
Expected: PASS（含 ShapeFields 2 例）。

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/editor/PropertyPanel.tsx apps/web/tests/editor.shape.test.tsx
git commit -m "feat(web): 图形属性面板 ShapeFields（形状切换+条件属性）"
```

---

## Task 5: 集成验证 + 手动

**Files:** 无代码改动，仅验证。

- [ ] **Step 1: 全量门禁**

Run: `pnpm typecheck && pnpm test`
Expected: typecheck 三端零错误；web 全绿（含 editor.shape 7 例）、server 48 全绿。

- [ ] **Step 2: 手动验证（dev server 需跑着）**

浏览器 http://localhost:5173，登录 `admin@mediakit.local` / `admin123`，打开项目：
1. 组件库「基础」组出现 矩形/圆角矩形/圆形/直线 4 个入口。
2. 点「矩形」→ 画布出现橙色矩形；选中→右栏「图形」属性面板。
3. 切换形状（矩形↔圆↔直线）→ 画布形状变化；line 时无填充色字段、有虚线；rounded 有圆角半径。
4. 调填充色/描边/透明度/旋转/圆角/虚线 → 画布实时变化。
5. 拖拽入口到画布指定位置 → 落点正确。
6. 刷新页面 → 图形仍在（autosave 持久化）。

- [ ] **Step 3: 收尾**

无代码改动则无需 commit。若手动过程发现问题，按现象定位修复后单独 commit。

---

## Self-Review

**Spec coverage:**
- 4 形状 + data.shape → Task 1（ShapeComponent 分支 + ShapeKind）。✓
- fill/stroke/strokeWidth/opacity/rotation 通用属性 → Task 1（ShapeComponent style）+ Task 4（ShapeFields）。✓
- borderRadius（rounded）/dash（line）→ Task 1 + Task 4。✓
- addShape/addShapeAt（仿 business-block）→ Task 2。✓
- ComponentPanel 4 入口 + op:'shape' payload + drop → Task 3。✓
- REGISTRY 'shape' + defaults → Task 1。✓
- PropertyPanel LABELS + ShapeFields（条件字段）→ Task 4。✓
- 测试：shared.types / shape 渲染 / ShapeFields → Task 1 + Task 4。✓
- circle=div50% / line=SVG / 旋转 MVP → Task 1 代码 + 决策记录。✓

**Placeholder scan:** 无 TBD/TODO；每步含完整代码或确切命令。ShapeFields 导出 + shared.types 写法给了 grep 兜底说明（确认现有风格），非占位符。

**Type consistency:** `ShapeKind`/`ShapeData` 在 shared 定义；`getDefaultShapeData(shape: ShapeKind): ShapeData`（defaults）↔ `addShape(shape: ShapeKind)`（store）↔ `ShapeFields`（data as ShapeData）签名一致；`PalettePayload` 的 `op:'shape'; shape: ShapeKind` ↔ Canvas `payload.shape` 一致；'shape' 同时出现在 ComponentType / DEFAULT_SIZES / REGISTRY / LABELS（Task 1 起一致）。
