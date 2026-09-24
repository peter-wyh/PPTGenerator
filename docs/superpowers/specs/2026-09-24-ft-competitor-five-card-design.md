# FT 月报「Competitor Analysis」五卡重构设计

日期:2026-09-24 ｜ 状态:已评审通过(方案一·资产层扩容) ｜ 关联:docs/guide-maintenance-runbook.md、2026-09-21-monthly-report-iteration-design.md

## 背景与目标

FT(Fanstoshop)月报指南(`cmt_ft_monthly_001`,active revision v19)的竞品分析章目前形态是一张三列 compare-table(Metric | CLIENT | Competitor A | B),竞品列无数据一律「—」。用户提供 FansToShop「Competitor Insights」参考图(评审稿),要求把该章重构为参考图的**五维度卡片 × 每卡固定 Data→Insight→Action 三段**结构。

已确认的三个决策:

1. **交付范围 = 全链路**:改 CSS 资产 + L2 结构指南 + validator 断言,再以 GlowLab 项目(`cmuc13qo7000h6cockqglovg5`)实测生成验证(铁律 1)。未来所有 FT 月报生成自动生效;存量 v5.3 不动。
2. **卡片结构 = 忠实照搬五维度卡**:01 Commercial Commission / 02 Creator Strategy / 03 Content Strategy / 04 Performance / 05 Gap & Opportunity;卡内 Our vs 竞品;我方真值填充、竞品无数据→「—」、整卡无数据源→隐藏(参考图自带「Missing data can be hidden」契约)。
3. **评审批注元素不进报告**:绿色「固定模组」胶囊、"AI-assisted Demo"、"From Demo to Practice"便签、手写签名全部排除;Data→Insight→Action 概念以克制方式表达(卡内 micro-label 标签)。

## A · 组件与视觉(`.comp-*` 资产体系)

参考图视觉 → FT design tokens 映射:深紫画板 = aubergine 渐变;白卡圆角;粉强调 = `--color-pink-active`/`--color-pink`;Insight 段淡 mint 底(rgba(136,219,165,.18),同 `.scard.green` 家族);Action 段淡 pink 底(rgba(255,168,205,.16),同 `.scard.pink` 家族);图表色序 = lime/violet/pink/lilac(与全报告 Chart.js 一致)。

章内结构(保持 `.section` + `.section-head` + `h2 "Competitor Analysis"` + `.section-sub` 导语不变):

```
.comp-board            深梅紫画板(aubergine 渐变底、圆角、padding)
  .comp-grid           五列栅格(响应式:1100px→3列 / 760px→2列 / 480px→1列)
    .comp-card × N     白卡,N ∈ [1,5],编号按实际渲染数连续 01..N
      .cc-head         .cc-no(半透明大编号) + .cc-title + .cc-sub(商业模式小字)
      .cc-data         数据区(形态见下)                 [DATA micro-label]
      .cc-insight      淡 mint 底,1-2 句洞察            [INSIGHT micro-label]
      .cc-action       淡 pink 底,1-2 句可执行建议       [ACTION micro-label]
  .comp-note           Data source 小字脚注
```

五卡 Data 区形态:

| 卡 | 形态 | 实现 |
|---|---|---|
| 01 Commission & Spend | 紧凑表(Metric \| Our \| Rival) | `.cc-table` 纯 HTML,10.5px 小字 |
| 02 Creator Strategy | doughnut + 中心大数(达人计数) | Chart.js,容器定高 ~150px |
| 03 Content Strategy | 水平占比条 ×3-4 | `.cc-bars` > `.cbar-track`/`.cbar-fill` 纯 CSS |
| 04 Performance | KPI 组(值+MoM 升降)+ Top Creators 三行 | `.cc-kpis` > `.ckpi` + `.cc-pool` 纯 HTML |
| 05 Gap & Opportunity | 雷达(粉半透明填充) | Chart.js radar |

约束:Chart.js 用本地同源 `/uploads/vendor/chart.umd.min.js`(指南 8a 既有规则);新增 canvas **不挂 data-field**(不参与换周期 postProcess 改写);高密度小字号(卡内 10-11px,忠实参考图)。

## B · 数据映射与省略规则(宁缺勿假)

