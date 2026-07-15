# 业绩看板·图标统一显示开关 + 每指标默认图标 — 设计

- 日期：2026-07-15
- 范围：`apps/web` 编辑器 + `packages/shared` 类型
- 相关组件：业绩看板 `kpi-board`（`KpiBoard.tsx`）

## 需求

业绩看板组件：每个指标都有对应的默认图标，支持选择显示图标或不显示图标（统一显示或统一不显示）。

## 现状

- 图标存于 `KpiBoardData.icons?: (string | null)[]`，按 `rows` 索引对齐；`null`/缺省 = 不显示。**仅 `card` 变体消费**（`KpiBoard.tsx:167`），其余 6 个变体不渲染图标。
- 属性面板 `KpiRowStyleField`（`apps/web/src/editor/property-panel/custom-fields.tsx:334-431`）每行一个图标按钮（→ `IconPickerOverlay`）+「清除」+ 逐行数值色 + 环比方向。面板有提示「图标仅在『卡片』变体下显示」（:361）。
- `apps/web/src/editor/defaults.ts:317` 给默认 KPI 集种子了图标 `['currency','currency','target','eye','cart','percent','currency','currency','eye']`（对应 GMV/Commission/ROAS/Clicks/Conversions/CVR/AOV/Spend/Impressions）。
- 用户新增或清空的行 = `null`（无图标）。`iconWeight?: IconWeight` 缺省 `'regular'`。
- 图标 catalog 在 `apps/web/src/editor/icons/catalog.ts`，`findIcon(key)` 返回 `{ key, label, category, Comp }`。

## 方案

**叠加式：保留逐行图标覆盖，新增全局 `showIcons` 开关 + 按指标名的智能默认图标 `defaultIconFor(label)`。**

渲染时有效图标 = `icons[i] ?? defaultIconFor(label)`，再被全局开关 gate。不删既有逐行自定义（需求未要求），向后兼容。

### 关键决策（已与用户确认）
- 开关仅管 `card` 变体（其余变体本就不渲染图标，最小改动）。
- 默认图标 = 按指标名关键词智能匹配（未设图标的行也回退默认）。
- 叠加式 A（保留逐行自定义），非替换式。
- `defaultIconFor` 兜底图标 = `target`。
- `showIcons` 缺省 `true`（向后兼容：现有 card 看板仍显示）。

## 改动清单

### 1. `packages/shared/src/types/editor.ts`（`KpiBoardData`）

新增字段：

```ts
/** 卡片变体是否统一显示图标；缺省 true（显示）。false 时所有行图标统一隐藏。 */
showIcons?: boolean;
```

（置于 `icons` 字段附近，约 :567 之后。）

### 2. 新文件 `apps/web/src/editor/kpiIcons.ts`

导出 `defaultIconFor(label: string): string` —— 按指标名关键词返回 catalog key，首条命中胜出、大小写不敏感、中英覆盖：

```ts
// 纯字符串匹配，无外部依赖。

interface Rule { re: RegExp; icon: string; }

// 顺序敏感：先 cart 再 currency，避免「销量」误判为金额；sales→currency、销量→cart 分开。
const RULES: Rule[] = [
  { re: /转化|conversion|convert|order|订单|purchase|购买|销量|成交|cart/i, icon: 'cart' },
  { re: /曝光|impression|view|reach|展示|观看|播放|play/i, icon: 'eye' },
  { re: /点击|click|tap/i, icon: 'target' },
  { re: /粉丝|follower|fan|关注|受众|audience/i, icon: 'users' },
  { re: /点赞|like|heart|互动|engagement/i, icon: 'heart' },
  { re: /分享|share/i, icon: 'share' },
  { re: /评论|comment|chat/i, icon: 'chat' },
  { re: /roas|roi|cvr|ctr|rate|ratio|率|比/i, icon: 'percent' },
  { re: /gmv|revenue|sales|销售|commission|spend|cost|aov|收入|营收|佣金|花费|消耗|客单|金额|预算|投放|费用|成本/i, icon: 'currency' },
  { re: /增长|trend|上升|growth/i, icon: 'trend-up' },
  { re: /达成|trophy|完成/i, icon: 'trophy' },
  { re: /热度|hot|fire|热门/i, icon: 'fire' },
];

const FALLBACK = 'target';

export function defaultIconFor(label: string): string {
  for (const { re, icon } of RULES) {
    if (re.test(label)) return icon;
  }
  return FALLBACK;
}
```

