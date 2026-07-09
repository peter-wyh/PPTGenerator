# 安全区硬约束：禁止组件越界

**日期**：2026-07-09
**范围**：`apps/web`（编辑器 `snap.ts` / `store.ts` / `Canvas.tsx` / `PropertyPanel.tsx`）—— 纯前端运行时行为，**不新增任何持久化字段**
**状态**：设计已确认，待实现
**前置**：`2026-07-08-global-style-settings-design.md`（安全距离 + 网格的落地）

## 背景

`2026-07-08` 已落地「安全距离」（`theme.layout.safeMargin`，默认 48px）。当时的实现（§4）把安全区做成**参考线 + 磁吸**，并在「非目标」里**明确推迟**了硬约束：

> 安全区作为**硬约束**（禁止越界）——本次只做磁吸，不禁止出血。
> **可出血**：磁吸只在"靠近"时把边拉到线上；继续拖仍可越过安全线做满版出血背景。

本设计就是把这个被推迟的非目标**补上**：`safeMargin > 0` 时，组件**不允许**超出安全区，任何几何变更都被夹紧到安全区内。

现状关键事实（已核实）：

- 安全区矩形由 `safeRectFrom(margin, cw, ch)`（`snap.ts:22-26`）算成 `{left,top,right,bottom}`；`margin ≤ 0` 或 `margin*2 ≥ min(cw,ch)` 时返回 `null`。
- 当前磁吸**允许越界**（`snap.test.ts` 明确记录该行为）。
- 几何变更入口有 8 类（见下表），**多数不走任何夹紧**：

| 入口 | 位置 | 现状 |
|---|---|---|
| `move`（拖拽） | `store.ts:543-556` | 磁吸（`snapMove`），允许越界 |
| `resize`（缩放柄） | `store.ts:558-582` | 磁吸（`snapResize`），允许越界 |
| `nudge`（方向键） | `store.ts:608-615` | 无吸附、无夹紧 |
| `updateComponent`（底层 setter） | `store.ts:524-530` | 裸合并 |
| PropertyPanel NumberField | `PropertyPanel.tsx:705-729` | onChange 裸写、onBlur 仅 `commit()` |
| `addComponent` / `addComponentAt` / `addShapeAt` / `addBusinessBlock` / `addBusinessBlockAt` | `store.ts:398-521` | 仅夹到画布 `[0,cw-w]`，不夹安全区 |
| `duplicateSelected` / `paste` | `store.ts:596-606, 635-645` | 偏移 +20/+20，无夹紧 |
| `alignInPlace` / `distribute` / `equalize` | `store.ts:844-896` | 无夹紧 |

- **耦合点**：`snapCtx`（`store.ts:214-226`）与 Canvas move 分支（`Canvas.tsx:66-71`）都把磁吸 `safe` 绑死在 `showSafeArea` 上——关参考线 = 完全不约束。
- **已解耦的部分**：Canvas 里用于画参考线的 `safeRect`（`Canvas.tsx:45-48`）只看 `safeMargin`，与 `showSafeArea` 无关；参考线绘制（`Canvas.tsx:309`）才看 `showSafeArea`。即"参考线显隐"与"safeRect 是否存在"本就分离——解耦有基础。

## 目标

1. `safeMargin > 0` 时，**任何**几何变更（拖拽 / 缩放 / 方向键 / 属性面板 / 新增 / 复制粘贴 / 对齐分布）都把组件夹紧在安全区内，**不准越界**。
2. 夹紧**独立于** `showSafeArea`：隐藏参考线只藏虚线，夹紧照常生效（安全距离是布局规则，不是视觉辅助）。
3. 集中实现：夹紧逻辑收敛为 `snap.ts` 里的纯函数，所有变更点复用，可单测。

## 非目标

- **保留满版出血背景能力**——P1 决策已确认全面禁止，不保留任何越界通道（无 Alt 逃生、无组件级"允许越界"开关）。
- 自动修正已越界组件——`loadProject` / 模板批量导入（`addPageWithComponents` / `addPagesBatch` / `copyPage`）**不主动夹紧**，沿用懒修正（见决策①）。
- 改动持久化 schema——无新增 `Page`/`EditorComponent` 字段，不动 server Zod。`safeMargin` 已持久化。
- 四边独立安全距离、改动 ComponentType——同 07-08，仍是非目标。

## 决策汇总（已与用户确认）

