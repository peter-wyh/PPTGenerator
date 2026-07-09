# 页面类型与投放报告默认标题

**日期**：2026-07-09
**范围**：`packages/shared`（类型 / 纯函数）、`apps/server`（Zod `pageSchema`）、`apps/web`（editor store / 模板 / 页面侧栏 / 标题组件）
**状态**：设计已确认，待实现

## 背景

`Page`（`packages/shared/src/index.ts:1117`）目前只有 `{ id, name, components, bgColor?, bgGradient?, bgImage? }`，**没有任何「页面类型」字段**。页面上唯一的「标题」是 `Page.name`（仅在左侧 `PageSidebar` 显示）；画布上的标题只是写死的 `text` 组件——例如封面模板把 `content: 'Report Title'` 硬编码进一个 text 组件（`apps/web/src/editor/templates.ts:215`），周报概览页写死 `'Weekly Status Update'`（`:295`）。**没有任何从项目 meta 推导页面标题的逻辑**，所有标题字符串都是字面量。

而本特性需要的三个输入**都已在项目级 `ProjectMeta`（`index.ts:537`）里**：

- 商家名 → `meta.advertiser`（字符串）
- 报告子类（周报/月报/结案）→ `meta.scenarioSub: 'weekly' | 'monthly' | 'wrap-up'`（`index.ts:99`，标签见 `apps/web/src/projectsMeta.ts:89`）
- campaign 时间周期 → `meta.campaignInfo.{startDate,endDate}`（`index.ts:103`）

`binding`（`index.ts:1086`）目前只服务 M5 的**数据源绑定**（CSV/Excel 列），不是 meta 绑定，无法复用为「标题绑定」。

最接近的现成模式：组件级默认值 `getDefaultData(type)`（`apps/web/src/editor/defaults.ts:51`，大 switch）与 `normalizeTheme` 纯函数（`index.ts:449`）——本特性的标题生成器应遵循后者：`packages/shared` 里的纯函数，被 web + server 共用。

## 目标

1. 新增每页**页面类型**字段 `pageType`；`'media-report'`（投放报告）是首个取值，命中即套用默认标题规则。
2. 投放报告页的标题**自动从 meta 生成**：`{商家名}'s MEDIA REPORT · {周期}`，同一字符串同时写入**画布标题组件**与 `Page.name`（两者始终同步）。
3. 周期取值：周报→`上周`、月报→`上月`（仅文字标签，不算具体日期）；结案→ campaign 实际投放周期 `YYYY.MM.DD–YYYY.MM.DD`。
4. 标题**自动跟随 meta**；一旦用户手改该页标题，停止跟随（可「恢复自动」）。

## 非目标

- **不在本特性内**：编辑器内修改 `advertiser / scenarioSub / campaignInfo` 的 UI（这些目前仅在 `CreateProjectDialog` 建项目时设置）。自动跟随接到现有 meta 更新路径即可，meta 编辑入口留作后续。
- 计算「上周/上月」的具体日期范围——周报/月报只取文字标签。
- 定义完整页面类型分类法（业绩概览/达人分析/…）——本次只落 `media-report`，字段为可扩展联合类型。
- 改 `ComponentType` 联合、改 Prisma schema（`pages` 仍是不透明 JSON，新增可选页面字段不触发迁移）。
- 引入新测试框架——沿用现有 vitest + jsdom。

## 设计

### §1 数据模型（`packages/shared/src/index.ts`）

`Page` 新增三个**可选**字段：

```ts
/** 页面类型（可扩展；命中 media-report 触发标题规则）。 */
export type PageType = 'media-report';

export interface Page {
  id: string;
  name: string;
  components: EditorComponent[];
  bgColor?: string;
  bgGradient?: PageGradient;
  bgImage?: string;
  pageType?: PageType;          // 命中 'media-report' 触发标题逻辑
  titleComponentId?: string;    // 指向作为「页面标题」的那个 text 组件
  titleOverridden?: boolean;    // 用户手改过 → 停止自动跟随
}
```

全部可选 → 存量 `Project.pages` JSON 无需迁移，反序列化兼容。

### §2 服务端 Zod（`apps/server/src/modules/projects/projects.schema.ts`）

`pageSchema`（`:3`）镜像新增三个可选字段。注意 `pageSchema` 同时被 `Project` 与 `Template` 复用，二者一并获得这些字段：

```ts
export const pageSchema = z.object({
  id: z.string(),
  name: z.string().max(120),
  bgColor: z.string().max(20).optional(),
  bgGradient: z.object({ /* 不变 */ }).optional(),
  bgImage: z.string().max(2048).optional(),
  components: z.array(z.any()),
  pageType: z.enum(['media-report']).optional(),
  titleComponentId: z.string().max(64).optional(),
  titleOverridden: z.boolean().optional(),
});
```

### §3 标题生成纯函数（`packages/shared/src/index.ts`）

