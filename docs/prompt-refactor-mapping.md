# PPTGenerator 提示词资产重构映射表
## ——现有提示词组件 → 四维架构的逐段去向（第 5.5 节，配合架构报告）

日期：2026-09-03 ｜ 粒度：SYSTEM_PROMPT 22 个段落 + USER_PROMPT + EDIT 链逐一判定去向

---

## 6.1 判定规则（先立规矩，再逐段搬运）

| 现有组件类型 | 判定 | 去向 |
|---|---|---|
| 身份/角色一句话 | 留 | ① 提示词 |
| 不可协商铁律（伪造/UI/一致性） | 留（合并压缩） | ① 提示词 |
| 行为契约（先做什么后做什么） | 新写 | ① 提示词 |
| 技术栈/配置模板（Tailwind/CSS类/Chart.js） | 外置 | ③ 文件（assets） |
| 输出格式约束 | 留（收缩） | ① 提示词 |
| 业务线视觉/结构规则 | 已外置 | ② Skill（Guide 表，v2 加 Revision） |
| 像素级样张基准 | 缺失 | ③ 文件（样张挂 skill） |
| "生成后自查"文字 | 改写 | ④ 工具（checks 断言） |
| 数据事实（campaign JSON） | 已外置 | ④ 工具（preflight/fetch 分维度拉取） |
| 与单次任务绑定的变量 | 留 | ⑥ 用户提示词（唯一保留职责） |

---

## 6.2 SYSTEM_PROMPT（26,180 字符）22 段逐一去向

| # | 现段落 | 行数 | 判定 | 去向 | 备注 |
|---|---|---|---|---|---|
| 0 | 角色句（senior front-end engineer…） | 66 | **留** | ① 提示词·身份 | 原文保留 |
| 1 | 禁止伪造数据（铁律） | 68-71 | **留** | ① 提示词·铁律 | 全库唯一权威版本；EDIT prompt 里的 3 处重复删 |
| 2 | 输出规则（DOCTYPE 开头/fence） | 71 | **留** | ① 提示词·输出 | 收缩为 2 句 |
| 3 | 思考语言 | 73-74 | **移** | ⑥ 用户提示词末尾 | 代码里已有 THINKING_LANGUAGE_SUFFIX 在 user 末尾（recency 有效）——system 里的这段是双保险，删 system 版省 token |
| 4 | 品牌禁语（AI-Powered 等） | 76-85 | **留** | ① 提示词·铁律 | 客户侧红线 |
| 5 | 禁复刻应用 UI | 87-91 | **留** | ① 提示词·铁律 | 同上 |
| 6 | 数据保真规则 1-11（含 9b/9b2/9c） | 93-113 | **拆** | ①铁律(1,6,10,11) + ③文件(2-5,7-9 常量规则) + ④工具(9b/9b2/9c 有无→preflight 结果决定) | 条件渲染规则转成 checks 断言："有 contentShowcase 必有 showcase 区" |
| 7 | 设计系统总纲（读指南/默认中性主题） | 115-129 | **留** | ① 提示词·契约 | "指南存在必须遵循"是行为契约本体 |
| 8 | TECH STACK（CDN 清单） | 131-138 | **移** | ③ 文件 tech-stack.md | 版本升级改文件不动提示词 |
| 9 | TAILWIND CONFIG 模板 | 140-150 | **移** | ③ 文件 tailwind-template.md | `<EXACT hex>` 占位符由 Assembler 用 token 文件填充 |
| 10 | CSS CLASS SYSTEM 模板 | 152-164 | **移** | ③ 文件 css-classes.md | 同上 |
| 11 | RESPONSIVE LAYOUT | 166-170 | **移** | ③ 文件（并入 css-classes.md） | — |
| 12 | CHART.JS RULES（7 条） | 172-185 | **拆** | ①留(2 load包装/3 animation) + ③文件(4-6 配置) + ④工具(7 script 位置→postProcess 已兜底) | 规则 7 已由 postProcessHtml 强制，提示词里删 |
| 13 | REPORT STRUCTURE（默认结构+占位规则） | 186-231 | **拆** | ①留(占位铁律 1 句) + ②Skill(默认结构指南——首次给"无结构指南"的业务线兜底) + ④工具(module-coverage 决定 STANDARD 维度名单) | 这段本质是个"默认结构指南"，理应和 DM/DG 指南同层 |
| 14 | TABLE ALIGNMENT | 233-238 | **移** | ③ 文件 css-classes.md | — |
| 15 | LAYOUT PROHIBITIONS（nav/menu 零容忍） | 240-264 | **留+工具化** | ①提示词(1 句禁令) + ④工具(no_element 断言——硬校验) | "出现即拒绝"就该真的拒绝 |
| 16 | LANGUAGE RULES（英文 UI/数据原名） | 265-276 | **留** | ① 提示词·铁律 | 客户侧红线 |
| 17 | DATA ANCHOR ATTRIBUTES（data-field 规范） | 277-318 | **移** | ③ 文件 data-anchor-spec.md + ④工具(data-field 覆盖率断言) | 规范是文档不是行为；锚点完整性可校验 |
| 18 | CREATOR CONTRIBUTION NARRATIVE | 319-325 | **移** | ② Skill（结构指南的语调段） | 仅创作者类报告用，默认结构指南的叙事规范 |
| 19 | OUTPUT CONSTRAINT（14K token 上限） | 327-328 | **移** | ① 提示词·输出（1 句）或 API max_tokens 参数 | 参数化更可靠 |
| 20 | GUIDE_SYSTEM_SUFFIX（包装头+裁决声明） | 518-531 | **留** | ① 提示词·契约 | v2 由 Assembler 渲染 |
| 21 | BUSINESS_FACTS_SUFFIX | 534-538 | **留** | ① 提示词·事实 | 极小，保留 |

