# HTML 报告:编辑 + 数据替换 设计

- **日期**:2026-08-05
- **状态**:设计待 review
- **关联**:`docs/superpowers/specs/2026-08-05-report-recipe-design.md`(recipe 子系统设计,本方案的地基)
- **作者**:peter.wan + Claude

---

## 1. 背景与动机

当前 AI 生成的 HTML 报告存在一个能力缺口:

- **编辑**:只有 `HtmlStudio` 路由有两种编辑 —— Agent 自然语言编辑(`/agent-edit`)+ 裸 HTML textarea。`GenerateHtmlReportOverlay` 弹窗完全不能编辑。
- **数据替换**:`Project.htmlContent` 只存渲染后的最终 HTML,**没有"模板 + 数据"分离**。要换数据只能让 AI 重新生成(自由发挥、结果不稳定)。

用户需求:**同时支持对 HTML 报告的编辑,也支持对同一个 HTML 只进行数据替换**。

**核心矛盾**:"只换数据"要求 HTML 模板化(数字/文案有稳定占位符);AI 自由生成的 HTML 每次结构、类名、布局都不同,没有数据绑定,做不到"只换数据"。recipe 子系统已经用"结构固定 + Handlebars 确定性渲染"换来了数据替换能力,代价是结构不能自由编辑。

**本方案的解法**:**两类报告并存** —— AI 自由报告(自由编辑,不保证换数据)+ 模板化报告(数据替换为核心,分层受限编辑)。各取所长,不强行让一份报告同时满足两个对立需求。

---

## 2. 目标 / 非目标

### 目标
1. **模板化报告(recipe)**支持四层编辑:换数据、改文案、改风格 token、改区块结构(顺序/显隐)。
2. **AI 自由报告(mode:'ai')**完全保持现状(Agent 编辑 + textarea),零迁移、零风险。
3. 两类报告在存储、UI 入口上并存,用户按需选。
4. 模板化报告的"换数据"100% 确定性(同样的 campaign + 配置 = 同样的 HTML),数字不经 AI。

### 非目标(YAGNI)
- ❌ 不做 WYSIWYG 拖拽画布(结构编辑通过 manifest 清单的勾选/调序,不是自由拖拽)。
- ❌ 不让 AI 自由报告支持数据替换(与"自由编辑结构"互斥,已在 §1 说明)。
- ❌ v1 不做"AI 生成新 recipe / 新 template"(用户要新风格时仍走 mode:'ai');留 v2。
- ❌ v1 不合并现有 `mode:'template'`(简单 `{{key}}` 替换)与 recipe —— template mode 保留不动。
- ❌ 不引入新 DB 表(复用 HtmlVersion)。

---

## 3. 现状摘要

### recipe 子系统(已在 `.claude/worktrees/report-recipe`,UNMERGED)
- 四件套:`schema.ts`(Zod 内容契约 `CampaignReportContent`)+ `template.hbs`(282 行 Handlebars)+ `tokens.ts`(dgTokens 固定 DG 风格)+ mapper/narrative/render。
- `render({campaignId})` = `mapCampaign`(campaign DB → content,数字兜底不抛错)→ `fillActionable`(AI 只写洞察文案,失败降级 `[]`)→ Handlebars 渲染。
- 已有 31 测试 + 快照基线(数字 100% 数据驱动)。
- 集成层:`html-templates.schema.ts` 加 `mode:'recipe'`+`recipeId`;`controller.ts` 加 recipe 分支。
- **基于较旧 main 基线(da3cb26)**,rebase 时会与 main 后续的 HtmlVersion / agent-edit / reportPeriod / 报告名唯一校验冲突(机械冲突,可解)。

### html-templates 模块(main)
- `mode` 只有 `'template'` / `'ai'`(无 recipe)。
- `generateFromTemplate`(template mode)是简单 `\{\{key\}\}` 正则替换(非 Handlebars,无 each/if/helper)。
- `saveHtmlAsProject` / `saveHtmlVersion` 只存最终 HTML。
- `Project.htmlContent`(LongText)+ `HtmlVersion`(多版本,每行存完整 HTML + source)。
- `Project.meta`:存 `styleType` / `campaignId` / `aiHtmlStatus` / `agentHistory` / `reportPeriod` 等,**无 recipeId / 数据快照 / token 覆盖**。

---

## 4. 设计决策(已与用户确认)

