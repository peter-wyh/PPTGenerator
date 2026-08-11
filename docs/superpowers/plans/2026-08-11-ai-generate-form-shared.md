# AI 生成表单共享组件(弹窗 ↔ 沉浸式页)实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 抽取共享 `<AiGenerateForm>`,让 `HtmlStudio`(沉浸式页)与 `GenerateHtmlReportOverlay`(弹窗)复用同一份 AI 模式输入表单(含用户提示词 + 系统提示词),消除 drift。

**Architecture:** 新组件 `AiGenerateForm` 接收 `campaignId/onGenerate/generating/generateLabel/error`,内部自管理表单 state(mode/prompt/presets/designMd/systemPrompt 等)并加载 `getDesignGuide`+`getSystemPrompt`;两个消费者删除各自内联表单,替换为该组件,各自保留 generate 结果/预览/保存流程。弹窗放弃 `designSpec`,采用单 prompt 模型。

**Tech Stack:** React + TypeScript + Vite + Vitest + @testing-library/react。

**Spec:** `docs/superpowers/specs/2026-08-11-ai-generate-form-shared-design.md`

---

## File Structure

| 文件 | 职责 | 动作 |
|---|---|---|
| `apps/web/src/editor/components/AiGenerateForm.tsx` | 共享 AI 生成输入表单(mode/模板/提示词+全屏/系统提示词+全屏/design.md/生成按钮) | **新建** |
| `apps/web/src/editor/components/AiGenerateForm.test.tsx` | 组件单测 | **新建** |
| `apps/web/src/editor/components/GenerateHtmlReportOverlay.tsx` | 弹窗消费者 | 改(删内联表单+designSpec,替换为组件) |
| `apps/web/src/routes/HtmlStudio.tsx` | 沉浸式页消费者 | 改(删内联表单+相关 state/effect,替换为组件) |

---

## Task 1: 新建 `AiGenerateForm` 组件 + 单测(TDD)

**Files:**
- Create: `apps/web/src/editor/components/AiGenerateForm.tsx`
- Test: `apps/web/src/editor/components/AiGenerateForm.test.tsx`

- [ ] **Step 1: 写失败测试** —— 新建 `AiGenerateForm.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AiGenerateForm } from './AiGenerateForm';

vi.mock('@/api/htmlTemplates', () => ({
  htmlTemplatesApi: {
    getDesignGuide: vi.fn().mockResolvedValue({
      designMd: '# brand guide',
      businessLineName: 'WANDER',
      businessLineCode: 'WD',
    }),
    getSystemPrompt: vi.fn().mockResolvedValue('# SYSTEM_PROMPT\nUse exact data.'),
  },
}));
vi.mock('@/report-presets', () => ({
  getPresetsForBL: vi.fn(() => [{ label: '默认', requirement: '默认要求', description: 'd' }]),
}));

import { htmlTemplatesApi } from '@/api/htmlTemplates';

beforeEach(() => vi.clearAllMocks());

describe('AiGenerateForm', () => {
  it('渲染 mode/模板/提示词/系统提示词,且点生成触发 onGenerate({mode,prompt,designMd})', async () => {
    const onGenerate = vi.fn();
    render(<AiGenerateForm campaignId="c1" onGenerate={onGenerate} />);

    // 等待 designGuide 加载 + 预设回填到 prompt
    await waitFor(() => expect(htmlTemplatesApi.getDesignGuide).toHaveBeenCalledWith('c1'));
    await waitFor(() => expect((screen.getByDisplayValue('默认要求') as HTMLTextAreaElement)).toBeTruthy());

    expect(screen.getByText('生成方式')).toBeTruthy();
    expect(screen.getByText('提示词模板')).toBeTruthy();
    expect(screen.getByText('系统提示词')).toBeTruthy();

    // 点生成(AI 模式)
    fireEvent.click(screen.getByRole('button', { name: /生成报告/ }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
    const arg = onGenerate.mock.calls[0][0];
    expect(arg.mode).toBe('ai');
    expect(arg.prompt).toBe('默认要求');
    expect(arg.designMd).toContain('brand guide');
  });

  it('点击「系统提示词」加载并展示 SYSTEM_PROMPT', async () => {
    render(<AiGenerateForm campaignId="c1" onGenerate={() => {}} />);
    // 初始未加载(懒加载)
    expect(htmlTemplatesApi.getSystemPrompt).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('系统提示词'));
    await waitFor(() => expect(htmlTemplatesApi.getSystemPrompt).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: 跑测试,确认失败**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/web && pnpm exec vitest run src/editor/components/AiGenerateForm.test.tsx
```
Expected: FAIL —— `AiGenerateForm` 未定义(模块不存在)。

