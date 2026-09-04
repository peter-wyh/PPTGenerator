# PPTGenerator Agent 化架构报告
## ——如何把现有三层提示词重构为 Agent 的四维结构（提示词 / Skill / 文件 / 工具）

日期：2026-09-03 ｜ 依据：ai-generate.service.ts (2554 行) + guide.service.ts + DB 实测

---

## 一、现状盘点（代码证据）

### 1.1 现有「三层提示词」实际结构

```
buildSystemPrompt()  =  CORE + GUIDE + FACTS
│
├─ L0 CORE: SYSTEM_PROMPT（26,180 字符 ≈ 6.5K tokens，硬编码在 ts 文件里）
│    22 个 ═══ 段落：铁律(禁伪造/禁应用UI) / 思考语言 / 品牌禁语 / 设计系统 /
│    Tailwind配置 / CSS类系统 / Chart.js规则 / 默认报告结构 / 表格对齐 /
│    布局禁令 / 语言规则 / data-anchor锚点 / 创作者叙事 / 输出约束……
│
├─ L1 GUIDE: GUIDE_SYSTEM_SUFFIX 包装的业务线指南（DB 表 Guide，按 campaign 动态注入）
│    - 视觉层（isDefault 设计规范，如 Fanstoshop 30K 设计系统）
│    - 结构层（scenario 报告结构指南，如 DM Performance Deck 6.4K）
│    - overridesVisual 标志：结构层声明自带视觉 → 跳过 L1 视觉层
│    - CONFLICT RULE：双层并存时 L1 管视觉、L2 管结构、场景专用变量 L2 可覆盖
│
└─ L2 FACTS: BUSINESS_FACTS_SUFFIX（footer 署名 + logo 硬约束，~10 行）
```

另有独立的编辑链路：EDIT_SYSTEM_PROMPT（5,057 字符）+ EDIT_USER_PROMPT_TEMPLATE，
以及 recipe/ 目录下的确定性代码路径（mapper/narrative/render/coverage，915 行，hbs 模板渲染）。

### 1.2 现有「隐形的第四层」：代码后处理 postProcessHtml()

AI 输出后还有 200+ 行确定性代码兜底：去 markdown fences、截取 DOCTYPE..</html>、
补全截断标签、DOMContentLoaded→load、强制 animation:false、script 截断修复、
CDN URL 归一化（SELF_HOST_BASE）。**这实际上已经是"工具/运行时"层的雏形，但和提示词混在同一文件、无独立契约。**

### 1.3 数据供给层（buildCampaignContext）

campaign JSON（metrics/dailyTrend/commissionPlans/placementGroups/coverage/dataGaps…）
以「{{CAMPAIGN_DATA}} USE EXACTLY THESE VALUES」方式整体塞进 user prompt——
这是目前唯一的"上下文工程"，无检索、无增量、无缓存。

### 1.4 今日实证的缺陷（第 4 页缺失事故）

- 指南要求 Slide 4 PACKAGE「仅两种合法形态：三档套餐或整页省略；无输入则整页省略」
- 生成结果只有 3 张 slide → 排查发现 CommissionPlan 表 0 行 → 规则触发"整页省略"
- **行为完全正确，但用户不知情**：静默降级无任何UI提示。
  数据预检接口（module-coverage）已存在却没有接进 deck 场景的前置告知流。

---

## 二、目标架构：四维 Agent 拆分

### 2.1 总览

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Runtime（编排层）                     │
│   感知(预检) → 规划(选指南/选模块) → 行动(调工具) → 校验(自查) → 输出   │
└──────┬──────────┬──────────────┬──────────────┬──────────────┘
       │          │              │              │
   ①提示词维度   ②Skill维度     ③文件维度      ④工具维度
   (角色+铁律)   (程序性知识)    (事实+样张)     (能力边界)
```

核心原则：**提示词只放"角色与铁律"，知识外置为 Skill，事实外置为文件/数据，动作用工具**。
当前 26K 的 SYSTEM_PROMPT 是"什么都塞"的反模式——token 贵、冲突多、改一处怕全身。

### 2.2 ① 提示词维度（System Prompt —— 收缩到 <8K）

只保留四类内容：

1. **身份**："你是 B2B 营销报告生成 agent"
2. **不可协商铁律**（迁移自现有铁律段，压缩合并）：
   - 禁伪造数据（宁缺勿假，Data Unavailable 占位）
   - 禁复刻应用 UI
   - 数据一致性（图表和=KPI、派生指标自洽）
   - 禁编类名/禁引外部库（版式类 skill 接管细则）
3. **行为契约**：先调 preflight 工具看数据覆盖 → 按 skill 决定章节 → 生成 → 自查清单
4. **输出格式**（HTML-only 或 tool-call-only 两种模式）

### 2.3 ② Skill 维度（程序性知识 —— 现在的 Guide 表升级）

把 Guide 表从"提示词片段库"升级为结构化 Skill：

```yaml
# Guide 表加 meta 字段（或新表 Skill）
name: dm-performance-deck
type: layout            # layout | chart | narrative | recipe
overridesVisual: true
applies_when: { businessLine: DM, scenario: performance-deck }
assets:                 # ← 关键新增：skill 可挂文件
  - sample: s3://…/DUOMAI_viagogo_deck.html      # 样张（few-shot）
  - palette: s3://…/tokens.css                   # 设计 token
  - checklist: s3://…/slide-selfcheck.md         # 生成后自查清单
