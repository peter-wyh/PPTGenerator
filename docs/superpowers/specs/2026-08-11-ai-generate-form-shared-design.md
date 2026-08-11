# 生成 HTML 报告弹窗表单与沉浸式页面对齐 — 设计

- **日期**: 2026-08-11
- **状态**: 设计已确认,待评审 → 转 writing-plans
- **范围**: 前端 —— 抽取共享 AI 生成表单组件,让 `HtmlStudio`(沉浸式页)与 `GenerateHtmlReportOverlay`(弹窗)复用同一份表单(含用户提示词 + 系统提示词等)

## 背景

「⚡ 生成 HTML 报告」弹窗(`GenerateHtmlReportOverlay`)和 AI 生成沉浸式页(`HtmlStudio`)是两个入口,但 AI 模式表单**各写一份、已 drift**:

| 字段 | HtmlStudio(页) | 弹窗 |
|---|---|---|
| 生成方式 tabs | ✅ | ✅ |
| 提示词模板 | 下拉 + 描述 | 报告主题 pill 按钮 |
| 提示词 | 单 textarea、rows=10、⛶全屏 | 拆成「🎨 设计规范 + 📝 内容要求」两个 textarea |
| design.md 折叠编辑 | ✅ | ✅ |
| **系统提示词** | ✅(折叠、MarkdownPreview、⛶全屏、追加 design.md) | ❌ **缺失** |

后果:弹窗看不到/不能查看系统提示词;两处提示词模型不同(弹窗提交时 `prompt = ${designSpec}\n\n${内容要求}`);新增字段要改两遍。用户要弹窗表单与页面**保持一致**(含系统提示词)。

## 目标 / 非目标

**目标**: 抽取共享组件 `<AiGenerateForm>`,HtmlStudio 与弹窗共用同一份 AI 模式输入表单(含用户提示词 + 系统提示词 + 全屏 + 模板下拉 + design.md)。单一源头,以后不再 drift。

**非目标**:
- 不改后端、不改 `htmlTemplatesApi` 契约。
- 不抽 recipe 模式 UI(`DataPanel` 自带,与 AI 表单无关)。
- 不抽生成结果/预览/保存流程(组件只负责输入 + 触发 `onGenerate`;预览、另存为、chat 阶段等仍由各调用方自理)。
- 不改 `reportPeriod` 流向(它不是表单输入,由各调用方从 `project.meta`/props 注入到 generate 调用)。

## 组件设计

**文件**: 新建 `apps/web/src/editor/components/AiGenerateForm.tsx`

**Props 契约**:
```ts
interface AiGenerateFormProps {
  campaignId?: string;
  onGenerate: (vals: { mode: 'ai' | 'recipe'; prompt: string; designMd: string }) => void;
  generating?: boolean;        // 生成中 → 按钮_loading / 禁用
  generateLabel?: string;      // 默认「✨ 生成报告」
}
```

**组件内部自管理 state**(从两处现有逻辑合并、去重):
- `mode`('ai' | 'recipe',默认 'ai')
- `prompt`(string)、`selectedPresetIdx`、`presets`(`getPresetsForBL(blCode)` 算)
- `designMd` / `designMdSource` / `blCode`(由 `htmlTemplatesApi.getDesignGuide(campaignId)` 加载)、`designMdExpanded`
- `systemPrompt`(由 `htmlTemplatesApi.getSystemPrompt()` 加载)、`showSystemPrompt`
- `promptFullscreen`、`systemPromptFullscreen`
- BL 确定后自动填第一个预设的 `requirement` 到 `prompt`(沿用现 effect)。

**渲染**(AI 模式,顺序与 HtmlStudio 现状一致):
1. 生成方式 tabs(AI / Recipe)
2. 提示词模板 `<select>` 下拉 + 选中预设 description
3. 提示词 textarea(rows=10、`spellCheck=false`、⛶全屏按钮)+ design.md 已注入 badge
4. design.md 折叠编辑(`campaignId && designMd.trim()` 时)
5. **系统提示词折叠**(点击加载 `getSystemPrompt` → `MarkdownPreview` + 追加 design.md `<pre>` + ⛶全屏)
6. 未绑定 Campaign 警告(`!campaignId` 时)
7. Recipe 模式:信息块(同现状)
8. 生成按钮 → `onGenerate({ mode, prompt: mode==='ai' ? prompt : '', designMd })`

**全屏浮层**:`promptFullscreen` / `systemPromptFullscreen` 为真时渲染覆盖层(Esc 关闭),沿用 HtmlStudio 现有键盘/Esc 处理。

**依赖**(沿用现有,不新增):`htmlTemplatesApi`、`getPresetsForBL`、`MarkdownPreview`、`Button`、`BUSINESS_LINES`(若需)。

## 集成

