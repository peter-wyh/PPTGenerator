<!-- archive: GuideRevision v19 id=cmu5fzgav00gzjsmdmadqexox archived before 0924 five-card rewrite -->
# FT Monthly Performance Report（品牌商家月度绩效报告）结构指南

> **本指南完全接管视觉**（overridesVisual=true，FT 官网白色规范不注入）。目标：1:1 还原 `Example/FT.html`（FANSTOSHOP Performance Report 官方模板，Fanstoshop 设计系统）的版式与视觉：暖白页面 + 白色圆角大卡片，深梅紫 hero/KPI 区 + 青柠强调 + Libre Baskerville 衬线标题 + Inter 正文。你输出的每个 HTML 必须逐字采用下方 CSS 类名与设计变量——不发明新类名、不改配色、不引入规定之外的库。

## 0. 硬约束（逐条遵守，违反任何一条即为废稿）

1. **单文件 HTML**：`<!DOCTYPE html>` + `<head>` Google Fonts（Libre Baskerville + Inter + Poppins，链接见下）+ `<style>` 全部 CSS + `<body>`。禁 Tailwind CDN、禁 Font Awesome——只用原生 CSS + Chart.js 4（唯一图表库）。
   字体链接（逐字）：`https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;500;600;700&family=Poppins:wght@500;600;700&display=swap`
2. **形态铁律：单页长报告，不是 deck**。整个报告 = `.page` 一张纵向卡片（max-width 1120px、居中、白底、圆角 20px），无 slide、无翻页、无 nav。hero 与 KPI 在顶部，七个编号 `.section` 依次向下，`.footer` 收尾。
3. **字体角色**：标题/h1/h2/章节名 = **Libre Baskerville 400**（衬线，40px/24px/17px）；正文/数字/标签 = **Inter**（400/500/600/700）；达人 handle/头像字母 = **Poppins 700**。FANSTOSHOP 一律全大写。
4. **数据铁律（宁缺勿假）**：任何数字必须来自 CAMPAIGN_DATA JSON。缺数据 → 该行写「—」或区块省略，禁止编造。竞对数据必须有真实来源标注（Data source 脚注），无来源 → 整个 04 章省略。日明细缺 → 03 章省略（不渲染空图）。
5. **组件完整铁律（输出前自查）**：必含 `.hero`、`.kpi-row`（内含 4 个 `.glass-kpi`）、`.section × 5`（各带 `.badge` 编号圆）、`.creator-card × 2`（其一 `.creator-card.top`）、`.chart-card`（含 Chart.js 双轴图，若 03 章有数据）、`.compare-table`（若 04 章有数据）、`.pkg-grid`（3 张 `.pkg-card`：白/`.lime` 推荐/`.violet`）、`.pkg-ai-note`、`.footer`（汇总句）。缺任一 = 废稿（数据缺失整章省略除外）。
6. **术语**：FANSTOSHOP 全大写；资源位术语保留英文（Seasonal Spotlight / Brand Banner / Essentials / Rotation Banner / Stylist / Influencer Hub / Hot Brand Search / Discover Banner / Newsletter）；货币遵循数据源（$=USD）。

## 1. 视觉规范（v5 资产化——CSS 资产接管，本文不含任何色值）

视觉层已由服务端 CSS 资产 `ft-recap/base.css`（提取自 `Example/FT.html` 真源，sha256 见 revision.assets）接管：

- `<head>` 内输出占位符 `<!--GUIDE_CSS-->`（独占一行），服务端生成后注入权威样式表
- **禁止**自写任何 `<style>` 块；**禁止**硬编码任何色值/字体名/Google Fonts 链接
- **禁止**自创 base.css 未定义的结构类（类名一律照抄骨架片段）；只使用下述资产定义的类名
- 字体（Libre Baskerville/Inter/Poppins）与 Chart.js CDN 引用方式见第 0/4 节，色值一律不写

