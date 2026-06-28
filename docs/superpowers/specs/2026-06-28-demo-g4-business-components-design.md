# demo.html 还原 · G4 业务组件库 设计文档

**日期**：2026-06-28
**作者**：ap + Claude（结对设计）
**状态**：设计已确认，待编写实现计划
**目标参考**：`demo.html`（MediaKit 报告编辑器原型）——本期为 demo.html 还原计划的**第二期（G4）**
**宿主**：`apps/web/src/editor/*`（G2 已交付的注册表驱动画布编辑器）
**前置**：G2 基础组件已完成（`REGISTRY` + `BlockDef` + schema 驱动 `PropertyPanel` 已上线，已合入 `main`）。

---

## 1. 背景与目标

G2 把画布扩到 7 类**基础**组件。G4 把 demo.html 的 **20 种业务组件**（营销复盘报告的真正主体：封面 / 里程碑 / Campaign 概览 / 达人资料卡 / 漏斗 / 套餐对比 …）补齐，让用户能搭出一份完整的投放复盘报告。

**忠实度策略：混合（hybrid）**——demo 的业务组件是手写像素级 HTML（每种 2–3 变体），全量逐像素复刻工作量过大且收益递减。本期**忠实移植 ~8 个标志性布局**（定义 demo 的营销报告观感），其余用少量**通用主题布局**兜底，既保留 demo 灵魂又把工作量压到可控。

### 1.1 范围（含）

- 20 种业务组件 kind（5 个分组），每种：默认数据、画布渲染、属性面板编辑、库面板添加
- generic 数据模型 `BusinessBlockData`（**一个**接口覆盖全部 20 种，非 20 个 typed 接口）
- 组件 catalog（kind → group/icon/name/defaultData/variant 选项），port 自 demo `BUSINESS_COMPONENTS`
- ~8 个 signature 布局渲染器（JSX port 自 demo）+ 1 套 generic 主题布局（standard/cards/accent）
- 业务组件**分组库面板**（添加入口，替代平铺工具栏）
- 复用 G2 的 `REGISTRY`（二级分发）+ schema 驱动 `PropertyPanel`

### 1.2 非目标（YAGNI，后续期）

- G1 交互补全（多选/撤销重做/复制粘贴/键盘/锁定/图层）
- G3 页面管理（增删/改名/排序/缩略图/模板）
- G5 数据源真实绑定（demo 里业务组件数据也是写死占位，本期沿用占位默认数据）
- G6 预览模式、导出（P4）
- 业务组件库的搜索/收藏/自定义模板（demo 也没有）

---

## 2. 数据模型（`packages/shared/src/index.ts` 扩展）

业务组件与基础组件的关键区别：**20 种 kind 共享同一个 generic 数据形状**（demo 即如此：`type:'business-block'` + `data.businessKind` 区分）。

```ts
// BasicComponentType 追加一个成员（注册表只 +1 条，不让 type 联合膨胀）
export type BasicComponentType =
  | 'text' | 'image'
  | 'indicator-card' | 'bar-chart' | 'line-chart' | 'pie-chart' | 'table'
  | 'business-block'

export type BusinessVariant =
  | 'standard' | 'cards' | 'accent' | 'stats' | 'light' | 'table' | 'results'

export interface BusinessBlockData {
  businessKind: string          // cover | agenda | milestone | ... | funnel（20 种之一）
  title: string
  meta: string
  details: string[]             // 通用条目数组（里程碑节点 / 漏斗层级 / 达人名单 / ...）
  variant: BusinessVariant      // 渲染变体；signature 布局各自支持其专用变体
  layoutForm?: string           // demo 透传的展示形式文案（属性面板只读展示，可选）
}
```

`EditorComponent.data` 联合追加 `BusinessBlockData`。后端 `pages` 仍是不透明 JSON，无需改后端；G2 已存的 text/image/图表项目不受影响。

> **不变量**：`data.businessKind` 决定布局分发；`data.variant` 决定布局内变体。属性面板编辑 title/meta/details/variant，**不改 businessKind**（kind 在添加时定，只读）。

---

## 3. 注册表与二级分发（架构 A）

demo 数据模型是 `type:'business-block'` + `businessKind` 区分。本期采用**单 type + businessKind 二级分发**（而非把 20 种 kind 各注册成独立 type）：

- `REGISTRY['business-block']` = 一个 `BlockDef`，其 `Block` 内部按 `data.businessKind` 分发到具体布局渲染器。
- 注册表只多 1 条；`BasicComponentType` 只多 1 个成员。
- catalog（§4）单独提供 20 kind 的元信息，供库面板与属性面板消费（**不**进 `BasicComponentType` 联合）。

