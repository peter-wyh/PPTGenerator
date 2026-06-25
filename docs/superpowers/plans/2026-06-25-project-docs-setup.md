# 项目文档体系搭建 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 PPTGenerator 仓库根目录创建 `CLAUDE.md`，在 `docs/` 下创建 `PROJECT.md` 与 `CHANGELOG.md`，并写入跨会话生效的"会话末自动追加 changelog"工作流规则。

**Architecture:** 三个独立 markdown 文件，无代码逻辑、无测试框架。验证手段为文件结构 grep 校验 + git 状态校验。每个文件一个独立 commit。

**Tech Stack:** Markdown / Git / Bash。

**对应 spec：** `docs/superpowers/specs/2026-06-25-project-docs-setup-design.md`

---

## File Structure

| 路径 | 类型 | 职责 |
|---|---|---|
| `CLAUDE.md` | 新建 | Claude 工作流硬规则：项目一句话、文档入口、会话末追加 changelog 规则、写入格式 |
| `docs/PROJECT.md` | 新建 | 立项信息 5 字段（背景目标 / 范围 / 技术选型 / 当前状态 / 后续计划） |
| `docs/CHANGELOG.md` | 新建 | 按日期 + 中文分类的迭代记录，含 2026-06-25 初始条目 |

---

## Task 1: 创建 `CLAUDE.md`（工作流规则）

**Files:**
- Create: `CLAUDE.md`

- [ ] **Step 1: 写入 `CLAUDE.md` 完整内容**

使用 Write 工具创建 `CLAUDE.md`，内容如下（一字不差）：

```markdown
# MediaKit PPTGenerator — Claude 工作流规则

## 项目一句话

MediaKit — 广告投放报告编辑器：让营销/广告运营人员用拖拽方式把投放数据组装成可演示的复盘报告，替代手工 PPT。

## 文档入口

- `docs/PROJECT.md` — 立项信息（背景 / 范围 / 技术选型 / 当前状态 / 后续计划）
- `docs/CHANGELOG.md` — 按日期 + 中文分类的迭代记录
- `docs/superpowers/specs/` — 设计文档
- `docs/superpowers/plans/` — 实施计划

## 工作流硬规则

**每次会话即将结束时**，自检本次是否产生了任意以下变更：

- 新建/修改/删除代码或配置文件
- 修改 `demo.html`

若是，**必须**追加 `docs/CHANGELOG.md` 一条；若否（纯研究/对话），跳过。

**阶段变化**（里程碑达成、范围调整、技术栈变化、版本号推进）时，**必须**更新 `docs/PROJECT.md` 的"当前状态"和"后续计划"字段。

## Changelog 写入格式

- 顶层按日期分组：`## YYYY-MM-DD`（跨日新建，紧邻介绍段下方）
- 二级固定分类顺序：`### 新增` → `### 变更` → `### 修复` → `### 重构`
- 三级条目：一行简述 + 关键文件路径（`path/to/file:line` 格式）
- 同日多次变更合并到同一日期标题下

## 与 commit 的关系

`docs/CHANGELOG.md` 是 source of truth。推荐把 docs/ 变更与对应代码变更捆在同一 commit，但 commit message 不需要再重复 changelog 内容。
```

- [ ] **Step 2: 验证文件已写入**

运行：`test -f /Users/ap/Desktop/PPTGenerator/CLAUDE.md && wc -l /Users/ap/Desktop/PPTGenerator/CLAUDE.md`
预期：输出行数在 25–35 之间（含空行）。

运行：`grep -c "工作流硬规则\|Changelog 写入格式\|MediaKit" /Users/ap/Desktop/PPTGenerator/CLAUDE.md`
预期：输出 `3` 或更多（三个关键章节都存在）。

- [ ] **Step 3: 提交**

```bash
git -C /Users/ap/Desktop/PPTGenerator add CLAUDE.md
git -C /Users/ap/Desktop/PPTGenerator commit -m "$(cat <<'EOF'
docs: add CLAUDE.md with changelog auto-append workflow rule

Establishes cross-session rule: append docs/CHANGELOG.md at session end
whenever code/config/demo.html changes; update docs/PROJECT.md on
milestone-level state changes.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

预期：`[main <hash>] docs: add CLAUDE.md ...`，1 file changed。

---

## Task 2: 创建 `docs/PROJECT.md`（立项信息）

**Files:**
- Create: `docs/PROJECT.md`

- [ ] **Step 1: 确认 docs/ 目录存在**

运行：`ls -d /Users/ap/Desktop/PPTGenerator/docs/`
预期：目录已存在（被 specs/ 占用，无需新建）。

- [ ] **Step 2: 写入 `docs/PROJECT.md` 完整内容**

使用 Write 工具创建 `docs/PROJECT.md`，内容如下：

````markdown
# MediaKit PPTGenerator — 立项信息

> 最后更新：2026-06-25

## 项目背景与目标