- [ ] **Step 3: 实现组件** —— 新建 `AiGenerateForm.tsx`。把 `HtmlStudio.tsx` 现有 config 表单(`生成方式` tabs、提示词模板下拉、提示词 textarea+全屏、系统提示词折叠、🎨 design.md section、未绑定警告、recipe 信息块、生成按钮,约 line 390–617)的 JSX **逐字搬迁**进来,并做下列适配:

```tsx
import { useState, useEffect, useMemo } from 'react';
import { htmlTemplatesApi } from '@/api/htmlTemplates';
import { Button } from '@/components/Button';
import { MarkdownPreview } from '@/components/MarkdownEditor';
import { getPresetsForBL } from '@/report-presets';

type Mode = 'ai' | 'recipe';

interface Props {
  campaignId?: string;
  onGenerate: (vals: { mode: Mode; prompt: string; designMd: string }) => void;
  generating?: boolean;
  generateLabel?: string;
  error?: string;
}

export function AiGenerateForm({ campaignId, onGenerate, generating, generateLabel, error }: Props) {
  const [mode, setMode] = useState<Mode>('ai');
  const [prompt, setPrompt] = useState('');
  const [selectedPresetIdx, setSelectedPresetIdx] = useState(0);

  const [designMd, setDesignMd] = useState('');
  const [designMdLoading, setDesignMdLoading] = useState(false);
  const [designMdSource, setDesignMdSource] = useState('');
  const [blCode, setBlCode] = useState('');
  const [designMdExpanded, setDesignMdExpanded] = useState(false);

  const [systemPrompt, setSystemPrompt] = useState('');
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [promptFullscreen, setPromptFullscreen] = useState(false);
  const [systemPromptFullscreen, setSystemPromptFullscreen] = useState(false);

  const presets = useMemo(() => getPresetsForBL(blCode || undefined), [blCode]);

  // BL 确定后填第一个预设
  useEffect(() => {
    if (presets.length > 0) {
      setPrompt(presets[0].requirement);
      setSelectedPresetIdx(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blCode]);

  // 加载 design.md + blCode(统一从 getDesignGuide 取,与弹窗现状一致)
  useEffect(() => {
    if (!campaignId) return;
    setDesignMdLoading(true);
    htmlTemplatesApi
      .getDesignGuide(campaignId)
      .then((data) => {
        setDesignMd(data.designMd || '');
        setDesignMdSource(data.businessLineName || '');
        setBlCode(data.businessLineCode || '');
      })
      .catch(() => {})
      .finally(() => setDesignMdLoading(false));
  }, [campaignId]);

  // Esc 关闭全屏
  useEffect(() => {
    if (!promptFullscreen && !systemPromptFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPromptFullscreen(false);
        setSystemPromptFullscreen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [promptFullscreen, systemPromptFullscreen]);

  const handleGenerate = () => {
    onGenerate({ mode, prompt: mode === 'ai' ? prompt : '', designMd });
  };

  const triggerSystemPrompt = () => {
    if (!systemPrompt) {
      htmlTemplatesApi.getSystemPrompt().then(setSystemPrompt);
    }
    setShowSystemPrompt(!showSystemPrompt);
  };

  return (
    <>
      {/* === 以下 JSX 从 HtmlStudio.tsx line 390–617 逐字搬迁 === */}
      {/* 含:生成方式 tabs、mode==='ai'?(提示词模板 select + 提示词 textarea+⛶全屏 + 系统提示词折叠): recipe 信息块、🎨 design.md section、未绑定警告 */}
      {/* === 搬迁时的必要改动(只改这些,其余逐字保留): === */}
      {/*  (a) 删除 HtmlStudio line 478–497 的内联「查看/编辑 design.md」小 toggle ——它与 line 561–602 的「🎨 业务线设计规范」section 重复(同一 designMd/designMdExpanded),只保留后者。 */}
      {/*  (b) 「系统提示词」按钮 onClick 用上面的 triggerSystemPrompt(懒加载 getSystemPrompt + 切换 showSystemPrompt),初始 showSystemPrompt=false。 */}
      {/*  (c) 生成按钮:<Button onClick={handleGenerate} loading={generating} disabled={mode==='recipe'?!campaignId:generating} className="w-full">{generating ? '生成中…' : (generateLabel ?? '✨ 生成报告')}</Button>,下方 {error && <p className="mt-2 rounded-lg bg-red/10 px-3 py-2 text-xs text-red">{error}</p>}。 */}
      {/*  (d) 全屏浮层(promptFullscreen/systemPromptFullscreen 为真时渲染覆盖层)从 HtmlStudio 现有全屏逻辑搬迁;若无显式浮层 JSX,则把 textarea/MarkdownPreview 在 *Fullscreen 时用 fixed inset-0 z-50 覆盖层包裹,Esc 关闭。 */}

      {/* ⚠️ 实现说明:搬迁后,所有 setMode/setPrompt/setSelectedPresetIdx/setDesignMd/setDesignMdExpanded/setShowSystemPrompt/setPromptFullscreen/setSystemPromptFullscreen 引用都指向本组件 state(已声明),无需改命名。presets/selectedPresetIdx/designMd/designMdSource/designMdLoading/systemPrompt 同理。campaignId 来自 props。 */}
    </>
  );
}
```