1. **懒修正**：已越界的组件（老项目 / 调大 margin 后）保持原位，**仅在下次交互时**被夹回；加载与批量导入不主动挪动。
2. **隐藏参考线仍夹紧**：`safeMargin > 0` 即夹紧，不看 `showSafeArea`。磁吸仍与 `showSafeArea` 绑定（关参考线 = 不磁吸到隐形线，避免"吸到看不见的东西"），但硬夹紧始终在。
3. **路线 A**：`snap.ts` 加纯函数 `clampRect` / `clampResize`，在每个变更点显式调用；`updateComponent` 保持裸合并（避免破坏拖拽实时性与属性面板多位数输入）。
4. **P1 全面禁止**：所有变更点（含 `resize`）都夹紧，越界的大组件收缩到能塞下为止；满版出血背景不再可能。

## 设计

### §1 夹紧纯函数（`apps/web/src/editor/snap.ts`）

新增两个纯函数，与现有 `snapMove`/`snapResize` 同风格（无 React/store 依赖，便于单测）。`safe` 为 `null` 时原样返回（`margin=0` 或安全区≥画布 → 不夹）。

**`clampRect(rect, safe)`** —— 无出血夹紧，用于 move / nudge / add / duplicate / paste / align / distribute / 属性面板失焦：

```ts
/** 把矩形硬夹进安全区：位置先夹，塞不下则收缩 w/h（保 MIN_W/MIN_H）。safe=null 原样返回。 */
export function clampRect(
  rect: { x: number; y: number; w: number; h: number },
  safe: SafeRect | null,
): { x: number; y: number; w: number; h: number } {
  if (!safe) return rect;
  // 1) 收缩尺寸到能塞下（不小于 MIN）
  const w = Math.max(MIN_W, Math.min(rect.w, safe.right - safe.left));
  const h = Math.max(MIN_H, Math.min(rect.h, safe.bottom - safe.top));
  // 2) 位置夹进 [left, right-w] / [top, bottom-h]；塞不下时上限=下限，锚在左上角
  const x = Math.max(safe.left, Math.min(rect.x, safe.right - w));
  const y = Math.max(safe.top, Math.min(rect.y, safe.bottom - h));
  return { x, y, w, h };
}
```

> 注：对"能塞下"的常规组件（绝大多数），`w/h` 不变，只夹位置——行为等价于纯位置夹紧。收缩只发生在组件比安全区还大的边界情况（老项目首次交互）。

**`clampResize(rect, dir, safe)`** —— 方向感知的边夹紧，用于 `resize`。**保留非拖动边**（拖 W 柄触左边界时，只移左边、不动右边），手感更自然；`MIN_W/MIN_H` 优先于夹紧：

```ts
/** 缩放硬夹紧：按 dir 把动边限制在安全区内，保留对边。safe=null 原样返回。 */
export function clampResize(
  rect: { x: number; y: number; w: number; h: number },
  dir: string,
  safe: SafeRect | null,
): { x: number; y: number; w: number; h: number } {
  if (!safe) return rect;
  let { x, y, w, h } = rect;
  // 左边触界 → 左边钉在 safe.left，右边不动（w = 原右边 - safe.left）
  if (dir.includes('w') && x < safe.left) { w = Math.max(MIN_W, x + w - safe.left); x = safe.left; }
  // 右边触界 → 右边钉在 safe.right（w = safe.right - x）
  else if (dir.includes('e') && x + w > safe.right) { w = Math.max(MIN_W, safe.right - x); }
  if (dir.includes('n') && y < safe.top) { h = Math.max(MIN_H, y + h - safe.top); y = safe.top; }
  else if (dir.includes('s') && y + h > safe.bottom) { h = Math.max(MIN_H, safe.bottom - y); }
  return { x, y, w, h };
}
```

> 结构镜像现有 `snapResize`（`snap.ts:54-83`）的 `dir.includes(...)` 分支，便于阅读与回归。

### §2 解耦：夹紧与 `showSafeArea` 分离

`snapCtx`（`store.ts:214-226`）**保持不变**——它产出的是**磁吸**用的 `safe`，仍与 `showSafeArea` 绑定（关参考线 = 不磁吸）。

新增一个**只看 margin** 的夹紧上下文取值，所有夹紧点用它：

```ts
/** 夹紧用的安全区：只看 safeMargin>0，不看 showSafeArea（隐藏参考线仍夹紧）。 */
function clampSafeFrom(meta: ProjectMeta | null, cw: number, ch: number): SafeRect | null {
  const margin = meta?.theme?.layout?.safeMargin ?? DEFAULT_THEME.layout!.safeMargin;
  return safeRectFrom(margin, cw, ch);
}
```

