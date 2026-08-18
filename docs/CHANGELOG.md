# Changelog

## 2026-08-16 — 安全加固与可靠性优化(P0×3 + P1×4)+ AI 生成状态自愈

对服务整体做一轮安全与可靠性专项：堵住弱密钥、无限流、公开提示词三类 P0 风险，补 AI 重试、导出并发、成本审计与首屏体积四项 P1，并顺手修掉两个用户可直接感知的前端顽疾。

- **P0 安全**(`apps/server/src/middleware/rate-limit.ts`、`apps/server/src/config.ts`):JWT 弱密钥 fail-fast——生产环境漏配 `JWT_*_SECRET` 启动即报错；全站限流换 Redis store:全局 300/5min、登录 10/5min、AI 生成 20/h/用户、分享 120/5min;`/system-prompt` 端点挂回鉴权(08-06 曾改为公开，业务 know-how 不再裸奔)。
- **P1 可靠性/成本**(`apps/server/src/modules/html-templates/ai-client.ts`):AI 调用自动重试——429/5xx/网络中断指数退避，generate+edit 双路径接入;puppeteer 导出加并发信号量(max 2 防 OOM,`export.service.ts`);token 用量记录——SSE usage chunk → done 事件 + 服务端日志;`VisualEditor`(GrapesJS 1.1MB)改 React.lazy,`HtmlStudio` 主 chunk 1.1M→36K。
- **aiHtmlStatus 卡死自愈**(`apps/web/src/routes/HtmlStudio.tsx`):AI 生成报错后状态永久停在 generating——SSE error chunk 路径补状态回退 + 页面加载自愈；HTML▾ 下拉遮罩按钮补 aria-label。
- **新建报告弹窗校验**(`apps/web/src/components/CreateProjectDialog.tsx`):移除提交按钮 `disabled` 与原生 required(空表单点击零反馈的根因)，改 `submitted` 标记——点击创建后才逐项行内校验(报告名称/业务线/模版选择)，边填边不误报。

**验证**:server tsc + 283/283、web tsc + 806/806、build 全绿。

## 2026-08-16 — 历史测试清零 63→0(806 全绿)+ 业务线/广告主查找表切 DB 源 + drift 表补录迁移链

三项数据与质量收敛：web 测试从 63 个失败修到全绿并顺带挖出 2 个产品 bug;前端查找表 mock 全删改读数据库；12 张 drift 表补进 migration 链，测试库可从零重放。

- **测试清零**(`apps/web/tests/`,25 个文件):按产品现行行为修齐 title-block、TemplateOverlay 卡片化、DataSourceSection、applyPageBinding 强制重填、KPI 行编辑器、作品截图多达人勾选、数据页 DB API 等用例;修出 2 个产品 bug——`editor/store-helpers.ts` 的 `placed()` snapResize 越界(1276>1280)、`CreateProjectDialog` PPT 模式默认提交 1242×1656 竖图(应为 1920×1080)。
- **查找表切 DB**(`apps/web/src/projectsMeta.ts`、`apps/web/src/editor/useBusinessLineLogo.ts`):删除全部 mock 常量(BUSINESS_LINES/CREATORS/ADVERTISERS/MERCHANTS 等),`useBusinessLineLogo` 扩展为通用 lookup 缓存层(`useBusinessLineCodes`/`useBusinessLineInfo`);8 个下拉组件 + 4 个展示组件(Canvas/PageView/ReportSettingsOverlay/BasicComponents)切换到数据库来源，web 测试与基线零回归。
- **drift 迁移链补录**(`apps/server/prisma/migrations/20260715000001_create_core_drift_tables/`、`20260815000000_add_drift_columns/`):8 张从未进链的表(Merchant/BusinessLine/Advertiser/Campaign/Creator/CampaignCreator/CreatorPerformance/Collaboration)+ 11 个 FK 精确还原建表，补 Project.reportSchemeVersion、Template.htmlContent 漂移列；15 个 migration 全链空库重放通过;新增 `apps/server/scripts/sync-drift-columns.mjs`(只增不删)与 `rebuild-test-db.cjs` 一键重建。

## 2026-08-14 — SSE 流式生成：思考过程 + 实时预览 + 取消 + 三栏布局

AI 生成/编辑从「同步等 2-3 分钟黑盒」改为 SSE 流式：思考过程实时可见、生成中即有预览、可随时取消；随后把思考流收敛进对话流，交互减负。

- **后端流式**(`apps/server/src/modules/html-templates/ai-generate.service.ts`):`generateHtmlStream()`/`editHtmlStream()` 异步生成器，SSE 解析分离 `reasoning_content` 与 `content`,支持 abort 与 HTML 后处理；新路由 `POST /generate-stream`、`POST /agent-edit-stream`(SSE 头、req.close 触发 AbortController)。
- **前端消费**(`apps/web/src/api/htmlTemplates.ts`、`apps/web/src/components/ResizablePanels.tsx`):`consumeSSEStream` 用 fetch + ReadableStream 手写 SSE 解析；可拖拽三栏布局(左配置/中预览/右 chat)。
- **体验迭代**(`apps/web/src/routes/HtmlStudio.tsx`、`AgentChatPanel.tsx`):删除独立 ThinkingPanel 横条，思考内容改为对话流里的状态气泡(思考完成后可折叠)；首次生成思考移至中栏 loading 区，编辑时画布叠加半透明 loading 遮罩(保留旧报告，完成后一次性替换);取消 SSE content chunk 的渐进式渲染防闪烁;`onBusyChange` 把编辑繁忙 + 取消能力提升到 HtmlStudio;取消/完成/切 phase 三处清空 reasoning 残留。
- **思考中文化**(`ai-generate.service.ts`):SYSTEM_PROMPT 加 REASONING LANGUAGE 段 + `THINKING_LANGUAGE_SUFFIX` 追加到 user prompt 末尾(生成/编辑共 4 条拼装路径全覆盖)——推理语言跟随最近的 user 消息，仅改 system prompt 实测无效；glm-5.2 思考由全英文变全中文，HTML 输出仍守英文规则。

## 2026-08-14 — AI HTML 报告换周期复制全链路(四级策略)+ 复制项目可选周期

复制一份 AI HTML 报告并换时间段时，数字与日期必须跟着变。围绕 `duplicate()` 落地四级递进策略，并把「选周期」做进复制弹窗。

- **模版可视化编辑起步**(`apps/web/src/routes/TemplateHtmlStudio.tsx`):Template 加 `htmlContent`(LongText)列，html-report 模版可进 GrapesJS 可视化编辑 + 预览 + 源码三态(列表点击直达 `/templates/:id/html-studio`)。
- **日期替换**(`apps/server/src/modules/projects/projects.service.ts`):`replacePeriodInHtml()` 覆盖 2024-01 / 2024年01月 / 2024.01 / 2024-01-15 多格式；后续修掉「无 oldPeriod 直接 no-op」的早退——精确映射 + 正则兜底双策略与 NaN 守卫。
- **快照值替换**(`apps/server/src/modules/html-templates/period-snapshot.ts`):`getPeriodSnapshot()` 按 period 过滤 CPS daily 算 KPI 原始值，`buildValueReplacementPairs()` 生成 old→new 全格式变体("1,736"→"2,051"、"$12.5K"→"$15.3K"),长串优先文本替换——<100ms、零 AI 调用、老报告无需改 prompt。
- **AI 重生成**(`ai-generate.service.ts`):`buildCampaignContext` 指定 reportPeriod 且有 daily 时按日期切片，算期内 KPI/趋势/per-creator 汇总并注入 `periodKpis`;`autoSaveHtml` 落库 aiPrompt + designMd 供重生成复用；期内零点击/零订单的达人在上下文中被过滤。
- **data-field 模板渲染引擎**(`apps/server/src/modules/html-templates/template-renderer.ts`,474 行):SYSTEM_PROMPT 要求所有动态值带 data-field 标注，复制时解析标注并用期内数据回填——最终优先级链:data-field 即时渲染(<100ms)→ AI 重生成(10-30s,兜无标注老报告)→ 快照值替换 → 日期文本替换;修复达人头像字段名 `avatarUrl`→`avatar`(对齐 Prisma Creator 字段，此前恒空)，补该模块首个测试(template-renderer.test.ts)。
- **复制项目选周期**(`apps/web/src/components/DuplicateProjectDialog.tsx`):duplicate 路由加 zod `duplicateSchema`,前端 `duplicate(id, reportPeriod?)` + 选周期弹窗。

## 2026-08-14 — recipe 数据与洞察增强：ROAS/CVR/MoM + Insight 四维度 + Creator Contribution

对齐 PSD 报告暴露的 A 类 gap 与 Insight 卡数据断裂：recipe 报告补派生 KPI、月环比、四维度洞察与达人归因叙事，数据全部来自数据管控表。

- **CPS 5 维度列**(`apps/server/prisma/migrations/20260813185519_cps_dimensions/`):CpsPerformance 加 product/category/market/promo 标签列;`importCpsPerformance` 录入(trim,空串→null,`campaigns.service.ts`);前端导入模板同步加列(`apps/web/src/editor/dataImport.ts`)。
- **维度聚合纯函数**(`apps/server/src/modules/html-templates/recipe/campaign-report/dimensions.ts`):按品类/产品/市场/促销 groupBy → Insight 四卡(品类饼图/产品收入表/市场条形图/促销表);`mapFromDaily`(期内切片)与汇总分支(链接 gmv)两条路径都接入;`template.hbs` 补 discount/coupon/bundle/flash/gift 五类促销 tag CSS。
- **ROAS/CVR 派生 KPI**(`recipe/campaign-report/mapper.ts`、`recipe/format.ts`):汇总路径 totalSpend 从 cpsPerformances.spend 求和，spend>0 时追加 ROAS(`formatRatio` 乘数→"4.10x");CVR = orders/clicks 除零安全;`partials/_kpi.hbs` 网格列数 `md:grid-cols-{{kpis.length}}` 动态化(支持 5/6 张);KPI 总量优先 `analytics.summary`、trend 兼容每日数组与旧预透视两种存储格式。
- **MoM 月环比**(`mapper.ts` + `_kpi.hbs`):reportPeriod vs 前等长期间，输出 ordersMoM/salesMoM + 当前/前值；前等长无数据降级 undefined;半开 reportPeriod(只 startDate)guard,避免 end 回退 campaign.endDate 导致窗口不对称。
- **Creator Contribution 归因**(`ai-generate.service.ts`):SYSTEM_PROMPT 加归因叙事模板——基于 cps.orders + creator 定位 + deliverables 写 content role / why converted,禁止编造数字;引用字段对齐 `buildCampaignContext` 实际输出(tier/contentType/platform),消除 AI 幻觉风险。

## 2026-08-13 — recipe 换时间段秒级重算全链路 + 从 HTML 模版新建活报告

「调报告时间段→秒级重算」从数据层贯穿到入口：CPS daily 补 spend/newCustomers,mapCampaign 按期切片，recipe 版本创建/重算落库，从模版新建直出活报告。

