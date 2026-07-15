# 全局样式设置弹窗改造：分类导航 + 移除皮肤质感 + 业务线 Logo

- **日期**:2026-07-14
- **状态**:已通过设计评审,待写实现计划
- **范围**:前端弹窗重构 + shared/server `skinPreset` 字段移除与迁移(含持久化兼容)

## 1. 背景

「全局样式设置」浮层(`ReportSettingsOverlay.tsx`)当前是 `max-w-lg`(512px)单列,13 个区块纵向平铺,字段多、滚动长、无分类。

三个问题:

1. **无分类、弹窗窄**——预设/配色/字体/标题/密度/圆角/皮肤质感/布局/行高/币种/图表/阴影/品牌/背景/参考图 全部平铺,查找成本高。
2. **圆角 / 卡片阴影 / 皮肤质感 三者重复**——`皮肤质感`(skinPreset `flat`/`elevated`)在 `theme.tsx` 里写入 `--skin-radius-card`/`--skin-shadow-card`,`index.css` 的 `.skin-card*` 用 `var(--skin-X, var(--radius-card))` 取值,即 skinPreset **静默覆盖**了 `圆角`(`--radius-card`)和 `卡片阴影`(`--shadow-card`)。代码注释却声称三者「正交」,实际冲突。
3. **弹窗无业务线标识**——业务线 Logo(`BUSINESS_LINE_META[projectMeta.businessLine].logo`)已在编辑画布(`Canvas.tsx:348`)和预览/导出(`PageView.tsx:61`)右上角渲染,唯独全局样式弹窗没有,用户配置样式时看不出在为哪条业务线配置。

## 2. 关键决策(评审已定)

| 决策点 | 结论 | 理由 |
|---|---|---|
| 弹窗布局 | 左侧分类导航 + 右侧内容,`max-w-4xl` | 用户选定;分类清晰、长列表不挤 |
| 分类划分 | 基础样式 / 布局 / 组件样式 / 品牌(4 组) | 用户给定「基础样式、布局、组件样式等」;品牌独立成组 |
| 皮肤质感处理 | **彻底移除** `skinPreset` 字段(类型 + schema + UI + CSS 覆盖),迁移已持久化值 | 用户选定;消除静默覆盖,圆角+卡片阴影成唯一真源 |
| 迁移规则 | `flat`→(radius=`sharp`,shadow=`none`);`elevated`→(radius=`large`,shadow=`strong`);其余不变 | 复刻 flat/elevated 既有的视觉意图(扁平=无阴影+直角;浮起=深阴影+大圆角);skinPreset 本就覆盖 radius,迁移覆盖不丢用户可见状态 |
| 预设保留视觉 | `tech-minimal` 补 `shadow:'none'`;`vibrant-trendy` 补 `shadow:'strong'`;二者删 `skinPreset`;`applyPreset` 透传 `shadow` | 移除 skinPreset 后靠 shadow 字段复刻原 flat/elevated 阴影;radius 两预设已分别 `sharp`/`large` |
| 业务线 Logo 位置 | 弹窗标题栏右上角(✕ 左侧) | 用户选定;画布/预览已有,弹窗是唯一缺失面 |
| Logo 来源 | `BUSINESS_LINE_META[businessLine].logo/.name`(`@/projectsMeta`) | 用户指定;与画布同源,非「品牌」分类里可编辑的 `branding.logo` |
| `skinPreset` 是否保留为死字段 | 否,全删 | 防御式解析的样式标志、非注册查找键,删除不崩(区别于 ComponentType) |

## 3. 不在本次范围(明确划界)

- ❌ **不改「品牌」分类的可编辑 Logo 上传**(`theme.branding.logo`)——仅弹窗标题栏追加只读业务线 Logo。
- ❌ **不动画布/预览已有的业务线 Logo 渲染**——已在 `Canvas.tsx`/`PageView.tsx` 右上角,本轮不改其样式。
- ❌ **不重构 `applyPreset` 未透传的其他 v2 字段**(lineHeight/format/chart/background/heading/branding)——既有行为,仅本轮因移除 skinPreset 顺带补 `shadow` 透传。
- ❌ **不简化 `index.css` 的 `.skin-card*` 选择器**——保留 `var(--skin-X, var(--radius-card))` 回退;`--skin-X` 不再被设置,自然回退到 `--radius-card`/`--shadow-card`,零行为变化,降低改动面。
- ❌ **无 Prisma 迁移**——`skinPreset` 存于 `Project.theme` JSON,Zod `.optional()` 字段移除 + `normalizeTheme` 兜底即兼容,无需 SQL。