> **搬迁要点(给执行者)**:打开 `apps/web/src/routes/HtmlStudio.tsx`,把 `phase==='config'` 分支里(约 line 390 `<div className="mb-4">` 的「生成方式」起)到 line 617 生成按钮+error 的整段 JSX 复制到本组件的 `return (<> ... </>)` 内,应用上述 (a)–(d) 四处改动。命名全部保持不变(本组件 state 与 HtmlStudio 同名)。`generating`/`generateLabel`/`error`/`campaignId`/`onGenerate` 来自 props。

- [ ] **Step 4: 跑测试,确认通过**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/web && pnpm exec vitest run src/editor/components/AiGenerateForm.test.tsx
```
Expected: PASS —— 2 个用例过。

- [ ] **Step 5: web tsc(CI gate)**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/web && pnpm exec tsc -b --force
```
Expected: exit 0,无输出。

- [ ] **Step 6: 提交(只 add 这两个新文件)**

```bash
cd /Users/ap/Desktop/PPTGenerator && git add apps/web/src/editor/components/AiGenerateForm.tsx apps/web/src/editor/components/AiGenerateForm.test.tsx && git commit -m "$(cat <<'EOF'
feat(web): 抽取共享 AiGenerateForm 组件

mode/提示词模板/提示词+全屏/系统提示词+全屏/design.md/生成按钮,内部加载
getDesignGuide+getSystemPrompt。后续 HtmlStudio 与 GenerateHtmlReportOverlay
共用,消除两处表单 drift。配组件单测。

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `GenerateHtmlReportOverlay` 接入 `<AiGenerateForm>`(删 designSpec)

**Files:**
- Modify: `apps/web/src/editor/components/GenerateHtmlReportOverlay.tsx`

- [ ] **Step 1: 替换内联表单** —— 在 `GenerateHtmlReportOverlay.tsx`:

1a. 顶部 import 加:
```tsx
import { AiGenerateForm } from './AiGenerateForm';
```
并**删除**不再用的 import:`getPresetsForBL`(若仅此组件用)、`useMemo`(若不再用)。

1b. **删除**这些 state(line 35–62 区域):`mode`、`blCode`、`presets`、`prompt`、`designSpec`、`selectedPresetIdx`、BL→preset effect(line 44–50)、`designMd`、`designMdLoading`、`designMdExpanded`、`designMdSource`、design-guide 加载 effect(line 89–106)。保留 `generatedHtml/loading/error/copied/saved/iframeRef`、版本相关 state、保存表单 state。

1c. `handleGenerate` 改为收组件回调值(删 `useCallback` 依赖里删掉的 state):
```tsx
const handleGenerate = useCallback(
  async (vals: { mode: 'ai' | 'recipe'; prompt: string; designMd: string }) => {
    setLoading(true);
    setError('');
    setGeneratedHtml('');
    try {
      const html = await htmlTemplatesApi.generate({
        mode: vals.mode,
        prompt: vals.mode === 'ai' ? vals.prompt : undefined,
        campaignId,
        designMd: vals.mode === 'ai' && vals.designMd.trim() ? vals.designMd.trim() : undefined,
        reportPeriod,
      });
      setGeneratedHtml(html);
    } catch (e: any) {
      const status = e?.response?.status;
      const bizMsg = e?.response?.data?.error?.message || e?.response?.data?.message;
      if (bizMsg) setError(bizMsg);
      else if (status === 500) setError('AI 生成超时或服务异常，请稍后重试（报告越复杂耗时越长）');
      else if (e?.code === 'ECONNABORTED' || e?.code === 'ETIMEDOUT') setError('请求超时，请重试');
      else setError(e?.message || '生成失败，请重试');
    } finally {
      setLoading(false);
    }
  },
  [campaignId, reportPeriod],
);
```

1d. 左侧面板(line 233–400 的 `<div className="flex w-[360px] ...">` 内整段 Mode tabs + AI/Recipe config + design.md + 生成按钮 + error)替换为:
```tsx
<div className="flex w-[360px] shrink-0 flex-col skin-gap-lg overflow-y-auto border-r border-border-default p-5">
  <AiGenerateForm
    campaignId={campaignId}
    onGenerate={handleGenerate}
    generating={loading && !generatedHtml}
    error={error && !showSaveForm ? error : undefined}
  />