| # | 决策 | 选择 | 理由 |
|---|---|---|---|
| 1 | 现有 `mode:'template'` 怎么办 | **保留不动**,recipe 作为模板化标准 | template mode 轻量 + 向后兼容;不强行合并 |
| 2 | recipe 配置存哪 | **扩展 HtmlVersion**(加 4 可空列) | 版本化白送;AI 报告的 HtmlVersion 这 4 列 null,兼容;不新建表 |
| 3 | template.hbs 是否拆 partial + manifest 驱动 | **是**(v1 就做) | 结构编辑(顺序/显隐)的前提;用户明确要区块结构编辑 |
| 4 | 编辑器放哪 | **HtmlStudio 内按报告类型切换面板** | 统一入口;复用预览/保存流程 |

---

## 5. 架构:两类报告并存

```
                    Project (一份报告)
                          │
            ┌─────────────┴─────────────┐
       styleType='ai-html'         styleType='recipe'
            (AI 自由报告)              (模板化报告)
            │                            │
   mode:'ai' 生成                  mode:'recipe' 生成
   Agent / textarea 编辑            分层编辑器(数据/文案/风格/结构)
   不保证换数据                     换数据 = 核心能力(确定性)
            │                            │
            └─────────────┬──────────────┘
                       共用存储
              Project.htmlContent(当前激活版本渲染结果)
              HtmlVersion(多版本,含 recipe 配置)
```

报告类型区分:`HtmlVersion.recipeId` 是否为 null(或 `Project.meta.styleType === 'recipe'`)。

---

## 6. 数据模型:扩展 HtmlVersion

```prisma
model HtmlVersion {
  // 现有字段(不动)
  id        String   @id @default(cuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  html      String   @db.LongText
  name      String
  source    String   // 'ai' | 'recipe' | 'manual' | ...
  isActive  Boolean  @default(false)
  createdAt DateTime @default(now())

  // 新增(recipe 报告专用,AI 报告保持 null)
  recipeId          String?  // 用哪套 recipe(v1 只有 'campaign-report')
  reportContent     Json?    // CampaignReportContent 快照(数字/文案)
  tokenOverrides    Json?    // 配色/字体覆盖(只存改过的 key)
  manifestOverrides Json?    // { order: string[], hidden: string[] }
}
```

**Project 不加字段**(`htmlContent` 仍是当前激活版本渲染结果,现有逻辑不变)。

**为什么是 Overrides 不是全量**:tokens 默认值(dgTokens)留在代码,只存用户改过的 key。改一个主色就存 `{brandPrimary: "#3b82f6"}`,不存整份 token。

**迁移**:新增 4 列,手写 migration SQL(dev DB 无 shadow DB,见记忆 `prisma-migrate-dev-needs-shadow-db`)。现有 AI 报告的 HtmlVersion 这 4 列为 null,无需数据迁移。

---

## 7. render 改动:吃覆盖 + manifest 驱动

### 7.1 render 签名

```ts
// 现在
render({ campaignId })

// 改后
render({
  recipeId: 'campaign-report',   // 选哪套 recipe
  campaignId?,                   // 换数据时传;有 reportContent 快照时可跳过
  reportContent?,                // 直接用快照(编辑器重渲染时)
  tokenOverrides?,               // 风格层覆盖
  manifestOverrides?,            // 结构层:{ order, hidden }
})
```

合并逻辑:
- `content = reportContent ?? await mapCampaign(campaignId)` —— 有快照用快照(用户可能改过),否则从 campaign 重新映射。
- `tokens = { ...dgTokens, ...tokenOverrides }`
- `components = applyManifest(allComponents, manifestOverrides)` —— 按 order 排序、过滤 hidden。

### 7.2 template.hbs 拆 partial + manifest 驱动

**现状**:一整份固定顺序的 282 行 HTML(header → kpi → trend → publishers → insights → actionable 写死)。

**改后**:
- 每个组件一个 partial:`_header.hbs` / `_kpi.hbs` / `_trend.hbs` / `_publishers.hbs` / `_insights.hbs` / `_actionable.hbs`。
- `template.hbs`(layout)按 manifest 用**动态 partial** 循环拼装:
  ```hbs
  {{#each components}}
    {{> (lookup . "partial") . }}
  {{/each}}
  ```
  render 端按 manifest 构造 `components` 数组,每元素 `{partial: 'header', ...content字段}`。`lookup` 是 Handlebars 内置 helper(动态 partial 名,无需自注册)。`hidden` 的组件不在数组里,`order` 决定数组顺序。

