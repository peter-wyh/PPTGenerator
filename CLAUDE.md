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
