# Campaign 列表 Stats 列 — 设计

## 背景
`/data-management` 的 Campaign 列表(`DataManagement.tsx` → `CampaignList`)当前只展示
name / advertiser / businessLine / platform / period / budget / status / owner / actions,
没有任何业绩指标。而每个 Campaign 已**持久化**了 `metrics: CampaignMetric[]`
(`{ label, value, compare }`,服务端 Zod 校验,存于 `DataRecord.data` JSON);
seed 数据经 `rollupCampaignMetrics` 写入 9 项指标(GMV / Commission / ROAS / Clicks /
Conversions / CVR / AOV / Spend / Impressions)。本次把这些持久化指标显示到列表。

## 目标
在 Campaign 列表加一列 **Stats**,让人一眼看到每个 campaign 的核心业绩指标。

## 范围(只动前端)
- 改动文件:`apps/web/src/routes/DataManagement.tsx`(单组件)。
- 不动后端、不动持久化、不动类型、不动 `metrics` 数据来源。

## 设计

### 1. 列结构
表头在 `Budget` 与 `Status` 之间插入 `Stats`:
`ID | Campaign | Advertiser | Business Line | Platform | Period | Budget | Stats | Status | Owner |`
共 11 列(实现时发现工作树已有未提交的 `ID` 列,故 10→11)。`<table>` `min-w` 从 `760px` 提到 `920px`。

### 2. 单元格内容
- 新增纯函数 `pickCampaignStats(metrics?: CampaignMetric[]): CampaignMetric[]`
  返回至多 3 个指标。
  - 优先级 label 顺序:`GMV → ROAS → Spend`(命中即取)。
  - 不足 3 项时,用 `metrics[]` 中剩余项(按原顺序)补齐至 3。
  - 优先级项都不存在时,退化为 `metrics[]` 前 3 项。
  - `metrics` 缺失/为空 → 返回 `[]`。
- 渲染(两行,紧凑):
  - 第一行:首项 `label value`,`text-foreground-secondary font-medium`。
  - 第二行:其余项 `label value` 用 ` · ` 连接,`text-foreground-muted`。
  - 只显示 `value`,不带 `compare`(列宽有限;compare 着色逻辑已在 ImportCampaignModal)。
  - 空数组 → 单个 `—`(`text-foreground-muted`),与现有 status 空值一致。

### 3. 取数
不改 `useDataRecords` / `dataApi.list`。`metrics` 已在 `r.data.metrics`。

## 测试
- 扩展 / 新增 `DataManagement` vitest。按 web chart 测试约定断言 shell 文本:
  - 有 metrics 的 campaign 行:出现其 GMV / ROAS / Spend 文本。
  - 无 metrics 的 campaign 行:出现 `—`(在 Stats 列位置)。
  - 优先级:metrics 含 GMV/ROAS/Spend 时只显示这三项(不被前 3 项覆盖)。
- 从 `apps/web` 绝对路径 binary 跑 `vitest` + `tsc`。

## 非目标(YAGNI)
- 不加 expandable 行、不加 compare 着色、不新增 metrics、不动 seed 逻辑。
