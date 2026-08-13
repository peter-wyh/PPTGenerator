# 从 HTML 模版新建 → 活的 recipe 报告 设计

- 日期：2026-08-13
- 范围：`apps/server/src/modules/projects/projects.service.ts`、`projects.controller.ts`、`projects.routes.ts`、`projects.schema.ts`；`apps/web/src/api/templates.ts`、`apps/web/src/routes/Projects.tsx`（从模版新建弹窗）
- 关联：`2026-08-12-recipe-mode-completion-design.md`（复用其 `createRecipeVersion`）；用户并发 WIP（`projects.*` 未提交）

## 1. 背景

「存为模版」(`templates.service createFromProject`) 把源报告的完整 `meta`（含 `campaignId`/`businessLine`/`reportPeriod`/`reportData`）+ `htmlContent` 存成模版。`Template.meta` 因此**带 campaignId**（前提：源报告绑了 campaign）。

`projects.service createFromTemplate`（用户 WIP）当前把模版的 `pages`/`meta`/`htmlContent` 拷进新 Project——但 `htmlContent` 是**建模板那一刻的静态快照**，新报告显示的是冻结数据、没有实时绑定，且 `handleCreateFromTemplate({templateId, name})` **没有时间段入参**。

对照：`duplicate`（用户另一 WIP）已有「拷贝 + `newPeriod` 覆盖 reportPeriod + 刷新内容」的范式，`DuplicateProjectDialog` 有 period 选择 UI。

recipe 模式已落地（`createRecipeVersion` service + `POST /projects/:id/recipe-version`，mapCampaign 按 reportPeriod 切 CpsPerformance.daily 出活数据）。

## 2. 目标

从 **HTML 类型模版**新建时，产出一份**活的 recipe 报告**：
1. 新报告带入模版自带的 campaign 绑定（`campaignId`/`businessLine`）——数据实时。
2. 弹窗里**时间段默认填模版 `meta.reportPeriod`**，用户可改；其余不可改。
3. 创建后进 RecipeEditor，**只能改时间段**（改完 `recomputeRecipe` 秒级重算）。
4. 非 HTML 类型模版（ppt/single）行为不变；HTML 模版无 campaignId 时优雅降级。

## 3. 非目标（YAGNI）

- 不改 ppt/single 模版的 from-template 流程。
- 不在 from-template 弹窗里让用户选 campaign（campaign 一律来自模版 meta；无则降级，不新增选择器）。
- 不动「存为模版」逻辑、不动 duplicate 流程。
- 不改 recipe 模板内容契约 / RecipeEditor 其它面板。

## 4. 方案

编排在 **controller**（避免 `projects.service` ↔ `html-templates.service` 互 import）：

```
POST /from-template { templateId, name?, reportPeriod? }
  → projectsService.createFromTemplate(owner, templateId, name, reportPeriod)
        // 拷模版 meta；reportPeriod 传入则覆盖 meta.reportPeriod；htmlContent 仍拷(兜底)
  → if project.meta.styleType === 'ai-html' && project.meta.campaignId:
        await htmlTemplateService.createRecipeVersion(project.id, owner, { reportPeriod })
        // 用 project.meta.campaignId(模版自带) + reportPeriod 出活版本
  → res.json({ project })
```

`createRecipeVersion` 已从 `project.meta` 读 `campaignId`、用 `reportPeriod` 跑 `mapCampaign` → `reportContent`，render → html，建 active `HtmlVersion{recipeId:'campaign-report'}`，同步 `meta.reportPeriod`。所以 controller 只需把 `reportPeriod` 透传。

## 5. 后端改动

### 5.1 `projects.service.ts createFromTemplate`
签名加 `reportPeriod?: { startDate?: string; endDate?: string }`。拷 meta 后，若 `reportPeriod` 传入则覆盖：
```ts
let meta = tpl.meta ? JSON.parse(JSON.stringify(tpl.meta)) : undefined;
if (reportPeriod && meta) meta.reportPeriod = reportPeriod;
```
（其余逻辑不变：名称撞名处理、拷 pages/width/height/meta/htmlContent、create project、return toDetail。）

### 5.2 `projects.controller.ts createFromTemplate`
建完 project 后追加编排：
```ts
const project = await projectsService.createFromTemplate(auth.id, templateId, name, reportPeriod);
const meta = (project.meta ?? {}) as Record<string, unknown>;
if (meta.styleType === 'ai-html' && meta.campaignId) {
  await htmlTemplateService.createRecipeVersion(project.id, auth.id, { reportPeriod });
}
res.json({ project }); // 或现状的返回形状，保持兼容
```
顶部 `import { htmlTemplateService } from '../html-templates/html-templates.service'`（html-templates.service 不 import projects.service，无环）。

### 5.3 `projects.schema.ts` + `projects.routes.ts`
from-template 的 body schema 加可选 `reportPeriod: z.object({ startDate: z.string(), endDate: z.string() }).optional()`；route 不变（`POST /from-template`）。

## 6. 前端改动

### 6.1 `apps/web/src/api/templates.ts`
`createProjectFromTemplate(templateId, name, reportPeriod?)` 加第三参，POST body 带 `reportPeriod`。

### 6.2 `apps/web/src/routes/Projects.tsx` 从模版新建弹窗
- 弹窗加「起始日期 / 结束日期」两个 date input，默认值 = **选中模版的 `meta.reportPeriod`**（套 `DuplicateProjectDialog` 的 period UI 范式）。
- 模版选择器需把选中模版的 `meta.reportPeriod` 暴露给弹窗（若现列表不带 meta，按需带上）。
- 确认：`createProjectFromTemplate(templateId, name, { startDate, endDate })` → 成功后 `navigate(/projects/${p.id}/html-studio)`（ai-html 已走这条；进 RecipeEditor）。

### 6.3 `handleCreateFromTemplate`
签名加 reportPeriod，透传给 api。

## 7. 边界与降级

- **模版无 `campaignId`**（不是从 campaign 报告存的）：controller 跳过 `createRecipeVersion`，新报告退回拷静态 `htmlContent`（= 现状）。可选：前端在选中这类模版时给一行提示「该模版未绑 campaign，将生成静态报告」。
- **模版无 `reportPeriod`**：弹窗日期留空，用户必须填；后端 `createRecipeVersion` 在 campaignId 在但 reportPeriod 缺时会用 campaign 生命周期兜底（mapCampaign 现有逻辑），不阻塞。
- **`styleType` 非 `ai-html`**：完全走原 from-template 路径，不加 recipe。

## 8. 测试

- **service 单测** (`projects.service.test.ts`)：`createFromTemplate` 传 `reportPeriod` → 新 project 的 `meta.reportPeriod` 被覆盖；不传 → 沿用模版原值。
- **controller 单测**：HTML 模版(ai-html) + campaignId → 调了 `createRecipeVersion` 且新 project 有 active recipe 版本；非 ai-html 或无 campaignId → 不调。
- 复用 `createRecipeVersion` 已有测试，不重测 mapCampaign。
- CI 门：server `tsc --noEmit`、web `tsc -b --force` + vitest。

## 9. 实施注意（WIP）

`projects.*` 是用户**未提交的并发 WIP**。实现前先读当前 WIP 状态再改；实现期间用户不同时编辑这几个文件。改动以文件级原子提交，不夹带其它 WIP（记忆 `ff-merge-to-main-with-dirty-tree` / `ide-resets-git-index`）。
