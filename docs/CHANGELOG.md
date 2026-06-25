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