> 为什么不直接复用 `snapCtx().safe`：那个在 `showSafeArea=false` 时返回 `null`，会让"隐藏参考线"误关夹紧（违背决策②）。两套取值各司其职：磁吸随参考线、夹紧随 margin。

### §3 各变更点接入（`apps/web/src/editor/store.ts`）

每个几何变更点在算完原始坐标后、落库前套夹紧。统一模式：

```ts
const safe = clampSafeFrom(s.projectMeta, s.canvasWidth, s.canvasHeight);
// …算出 {x,y,w,h}… → clampRect({x,y,w,h}, safe)
```

逐点：

- **`move`**（543-556）：`snapMove` 之后追加 `clampRect`，并**回写完整 {x,y,w,h}**（常规组件 w/h 不变；超大组件按 §1 收缩——这是 P1 的体现）。
  ```ts
  const { grid, safe: snapSafe } = snapCtx(s.projectMeta, s.canvasWidth, s.canvasHeight); // 磁吸用（随参考线）
  const clampSafe = clampSafeFrom(s.projectMeta, s.canvasWidth, s.canvasHeight);           // 夹紧用（随 margin）
  // …在 cs.map 内，对每个非锁定选中组件：
  const { x: sx, y: sy } = snapMove({ x: c.x + dx, y: c.y + dy, w: c.w, h: c.h }, grid, snapSafe);
  const cl = clampRect({ x: sx, y: sy, w: c.w, h: c.h }, clampSafe);
  return { ...c, x: cl.x, y: cl.y, w: cl.w, h: cl.h };
  ```
  > 现有 `move` 从 `snapCtx` 解构 `{ grid, safe }`；此处把 `safe` 重命名为 `snapSafe` 以区分新增的 `clampSafe`。
- **`resize`**（558-582）：`snapResize` 之后追加 `clampResize(dir)`。
  ```ts
  const snapped = snapResize({ x, y, w, h }, dir, grid, snapSafe);
  const cl = clampResize(snapped, dir, clampSafe);
  return { ...c, ...cl };
  ```
- **`nudge`**（608-615）：原 `x += dx, y += dy`，改为先算再 `clampRect`（取 `clampSafeFrom`）。
- **`duplicateSelected`**（596-606）/ **`paste`**（635-645）：对每个 `x+20/y+20` 后的副本 `clampRect`。
- **`addComponent` / `addComponentAt` / `addShapeAt` / `addBusinessBlock` / `addBusinessBlockAt`**（398-521）：`centered()`/`placed()` 算出 {x,y} 后，对 `{x,y,w,h}` `clampRect`。（`centered`/`placed` 本身仍夹到画布，作为初值；安全区夹紧在其后兜底。）
- **`alignInPlace`**（844-862）/ **`distribute`**（865-888）：在返回前对每个被改组件 `clampRect`（仅夹位置即可，但统一用 `clampRect` 无副作用——常规组件只动 x/y）。`equalize`（891-896）改 w/h 后同样 `clampRect`：等宽/等高若把某组件顶出右边，位置被夹回（塞不下则按 §1 收缩）。
- **`updateComponent`**（524-530）：**不动**（保持裸合并）。夹紧由各语义层调用方负责。

> 不接入的批量路径（决策①懒修正）：`loadProject`（275-308）、`addPageWithComponents`（710-716）、`addPagesBatch`（718-728）、`copyPage`（730-744）。这些是导入/加载，不主动改用户既有排版；越界组件留到首次交互再夹。

### §4 Canvas move 分支（`apps/web/src/editor/Canvas.tsx`）

拖拽实时更新走的是 `Canvas.tsx:63-76` 的 `onMove`，它**直接调 `updateComponent`**（不经 `store.move`），所以这里也要夹。与 `store.move` 对称：`snapMove` 后追加 `clampRect`：

```ts
// 现有：const safe = layout && showSafeArea!==false ? safeRectFrom(...) : null;  // 磁吸用，保留
const clampSafe = safeRectFrom(layout?.safeMargin ?? DEFAULT_THEME.layout!.safeMargin, cw, ch); // 新增：夹紧用
for (const c of drag.comps) {
  if (c.locked) continue;
  const { x: sx, y: sy } = snapMove({ x: c.x + dx, y: c.y + dy, w: c.w, h: c.h }, grid, safe);
  const cl = clampRect({ x: sx, y: sy, w: c.w, h: c.h }, clampSafe);
  st.updateComponent(c.id, { x: cl.x, y: cl.y, w: cl.w, h: cl.h }); // 回写完整（常规组件 w/h 不变）
}
```