| 卡 | 我方真源 | 竞品 cell | 无源时 |
|---|---|---|---|
| 01 Commission & Spend | CPA 佣金口径、Est. Monthly Spend=Campaign.budget、套餐 CPA% | — | 隐藏卡 |
| 02 Creator Strategy | creators 计数、TOP3 达人 orders 占比 donut | — | 隐藏卡 |
| 03 Content Strategy | 内容主题占比条(与 06 章 caption themes 同源) | — | 隐藏卡 |
| 04 Performance | CTR/CPA/Orders/新客率 + priorPeriod MoM 徽标;Top3 达人 | — | 隐藏卡 |
| 05 Gap & Opportunity | analytics.competitors 的**多维**真实数值(雷达一维一顶点) | 真值 | 整卡隐藏(仅单维 SOV 或无数据同样隐藏——单值撑不起雷达,宁缺勿假) |

Insight/Action 文案由 AI 从该卡 Data 区真实指标推导(与 06 章 `.acol` 同口径);竞品全「—」时只写我方结构洞察与建议,禁止写竞品差距结论、禁止编造竞品数值。GlowLab 现状(analytics 无 competitors)预期渲染 01-04 四卡。

## C · 落地改动清单(5 工件)

1. **`Example/FT_Competitor_Insights_Ref.html`** — 参考模板 standalone(手工成品,含完整版式,浏览器直接预览验收;像素真源)。
2. **`apps/server/src/modules/guides/assets/ft-recap/base.css`** — 追加 `/* ===== 0924: Competitor 五卡(Data→Insight→Action) ===== */` 块(估 4-6KB)。**只增不删**——旧 `.compare-*` 保留(周报指南仍引用)。
3. **GuideRevision v20**(`saveRevision` + 激活):
   - 指南 content 4 处改写:章节固定清单句(L81)竞品章描述;**05 章整段重写**(L87,五卡形态+类名骨架+数据映射);规则 8c(L107)旧 PRD 表形态→五卡新形态、声明 compare-table 在月报退役、保留「声量表不再作为本章形态」;规则 14(L131)前半句改为新表类,套餐后半不动。文末 changelog 加行。
   - checks 追加:`count_class in [1,5] .comp-card`、`count_class in [1,5] .cc-insight`、`count_class in [1,5] .cc-action`(report 级,三段随卡等量);`no_element table.compare-table`(**block** 级,防退回旧表);保留 `h2_contains Competitor Analysis`。
   - assets:base.css hash 刷新(现 revision 记录 `f9684b157a2ad5eb` 已与仓库文件 `5c9cb618003fe488` 脱节,本次一并校正为落库后新 hash)。
4. **`ft-recap/component-contract.json`** — 手工补 `.comp-*`/`.cc-*` 类条目(无自动重扫脚本,该文件为低风险文档)。
5. **`docs/guides/history/cmt_ft_monthly_001-20260924.md`** — 改前 content 存档(runbook 2.4 回滚约定)。

## D · 验证(铁律 1)

1. 参考模板浏览器预览,肉眼对照参考图验收(布局/配色/三段结构)。
2. validator 对参考模板干跑新 checks(应全过,含 block 级)。
3. GlowLab 同 campaign 实测生成一次 AI 月报(html-studio),新旧 HTML 对比:卡数、类名清单、三段结构、竞品「—」占位;浏览器肉眼比对。
4. 通过后激活 v20 为 activeRevision;失败则按 runbook 2.4 回滚(存档可恢复)。

## 风险与边界

- **AI 类名拼错风险**:由指南骨架铁律(逐字照抄片段)+ `no_element`/`count_class` 断言兜底;block 级失败进 fix 循环重生成。
- **L0 冲突**:ai-generate.service.ts 的「Competitor share of voice → 横条图」默认模块(L0)与本形态冲突时,以 L2 显式声明覆盖(既有「声量表不再作为本章形态」先例,新 spec 延续该写法);L0 不改。
- **五列在 1120px 页宽下每卡 ~185px**:忠实参考图高密度形态,字号 10-11px;若实测不可读,回落 3+2 两行布局(响应式断点已内置,不改类名)。
- **章节编号漂移**:L0 ExecSummary 规则使竞品章实际编号为 06;新 spec 以章名「Competitor Analysis」为锚,不写死编号。
