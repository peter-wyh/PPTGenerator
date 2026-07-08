# 页面渐变背景（Page Gradient Background）— 设计文档

- 日期：2026-07-08
- 范围：为编辑器「页面背景」增加渐变（线性 / 径向）能力，与现有纯色 / 图片背景通过「类型单选」共存。
- 状态：已评审，待写实现计划。

## 1. 目标与非目标

### 目标
- 页面背景支持线性（linear）与径向（radial）渐变。
- 渐变支持可增删色标（color stops），数量区间 2–6，每个色标含颜色 + 位置（百分比）。
- 线性渐变支持角度（0–360°），并配方向快捷按钮。
- 与现有「纯色 / 图片」背景以「类型单选」方式互斥共存，UX 清晰。
- 不破坏已保存项目（纯新增可选字段，零迁移）。

### 非目标（YAGNI）
- 不支持锥形（conic）渐变。
- 径向渐变不做中心点拖动（固定 `circle at center`）。
- 不做渐变预设色板（用户自行编辑色标即可）。
- 不做任意数量色标（上限 6）。

## 2. 数据模型

文件：`packages/shared/src/index.ts`。

```ts
export interface GradientStop {
  color: string;    // HEX，如 '#FF5C00'
  position: number; // 0–100（百分比）
}

export interface PageGradient {
  type: 'linear' | 'radial';
  angle?: number;        // 仅 linear；度数；默认 180（顶→底）
  stops: GradientStop[]; // 2–6 个，渲染前按 position 升序排序
}

export interface Page {
  id: string;
  name: string;
  components: EditorComponent[];
  bgColor?: string;
  bgGradient?: PageGradient;   // 新增
  bgImage?: string;
}
```

### 向后兼容
`bgGradient` 是纯新增可选字段。旧项目无此字段 → 仍按既有 `bgImage > bgColor > #fff` 渲染，**零迁移**。符合「持久化字段不可破坏性改名/删除」的既有规约（同 `ComponentType` 持久化约束：字段一旦写入 `Project.pages` JSON，rename/delete 会让已保存项目崩或失配）。

## 3. 渲染：消除三处重复，统一纯函数入口

### 现状问题
背景优先级逻辑（`bgImage > bgColor > #fff`）当前在三个渲染点复制粘贴：
- `apps/web/src/editor/Canvas.tsx:264-266`（编辑器画布）
- `apps/web/src/editor/preview/PageView.tsx:23-25`（预览 / 分享页 / PDF）
- `apps/web/src/editor/components/PageThumbnail.tsx:21-22`（侧栏缩略图）

新增渐变若不改结构，就要在三个地方各改一遍。因此顺手抽统一入口。

### 新增函数
1. **`gradientToCss(g: PageGradient): string`** — 放 `packages/shared/src/index.ts`（与 `getFontStack` / `normalizeTheme` 同级，纯函数，框架无关）。
   - 线性：`linear-gradient(${angle}deg, ${stops}...)`
   - 径向：`radial-gradient(circle at center, ${stops}...)`
   - **防御式归一**（在此函数内完成，渲染层单一入口最稳）：
     - stops 按 `position` 升序排序；
     - 每个 position clamp 到 `[0, 100]`；
     - stops 少于 2 → 用首/尾补齐到 2（缺色用相邻 stop 的 color）；
     - stops 多于 6 → 截断到 6；
     - color 非法 → 回退 `#FFFFFF`；
     - angle 缺省 180，clamp `[0, 360]`。
2. **`resolvePageBackground(page: Page): string`** — 放 `apps/web/src/editor/background.ts`（web 专属，因引用 bgImage/bgColor）。
   - `page.bgImage` → `'#fff url(...) center/cover no-repeat'`
   - 否则 `page.bgGradient` → `gradientToCss(page.bgGradient)`
   - 否则 `page.bgColor` → `page.bgColor`
   - 否则 → `'#fff'`
   - 三个渲染点（Canvas / PageView / PageThumbnail）全部改为调用此函数，删除内联重复逻辑。

### 优先级
**`bgImage > bgGradient > bgColor > #fff`**。

## 4. Store 变更

文件：`apps/web/src/editor/store.ts`。

- `updatePage` 与 `patchPageLive` 的 patch 类型：
  - 现：`Partial<Pick<Page, 'name' | 'bgColor' | 'bgImage'>>`
  - 改：`Partial<Pick<Page, 'name' | 'bgColor' | 'bgGradient' | 'bgImage'>>`
  - 实现体不变（已是浅合并 `{ ...p, ...patch }`）。

### 类型切换语义（单选互斥）
- **当前类型**由数据推导：
  `page.bgImage ? 'image' : page.bgGradient ? 'gradient' : page.bgColor ? 'color' : 'none'`。
- 切换到某类型时，**清掉另两个字段，只写新字段（+ 默认值）**，使持久化对象里始终最多一个背景字段，干净可预测。新增一个 panel 层辅助（不进 store 签名）：
  - → `color`：清 `bgGradient` + `bgImage`，写 `bgColor`（保留旧值或默认 `#FFFFFF`）。
  - → `gradient`：清 `bgImage` + `bgColor`，写 `bgGradient` 默认值（见下）。注意：把旧 `bgColor` 作为默认渐变第一 stop 后再清 `bgColor`（连续感）。
  - → `image`：清 `bgGradient`（bgImage 优先级最高，bgColor 保留无害，但为单选语义一并清掉）。