参考线绘制（`Canvas.tsx:308-320`）与 `safeRect`（45-48）**不改**。

### §5 属性面板失焦夹紧（`apps/web/src/editor/PropertyPanel.tsx`）

NumberField（705-729）当前 onChange 实时裸写（719-724）、onBlur 仅 `commit()`（725）。**onChange 不夹**（否则打 "50" 会被首位 "5" 截断）；**onBlur 夹紧**。

新增一个 store action `sanitizeComponent(id)`：读当前组件几何 → `clampRect` → 写回（不入 history，紧接的 `commit()` 统一落）。NumberField 的 `onBlur` 改为：

```ts
onBlur={() => { sanitizeComponent(comp.id); commit(); }}
```

> 只对几何字段（x/y/w/h，`field.inData === false`）触发；非几何 NumberField（字号等）不受影响（可在 NumberField 内按 `field.inData` 判断是否调 `sanitizeComponent`，或仅在 `GEOMETRY` 字段渲染处接入）。

### §6 行为变化（需回归确认）

| 场景 | 旧（07-08） | 新 |
|---|---|---|
| 拖组件越过安全边 | 磁吸后仍可越界出血 | **被夹住，不能越界** |
| 缩放拉过安全边 | 自由 | **被夹住，动边停在安全线** |
| 方向键移出安全区 | 自由 | 被夹 |
| 属性面板输入越界值 | 自由 | 失焦后被夹 |
| 关闭参考线 | 完全不约束 | **仍夹紧**（只不磁吸） |
| 满版出血背景 | 支持（07-08 §4） | **不可**（P1） |
| 老项目里的越界组件 | 保持越界 | 保持原位，**首次交互被夹（塞不下则收缩）** |

## 测试与验证

仓库已有 `snap.test.ts`（jsdom，见记忆 `web-chart-test-convention`），夹紧是纯函数，**优先加单测**：

- `clampRect`：常规组件只夹位置；比安全区大的组件收缩到 `safeWidth`/`safeHeight` 且 ≥ MIN；`safe=null` 原样返回；位置夹到四条边界。
- `clampResize`：各方向（n/e/s/w 及组合）触界时动边停在安全线、对边不动；MIN 优先；`safe=null` 原样返回。
- `clampSafeFrom`：`showSafeArea=false` 但 `margin>0` 时仍返回非 null（解耦断言）。

手动回归（按 §6 表逐项）+ `tsc` 全量。重点：关参考线仍夹紧、导出路径（puppeteer 走 `PageView`）不受影响（夹紧只改数据、不动渲染层）。

## 实现顺序（粗）

1. `snap.ts`：加 `clampRect` / `clampResize` + 单测。
2. `store.ts`：加 `clampSafeFrom`；接入 `move` / `resize` / `nudge` / `duplicateSelected` / `paste` / `add*` 五类 / `alignInPlace` / `distribute` / `equalize`；加 `sanitizeComponent`。
3. `Canvas.tsx`：move 分支加 `clampRect`（夹紧用 `safeRectFrom(margin)`）。
4. `PropertyPanel.tsx`：NumberField `onBlur` 调 `sanitizeComponent` + `commit`。
5. `tsc` 全量 + 单测 + 手动回归清单。

## 风险

- **满版出血背景消失**：P1 已确认接受。若后续要恢复，需引入逃生通道（Alt 拖拽 / 组件级开关）——本期不做。
- **老项目首次交互收缩**：含越界（满版）组件的老项目，首次拖拽/缩放会被收缩到安全区。属懒修正的预期代价；若反馈强烈，可改为"仅夹位置不收缩"——但那会留出血，违背 P1，暂不取。
- **属性面板失焦静默改值**：输入越界 x/w，失焦后被夹（可能连带改 w）。已选 onBlur 时机（不打断输入）；如反馈突兀，可加视觉提示（越界时输入框高亮）——非本期。
- **磁吸与夹紧的轻微冗余**：参考线可见时，磁吸到安全边与硬夹紧在边界处效果重叠（磁吸把边吸到线上，夹紧禁止越过）——无冲突，保留磁吸为顺手特性，不删。
- **`equalize` 顶出右边**：等宽/等高后某组件可能右溢，`clampRect` 会夹回（塞不下则收缩）。属预期。
