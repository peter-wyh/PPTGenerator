# 基础图形组件（shape）设计

日期：2026-07-07

## Goal

编辑器基础组件新增「矩形 / 圆角矩形 / 圆形 / 直线」4 种基础图形，用于版式分隔、装饰、容器底板等。采用**单一 `shape` type + `data.shape` 字段**，复用 `business-block` 的「1 type + 子类型」模式。

## Background

现有基础组件：`text / image / indicator-card / table / bar-chart / line-chart / pie-chart`。缺少纯几何图形（矩形/圆/线），做版式时只能用表格/图片凑。本设计补齐基础图形。

## Architecture：方案 B（单 `shape` type + `data.shape`）

- `ComponentType` 加 `'shape'`，一个 `ShapeData`
- 一个 `ShapeComponent` 按 `data.shape` 分支渲染
- ComponentPanel 列 4 个入口，拖入时预设 `data.shape`，复用 business 的 `op` 拖放模式 + 新增 `addShape(shape)`
- 属性面板用自定义 `ShapeFields`（条件属性：rounded→圆角、line→虚线、line→无 fill）

放弃方案 A（4 个独立 `rectangle`/`rounded-rect`/`circle`/`line` type）：4 套近乎相同的 data，DRY 差，新增形状要改 6 层 ×N。

## 数据模型（`packages/shared/src/index.ts`）

```ts
// ComponentType 追加
| 'shape'

export type ShapeKind = 'rectangle' | 'rounded' | 'circle' | 'line';

export interface ShapeData {
  shape: ShapeKind;
  fill?: string;          // 填充色（line 无）
  stroke?: string;        // 描边色
  strokeWidth?: number;   // 描边粗细（0 = 无描边）
  opacity?: number;       // 0–1
  rotation?: number;      // 度
  borderRadius?: number;  // 仅 rounded
  dash?: boolean;         // 仅 line（虚线）
}
```

`ComponentData` 联合追加 `ShapeData`。`ComponentType` 是 string 联合，加 `'shape'` 不破坏旧数据（旧项目无 shape 组件）。

## 组件实现（`apps/web/src/editor/components/BasicComponents.tsx`）

新增 `ShapeComponent({ data }: { data: ShapeData })`：

- 外层 `<div className="h-full w-full" style={{ opacity: data.opacity ?? 1, transform: data.rotation ? \`rotate(${data.rotation}deg)\` : undefined }}>`
- `rectangle`：内层 `<div>` 占满，`backgroundColor=fill`，`border = strokeWidth>0 && stroke ? \`${strokeWidth}px solid ${stroke}\` : undefined`
- `rounded`：同 rectangle + `borderRadius: data.borderRadius ?? 12`
- `circle`：同 rectangle + `borderRadius: '50%'`（椭圆由组件 w/h 决定）
- `line`：`<svg className="h-full w-full" preserveAspectRatio="none"><line x1="0" y1="50%" x2="100%" y2="50%" stroke={stroke ?? '#E5E7EB'} strokeWidth={strokeWidth ?? 1} strokeDasharray={dash ? '8 4' : undefined} /></svg>`；line 不渲染 fill

与现有 text/image 一致：`(data) => JSX`，data 驱动，`ComponentRenderer` 直读 `comp.data`。

## 编辑器集成

### store（`apps/web/src/editor/store.ts`）

- `addShape(shape: ShapeKind)`：仿 `addBusinessBlock(kind)`。按 shape 决定默认尺寸（line `{ w: 200, h: 4 }`，其余 `{ w: 200, h: 120 }`），居中落点（复用 `placed`/`centered`），创建 `{ id, type:'shape', x, y, width, height, data: getDefaultShapeData(shape) }`，落 history + 标脏。
- `addShapeAt(shape, x, y)`：拖放落点版（仿 `addBusinessBlockAt`）。
- `EditorState` 接口加这两个方法声明。

### ComponentPanel（`apps/web/src/editor/ComponentPanel.tsx`）

- 基础组件组 `GROUPS[0].items` 追加 4 项：`{ type:'shape', shape:'rectangle', label:'矩形', icon:'▭' }`、`{ type:'shape', shape:'rounded', label:'圆角矩形', icon:'▢' }`、`{ type:'shape', shape:'circle', label:'圆形', icon:'◯' }`、`{ type:'shape', shape:'line', label:'直线', icon:'─' }`。
- `PalettePayload` 追加 `{ op:'shape'; shape: ShapeKind }`。
- 拖放 drop：`op === 'shape'` → `addShapeAt(shape, x, y)`。