- **数据层**(`apps/server/src/modules/campaigns/campaigns.service.ts`):`importCpsDaily` 收 `dailySpend`/`dailyNewCustomers` 进 daily JSON(免迁移，照搬 dailyGmv 模式)，配 campaigns 模块首个单测；前端 cps-daily 导入支持两列(`apps/web/src/editor/dataImport.ts`)。
- **按期重算**(`recipe/campaign-report/mapper.ts`):`mapCampaign(campaignId, reportPeriod?)` 有 period 且有 daily 时走纯函数 `mapFromDaily` 按 [start,end] 切片重算 KPI/publishers/trend/insights/period,否则降级原汇总逻辑；controller recipe 分支修掉丢 reportPeriod 的 bug 真正透传(`RenderInput.reportPeriod`,`recipe/types.ts`)。
- **G1 创建 recipe 版本**(`html-templates.service.ts` + `POST /projects/:id/recipe-version`):`createRecipeVersion` 写 `HtmlVersion.recipeId` + `reportContent` 快照，补 project 不存在 404 用例。
- **G2 换期重算落库**(`html-templates.service.ts`):`recomputeRecipe` 重渲染并覆盖 reportContent + html + 同步 Project.meta.reportPeriod,不再只是预览。
- **前端接线**(`apps/web/src/routes/HtmlStudio.tsx`、`editor/components/recipe-editor/DataPanel.tsx`):recipe 生成改调 createRecipeVersion、DataPanel 重新生成改调 recomputeRecipe;recompute 路径起止日期两日期必填(对齐后端 recomputeSchema)。
- **从模版新建活报告**(`apps/server/src/modules/projects/projects.controller.ts`):`createFromTemplate` 支持 reportPeriod 覆盖 meta;ai-html 模版带 campaignId 时为新项目建活 recipe 版本(进 RecipeEditor 只改时间段即重算);弹窗时间段默认填模版 reportPeriod;门禁放宽认 `renderType=html-report` 老式模版。
- **配套**(`apps/server/prisma/seed-cps-daily.ts`):按 (campaignCreatorId, contentType, date) 幂等 seed,让 daily 切片分支有数据可走。

## 2026-08-12 — DataRecord 统一数据模型 SP1(scopeCampaignId)

报告与 PPT 编辑器两套数据消费路径不对账(报告读 Campaign.analytics blob + CpsPerformance,编辑器读 DataRecord)。SP1 打数据模型底座，作为「全面统一到 DataRecord」五步计划的第一步。

- **schema**(`apps/server/src/modules/data/data.schema.ts`):COLLABORATION deliverable 加 `performance.daily`(per-contentType 每日业绩，作为 per-creator 业绩的原子真现);`CAMPAIGN.analytics` 标 deprecated。
- **列 + 索引**(`apps/server/prisma/migrations/20260812185323_datarecord_scope_campaign/`):DataRecord 加 `scopeCampaignId` 列 + (kind,scopeCampaignId) 复合索引，支持按 campaign 高效查 COLLABORATION。
- **写入同步**(`apps/server/src/modules/data/data.service.ts`):三处写入点同步 scopeCampaignId,配单测。

**已知限制**:SP1 仅数据模型层；数据入口、recipe/AI 改读 DataRecord、存量搬迁与旧路径下线留 SP2-SP5。

## 2026-08-12 — 报告静态资源自托管 + 生产 AI 生成 504 修复

生产环境两类故障一并治：AI 生成 HTML 报 504(nginx 默认 60s 超时 < 推理生成 2-3min),报告/app 依赖的海外 CDN 国内不可达。

- **nginx 超时级联**(`apps/web/nginx.conf`):/api/ 加 proxy_connect/send/read_timeout(60/300/300s),保证 server fetch 290s < nginx 300s = 前端 axios 300s,server 的 JSON 响应先于裸 504 返回(dev 因 vite proxy 600s 不受影响)。
- **vendor 自托管**(`apps/web/public/vendor/`):fontawesome(css+webfonts)/tailwind play/chart.js 自托管，nginx 同源托管 /vendor/;`index.html` 图标改相对路径;`ai-generate.service.ts` 新增 `rewriteExternalAssets` 后处理把 3 个海外 CDN 改写为自托管绝对路径(PUBLIC_BASE_URL||webUrl)——不改 SYSTEM_PROMPT,AI 行为不变，base 为空 no-op;配 8 例单测。
- **recipe 模板同治**(`recipe/campaign-report/render.ts` + `template.hbs`):render 注入 vendorBase 上下文，Tailwind/Chart.js/FontAwesome 走 `{{vendorBase}}/vendor/...`(与 AI 报告后处理一致)，Google Fonts 换 fonts.loli.net 国内镜像；重生成快照 + CDN 断言，修国内 recipe 报告裸 HTML(无样式/图表/图标)。

## 2026-08-11 — AiGenerateForm 共享组件 + glm-5.2 推理模型兼容

弹窗版与沉浸式版两套 AI 生成表单长期 drift,抽共享组件收敛；同时修两类模型层问题：推理模型 token 耗尽导致文案静默空白、提示词模板字符串让 server 起不来。

- **共享表单**(`apps/web/src/editor/components/AiGenerateForm.tsx`,343 行):mode/提示词模板/提示词+全屏/系统提示词+全屏/design.md/生成按钮，内部加载 getDesignGuide+getSystemPrompt;`GenerateHtmlReportOverlay` 与 `HtmlStudio` 双双换用，分别 -203/-339 行(删约 15 个 useState + 4 个 effect),预览/保存/chat 流程不变，配组件单测。
- **narrative 兼容推理模型**(`recipe/campaign-report/narrative.ts`):gateway 实给 glm-5.2 推理模型，思考放 reasoning_content、答案放 content;原 max_tokens:2000 被推理吃光 → content 空 → `JSON.parse('')` 静默降级，recipe 报告 actionable 文案长期空白(generate 仍 200 难发现)。改 `isReasoningModel ? 16000 : 8192`,content 空且有 reasoning_content 时先从中抠 JSON 数组，抠不到带 finish_reason 明确抛错；补 2 条单测(7/7)。
- **SYSTEM_PROMPT 反引号崩溃**(`ai-generate.service.ts`):08-10 补 Chart.js 脚本存活规则时，规则文本里的字面反引号提前闭合模板字符串，esbuild 报错、server 启动即退；转义修复。

## 2026-08-10 — HTML 报告可视化编辑器(GrapesJS)落地

HtmlStudio 从「只能看源码」进化为可视化编辑：GrapesJS 内嵌 + 一连串渲染/DOM 修复，文本、图标、表格单元格可直接编辑。

- **基础接入**(`apps/web/src/components/VisualEditor.tsx`):编辑前剥离 script/canvas;chat 阶段三模式(编辑/预览/源码)，默认预览、手动进编辑;`parseHtmlForEditor` 分离 body HTML、`<style>`、字体 link、Tailwind CDN,load 时注入 canvas iframe 的 head 保证样式回显(canvas 用斜纹占位保布局)。
- **DOM 爆炸与面板修复**(`apps/web/src/index.css`):自定义图层树替代 GrapesJS 原生面板(775 节点全量渲染→2 根级惰性，面板高度 864386px→437px,后被进一步裁撤)；sector title caret SVG 无尺寸约束渲染 273×273 撑爆布局→强制 12px(总面板 2026px→681px);隐藏 Spectrum 颜色选择器 less/⨯/Ok 按钮噪音与 sp-hidden 幽灵区域；iframe 填满容器(修复前仅 300×150)。
- **编辑交互定型**(`VisualEditor.tsx`):原生 contenteditable 双击编辑(td/th/p/span/h1-6/li/div/a 等含文本元素，dblclick 走 capture 阶段抢跑 GrapesJS 内置 RTE,Escape/Enter/focusout 退出并同步模型)；移除属性面板与图层树专注文本编辑(753→~460 行);补 grapesjs 0.23.4 `getDocument()`/`getCss()` 空值守卫修 CI tsc 报错。
- **图标编辑**(`apps/web/src/components/IconPicker.tsx`):FA5 把 `<i>` 内部替换成 `<svg>` 导致双击落空——`findIconContainer()` 向上找图标容器，支持 fa/fas/far/fab/fi-/icon/material-icons/bi/lu 多图标库;选中图标右侧弹 IconPicker(100+ FA 图标网格 + 分类 + 搜索 + 手输 class),替换保留颜色/大小等非图标 class;修图标面板跳回。
- **Agent 多模态**(`apps/web/src/routes/AgentChatPanel.tsx`):AI 对话支持图片上传(最多 5 张/4MB,base64 附消息)+ HTML 文件导入直接载入编辑器；后端 `editHtml` 走 OpenAI vision 多模态格式，schema/controller/前端 API 全链路透传。
- **Chart.js 存活**(`VisualEditor.tsx`):双重 body 标签致内层 script 被浏览器丢弃、canvas 全白——body 匹配贪婪化剥离嵌套标签，导出时重注入 body 脚本；系统提示词同步加脚本位置与存活性规则(6989e10)。

## 2026-08-10 — 模板与编辑组件体验批

存模版/模板列表/业绩看板/作品截图组件一轮体验修复与统一。

- **存模版弹窗**(`apps/web/src/components/SaveAsTemplateDialog.tsx`):重写补齐与创建模版一致的表单——渲染类型卡片(多页PPT/长图海报/HTML报告)、尺寸预设、业务线/场景/模版类型级联选择、来源 meta 自动回填;随后来源信息(渲染类型/业务线/场景/模版类型)改只读展示，仅名称备注可编辑;`inferRenderType` 优先 `meta.styleType`,修 AI HTML 报告被误判为长图海报。
- **模板列表**(`apps/web/src/routes/Templates.tsx`):模版类型改彩色徽章(campaign-report 蓝系 / campaign-proposal 绿系 / media-kit 粉橙系)，与「样式」列徽章风格一致。
- **作品截图**(`apps/web/src/editor/property-panel/importers.tsx`、`custom-fields/WorkScreenshotFields.tsx`):多达人 checkbox 多选→并行拉取合作数据→合并截图，导入后自动重置 displayCount;全局说明文字一键隐藏/显示开关(混合态显示「部分已隐藏」)。
- **看板与页眉**(`apps/web/src/editor/components/report/KpiBoard.tsx`、`BasicComponents.tsx`):flat 变体 compare 为空不再渲染「vs last period」整行；KpiBoard 的 Campaign 导入换 `KpiCampaignImporter`(提示 + 下拉 + 导入按钮)与其他组件统一；多页 PPT 页眉去掉默认业务线占位(仅手动上传 logo 才显示)，页面类型枚举去掉单页报告。

## 2026-08-06 — recipe 报告子系统：内容契约 + 确定性渲染 + 四层编辑器

把手工打磨的 DG Campaign Report 固化为可复用配方：同一套风格与组件结构，换 campaign 数据即产出同规格报告；数字/图表/表格 100% 数据驱动不过 AI,只有洞察叙事文案交给 AI。

- **渲染管线**(`apps/server/src/modules/html-templates/recipe/campaign-report/`):四件套 `schema.ts`(每组件 Zod 内容契约)/`template.hbs`(Handlebars)/`tokens.ts`(DG 风格 token)/`mapper.ts`(campaign DB → 内容契约);`narrative.ts` AI 只写 Actionable Insights 文案(结构化 JSON + Zod 校验 + 失败降级报告照常出);`generateHtmlSchema.mode` 改 `['ai','recipe']`,删旧 template mode 与 `generateFromTemplate`。
- **结构可编辑**(`recipe/campaign-report/manifest.ts`):模板拆 6 组件 partial(header/kpi/trend/publishers/insights/actionable),manifest 驱动组件顺序/隐藏;默认 manifest 输出与拆分前 byte-identical(快照不回归)。
- **配置落库**(`apps/server/prisma/schema.prisma` + 迁移):HtmlVersion 加 recipeId/reportContent/tokenOverrides/manifestOverrides 4 列(CREATE TABLE IF NOT EXISTS 兜底);`PATCH /html-versions/:versionId/recipe-config` 保存 4 字段 + 重渲染，`POST /recipe/render` 免落库预览。
- **四层编辑器**(`apps/web/src/editor/components/recipe-editor/`):Data(campaignId/period + 重新生成)/ Content(KPI + 发布方名)/ Style(dgTokens 全键)/ Structure(6 组件勾选 + 排序 + 隐藏)四面板，500ms debounce 实时重渲染预览；HtmlStudio 检测激活版本 recipeId 自动接管，mode 切换 AI/Recipe,移除 template mode UI。

