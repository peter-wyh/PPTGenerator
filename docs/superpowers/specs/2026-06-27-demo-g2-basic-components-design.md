# demo.html 还原 · G2 基础组件补齐 设计文档

**日期**：2026-06-27
**作者**：ap + Claude（结对设计）
**状态**：设计已确认，待编写实现计划
**目标参考**：`demo.html`（MediaKit 报告编辑器原型）——本期为 demo.html 还原计划的**第一期（G2）**
**宿主**：`apps/web/src/editor/*`（已交付的画布编辑器 MVP）

---

## 1. 背景与目标

当前编辑器 MVP 只有 text/image 两种组件。本期把 demo.html 的 **7 个基础组件**补齐：在 text/image 之外新增 **指标卡 / 柱状图 / 折线图 / 饼图 / 表格**，让用户能真正搭出一份投放复盘报告。

引入**组件注册表**重构现有 MVP 的 `switch(type)` 渲染，使后续加组件（业务组件 G4）只需「写一个文件 + 注册一行」。

### 1.1 范围（含）

- 5 个新组件类型：`indicator-card` / `bar-chart` / `line-chart` / `pie-chart` / `table`
- 每类型：默认数据、画布渲染、属性面板编辑、工具栏添加
- 组件注册表 `REGISTRY`：`{ defaultData, Block, propertySchema }` per type
- 用 **recharts** 实现柱状/折线/饼图（demo 里 line/pie 是占位空壳、bar 是 CSS 百分比条，本期做真图表）
- `ComponentView` / `PropertyPanel` / `store.addComponent` / `Toolbar` 改为注册表驱动

### 1.2 非目标（YAGNI，后续期）

- G1 交互补全（多选/框选/撤销重做/复制粘贴/键盘/锁定/图层）
- G3 页面管理（增删/改名/排序/缩略图/模板）
- G4 业务组件库（21 种 business-block）
- G5 数据源真实绑定（demo 里也是空壳）
- G6 预览模式、导出（P4）
- 组件库拖入画布（本期仍用工具栏「+」按钮添加，与 MVP 一致）

---

## 2. 数据模型（`packages/shared/src/index.ts` 扩展）

```ts
export type BasicComponentType =
  | 'text' | 'image'
  | 'indicator-card' | 'bar-chart' | 'line-chart' | 'pie-chart' | 'table'

export interface IndicatorCardData {
  title: string
  value: string
  trend: string
  trendUp: boolean
  colorTheme: 'blue' | 'green' | 'orange' | 'purple'
}

export interface BarChartDatum { label: string; value: number; color: string }
export interface BarChartData { title: string; bars: BarChartDatum[] }

export interface LineChartPoint { label: string; value: number }
export interface LineChartData { title: string; points: LineChartPoint[] }

export interface PieChartSlice { label: string; value: number; color: string }
export interface PieChartData { title: string; slices: PieChartSlice[] }

export interface TableData { headers: string[]; rows: string[][] }
```

`EditorComponent.type` 放宽为 `BasicComponentType`；`EditorComponent.data` 改为上述 7 个 Data 接口的联合（text/image 沿用现有 `TextData`/`ImageData`）。

> 后端 `pages` 是不透明 JSON，无需改后端；P0 已存的 text/image 项目不受影响。

---

## 3. 组件注册表（`apps/web/src/editor/blocks/`）

每个类型一个文件 `blocks/<type>.tsx`，导出：

```ts
interface PropertyField {
  key: string                 // data 内的键（标量）或数组键（list/table）
  label: string
  kind: 'text' | 'textarea' | 'number' | 'color' | 'select' | 'list' | 'table'
  options?: string[]          // kind='select' 时
  itemFields?: { key: string; label: string; kind: 'text'|'number'|'color' }[]
                             // kind='list' 时每项的子字段
}
interface BlockDef {
  defaultData: () => unknown
  Block: React.FC<{ data: unknown }>
  propertySchema: PropertyField[]
  label: string               // 工具栏按钮文案，如「+ 柱状图」
}
```

`blocks/index.ts`：
```ts
export const REGISTRY: Record<BasicComponentType, BlockDef> = {
  text: TextBlockDef,
  image: ImageBlockDef,
  'indicator-card': IndicatorCardDef,
  'bar-chart': BarChartDef,
  'line-chart': LineChartDef,
  'pie-chart': PieChartDef,
  table: TableBlockDef,
}
```

