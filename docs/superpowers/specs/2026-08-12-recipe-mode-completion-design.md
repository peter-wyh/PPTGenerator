# recipe 模式补全（创建版本 + 改时间段落库）设计

- 日期：2026-08-12
- 范围：`apps/server/src/modules/html-templates`（service/controller/routes/schema）、`apps/web/src/routes/HtmlStudio.tsx`、`apps/web/src/editor/components/recipe-editor/`、DB（`HtmlVersion` / `Project.meta`）、本机 mediakit MySQL 鉴权
- 关联：`2026-08-05-report-recipe-design.md`（recipe 渲染管线）、`2026-08-07-report-period-recompute-design.md`（时间段重算）

## 1. 背景

recipe 报告的**渲染管线已就绪并已落在 main**：`recipe/campaign-report/mapper.ts`（`mapCampaign` 按 `reportPeriod` 切 `CpsPerformance.daily` 出 KPI/publishers/trend/insights）、`recipe/index.ts`（`getRecipe('campaign-report').render`）、`RecipeEditor`（Content/Structure/Style/Data 四层面板）、DataPanel 内置起止日期选择 + 「重新生成」。实测 `POST /generate {mode:'recipe', campaignId:'camp-wander-summer', reportPeriod:{2026-08-01,2026-08-11}}` 能正确切出 8/1~8/11 共 11 天。

但「切到 recipe 模式」实测做不到——四个缺口（见 §3）。`worktree-report-recipe`(456292e) 只做了渲染管线，已被 main 超越，且**它也没有「创建 recipe 版本」的落库代码**，合并无收益。

同时本机 `mediaket@%` MySQL 用户当前用 `sha256_password` 插件，prisma 5.22 新连接报 `Unknown authentication plugin 'sha256_password'`，server 只靠启动时的旧连接池撑着——**一旦重启就断**，是本次后端部署的硬前提。

## 2. 目标

1. 报告 = 数据驱动的 **recipe 版本**（`HtmlVersion.recipeId` 非空 + `reportContent` 快照）。
2. 改时间段 → **秒级重算并落库**（覆盖 `reportContent` + `html` + 同步 `Project.meta.reportPeriod`），不再只是预览。
3. 生成入口（recipe 模式）直接产出 recipe 版本，`RecipeEditor` 自动接管。
4. 修掉 DB auth 定时炸弹，server 可安全重启/部署。
5. 把现有 test 报告（`cmso5ho500000jatg0hv9vd05`）切进 recipe 模式。
6. AI 模式保留（退居二线，不动其生成逻辑）。

## 3. 非目标（YAGNI）

- 不统一 AI/recipe 为一套版本模型、不删 AI 模式。
- 不合 `worktree-report-recipe`（已 stale）。
- 不改 recipe 模板内容契约（`CampaignReportContent` Zod schema、Handlebars 模板）。
- 不做版本对比/多版本管理 UI。

## 4. 缺口与方案

| 缺口 | 现状 | 方案 |
|---|---|---|
| **G1 进不去 recipe** | 全代码无任何路径写 `HtmlVersion.recipeId`（`saveHtmlVersion` 不带 recipeId；`saveRecipeConfig` 要求版本已有 recipeId → 先有鸡先有蛋）；前端 recipe 生成走 `autoSave(htmlContent)`，永不产生 recipe 版本 | 后端新增 `createRecipeVersion` + 路由；前端 recipe 生成改调它（见 §5、§6） |
| **G2 改时间段不落库** | DataPanel「重新生成」调 `/generate {mode:'recipe'}`，但该端点只回 `{html}`、不回 `reportContent`，故重算结果仅刷预览、无法 `saveRecipeConfig` 固化 | 后端新增 `recomputeRecipe(versionId, reportPeriod)`：重跑 `mapCampaign` 并覆盖 `reportContent`+`html`+`meta.reportPeriod`；DataPanel 改调它（见 §5、§6） |
| **G3 DB auth** | `mediaket@%` = `sha256_password`，新连接全挂，重启即断 | `ALTER USER 'mediaket'@'%' IDENTIFIED WITH caching_sha2_password BY 'mediaket_pw'; FLUSH PRIVILEGES;`（需先修 docker CLI 脱节才能 exec） |
| **G4 test 报告** | 仍是 AI 静态快照（已用 recipe 渲染的 htmlContent 临时顶上） | 部署后对 `cmso5ho...` 跑一次 `createRecipeVersion`（一次性脚本/直接调路由） |

## 5. 后端接口契约

### 5.1 `POST /api/v1/html-templates/projects/:projectId/recipe-version`
创建一个 recipe 版本并设为 active。body：
```jsonc
{ "recipeId": "campaign-report",          // 可选，默认 campaign-report
  "reportPeriod": { "startDate": "2026-08-01", "endDate": "2026-08-11" } }  // 可选，缺省走 campaign 生命周期
```
- 鉴权：`authenticate` + `requireRole('ADMIN')`（与 generate/saveHtml 一致）。
- service `createRecipeVersion(projectId, ownerId, { recipeId?, reportPeriod? })`：
  1. `prisma.project.findUnique` → 取 `meta.campaignId`（缺则 400「报告未绑定 Campaign」）、`meta.reportPeriod`（兜底）。
  2. `mapCampaign(campaignId, reportPeriod)` → `reportContent`。
  3. `getRecipe(recipeId).render({ campaignId, reportContent })` → `html`。
  4. 事务：把同 project 其它版本 `isActive=false`；`prisma.htmlVersion.create({ data: { projectId, ownerId, name:'Recipe 版本', recipeId, reportContent, html, isActive:true } })`；`prisma.project.update({ data: { meta: { ...oldMeta, reportPeriod } } })`。
  5. 返回 `{ ok:true, versionId }`。