## 2026-08-06 — Report Agent 混合模式 + 提示词工程 + GLM-5.2 切换

HtmlStudio 重构为「配置面板生成 → 自动保存 → Chat 迭代」双阶段 Agent 流；提示词从自由文本升级为规则体系；生成服务切到 ai-gateway 的 GLM-5.2。

- **Agent 模式**(`apps/web/src/routes/HtmlStudio.tsx`、`AgentChatPanel.tsx`):`EDIT_SYSTEM_PROMPT` + `editHtml()` 增量编辑，`POST /agent-edit` 接「当前 HTML + 指令 → 修改后 HTML」;`autoSaveHtml()` + `PATCH /auto-save` 免版本管理自动落库;删多版本 UI(version 切换/保存弹窗)换可折叠源码面板;ProjectMeta 加 agentHistory。
- **提示词概念统一**(`apps/web/src/report-presets.ts`):designSpec 并入单一 prompt 编辑器，AI 智能排版/投放结案/达人复盘统一为带 description 的 prompt 模板卡片，design.md 以 `{{design.md}}` 徽章展示自动注入;修 USER_PROMPT_TEMPLATE 缺 `{{PROMPT}}` 占位导致用户指令被静默丢弃的 bug。
- **提示词工具**(`apps/web/src/components/MarkdownEditor.tsx`):Markdown 预览 + 全屏编辑/查看;`GET /system-prompt` + SYSTEM_PROMPT_DISPLAY 中文展示版让系统提示词可见(当时设为公开端点，08-16 安全加固中收回鉴权)。
- **规则体系**(`ai-generate.service.ts`):报告 UI 文本语言规则(先强制简中、后按需改回英文);rule 10 跨章节数据一致性 6 子规则(trend 总和=KPI、分布和=总量、派生指标从原始值重算——源自 DG 报告 weeklyTrend 1,425 单 vs 聚合 1,736 单 22% 不符 bug);布局零容忍禁令(nav/锚点/section id)+ WRONG/RIGHT 示例。
- **GLM-5.2**(`ai-generate.service.ts`):API 切 ai-gateway.g2h3.com/v1、MODEL=glm-5.2(.env 手动更新);模型检测加 glm 系列→推理模型 max_tokens=16000 + reasoning_content 耗尽 token 的 content 空防护;错误文案 'DeepSeek'→'AI'。

## 2026-08-05 — AI HTML 报告生成上线 + 报告管理/表单大版本(含 08-02 P0×5/P1×10 优化)

本地积累批量提交：AI 生成 HTML 报告全链路、报告列表管理动作、报告名全局唯一，以及创建/录入表单的 P0×5 + P1×10 优化。

- **AI HTML 报告**(`apps/server/src/modules/html-templates/`):新模块 ai-generate.service(generate + SYSTEM_PROMPT + buildCampaignContext 上下文)+ controller/routes/schema;前端 `GenerateHtmlReportOverlay.tsx`(预览/下载/复制源码/保存到报告);CampaignPage 与报告列表入口收敛为同一生成流程;补 HtmlTemplate 表 + Project.htmlContent 迁移(`20260805000000_html_template`,migrate resolve 标记已应用)。
- **报告名全局唯一**(`apps/server/src/modules/projects/projects.service.ts`):create/update/duplicate 全局查重 + trim;duplicate/createFromTemplate 撞名自动找号「X 副本/副本 2」;`saveHtmlAsNewProject` 重名 400;`GET /projects/:id/html` 让列表「预览/下载/复制源码」按行按需取源码，不撑爆 list 响应。
- **编辑器组件**(`apps/web/src/editor/components/`):CampaignAnalyticsEditor、GlobalHeaderFooter、CardsRowFields、CreatorWorksListFields、PageHeaderSyncButton;work-screenshot 布局预设(+68 行测试);CreateProjectDialog 报告时间范围须落在所选 Campaign 区间内;配套 migrate_fontweight/migrate_gap/update-dg-analytics 等工具脚本。
- **P0×5**(08-02,`CreateProjectDialog.tsx`、`editor/store.ts`):PPT 多页固定 16:9(1920×1080)去自定义尺寸;创建人改自由输入 + datalist 建议;单页新增 7 种预设尺寸(小红书/IG/公众号/A4 等)+ 自定义宽高;从模板新建改卡片网格 + 缩略图占位;修 CPS 每日数据无法输入(addCpsDay 状态竞态 + setCpsDaily 展开 undefined)。
- **P1×10**(08-02,`RecordFormModal.tsx`、`editor/dataImport.ts`、`TemplateFormDialog.tsx`):平台字段多选 chip 可手动新增、日期原生 DatePicker、预算拆币种下拉(CNY/USD/EUR/JPY)+金额输入、状态 5 值枚举、达人库层级/平台/品类 Combobox、效果数据 24 个内联 SVG icon 选择器、新建模板先选渲染类型、下载模板必填/选填标注 + 逐字段中文批注、Campaign 列表「查看达人」→「查看数据」、owner→「归属者」;附带 FT 模板佣金图标题与毛利率 KPI 数据修正。

## 2026-07-31 — 单页报告超长画板 + G1-G3/C1-C6 模板组件优化

单页报告支持超长画板与画布内滚动；落地 settlement/digchic 两套单页模板，并按 Obsidian todo 完成 G1-G3 模板项与 C1-C6 组件项优化及页面绑定数据补全。

- **超长画板**(`apps/web/src/editor/templates.ts`、`Canvas.tsx`、`PageSidebar.tsx`):Template 接口新增 `canvasHeight` 字段,settlement/digchic 设 900px(settlement 增业务动作 KPI + 运营洞察 Section 05;digchic 增 Top Promotion Offer 表 + Actionable Insights);`applyTemplate` 自动把画板调到模板推荐高度;Canvas 外层 overflow-hidden→overflow-auto,Ctrl/Cmd+滚轮缩放、普通滚轮自然滚动,首次 fit 改为宽度优先(高度溢出靠滚动查看)。
- **G1-G3 模板**(`templates.ts`、`ReportSettingsOverlay.tsx`、`defaults.ts`):新增 `report-single-page-settlement` / `report-single-page-digchic`;默认数据源改为 project;全局样式浮层加 10 套预设背景。
- **C1-C6 组件**(`report/TimelineCompare.tsx`、`CreatorComponents.tsx`、`pageBinding.ts`、`property-panel/DeliverablePicker.tsx`、`property-panel/custom-fields/WorkScreenshotFields.tsx`):TimelineCompare 自适应列布局修内容溢出;CreatorList 表头对齐 + 页面绑定;CommentWordcloud 默认英文关键词 + 达人绑定;WorkMetrics 自动封面 + 作品绑定;CreatorWorksList 卡片改 3/4 比例贴近社媒;DeliverablePicker 达人切换自动联动 + 去重表单。
- **绑定收尾**(`pageBinding.ts`、`property-panel/importers.tsx`):`creatorPatch` 新增可选 `allCreators`,creator-list 页面绑定时默认填充项目下全部达人(非单个 page-bound creator);`ReportWorkMetricsImporter.onPick` 补 cover 字段(取 screenshots[0].src)。

## 2026-07-30 — 单页 campaign 月报:4 套模板 + 业务组件自动数据绑定 + 保存修复

新增单页 campaign 月报页面类型与 classic/dashboard/narrative 三种衍生风格,模板组件全面切换到 campaign/creator 数据自动绑定,并修复两类导致保存失败的 schema 缺口。

- **模板与 seed**(`apps/web/src/editor/templates.ts`、`packages/shared/src/types/page.ts`、`apps/server/prisma/seed-single-page-report.ts`):新 page type `report-single-page`(标题 + KPI 看板 + 趋势图 + 漏斗 + 渠道表,渠道表预配达人/站点/社群列)+ Classic(经典商务)/ Dashboard(数据仪表盘)/ Narrative(叙事分析)三风格;seed `single-page-campaign-monthly` 通用方案 + 绑定 `camp-glowlab-q4` 的示例项目,KPI/漏斗经 pageBinding 自动绑定,可幂等重跑。
- **自动数据绑定**(`templates.ts`、`pageBinding.ts`):单页模板通用组件替换为业务组件——bar-chart→campaign-summary、text+table→publisher-table、bar-chart→timeline-compare、kpi-board→funnel-chart;bar-chart(周 GMV 趋势)、campaign-analysis(六维雷达)、indicator-card(GMV)、table(发布者表现)、creator-fan-interest(标签)均走既有 `applyPageBinding` 管线自动填充。修两个根因:applyPageBinding 传空 newCompIds 导致切达人时跳过无 `_dataSource='project'` 的组件(改为传全部组件 id);`creatorPatch` 在 stats 为空时返回 null(改为从 followers/engagement/platform/tier 派生兜底)。
- **空数据崩溃修复**(`editor/components/report/CampaignReport.tsx`、`ContentReport.tsx`、`PlacementReport.tsx`):11 个报告组件对数组字段解构无默认值,data 为 `{}` 时 `.map()` 抛错被 ErrorBoundary 捕获;统一加 `= []` 默认,seed 报告同时填入 GlowLab Q4 真实 demo 数据(KPI/GMV 趋势/带步骤漏斗)。
- **保存与编辑**(`apps/server/src/modules/projects/projects.schema.ts`、`apps/web/src/components/CreateProjectDialog.tsx`、`editor/EditorTopbar.tsx`):服务端 pageTypeSchema 此前缺 4 个单页变体枚举,含这些页型的项目 Zod 校验 400、自动保存失败——补齐枚举;branding 接受 `blBadge`;编辑表单 spread 保留全部既有 meta(campaignId/campaignInfo/advertiser 等,此前仅保 theme+reportData 会丢数据);保存失败展示 Zod 校验详情;编辑器顶栏内联「编辑」弹窗。
- **campaign-summary 统一导入**(`editor/property-panel/CampaignSummaryImporter.tsx`、`PageProperties.tsx`、`registry.tsx`):新导入器双页签(Campaign 数据切换 + Excel 导入),Campaign 列表按项目业务线过滤,切换实时预览指标,Excel 解析 label/value/compare 列;移除与页型冗余的「当前页面版式」区块。

## 2026-07-30 — 页面模板视觉优化批次 + 属性面板重组 + BL 徽标配置化

对全部页面模板做一轮视觉质量修复(溢出/重叠/留白/对齐/标题规范),右侧属性面板按五分类重组并补齐缺失组件,BL 徽标全面配置化并改读数据库 logo。