## 2. 组件类名用法(样式细节全在资产里,此处只讲结构与语义)\\
\\
> **骨架铁律:下方三个 HTML 片段中的类名与嵌套关系必须逐字照抄。改类名、丢层级、用裸 div 包裹 = 废稿。**\\
\\
**Hero 首屏(全报告恰好 1 组)**:\\
\\
```html\\
<div class="hero">\\
  <div class="hero-left">\\
    <h1>{campaign title}</h1>\\
    <span class="x">× FANSTOSHOP Monthly Performance Report</span>\\
  </div>\\
  <div class="hero-right">\\
    <div class="eyebrow">Monthly Performance</div>\\
    <div class="period-pill"><span>{start} – {end}</span><span>REPORT PERIOD</span></div>\\
  </div>\\
</div>\\
```\\
\\
**KPI 行(紧跟 hero,恰好 4 张卡)**:\\
\\
```html\\
<div class="kpi-row">\\
  <div class="glass-kpi"><span class="num">{clicks}</span><span class="lbl">TOTAL CLICKS</span></div>\\
  <div class="glass-kpi"><span class="num">{orders}</span><span class="lbl">TOTAL ORDERS</span></div>\\
  <div class="glass-kpi accent"><span class="num">${gmv}</span><span class="lbl">TOTAL REVENUE</span></div>\\
  <div class="glass-kpi accent"><span class="num">{cpa}%</span><span class="lbl">CPA COMMISSION BASIS</span></div>\\
</div>\\
```\\
\\
**章节头(01–05 每章 1 组)**:\\
\\
```html\\
<div class="section-head"><div class="badge">01</div><h2>Exposure Placement</h2></div>\\
<p class="section-sub">…一句话导语…</p>\\
```\\
\\
其余组件只列类名语义(结构简单,按语义嵌套即可):\\
\\
- `.page` —— 单页容器(max-width 1120px、白底、圆角),整份报告仅 1 个,所有内容都在其中\\
- `.section` —— 章节卡(01–05 每章一张);`.section-head` = `.badge` + h2,导语用 `.section-sub`\\
- `.badge` —— 编号圆 01–07(.pink/.violet/.lilac 变体按章分配),**恰好 7 个**(04/05 可选章省略时按实际渲染数)\\
- `.placement-card` / `.pcol` / `.pcol.app-slot` —— 01 章:排期三列(Premium/APP/PC),APP 列为填充槽\\
- `.creator-grid` + `.creator-card` —— 02 章达人卡 **恰好 2 张**:TOP 加 `.top`,NEW 加 `.chip`;内部 `.chead/.avatar/.handle/.platform/.cmetrics/.cshots` 结构照用\\
- `.chart-card` —— 03 章图表卡:`.chart-legend` + canvas + `.chart-note`\\
- `.compare-wrap` + `.compare-table` —— 04 章对比表:`th.us`/`td.us` 高亮我方列,`.compare-note` 数据源行\\
- `.pkg-grid` + `.pkg-card` —— 05 章套餐卡 **恰好 3 张**(.lime 推荐/.violet),`.pkg-reco-tag` + `.pkg-ai-note` 照用\\
- `.footer` —— 深梅紫页脚:logo+版权+日期,**恰好 1 个**\\
\\
## 3. 七个编号章节（数据从 CAMPAIGN_DATA 取）

**Hero + KPI（无编号）**：广告主名、报告期、总点击、总订单、总收入（$）、CPA 佣金率（缺→「—」）。月报 KPI 卡支持 MoM 环比:若 CAMPAIGN_DATA 含上月对比值,在对应 .glass-kpi 内 label 下以小字追加「MOM +x%」;无数据不写,禁止编造。

**01 Monthly Performance Trend**：导语「Daily clicks and order amount, {start} – {end}.」+ chart-card（真图表,Chart.js 双轴）。数据源=每日明细;月报加环比小备注:图表下 .chart-note 追加「Compare to last month: {summary}」(有环比数据时)。缺日明细 → 本章省略(不渲染空图)。

