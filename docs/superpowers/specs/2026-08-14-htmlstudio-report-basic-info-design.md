# html-studio 报告基础信息透出 + 编辑 — Design

- **Date:** 2026-08-14
- **Route:** `/projects/:id/html-studio`
- **Goal:** 在 html-studio 顶部表头常驻透出报告基础信息(标签)，并支持就地打开现有 `CreateProjectDialog` 模态框编辑全部字段。

## 1. 背景

html-studio(`apps/web/src/routes/HtmlStudio.tsx`)是 AI-HTML 报告的沉浸式全屏工作台，有两种渲染模式:

- **Recipe 模式**(`isRecipe && activeVersion`):渲染 `RecipeEditor` 四层编辑器。
- **AI 模式**(默认):`ResizablePanels` 左配置/对话 + 中预览(左栏可由表头「展开/收起」折叠)。

两种模式**共享同一个 `h-12` 顶部表头**。当前表头只显示 `· {project.name}`,报告的其它基础信息(业务线 / 广告主 / 创建人 / campaign / 周期 / 场景)**完全不透出、不可编辑**。

「报告基础信息」在本仓库没有独立表 —— 它是 `Project.meta`(`Json?`) 里的静态元数据字段集合(`packages/shared/src/types/theme.ts` 的 `ProjectMeta`,服务端镜像 `apps/server/src/modules/projects/projects.schema.ts:469-495` 的 `projectMetaSchema`):

`businessLine`(业务线)、`creator`(创建人)、`scenario`/`scenarioSub`(场景)、`templateType`、`advertiser`(广告主)、`campaignId`/`campaignInfo`(关联 campaign)、`reportPeriod`(报告周期)、`styleType`。

> 边界:recipe 的数据/样式/结构(tokenOverrides / manifestOverrides / reportContent)存在独立的 `HtmlVersion` 表,与基础信息**分离**。两者仅共享 `campaignId` 与 `reportPeriod`(源自基础信息,流向 recipe 的 recompute)。

## 2. 决策(已与用户确认)

1. **字段范围**:全部基础信息字段(报告名称 / 业务线 / 广告主 / 创建人 / campaign / 周期 / 场景),即 `CreateProjectDialog` 已管理的字段集合。
2. **UI 形式**:**表头标签(透出)+ 复用 `CreateProjectDialog` 模态框(编辑)**。与 `EditorTopbar` 现有 metaTags 标签 + 编辑入口一致;表头共享 → 两种模式都自动生效;复用成熟组件 → 风险最低。
3. **保存后行为**:**仅持久化 + 刷新**,不自动重算/重生成。recipe 模式下 `reportPeriod` 作为 prop 下传 `RecipeEditor`,用户可在 DataPanel 手动「重新生成」应用新周期。

## 3. 设计

### 3.1 透出 — 表头标签组(display)

在表头 `{project.name}`(`HtmlStudio.tsx:651`)右侧、右侧操作区之前,插入一组小标签 chip,从 `project.meta` 构建:

| Chip | 取值 | 备注 |
|---|---|---|
| 业务线 | `meta.businessLine` | 如 `DG` |
| 广告主 | `meta.advertiser` | |
| 周期 | `formatReportPeriod(meta.reportPeriod, meta.scenarioSub)` | 空则省略 |

规则:

- 每个 chip **仅在该字段有值时**渲染(空字符串/undefined 不渲染)。
- 全部为空时不显示标签组,仅保留「编辑」按钮。
- **不**把 `creator` / `scenario` 做成 chip(留在模态框),避免表头拥挤。
- 样式复用 `EditorTopbar` `metaTags` 的 pill 风格(`rounded bg-surface-hover px-1.5 py-0.5 text-[11px] text-foreground-muted`),保持全站一致。
- `formatReportPeriod` 直接复用 `packages/shared/src/theme/utils.ts:268` 的现有实现。

### 3.2 编辑 — 复用 CreateProjectDialog(edit)

标签组旁加一个 `✏️ 编辑` 按钮。点击 `setShowEdit(true)`,渲染:

```tsx
<CreateProjectDialog
  open={showEdit}
  title="编辑报告"
  submitLabel="保存"
  lockScenario            // 与 EditorTopbar 一致:现有 ai-html 项目锁定 scenario
  initial={{
    name: project.name,
    width: project.width,
    height: project.height,
    meta: project.meta,
  }}
  onCancel={() => setShowEdit(false)}
  onSubmit={handleEditBasicInfo}
/>
```