**净效果**：留 ①的约 8 段压缩后 ≈6-7K 字符（26K→~7K，-73%）；移 ③文件 5 段 ≈9K；转 ④工具断言 3 组；转 ②Skill 2 段。

## 6.3 USER_PROMPT_TEMPLATE（2,595 字符）——四维中定位最清晰

| 段 | 去向 | 说明 |
|---|---|---|
| USER INSTRUCTIONS {{PROMPT}} | **⑥ 用户提示词** | 用户提示词的唯一合法内容：任务级意图 |
| CAMPAIGN_DATA {{CAMPAIGN_DATA}} | **④ 工具** | 拆掉全量灌注 → preflight 后按维度拉取（fetch_campaign_data） |
| IMPORTANT 数据使用细则（505-511 那段） | **④ 工具+②Skill** | "logo 用哪 URL"→Assembler 注入事实；"表格列序"→结构指南已有；"只允许一张表"→checks 断言 |
| FOOTER 规则 | ① 事实段（已有 BUSINESS_FACTS_SUFFIX） | 去重 |

**原则**：用户提示词只剩"用户说了什么 + 本次任务绑定变量"。模板性指令全部上收。

## 6.4 EDIT 链路（EDIT_SYSTEM_PROMPT 5,057 + 模板 498）

| 段 | 去向 |
|---|---|
| 禁伪造（重复 3 遍）+ 数据一致性 + 脚本保留 | **删重复，引用 ①同一份铁律**（编辑模式追加 1 句差异：改哪改哪，未提及处 byte 级保留） |
| APPLICATION UI PROHIBITION（重复） | 同上，引用不重复 |
| REASONING LANGUAGE | 与生成链相同 → user 末尾 |
| CURRENT_HTML {{CURRENT_HTML}} | 留在用户提示词（任务绑定变量） |
| DATA_CONTEXT | ④ 工具（同生成链） |
| EDIT GUIDELINES 4 条 | ① 契约（收缩为行为差异说明） |

编辑与生成共享 ①③④ 的同一份资产，唯一差异 = 系统提示词的"行为模式"段（~500 字符）。

## 6.5 调整后全貌

```
① 系统提示词（~7K，版本化进 git）
   身份(1句) + 铁律×6(伪造/品牌/UI/语言/布局/一致性) + 契约(读指南/先preflight/后自查) + 输出(2句) + 事实(署名)
        │
② Skill（Guide Registry，v2 Revision 化）
   视觉层(isDefault) / 结构层(scenario) / 默认结构指南(原13段迁入) / checks 断言 / 语调叙事(原18段)
        │
③ 文件（skill assets，git 管理）
   tech-stack.md / tailwind-template.md / css-classes.md / data-anchor-spec.md / 样张.html / tokens.css
        │
④ 工具
   preflight → fetch_campaign_data → read_skill_asset → validate(checks) → save
        │
⑥ 用户提示词（唯一职责：任务意图）
   {{PROMPT}} + CURRENT_HTML（编辑时） + 思考语言后缀
```

## 6.6 迁移顺序（对应报告 Phase 1-2 的执行清单）

1. **先立 ③（零风险）**：把 8/9/10/11/14/17 段原样抄成 assets 文件，Assembler 开关切换（环境变量灰度），新旧注入逐字 diff 验证等价
2. **再拆 13/18 → ②**：默认结构指南作为第一条"系统内置 Skill"入库（标记 source=builtin），行为应与现状完全一致
3. **然后 ④ 的 checks MVP**：15 段禁令 + 占位规则改断言，validate 只报告不拦截（观察 1 周）
4. **最后收缩 ①**：上面 1-3 稳定后删 ① 里对应段落——每次删除跑冒烟（同一 campaign 生成对比）
5. EDIT 链去重随时可做（独立小 PR，改前存 prompt 对照快照到 docs/guides/history/）

**回滚保证**：每步都是"删提示词段 = 关对应 Assembler 开关"，单开关粒度可回退。
