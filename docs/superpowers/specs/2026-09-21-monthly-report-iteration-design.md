# 月报迭代（AI 模式）：上月趋势对比 + 峰值洞察 + Exposure 大图 + Executive Summary — 设计

日期：2026-09-21
状态：已评审（方案 B，两段设计均获用户确认）

## 背景与需求

月报走 **AI 模式**（`mode:'ai'`，`apps/server/src/modules/html-templates/ai-generate.service.ts`）：LLM 从 context JSON + SYSTEM_PROMPT 生成整份自包含 HTML。本次迭代三个需求：

1. **数据趋势**：趋势图增加上月数据展示（方便比对）；本月最高点高亮；峰值数据的分析 insight 文本模块
2. **Exposure 模块**（placementGroups 图片墙）：hover 展示大图
3. **首屏新增「本月核心结论 / Executive Summary」模块**：自动提炼 2–3 个 performance highlights + 1 个需要关注的问题（参考样式：4 列卡片网格，图标圆底 + 结论式标题 + 粗体数字正文 + 胶囊徽标，concern 卡琥珀色 + "!" 图标）

## 已确认的决策

| 议题 | 决策 |
|---|---|
| 目标链路 | AI 模式（当前月报）；recipe 模式不动 |
| 上月对比形式 | 同一张 Chart.js 图叠加**虚线**上月日级序列，按月内日对齐（8/1 对 7/1），图例 "This Month / Last Month"，图旁配上月 Revenue/Orders 汇总 + MoM 徽标 |
| 上月口径 | 月报=上一**自然月**全月；非整月自定义区间沿用现行等长前窗口 |
| 峰值定义 | Revenue 主峰（大圆点 + 标注气泡：日期+金额）；insight 文本全维度展开（当日 orders/clicks、vs 日均倍数、峰日贡献最大 creator——口径可导出时） |
| Hover 大图 | **纯 CSS** :hover 放大 overlay（同一截图原图 object-fit:contain，半透明遮罩+标题+平台 chip），零 JS；触屏不触发（可接受），卡片 postUrl 点击跳转保持 |
| Exec Summary 渲染策略 | **始终渲染 + 降级**：候选不足有多少渲染多少；execSummary 缺失渲染单张全宽空态卡 |
| 实现方案 | **方案 B**：服务端确定性素材 + prompt 渲染契约（数字全部服务端算好，AI 只做挑选与叙述）——与 `narrative.ts`「数字确定性、AI 只写文案」哲学及 `dailyTrend` 命名变量锚定约定同构 |

## §1 数据层 — `buildCampaignContext` 新增三块确定性素材

### 1.1 `priorPeriod.dailyTrend`（上月日级序列）

现有 `priorPeriod`（`ai-generate.service.ts:1430`）只有聚合值（`kpis`/`priorKpis`/`mom`），扩展 `dailyTrend` 字段，形状与主 `dailyTrend` 一致：`[{date, revenue, orders, clicks?}]`。

- **窗口判定**：报告期 start=当月 1 日 且 end=当月最后一天（`month "YYYY-MM"` 经 `period-snapshot.ts:92-97` 展开天然满足）→ 前期 = 上一自然月全月（1 日~月末）；否则沿用现行等长前窗口（`len = e - s + 1day` 往前推）。解决 2 月报告等长窗口截断 1 月的边 case
- **取数**：
  - 中间层存在（`orderStats`）：revenue/orders 走 `priorOrderStats.days`（现有查询，复用）；clicks 需补一段 inPrior 窗口的 `cpsSource` 按日 clicks 聚合（内存扫描 `cpsSource.byCc`，零额外 DB 查询）
  - 无中间层：全部从 `cpsSource` 前窗切片聚合（与主 dailyTrend 的 byDate 路径同构）
- **宁缺勿假**：前窗无任何数据行 → `priorPeriod` 保持 null（现状不变）；序列只含有数据的日期，**不按日历补零**；clicks 无日级源（`clicksKeySeen=false`）时前窗序列同样不带 clicks 字段

### 1.2 `trendPeak`（峰值事实，独立顶层字段）

从**喂给主 `dailyTrend` 的同一序列**计算（口径一致）：