**默认 manifest**(无 overrides 时)= 现有固定顺序,保证向后兼容(无 manifestOverrides 的旧调用结果不变)。

### 7.3 数据层(换数据)语义
- 换 campaignId / reportPeriod → 重跑 `mapCampaign` 生成全新 `reportContent` → 旧的 `reportContent` 整个替换(文案层的手改随之作废,除非用户选择保留)。
- 编辑器 UI 在"换数据"时提示:"换数据会覆盖手动改过的文案,确认?"

---

## 8. 编辑器:HtmlStudio 内按报告类型切换

`HtmlStudio` 路由(`GET /projects/:id/html-studio`)根据当前报告类型显示不同左侧面板:

| 报告类型 | 左侧面板 | 右侧预览 |
|---|---|---|
| **AI 自由**(`recipeId == null`) | Agent 对话 + HTML textarea(现状) | iframe(现状) |
| **模板化**(`recipeId != null`) | 四层编辑器(新) | iframe(改任一层实时重渲染) |

### 四层编辑器(模板化报告)

```
┌─ 数据层 ────────────────────────────┐
│ Campaign: [camp-everyday-bf ▾]       │
│ 时间范围: [2026-11-20]~[2026-12-25] │
│ [🔄 重新拉取数据]                    │  → 重跑 mapCampaign,覆盖 reportContent
├─ 文案层 ────────────────────────────┤
│ KPI 标签/值(按 schema 生成的表单)   │  → 改 reportContent 字段
│ 达人名/类型(表格)                   │
│ [✨ AI 重写洞察]                    │  → 重跑 fillActionable(actionable 字段)
├─ 风格层 ────────────────────────────┤
│ 主色 [■#ff099e]  字体 [Outfit ▾]    │  → 改 tokenOverrides
│ 背景色 / 卡片色 / 圆角              │
├─ 结构层 ────────────────────────────┤
│ ☑ Header     ☑ KPI Overview         │  → 改 manifestOverrides
│ ☑ Trend      ☐ Insight Modules(隐藏)│     拖拽调序
│ ☑ Publishers ☑ Actionable Insights  │
└──────────────────────────────────────┘
```

**交互**:任一层改动 → 调 `render`(debounce,如 500ms)→ iframe 刷新。保存 = 写当前 HtmlVersion 的 4 字段 + 渲染出的 HTML。

**文案层表单**:v1 **手写**暴露常用字段(KPI 的 label/value、达人 name/type、actionable 的 title/items 文案),不做全自动 schema→表单(嵌套太深性价比低);其余字段走折叠的 raw JSON 编辑(高级用户/补漏)。`insights` 子卡(topCategories 等)可空,缺失时表单隐藏对应分组。

---

## 9. AI 自由报告:完全不动

`mode:'ai'` + Agent 编辑 + textarea + `/agent-edit` + autoSave + HtmlVersion(多版本)—— 全部保持现状。这类报告不保证数据替换,用户要换数据就重新 AI 生成。零风险、零迁移。

`GenerateHtmlReportOverlay` 弹窗也保持现状(预览/复制/下载/重新生成/另存),但可加一个"生成模式"切换(AI / Recipe),让弹窗也能入口模板化报告。

---

## 10. 错误降级(沿用 recipe 现状,已测)

| 场景 | 行为 |
|---|---|
| 换数据时 campaign 不存在 | 400 "Campaign 不存在" |
| mapCampaign 缺字段(metrics / trend 为 null) | 兜底 `0` / `"—"` / 占位图,**不抛错**,报告照出 |
| AI 写洞察(fillActionable)失败 | 重试 1 次 → 仍失败 → `actionable=[]` + 模板渲染"洞察暂不可用",**报告照出,绝不 500** |
| DeepSeek 连接中断(已知 ~180s 关 socket) | 走已修的 catch(覆盖 terminated/socket),友好提示 + 后续加重试机制 |
| render 时 manifestOverrides 引用不存在的组件 | 忽略未知组件,用默认顺序兜底 |

---

## 11. rebase 与迁移