`CreateProjectDialog` 的 `onSubmit` 契约为 `(values: { name; width; height; meta; templateId? }) => void`(`CreateProjectDialog.tsx:107, 327-356`),编辑模式下会先 spread `initial.meta` 再覆盖其管理的字段 —— **直接兼容** `projectsApi.update(id, values)` 的 patch 形状。

`lockScenario` 锁定场景(到达 html-studio 的项目 `styleType` 已固定为 ai-html),与 `EditorTopbar` 现有编辑入口(`EditorTopbar.tsx:205-222`)语义一致。

### 3.3 保存处理(handleEditBasicInfo)

```ts
const handleEditBasicInfo = async (values: {
  name: string; width: number; height: number; meta: ProjectMeta; templateId?: string;
}) => {
  const updated = await projectsApi.update(id, values); // PATCH /projects/:id
  setProject(updated);        // → 标签重算;reportPeriod/campaignId 派生状态下传 RecipeEditor 自动更新
  setShowEdit(false);
  toast('报告信息已更新');
};
```

`campaignId`(`HtmlStudio.tsx:131`)与 `reportPeriod`(`:132-134`)均从 `project.meta` 派生,`setProject(updated)` 后下次渲染自动刷新 —— 表头标签 + `RecipeEditor` 的 `reportPeriod` prop(`:705`)一并更新。

### 3.4 边界 & 细节

- **生成中防抖**:`generating` 为 true 时禁用「编辑」按钮,避免与 SSE 自动保存(`updateAiHtmlStatus`)产生写竞态。
- **标签可点**:整组标签 + ✏️ 按钮均可触发编辑(扩大点击命中区)。
- **两种模式**:表头为共享 JSX,recipe 模式与 AI 模式均自动生效,无需分支判断。
- **空报告信息**:字段全空时仅显示「编辑」按钮(不加「未设置」hint chip,保持表头干净)。

## 4. 改动范围

| 文件 | 改动 |
|---|---|
| `apps/web/src/routes/HtmlStudio.tsx` | 新增 `showEdit` state、`handleEditBasicInfo`、表头 chip 组 + `✏️ 编辑` 按钮、`<CreateProjectDialog>` 渲染;新增 `formatReportPeriod` 与 `CreateProjectDialog` 的 import。约 +35 行。 |

**import 路径(实现注意)**:`formatReportPeriod` 从正确包名 `@mediakit/shared` 导入(见 `EditorTopbar.tsx` 现有用法)。`HtmlStudio.tsx:22` 现有 `import type { ProjectDetail, ProjectMeta } from '@mediakit/shared'` 是已知 typo 包名(缺 `i`,本地 dirty node_modules 能解析、clean install 会断)。借此改动顺手把第 22 行合并进正确的 `@mediakit/shared` 导入(与 `formatReportPeriod` 同一行),消除一处 typo 债务,无需单独改动。

**零后端改动**:`PATCH /projects/:id` 与 `updateProjectSchema`(`projects.schema.ts:513-521`)已支持 `{ name?, width?, height?, meta? }`。

**不改**:`CreateProjectDialog`、server schema、prisma、API、`RecipeEditor`。

## 5. 测试(vitest,遵循 jsdom shell-text 约定)

- 表头对给定 `meta` 渲染 业务线 / 广告主 / 周期 标签文本;空值字段不渲染对应 chip。
- 点 `✏️ 编辑` → 对话框打开;提交 → `projectsApi.update` 以 spread 后的 meta 被调用一次;`project` 状态刷新、表头标签更新为新值。
- `generating` 为 true 时编辑按钮 `disabled`。

> 备注:recharts 等在 jsdom 中被 mock,只断言 shell 文本,不断言图表内部标签(参见项目记忆 web-chart-test-convention)。

## 6. 风险

- **表头拥挤**:已通过限定 chip 为 3 个(业务线/广告主/周期)缓解;字段全空时退化为仅编辑按钮。
- **写竞态**:生成中禁用编辑按钮。
- **recipe 重算一致性**:本设计**不**自动重算;改周期后用户需在 DataPanel 手动「重新生成」。此为既定决策(避免覆盖用户正在调的内容)。