```
{ date: string, revenue: number, orders: number, clicks?: number,
  vsAvgMultiple: number,                    // 峰日 revenue ÷ 期内日均，1 位小数（如 3.2）
  topCreator?: { name: string, sharePct: number } }   // 峰日贡献最大达人 + gmv 份额
```

- `vsAvgMultiple` 服务端算——LLM 易算错的派生值不交给 AI
- `topCreator` **口径门控**：非中间层路径用 `cpsSource` 峰日按达人 gmv 聚合（share = 该达人峰日 gmv ÷ 全 campaign 峰日 gmv）；中间层路径 OrderDailyStat 无「达人×日」维度、cpsSource gmv 与订单表 commission 口径不符 → **不输出 topCreator**（宁缺勿假，AI 按 prompt 规则不提达人）
- 峰日 revenue 为 0 或序列空 → 整个字段不注入

### 1.3 `execSummary`（候选事实块，独立顶层字段）

服务端预计算格式化候选，AI 只挑选与叙述：

```
{
  highlights: [ { key, label, value, detail }, ... ],
  concerns:   [ { key, label, value, detail }, ... ]
}
```

| 候选 | 来源 | 出现条件 |
|---|---|---|
| `ordersMoM` / `revenueMoM` | `priorPeriod.mom` | mom 值非 null 且方向显著（如 |pct| ≥ 5%） |
| `topCreator` | `perCreatorSums` + creator 名 | **期内** gmv 份额最大的达人，份额 ≥ 20%（与 `trendPeak.topCreator` 峰日归因是两个不同事实） |
| `topPlatform` | `perCreatorSums` × creator.platform 聚合 | clicks（或 gmv）份额最大平台，份额 ≥ 30% |
| `peakDay` | `trendPeak` | trendPeak 存在 |
| `newCustomerRate` | 新客数/订单 | 有标签数据（hasNewCustomerTag） |
| `pendingOrders` | `orderStats.totals.pendingOrders` | > 0 |
| `declining*` | `priorPeriod.mom` 负增长项 | 任一核心指标 mom < 0 |
| `concentration` | 达人份额 | 活跃达人 ≥ 3 且 top 份额 ≥ 50% |
| `dataGaps` | `periodDataGaps` | 非空 |
| `caliberCoverage` | `caliberAdvisory` | 订单表覆盖 < 80%（有 advisory 时） |

- 每个候选有数据才出现；`value`/`detail` 为服务端格式化字符串（如 `'+21.6%'`、`'28% of GMV'`、`'Mia Chen — $1.6K GMV, 179 orders'`）
- `modules` 覆盖清单（`ModuleCoverageItem`）新增 `execSummary` 条目（status: 候选数 > 0 ? ok : missing），前端覆盖面板可见

## §2 Prompt 规则 + 快路径再渲染 + 测试/降级

### 2.1 SYSTEM_PROMPT 模块规则

生效版为英文 `SYSTEM_PROMPT`（`ai-generate.service.ts:134-356`）；中文 `SYSTEM_PROMPT_DISPLAY`（:363-523，controller 暴露给前端的展示镜像）**同步维护**。

**REPORT STRUCTURE 顺序**：Header → **Executive Summary（ALWAYS）** → KPI Overview → Trend → …，章节编号顺延。

**① Executive Summary 模块规则**（新增 ALWAYS 模块）：
- 布局：编号徽章 + 衬线大标题 "Executive Summary" + 一行副标题；下方 **4 列卡片网格**（响应式窄屏 2/1 列）；卡片 = 圆形图标底 + 结论式标题 + 正文（关键数字**粗体**）+ 底部胶囊徽标
- 语义配色：highlight 卡绿/粉/紫浅底同色系层次（图标圆底—卡底—徽标同色系不同饱和度）；**concern 卡琥珀底 + "!" 图标**，徽标箭头 `→`（待处理）vs `↑`（增长）；扁平无/极淡阴影，与 guide 设计体系（衬线标题+编号徽章）一致
- 内容铁律：从 `execSummary` 块选 **2–3 个 highlights + 恰好 1 个 concern**；正文数字只能从候选 `value`/`detail` 复制，**禁止自行计算或发明数字**；highlights 候选不足有多少渲染多少（≥1 张卡）；**concerns 候选为空 → 省略 concern 卡**（不编造问题，卡片总数可为 2–3）；`execSummary` 整块缺失 → 单张全宽 muted 空态卡 "Automated summary unavailable — pending data import"