prompt_body: |
  （现有指南正文——但骨架/组件/图表规范拆开，见下）
```

关键改造点：
- **样张即文件**：现在参考 deck 的 1:1 还原全靠 6.4K 文字描述。
  Skill 挂上真实 HTML 样张文件，生成时以 few-shot 注入或让 AI 按需 read——
  文字描述永远有歧义，像素级还原靠样张。
- **自查清单工具化**：指南里"组件完整铁律（生成后自查）"这类要求，
  从"请 AI 自觉"变成硬校验工具（见④）。
- **三层保留但职责重划**：L1 视觉 / L2 结构 / CONFLICT 裁决机制是好设计，保留；
  变化是每层内容变薄，细节迁去 assets 文件。

### 2.4 ③ 文件维度（事实与样张 —— 上下文工程）

| 文件类型 | 内容 | 注入方式 | 现状→目标 |
|---|---|---|---|
| campaign 数据 | metrics/trend/plans/coverage | 工具拉取，按需分页 | 现在全量塞 prompt → 目标 preflight 先看 coverage，只拉用到的维度 |
| 样张 HTML | 各版式标杆 | skill.assets 引用，按需读 | 现在没有 → few-shot 或 read 工具 |
| 设计 token | 色板/字号/间距 | skill.assets | 现在用文字描述色值 → token 文件直接被代码引用 |
| 历史报告 | 同 campaign 旧版本 | 检索工具 | 现在没有 → 增量编辑时天然有（DB） |

原则：**大而稳定的进文件，小而必须进提示词**。26K CORE 里 70% 是
Tailwind 配置示例、CSS 类模板——全部可外置为模板文件，AI 用 read_file 按需取。

### 2.5 ④ 工具维度（把"请自觉"变成"必经关卡"）

```
工具1  preflight(campaignId)      → 数据覆盖报告（coverage 已有！包成工具）
       返回：哪些维度有数据/缺失/第4页能否渲染 —— 生成前告知用户
工具2  read_skill_asset(path)     → 读样张/token/清单（skill 文件门面）
工具3  validate_html(html, skill) → 硬校验：slide 数 vs 指南声明、必含类名
       (pub-ratio/tier-pill)、禁用元素(nav/menu)、data-anchor 完整性
       —— 现在靠 AI"逐项核对"，改成代码正则/DOM 校验，不过关打回重生成