### `apps/web/src/routes/HtmlStudio.tsx`
- 删除内联 AI 表单 JSX(约 line 387–554 的 mode tabs / 提示词模板 / 提示词 / design.md / 系统提示词区块)及其相关 state(`prompt`、`selectedPresetIdx`、`presets`、`designMd`、`designMdSource`、`blCode`、`systemPrompt`、`showSystemPrompt`、各 `*Fullscreen`/`*Expanded`、BL/preset/systemPrompt 加载 effect)。
- 替换为:
  ```tsx
  <AiGenerateForm
    campaignId={campaignId}
    generating={generating}
    onGenerate={({ mode, prompt, designMd }) => handleGenerate(mode, prompt, designMd)}
  />
  ```
- `handleGenerate` 改签名 `(mode, prompt, designMd) => ...`,body 沿用现有(组 `htmlTemplatesApi.generate({ mode, prompt: mode==='ai'?prompt:undefined, campaignId, designMd: mode==='ai'&&designMd.trim()?designMd.trim():undefined, reportPeriod })` → setGeneratedHtml → autoSave → 切 chat 阶段)。`reportPeriod` 仍从 `project.meta.reportPeriod` 取。
- 删除被移除 state 的所有引用(顶部 `useState`、`useEffect`、`useCallback` 依赖数组)。

### `apps/web/src/editor/components/GenerateHtmlReportOverlay.tsx`
- 删除左侧面板 AI 表单(mode tabs / 报告主题 pills / 🎨 设计规范 / 📝 内容要求 / design.md 折叠)及相关 state(`mode`、`prompt`、`designSpec`、`designMd`、`designMdSource`、`blCode`、`presets`、`selectedPresetIdx`、`designMdExpanded`)与 design-guide/blCode/preset 加载 effect。
- **删除 `designSpec`**(单 prompt 模型;不再 `${designSpec}\n\n${prompt}` 拼接)。
- 替换为 `<AiGenerateForm campaignId={campaignId} generating={loading && !generatedHtml} onGenerate={handleGenerate} />`。
- `handleGenerate` 改为收 `({mode, prompt, designMd})` → `htmlTemplatesApi.generate({ mode, prompt: mode==='ai'?prompt:undefined, campaignId, designMd: mode==='ai'&&designMd.trim()?designMd.trim():undefined, reportPeriod })`(沿用 `reportPeriod` prop)→ setGeneratedHtml。其余(预览/复制/下载/保存)不动。

## 数据模型变更
- 弹窗**移除 `designSpec` 字段**,提示词由「🎨 设计规范 + 📝 内容要求」合并为**单个提示词框**(与页面一致)。原先 `designSpec` 的内容无独立保留(用户若需设计指令,直接写在提示词里;design.md 仍自动注入)。

## 文件改动
| 文件 | 动作 |
|---|--- |
| `apps/web/src/editor/components/AiGenerateForm.tsx` | **新建** —— 共享 AI 生成表单组件 |
| `apps/web/src/routes/HtmlStudio.tsx` | 删内联表单 + 相关 state/effect,替换为 `<AiGenerateForm>` |
| `apps/web/src/editor/components/GenerateHtmlReportOverlay.tsx` | 删内联表单 + designSpec,替换为 `<AiGenerateForm>` |
| `apps/web/src/editor/components/AiGenerateForm.test.tsx` | **新建** —— 组件单测 |

(纯前端;无 server 改动。)

## 测试
- **`AiGenerateForm.test.tsx`(新)**:渲染 → 含「生成方式/提示词模板/提示词/系统提示词」;点击「系统提示词」触发 `getSystemPrompt`(mock);填提示词 + 点生成按钮 → `onGenerate` 被调用,`mode/prompt` 正确;recipe 模式切换渲染信息块。Mock `htmlTemplatesApi.getDesignGuide`/`getSystemPrompt` + `getPresetsForBL`。
- **web tsc**(CI gate):exit 0。
- **回归**:HtmlStudio 删表单后仍编译通过(无 dangling state 引用);弹窗同理。仓库更广 web 套件有与本次无关的预存失败,不属本范围;本计划只对这两个消费者 + 新组件负责。

## 决策记录
- **共享组件(非复制)**:用户认可(`可以共享组件的话也 OK`)。两处 AI 表单合一,单一源头,杜绝再 drift。
- **单 prompt 模型**:弹窗放弃 `designSpec`/内容要求双框,与页面统一(用户选「完全对齐」)。
- **生成按钮在组件内、`onGenerate` 委托**:组件封装输入 + 触发,调用方自理 API 调用/结果/保存。组件边界 = "AI 生成输入表单",单一职责。
- **`reportPeriod` 不进组件**:非输入字段,各调用方注入。

## 风险
- ⚠️ **重构 HtmlStudio(880 行)有行为回归风险**。缓解:JSX 逐字搬迁(不重写逻辑)、删除所有 dangling state 引用、web tsc + 手动冒烟(页面:生成→即生即存→chat;弹窗:生成→预览→保存)。
- ⚠️ 弹窗删 `designSpec` 是**可见行为变化**(原有「设计规范」框消失)。已在目标声明,用户确认「完全对齐」接受。
