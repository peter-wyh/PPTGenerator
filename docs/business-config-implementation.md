# PPTGenerator 业务自定义差异化配置实现方案
## （第 9 节，配合 asset-ownership-matrix.md 第 8 节聚合根设计）

日期：2026-09-03 ｜ 现状基线：Guide 表已有 businessLineId/scenario/isDefault/overridesVisual/isActive，
匹配逻辑 pickPair() 已按 ID 精确选——**缺的是 Revision、assets、checks、toolParams 四块**。

---

## 9.1 目标一句话

业务运营在管理后台自助完成本业务线的全部差异化配置（指南正文、样张、色板 token、
校验断言、工具参数），全程无需工程介入，且改错可自愈（干跑校验+版本回滚）。

---

## 9.2 数据模型增量（Prisma，两个新模型 + Guide 加指针）

```prisma
model Guide {
  id             String   @id @default(cuid())
  businessLineId String
  scenario       String?
  name           String
  overridesVisual Boolean @default(false)
  isDefault      Boolean @default(false)
  isActive       Boolean @default(true)
  activeRevisionId String?           // ← 新增：指向当前生效版本
  activeRevision GuideRevision? @relation("activeRevision",
                   fields: [activeRevisionId], references: [id])
  revisions      GuideRevision[]      // ← 新增：全部历史版本
  createdAt      DateTime @default(now())
  @@index([businessLineId])
}

model GuideRevision {
  id          String   @id @default(cuid())
  guideId     String
  guide       Guide    @relation("activeRevision", fields: [guideId], references: [id])
  version     Int                      // 递增序号（guide 内唯一）
  content     String   @db.Text        // 指南正文（= skill 内容）
  assets      Json     @default("[]")  // [{kind, ref, hash, name}]
  checks      Json     @default("[]")  // [{assert, severity, message}]
  toolParams  Json     @default("{}")  // {max_tokens?, retries?, disabled_tools?}
  changelog   String?                  // 可选人工说明
  createdBy   String
  createdAt   DateTime @default(now())
  @@unique([guideId, version])
}

model GuideAsset {                     // 文件本体（不可变存储，revision 存引用）
  id          String @id @default(cuid())
  businessLineId String
  kind        String                 // sample | tokens | checklist
  name        String
  storageKey  String                 // 本地盘或 OSS key（现成 OSS 基建可复用）
  hash        String
  createdAt   DateTime @default(now())
}
```

要点：正文/assets/checks/params **同一 Revision 快照**——聚合根"四个一致"的落点；
GuideAsset 不可变（只增不改），改文件=传新文件换 hash。

---

## 9.3 后端 API 增量（挂现有 /api/v1/guides 下）

| 端点 | 作用 | 权限 |
|---|---|---|
| POST /guides/:id/revisions | 保存新版本（自动 version+1，不动 active 指针） | 业务运营 |
| POST /guides/:id/revisions/:rid/activate | 切换生效指针（可指回旧版本=回滚） | 业务运营 |
| GET /guides/:id/revisions | 版本列表（diff 预览用） | 业务运营 |
| POST /guides/:id/revisions/dry-run | **干跑校验**：对最近一次生成结果跑该 revision 的 checks | 业务运营 |
| POST /guides/:id/assets | 上传样张/token（走现有 OSS 上传通道） | 业务运营 |
| GET /guides/:id/assets/:aid | 读取 asset 内容（供 read_skill_asset 工具） | 系统 |

生成链路唯一改动点：`pickPair()` 返回结构加 revision（guide.service.ts ~15 行），
Assembler/validate 消费 revision.assets / revision.checks。

---

## 9.4 前端管理页增量（GuidePage.tsx 现有 208 行基础上）