广告投放/营销运营人员每个 campaign 结束后需要产出复盘报告，目前主流做法是用 PPT 手工拼装数据截图与图表，**耗时长、复用难、版本混乱**。

**MediaKit** 把这一场景产品化：业务方在浏览器里拖拽业务组件（Campaign 概览 / 达人名单 / 周报月报等）+ 绑定数据源，即可生成可演示、可导出的复盘报告。

**目标用户**：营销/广告运营人员、增长顾问、达人经纪团队。

**核心价值**：把"做一份复盘报告"的时间从小时级压缩到分钟级，且支持模板复用。

## 范围

### 已实现（v0.1 原型）

- 三栏布局：左侧页面列表 / 中间画布（1280×720）/ 右侧属性面板
- 顶部工具栏：撤销 / 重做 / 预览 / 导出（占位）
- 业务组件库（5 类）：团队组织架构、核心服务矩阵、Campaign 概览、达人名单、周报/月报
- 基础组件：文本、图片、柱状图、折线图、饼图、指标卡、表格
- 页面管理：增删页面、缩略图切换
- 选中 / 拖拽 / 缩放 / 多选 / 复制粘贴
- 数据源绑定（达人、CPS 计划、指标等）

### 未实现（占位 / 计划中）

- 导出（PPT / PDF）— 当前仅 toast 占位（`demo.html:2661`）
- 返回项目列表 — 当前仅 toast 占位（`demo.html:2602`）
- 持久化（无 localStorage / 后端）
- 多人协作

## 技术选型

| 维度 | 选择 | 原因 |
|---|---|---|
| 形态 | 单 HTML 文件（`demo.html`） | 原型阶段便于快速迭代与分享 |
| 构建 | 无构建系统 | 同上 |
| 框架 | 原生 HTML/CSS/JS | 无依赖、无打包 |
| 字体 | Google Fonts：Funnel Sans（标题）、Inter（正文）、IBM Plex Mono（数据） | 免费、商用可读性强 |
| 图标 | 内联 SVG | 无图标库依赖 |
| 主题 | CSS 设计 tokens（主色 `#FF5C00`） | 易于换肤 |
| 状态 | 全局 `state` 对象 + history 栈（撤销/重做） | 简单够用 |

## 当前状态

**v0.1 原型**（2026-06-25）

- `demo.html` 单文件约 3550 行
- 3 个示例页面（"美妆品牌Q4投放复盘"为默认项目名）
- 5 类业务组件可拖入画布并绑定数据
- 基础组件 7 种
- 撤销/重做、复制/粘贴、页面增删可用
- 无构建、无持久化、无版本号、无测试

## 后续计划

待用户补充。已知占位功能（从 `demo.html` 的 toast 提示反推）：

1. 导出 PPT / PDF（`demo.html:2661`）
2. 项目列表 / 多项目管理（`demo.html:2602`）
3. 持久化（localStorage 或后端）
4. 组件库扩展（更多业务组件变体）
5. 模板保存与复用
````

- [ ] **Step 3: 验证 5 个字段章节都存在**

运行：`grep -c "^## " /Users/ap/Desktop/PPTGenerator/docs/PROJECT.md`
预期：输出 `5`（项目背景与目标 / 范围 / 技术选型 / 当前状态 / 后续计划）。

运行：`grep -E "项目背景与目标|范围|技术选型|当前状态|后续计划" /Users/ap/Desktop/PPTGenerator/docs/PROJECT.md | head -5`
预期：列出 5 个章节标题。

- [ ] **Step 4: 提交**

```bash
git -C /Users/ap/Desktop/PPTGenerator add docs/PROJECT.md
git -C /Users/ap/Desktop/PPTGenerator commit -m "$(cat <<'EOF'
docs: add PROJECT.md with 5-field project initiation info

Backfilled from demo.html: background/goals, scope, tech stack,
current v0.1 state, and placeholder roadmap items.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

预期：`[main <hash>] docs: add PROJECT.md ...`，1 file changed。

---

## Task 3: 创建 `docs/CHANGELOG.md`（初始 changelog）

**Files:**
- Create: `docs/CHANGELOG.md`

- [ ] **Step 1: 写入 `docs/CHANGELOG.md` 完整内容**

使用 Write 工具创建 `docs/CHANGELOG.md`，内容如下：

````markdown
# Changelog

本项目所有显著变更会记录于此。

**格式**：日期 → 分类（新增 / 变更 / 修复 / 重构）→ 一行简述 + 关键文件路径。

**写入规则**详见根目录 `CLAUDE.md`。

---

## 2026-06-25

### 新增

- 初始化项目文档体系：`CLAUDE.md`（工作流规则）、`docs/PROJECT.md`（立项信息）、`docs/CHANGELOG.md`（本文件）
- 设计文档与实施计划：`docs/superpowers/specs/2026-06-25-project-docs-setup-design.md`、`docs/superpowers/plans/2026-06-25-project-docs-setup.md`

### 现状（回填，非本次代码变更）

- v0.1 原型：MediaKit 广告投放报告编辑器，单 HTML 文件（`demo.html`，3550 行）
- 实现核心三栏交互、5 类业务组件库、基础图表组件（7 种）、撤销/重做、页面增删
- 未实现：导出、返回项目列表（toast 占位，`demo.html:2602`、`demo.html:2661`）
````

- [ ] **Step 2: 验证 changelog 结构**

运行：`grep -c "^## 2026-06-25$" /Users/ap/Desktop/PPTGenerator/docs/CHANGELOG.md`
预期：输出 `1`（一个日期标题）。

运行：`grep -E "^### (新增|变更|修复|重构)" /Users/ap/Desktop/PPTGenerator/docs/CHANGELOG.md`
预期：至少列出 `### 新增` 和 `### 现状`（"现状"非标准分类但本次回填特例，后续会回归四分类）。