## 4. A. 弹窗重构:左侧分类导航 + 右侧内容

**外壳**:`max-w-lg`→`max-w-4xl`(~896px),`max-h-[90vh]` 保留。三段式:

- **标题栏**:左侧标题「全局样式设置」+ 副标题;右侧业务线 Logo + 名称(C 块)+ ✕ 关闭。
- **主体**:`flex`——左侧导航 `w-52` flex-none + 右侧 `flex-1 overflow-y-auto` 内容。
- **底部**:取消 / 保存(不变)。

**左侧导航 4 项**(默认选中「基础样式」,`useState<string>` 记 active):

| 分类 | 包含区块(沿用现有 JSX,仅搬运) |
|---|---|
| 基础样式 | 整体风格预设、配色、字体、标题样式、行高、币种与数字、密度、解析参考图 |
| 布局 | 安全距离、网格大小、显示网格/安全区 |
| 组件样式 | 圆角、卡片阴影、图表样式、默认页面背景 |
| 品牌 | Logo、品牌标题、品牌副标题 |

**实现要点**:

- 现有 `draft`/`setDraft`/`applyDraftPatch`/各 `updateX` 函数与子组件(`ColorField`/`FontSelect`/`Chip`/`BackgroundGradientFields`)**全部保留**,仅把 13 个 `<section>` 按 active 分类条件渲染到右侧面板。
- 右侧面板按分类渲染对应 sections;分类切换不丢 draft(draft 在组件顶层 state,与分类无关)。
- 导航项 active 态用 `border-accent-primary`/`bg-accent-primary/10`(沿用 `Chip` 的 active 风格)。
- 删掉 B 块移除的「皮肤质感」section 后,「圆角」与「卡片阴影」归入「组件样式」。

## 5. B. 移除皮肤质感 + 迁移 skinPreset

### 5.1 UI(`ReportSettingsOverlay.tsx`)

- 删 `SKIN_PRESET_OPTIONS` 常量、「⑤b 皮肤质感」`<section>`、`updateSkinPreset` 函数。
- 删 `applyDraftPatch` 里的 `skinPreset: 'skinPreset' in patch ? patch.skinPreset : prev.skinPreset,`。
- `applyPreset`:把 `skinPreset: preset.theme.skinPreset,` 换成 `shadow: preset.theme.shadow,`(透传预设 shadow;预设未设则 undefined→保留当前,安全)。
- 删顶部 `SkinPreset` 类型 import。

### 5.2 CSS 覆盖(`apps/web/src/editor/theme.tsx`)

- 删 `themeToCssVars` 内 skinPreset→`--skin-radius-card`/`--skin-shadow-card` 的 `if (skin === 'flat')…else if (skin === 'elevated')…` 分支(现 ~94-103 行)及 `const skin = t.skinPreset ?? 'default';`。
- 删 `SkinPreset` import。`index.css` 的 `.skin-card*` 不动(回退链自然生效)。

### 5.3 类型与 schema

- `packages/shared/src/types/theme.ts`:删 `skinPreset?: SkinPreset;` 字段(~131)及 `export type SkinPreset = 'default' | 'flat' | 'elevated';`(~136)与其文档注释(~128)。
- `apps/server/src/modules/projects/projects.schema.ts`:删 `skinPreset: z.enum(['default', 'flat', 'elevated']).optional(),`(~136)。
- `apps/web/src/editor/store-types.ts`:删 `ThemePatch` 的 `skinPreset?:…`(~35)。
- `apps/web/src/editor/store.ts`:删 `setTheme` 深合并里的 `skinPreset: 'skinPreset' in patch ? patch.skinPreset : current.skinPreset,`(~339)。

### 5.4 迁移(`packages/shared/src/theme/utils.ts` `normalizeTheme`)

读旧 `obj.skinPreset`(字段已从类型删除,但 `obj` 是 `Record<string, unknown>`,运行时仍可读旧持久化值),按下表覆盖 radius/shadow,且**不再输出** `skinPreset`:

| 旧 skinPreset | radius | shadow |
|---|---|---|
| `'flat'` | `'sharp'` | `'none'` |
| `'elevated'` | `'large'` | `'strong'` |
| `'default'` / undefined / 非法 | 不变(沿用已解析的 radius/shadow) | 不变 |

实现:在现有 radius/shadow 解析之后,据 `skinPresetRaw` 覆盖二者;`return` 对象移除 `skinPreset,`。

### 5.5 预设(`packages/shared/src/theme/presets.ts`)