```
ComponentView → REGISTRY['business-block'].Block
                  └─ BusinessBlock → 按 data.businessKind 选 signature 布局 / generic 兜底
                                       └─ 按 data.variant 选布局内变体
```

`store` 新增 `addBusinessBlock(kind: string)`：用 catalog 的 defaultData + 固定 defaultSize（取自 demo `BUSINESS_COMPONENT_LAYOUTS`）构建组件，落到当前页并选中。`addComponent('business-block')` 不直接用（无 businessKind）。

---

## 4. Catalog（`apps/web/src/editor/blocks/business/catalog.ts`）

port 自 demo `BUSINESS_COMPONENTS`（`demo.html:1139`）+ `BUSINESS_COMPONENT_LAYOUTS`（`:1176`，给 defaultSize）+ `BUSINESS_STYLE_OPTIONS`（变体选项）。一个 `Record<string, BusinessKindMeta>`：

```ts
export interface BusinessKindMeta {
  kind: string
  group: string                 // 基础页面 / 公司与服务 / 策略与方案 / 案例与结案 / 报价与工具
  icon: string                  // ◆ ☷ ↗ ... （demo 内联字符）
  name: string                  // 中文展示名（封面信息 / 目录导航 / ...）
  desc: string
  defaultSize: { w: number; h: number }   // 取自 BUSINESS_COMPONENT_LAYOUTS
  defaultData: () => Omit<BusinessBlockData, 'variant'> & { variant: BusinessVariant }
  variants: BusinessVariant[]             // 该 kind 支持的变体（属性面板 select 选项）
}
```

**20 种 kind（5 组）**：

| 组 | kind |
|---|---|
| 基础页面 | cover, agenda |
| 公司与服务 | milestone, global, brand-wall, org, service |
| 策略与方案 | challenge, process, calendar, campaign-plan |
| 案例与结案 | case-showcase, campaign-overview, creator-list, creator-profile, content-analysis, retrospective |
| 报价与工具 | package, report, funnel |

> `defaultData` 直接用 demo catalog item 的 `{title, meta, details}` 作为占位默认值（与 demo 一致；真实数据接入留给 G5）。

---

## 5. 布局渲染（`apps/web/src/editor/blocks/business/`）

### 5.1 缩放 util

demo 用 `px = n => n * scale`（`demo.html:1243`），`scale` 按组件实际宽 vs 基准宽计算，使模板自适应组件框。本期提供：

```ts
// blocks/business/scale.ts
export function useScale(w: number, base = 580): (n: number) => number {
  return (n) => (n * w) / base
}
```

signature 布局接收组件 `w`（来自 `EditorComponent.w`），用 `px()` 缩放内边距/字号/网格列宽。generic 布局用 Tailwind 流式 + flex，不强依赖 px 缩放。

### 5.2 Signature 布局（忠实 port，~8 模板覆盖 10 kind）

demo 多 kind 共享同一布局（org≡service、process≡campaign-plan、content-analysis≡funnel），故实际只需 ~8 个模板：

| 布局文件 | 覆盖 kind | 专用变体 |
|---|---|---|
| `layouts/cover.tsx` | cover | `light` |
| `layouts/campaign-overview.tsx` | campaign-overview | `stats` |
| `layouts/creator-profile.tsx` | creator-profile | `stats` |
| `layouts/funnel.tsx` | funnel, content-analysis | — |
| `layouts/process.tsx` | process, campaign-plan | `cards` |
| `layouts/milestone.tsx` | milestone | — |
| `layouts/brand-wall.tsx` | brand-wall | — |
| `layouts/package.tsx` | package | `table` |

每个布局：JSX port 自 demo 对应 `renderBusinessBlock` 分支，保留配色（`#FF5C00`/`#1A1A1A`/...）、网格（`grid-template-columns`）、`IBM Plex Mono`/`Funnel Sans` 字体引用、专用变体分支。空 details 时降级（不崩）。

### 5.3 Generic 布局（兜底 ~9 kind）

`layouts/generic.tsx`：通用主题布局，接收 `{title, meta, details, variant, businessKind}`，按 `variant` 选三套：

- `standard`：标题 + meta + details 纵向条目列表（左边框强调）
- `cards`：details 卡片网格
- `accent`：橙色边框 + 阴影强调版 standard

兜底 kind：agenda, global, org, service, challenge, calendar, creator-list, case-showcase, retrospective, report。（注：org≡service 也走 generic——demo 里它们布局简单，generic 足够；若实测差距大可后续提升为 signature。）