### REGISTRY（`apps/web/src/editor/registry.tsx`）

```ts
'shape': {
  Component: ShapeComponent,
  defaultSize: DEFAULT_SIZES['shape'],   // { w: 200, h: 120 }
  defaultData: () => getDefaultData('shape'),
  propertySchema: [],                    // 用自定义 ShapeFields，不挂通用 schema
}
```

REGISTRY 只一个 `'shape'` 条目；4 个组件库入口的 shape 差异通过 `addShape(shape)` 传入，不入 REGISTRY。

### defaults（`apps/web/src/editor/defaults.ts`）

- `DEFAULT_SIZES['shape'] = { w: 200, h: 120 }`（line 由 `addShape` 内部覆盖为 `{ w: 200, h: 4 }`）。
- `getDefaultData('shape')`：返回 rectangle 默认 `{ shape:'rectangle', fill:'#FF5C00', stroke:'#E5E7EB', strokeWidth:0, opacity:1, rotation:0 }`。
- `getDefaultShapeData(shape: ShapeKind)`：按 shape 返回——rectangle/circle 用上面默认；rounded 加 `borderRadius:12`；line 去掉 fill、加 `dash:false`、默认 `strokeWidth:1`。

### PropertyPanel（`apps/web/src/editor/PropertyPanel.tsx`）

- `LABELS['shape'] = '图形'`。
- 挂载：`{comp.type === 'shape' && <ShapeFields comp={comp} />}`（仿 `BusinessFields`）。
- `ShapeFields`：形状 selector（4 选，切换写 `data.shape`，切换时若新 shape 是 line 清 fill、若 rounded 补 borderRadius）+ 填充色（非 line）+ 描边色 + 描边粗细 + 透明度（0–1 input）+ 旋转（度 input）+ 圆角半径（仅 rounded）+ 虚线开关（仅 line）。统一走 `updateComponentData(id, {...})`。

## 测试

- `packages/shared`：`shared.types.test` 加 `ShapeData`/`ShapeKind` 类型快照。
- `apps/web/tests/registry.test.ts`：`'shape'` 已注册 + 4 种 shape 渲染不抛错。
- 新 `apps/web/tests/editor.shape.test.tsx`：
  - `ShapeComponent` 4 形状渲染——rectangle 有 backgroundColor、rounded 有 borderRadius、circle `border-radius:50%`、line 渲染 `<line>` 且无 fill。
  - 透明度/旋转/dash 应用到 style/svg。
  - `ShapeFields`：line 不显示填充色、rounded 显示圆角、切换 shape 写入 `data.shape`。
- 约定：recharts 在 jsdom 被 mock；shape 不涉及 recharts，直接断言 DOM（`border-radius`/`background-color`/svg `<line>`）。

## 决策记录

- **方案 B 而非 A**：DRY，属性面板可切换形状，复用 business-block「1 type + 子类型」先例。
- **circle = div + border-radius:50%**：简单，椭圆随 w/h；SVG ellipse 无额外价值。
- **line = SVG**：支持 `strokeDasharray` 虚线 + 两端精确占满；div 旋转条做不到虚线。
- **旋转 MVP 仅视觉**：内层 `transform: rotate`，选择框/碰撞仍按原 w/h；够装饰用，后续按需升级。

## 不做（YAGNI）

- 三角形 / 箭头 / 星形（本次未选；后续按需加 `ShapeKind`，data 兼容）。
- 渐变填充、阴影、图片填充、双描边。
- 旋转的精确碰撞 / 旋转后的选择框。
- 形状间的组合 / 布尔运算。

## 影响层

| 层 | 改动 |
|---|---|
| `packages/shared/src/index.ts` | `ComponentType` + `ShapeData`/`ShapeKind` + `ComponentData` 联合 |
| `BasicComponents.tsx` | + `ShapeComponent` |
| `store.ts` | + `addShape` / `addShapeAt` |
| `ComponentPanel.tsx` | + 4 入口 + `op:'shape'` payload + drop 分发 |
| `registry.tsx` | + `'shape'` 条目 |
| `defaults.ts` | + `DEFAULT_SIZES['shape']` + `getDefaultData('shape')` + `getDefaultShapeData` |
| `PropertyPanel.tsx` | + `LABELS['shape']` + `ShapeFields` 组件 |
| 测试 | `shared.types` / `registry` / 新 `editor.shape` |