**02 Exposure Placement**：导语「FANSTOSHOP storefront exposure across Premium, App and PC modules throughout the month-long campaign window.」。版式 1:1 复刻 FT 真源模板(Example/FT.html 01 章),**本章恰好 1 张 .placement-card,禁止 pgroup/pwall/pcard 截图墙**:卡片结构 = .schedule-tag(🕶️ Storefront Schedule)→ **FT 平台截图行**(紧跟 schedule-tag 之后:.placement-cols 同宽三格,每格 <img> src 依次 /uploads/placements/ft-premium.png、/uploads/placements/ft-creator.png、/uploads/placements/ft-editorial.png,style="width:100%;height:150px;object-fit:cover;border-radius:8px;",alt 只写模块名 Premium/Influencer Hub/Editorial,图下不加文字标题、不写日期窗口、禁止重复标题文字)→ .placement-cols 排期三列(.pcol Premium 白卡 h4 / .pcol.app-slot 青柠 h4 APP + FILL IN 标 / .pcol PC 白卡 h4;**列头必须用 h4 禁用 h3**;每列 ul>li 排期项,有真实数据写实排期,缺数据用斜体占位「[X days — Placement name]」,禁止编造日期区间)。**本章只放上述三张 FT 平台截图,达人帖子截图一律不放本章**(它们属于 03 章达人卡 .cshots)。本章禁止省略——FT 真源模板本身就是占位设计。

**★ 禁自创章节(allMedia 隔离)**：context 若含 `allMedia`(全媒体表现表数据),FT recap **不渲染**该模块——不要拿它造「Media Performance」「Creator Breakdown」等 FT 模板没有的章节,也不要复用 .compare-table/.pkg-card 等契约类名给模板外内容。七章节固定:01 Monthly Performance Trend / 02 Exposure Placement / 03 Influencer Promotion / 04 Influencer Launch Journey(可选,全缺省略) / 05 Competitor Analysis(可选,无来源省略) / 06 Monthly Campaign Analysis / 07 Package Recommendation,缺数据的章按各自省略规则处理,不得顶替、不得增删。

**03 Influencer Promotion**：导语「Spotlight on the top performer and the newest creator added to the lineup within this month.」+ .creator-grid 双卡(FT 真源模板 Example/FT.html 02 章 1:1)。卡内结构逐字照抄模板:.chead > .avatar(文字首字母,可带真实头像图,禁背景图占位服务)+ .cwho(> .handle + .platform)+ .chip(仅 NEW 卡);TOP 卡 .top 青柠底。.cmetrics 恰好 3 格 .m > .v+.k:CLICKS/ORDERS/REVENUE(数据缺→0,禁加第 4-8 格);.cshots 双格 .cshot > img(真实 /uploads/ 帖子截图,缺格用 .ph 占位样式)。TOP=本月按点击/订单第一名;NEW=本月最新加入。达人数<2 → 只渲染一张。

**04 Influencer Launch Journey（可选章）**：导语「End-to-end creator onboarding & activation journey in this month, showing full lifecycle from sourcing to post-live performance.」+ .section 内以 .placement-cols 网格排 6 个阶段卡(.pcol,各含 .badge 式编号+阶段名+一句说明+占位):1 Sourcing & Matching(本月匹配博主数) 2 Outreach & Briefing(成功建联) 3 Confirm & Scheduling(确认合作) 4 Content Creation & Review(产出内容数) 5 Post Go-live & Tracking(成功发布笔记数) 6 Performance Settlement(数据归集)。底部小字:Total creators sourced / Confirmed collaboration / Published posts。阶段数据缺 → 用「—」占位,不编造;**本章永不因数据缺失整章省略(0914)**——阶段值从 creators 数据推导:1 Sourcing & Matching=creators 数组长度;2 Outreach & Briefing=creators 中有 performance 非空的达人数;3 Confirm & Scheduling=同 2(缺更细状态时与上一致);4 Content Creation & Review=所有 contentShowcase 截图总数;5 Post Go-live & Tracking=有 cps(clicks>0)的达人数;6 Performance Settlement=有 cps(orders>0)的达人数。底部小字:Total creators sourced / Confirmed collaboration / Published posts 同口径。

