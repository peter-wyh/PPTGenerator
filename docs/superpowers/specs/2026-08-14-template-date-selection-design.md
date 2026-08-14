# 从模板新建报告 — 日期选择优化设计

- **日期**: 2026-08-14
- **状态**: Draft（待 review）
- **范围**: `apps/web`（`CreateFromTemplateDialog`）+ 可选 `apps/server` 硬化
- **选定方案**: A — 配置区间引导 + 共享 `<PeriodPicker>`

---

## 1. 背景与问题

「从模板新建报告」对话框（`apps/web/src/components/CreateFromTemplateDialog.tsx`）在选中 ai-html / HTML 报告模板（且绑定了 campaign）时，要求用户选起止日期。当前实现是两个原生 `<input type="date">`，**主诉问题：用户不知道选什么范围才算「对」**——模板自带 period 经常为空，Campaign 的投放区间/数据范围没有任何提示，用户只能盲选。

顺带存在的缺陷（非主诉但本次覆盖）：无快捷预设；无校验（结束<开始 / 留空 / 越界都能提交成功）；同一套日期输入在 4 处重复实现、无共享组件。

## 2. 目标 / 非目标

**目标**
- 选中 ai-html 模板时，标出该 Campaign 的有效投放区间
- 自动给一个合理默认（模板 period 合法则优先，否则区间内最近 30 天）
- 提供快捷预设（本月 / 上月 / 最近 7 天 / 最近 30 天 / 全部），自动夹到有效窗口内
- 提交前校验（非空、起≤止、不超窗），行内反馈，阻断非法提交
- 顺手抽出可复用的 `<PeriodPicker>` 组件 + 纯函数模块

**非目标（明确不做）**
- 迁移 `DuplicateProjectDialog` / `CreateProjectDialog` / `ReportSettingsOverlay` / `DataPanel` 到新组件（它们带 `month↔range` 分支，phase 2 统一）
- 真实数据区间（min/max of CpsDaily）—— 方案 B，以后换数据源即可接入，组件不动
- 换日历控件 —— 继续原生 `<input type="date">`
- 服务端 ISO 格式正则 —— 可选硬化，可延后

## 3. 现状（关键事实）

- 日期 UI gate：`CreateFromTemplateDialog.tsx:229-230`，仅 `(styleType==='ai-html' || renderType==='html-report') && campaignId` 时渲染
- 日期输入：`:231-253`，两个原生 `<input type=date>`；`:66-72` 从 `template.meta.reportPeriod` 预填（常为空）
- 提交：`:79-89` → `POST /api/v1/projects/from-template { templateId, name, reportPeriod:{startDate,endDate} }`，请求体形状固定
- 服务端：`projects.routes.ts:20` 路由无 Zod；`reportPeriodSchema`（`projects.schema.ts:463-467`）仅 `.max()` 长度校验
- Campaign 模型：`prisma/schema.prisma:203-246` 有 `startDate` / `endDate`（String `YYYY-MM-DD`，非空），经 `GET /api/v1/campaigns/:id` 暴露，web 端已有 `getCampaign(id)`（`apps/web/src/api/campaigns.ts:25-38`）
- 真实数据 span：**不存在查询列**（daily 是 `CpsPerformance.daily` 的 JSON 数组），**无端点**计算 min/max，获取成本 ≈ 报告渲染的 `mapCampaign` —— 昂贵，故本 spec 用「配置区间」而非「真数据区间」

## 4. 方案选择

| 方案 | 范围来源 | 成本 | 取舍 |
|---|---|---|---|
| **A 配置区间 + 共享组件（选定）** | `Campaign.startDate/endDate` | 一次 GET，无 schema 改动 | 立即满足全部三诉求；标的是「投放区间」非「真数据区间」 |
| B 真实数据区间 | 新端点算 daily min/max | 一次 mapCampaign 级查询 | 最贴原话，但选模板即触发重查询，需 loading |
| C 仅默认+预设+校验 | 无 | 零服务端 | 最快，但不解决「不知道选啥」主诉 |

**选 A**：代价小、覆盖三诉求、顺手去重；B 的真数据区间可作为后续增强**无缝挂到 A 的 `<PeriodPicker>`**——接口是 `minDate/maxDate`，换 fetch 即可，组件不动。

## 5. 设计

### 5.1 纯函数模块 `apps/web/src/components/period-picker/periodRange.ts`

无 DOM，vitest 单测。导出：
- `PRESETS`：本月 / 上月 / 最近 7 天 / 最近 30 天 / 全部
- `resolvePreset(preset, min, max)`：按**今天**算出预设目标区间（`本月`=本月历月、`上月`=上月历月、`最近7天`=`[今天-6,今天]`、`最近30天`=`[今天-29,今天]`、`全部`=`[min,max]`）→ 再与 `[min,max]` 求交；空交集返回 `null`（→ 该预设禁用）。预设一律相对今天，不相对 Campaign.max。
- `computeDefaultPeriod(min, max)`：`[max-29, max] ∩ 窗口`；窗口 <30 天退化为全窗口
- `validatePeriod(v, {min,max,required}) → {ok, error}`：空+required / 起>止 / 越下界 / 越上界(含未来) / 合法
- `clampPeriod(v, min, max)`