</div>
```
(右侧预览/复制/下载/保存 + 保存表单弹窗 + 多版本对话框全部不动。)

- [ ] **Step 2: web tsc**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/web && pnpm exec tsc -b --force
```
Expected: exit 0(若报 `mode`/`prompt`/`designSpec`/`presets` 等 dangling 引用 → 漏删了某处,逐一清除)。

- [ ] **Step 3: 冒烟跑现有相关测试(无回归)**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/web && pnpm exec vitest run src/editor/components/GenerateHtmlReportOverlay 2>/dev/null || echo "(无现有测试,跳过——靠 tsc + 手动冒烟)"
```

- [ ] **Step 4: 提交**

```bash
cd /Users/ap/Desktop/PPTGenerator && git add apps/web/src/editor/components/GenerateHtmlReportOverlay.tsx && git commit -m "$(cat <<'EOF'
refactor(web): GenerateHtmlReportOverlay 改用共享 AiGenerateForm

删除内联 AI 表单 + designSpec(采用单 prompt 模型,与 HtmlStudio 一致);
handleGenerate 收组件 onGenerate 回调。预览/保存流程不变。

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `HtmlStudio` 接入 `<AiGenerateForm>`(删内联表单 + 相关 state)

**Files:**
- Modify: `apps/web/src/routes/HtmlStudio.tsx`

- [ ] **Step 1: 替换内联表单** —— 在 `HtmlStudio.tsx`:

1a. 顶部 import 加:
```tsx
import { AiGenerateForm } from '@/editor/components/AiGenerateForm';
```
删除不再用的:`MarkdownPreview`(若 HtmlStudio 别处不用)、`getPresetsForBL`(若不用)。

1b. **删除**这些 state 与派生(line 42–82 区域):`mode`/`setMode`、`blCode`、`presets`(useMemo)、`prompt`/`setPrompt`、`selectedPresetIdx`、BL→preset effect(line 51–59)、`designMd`/`designMdLoading`/`designMdExpanded`/`designMdSource`、`systemPrompt`/`showSystemPrompt`/`systemPromptFullscreen`、`promptFullscreen`、design-guide 加载 effect(约 line 173–185)、systemPrompt 加载 effect(约 line 162–168)、Esc 全屏 effect(line 149–160)。**保留**:`phase`/`agentHistory`/`generatedHtml`/`generating`/`error`/`copied`/`saved`/`iframeRef`/`previewDevice`/`panelCollapsed`/`showSource`/`viewMode`/`activeVersion`/项目加载 effect。

> ⚠️ 先 grep 确认 `mode`/`prompt`/`presets`/`designMd`/`systemPrompt` 等在删除区**之外**无引用(`handleGenerate`、JSX、`useCallback` 依赖数组)。`handleGenerate` 会在 1c 改签名;其余引用若存在,随表单 JSX 一起删。

1c. `handleGenerate` 改签名(收组件回调值;`reportPeriod` 仍从 `project.meta.reportPeriod` 取):
```tsx
const handleGenerate = useCallback(
  async (vals: { mode: 'ai' | 'recipe'; prompt: string; designMd: string }) => {
    setGenerating(true);
    setError('');
    setGeneratedHtml('');
    setSaved(false);
    void updateAiHtmlStatus('generating');
    try {
      const html = await htmlTemplatesApi.generate({
        mode: vals.mode,
        prompt: vals.mode === 'ai' ? vals.prompt : undefined,
        campaignId,
        designMd: vals.mode === 'ai' && vals.designMd.trim() ? vals.designMd.trim() : undefined,
        reportPeriod,
      });
      setGeneratedHtml(html);
      if (id) {
        try {
          await htmlTemplatesApi.autoSave(id, html);
          setSaved(true);
        } catch { /* 静默 */ }
      }
      void updateAiHtmlStatus('generated');
      setPhase('chat');
      setAgentHistory([
        { role: 'assistant', content: '✨ 报告已生成并自动保存！你可以用自然语言修改…', action: 'generate', ts: new Date().toISOString() },
      ]);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: { message?: string }; message?: string } }; message?: string };
      setError(err.response?.data?.error?.message || err.response?.data?.message || err.message || '生成失败，请重试');
      void updateAiHtmlStatus('pending');
    } finally {
      setGenerating(false);
    }
  },
  [campaignId, reportPeriod, updateAiHtmlStatus, id],
);
```
(对照原 `handleGenerate` body——保留每一步行为,只把 `mode`/`prompt`/`designMd` 来源换成 `vals.*`。)

1d. config 面板(line 387–618 的 `phase === 'config' ? (<div className="flex flex-1 flex-col overflow-y-auto p-5"> … </div>)` 整段:mode tabs + AI/Recipe config + design.md section + 生成按钮 + error)替换为:
```tsx
{phase === 'config' ? (
  <div className="flex flex-1 flex-col overflow-y-auto p-5">
    <AiGenerateForm
      campaignId={campaignId}
      onGenerate={handleGenerate}
      generating={generating}
      error={error}
    />
  </div>
) : (
  <AgentChatPanel ... />  {/* 原样保留 */}
)}
```
(其余:项目加载、chat 面板、右侧预览/源码/visual、RecipeEditor 分支——全部不动。)