**05 Competitor Analysis**：导语「How {CLIENT}'s campaign on FANSTOSHOP compares against similar brands / channels in the same category.」+ compare-table(**全报告恰好 1 张,只在本章**;其他表格不得复用此类名) + Data source。无真实竞对来源 → 整章省略。本品牌列：Exposure Channels=实际渠道并集、Avg. CTR=点击/曝光（缺→「—」）、Avg. CPA=佣金支出/订单（缺→「—」）、Influencer Count=达人计数、Est. Monthly Spend=套餐/预算字段。

**06 Monthly Campaign Analysis — What Worked & Next Step**：导语「Key takeaways from this month's campaign performance, validated insights and actionable recommendations for next month's strategy.」+ .section 内 **三列并排(.analysis-cols,0914 新版式)**:左 .acol.win「✅ What Worked」、中 .acol.warn「⚠️ Areas to Improve」、右 .acol.next「➡️ Next Step」;每列内 ul>li 要点卡(每条:<b>关键词</b> + 一句洞察/建议,数据从真实指标推导)。Next Step 列四条:Strategy Adjustment / Placement Suggestion / Influencer Direction / Content Guidance。要点数据从 CAMPAIGN_DATA 真实指标推导,禁止编造结论;底部小字「All recommendations are based on this month's real performance data of {CLIENT} on Fanstoshop.」。

**07 FANSTOSHOP Package Recommendation**(h2 单行不折行,标题过长时优先缩短文案而非换行)：导语「Suggested next-phase hard-ad packages based on this campaign's performance. Placement mix across Premium / Influencer Hub / PC / APP can be tailored to budget.」+ .pkg-grid 三卡(FT 真源模板 05 章 1:1,棋盘配色:卡1 白 .pkg-card、卡2 .lime+顶部居中 .pkg-reco-tag RECOMMENDED、卡3 .violet)。卡内结构逐字照抄:.pkg-name(套餐名)> .pkg-price(价格 + <small>计费说明</small>)> ul>li(✓ 前缀由 CSS 提供)。**禁止用 h3 替代 .pkg-name、禁止裸 div 替代 .pkg-price**。末尾 .pkg-ai-note 粉条(💡 一句话推荐理由)。套餐数据源=CAMPAIGN_DATA 套餐模块；无数据时用 FT 官方标准三档：Package 01=CPA 16%（4 days Seasonal Spotlight (Premium) / 1 Pre-approved Brand Banner / 7 days Essentials (APP) / 5 days Rotation Banner (PC)）；Package 02=CPA 16% + $3,500（RECOMMENDED；5 days Seasonal Spotlight / 7 days Stylist — collab with influencers on APP / 2 Content Creators (AI-Matched Precisely) / 7 days Hot Brand Search (PC) / 1 Newsletter — recruiting influencers）；Package 03 · Hybrid=CPA 20% + $6,000（14 days Stylist / 8 days Influencer Login Banner + More Opportunity / 1 Month Discover Banner (Evergreen) / 5 days New Trend Partners + Curated Campaigns / 1 Pre-approved Brand Banner (New)）。

## 4. Chart.js 规范

- CDN `https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js`；`Chart.defaults.color 取 var(--color-ink-support) 对应值(资产 tokens: color-ink-soft); Chart.defaults.font.family="Inter,Arial,sans-serif";`
- bar dataset（Clicks）`backgroundColor 取 tokens --color-lime 的值`，y 左轴；line dataset（Order Amount）`borderColor 取 tokens --color-violet 的值`，y1 右轴 `position:'right'` grid 关闭；tension 0.35；容器 div 定高 260px+。

## 5. 文案语调