### rebase worktree(机械冲突,非设计冲突)
1. **recipe 子系统**(`recipe/` 目录,12 文件 + 测试)是纯新增 → **零冲突直接搬**。
2. **集成层**(`html-templates.schema.ts` 加 `mode:'recipe'`+`recipeId`、`controller.ts` 加 recipe 分支、`package.json` 加 `handlebars`)→ main 后续改过这些文件,手动 reconcile:
   - `schema.ts`:main 的 mode 是 `['template','ai']`,加 `'recipe'`;`reportPeriod` 字段保留。
   - `controller.ts`:main 有 agent-edit / autoSave / HtmlVersion 端点,recipe 分支加在 generate 里,不动其它。
3. **template.hbs 拆 partial**:这是本方案的新工作(rebase 之后做,不是 worktree 原内容)。

### DB 迁移
HtmlVersion 加 4 列 → 手写 migration SQL:
```sql
ALTER TABLE `HtmlVersion` ADD COLUMN `recipeId` VARCHAR(191) NULL;
ALTER TABLE `HtmlVersion` ADD COLUMN `reportContent` JSON NULL;
ALTER TABLE `HtmlVersion` ADD COLUMN `tokenOverrides` JSON NULL;
ALTER TABLE `HtmlVersion` ADD COLUMN `manifestOverrides` JSON NULL;
```
本地 DB:加可空列后现有数据自动 `null`(无需重置数据),用 `prisma migrate resolve --applied <name>` 标记迁移已应用(本地 DB 可直接 `ALTER TABLE` 加列,见记忆 `prisma-migrate-dev-needs-shadow-db`)。

### 数据迁移
现有 AI 报告不动(HtmlVersion 新列 null)。无需数据迁移。

---

## 12. 测试策略

**沿用**:recipe 已有 31 测试 + 快照基线(render 确定性、mapper、narrative 降级、schema)。

**新增**:
- render 吃覆盖单测:`tokenOverrides` 合并、`manifestOverrides` 排序/过滤、`reportContent` 快照优先于 mapCampaign。
- template 拆 partial 后的快照测试(确保默认 manifest 下输出与拆分前一致,无回归)。
- 编辑器 UI 组件测试(四层面板交互、debounce 重渲染、保存写 4 字段)。
- 端到端:换数据 → 新 HTML(数字变,结构/风格不变);改 token → 主色变;改 manifest → 组件顺序变。

**web 测试约定**:recharts mocked,只断言 shell(见记忆 `web-chart-test-convention`)。本方案报告用 Chart.js(内联在 HTML),不影响 web 测试。

---

## 13. 工作分解(高层,实现计划阶段细化)

1. **rebase recipe worktree 到 main**(搬 recipe/ 目录 + reconcile schema/controller/package.json)。
2. **DB 迁移**:HtmlVersion 加 4 列 + Prisma schema + 手写 migration SQL。
3. **template 拆 partial + manifest 驱动**(render 改动 §7):拆 6 个 partial,layout 改循环,加默认 manifest,快照测试保回归。
4. **render 吃覆盖**:tokenOverrides / manifestOverrides / reportContent 合并逻辑 + 单测。
5. **后端端点**:模板化报告的"保存配置"(写 HtmlVersion 4 字段)、"重渲染"(POST 返回新 HTML,不保存)。
6. **编辑器 UI**:HtmlStudio 内类型切换 + 四层面板组件 + debounce 重渲染 + 保存。
7. **AI 自由报告**:无改动(验证不回归)。

---

## 14. 风险

| 风险 | 缓解 |
|---|---|
| template 拆 partial 引入回归(渲染结果变化) | 拆分前后快照对比测试;默认 manifest = 现有固定顺序 |
| rebase worktree 冲突比预期大 | recipe/ 目录纯新增零冲突;集成层冲突局限在 schema/controller,可控 |
| manifest 驱动的 partial 循环 Handlebars 性能 | 报告单次渲染,非高频;compiled 已缓存;必要时预编译 partial |
| 文案层 schema 驱动表单复杂(CampaignReportContent 嵌套深) | v1 只暴露常用字段(KPI 标签/值、达人名、洞察文案),其余走 raw JSON 编辑(高级) |
| 用户换数据后丢失文案手改 | UI 明确提示 + 保留"撤销"或"只换数字保留文案"选项(后者需 mapCampaign 只更新数字字段) |

---

## 15. 未来(v2+,本方案不做)

- AI 生成新 recipe / template(用户描述需求 → AI 产出四件套)。
- template mode 与 recipe 合并(template mode 标记废弃)。
- 模板市场(ADMIN 维护多套 recipe,用户选)。
- 结构编辑升级为 WYSIWYG 拖拽画布。