```
指南页（现有列表+表单）扩展为三标签：
├─ 正文（现有 textarea → 加分节预览）
├─ 样张 & Token（新）
│    · 上传入口（拖拽 html/css/json）
│    · 资产列表：kind 徽章 + hash 前 8 位 + 预览/下载
│    · token 文件提供"键值表格"视图（业务填色值不用懂 css）
└─ 校验 & 参数（新）
     · checks 表格编辑器：断言下拉模板 + 参数 + 严重度
       （模板如 slide_count==N / has_class X / no_element X / contains_text X）
     · toolParams 表单：max_tokens、重试次数、禁用工具多选
     · 【干跑校验】按钮 → 显示对最近一次生成的断言结果（红绿逐条）
版本历史侧栏：版本号/时间/作者/changelog → 预览 diff → 【设为生效】【回滚到此版】
```

断言模板下拉是关键——业务从"写规则"降级为"选规则填参数"，把 DSL 门槛降到零。

---

## 9.5 运行时消费（生成链路四个接入点）

1. **Assembler**：pickPair 带 revision → 正文进 L1/L2 分层注入（现状不变）；
   assets.tokens 填充共享模板占位符；样张小(≤8K)→few-shot 注入，大→read_skill_asset 注册
2. **validate 工具**：生成后装载 revision.checks 逐条断言（首版只报告不拦截）；
   severity=block 的失败进入 fix 循环（重生成≤toolParams.retries 次）
3. **save**：Project.meta 记 guideRevisionId → 历史可复现
4. **preflight**：campaignId → coverage 报告在管理页/生成页展示（第 4 页省略类问题生成前告知）

---

## 9.6 权限与安全边界（业务能碰什么）

| 能（业务运营） | 不能 |
|---|---|
| 指南正文增改（新 Revision） | 工具代码/校验器实现 |
| 上传本业务线 assets（服务端校验：html≤200K、css/json≤50K、注入扫描 script/iframe） | 改共享模板本体 |
| 编辑本业务线 checks/toolParams（下拉模板内取值） | 跨业务线读写 |
| 切换/回滚本指南 active 指针 | 改 CONFLICT RULE/postProcess 管道 |
| 干跑校验 | 直接改 DB |

assets 服务端消毒必须做：样张 HTML 会进 prompt（few-shot）甚至被浏览器预览——
剥 <script>/事件属性/外链，只保留样式与结构（sha256 记录消毒前后 hash）。

---

## 9.7 实施切片（每片独立可上线、可回滚）

| 切片 | 内容 | 工作量 | 效果 |
|---|---|---|---|
| S1 | GuideRevision 表 + 保存/激活/列表 API + 版本侧栏 | 1 天 | 改指南有版本可回滚（runbook 2.4 机制化） |
| S2 | checks JSON + validate MVP（4 类断言模板）+ 干跑按钮 | 1 天 | 保存时知对错；运行时报告 |
| S3 | GuideAsset 表 + OSS 上传 + token 占位符填充 | 1 天 | 色板/样张自助化 |
| S4 | toolParams + severity=block 的 fix 循环 | 0.5 天 | 断言开始拦截 |
| S5 | 权限矩阵 + assets 消毒 | 0.5 天 | 开放给业务运营的安全前提 |

S1+S2 合计 2 天即达到"业务自助改指南不翻车"的最小闭环；S3 起解决像素级还原；
全部 5 片 4 天内。风险最高的是 S5（安全），建议 S1 上线前先做 assets 消毒函数。

---

## 9.8 验收剧本（业务视角端到端）

1. 业务运营在后台给 DG 传经典样张 + 填 token 键值表
2. 正文改一处章节规则 → 存为新版本 v4 → 点干跑：看到 1 条断言红（少 pub-ratio）
3. 修正 checks（该场景豁免此类名）→ 干跑全绿 → 激活 v4
4. 生成一次：4 章结构对齐样张；Project.meta 记 v4
5. 发现不对 → 版本侧栏回滚 v3 → 一键再生成 → 恢复
全程无工程介入——这就是"业务自定义配置差异化"的完成态。
