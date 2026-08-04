# 报告管理:名称全局唯一 + AI HTML 列表操作 — 设计

- 日期: 2026-08-04
- 状态: 已批准,待实现

## 背景

「报告管理」即 `/projects`(`apps/web/src/routes/Projects.tsx`,页标题「我的报告」),报告 = `Project` 实体。AI 生成的 HTML 报告是 `meta.styleType === 'ai-html'` 的 `Project` 行,HTML 存于 `Project.htmlContent`(`@db.LongText`)。

当前两个缺口:

1. **报告名可重名。** `Project.name` 无 DB 唯一约束,应用层也**完全没做**重名校验。四条会设置/产生报告名的路径都缺校验:
   - 新建 `projects.service.ts:create`(直接 `prisma.project.create`,无 `findFirst`)
   - 改名 `projects.service.ts:update`(`CreateProjectDialog` 编辑模式 → `projectsApi.update`)
   - 复制 `projects.service.ts:duplicate`(硬编码 `${src.name} 副本`,不查碰撞)
   - AI 生成保存 `html-templates.service.ts:saveHtmlAsNewProject`(直接建 Project,无校验)

   仓库已有成熟约定可对齐:`templates.service.ts`、`html-templates.service.ts` 均用 `findFirst({where:{name}})` + `ApiError.badRequest('已存在同名…')`,且 Template 的 `duplicate` 会自动找号「X 副本 / X 副本 2 …」。注意:**Template / HtmlTemplate 都只做应用层校验,未加 `@@unique`**。

2. **AI HTML 报告在列表里无法下载/预览/复制源码。** 这三个动作目前只存在于生成弹窗 `GenerateHtmlReportOverlay.tsx`(`handleCopy`、`handleDownload`、iframe 预览)。`Projects.tsx` 列表行操作只有:可视化编辑/GrapesJS、编辑、复制、存模版、删除。且 `projectsApi.list()` / `get()` 的 summary/detail **都不返回 `htmlContent`**,列表拿不到 HTML 源码。

## 目标

1. 报告名**全局唯一**(跨用户,匹配用户选择的「全局不重名」)。AI 生成保存遇重名时**报错要求改名**(不自动加后缀)。
2. 在报告列表中,为 `ai-html` 行提供**预览(新标签页)/ 下载 / 复制源码**三个操作。

## 改动范围

### A. 报告名全局唯一(后端,4 条路径)

统一约定:校验前 `name = name.trim()`;命中重名抛 `ApiError.badRequest(\`已存在同名报告「${name}」,请使用其他名称\`)`(措辞对齐现有「已存在同名模版」)。**仅应用层校验,不加 DB `@@unique`**(与 Template/HtmlTemplate 一致,且规避存量重名数据导致迁移失败)。

1. **新建** `apps/server/src/modules/projects/projects.service.ts:create`
   - 在 `prisma.project.create` 前:`const exists = await prisma.project.findFirst({ where: { name: trimmed } }); if (exists) throw ApiError.badRequest(...)`。

2. **改名** `apps/server/src/modules/projects/projects.service.ts:update`
   - 当 `input.name` 提供且 trim 后与原值不同时:`findFirst({ where: { name: trimmed, id: { not: id } } })`,命中即报错。

3. **复制** `apps/server/src/modules/projects/projects.service.ts:duplicate`
   - 现硬编码 `${src.name} 副本` → 改为循环找号:依次试 `${base} 副本`、`${base} 副本 2`、`${base} 副本 3` … 直到 `findFirst` 不命中(对齐 `templates.service.ts:duplicate` 的写法)。

4. **AI 生成保存** `apps/server/src/modules/html-templates/html-templates.service.ts:saveHtmlAsNewProject`
   - 在 `prisma.project.create` 前加同名 `findFirst` + 报错(与上面 1 相同)。

### B. 前端错误回显

- `apps/web/src/components/CreateProjectDialog.tsx`:核对提交失败路径,把后端返回的错误文案显示到「报告名称」输入框下方(若现有逻辑已通用展示 API 错误则无需改)。
- `apps/web/src/editor/.../GenerateHtmlReportOverlay.tsx` 的保存表单(`doSave` 调 `saveHtmlAsProject`):同样确保重名 400 的文案能展示到「报告名称」字段。