消费方：
- `ComponentView`：`const Def = REGISTRY[comp.type]; return <...><Def.Block data={comp.data} /></...>`（选中描边/8 向 handle/拖动缩放全部不变）
- `store.addComponent(type)`：`const data = REGISTRY[type].defaultData()`，其余逻辑不变
- `Toolbar`：`Object.entries(REGISTRY).map(([t, def]) => <Button onClick={()=>addComponent(t)}>{def.label}</Button>)`
- `PropertyPanel`：按 `REGISTRY[type].propertySchema` 通用渲染（见 §5）

---

## 4. 渲染

| 类型 | 渲染 |
|---|---|
| text / image | 沿用现有 TextBlock / ImageBlock |
| indicator-card | 主题色卡片：title（小字）+ value（大字）+ trend（带 ↑/↓ 箭头，trendUp 决定颜色）；colorTheme → 4 套色 token |
| bar-chart | recharts `<BarChart>`：bars=[{label,value,color}]，每柱用其 color；`<ResponsiveContainer>` 撑满组件 w/h |
| line-chart | recharts `<LineChart>`：points=[{label,value}] 单系列折线 + 坐标轴 |
| pie-chart | recharts `<PieChart>`：slices=[{label,value,color}] + legend |
| table | 原生 `<table>`：headers 表头 + rows 表体，斑马纹 |

图表统一用 `<ResponsiveContainer width="100%" height="100%">` 适配组件框；data 为空时显示占位「无数据」。

---

## 5. 属性编辑（schema 驱动的 `PropertyPanel`）

`PropertyPanel` 读 `REGISTRY[selectedType].propertySchema`，逐字段渲染：

- `text` → `<Input>`；`textarea` → `<textarea>`；`number` → `<Input type=number>`；`color` → `<Input type=color>`；`select` → `<select>`
- `list`（如 bars/slices/points）：每项一行，按 `itemFields` 渲染子输入 + 「删除」；底部「+ 添加」；改动 → 重写整个数组字段
- `table`：headers 一行（每列一个 input + 删列 + 加列）；rows 多行（每行 = 每列一个 input + 删行 + 加行）

改值统一调 `updateComponent(id, { data: { [key]: newValue } as never })`（store 已对 data 做浅合并）。位置/尺寸（x/y/w/h）编辑保留在面板底部（与 MVP 一致）。

**各类型 schema 示例**：
- indicator-card：`[title(text), value(text), trend(text), trendUp(select[↑,↓]), colorTheme(select[blue,green,orange,purple])]`
- bar-chart：`[title(text), bars(list[itemFields: label(text), value(number), color(color)])]`
- line-chart：`[title(text), points(list[label(text), value(number)])]`
- pie-chart：`[title(text), slices(list[label(text), value(number), color(color)])]`
- table：`[table(headers, rows)]`
- text/image：沿用现有字段。

---

## 6. 工具栏与添加

`Toolbar` 把现有的「+ 文本 / + 图片」改为遍历 `REGISTRY` 生成全部 7 个按钮（文本 / 图片 / 指标卡 / 柱状图 / 折线图 / 饼图 / 表格）。点击 → `addComponent(type)` → 用 `defaultData()` 落到当前页并选中。

---

## 7. 错误处理

- 图表 data 为空数组 → 渲染「无数据」占位，不崩。
- 表格 headers/rows 长度不一致 → 按各自长度渲染（不强制对齐）。
- 未知 `type`（旧数据兼容）→ `ComponentView` 兜底渲染「未知组件」占位 + 注册表查找时 `REGISTRY[type] ?? fallback`。

---

## 8. 测试（vitest + @testing-library）

- **注册表完整性**：`REGISTRY` 7 个类型齐全，每个都有 `defaultData/Block/propertySchema/label`。
- **每类型 Block 渲染**：用默认 data 渲染，断言关键文案/结构（如 indicator-card 显示 value；table 渲染 headers 数；图表渲染 `.recharts-wrapper`）。
- **store.addComponent**：各类型生成带正确 `type` 与 `defaultData` 的组件。
- **PropertyPanel**：选 indicator-card → 改 value → store.data.value 更新；bar-chart 的 list 字段「+ 添加」一项 → bars.length +1。
- **Toolbar**：渲染 7 个添加按钮。

---

## 9. 不在范围（显式留后续期）

G1 交互补全 / G3 页面管理 / G4 业务组件库 / G5 数据源 / G6 预览 / 导出。

---

## 10. demo.html 参考行号（供 plan）

component data 默认 `getDefaultData` `demo.html:2091`｜renderComponent switch `:1538`｜bar/line/pie/table 渲染分支 `:1538-1700`｜左侧组件库面板 `:1674`。line/pie 在 demo 里为占位（`:1538` 附近空分支），本期以 recharts 实做。