- **默认渐变**（切到 gradient 时）：
  - `type: 'linear'`，`angle: 180`；
  - stops：`[{ color: oldBgColor ?? '#FFFFFF', position: 0 }, { color: '#E5E7EB', position: 100 }]`。
- 渐变编辑期间的实时预览沿用 `patchPageLive`（不落 history），交互结束（onBlur / 增删色标 / 切子类型 / 改角度）再 `updatePage` 落一次 history（与现有 bgColor 的 live-draft → onBlur commit 模式一致，避免色板拖动刷爆 history、清空 redo 栈）。

## 5. UI

文件：`apps/web/src/editor/PropertyPanel.tsx` → `PageProperties`。

### 面板结构
```
页面属性
─────────────────────────
页面名：[ input ]
─────────────────────────
背景
[ 纯色 ] [ 渐变 ] [ 图片 ]      ← 类型单选 chip（当前类型高亮；'none' 时都不亮）
<按当前类型显示对应编辑器>
[清除背景]（任一背景字段非空时显示）
```

### 各类型编辑器
- **纯色**：保留现有 bgColor 取色器（color input + HEX 文本）+ live-draft / onBlur commit。逻辑不动。
- **渐变** → 新增 `<GradientFields page={page}>` 组件：
  - 子类型 toggle：`线性 | 径向`（chip）。
  - 线性时显示：
    - 方向快捷按钮组：`→ ↘ ↓ ↙ ← ↖ ↑ ↗`（对应 0 / 45 / 90 / 135 / 180 / 225 / 270 / 315）。
    - 角度数字框（0–360），与快捷按钮双向同步。
  - 渐变预览条：一个 `div`，`background = gradientToCss(bgGradient)`，高度约 24px，圆角。实时反馈，成本极低。
  - 色标列表：每行 `[取色器 input type=color] [位置 number 0–100] [✕ 删除]`。
    - 底部「+ 添加色标」：达到 6 个时禁用。
    - 删除：少于 2 个时禁用删除。
    - 新增 stop 位置：取末尾 stop 的 position 与 100 的中点，clamp 到 `[0,100]`；color 默认用前一 stop 的 color。
    - 输入端 clamp：position ∈ 0–100。
  - 编辑实时预览走 `patchPageLive`；以下时机 commit 一次 history：onBlur（位置输入）、增删色标、切子类型、改角度/方向。
- **图片**：保留现有 `ImageInput`。逻辑不动。
- **清除背景**：清掉 `bgColor / bgGradient / bgImage` 全部（`updatePage` 一次落 history）。

### 类型 chip 切换的实现
chip 点击 → 调 panel 辅助函数算出目标 patch（含清字段 + 写默认），一次 `updatePage` 提交（落 history）。

## 6. 边界与防御

- `gradientToCss` 渲染层防御式归一（排序 / clamp / 补齐 / 截断 / 非法色回退）——即使老数据或异常输入也不崩，是最后一道防线。
- 编辑器输入端也 clamp（angle、position、stop 数量）。
- 径向固定 `circle at center`（MVP 不做中心点拖动）。
- 切类型「破坏性」说明：单选语义下切到新类型会清掉旧字段（如 color→gradient 会丢原 bgColor）。这是显式模式切换的预期行为，文档与 UI 提示中说明。

## 7. 测试

遵循 web 既有测试约定（recharts 在 jsdom 中被 mock；仅断言 shell 文本）。

- **单测 `gradientToCss`**（shared）：
  - linear / radial 基本输出；
  - stops 按 position 升序；
  - position 超界 clamp（-5→0, 120→100）；
  - 单 stop 补齐到 2；
  - 7 个 stop 截断到 6；
  - angle 缺省回退 180、超界 clamp。
- **单测 `resolvePageBackground`**（web）：
  - 四种优先级：bgImage 命中 / bgGradient 命中 / bgColor 命中 / 全空回 `#fff`；
  - bgGradient 与 bgColor 同时存在时 bgGradient 胜出。
- **组件测 `PageProperties`**：
  - 当前类型 = 渐变时，渲染 `<GradientFields>`（断言出现「线性 / 径向」「添加色标」等 shell 文本）；
  - 点击「渐变」chip → `page.bgGradient` 被写入、`bgColor/bgImage` 被清；
  - 增删色标触发 `updatePage`（落 history）。

## 8. 影响面清单

- `packages/shared/src/index.ts`：新增 `GradientStop` / `PageGradient`；`Page` 加 `bgGradient?`；新增 `gradientToCss`。
- `apps/web/src/editor/background.ts`：新增 `resolvePageBackground`。
- `apps/web/src/editor/Canvas.tsx`、`preview/PageView.tsx`、`components/PageThumbnail.tsx`：背景表达式改为 `resolvePageBackground(page)`。
- `apps/web/src/editor/store.ts`：`updatePage` / `patchPageLive` patch 类型加 `bgGradient`。
- `apps/web/src/editor/PropertyPanel.tsx`：`PageProperties` 加类型 chip + `<GradientFields>`。
- 测试：新增 shared 与 web 单测 / 组件测。

## 9. 不在本期范围

- 渐变预设色板、conic 渐变、径向中心点拖动、全站主题级渐变 token。