工具4  fetch_campaign_data(...)   → 分维度拉数据（替代 {{CAMPAIGN_DATA}} 全量灌注）
工具5  save_project(...)          → 落库（现在 controller 直写，纳入工具协议统一审计）
```

postProcessHtml() 的 200 行兜底逻辑原样保留，但从"service 内部函数"
升级为 Runtime 的固定后处理管道——这是已经验证有效的部分。

---

## 三、迁移路线（不动现网，增量演进）

**Phase 1（1天，纯收益）**：
- SYSTEM_PROMPT 里 Tailwind 配置/CSS 类模板/Chart.js 配置段抽成
  `recipe/assets/*.md` 文件，AI 经工具读取 → CORE 从 26K 降到 ~8K
- preflight 工具上线：deck 场景生成前返回"Slide 4 将整页省略：无 commissionPlans
  数据"——今日事故的直修
- validate_html 工具 MVP：slide 数量 + 必含类名两项硬校验

**Phase 2（2-3天）**：
- Guide 表加 assets 元数据；DM Performance Deck 挂上样张 HTML + 自查清单
- fetch_campaign_data 分维度拉取替代全量灌注
- 四入口（generate/stream/edit/editStream）统一走 Runtime 编排

**Phase 3（可选）**：
- recipe/ 确定性路径（hbs 模板）与 AI 路径共享 skill 文件——同一 token 源
- 历史报告检索工具，增量编辑跨版本一致性

---

## 四、一句话总结

现有三层提示词（CORE/指南/事实）+ 隐形第四层（postProcess 代码兜底）已经具备
Agent 的全部原料，问题是**知识、样张、数据、校验全部塞在提示词或单文件里**。
Agent 化 = 提示词瘦身成"角色+铁律+契约"，Guide 升级为可挂文件的 Skill，
数据与样张按需读取，自查与预检从"请 AI 自觉"变成硬工具关卡——
四维各司其职后，今日"第 4 页静默消失"这类问题会在生成前被告知、生成后被拦截。

---

## 五、v2 调整：指南维护反推的架构改动

> 引入《guide-maintenance-runbook.md》的维护需求后，架构从"指南是静态输入"
> 调整为"指南是带生命周期的一等实体"。以下为增量调整，第一至四节骨架不变。

### 5.1 调整总览（before → after）

```
v1（原报告）：                    v2（本节）：
Guide 表 ──拼接──→ prompt        Guide ─→ GuideRevision(不可变) ─→ Registry
                                  │            │
                                  │            ├─ assets(样张/token/checks)
                                  │            └─ active 指针(可回滚)
                                  └─ 生成时 pin 版本 → Project.meta
一次 LLM 调用 + 后处理             规划→生成→校验→修复 循环 + 遥测事件
改指南=改完即生效(危险)            改指南=新 Revision + 干跑校验 + 指针切换
```

### 5.2 六项具体调整

**① Guide Registry 取代裸表读取（版本化）**
- 数据模型三分：`Guide`(元数据) → `GuideRevision`(不可变正文+assets 快照+changelog) → `active_revision_id` 指针
- `resolvePairForCampaign` 改为经 Registry 取"active revision"，不再直读正文
- 回滚 = 指针切回旧 revision（runbook 2.4 的机制化落地）
- 生成时把 `guide_revision_id` 写进 `Project.meta` → 任何历史 HTML 可回答"当时用的哪版指南"

**② 编辑链路版本一致（pin 原版本）**
- `editHtml` 用生成时 pin 的那个 revision，不自动追 active——避免"生成后指南升级，编辑走样"
- "升级指南"成为显式动作：重新 pin + 可选整篇重生成，而非静默漂移

**③ 校验断言成为 revision 的一等公民（checks 段）**
- 指南里的"生成后自查清单"改写为机器可读断言：
  `checks: [{assert: "slide_count == 4"}, {assert: "has_class pub-ratio"}, {assert: "no_element nav,menu,sidebar"}]`
- 同一份 checks 双端消费：**保存时干跑**（对最近一次生成结果跑断言，维护者当场见错）+ **运行时硬关卡**（agent 循环内 validate → 失败带错误重生成 ≤2 次 → 仍失败转人工并标记）
- validate 结果落遥测，成为 revision 质量数据源

**④ 注入管线升级为带预算的 Context Assembler**
- mergeGuideLayers（L1/L2/CONFLICT 机制保留）+ checks + assets + campaign 数据统一装配
- token 预算管理：样张大 → 全量 few-shot 或降级为 read_skill_asset 按需读；30K 视觉层与 6K 结构层并存时自动提示 overridesVisual 疏漏
- assets 解析规则：token 文件→代码直引；样张→few-shot/工具二选一；checks→validate 工具

**⑤ Agent 循环显式化（五步）**
```
preflight(coverage,告知第4页会省略) → plan(选层/选revision/选assets)
→ generate → validate(checks) → fix循环 → save(写revision元数据+事件)
```
postProcessHtml 管道原样保留为确定性阶段，位置在 validate 之前。

**⑥ 遥测闭环与 A/B**
- GenerationEvent: {project, revisions, checks结果, 重试次数, 是否人工重生成}
- 指南效能看板（runbook 2.4/Phase 3 的"看数据改指南"）直接消费这些事件
- 同 campaign 可指定两个 revision 各生成一次做 A/B——改指南从赌博变实验

### 5.3 维护操作 → 架构钩子对照

| runbook 维护动作 | v2 架构支撑 |
|---|---|
| 改前存档/回滚 | Revision 不可变 + active 指针 |
| 改完必实测 | 保存时 checks 干跑（分钟级，不用真人盯生成） |
| 铁律3"先查数据" | preflight 工具在表单旁一键可跑 |
| changelog 手写 | Revision 自带版本号+时间+作者，changelog 降级为补充说明 |
| 谁改什么职责表 | Registry 权限：L0 走代码 commit，L1/L2 走后台+干跑门禁 |

### 5.4 修订后的迁移阶段

- **Phase 1（1-2 天）**：preflight 工具 + validate MVP（slide 数/必含类名）+ 生成记录 guide 版本（先记 id+时间戳，Revision 表可后补）
- **Phase 2（3-4 天）**：GuideRevision 表 + assets 挂载 + Context Assembler + 编辑 pin 原版本 + 保存干跑
- **Phase 3（按需）**：GenerationEvent 遥测 + 效能看板 + A/B + 自动 fix 循环调优

一句话：**指南维护的需求（版本/回滚/校验/度量）不是运维补丁，而是把 v1 架构里"Skill 维度"从静态知识升级为带生命周期管理的实体——这一升级同时解决了复现、编辑一致性、改指南安全和效果度量四个此前无解的问题。**