> 所有 icon key 均为 `catalog.ts` 已存在项（cart/eye/target/users/heart/share/chat/percent/currency/trend-up/trophy/fire）。

### 3. `apps/web/src/editor/components/report/KpiBoard.tsx`（card 变体，约 :163-167）

把图标解析改为开关 gate + 智能默认：

```ts
const showIcons = data.showIcons !== false;
// ...在 items.map 内（已有 it.label）：
const Icon = showIcons ? findIcon((data.icons?.[i] ?? defaultIconFor(it.label)) ?? undefined)?.Comp : undefined;
```

其余变体不动（现状不渲染图标）。

### 4. `apps/web/src/editor/property-panel/custom-fields.tsx`（`KpiRowStyleField`）

两处改动：

**(a) 顶部全局开关**（在「卡片样式（每行）」FieldGroup 内、`rows.map` 之前）：

```tsx
const showIcons = data.showIcons !== false;
// ...
<FieldGroup title="卡片样式（每行）">
  <div className="flex items-center justify-between">
    <span className="text-[11px] text-foreground-muted">图标仅在「卡片」变体下显示；关闭后统一不显示</span>
    <button
      onClick={() => update('showIcons', !showIcons)}
      className={`rounded border px-2 py-0.5 text-[11px] font-medium ${
        showIcons ? 'border-foreground-primary text-foreground-primary' : 'border-border-default text-foreground-muted'
      }`}
    >
      {showIcons ? '显示图标' : '已隐藏'}
    </button>
  </div>
  {rows.map((r, i) => { ... })}
```

**(b) 逐行图标按钮显示有效图标**（约 :363-384）。把按钮预览从「显式图标 or +」改为「有效图标 or +」：

```tsx
const iconKey = icons[i] ?? null;
const effectiveIcon = iconKey ?? defaultIconFor(r[0] ?? `行${i + 1}`);
const EffectiveIcon = findIcon(effectiveIcon)?.Comp;
// 按钮：
{EffectiveIcon ? <EffectiveIcon size={16} weight={weight} /> : <span className="text-[10px] text-foreground-muted">+</span>}
// 「清除」仅在显式设过（iconKey 非空）时出现，点击恢复默认（setIcon(i, null)）：
{iconKey && (<button onClick={() => setIcon(i, null)} ...>清除</button>)}
```

> 有效图标 = 显式 ?? 默认，与渲染一致。「清除」语义变为「恢复默认」（显式置 null）。

### 5. server schema

无需改 —— `projects.schema.ts:53` 的 `components: z.any()`，组件 data 透传。

## 向后兼容

- `showIcons` 缺省 `true`：现有 card 看板显式图标照常显示，行为不变。
- 智能默认：原本 `null` 图标的行现在显示默认图标（「每个指标都有对应的默认图标」的预期行为变化）；显式图标不受影响。无迁移。
- 逐行图标拾色器保留，既有自定义图标数据不丢。

## 测试与验证

- 新增 `apps/web/tests/kpi-icons.test.ts`：单测 `defaultIconFor`：
  - `'GMV'`→`'currency'`、`'Spend'`→`'currency'`、`'Impressions'`/`'曝光'`→`'eye'`、`'CVR'`→`'percent'`、`'Clicks'`/`'点击'`→`'target'`、`'Conversions'`/`'销量'`→`'cart'`、`'sales'`→`'currency'`、未知如 `'自定义指标 X'`→兜底 `'target'`、`'粉丝数'`→`'users'`、`'点赞'`→`'heart'`。
- `apps/web/tests/editor.kpi-board.test.tsx` 新增 card 变体用例：
  - `showIcons:false` → 不渲染图标（断言无图标节点）。
  - `showIcons:true` + 无 `icons` → 渲染 `defaultIconFor(label)` 对应图标。
  - 有显式 `icons[i]` → 渲染显式图标（覆盖默认）。
- 从 `apps/web` 跑 `pnpm test` + `pnpm typecheck`（[[web-vitest-run-from-root]]）。
- 手测：属性面板开关切换、逐行图标覆盖与「清除」恢复默认、新看板（defaults 全 null valueColors）各行默认图标正确。

## 不在本次范围

- 其他变体（grid/flat/compact/row/minimal/gradient）渲染图标 —— 用户确认仅 card 变体。
- 图标位置/样式重设 —— 沿用 card 变体现有图标渲染（圆形底 + token 色）。