**约束**：`max` 由调用方夹今天后传入（`min(endDate, today)`），模块内不碰 `Date`，保持纯函数易测。

### 5.2 组件 `apps/web/src/components/period-picker/PeriodPicker.tsx`

纯受控 + 自校验，不感知 Campaign 为何物。

```tsx
type Props = {
  value: { startDate: string; endDate: string }; // '' = 空
  onChange: (v: { startDate: string; endDate: string }) => void;
  minDate?: string; maxDate?: string;            // 有效窗口；缺省=无边界(降级)
  required?: boolean;
  presets?: Preset[];                             // 默认 PRESETS
  onValidityChange?: (ok: boolean) => void;       // 回传合法性，供调用方 gate 提交
};
```

渲染：
```
投放区间 {min} ~ {max}                   ← 有 min/max 时显示(灰字)；无则不渲染
[本月][上月][最近7天][最近30天][全部]      ← resolvePreset 返回 null 的禁用
[起始日期 ▢]  [结束日期 ▢]                ← 原生 <input type=date>，带 min/max 属性
⚠ <行内错误>                             ← validatePeriod.error
```

**职责边界**：组件**不替调用方算默认**（默认值由调用方用 `computeDefaultPeriod` 算好塞进 `value`）；组件只做渲染 + 预设点击夹交 + 校验反馈。范围来源是 prop，故方案 B 以后换数据源组件不动。

### 5.3 接入 `CreateFromTemplateDialog`

触发条件不变（仅 ai-html + campaignId 分支，现有 gate 不动）。选中模板卡片时：
1. `getCampaign(campaignId)` → `campaign.startDate / endDate`
2. 窗口：`min = startDate`，`max = min(endDate, 今天)`
3. 初始值：`template.reportPeriod` 合法（非空 / 起≤止 / 在窗内）→ 用它；否则 `computeDefaultPeriod(min, max)`
4. `<PeriodPicker value onChange minDate maxDate required onValidityChange />`

**状态改造**：合并现有两个 `startDate/endDate` state → 单个 `period` 对象；新增 `range {min,max} | null`、`rangeLoading`、`periodValid`。提交按钮启用 = `有选中 && !loading && (有日期UI ? periodValid : true)`。

**降级（关键）**：`getCampaign` 失败/超时 → `range=null`，PeriodPicker 不显示区间提示、不做越界校验，但保留**起≤止 + 非空**校验和默认值。退化成「比今天更好、但不比今天差」，记日志不阻断。模板自带 period 越界 → 忽略它走默认（避免一打开就是红字）。

**提交**：日期 UI 显示且 `validatePeriod` 不过 → 不调 `onSubmit`（错误已由 PeriodPicker 行内显示）；过则照旧 `POST /projects/from-template { templateId, name, reportPeriod:{startDate,endDate} }`，**请求体形状不变，服务端零改动**。

### 5.4 服务端（可选硬化）

`/from-template` 现为裸 `req.body` 手 cast。建议加 `fromTemplateSchema = { templateId: z.string(), name: z.string(), reportPeriod: reportPeriodSchema.optional() }` 挂 `validate({ body })`，与 `/duplicate`（`duplicateSchema`）对齐。**UX 修复不依赖它**，纯防御性，可做可不做。

## 6. 测试

| 层 | 覆盖 |
|---|---|
| `periodRange.ts` 单测（无 DOM） | `computeDefaultPeriod`（窗口>30天 / <30天退化为全窗 / max 夹今天）、`resolvePreset`（在窗内 / 部分越界夹交 / 全越界返回 null）、`validatePeriod`（空+required / 起>止 / 越下界 / 越上界含未来 / 合法） |
| `<PeriodPicker>` 组件 | 有 min/max 时渲染区间提示；点预设→`onChange` 收到夹交后区间；非法时行内报错 + `onValidityChange(false)`；无 min/max 时降级不显示区间提示 |
| `CreateFromTemplateDialog` 集成 | ai-html+campaign 选中 → 拉 Campaign(mock) + 显示区间 + 预填默认；非法时禁用提交 / 合法时启用；非 ai-html 模板无日期 UI 可提交；`getCampaign` 失败 → 降级仍可提交 |

## 7. 范围边界

**本 spec 内**：5.1 纯函数 + 单测、5.2 组件 + 测试、5.3 接入、5.4 可选服务端校验。

**明确延后**：迁移其余 4 处日期输入到 `<PeriodPicker>`（phase 2）；真实数据区间（方案 B）；换日历控件；服务端 ISO 格式正则。

## 8. 风险

- **配置区间 ≠ 真数据区间**：Campaign 配置 6/1~8/31 但数据只到 8/13 时，用户仍可选 8/14~8/31 得到空报告。本 spec 接受此残留（主诉是「不知道选啥」，配置区间已大幅改善）；方案 B 是根治路径，组件接口已预留。
- **`getCampaign` 延迟**：单次 GET，用 `rangeLoading` 占位；失败走降级不阻断创建。
