# PPTGenerator 指南维护手册（Agent 架构版）
## ——指南怎么改、怎么验、怎么挂文件，照此操作

日期：2026-09-03 ｜ 配套：docs/agent-architecture-report.md ｜ 面向：维护指南的所有人（含未来的 AI 会话）

---

## 〇、先分清你手里这份"指南"是哪一层

| 层 | 存哪 | 管什么 | 例子 | 改动风险 |
|---|---|---|---|---|
| L1 视觉指南 | DB Guide 表（isDefault=true） | 色/字/组件/动效 | Fanstoshop 2026 设计系统（30K）、Duomai 设计规范 | 低——只影响长相 |
| L2 结构指南 | DB Guide 表（scenario 或 overridesVisual） | 章节/展示/语调 | DM Performance Deck（6.4K）、DG Campaign Report | **高——直接影响生成内容的结构正确性** |
| L0 CORE | ai-generate.service.ts 硬编码 | 铁律/技术栈/默认结构 | 禁伪造数据、Tailwind 配置 | **最高——所有业务线共用，改错全线崩** |
| assets（新） | skill 文件（样张/token/清单） | 像素级基准、自查基准 | DUOMAI_viagogo 样张 | 低——文件不改提示词语义 |

判断口诀：**改长相找 L1，改章节找 L2，改"什么都不许"找 L0，改"长得像不像"挂 assets。**

---

## 一、三条铁律（违反=生产事故，均有前科）

### 铁律 1：改指南 = 改提示词，必须 A/B 实测，禁止只改不验
前科：DM deck 指南上线后被 L1 白色规范淹没，产出完全走样（修复 commit ad54006 才引入 overridesVisual）。
- 每次改动后用同一个 campaign 跑一次生成，对比改前改后 HTML（存 /tmp 对比 slide 数、必含类名）
- 有样张的业务线：生成结果与样张 diff 肉眼过一遍（浏览器开两个 tab）

### 铁律 2：新业务线先想清楚 overridesVisual，别让 30K 设计系统淹没 6K 结构指南
- 结构指南自带完整视觉（如 deck 强版式）→ 必须勾 overridesVisual=true
- 普通报告场景 → 不勾，靠 CONFLICT RULE 裁决（L1 管视觉、L2 场景专用变量可覆盖）

### 铁律 3：指南里写"必须包含 X"之前，先确认数据侧真的会有 X
前科：Slide 4 PACKAGE 写了三档套餐规则，CommissionPlan 表 0 行 → 永久整页省略，用户以为 bug。
- 写"必含"规则时同步写清"无数据时的合法形态"（渲染占位 / 整页省略二选一，写明）
- 上线前跑 module-coverage 预检接口确认该维度的真实数据存在

---

## 二、日常维护操作手册

### 2.1 改一份现有指南（高频）

1. 管理后台 → 数据管理 → 指南页（/guides，API: PATCH /api/v1/guides/:id）
2. 改前先把当前 content 存档（见 2.4 回滚）
3. 改 content，**每处改动在文末 changelog 区加一行**（格式见 2.5）
4. 保存后立刻验证（铁律 1）：选该指南覆盖的一个测试 campaign，UI 生成一次
5. 验证通过才算完成；不过就回滚（2.4）或修正

### 2.2 新建指南（低频）

- 先决定：视觉层还是结构层？scenario 填什么？（场景名与前端下拉一致）
- 结构层指南模板骨架（保持现有 DM/DG 指南的分区习惯）：
  ```
  # XX 指南（一句话定位 + overridesVisual 声明）
  ## 0. 硬约束（骨架级，逐条遵守）
  ## 1-N. 组件/章节规范（按 slide 或 section 组织）
  ## 数据铁律（宁缺勿假：缺什么→显示什么）
  ## 自查清单（生成后逐项核对——迁移后升级为 validate 工具规则）
  ## changelog
  ```
- 篇幅预算：结构层 ≤8K 字符；超了说明在写视觉——拆去 L1 或 assets

### 2.3 挂 assets（Agent 架构新增，Phase 2 落地后）

迁移完成后，指南表单会出现 assets 区。原则：
- **样张**：每个强版式指南必挂 1 份标杆 HTML（如 DUOMAI_viagogo_Performance_Deck.html）
- **token**：色板/字号外置 css/json，指南正文只写"用 token 文件的 --gold"
- **清单**：自查清单独立成 md，格式为可校验的断言（"slide 数 = 4"而非"四张 slide"）
- 改 assets 不用改指南正文——这正是拆出去的好处

### 2.4 回滚（出事时 5 分钟内恢复）

当前无版本表，靠 git 惯例：指南正文如从文档迁移而来，仓库 docs/guides/ 存有对应 md；
纯后台改的，改动前手动复制 content 存到 docs/guides/history/<指南id>-<日期>.md。
（Phase 2 事项：GuideRevision 版本表 + 一键回滚，见第四节）

### 2.5 changelog 约定

每份指南文末维护：
```
## changelog
- 2026-09-03 slide4 规则明确"无 commissionPlans → 整页省略"（数据侧确认表为空）
- 2026-08-31 新建，1:1 对齐 viagogo 样张
```

---

## 三、谁改什么——职责边界

| 你想改的问题 | 改哪里 | 不要动哪里 |
|---|---|---|
| "报告配色/字体不对" | L1 视觉指南 | L2 结构指南 |
| "少/多了一个章节" | L2 结构指南（先查数据侧！铁律3） | L0 CORE |
| "生成的 HTML 有 nav/menu 违禁元素" | L0 CORE 布局禁令（全业务线共享，慎改） | 业务指南 |
| "图表类型选错" | L2 的图表规范段 或 L0 Chart.js 规则 | — |
| "和样张不像" | 挂/更新 assets 样张，指南正文只写样张无法表达的差异 | 重写整份指南 |
| "AI 编造了不存在的数据" | L0 铁律段（已有，勿放松）；多数情况是 prompt 数据注入问题，查 buildCampaignContext | 指南里重复加铁律 |

**反模式**：同一铁律在 L0/L1/L2 重复出现。现在 EDIT_SYSTEM_PROMPT 里"禁伪造"写了 3 遍——迁移时合并为一处，指南层一律不重复铁律。

---

## 四、维护能力演进（对应架构报告 Phase 1-3）

| 阶段 | 维护体验变化 |
|---|---|
| 现在 | textarea 直接改 DB 文本，改完靠人肉生成验证，无版本无回滚 |
| Phase 1 后 | validate_html 工具上线：指南"自查清单"写成断言，保存指南时即可**干跑校验**（对最近一次生成结果跑断言），改错当场暴露 |
| Phase 2 后 | GuideRevision 版本表：每次保存自动存版本，一键回滚；assets 挂样张/token，指南正文变薄 |
| Phase 3 后 | 指南效能度量：每份指南的生成通过率/校验失败率/人工重生成次数入统计，改指南从"凭感觉"到"看数据" |

---

## 五、给未来 AI 会话的操作提醒

1. 改指南前先 `SELECT content FROM Guide WHERE id=...` 存档到 docs/guides/history/
2. 改完必须实测生成（铁律 1），不要只改数据库就宣布完成
3. "缺章节"类问题先查数据（module-coverage + 对应表行数），再怀疑指南
4. L0 CORE 在 ai-generate.service.ts 内硬编码，改它属于代码变更——走 commit 流程而非后台
5. 用户报告"效果和样张差异大"时：优先对比 assets 样张与生成 HTML 的结构 diff（slide 数、类名清单），其次才动指南文字