```ts
/** '2026-10-12' → '2026.10.12'；非法/空 → '' */
export function formatCampaignDate(iso: string | undefined): string;

/** 结案周期：两端齐全 → '2026.10.12–2026.11.10'；否则回落 '结案报告' */
export function buildWrapUpPeriod(meta: ProjectMeta): string;

/**
 * 投放报告页默认标题。
 *   周报 → "{advertiser}'s MEDIA REPORT · 上周"
 *   月报 → "{advertiser}'s MEDIA REPORT · 上月"
 *   结案 → "{advertiser}'s MEDIA REPORT · 2026.10.12–2026.11.10"
 * 兜底：advertiser 空 → 'MEDIA REPORT'；无 scenarioSub → 不带周期。
 */
export function buildReportTitle(meta: ProjectMeta): string {
  const advertiser = meta.advertiser?.trim();
  const base = advertiser ? `${advertiser}'s MEDIA REPORT` : 'MEDIA REPORT';
  const period =
    meta.scenarioSub === 'weekly'   ? '上周'   :
    meta.scenarioSub === 'monthly'  ? '上月'   :
    meta.scenarioSub === 'wrap-up'  ? buildWrapUpPeriod(meta) :
    '';                                 // 无 scenarioSub → 不带周期
  return period ? `${base} · ${period}` : base;
}
```

分隔符固定 ` · `（空格-中点-空格）；日期区间用半角破折号 `–`。纯函数、无副作用，web 与 server（如未来导出/服务端渲染）均可调用。

### §4 Store 行为（`apps/web/src/editor/store.ts`）

新增/改动以下动作（沿用现有 `updatePage` / `patchPageLive` / `renamePage` 模式）：

1. **设为投放报告** `setPageType(pageId, 'media-report')`：
   - 若该页无 `titleComponentId`（或指向的组件已不存在）→ 创建一个大号 text 标题组件（复用 `getDefaultData('text')`，覆盖 `fontSize`/位置为封面标题样式），记下新组件 id 为 `titleComponentId`。
   - `titleOverridden = false`，调用 `refreshReportTitle(pageId)`（见下）。
   - 清除：`setPageType(pageId, undefined)` 只清 `pageType`，保留组件与现有 `name`/内容。

2. **`refreshReportTitle(pageId)`**：若 `pageType==='media-report' && !titleOverridden`，重算 `buildReportTitle(meta)`，写入标题组件 `data.content` **并** `Page.name`。

3. **meta 变更路径**：在所有更新 `Project.meta` 的动作末尾（建项目后、以及未来 meta 编辑入口）调用 `refreshAllReportTitles()`——遍历所有 `pageType==='media-report' && !titleOverridden` 的页执行 `refreshReportTitle`。今天 meta 主要在 `CreateProjectDialog` 建项目时写入，故建项目后即触发一次。

4. **手改 → 停跟随**：
   - 编辑画布标题组件内容（该组件为某 media-report 页的 `titleComponentId`）→ 置该页 `titleOverridden = true`，并把新文本同步到 `Page.name`（保持两者一致）。
   - 在侧栏对 media-report 页改名（`renamePage`）→ 置 `titleOverridden = true`，并把新名同步到标题组件 `data.content`。
   - 任一处手改后，两处始终持有相同字符串，仅停止跟随 meta。

5. **「恢复自动」`restoreReportTitle(pageId)`**：`titleOverridden = false` → `refreshReportTitle(pageId)`。

> 边界：`titleComponentId` 指向的组件被删除时，`refreshReportTitle` 检测到悬空引用 → 视为无标题组件，按 §4.1 重建（若仍为 media-report）。

### §5 UI

- **封面模板**（`templates.ts` 的 `cover-page`，约 `:215`）与场景模板（`SCENARIO_TEMPLATES`，`:66`）里的 `Cover` 页：创建时即带 `pageType='media-report'` + 一个 `titleComponentId` 指向的标题 text 组件 → **新建即自动填好标题**。
- **页面上下文菜单**（`PageSidebar.tsx` 右键/更多菜单）加「页面类型 → 投放报告 / 无」，手动设/清。
- **标题组件选中态**：当选中组件是某 media-report 页的标题组件、且 `titleOverridden` 时，浮一个小的「自动标题 · 恢复自动」入口（调 `restoreReportTitle`）。
- 标题组件复用普通 text 组件的全部样式/导出路径——不引入新组件类型、不改渲染器。

### §6 边界与兜底

| 情况 | 行为 |
|---|---|
| `advertiser` 为空 | 标题用 `MEDIA REPORT`（不带 `{name}'s `） |
| 无 `scenarioSub` | 不带周期，仅 `… MEDIA REPORT` |
| 结案但 `campaignInfo` 无日期 | 周期回落为 `结案报告` |
| `titleComponentId` 悬空（组件被删） | 重建标题组件（若仍为 media-report） |
| 结案仅有一端日期 | `buildWrapUpPeriod` 回落 `结案报告` |

### §7 测试（vitest）

- **单测 `buildReportTitle` / `formatCampaignDate` / `buildWrapUpPeriod`**：覆盖 weekly/monthly/wrap-up/无 scenarioSub 四分支 + advertiser 空 + 结案无日期/单端日期兜底。
- **Store**：
  - `setPageType('media-report')` 在无标题组件时创建并填入正确标题，`titleOverridden=false`。
  - meta 变更 → media-report 且未 overridden 的页重算；已 overridden 的页不动。
  - 手改画布标题 → `titleOverridden=true` 且 `Page.name` 同步；侧栏改名亦然。
  - `restoreReportTitle` 清除标记并重算。
- 现有用例不受影响（全部新增字段可选；chart 相关沿用既有约定——recharts 在 jsdom 中被 mock，只断言 shell 文本，不断言图表内部标签）。

## 风险与确认

- **持久化字段新增**：`pageType/titleComponentId/titleOverridden` 进入 `Project.pages` JSON。沿用既有教训（component type id 也会存进 `Project.pages` JSON，改名/删除会破坏存量项目甚至崩编辑器）——本次是新增可选字段、不删不改 id，存量项目安全；但**取值集合（`PageType` 联合）一旦发布不要再改名/删除**，否则破坏存量。
- **§6 范围边界**：本特性不含编辑器内改 meta 的 UI，故「自动跟随」在编辑器内目前主要于建项目/加封面页时生效；待后续加 meta 编辑入口即可全链路感知。
- **IDE git 暂存 / 特性隔离**：实现时在 worktree 内隔离；`git add`+commit 用单条原子命令完成（IDE 的 git 面板会在 CLI 调用间清空暂存）。