- [ ] **Step 2: web tsc**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/web && pnpm exec tsc -b --force
```
Expected: exit 0。若报 dangling 引用(`setMode`/`presets`/`designMd`/`systemPrompt`/`promptFullscreen` 等)→ 漏删某处,逐一清除(这些 state 已迁入组件,HtmlStudio 不应再引用)。

- [ ] **Step 3: 冒烟现有测试**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/web && pnpm exec vitest run src/routes/HtmlStudio 2>/dev/null || echo "(无现有测试,跳过——靠 tsc + 手动冒烟)"
```

- [ ] **Step 4: 提交**

```bash
cd /Users/ap/Desktop/PPTGenerator && git add apps/web/src/routes/HtmlStudio.tsx && git commit -m "$(cat <<'EOF'
refactor(web): HtmlStudio 改用共享 AiGenerateForm

删除内联 AI 表单 + 相关 state/effect(mode/prompt/presets/designMd/systemPrompt/
全屏等约 15 个 useState + 3 个 effect);handleGenerate 收组件 onGenerate 回调。
config 面板替换为 <AiGenerateForm>。chat/预览/RecipeEditor 流程不变。
顺带消除原表单里重复的 design.md toggle(组件内只保留一处)。

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## 收尾验证

- [ ] **Step 1: web tsc 全量**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/web && pnpm exec tsc -b --force
```
Expected: exit 0。

- [ ] **Step 2: 新组件测试 + 两个消费者编译产物无 dangling**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/web && pnpm exec vitest run src/editor/components/AiGenerateForm.test.tsx
```
Expected: 2/2 过。

- [ ] **Step 3: 手动冒烟(两个入口)**
- 弹窗:报告列表/Campaign 入口 → 打开「⚡ 生成 HTML 报告」→ 可见 mode tabs + 提示词模板下拉 + 提示词 + ⛶全屏 + 「系统提示词」(点击展开 MarkdownPreview) + 🎨 design.md + 生成按钮 → 生成 → 预览 → 保存。**确认原「🎨 设计规范」独立框已消失(合并进提示词)。**
- 沉浸式页:`/projects/:id/html-studio` → config 面板同上表单 → 生成 → 即生即存 → 切 chat 阶段。

> 注:仓库更广 web 套件有与本次无关的预存失败(用户 WIP:projects 模块 + DuplicateProjectDialog),不属本计划范围。本计划只对 AiGenerateForm + 两消费者负责。

---

## Self-Review

**1. Spec coverage:**
- 共享 `<AiGenerateForm>`(含系统提示词+全屏、提示词+全屏、模板下拉、design.md、生成按钮)→ Task 1。✓
- HtmlStudio 接入(删内联表单+state)→ Task 3。✓
- 弹窗接入 + 删 designSpec(单 prompt 模型)→ Task 2。✓
- `onGenerate({mode,prompt,designMd})` 契约 + 各消费者自理结果/保存 → Task 1 契约 + Task 2/3 handleGenerate。✓
- reportPeriod 不进组件(各消费者注入)→ Task 2/3 handleGenerate 用各自 reportPeriod。✓
- 组件单测 → Task 1。✓
- 消除重复 design.md toggle(针对性改进)→ Task 1 Step 3 改动 (a) + Task 3 commit 备注。✓

**2. Placeholder scan:** Task 1 的 JSX 用「逐字搬迁 + 4 处具体改动」描述(源行号 + 改动点明确,非让执行者发明);其余步骤均有完整代码/命令。可接受——搬迁的 JSX 在源文件里(执行者读源),plan 给出精确范围 + diff。✓

**3. Type consistency:** `onGenerate(vals: {mode: 'ai'|'recipe'; prompt: string; designMd: string})` 在 Task 1 组件、Task 2 handleGenerate、Task 3 handleGenerate 三处签名一致;`AiGenerateForm` props(`campaignId/onGenerate/generating/generateLabel/error`)在 Task 1 定义、Task 2/3 使用一致;`Mode = 'ai'|'recipe'` 一致。✓

无问题,无需返工。