**② Trend 模块规则**（扩展现有 time-series 规则）：
- `priorPeriod.dailyTrend` 存在 → 同图叠加虚线序列（Chart.js `borderDash: [6,6]`、浅色同色系），**按月内日对齐**（labels 用本月日期，上月序列按日号映射），图例区分；图旁/图下加上月 Revenue/Orders 汇总小数字 + MoM 徽标
- `trendPeak` 存在 → Revenue 峰值点放大圆点（pointRadius 加大）+ 标注气泡（日期 + 金额）；图表下方 **Peak Insight 卡**：AI 写 1–3 句分析，事实只能来自 `trendPeak` 字段（日期、金额、×倍数、当日 orders/clicks、topCreator 有则提），无 `topCreator` 不提达人
- 字段缺失安静降级：无虚线、无环比徽标、无峰标、无 insight 卡——不渲染占位

**③ Exposure lightbox 规则**（扩展 Placements 卡片规则 `:230-237`）：
- 卡片内隐藏 lightbox 层，`:hover` 显示：半透明遮罩 + **同一截图 URL** 原比例 `object-fit:contain`（max ~85vw/85vh）+ 标题 + 平台 chip；**零 JS**、零新增素材
- 卡片现有 hover lift、postUrl 新标签打开保持；LAYOUT 禁令区补充说明：lightbox 不得引入 JS / 导航行为（纯 CSS 装饰层）

### 2.2 命名常量锚定 + 快路径扩展

- prompt 要求数据脚本使用精确变量名：`const dailyTrend = [...]`（现有约定）+ **新增 `const priorTrend = [...]`、`const trendPeak = {...}`**
- `template-renderer.ts:354 replaceTrendData` 同款正则扩展为三常量改写 → `projects.service.ts:601 _refreshHtmlForPeriod` 换周期快路径（data-field 模板 <100ms）重算后图表三要素同步、不脱锚
- Exec Summary 正文是散文，快路径不重写（与现有散文不重写的取舍一致；换周期后数字锚定候选可陈旧，属已知限制，重新生成可消除）

### 2.3 测试

- **context builder 单测**（`ai-generate.service.test.ts` 或独立文件）：
  - 整自然月 → 上一自然月窗口；非整月 → 等长前窗口；2 月边 case
  - 上月序列形状（中间层/非中间层两路）、前窗无数据 → priorPeriod null、clicks 无源不带字段
  - `trendPeak`：vsAvgMultiple 计算正确性；topCreator 口径门控（中间层路径不输出）；全 0/空序列不注入
  - `execSummary`：各候选出现/缺席条件（pendingOrders>0、集中度阈值、dataGaps 非空、mom 显著性）；格式化字符串形状
  - `modules` 覆盖清单 `execSummary` 条目
- **prompt 不变量断言**：新规则存在于 EN 生效版；CN 镜像同步；`priorTrend`/`trendPeak` 命名常量约定存在；"禁止发明数字"铁律措辞存在
- **replaceTrendData 单测**：三常量各自改写、缺失常量不动
- 全量回归：server vitest 现有套件

### 2.4 降级与边界

- 上月无数据 → 无虚线/无 MoM 徽标（现状行为）
- 峰日全 0 → 无峰标无 insight 卡
- 候选空 → Exec Summary 空态卡（始终渲染策略）
- AI 生成失败 → 现有 retry/降级路径不变
- **存量报告不受影响**：新模块与图表增强只在下次重新生成时出现

## 非目标

- recipe 模式（`recipe/campaign-report/`）本次不接入（无 exposure 模块，需另行立项）
- Exec Summary 散文的快路径重写、峰日归因的订单表口径补齐（OrderDailyStat 无达人×日维度）
- 触屏设备的 exposure 大图交互（hover 语义在触屏不触发，维持点击跳转）
- 竞品声量等模块的改动