- [ ] **Step 3: 提交**

```bash
git -C /Users/ap/Desktop/PPTGenerator add docs/CHANGELOG.md
git -C /Users/ap/Desktop/PPTGenerator commit -m "$(cat <<'EOF'
docs: add CHANGELOG.md with initial 2026-06-25 entry

Records project docs scaffolding + backfilled v0.1 demo.html state.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

预期：`[main <hash>] docs: add CHANGELOG.md ...`，1 file changed。

---

## Task 4: 端到端验证

**Files:**
- 验证：`CLAUDE.md`、`docs/PROJECT.md`、`docs/CHANGELOG.md`

- [ ] **Step 1: 验证三个文件全部存在**

运行：
```bash
ls -la /Users/ap/Desktop/PPTGenerator/CLAUDE.md \
       /Users/ap/Desktop/PPTGenerator/docs/PROJECT.md \
       /Users/ap/Desktop/PPTGenerator/docs/CHANGELOG.md
```
预期：三行输出，无 "No such file" 错误。

- [ ] **Step 2: 验证 git 工作树干净**

运行：`git -C /Users/ap/Desktop/PPTGenerator status --short`
预期：无输出（工作树干净）。

- [ ] **Step 3: 验证最近 3 个 commit 都已入库**

运行：`git -C /Users/ap/Desktop/PPTGenerator log --oneline -5`
预期：最近 3 个 commit message 分别以 `docs: add CLAUDE.md`、`docs: add PROJECT.md`、`docs: add CHANGELOG.md` 开头。

- [ ] **Step 4: 验证跨文件引用一致**

运行：
```bash
grep -E "docs/PROJECT.md|docs/CHANGELOG.md" /Users/ap/Desktop/PPTGenerator/CLAUDE.md
grep -E "CLAUDE.md" /Users/ap/Desktop/PPTGenerator/docs/CHANGELOG.md
grep -E "demo.html:2602|demo.html:2661" /Users/ap/Desktop/PPTGenerator/docs/PROJECT.md
```
预期：
- 第一条：CLAUDE.md 引用了 PROJECT.md 和 CHANGELOG.md（各 1 行）
- 第二条：CHANGELOG.md 引用了 CLAUDE.md（≥1 行）
- 第三条：PROJECT.md 包含 `demo.html:2602` 和 `demo.html:2661` 两个行号引用

- [ ] **Step 5: 验证 CLAUDE.md 会被未来会话自动加载**

运行：`test -f /Users/ap/Desktop/PPTGenerator/CLAUDE.md && echo "OK"`
预期：输出 `OK`。

（说明：Claude Code 在每次会话启动时会自动读取项目根目录的 CLAUDE.md 并注入系统提示词，无需额外配置。）

---

## Self-Review

**Spec coverage check:**
- ✅ G1（立项信息文档）→ Task 2
- ✅ G2（changelog 文档）→ Task 3
- ✅ G3（工作流硬规则跨会话生效）→ Task 1 + Task 4 Step 5
- ✅ 文件结构（3 个文件）→ Task 1/2/3
- ✅ 5 字段立项信息 → Task 2 内容覆盖
- ✅ 日期 + 中文分类 changelog → Task 3 内容覆盖
- ✅ 会话末自检触发条件 → CLAUDE.md "工作流硬规则" 段
- ✅ 阶段变化触发 PROJECT.md 更新 → CLAUDE.md "工作流硬规则" 段
- ✅ 与 commit 关系 → CLAUDE.md 末段
- ✅ 验收标准 → Task 4 全部步骤

**Placeholder scan:** 无 TBD / TODO / "implement later"；所有步骤含完整 markdown 内容与具体 bash 命令。

**Type consistency:** 三个文件互相引用的路径一致（`docs/PROJECT.md`、`docs/CHANGELOG.md`、`CLAUDE.md`）；行号引用（`demo.html:2602`、`demo.html:2661`）已在 Task 2 与 Task 3 中保持一致。

**Ambiguity check:** 无歧义。每个 step 都有具体命令 + 预期输出。