### C. 新增「取单条报告 HTML」端点(后端)

- 路由:`GET /api/v1/projects/:id/html`,沿用 `authenticate`(projects 路由组已挂)。
- `apps/server/src/modules/projects/projects.controller.ts` + `projects.service.ts`:新增 `getHtml(id)` → `prisma.project.findUnique({ where:{id}, select:{ id:true, name:true, htmlContent:true, updatedAt:true } })`;鉴权沿用现有「属主可读」逻辑(与 `get` 一致);404 if not found。
- 返回体:`{ id, name, html: htmlContent ?? "", updatedAt }`。
- 在 `apps/web/src/api/projects.ts` 增加 `getHtml(id)` → `GET /projects/:id/html`。

> 不把 `htmlContent` 塞进 `list()`/`get()` summary —— 避免每次列表加载都拉 LongText。三个操作按需 fetch 一次、按行缓存。

### D. 列表行操作(前端 `Projects.tsx`)

仅对 `p.meta?.styleType === 'ai-html'` 行,在现有操作区追加一个**「HTML ▾」下拉**(避免 8 个按钮挤一行),菜单项:

- **预览**:`getHtml(id)` → `Blob([html],{type:'text/html'})` → `const url=URL.createObjectURL(blob); window.open(url); setTimeout(()=>URL.revokeObjectURL(url), 60_000)`。`html` 为空 → toast「该报告暂无 HTML 内容」。
- **下载**:`getHtml(id)` → 同样 Blob → 触发 `<a download="${name}.html">`,沿用 `GenerateHtmlReportOverlay.handleDownload` 写法。
- **复制源码**:`getHtml(id)` → `navigator.clipboard.writeText(html)` → toast「已复制 HTML 源码」。

实现细节:

- 组件内按行缓存已 fetch 的 html(`useRef<Record<string,string>>` 或 state),三个操作共用一次请求;下拉打开/点击时若未缓存则 fetch。
- fetch 中对应菜单项 loading(禁用 + 转圈);成功/失败 toast。
- 文案与图标与现有行操作风格一致。

## 不改动

- DB schema(`schema.prisma`)—— 不加 `@@unique`,无迁移。
- 现有「复制(整份报告)」语义不变;新增的是「复制源码」(HTML 到剪贴板),文案明确区分。
- canvas / ppt / single 类报告不在下载/预览/复制源码范围内(无 `htmlContent`,且需求明确指向「AI 生成保存的 html」)。
- `html-templates` 模块(HtmlTemplate CRUD)—— 其重名校验已存在,不动。

## 验证

- **后端单测/手测**:
  - 新建重名 → 400 且文案为「已存在同名报告「X」…」。
  - 改名成已有名 → 400;改名成自己当前名或新名 → 正常。
  - 复制「X」→ 生成「X 副本」;再复制「X」→「X 副本 2」;已存在「X 副本」时跳到「X 副本 2」。
  - AI 生成保存重名 → 400。
  - `GET /projects/:id/html` 属主可读、返回 `{id,name,html,updatedAt}`;非属主 403/404(随现有策略);无 htmlContent 时 `html:""`。
- **前端手测**:
  - 新建/改名/复制/AI 保存遇重名,错误文案正确回显在名称字段下。
  - ai-html 行出现「HTML ▾」,预览在新标签页渲染、下载得到 `${name}.html`、复制源码粘贴为完整 HTML。
  - 非 ai-html 行不显示该下拉。
- **回归**:`pnpm test`(web 从 `apps/web` 跑;参考既有 vitest 约定)。

## 风险与边界

- **并发重名**:纯应用层 `findFirst` 在极端并发下可能漏检(两人同时建同名)。概率低且非本次诉求;若需强一致后续可补 `@@unique`(届时需先去重存量数据)。
- **存量重名数据**:本次不加 DB 约束,存量同名报告不会被影响;改名/新建走新校验即可。
- **blob URL 生命周期**:预览新标签页打开后 60s 回收 URL;HTML 已加载进标签页,回收不影响已渲染内容。
- **clipboard 权限**:`navigator.clipboard.writeText` 需安全上下文(https/localhost);dev 环境为 localhost,生产为 https,满足。失败时 toast 提示「复制失败,请手动复制」。