- **模板布局 14 处修复**(`editor/templates.ts`):笔记溢出页面底部(>720px)、叙事模板时间线与雷达重叠、product/placement/posts 等页高度扩展消留白、title/cover 页左边距 120→80、case 卡片全幅、overview 卡片撑满宽度等。
- **标题与占位内容**(`templates.ts`):全部模板标题统一左上角(x=marginX, y=40);页头从基础 text 统一改 title-block 组件并英文化(~35 套模板,fan 性别/年龄组件补英文主副标题);封面/标题页文本高度 120→180/160px 修第二行裁切;8 套 campaign-report 模板填充差异化占位内容(周报/月报/渠道/复盘各按语义配 KPI、图表与洞察)。
- **图表与全局背景**(`editor/components`、`editor/store.ts`):柱状图 Y 轴 32→56px + 紧凑格式化(28500→28.5K、1.28M)修数值裁切;全局背景保存时自动应用到无自有背景的页面(新 store action `applyBackgroundToPagesWithoutOwn`,保留用户逐页设置)。
- **属性面板与组件面板**(`editor/ComponentPanel.tsx`、`property-panel/PropertyPanel.tsx`、`fields/`):面板补 12 个缺失组件(campaign-summary/funnel/publisher/geo/device/swot 等)并新增「策略·内容」分类;12 个组件类型补中文标签;面板标签统一「分类·组件名」五分类格式(基础/达人/业绩·商品/渠道·广告/商务·品牌)去英文名;面板增高 + 弱化搜索 + 页签与搜索同行;新 `MultiSelectField` chip 多选(达人头像卡「全部平台」多选、「主平台」单选);删除与 DataSourceSection 重复渲染的 CreatorLinkImporter / ReportCreatorWorksImporter。
- **BL 徽标与 logo**(`ReportSettingsOverlay.tsx`、`Canvas.tsx`、`preview/PageView.tsx`、新 `editor/useBusinessLineLogo.ts`、`packages/shared/src/types/theme.ts`):全局样式面板可配徽标位置/尺寸/透明度;logo 改从数据库读取(lookupApi,优先级 theme.branding > DB businessLine.logo > BUSINESS_LINE_META 兜底,模块级缓存防重复请求);logo 高度改 auto 按宽等比缩放并移除易误解的 height 输入;修数字输入无法清空(`Number(v) || fallback` 把空串吞成兜底值)。
- **皮肤色值收尾**(`editor/components/BasicComponents.tsx`、`routes/SharePage.tsx`):清除最后一批硬编码色值(#fff/#000 → `var(--surface-primary)`/`var(--foreground-primary)`),剩余 #hex 均为 CSS 变量 fallback;换肤链路(改 `--color-primary` 即时重绘 SVG/文字)验证通过。

## 2026-07-29 — UX 与代码审计修复批次(P0/P1 15 项 + 运行时/安全 11 处)

一轮系统审计后的集中修复:15 项 P0/P1 UX 问题(含两处数据丢失风险)+ 编辑器 5 个运行时 bug + 服务端 5 个运行时/安全 bug + 导出缺 await。

- **P0 数据丢失**(`editor/PageSidebar.tsx`、`editor/store.ts`):删页改两次点击确认 + toast;`flushSync` 大 payload(>60KB)回退同步 XHR 而非 keepalive(规避竞态丢保存)。
- **P1 核心摩擦**(17 文件):新增 `components/Toast.tsx` + App 挂 ToastContainer,替换 12 处 `window.alert`;各删除/导入 handler 加 try/catch + toast(替换 `window.location.reload` 与静默 catch);Login 硬编码凭据收敛到 `import.meta.env.DEV`;`helpers.tsx` useDataUpdate 提交 500ms 防抖(撤销历史不再被逐键击穿);ListField 优雅处理 `auto` 颜色;EditorTopbar 未保存离开警告;SharePage 窗口 resize 重算 fitScale;新增 useEscapeToClose hook。审计清单见 `EDITOR_UX_AUDIT.md`。
- **编辑器运行时**(`Canvas.tsx`、`store.ts`、`importers.tsx`):marqueeRect 进 useEffect 依赖导致监听器每帧重建(旧闭包 + 性能)改 ref 读取;空操作不再入 history(undo 刷空);连续 paste 偏移累计(此前恒 +20 完全重叠);`applyBackgroundBatch` 一次性历史快照;getCollaboration 未 catch 的 rejection 修掉。
- **服务端安全/运行时**(`data.service.ts`、`campaigns.service.ts`、`fontStorage.ts`、`export.service.ts`):data update/remove 加 ownerId 守卫(IDOR——用户可改删他人记录);importCpsDaily 去掉 gmv/commission 前缀重复拼 `$$`;fontStorage.remove 写链内执行读改写防并发互恢复;renderImages 截图失败销毁 archive/passthrough 防响应挂起。
- **导出与启动**(`export.service.ts`):`ensureShareToken()` 缺 await 导致 shareUrl 为 `[object Promise]`、PDF/图片导出整体不可用——补 await;修 prisma shim 硬编码 build 期 NODE_PATH 导致的服务端启动崩溃(`apps/server/Dockerfile`、`docker-entrypoint.sh`)。

## 2026-07-29 — 合作方类型系统:达人 / 社群 / 内容站

Creator 引入 partnerType 维度,列表、详情、编辑、导入与 seed 全链路支持三类合作方差异化。

- **类型系统**(`apps/server/prisma/schema.prisma`、`modules/campaigns/` controller/service/schema、`packages/shared/src/types/campaign.ts`、`collaboration.ts`):Creator 表加 `partnerType`(达人/社群/内容站),API 支持 partnerType 查询参数;前端合作列表 tab 筛选。
- **差异化展示**(`apps/web/src/routes/CampaignCollabPage.tsx`、`shared/types/collaboration.ts`):信息卡按类型切换标签;社群/内容站流量数据可编辑——内容站用 Monthly Visits + Bounce Rate,社群用 Members + Active Rate;CSV 导入支持 partnerType 列。
- **seed**(`apps/server/prisma/seed-content-community.ts`):4 个内容站 + 4 个社群 + 跨 5 个 campaign 的 16 条 CampaignCreator 关联。
- **编辑优化**(`CampaignCollabPage.tsx`):删除合作方式/状态编辑表单(只读展示),作品图片支持本地上传,每日效果数据与 publishedAt/platform 可编辑。

## 2026-07-29 — BrandTrack 静态 HTML 报告模板与 demo 生成

为对外交付新增一套数据驱动的静态 HTML 报告模板(Kreatornow 风格),配渲染脚本与填充好的 demo 报告。

- **模板与数据契约**(`templates/brandtrack-report.html`、`brandtrack-report.sample.json`、`templates/render.js`):Mustache 占位符 + JSON 数据驱动,模板与数据彻底分离,渲染脚本一条命令出报告。
- **生成器与 demo**(`templates/generate-report.py`、`templates/campaign-report-filled.html`):Python 生成器以 mock 数据渲染模板,产出 Glow Lab Q4 2026 demo 报告(6 campaigns / 13 creators)。
- **campaign-report 模板充实**(`templates/campaign-report.html`):扩展为 7 段式富报告(10 达人、KPI 看板、趋势图、漏斗、平台拆分、CPS 深挖、90d roadmap);同 commit 附带合作抽屉修复(缺 key 致切达人截图不更新、非编辑态截图只读、platform 字段改下拉)。

## 2026-07-28 — Docker 部署(web + api 双镜像)+ GitLab CI + Redis 指定 DB

按 `docs/superpowers/specs/2026-07-24-cicd-dockerfile-design.md` 落地生产部署链路:web(nginx 静态)+ api(server 含 Chromium)两镜像、compose 编排、GitLab CI 构建推送,MySQL/Redis 走外部托管。

- **web 镜像**(`apps/web/Dockerfile`、`apps/web/nginx.conf`):nginx:alpine 托管 Vite dist + SPA fallback,`/api/*`、`/uploads/*` 反代 server:4000。
- **api 镜像**(`apps/server/Dockerfile`、`docker-entrypoint.sh`):node20-slim + 打包 Chromium,保持 `tsx src/index.ts` 运行;entrypoint 先 `prisma migrate deploy` 再启动;build 期按构建报错补装 unzip、拷贝 tsconfig.base.json。
- **编排与 CI**(`docker-compose.prod.yml`、`.env.prod.example`、`.gitlab-ci.yml`、`.dockerignore`):compose 只起 web+server;`.gitignore` 掉 `.env.prod` 防密钥入库;CI 构建并推送 web+server 镜像到 GitLab Container Registry。
- **构建堵点修复**:27 处 `@mediakit/shared` 拼写修正为 `@mediakit/shared`(本地脏 node_modules 掩盖、clean install 即 TS2307);corepack 签名过期改构建前升级 corepack@latest;CI Chromium 下载超时改为 build 期跳过 + runtime 用 apt 系统源安装;移除 runtime 孤儿 HTTPS_PROXY(指向不可达私网 IP 致 migrate 崩)并让 entrypoint 直调 `./node_modules/.bin/` 绕开 npx 网络层。
- **Redis 指定 DB**(`apps/server/src/config.ts`、`redis.ts`):新增 `REDIS_DB` 环境变量(默认 0),多实例共享 Redis 时按库隔离。

## 2026-07-27 — 编辑器两批次改进:19 项快速优化 + 架构级能力

obsidian todo 驱动的两批改进:batch-1 覆盖类型/预设/组件/UI/流程 19 项,batch-2 落地报告方案系统、dm 数据契约、本地字体上传、表格图片列四个架构项;并修复 schema 漂移导致合作列表 500。

- **batch-1 快速改进**(`apps/web/src/editor/`、`packages/shared/`):Page 加 `suppressLogo` + `layoutTemplateId`,ProjectMeta 加 `reportSchemeVersion`;字体预设补 Montserrat/Poppins + Duomai Bento 预设,安全区 24→48px、网格 10→8px,密度加 comfortable、圆角加 medium;Shape 支持图片填充(src/fit),uploadImage 失败 base64 兜底;组件面板改页签 + 跨类别搜索,模板浮层显缩略图,PageProperties 加「替换整页版式」+确认(store `replacePageLayout`);report-* 模板置顶业务页面库,Campaign 改可选绑定(建项目免必填);`packages/shared/src/templates/builtin-pages.ts` 提供真实页面树默认模板。
- **batch-2 架构项**(`apps/server/src/modules/schemes|fonts/`、`apps/web/src/routes/SchemesPage.tsx`、`editor/customFonts.ts` 等):
  - **报告方案系统**:Prisma ReportScheme 模型 + 迁移,服务端 schemes 模块四件套,前端 schemesApi + SchemeFormDialog + `/schemes` 页。
  - **dmMonthly/dmBiweekly 结构化契约**:ReportDataContext 扩字段(heroImage/channelContent/products/adPlacement/featuredCreators/creatorPosts 等),Zod 校验 + `pageBinding.ts` dm 绑定与 `dmPatch()`。
  - **本地字体上传**:服务端 fontParser(TTF/OTF/WOFF/WOFF2/ZIP)+ fontStorage 元数据持久化;前端 useSyncExternalStore + @font-face 动态注入,全局样式浮层可上传/删除/选择。
  - **表格图片列**:`isImageCol()` 检测 + TableCellImageInput(裁切+上传),覆盖 placement-display/post-list 等 5 个组件。
- **schema 漂移修复**(`apps/server/prisma/migrations/20260727000001_collab_creator_cps_sync/migration.sql`):加字段未迁库致 Prisma P2022、合作列表 catch 吞 500 显示为空;用 `prisma migrate diff` 生成 SQL + `migrate deploy` 应用,恢复 35 条 Campaign×Creator 数据。

## 2026-07-24 — creator & collaboration 数据模型扩展 + 批量导入 + CPS 独立表

达人/合作数据模型第二轮扩展:画像与计价字段入库、4+2 个批量导入端点与前端导入 UI,CPS 效果从合作字段拆为独立表。

- **模型扩展**(`apps/server/prisma/schema.prisma`、`modules/campaigns/campaigns.service.ts`、`campaigns.routes.ts`):Creator 加 `profileUrl`/`contact`/`rate`(JSON);CampaignCreator 加 `collabId`/`currency`(默认 USD)/`totalPrice`;新增 4 个批量导入端点 `/campaigns/import/creators|creator-audience|creator-works|collaboration-daily`(upsert + JSON merge,works 按 workId 去重,daily 合并进 CreatorPerformance);Zod 全字段镜像。
- **前端导入 UI**(`apps/web/src/routes/CreatorPage.tsx`、`CampaignCollabPage.tsx`、`editor/components/ImportPreviewModal.tsx`、`editor/dataImport.ts`):CreatorPage 加受众/作品导入按钮 + 模板下拉;合作页加每日数据导入 + 模板下拉;ImportPreviewModal 支持全部 6 种 ImportKind 标签;dataImport 每类独立 CSV 模板与字段定义,合作行带 creatorName/Avatar/Handle/ProfileUrl 供导入时自动 upsert。
- **CPS 独立表**(`schema.prisma`、`campaigns.service.ts`、`dataImport.ts`):新 `CpsPerformance` 模型(clicks/impressions/orders/gmv/commission/spend 结构化列 + daily JSON,campaignCreator+contentType 唯一)+ `/import/cps`、`/import/cps-daily` 端点;合作导入模板同步移除内嵌 CPS 字段;Creator 补 recentPostsCount/engagementMedian,作品补归因字段(attrClicks/Orders/Gmv/Ctr/Cvr)。

## 2026-07-23 — 项目页面导出 PNG(ZIP)

在 PDF 之外新增整项目逐页 PNG 导出。

- **服务端**(`apps/server/src/modules/export/export.service.ts`、`export.controller.ts`):`renderImages()` 用 puppeteer 对每页做 2x retina 截图,archiver 流式打 ZIP;`exportProjectImages()` 复用 owner 校验 + share token;`format=images` 返回 `application/zip` + `X-Image-Count` 头。
- **前端**(`apps/web/src/api/projects.ts`、`editor/components/ExportMenu.tsx`、`routes/SharePage.tsx`):`exportImages(id)` API + 导出菜单「导出图片 (PNG)」(带 loading);分享页 print 模式 div 加 `data-page` 供 puppeteer waitForSelector。

## 2026-07-20 — 合作交付成本口径(执行价/CPE/CPM)+ CSV/XLSX 批量导入 + 详情 UI 升级 + 货币 USD 化

合作交付数据一轮大补:成本三指标建模、批量导入(含 CPS 自动日拆分与每日明细行)、详情抽屉信息架构重排、金额格式化与比例常量集中化并统一切 USD。

- **数据模型**(`packages/shared/src/types/collaboration.ts`、`apps/web/src/api/analytics/creatorPerformance.ts`、`collaborationSeed.ts`):CollaborationDeliverable 加 `execPrice`/`cpe`/`cpm`;TIER_BASE 执行价基线 + `creatorExecPrice()`(tier × 内容系数:video×1.5、live×2.0);seed 按 执行价/互动、执行价/曝光×1000 计算 CPE/CPM。
- **批量导入**(`apps/web/src/editor/dataImport.ts`、`routes/CampaignCollabPage.tsx`、`api/analytics/collaborationSeed.ts`):新 `collaboration` DataKind——CSV/XLSX 按 (campaignId, creatorId) 分组聚合多交付物(metrics `label:value|`、screenshots `url;url`);CPS 总量导入自动按 S 曲线拆日(`buildCpsDaily`,对齐 publishedAt);支持每日明细行两遍解析——汇总+明细时明细覆盖拆分、仅汇总时自动拆分、仅明细时 `cpsDailyToSummary()` 反推汇总;campaign 模板补 metrics/platforms 解析示例 + Excel UTF-8 BOM。
- **详情 UI**(`CampaignCollabPage.tsx`、`components/CollaborationDetail.tsx`、`property-panel/importers.tsx`):抽屉 680→1100px 加宽;每日效果(曝光/点赞/评论/转发/收藏)与 CPS daily(点击/订单/GMV/佣金/CTR/CVR/ROAS/EPC)按日期合并为单表;CPS 10 项 KPI 并入「效果数据」区块且与基础指标卡样式统一;全部 KPI 指标配 tooltip(`METRIC_HINTS` 自动匹配中文标签);成本卡按阈值红黄绿分级,CPM 显示补「/千次」单位;CPS 链接移至卡头作品链接旁。
- **格式化与比例集中化**(`apps/web/src/lib/format.ts`、`lib/ratios.ts`):货币符号、CPE/CPM 阈值与分级、formatExecPrice/formatCPE/formatCPM/formatUSD/formatEPC、tooltip 文案统一收进 format.ts;互动率(赞 56%/评 11%/转 18%/藏 15%)、播放率、CPS 漏斗转化等硬编码比例收进 ratios.ts——替换此前散落在 6 个文件里的魔法数字。
- **货币切换**(`lib/format.ts`、seed):全部成本口径 CNY→USD——CPE 阈值 ¥3/¥8→$0.50/$1.50、CPM ¥30/¥80→$5/$12、执行价基线 45000/12000/3500→6500/1800/500、locale 改 en-US;CNY 常量保留为兼容别名。
- **杂项**(`routes/BusinessLinePage.tsx`):业务线 logo 改 `object-contain` 保比例,不再 32×32 方形裁切。

## 2026-07-18 — 达人库富数据 Phase 1 + 前端数据源 mock→真实 DB(Phase A)

先按 `docs/superpowers/specs/2026-07-16-creator-library-rich-data-design.md` 扩展达人画像与作品字段并打通详情浮窗,随后把前端列表数据源从 mock 切到真实 DB 表。

- **Phase 1 字段扩展**(`packages/shared/src/types/campaign.ts`、`apps/server/src/modules/data/data.schema.ts`、`prisma/schema.prisma`、`apps/web/src/api/mock/creators.ts`、`editor/components/CreatorDetailDrawer.tsx`):Creator 加 bio/tags/contact/rate,CreatorWork 加 contentType/hashtags/productLink/attribution/duration/featured(全可选,向后兼容);服务端 Zod 镜像全字段;Creator 表加 profile/stats JSON 列(MySQL 迁移)并修 `dtoToCreator` 丢 audience/works/stats;确定性 mock 注入新字段;CSV 导入支持 bio/tags(分号分隔);详情浮窗按 简介/标签/报价/联系方式/受众/作品/统计 分区只读展示(+61 行抽屉测试)。
- **作品每日效果展开**(`CreatorDetailDrawer.tsx`、`api/mock/creators.ts`):CreatorWork 加 `daily?: PostDaily[]`,每个作品生成确定性 14 天 S 曲线;作品行点击展开每日效果表(日期/曝光/点赞/评论/转发/收藏),有数据显 ▼/▲ 指示器;验证 781/781 测试通过。旧 DB 记录 works 为空时打开详情用 mock 补全 works/audience/metrics 兜底。
- **Phase A 数据源切换**(`apps/web/src/routes/CreatorPage.tsx`、`CampaignPage.tsx`、`api/campaignsApi.ts`、`api/creators.ts`):列表从 DataRecord mock 切到真实表——`listCreators()`/`listCampaigns()` 走 DB Creator/Campaign;`api/mock/` 语义重命名 `api/analytics/`(保留的是确定性算法而非数据快照),删除零引用的 mock campaigns/products;shared 新增 CpsLinkData/CpsDaily 类型。
- **DB seed**(`apps/server/prisma/seed-creator-extension.ts`、`seed-collaboration-deliverables.ts`):12 个 Creator 的扩展字段(bio/tags/contact/rate/audience/works/stats)与 35 条合作的富 deliverables(截图/指标/受众/词云)写入 DB JSON 列;浏览器实测达人列表 13 条、详情抽屉扩展字段完整展示、无 mock fallback。

**已知限制**:`api/analytics/creators.ts` 标记 @deprecated(仅 server seed 依赖);部分旧记录仍依赖 mock 兜底展示。

## 2026-07-16 — 作品每日效果数据(PostDaily)全链路

为每个合作作品补「按天」效果序列,编辑器与数据管理两端可见;顺带完成编辑器硬编码审计(`#FF5C00` 零残留、无 mock 直引、无品牌名/假数据)。

- **类型与生成**(`packages/shared/src/types/campaign.ts`):新增 `PostDaily`(date/impressions/likes/comments/shares/saves),`PostEffect`/`CreatorWorkPost` 增可选 `daily`;`apps/web/src/api/mock/creatorPerformance.ts` 的 `buildPostDaily()` 确定性生成 14 天 S 曲线。
- **真实链路补齐**(`packages/shared/src/types/collaboration.ts`):`CollaborationDeliverable` 增 `daily?`——初版只加 mock 层导致真实数据流缺失;`apps/web/src/api/creators.ts` 映射透传,`apps/web/src/components/CollaborationDetail.tsx` 渲染每日效果表格。
- **旧数据补全**(`apps/web/src/api/collaborations.ts` + DB 迁移):`getCollaboration` 检测 daily 缺失时用种子同位数据补全;35 条旧合作记录迁移全部补齐。

## 2026-07-16 — 运营数据独立成表(Phase 1-4)

把塞在 `DataRecord` opaque JSON 里的运营数据拆为独立 Prisma 表,四阶段走完后 DataRecord 降级为兼容层(表保留允许回滚)。

- **Phase 1 查找表**(`apps/server/src/modules/lookup/`):Merchant/BusinessLine/Advertiser 三表 + 完整 CRUD + 种子(6/6/6),挂载 `/api/v1/lookup/*`;前端 `apps/web/src/api/lookup.ts`,`CreateProjectDialog` 下拉改 API 取数(失败回退 mock 常量)。
- **Phase 2/3**(`apps/server/src/modules/campaigns/`):Campaign、CampaignCreator 独立成表;CreatorPerformance/Collaboration 1:1 挂 CampaignCreator,新增 `GET/PUT /:campaignId/creators/:creatorId/{performance,collaboration}`;前端 `collaborations.ts` 新表优先、失败回退 DataRecord。
- **Phase 4**(`apps/server/prisma/migrate-datarecords.ts`):幂等 upsert 迁移脚本;`DataRecord.create` 对非 collaboration kind 输出 DEPRECATED 警告。
- **修复**(`apps/web/src/api/creators.ts`):Phase 2 后 `listCampaignCollaborators` 仍读 `campaign.creatorIds` 恒空——改从 CampaignCreator 中间表拉取;ManageCollaboratorsModal 保存改 diff 写中间表。

## 2026-07-16 — 数据管理信息架构重构 + 合作列表页

- **拆 4 路由**(`apps/web/src/routes/DataManagement.tsx` 改布局壳):`CampaignPage`(列表 + CRUD + 合作达人管理)/`CreatorPage`(达人库 + 详情抽屉)/`AdvertiserPage`/`BusinessLinePage`;`App.tsx` `/data/*` 嵌套路由 + lazy。
- **左右布局**:顶栏 Tab 改左侧固定菜单,Campaign 可展开子菜单。
- **合作列表页**(`apps/web/src/routes/CampaignCollabPage.tsx`):Campaign×Creator 关系矩阵,按 Campaign 搜索/状态筛选,展开行可编辑合作方式/内容类型/状态;修复 campaignId 筛选用 ID 匹配名称致 0 结果;Campaign 列表 ID 改数值序号 + 左右列 sticky。

## 2026-07-16 — 合作列表数据呈现迭代与两端一致性

- **呈现**(`CampaignCollabPage.tsx`):达人信息平铺为列 + 效果数据累加 + 作品详情展开;达人头像(`apps/web/src/components/CreatorAvatar.tsx`)+ 作品截图 + 右侧详情浮窗;原 7 列合并为「作品(截图+数据)」+「达人补充」两列,作品列内汇总行(合计粗体)+ 每作品一行(截图缩略 + contentType pill + 单品指标)。
- **指标补全**(`packages/shared/src/types/campaign.ts`):`CreatorWorkPost` 扩展 `screenshots[]/saves/orders/cpm`;`api/mock/collaborationSeed.ts` 同 contentType 聚合去重、多截图(最多 3 张 + 溢出计数)。
- **平台校准**(`collaborationSeed.ts` `PLATFORM_SPECS`):9 平台×作品类型按真实能力校准(Instagram 无 shares、小红书含 saves+orders、微博含转发等),浏览/点赞/评论/转发/收藏/订单/CPM + 互动率 7 大指标全覆盖,合作方式平台化中文名。
- **一致性修复**:`dtoToCreator` 漏映射 avatar/url 致编辑器与数据管理头像/截图/作品链接不一致;达人受众画像字段遗漏;达人数/作品数两端数据源对齐。

## 2026-07-16 — 达人合作记录(collaboration)全链路

- **数据层**:`packages/shared/src/types/collaboration.ts` `CollaborationData` + helpers;server Zod schema + `DataRecordKind` 增 COLLABORATION(migration);web `apps/web/src/api/collaborations.ts` get/save/remove。
- **详情编辑器**(`apps/web/src/components/CollaborationDetail.tsx`):合作方式(派生)+ 每种作品类型的截图/效果/词云编辑器,受众画像 v1 只读(后续补可编辑画像)。
- **种子与兜底**(`api/mock/collaborationSeed.ts`):「导入演示数据」按确定性 id 幂等生成;未知 campaignId 自动生成 mock fallback(不落库);按 campaign platforms + 确定性哈希选 1~3 种 contentType 组合(不再全是单一 post)。
- **修复**:`getCollaboration` 空壳记录检测防数据丢失。

## 2026-07-16 — 我的报告 + AI HTML 样式类型 + Campaign 表单与上传

- **我的报告**(`apps/web/src/components/Layout.tsx` + `routes/Projects.tsx`):styleType 扩展 `'ppt'|'single'|'ai-html'`;列表 4 分类 Tab(全部/PPT多页/单页面/AI HTML)+ 样式列徽标;AI HTML 项目「可视化编辑」新窗口打开 grapes-editor;顶栏「我的项目」菜单 + 当前页高亮。
- **修复**(`apps/server/src/modules/projects/projects.schema.ts`):styleType 枚举缺 `'ai-html'/'single'` 致创建被 Zod reject;AI 类型隐藏画布尺寸选择。
- **Campaign 表单**(`apps/web/src/editor/components/RecordFormModal.tsx`):业务线/广告主改 select(联动)、平台多选 Pill、移除合作达人(改独立操作)与 Campaign ID(服务端自增)。
- **上传**(`apps/web/src/components/ImageInput.tsx`):预览 `max-h-16 object-contain` 不锁比例;业务线/广告主 Logo 改 ImageInput(上传+裁剪+URL);BusinessLine 增 `designMd/designMdUrl`(.md 上传或粘贴);Creator 增 `profileUrl/recentPostsCount/engagementMedian` 三字段。

## 2026-07-16 — 编辑器中性化 + 数据配置瘦身 + 模板清空

- **中性化收尾**(`apps/web/src/editor/defaults.ts` + `kpiTokens.ts`):图表占位数值全归零;black/white 写死色改 `var(--color-neutral-text/bg)`(零 hex);散落品牌名(GlowLab/Mia Chen 等)中性化,测试加「不应残留 hex」回归断言。
- **数据配置浮层**(`editor/components/DataConfigOverlay.tsx` 948→259 行):移除 Campaign 手动下拉/KPI 编辑表格/手动增删达人,改纯显隐勾选 + 只读作品预览 + 全显/全隐快捷键;数据全取 DB(781/781 测试)。
- **模板清空**(`apps/web/src/editor/templates.ts`):模板只定义组件类型/位置/尺寸/样式,标题表格中文化、占位数据清空,业务数据运行时由 `applyPageBinding()` 填充。
- **布局与配色**:Projects/Templates 改全屏左右布局(左 208px sidebar);`index.css` 增 `--color-success/danger/warning/info` + `.skin-dot/skin-text/skin-bg` 语义类,报告组件消除 Tailwind 硬编码色。

## 2026-07-15 — 性能与架构:bundle 拆分、store 拆分、保存竞态

- **bundle**(`apps/web/vite.config.ts`):manualChunks(react/chart/state-vendor)+ 路由级 lazy,entry 1.5MB→57KB(gzip 22KB);函数式细拆 PageView 667→478KB;xlsx 动态 import 后 PageView chunk 518KB→190KB(-63%)。
- **store 拆分**(`editor/store-types.ts` + `store-helpers.ts`):store.ts 1279→989 行,re-export 保持兼容。
- **保存竞态**(`editor/useAutosave.ts` + store):dirty 标志不可靠,改 `dirtyTick` 递增计数器。
- **画布**(`editor/components/CanvasComponent.tsx`):React.memo + 自定义比较器,拖拽跳过无关组件重渲染。
- **稳定性**:修复 27 处 `@mediakit`→`@mediakit` 拼写(本地脏 node_modules 掩盖)、`loadProject` HMR 重挂载覆盖编辑、标题块字号缺省回显全局值(而非 0)、22 个测试失败修复、删除 2514 行死代码 PropertyPanel。

## 2026-07-15 — 报告组件 ← 达人合作绑定 + 达人数据补全

- **达人数据补全**(`packages/shared/src/types/campaign.ts`):Creator 增 `audience/works/stats`(抽 `CreatorAudience`);server `data.schema.ts` 镜像声明(否则 Zod strip 静默丢字段不落库);`api/mock/creators.ts` 确定性种子。
- **DeliverablePicker**(`editor/property-panel/DeliverablePicker.tsx`):从合作记录选达人 + contentType。
- **导入器**(`editor/property-panel/importers.tsx`):ReportWorkScreenshot(按 deliverable)/WorkMetrics/CommentWordcloud/WorkAudience 四个一键导入器;works-list/table 导入对齐行 + 洞察(`buildWorksTable`)。
- **自动回显**(`DataConfigOverlay.tsx`):`reportData.campaign` 为空但项目已绑 `campaignId` 时自动选中并全选合作达人;浮层展示合作作品及效果数据。

## 2026-07-15 — 达人详情抽屉 + Campaign 达人浮窗

- **CreatorDetailDrawer**(`editor/components/CreatorDetailDrawer.tsx`):右侧滑出,profile + 频道 KPI;CSV 导入缺 metrics 兜底;KPI key 加 index 防标签碰撞。
- **列表接线**:`CreatorAvatar`(img/initials 兜底)+ `DataTable` 增 `onRowClick`;达人库列表头像 + 点行开抽屉(编辑/删除按钮 stopPropagation)。
- **Campaign「查看达人」**(`routes/DataManagement.tsx` + `tailwind.config.ts`):行内手风琴改右锚定满高浮窗(Esc/✕/遮罩关闭),新增 slideInRight/fadeIn 动画基建;ManageCollaboratorsModal z-index 提层叠于浮窗之上。

## 2026-07-15 — Campaign 分析生成器(趋势/新老客/洞察)

- **类型**(`packages/shared/src/types/campaign.ts`):`CampaignAnalytics`(trend/weeklyTrend/customerSplit 新老客/insights);server `data.schema.ts` 显式镜像 analytics 子 schema(`.optional()` 兼容旧记录 round-trip)。
- **生成器**(`apps/web/src/api/mock/campaignAnalytics.ts`):趋势/周聚合/洞察引擎,确定性生成。
- **接线**(`apps/web/src/api/campaigns.ts`):`reportCampaignFrom` 让 ReportCampaign 附带 analytics;analytics 趋势 ROAS 口径归一到 campaign 合并指标;补 mock 同步 getter(getCreatorPerformances/getPlacementTypeSummaries)。

## 2026-07-15 — 组件细节:KPI 图标/数值颜色、标题块下划线、作品截图组合版式

- **kpi-board 图标**(`editor/kpiIcons.ts`):`defaultIconFor` 按指标名关键词匹配默认图标;card 变体 `showIcons` 开关(缺省 true);属性面板全局「显示图标」+ 逐行有效图标预览。
- **KPI 数值颜色**(`editor/kpiTokens.ts`):限定黑/白/品牌色三项;旧 5 token 保留渲染历史数据避免崩溃;色块未选中态加淡边框。
- **标题块色块下划线**(`editor/components/BasicComponents.tsx`):宽 30%、圆角 6px、绝对定位贴字形底部与标题重叠;`underlineColor`(brand/black)持久化 + 属性面板下拉。
- **作品截图组合版式**(`editor/components/WorksComponents.tsx`):`mosaicLayout` 命名组合(1大2小/1大3小/1大4小/错落/九宫格/2大4小/阶梯),picker 按当前张数禁用不满足项,多图忽略不留空位。

## 2026-07-15 — 页面模板:场景过滤、media-kit 专属、业务线变体、页面存为模板

- **场景过滤**(`apps/web/src/editor/templates.ts` + TemplateOverlay):「+ 页面」模板按项目 scenario 过滤。
- **media-kit**(`packages/shared/src/types/page.ts`):3 个 PageType(audience-portrait/account-overview/brand-collab)shared/web/server 类型贯通 + 3 个专属模版。
- **业务线变体**(`templates.ts` `createBusinessLineTemplates`):27 个页面类型 × 6 业务线各一份;`resolveTemplateForBusinessLine` 让浮层与 setPageType 两条路径一致解析(+52 模板测试,全量 626 绿)。
- **页面存为模板**(`apps/server/src/modules/templates/templates.service.ts` `createFromProjectPage`):`POST /templates/from-project-page`(ADMIN),剥离数据绑定保留布局样式存 DRAFT;`SaveAsTemplateOverlay` 弹窗 + PageSidebar 每页 💾 按钮。
- **页面行为**:新建页面自动应用全局背景色;`copyPage` 补齐此前丢失的 bgColor/bgGradient/bgImage/campaignId/creatorId。

## 2026-07-14 — 全局样式体系:配色 token 统一 + 弹窗改造

- **配色统一**(`apps/web/src/editor/` 全量):图表数据色改 `'auto'` 经 `useChartColors()` 按索引取色;business/kinds ~80 处 inline 品牌色改 CSS 变量;kpiTokens 5 色语义 token 化;defaults 114 处图表色改 `'auto'`;`#FF5C00` 清零。
- **皮肤抽象层**(`.skin-*` 语义类):卡片圆角/阴影 token 化;同期落地场景化数据绑定(creator/campaign/project 三层绑定)与商品 CPS 引擎(`api/mock/products.ts` 从 Campaign 推导 GMV/佣金/ROAS)。
- **skinPreset 移除**(`packages/shared/src/theme/`):`normalizeTheme` 迁移到 radius/shadow,tech-minimal/vibrant-trendy 用 shadow 表达;store/themeToCssVars/server Zod 全链清理字段。
- **弹窗改造**(`editor/components/ReportSettingsOverlay.tsx`):左导航分类 + max-w-4xl + 业务线 Logo 配置区;移除皮肤质感 UI;色板从 STYLE_PRESETS 动态提取。

## 2026-07-14 — 数据管理 v1(DataRecord)+ Campaign↔达人下钻

- **server data 模块**(`apps/server/src/modules/data/`):`DataRecord` 表(kind + ownerId + data Json)+ Zod + CRUD + `importMany` upsert(中途 DB 错误 skip+continue);挂载 `/api/v1/data`。
- **web 页面**(`apps/web/src/routes/DataManagement.tsx` 替换 MockData,导航「Mock 数据」→「数据管理」):Campaign/达人库两 Tab,工具栏 CSV/XLSX/JSON 导入 + 模板下载 + 手动新增 + 空库种子 + 清空;抽取 `DataTable`/`ImportPreviewModal`/`RecordFormModal` 复用;编辑保留非表单字段(platforms/metrics);Tab 切换 key 重挂载。
- **数据源切换**(`apps/web/src/api/dataLibrary.ts`):`listCampaigns/listCreators` 改打 data API,消费方签名不变。
- **下钻**:`campaignRecordDataSchema` 增 creatorIds(CSV split/JSON 透传);`CreatorMultiSelect` 协作达人选择器;Campaign 行展开 + 合作达人子表 + 管理合作达人弹窗 + 种子派生 creatorIds;前置为 MockData 预览达人行展开(Posts/Placements/CPS)。

## 2026-07-13 — 模板分类 + 业务线默认模板(Phase 1)

- **schema**(`packages/shared/src/types/template.ts`):templateType + TemplateMeta/isDefault 贯通 project/template meta;`apps/web/src/projectsMeta.ts` `TEMPLATE_TYPES` 字典(campaign-report 周/月/总结、proposal 简/标/全、media-kit 品牌/达人/平台版)。
- **server**(`apps/server/src/modules/templates/templates.service.ts`):setDefault 端点(同格并发限一)+ list 按 templateType/isDefault 精确匹配过滤;新建项目按业务线×场景×模板类型格子种子默认模板(from-template 项目剥 isDefault)。
- **web**:Templates 列表类型过滤 + 默认徽标 + 设默认(清同级徽标级联);`CreateProjectDialog` 业务线必填 + templateType 级联(campaign-report 的报告类型即 templateType 双写);`CreateFromTemplateDialog` 过滤 + 默认徽标;ProjectShell 种子提示 banner;campaign 下拉按业务线过滤(选 campaign 回填业务线)。
- **修复**:过滤变化取消过期请求防竞态;列表 AND 组合过滤修正。

## 2026-07-12 — 报告组件大批次 + SWOT + 变体扩充

- **11 个 Campaign 报告组件**(`apps/web/src/editor/components/report/`):campaign-summary / funnel-chart / revenue-timeline / publisher-table / geo-distribution / placement-wide-table / placement-type-summary / device-breakdown / content-topic-performance / search-term-table / hourly-heatmap,全部 CSS 变量取色 + CampaignReportImporter 一键填充(503/503 web + 86/86 server)。
- **新组件与变体**:SWOT 矩阵(3 变体,challenge 模板升级接入);bar-chart horizontal/stacked 变体;creator-stats gradient 变体;content-card 基础卡。
- **联动**:性别占比/年龄段组件从页面绑定达人 audience 一键填充;PageType 扩展 company-intro/strategy 覆盖全部模板。

## 2026-07-10 — 全局样式 v2 + 编辑器约束 + 基础/域组件批次

- **全局样式 v2**(`packages/shared/src/theme/`):ProjectTheme 增 layout(safeMargin/gridSize)、lineHeight、format、chart、shadow;`themeToCssVars` 暴露对应 CSS 变量;默认币种 $ 走 `formatMoney`;品牌配置(Logo/标题/副标题)+ 默认页面背景(纯色/渐变/图片/一键应用全部页面)。
- **布局吸附与安全区**(`apps/web/src/editor/snap.ts`):snapMove 磁吸 + `clampRect/clampResize` 硬夹紧,move/resize/nudge/align/distribute/add/duplicate/paste 全接线;Shift+方向键步长跟 gridSize。
- **页面类型与默认标题**(`store.ts`):pageType/titleComponentId/titleOverridden 持久化 + 标题生命周期(手改后停止自动跟随、可恢复自动标题);`formatCampaignDate/buildReportTitle` 纯函数;封面模板透传标题组件。
- **策略块富文本**(`apps/web/src/editor/richText.ts`):`sanitizeRichText` 放行 `<mark>`,高亮改工具栏内联,移除全局高亮词字段;卡片列表多卡网格。
- **组件批次**:shape(矩形/圆角/圆/线)、meta-strip 5 变体(divider/list/cards/stat)、image-group 8 数量版式、作品截图/作品数据/评论词云三件套(含从达人数据导入)、联盟营销域组件(地图/仪表/宽表/图例 + affiliate mock)、DataConfigOverlay 数据配置面板;页面渐变背景编辑器 + `resolvePageBackground` 统一渲染。
- **架构拆分**:PropertyPanel 2371 行拆 9 模块、`business/render.tsx` 949→243 行分发器、mock 移 `api/mock/`、shared 模块化(472/472 绿)。

**已知限制**:数据源导入 v1 不含性能明细(走 demo 生成器);绑定仍为快照进 `projectMeta.reportData`,库的后续改动不回写已存报告。

## 2026-07-06 — SVG 图标库 + 指标卡变体级图标接入

底层补一套「多套风格（weight）× 用途分类」的 SVG 图标能力，并以「变体门控」的通用机制让组件在特定样式变体下渲染可选图标。首批落地指标卡。

- **底层图标库**（`apps/web/src/editor/icons/`，依赖 `@phosphor-icons/react`）：
  - `catalog.ts` —— 精选目录（~31 图标 × 4 用途分类 metric/creator/report/generic），每项持稳定 `key` + label + category + 直接 import 的 Phosphor 组件（保留 tree-shaking）；导出 `ICONS` / `ICON_CATEGORIES` / `ICON_WEIGHTS` / `findIcon`。稳定 `key` 解耦于 Phosphor 组件名，便于换库不迁数据。
  - `IconKit.tsx` —— 唯一渲染入口 `<IconKit name weight size color />`，未知 key 返回 null（不抛）。
  - `IconPickerOverlay.tsx` —— 选择器模态：按当前 weight 预览 + 分类分组 + 搜索 + 选中/清除；导出 `ICON_WEIGHT_OPTIONS` 供 weight 下拉复用。
- **通用变体门控机制**：`registry.tsx` 的 `VariantOption` 加可选 `icon?: { position?; defaultKey?; defaultWeight? }`——存在即启用（渲染层在该变体位渲染图标，属性面板显示 icon 字段），缺省即不涉及。`PropertyFieldKind` 加 `'icon'`；`PropertyPanel` 仅在激活变体声明 icon 时动态注入 icon 字段（不放进各组件 `propertySchema`，保持通用）。任何组件声明带 icon 的变体即免费获得图标能力。
- **指标卡 4 变体**（`IndicatorCardComponent` 改 1→4 分发器）：`plain`（旧外观，完全向后兼容，老数据无 variant 字段按旧渲染）/ `icon-left`（图标左）/ `icon-top`（图标上）/ `icon-bg`（大尺寸 12% 透明水印）。`colorTheme` 统一驱动卡片底色与图标色调，无需逐图标配色。图标 key/weight 优先取 `data.icon`/`data.iconWeight`，缺省回退变体默认。
- **shared 类型（type-only，最小侵入）**：`IconWeight`（6 weight）；`IndicatorCardVariant`；`IndicatorCardData` 加可选 `variant?/icon?/iconWeight?`。Phosphor 不进入 shared。
- **测试**（+19）：`icons.catalog.test`（4）/ `icons.kit.test`（3）/ `icons.picker.test`（4）/ `components.test` 指标卡变体（5）/ `registry.test` 变体声明（3）/ `property-panel.test` 变体门控（3）。门禁 typecheck + test（223）+ build 全绿。

**范围外（后续）**：其它数值类组件（kpi-board / creator-stats 等）的图标变体接入；逐图标自定义颜色；服务端/SSR 图标渲染。

## 2026-07-03 — 达人头像卡：链接解析（迭代 1）

`creator-avatar-card` 支持粘贴达人链接自动解析填充字段（前端 mock）。

- **链接解析模块**（`editor/creatorLink.ts`）：`detectPlatform` 识别 TikTok / Instagram / YouTube / 微博（host 匹配，容忍 www./m./无协议/大小写，不支持返回 null，含小红书）；`parseCreatorLink` 用 FNV-1a 确定性哈希派生稳定的 mock 字段（handle / 粉丝 / 获赞 / 互动率 / 头像 / 简介 / sourceUrl），400ms 模拟延迟，相同链接结果一致。
- **数据结构**：`CreatorAvatarCardData` 增加可选 `sourceUrl / handle / followers / likes / engagement`（向后兼容）。
- **卡片渲染**：horizontal / vertical 变体简介下方加 KPI 行（粉丝/获赞/互动，缺哪省哪）；compact 不变；无字段不渲染。
- **属性面板**：新增「达人链接解析」区块（`CreatorLinkImporter`），解析后写入字段并保留 variant/tier；空输入/不支持平台给出错误提示。`propertySchema` 增 handle/粉丝/获赞/互动 四个 text 字段供微调。
- **测试**：`editor.creator-link.test.ts`（detectPlatform + parseCreatorLink 确定性，7）；`editor.creator-link-importer.test.tsx`（面板交互 3）；`editor.creator.test.tsx` 增 KPI 渲染断言。门禁 typecheck + test（198）全绿。

**已知限制**：本期为前端 mock，未接入真实达人库/抓取；小红书链接暂不支持（设计取舍）。

## 2026-07-02 — M6：预览 + 导出 + 分享 ✅

mediakit 全新重写最后一期：全屏只读预览、PDF 导出、公开分享链接，接通 M1 顶栏预览/导出桩。至此 M0→M6 七期全部完成。

- **全屏只读预览**（`editor/preview/PreviewOverlay.tsx`）：顶栏「预览」打开全屏 overlay；←/→ 翻页 + ArrowLeft/Right 键 + Esc 关闭；页码显示；复用 `PageView` 真实渲染。预览状态用 `set()` 不入 history，`useEditorKeyboard` 在 previewOpen 时让位键盘。
- **`PageView`**（`editor/preview/PageView.tsx`）：预览/分享/PDF 共用的纯渲染组件，复用 `REGISTRY` + `ComponentRenderer`，独立精简定位壳（无手柄/hover/选中，不污染 `CanvasComponent`）；transform scale 整体缩放 + `fitScale` 工具。
- **公开分享链接**：Project 加 `shareToken` 字段（迁移 `20260702000000_share_token`）；无认证路由 `GET /share/:token`（挂载模式仿 `/health`）；owner `POST/DELETE /projects/:id/share` 生成/撤销；前端 `/share/:token` 路由（`ProtectedLayout` 外，匿名可访问）+ ExportMenu「复制分享链接」。
- **PDF 导出**（`server/modules/export/`）：`POST /projects/:id/export?format=pdf` 走 puppeteer 访问 `/share/:token?print=1` 让浏览器渲染后 print-to-PDF（复用前端渲染，避免 React+recharts SSR）；分享页 `?print=1` 模式连续渲染所有页（page-break）。
- **测试**：server `share.test.ts`（4：公开读 / 404 不泄露 / owner 隔离 / 需认证）；web `editor.preview.test.tsx`（6：enter/exit/prev/next/clamp + 不污染 history）。门禁 typecheck + test（160）+ build 全绿。

**已知限制**：数据源未持久化（M5 取舍）→ 分享页/PDF 中数据源绑定图表回落默认数据；puppeteer Chromium 需在生产容器装系统库（后续可换 sidecar）。

## 2026-07-02 — M5：数据源 ✅

CSV/Excel 上传 → 解析 → 组件按列绑定，真实驱动图表/表格。

### 新增（apps/web）

- **shared 类型**：`ComponentBinding`、`EditorComponent.binding?`、`Datasource`。
- **解析**（`datasource/parse.ts`）：自写 CSV 解析（支持引号/转义/CRLF）+ Excel 解析（xlsx/SheetJS，取首 sheet）；`parseFile` 按扩展名分发。
- **store 数据源**：`datasources[]` + `addDatasource`/`removeDatasource`/`bindComponent`（会话级，未持久化到后端）。
- **绑定解析**（`datasource/resolve.ts`）：bar/line/pie 按 label/value 列派生，table 整表渲染；数字列自动去千分位、非数字归 0。
- **工具栏数据源下拉**（`DatasourceMenu`）：列出数据源 + 上传入口 + 删除。
- **属性面板绑定编辑器**：bar/line/pie/table 选中时选数据源 + label/value 列，可断开。
- `ComponentRenderer` 接入 resolve（绑定后按数据源渲染）。

### 取舍

- 数据源为**会话级**（未落库）——后端 Project 模型无数据源字段；持久化留后续。

### 测试 / 门禁

- 新增 16 个 web 测试：CSV 解析 + store 6、绑定解析 6、数据源下拉/绑定 UI 4（web 累计 115）。
- `pnpm typecheck` + `pnpm test`（server 35 / web 115 = 150）+ `pnpm build` 全绿。

## 2026-07-02 — M4：业务组件 ✅

20 类业务组件 × 多变体，原生 React 像素级忠实 demo。

### 新增（apps/web）

- **catalog**（`business/catalog.ts`）：`BUSINESS_GROUPS`（5 组 20 项）/ `BUSINESS_BY_ID` / `BUSINESS_LAYOUTS`（w/h/form）/ `BUSINESS_STYLE_OPTIONS` + `getStyleOptions`，完整 port demo。
- **渲染器**（`business/render.tsx` + `shared.tsx`）：`Base`/`Label`/`Title`/`Chips` 共享件；通用 `cards`/`light`/`accent` 兜底；**20 类 standard** + **6 个专用变体**（cover/light、process·campaign-plan/cards、case-showcase/results、campaign-overview/stats、creator-profile/stats、package/table）；分发优先级忠实 demo。用 inline style 保留精确 px。
- **store `addBusinessBlock(kind)`**：按 LAYOUTS 尺寸居中，data 用 catalog 默认。
- **业务组件库**（`BusinessLibrary`）：分组浮层，点击建块；工具栏接入。
- **属性面板**：business-block 的变体选择器（按 kind 动态选项）+ details 条目编辑器。
- **registry** 接入 `BusinessBlockRenderer`。

### 取舍

- 画布上按文字节点 contentEditable 的内联编辑（demo 的 DOM 命中法）在 React 下复杂且脆弱，**延后**；属性面板已覆盖全部字段编辑（title/meta/details/variant）。

### 测试 / 门禁

- 新增 18 个 web 测试：catalog 8、渲染器 8（每类 + 每变体不抛错）、库面板 2（web 累计 99）。
- `pnpm typecheck` + `pnpm test`（server 35 / web 99 = 134）+ `pnpm build` 全绿。

## 2026-07-02 — M3：页面管理 ✅

### 新增（apps/web）

- **页面缩略图**（`PageThumbnail`）：按 `min(w/cw, h/ch)` 缩放，每个组件渲染为按类型着色的色块（indicator-card/text/bar-chart/table 各一色，忠实 demo）；空白页显示「空白页」。
- **模板浮层**（`TemplateOverlay` + `templates.ts`）：「新建页面」打开浮层，含 空白页 / 标题页 / 数据概览 / 表格页 4 个由基础组件拼成的模板；apply 时组件重新分配 id。（demo 完整业务模板依赖业务组件，留 M4。）
- **复制页面**（store `copyPage`）：克隆页面（新页面 id + 新组件 id），插入原页之后，不切换当前页。
- **store `addPageWithComponents`**：模板带入组件时重新分配 id。
- **页面栏升级**：缩略图卡片 + 📋 复制 + 拖拽排序（HTML5 DnD → `reorderPage`）+ 双击改名 + 删除。

### 测试 / 门禁

- 新增 9 个 web 测试：copyPage/addPageWithComponents 4、缩略图 + 模板浮层 5（web 累计 81）。
- `pnpm typecheck` + `pnpm test`（server 35 / web 81 = 116）+ `pnpm build` 全绿。

## 2026-07-02 — M2：交互补全 ✅

编辑器交互对齐 demo G1。

### 新增（apps/web）

- **框选**：画布空白拖拽出矩形 → mouseup 选中完全落入的组件（Shift 追加）；纯点击仍取消选中。
- **右键菜单**（`ContextMenu`）：复制/剪切/删除 · 上移/下移/置顶/置底 · 锁定/解锁；外部点击/Esc 关闭。
- **组件悬浮操作**：hover 显示 📋 复制（复制选中）/ ✕ 删除快键。
- **多选对齐面板**（>1 选中时替换单选面板）：左/中/右/顶/中/底对齐、水平/垂直分布、等宽/等高、删除选中。
- **store 对齐/分布/等宽等高**：`alignComponents`（按 bbox）、`distributeH/V`（首尾不动均分间距）、`equalWidth/Height`（取均值）。
- **键盘补全**：`Ctrl+A` 全选、`Ctrl+X` 剪切（原有 Ctrl+Z/Y/D/C/V、Del、方向键、Esc、空格 pan 不变）。

### 测试 / 门禁

- 新增 13 个 web 测试：对齐/分布/等宽等高 10、多选面板 + 右键菜单 3（web 累计 72）。
- `pnpm typecheck` + `pnpm test`（server 35 / web 72 = 107）+ `pnpm build` 全绿。

## 2026-07-02 — M1：编辑器内核 + 7 基础组件 ✅

MediaKit 编辑器落地：进入项目即用 1280×720 画布搭报告，行为忠实 `demo.html` 内核。

### 新增（apps/web）

- **画布内核**（`editor/Canvas.tsx`）：1280×720 画布、20px 网格、`Ctrl/Cmd+滚轮`缩放（钳制 0.1–2.0，步长 `deltaY*0.001`）、`空格+拖动`平移、首次挂载 fit 到视口；组件拖动移动（10px 网格吸附）、8 向缩放手柄（`w≥40 / h≥20`，西/北边固定对边）、点空白取消选中。
- **REGISTRY**（`editor/registry.tsx`）：`BlockDef { Component, defaultSize, defaultData, propertySchema }`，按 `type` 分发。
- **7 基础组件**（原生 React+Tailwind，`editor/components/`）：text / image / indicator-card / bar·line·pie via recharts / table；business-block 留 M4 占位。默认数据/尺寸忠实 demo。
- **属性面板**（`editor/PropertyPanel.tsx`）：schema 驱动，含 number/text/textarea/color/select + list（柱/饼数据）+ table 编辑器；几何 x/y/w/h。
- **editor store**（`editor/store.ts`，Zustand）：pages/选中/history（{pages,currentPageId} 快照，限 50，zoom/尺寸/选中不入 history，忠实 demo）、增删改/拖动/缩放/复制剪切粘贴/图层/锁定/页面/undo-redo。
- **页面栏 / 工具栏 / 顶栏**：页面切换+增删改名；工具栏添加 7 类组件；顶栏项目名（可编辑）+ 撤销/重做（按状态启用）+ 预览/导出桩（M6 接通）。
- **自动保存**：`pages`/尺寸/名称变更 debounce 1.5s → `PATCH /projects/:id`。
- **键盘快捷键**：`Ctrl+Z/Y` 撤销重做、`Ctrl+D` 复制、`Ctrl+C/V` 复制粘贴、`Del` 删除、方向键 1px（Shift 10px）、`Esc` 取消、`空格`平移；输入框聚焦时跳过。
- `ProjectShell` 挂载 `<Editor>`。

### 测试 / 门禁

- 新增 28 个 web 测试：store 纯逻辑 31、registry 4、组件渲染 7、autosave 1（M1 共 43；web 累计 59）。
- `pnpm typecheck` + `pnpm test`（server 35 / web 59 = 94）+ `pnpm build` 全绿。
- 备注：recharts 使 web bundle ≈660kB（gzip 195kB）；code-split 为后续非目标（见设计文档 §8）。

## 2026-07-02 — M0：地基 & 应用外壳 ✅

完整对等 `demo.html` 重写的第 0 期：monorepo 地基 + 全栈应用外壳（认证 / 项目 CRUD / 持久化）。编辑器内核留待 M1。

### 新增

- **monorepo**：pnpm workspaces（`apps/web` · `apps/server` · `packages/shared` type-only），根 `tsconfig.base.json`，Node 20 `.nvmrc`，参数化 `docker-compose.yml`（mysql:8 + redis:7）。
- **apps/server**（Express + Prisma + Redis + jose）：
  - app 外壳：helmet · cors(credentials) · json · cookie-parser · pino-http · `/api/v1` 路由 · error/notFound 中间件 · `/healthz` 探活。
  - **auth**：login / refresh（**轮换**：作废旧 jti + 写黑名单）/ logout（拉黑）/ me；refresh 走 SameSite=Strict httpOnly cookie，access token 放响应体（前端内存）。
  - **admin users** CRUD + ADMIN 角色守卫（不可删最后一个 admin）。
  - **projects** CRUD + 所有权隔离（非 owner 一律 404，不泄露存在性）+ duplicate。
  - Prisma schema（User/Role/Project，`pages` 不透明 JSON）+ 迁移 + seed（admin@mediakit.local / admin123）。
- **apps/web**（Vite + React 18 + TS + Tailwind）：
  - demo `:root` 设计 token 移植为 CSS 变量 + Tailwind `theme.extend` 引用（主色 `#FF5C00`），`@` 路径别名，`/api` 开发代理。
  - 路由：`/login` · `/projects`（列表/新建/改名/删除）· `/projects/:id`（编辑器外壳占位，M1 升级）；受保护路由 + 会话恢复。
  - axios 单例：access token 内存持有，refresh 走 cookie，401 → 单飞刷新 → 重试，refresh 失败 → 登出。
  - Zustand auth store；组件 Button/Input/Layout/ConfirmDialog。
- **packages/shared**：User / Role / ProjectSummary / ProjectDetail / Page / EditorComponent / 各组件 Data / BusinessBlockData / BusinessVariant / ComponentType。

### 测试 / 门禁

- server：35 个（health / auth 全路径含轮换+黑名单 / admin users / projects 含所有权隔离 / db / hash），vitest + supertest，singleFork 串行。
- web：16 个（auth store / axios 401 刷新重试 + 去重 / Projects 页 CRUD / 受保护路由），vitest + @testing-library。
- `pnpm typecheck` + `pnpm test` + `pnpm build` 全绿；端到端冒烟（seed → login → /me → 建项目 → refresh 轮换）通过。

### 备注

- mediakit 数据库默认宿主端口 mysql:**3317** / redis:**6389**（避开本地与 ppt-generator 项目的 3316/6390 占用）。