- `tech-minimal`(~159):删 `skinPreset: 'flat',`,加 `shadow: 'none',`。
- `vibrant-trendy`(~179):删 `skinPreset: 'elevated',`,加 `shadow: 'strong',`。
- 其余 6 套不动(未用 skinPreset)。

## 6. C. 业务线 Logo 进弹窗标题栏

`ReportSettingsOverlay.tsx` 标题栏右侧(✕ 左侧)渲染:

```tsx
const businessLine = useEditorStore((s) => s.projectMeta?.businessLine);
const bl = businessLine ? BUSINESS_LINE_META[businessLine] : undefined;
// 标题栏右侧:
{bl?.logo && (
  <div className="flex items-center gap-2">
    <img src={bl.logo} alt={bl.name} className="h-8 w-8 rounded-lg object-contain" />
    <span className="text-xs text-foreground-secondary">{bl.name}</span>
  </div>
)}
```

- import `BUSINESS_LINE_META` from `@/projectsMeta`。
- 无业务线/无 logo → 不渲染,无布局偏移。
- 只读展示;可编辑的品牌 Logo 仍在「品牌」分类。
- 复用画布同源 placehold.co 图(`https://placehold.co/120x120/…`),无需新数据。

## 7. 涉及文件

- `apps/web/src/editor/components/ReportSettingsOverlay.tsx` — 主改动(外壳重构 + 分类 + 删皮肤质感 + 标题栏 Logo)。
- `apps/web/src/editor/theme.tsx` — 删 skinPreset CSS 覆盖分支 + import。
- `apps/web/src/editor/store.ts` — 删 setTheme 的 skinPreset 合并。
- `apps/web/src/editor/store-types.ts` — 删 ThemePatch.skinPreset。
- `packages/shared/src/types/theme.ts` — 删 skinPreset 字段 + SkinPreset 类型。
- `packages/shared/src/theme/presets.ts` — tech-minimal/vibrant-trendy 换 shadow。
- `packages/shared/src/theme/utils.ts` — normalizeTheme 迁移 + 不输出 skinPreset。
- `apps/server/src/modules/projects/projects.schema.ts` — 删 skinPreset Zod 字段。
- 测试(新增/就近补):
  - `normalizeTheme` 迁移:flat→sharp/none、elevated→large/strong、default 不变、无 skinPreset 不变、输出不含 skinPreset。
  - `themeToCssVars`:不再输出 `--skin-radius-card`/`--skin-shadow-card`。
  - `STYLE_PRESETS`:tech-minimal `shadow==='none'` 且无 skinPreset;vibrant-trendy `shadow==='strong'` 且无 skinPreset。
  - server schema:`skinPreset` 字段已移除(传 skinPreset 的旧 payload 仍合法——Zod 默认 strip 未知键;无需断言拒绝)。
  - `ReportSettingsOverlay`:左导航 4 项可见、默认选「基础样式」、无「皮肤质感」、标题栏渲染业务线 Logo(businessLine 存在时)。

## 8. 兼容性

- **存量项目 theme 含 `skinPreset`** → `normalizeTheme` 迁移为 radius/shadow,视觉意图保留(flat→无阴影+直角;elevated→深阴影+大圆角);skinPreset 字段从运行时主题对象移除。旧 JSON 里的 `skinPreset` 键被 Zod strip / normalize 忽略,不报错。
- **存量项目无 `skinPreset`** → 行为不变。
- **server Zod 删字段** → `.optional()` 字段移除,旧 payload 多出的 `skinPreset` 键被默认 strip,合法;新 payload 不含该键,合法。
- **`applyPreset` 透传 shadow** → 仅 tech-minimal/vibrant-trendy 受影响(显式 shadow);其余预设 `preset.theme.shadow` 为 undefined → 保留当前 shadow,与既有行为一致。
- **弹窗重构** → draft 逻辑不变,保存往返不丢字段;分类切换不丢 draft。

## 9. 测试策略

- 遵循 web-chart-test 约定(recharts mock,只断言 shell 文本)。
- shared 纯函数(`normalizeTheme`/`themeToCssVars`/预设常量)从 `apps/web/tests/` 测(沿用既有 `theme-layout.test.ts`/`theme-style-v2.test.ts` 就近补)。
- `ReportSettingsOverlay` UI 走 jsdom render + 断言导航项文本/Logo img src,不测 chart 内部。
- 命令:`pnpm --filter web test`、`pnpm --filter server test`、`pnpm -r typecheck`。
- 提交:每个 Task 末尾原子 `git add <具体文件> && git commit`(IDE 会重置暂存区,必须单条命令完成 add+commit);鉴于当前工作树有大量未提交改动,按既有记忆在 worktree 内推进、只 add 本任务具体文件。