### 5.4 分发

`BusinessBlock`（`REGISTRY['business-block'].Block`）：

```ts
const SIGNATURE = { cover, 'campaign-overview', 'creator-profile', funnel, 'content-analysis',
                    process, 'campaign-plan', milestone, 'brand-wall', package }
// 按 data.businessKind 命中 signature 用对应布局，否则 generic
```

---

## 6. 业务组件库面板（添加 UI）

20 个组件不适合平铺进 `Toolbar`。新增**分组库面板**（port demo `renderBusinessMenu` `demo.html:1228` + 顶部「业务组件」按钮 `:951`）：

- `Toolbar` 加一个「业务组件」按钮，点击展开/收起分组浮层（或常驻左侧抽屉）。
- 浮层按 5 个 group 分组，每项：`icon` + `name` + `desc`（+ defaultSize 提示），点击 → `addBusinessBlock(kind)` → 落到当前页并选中、关闭浮层。
- 基础组件（text/image/...）仍用现有 `Toolbar` 的 `+` 按钮（G2）。

> 实现细节（浮层 vs 抽屉、定位）在 plan 阶段定；本期只要「分组列表 + 点击添加」可用。

---

## 7. 属性面板（复用 G2 schema 驱动）

`business-block` 选中时，`PropertyPanel` 读一个**统一的** business schema（不进 catalog，因 20 kind 共用）：

- `title` → text
- `meta` → textarea
- `details` → list（itemFields: 单个 text「条目」）—— 复用 G2 `ListEditor`
- `variant` → select，**options 按 `data.businessKind` 动态取自 `catalog[kind].variants`**
- `businessKind` → 只读展示（`catalog[kind].name`）

位置/尺寸（x/y/w/h）网格与 `删除组件` 按钮沿用 G2。

> variant 的动态 options 需要 `PropertyPanel` 能按选中组件的 businessKind 解析 options——在 `REGISTRY['business-block'].propertySchema` 里用函数式 options 或在面板内特判 business-block。plan 阶段定具体写法（倾向：business-block 的 propertySchema 在面板内按 kind 现取，其余 type 走静态 schema）。

---

## 8. 错误处理

- 未知 `businessKind`（旧数据/手改）→ 走 generic 布局，不崩；catalog 查无 → 用 fallback meta `{icon:'▦', name:'业务组件'}`。
- `details` 为空数组 → signature 布局降级渲染（标题/meta 仍在），generic 显示「无数据」占位。
- signature 布局收到不支持的 `variant` → 回退该布局的 `standard`。

---

## 9. 测试（vitest + @testing-library）

- **catalog 完整性**：20 kind 齐全，每个有 group/icon/name/defaultSize/defaultData/variants。
- **注册表**：`REGISTRY['business-block']` 存在；`EditorComponent.type` 联合含 `'business-block'`。
- **signature 布局渲染**：每个 signature 布局用默认 data 渲染，断言关键文案/结构（如 cover 显示 title；campaign-overview 显示 details 数；package 渲染套餐卡）。
- **generic 布局**：兜底 kind（如 agenda）渲染 title + details；空 details 显示占位。
- **分发**：`BusinessBlock` 对 signature kind 与 generic kind 分别命中正确布局。
- **store.addBusinessBlock(kind)**：生成 `type:'business-block'` + 正确 `businessKind` + defaultData + defaultSize。
- **库面板**：渲染 5 组 20 项；点击某项触发 `addBusinessBlock(kind)`。
- **属性面板**：选 business-block → 改 title/details/variant → store 更新；variant 选项随 businessKind 变化。

---

## 10. 不在范围（显式留后续期）

G1 交互 / G3 页面管理 / G5 数据源 / G6 预览 / 导出。业务组件的真实数据绑定（G5）不在本期——沿用 demo 写死的占位默认数据。

---

## 11. demo.html 参考行号（供 plan）

- 业务组件 catalog `BUSINESS_COMPONENTS` `:1139`｜`BUSINESS_BY_ID` `:1172`
- defaultSize `BUSINESS_COMPONENT_LAYOUTS` `:1176`｜变体选项 `BUSINESS_STYLE_OPTIONS`（`:1210` 附近）｜`getBusinessStyleOptions` `:1222`
- 布局渲染 `renderBusinessBlock` `:1240-1300`｜`px()` `:1243`｜`base()` `:1246`
- 库面板 `renderBusinessMenu` `:1228`｜顶部「业务组件」按钮 `:951`
- 添加 + 默认数据 `addBusinessComponent`（`:2055` 附近）｜`data: { businessKind, layoutForm, title, meta, details }` `:2082`