英文、短句、销售向；章节导语一句话「这是什么+为什么重要」；禁中文正文（数据源字段名除外）；数字千分位；百分比一位小数。
\
7. **素材真实性（禁占位图服务）**：页面所有 <img> 及 avatar 背景图必须来自 CAMPAIGN_DATA 真实素材字段：达人头像/帖子截图取 CreatorPerformance.posts（/uploads/ 路径），品牌 logo 取 campaign 品牌资产（/uploads/ 路径），平台资源位截图取 placementGroups 的 screenshotUrl（/uploads/placements/）。**.avatar 背景图与所有 url(...) 同样禁用占位图服务(picsum/placehold/via.placeholder)——头像无真实图时退化为 .avatar 文字首字母形态,不引外部图**。**唯一例外：数据中 creators[].avatarUrl 是系统权威头像字段(数据管理-合作列表页同款显示),存在时必须原样用于 .avatar 内 <img src>，优先于首字母回落；禁占位图条款不适用于该字段**。禁止使用任何占位图服务域名（picsum.photos / placehold.co / via.placeholder 等）；mediaPlacements.screenshotUrl 若为占位图服务域名则视为无素材，对应元素改用 .placeholder 样式渲染（样式资产已定义），不得 <img> 引用。n

8. **图表与页脚及模块规格(0915)**:
   a. chart.js 一律用本地同源 `/uploads/vendor/chart.umd.min.js`,禁引任何 CDN(jsdelivr/unpkg/cdnjs)——脚本加载失败图表整章空白。
   b. 页脚=FT.html 真身形态:深底(var(--color-aubergine))居中一行 `<p>Combined, the campaign generated <b>N clicks</b>, <b>N orders</b> and <b>$N</b> in revenue.</p>`(数字 <b> 青柠色 var(--color-lime));汇总数字取全周期真实值(月报)或本周窗口真实值(周报);禁用 logo 图与多行版权文字。
   c. 05 Competitor Analysis 竞品表=PRD 形态:列= Metric | CLIENT_NAME (Fanstoshop) | Competitor A | Competitor B;行= Exposure Channels/Avg. CTR/Avg. CPA/Influencer Count/Est. Monthly Spend。我方列全真实值(CTR=总clicks/总impressions,CPA=总gmv/总orders,spend=Campaign.budget);竞品列系统无数据一律「—」宁空勿假,禁编造声量数据冒充基准。页脚小字注明 Data source 与日期。声量表(shareOfVoice)不再作为本章形态。
   d. 04 Journey 六阶段卡:每卡 `<p>` 后必须加 `<div class="jshot"><img src="/uploads/journey/<stage>.png"></div>`(stage=sourcing/outreach/confirm/content/golive/settlement),高 120px cover 顶对齐——每阶段配示意图为固定形态。