### 5.2 `POST /api/v1/html-templates/html-versions/:versionId/recompute`
按新时间段重算并落库。body：`{ "reportPeriod": { startDate, endDate } }`
- service `recomputeRecipe(versionId, reportPeriod)`：
  1. `findUnique(versionId)` → 非 recipe 版本则 400。
  2. 由 `version.projectId` → `Project.meta.campaignId`。
  3. `mapCampaign(campaignId, reportPeriod)` → 新 `reportContent`；`render({campaignId, reportContent})` → 新 `html`。
  4. `prisma.htmlVersion.update({ where:{versionId}, data:{ reportContent, html } })`；`Project.update({ meta:{ ..., reportPeriod } })`。
  5. 返回 `{ ok:true, versionId }`。
- 复用 `saveRecipeConfig` 的渲染编排思路，但**强制重跑 mapCampaign**（saveRecipeConfig 只复用旧 reportContent，不满足「换时间段」）。

### 5.3 schema（`html-templates.schema.ts`）
新增 `createRecipeVersionSchema`（`recipeId?`, `reportPeriod?`）与 `recomputeSchema`（`reportPeriod` 必填）。`generate` 端点不改。

## 6. 前端改动

- `htmlTemplatesApi`（`apps/web/src/api/htmlTemplates.ts`）新增 `createRecipeVersion(projectId, opts)`、`recomputeRecipe(versionId, reportPeriod)`。
- `HtmlStudio.handleGenerate`：`mode==='recipe'` 分支改为 `createRecipeVersion(id, {recipeId, reportPeriod, campaignId})` → 成功后**按初始挂载的版本加载序列重新拉取新版本**（`listHtmlVersions`→取 active→`getHtmlVersion(versionId)`→`setActiveVersion`/`setGeneratedHtml`/`setPhase('chat')`；现有 `reloadVersion` 仅刷新已存在的 activeVersion，此处 activeVersion 仍为 null，不能直接复用）→ `isRecipe` 自动转 true → `RecipeEditor` 接管。AI 分支不动。
- `RecipeEditor` DataPanel「重新生成」：由 `generate({mode:'recipe'})` 改为 `recomputeRecipe(versionId, {startDate,endDate})`，成功回调由「只刷预览」升级为触发 `onSaved()`（父组件重载 activeVersion）。`generate` 调用点在 DataPanel 内可移除。

## 7. DB 鉴权修复（G3，最先做）

执行顺序受它制约：不修则后端改动**部署即断**。
1. 用户侧先修 docker CLI 脱节：`docker context use default`（或重启 Docker Desktop），直到 `docker ps` 能稳定看到 `mediaket-mysql-1`。
2. 取容器 id 后：`docker exec -e MYSQL_PWD=mediaket_root <cid> mysql -uroot -h127.0.0.1 -e "ALTER USER 'mediaket'@'%' IDENTIFIED WITH caching_sha2_password BY 'mediaket_pw'; FLUSH PRIVILEGES;"`
3. 验证：本地 `tsx` 起 prisma 跑一次 `count()`，不再报 `sha256_password`。

## 8. 执行顺序

G3（DB auth）→ 后端 G1+G2（service/routes/schema + 测试，worktree 内）→ 重启 server 验证 → 前端 G1+G2 接线 → G4 转换 test 报告 → 全量回归。

## 9. 隔离

在 **worktree** 内开发（main 树有 `projects.*` 等 WIP，避免 hunk 交错——见记忆 `graft-disjoint-regions` / `isolate-feature-work-in-worktree`）。合回 main 走 FF（main 为严格祖先时）或 3-way merge；记得 worktree 用 main 的 `node_modules` 软链。

## 10. 测试

- **server 单测**（`html-templates.service.test.ts`）：
  - `createRecipeVersion`：mock prisma + `mapCampaign`，断言建了带 `recipeId` 的 active 版本、停用旧版本、`meta.reportPeriod` 已更新；无 campaignId 时 400。
  - `recomputeRecipe`：mock `mapCampaign` 返回新 reportContent，断言 version 的 `reportContent/html` 被覆盖、`meta.reportPeriod` 同步；非 recipe 版本 400。
- **web**：`RecipeEditor` 在 `activeVersion.recipeId` 非空时渲染（recharts mocked，断言 shell 文本，见记忆 `web-chart-test-convention`）。
- `mapCampaign` 的时段切片已有 `mapper.test.ts` 覆盖，不重测。
- **CI 门**：server `tsc --noEmit`、web `tsc -b --force` + vitest（见记忆 `web-tsc-build-is-ci-only-gate`）。

## 11. 风险与回滚

- DB auth 改插件对运行中 server 旧池无影响（已 authed）；改完新连接才生效。改错（密码/插件）可再用 root `ALTER` 回滚。
- `createRecipeVersion` 建版本是新增行，删掉即回滚；`htmlContent` 不动，AI 快照仍在。
- `Project.meta.reportPeriod` 与 recipe 版本须保持一致——`recomputeRecipe`/`createRecipeVersion` 都同步写，避免再次出现「标签 ≠ 数据」。