9. **03 Influencer Promotion 卡片结构=FT.html 模板真身(0915 追加)**:
   a. creator-grid 恰两张卡:`.creator-card.top`(青柠底,Top Performer) + `.creator-card`(白底,Newest Addition)。Top=周期内 clicks 最高的真人达人(排除媒体/社区行);Newest=seed 顺序最后一个真人达人。
   b. handle 一律 @ 前缀(如 `@Iris Lin`);Newest 卡的 NEW chip 写在 handle 内部(`<span class="chip">NEW</span>` 紧跟 handle 文本),不放 chead 层。
   c. platform 行格式 `平台 · Top Performer` / `平台 · Newest Addition`。
   d. cmetrics 恰 3 格(CLICKS/ORDERS/REVENUE),数值取 LinkPerformance 该达人整周期真实值——禁编造 0 值。
   e. cshots 恰 2 格,真源=Collaboration.deliverables[].screenshots[].src(/uploads/post-shots/*,按 campaignCreatorId 对应)。
   f. 无 cnote 段(模板没有);叙述信息并入 platform 行或省略。

10. **KPI 行与 Exposure Placement 版式(0915 追加)**:
   a. `.kpi-row` 必须有顶边距:`padding:24px 44px 32px`(禁 0 顶距,卡片不可贴死 hero)。
   b. Exposure Placement 每个资源位=一个整体视觉卡(`.punit` 纵向 flex):截图 `<img class="pimg">` 在上,圆角仅 `8px 8px 0 0`(下左/下右直角);解释卡 `.pcol` 在下紧贴,圆角仅 `0 0 var(--radius-md) var(--radius-md)`(上左/上右直角),`margin-top:-1px` 消缝。三个 punit 横排于 `.placement-cols`(3 列 grid, gap 16px)。
   c. 截图真源 `/uploads/placements/ft-premium.png`(Premium)、`ft-creator.png`(Influencer Hub/APP)、`ft-editorial.png`(Editorial/PC)。pcol 内 h4+排期列表,排期项维持方括号占位形态。

11. **版式规格(0915 三条,必守)**:
   a. 趋势图模块 `.chart-card`(含 Clicks/Order Amount 图例)必须与上方 KPI 行留边距:`margin:16px 44px 8px(左右 44px 与其它模块 inset 一致)`(禁 margin-top:0 贴死)。
   b. Exposure Placement 的 `.punit` 整体卡必须带完整边框:`border:1px solid var(--color-divider); border-radius:8px 8px var(--radius-md) var(--radius-md); overflow:hidden; background:var(--color-white)`——截图与解释卡作为同一张卡包裹在边框内(内部 img/pcol 不再各自带边框)。
   c. Influencer Promotion 卡内 `.cmetrics` 指标必须横向三等分:`display:grid; grid-template-columns:repeat(3,1fr); gap:10px`(禁 flex 自然宽)。
   d. `.cshot img` 帖子截图必须统一社媒帖子比例与高度:`width:100%; aspect-ratio:3/4; object-fit:cover; object-position:top; display:block`(同卡内多张截图高度必须一致)。
   e. **禁止任何后置覆盖规则把 `.cmetrics` 改回 4 列或 flex 自然宽**——若同页存在旧迭代 CSS 块(如 repeat(4,1fr)),必须同步改为 repeat(3,1fr) 或删除;`.chart-card` 左右边距必须与 placement/creator/pkg 模块 inset(44px)一致,禁止 0。
12. **结构纪律(0915)**: 每章 `<!-- 0N -->` 必须是 `.page` 的直接子节点——**严禁 `.section` 嵌套 `.section`**(会导致 88px 双重 inset);每段 div 开闭数量必须自平衡,禁止在段尾残留多余 `</div>`;`.chart-card` 左右 inset 与 placement/creator/pkg 模块一致(44px,由 `.section` 的 padding 提供,模块自身不再加横向 margin)。
13. **Placement 三列纪律(0915)**: `.placement-cols` 必须恰好含 **3 个直接子节点** `.punit`(Premium/APP/PC);每个 `.punit` 内部 img+pcol 的 div 必须按嵌套结构逐卡配对闭合——**严禁靠段尾补 `</div>` 凑数量**(数值平衡但结构嵌套=第三卡掉第二行,视觉只有 2 列)。
14. **表格与套餐模块(0915)**: 05 竞品表必须用 `<table class="compare-table">` 且外层 `.tbl-wrap`——CSS 钩子全挂在 `.compare-table` 上,裸 `<table>` 会导致表头无底色/无圆角(样式悬空);07 套餐章与周报 03 章同构:`.pkg-grid` 三卡(白/青柠 RECOMMENDED 带 `.pkg-reco-tag`/紫 Hybrid)+`.pkg-ai-note` 粉条,`.pkg-reco-tag` CSS 必须随卡存在。
15. **Journey 阶段图纪律(0915)**: 04 章阶段卡内的示意图容器必须用 `.jshot`(img `width:100%; height:150px; object-fit:cover; object-position:top`)——**无此约束图按原生 480px 渲染,grid 轨道被 min-width:auto 撑爆,第 3/6 号卡横向溢出页外(视觉只见 1、2、4、5)**;`.placement-cols .pcol` 必须带 `min-width:0`。
