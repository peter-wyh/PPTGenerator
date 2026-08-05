# Report Agent — AI 生成 + HTML 编辑混合模式实施计划

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.
> Plan size: 13 tasks, sequential dependencies. Direct execution recommended.

**Goal:** 将 HtmlStudio 从「配置→生成→手动保存」改为「配置→生成→自动保存→Chat 迭代编辑」，统一为一个 Report Agent 工作台。

**Architecture:** 混合模式 — 首次生成保留结构化配置面板（保证质量），生成完成后自动保存并切换到 Chat 面板（自然语言迭代编辑），每次编辑自动更新 `htmlContent`。废弃 HtmlVersion 多版本管理，改用「复制报告」替代多版本需求。

**Tech Stack:** React 18 + TypeScript + Express + Prisma + DeepSeek API

---

## 关键设计决策

1. **即生即存**：AI 生成完成 → 直接写入 `project.htmlContent`，不再有「手动保存」步骤
2. **增量编辑**：用户自然语言指令 → 当前 HTML + 指令发给 DeepSeek → 返回完整修改后 HTML → 自动保存
3. **废弃多版本**：HtmlVersion 表保留但不再写入新数据，一报告一 HTML
4. **复制简化**：`duplicate()` 只拷贝 `htmlContent`，不拷贝 HtmlVersion 记录
5. **对话历史**：存 `project.meta.agentHistory`（轻量 JSON 数组）

---

### Task 1: 新增 EDIT_SYSTEM_PROMPT 常量

**Objective:** 定义增量编辑专用 system prompt，让 AI 接收当前 HTML + 编辑指令后返回修改后的完整 HTML。

**Files:**
- Modify: `apps/server/src/modules/html-templates/ai-generate.service.ts` (在 `SYSTEM_PROMPT` 常量后追加)

**Step 1: 在 `ai-generate.service.ts` 的 `SYSTEM_PROMPT` 和 `USER_PROMPT_TEMPLATE` 之间追加以下常量**

在 `DESIGN_GUIDE_SUFFIX` 常量之后、`export const aiGenerateService` 之前插入：

```typescript
/** 增量编辑 system prompt — 接收当前 HTML + 用户指令，返回修改后的完整 HTML */
const EDIT_SYSTEM_PROMPT = `You are an HTML editor agent for B2B marketing reports.

You receive the CURRENT HTML report and a user's EDIT INSTRUCTION. You must return the COMPLETE updated HTML file.

═══ CRITICAL RULES ═══
1. Return the COMPLETE HTML file from <!DOCTYPE html> to </html>. NOT a diff, NOT a fragment.
2. Only modify what the user asked. Keep everything else IDENTICAL — same data, same structure, same styling for unchanged parts.
3. PRESERVE all data values (creator names, numbers, dates, avatars, URLs). Never fabricate or substitute data.
4. Your response must start directly with <!DOCTYPE html>. No markdown fences, no explanations.

═══ EDIT GUIDELINES ═══
- Style changes (colors, fonts, spacing): modify CSS in <style> or inline styles.
- Content changes (titles, labels): modify the HTML text content.
- Structure changes (add/remove sections): modify the HTML structure, keep Tailwind/Chart.js intact.
- If the instruction is vague, make a reasonable professional choice.

═══ OUTPUT FORMAT ═══
Output ONLY the complete HTML code. Start with <!DOCTYPE html>, end with </html>.`;

/** 增量编辑 user prompt 模板 */
const EDIT_USER_PROMPT_TEMPLATE = `Edit the following HTML report according to the user's instruction.

User edit instruction: {{EDIT_INSTRUCTION}}

═══ CURRENT HTML (modify this) ═══
{{CURRENT_HTML}}

Return the COMPLETE updated HTML. Output ONLY the HTML code.`;
```

**Step 2: 验证 tsc 无新错误**

Run: `cd apps/server && ../node_modules/.pnpm/node_modules/.bin/tsc --noEmit`
Expected: PASS（新增常量不影响类型检查）

**Step 3: Commit**

```bash
git add apps/server/src/modules/html-templates/ai-generate.service.ts
git commit -m "feat: add EDIT_SYSTEM_PROMPT for incremental HTML editing"
```

---

### Task 2: 新增 `editHtml()` 方法

**Objective:** 在 `aiGenerateService` 中添加增量编辑方法，调用 DeepSeek API 对现有 HTML 进行修改。

**Files:**
- Modify: `apps/server/src/modules/html-templates/ai-generate.service.ts` (在 `generateHtml` 方法后追加)

**Step 1: 在 `aiGenerateService` 对象中，`generateHtml` 方法之后、对象闭合 `}` 之前，添加 `editHtml` 方法**

```typescript
  /**
   * Incremental edit: modify existing HTML based on user instruction.
   * Returns the complete updated HTML.
   */
  async editHtml(params: {
    currentHtml: string;
    instruction: string;
  }): Promise<string> {
    if (!DEEPSEEK_API_KEY) {
      throw ApiError.internal('DeepSeek API key 未配置（DEEPSEEK_API_KEY）');
    }

    const userPrompt = EDIT_USER_PROMPT_TEMPLATE
      .replace('{{EDIT_INSTRUCTION}}', params.instruction)
      .replace('{{CURRENT_HTML}}', params.currentHtml);

    const isReasoningModel = DEEPSEEK_MODEL.includes('reason') || DEEPSEEK_MODEL.includes('v4');
    const maxTokens = isReasoningModel ? 16000 : 8192;

    // 编辑操作通常比全量生成快，但仍设 290s 超时保护
    const DEEPSEEK_TIMEOUT_MS = 290_000;
    const abortController = new AbortController();
    const timeoutHandle = setTimeout(() => abortController.abort(), DEEPSEEK_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${DEEPSEEK_API_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          messages: [
            { role: 'system', content: EDIT_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3, // 编辑用低 temperature 保持精确性
          max_tokens: maxTokens,
          stream: false,
        }),
        signal: abortController.signal,
      });
    } catch (err: any) {
      clearTimeout(timeoutHandle);
      const msg = String(err?.message || '');
      const isNetworkAbort =
        err?.name === 'AbortError' ||
        /abort|terminated|other side closed|fetch failed|socket|ECONNRESET/i.test(msg) ||
        err?.code === 'ECONNRESET' ||
        (typeof err?.code === 'string' && err.code.startsWith('UND_ERR'));
      if (isNetworkAbort) {
        throw ApiError.internal('AI 编辑超时或连接中断，请稍后重试');
      }
      throw err;
    }
    clearTimeout(timeoutHandle);

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      throw ApiError.internal(`DeepSeek API 调用失败 (${response.status}): ${errText}`);
    }

    const data = await response.json() as any;
    const choice = data.choices?.[0];
    let content: string = choice?.message?.content ?? '';

    // 复用 generateHtml 中的清理逻辑
    // 1) 去 markdown fences
    content = content.replace(/```(?:html|HTML|markdown|md|xml|text)?\s*\n?/gi, '');
    content = content.replace(/```\s*$/g, '').trim();

    // 2) 找到 HTML 起始
    if (content && !content.startsWith('<')) {
      const doctypeIdx = content.search(/<!DOCTYPE/i);
      const htmlTagIdx = content.search(/<html/i);
      const indices = [doctypeIdx, htmlTagIdx].filter((i) => i >= 0);
      if (indices.length > 0) {
        content = content.substring(Math.min(...indices));
      }
    }

    // 3) 截取到最后一个 </html>
    const endIdx = content.lastIndexOf('</html>');
    if (endIdx >= 0) {
      content = content.substring(0, endIdx + '</html>'.length);
    }

    // 4) 补全截断
    if (content && content.startsWith('<') && !content.includes('</html>')) {
      const openBody = (content.match(/<body/gi) || []).length;
      const closeBody = (content.match(/<\/body/gi) || []).length;
      const openHtml = (content.match(/<html/gi) || []).length;
      const closeHtml = (content.match(/<\/html/gi) || []).length;
      if (openBody > closeBody) content += '\n</body>';
      if (openHtml > closeHtml) content += '\n</html>';
    }

    // 5) 验证
    if (!content || !content.startsWith('<')) {
      throw ApiError.internal(
        `AI 编辑后的 HTML 格式异常${choice?.finish_reason === 'length' ? '（输出被截断，请减少修改复杂度后重试）' : ''}`
      );
    }

    return content;
  },
```

**Step 2: 验证 tsc**

Run: `cd apps/server && ../node_modules/.pnpm/node_modules/.bin/tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/server/src/modules/html-templates/ai-generate.service.ts
git commit -m "feat: add editHtml() method for incremental AI editing"
```

---

### Task 3: 新增 `agentEditSchema` 验证

**Objective:** 为 agent-edit 端点添加请求体校验。

**Files:**
- Modify: `apps/server/src/modules/html-templates/html-templates.schema.ts`

**Step 1: 在文件末尾追加**

```typescript
/** Agent 增量编辑：当前 HTML + 用户指令 → 修改后的 HTML */
export const agentEditSchema = z.object({
  currentHtml: z.string().min(1),
  instruction: z.string().min(1).max(2000),
});
```

**Step 2: 验证 tsc**

Run: `cd apps/server && ../node_modules/.pnpm/node_modules/.bin/tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/server/src/modules/html-templates/html-templates.schema.ts
git commit -m "feat: add agentEditSchema validation"
```

---

### Task 4: 新增 agent-edit 控制器 + 路由

**Objective:** 暴露 `POST /api/v1/html-templates/agent-edit` 端点。

**Files:**
- Modify: `apps/server/src/modules/html-templates/html-templates.controller.ts`
- Modify: `apps/server/src/modules/html-templates/html-templates.routes.ts`

**Step 1: 在 `html-templates.controller.ts` 末尾 `getDesignGuide` 之后添加控制器**

```typescript
  /** Agent 增量编辑：当前 HTML + 用户指令 → 修改后的完整 HTML */
  agentEdit: asyncHandler(async (req: Request, res: Response) => {
    const { currentHtml, instruction } = req.body;
    const html = await aiGenerateService.editHtml({
      currentHtml,
      instruction,
    });
    res.json({ html });
  }),
```

**Step 2: 在 `html-templates.routes.ts` 中添加路由**

在 `generate` 路由之后（第 48 行后）添加：

```typescript
// POST /api/v1/html-templates/agent-edit — Agent 增量编辑现有 HTML
router.post(
  '/agent-edit',
  validate({ body: agentEditSchema }),
  htmlTemplateController.agentEdit,
);
```

同时在文件顶部 import 中添加 `agentEditSchema`：

```typescript
import {
  createHtmlTemplateSchema,
  updateHtmlTemplateSchema,
  idParamSchema,
  generateHtmlSchema,
  saveHtmlAsProjectSchema,
  agentEditSchema,
} from './html-templates.schema';
```

**Step 3: 验证 tsc**

Run: `cd apps/server && ../node_modules/.pnpm/node_modules/.bin/tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/server/src/modules/html-templates/html-templates.controller.ts apps/server/src/modules/html-templates/html-templates.routes.ts
git commit -m "feat: add POST /agent-edit endpoint"
```

---

### Task 5: 新增 `autoSaveHtml()` 方法

**Objective:** 简化保存逻辑 — 直接更新 `project.htmlContent`，不涉及 HtmlVersion。

**Files:**
- Modify: `apps/server/src/modules/html-templates/html-templates.service.ts`

**Step 1: 在 `htmlTemplateService` 对象中（`saveHtmlToProject` 方法之后）添加 `autoSaveHtml`**

```typescript
  /**
   * 自动保存 HTML 到报告（Agent 模式专用）。
   * 直接更新 project.htmlContent，不创建 HtmlVersion。
   * 同时更新 meta.updatedAt 时间戳，使报告列表按编辑时间排序。
   */
  async autoSaveHtml(projectId: string, html: string, agentHistory?: unknown[]): Promise<{ ok: true; updatedAt: string }> {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw ApiError.notFound('报告不存在');

    const currentMeta = (project.meta as Record<string, unknown> | null) ?? {};
    const newMeta = {
      ...currentMeta,
      styleType: 'ai-html',
      updatedAt: new Date().toISOString(),
      ...(agentHistory !== undefined ? { agentHistory } : {}),
    };

    await prisma.project.update({
      where: { id: projectId },
      data: {
        htmlContent: html,
        meta: newMeta as any,
      },
    });

    return { ok: true, updatedAt: new Date().toISOString() };
  },
```

**Step 2: 验证 tsc**

Run: `cd apps/server && ../node_modules/.pnpm/node_modules/.bin/tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/server/src/modules/html-templates/html-templates.service.ts
git commit -m "feat: add autoSaveHtml() — simplified save without version management"
```

---

### Task 6: 新增 auto-save 控制器 + 路由

**Objective:** 暴露 `PATCH /api/v1/html-templates/projects/:projectId/auto-save` 端点。

**Files:**
- Modify: `apps/server/src/modules/html-templates/html-templates.controller.ts`
- Modify: `apps/server/src/modules/html-templates/html-templates.routes.ts`

**Step 1: 在 controller 中添加 `autoSave` 处理器**

```typescript
  /** Agent 模式自动保存（直接覆盖 htmlContent，无版本管理） */
  autoSave: asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { html, agentHistory } = req.body;
    const result = await htmlTemplateService.autoSaveHtml(projectId, html, agentHistory);
    res.json(result);
  }),
```

**Step 2: 在 routes 中添加路由（saveHtml 路由之后）**

```typescript
// PATCH /api/v1/html-templates/projects/:projectId/auto-save — Agent 模式自动保存
router.patch(
  '/projects/:projectId/auto-save',
  htmlTemplateController.autoSave,
);
```

**Step 3: 验证 tsc + 重启后端**

Run: `cd apps/server && ../node_modules/.pnpm/node_modules/.bin/tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/server/src/modules/html-templates/html-templates.controller.ts apps/server/src/modules/html-templates/html-templates.routes.ts
git commit -m "feat: add PATCH /projects/:projectId/auto-save endpoint"
```

---

### Task 7: 简化 `duplicate()` — 不复制 HtmlVersion

**Objective:** 复制 AI HTML 报告时只拷贝 `htmlContent`，不再复制 HtmlVersion 记录。

**Files:**
- Modify: `apps/server/src/modules/projects/projects.service.ts` (第 270-286 行)

**Step 1: 删除 `duplicate()` 方法中复制 HtmlVersion 的代码块**

将第 270-286 行的整个 HtmlVersion 复制循环删除：

```typescript
// 删除以下代码块（第 270-286 行）：
//     // ★ 复制 HtmlVersion 多版本记录（AI HTML 报告的版本历史）
//     const versions = await prisma.htmlVersion.findMany({
//       where: { projectId: id },
//       orderBy: { createdAt: 'asc' },
//     });
//     for (const v of versions) {
//       await prisma.htmlVersion.create({
//         data: {
//           project: { connect: { id: project.id } },
//           name: v.name,
//           html: v.html,
//           source: v.source,
//           isActive: v.isActive,
//           ownerId: project.ownerId,
//         },
//       });
//     }
```

`duplicate()` 方法在 `const project = await prisma.project.create({ data });` 之后直接 `return toDetail(project);`。

htmlContent 和 reportSchemeVersion 的拷贝（第 264-266 行）保持不变。

**Step 2: 验证 tsc**

Run: `cd apps/server && ../node_modules/.pnpm/node_modules/.bin/tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/server/src/modules/projects/projects.service.ts
git commit -m "refactor: simplify duplicate() — copy htmlContent only, no HtmlVersion"
```

---

### Task 8: 前端 API 层 — 添加 `agentEdit()` + `autoSave()`

**Objective:** 在前端 API 客户端中添加 agent-edit 和 auto-save 方法。

**Files:**
- Modify: `apps/web/src/api/htmlTemplates.ts`

**Step 1: 定义 ChatMessage 类型**

在 `HtmlVersionDetail` interface 之后添加：

```typescript
/** Agent 对话消息 */
export interface AgentChatMessage {
  role: 'user' | 'assistant';
  content: string;
  action?: 'generate' | 'edit' | 'fix' | 'manual';
  ts: string;
}
```

**Step 2: 在 `htmlTemplatesApi` 对象中（`saveHtmlAsProject` 之后）添加两个方法**

```typescript
  /** Agent 增量编辑：当前 HTML + 指令 → 修改后的 HTML */
  agentEdit: (input: { currentHtml: string; instruction: string }) =>
    api
      .post<{ html: string }>('/html-templates/agent-edit', input, {
        timeout: 300000,
      })
      .then((r) => r.data.html),

  /** Agent 模式自动保存（直接覆盖 htmlContent） */
  autoSave: (
    projectId: string,
    html: string,
    agentHistory?: AgentChatMessage[],
  ) =>
    api
      .patch<{ ok: boolean; updatedAt: string }>(
        `/html-templates/projects/${projectId}/auto-save`,
        { html, agentHistory },
      )
      .then((r) => r.data),
```

**Step 3: 验证 tsc**

Run: `cd apps/web && ../node_modules/.pnpm/node_modules/.bin/tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/src/api/htmlTemplates.ts
git commit -m "feat: add agentEdit() and autoSave() to API client"
```

---

### Task 9: 创建 `AgentChatPanel.tsx` 组件

**Objective:** 独立的 Chat 面板组件，负责对话交互 + 调用 agent-edit API。

**Files:**
- Create: `apps/web/src/routes/AgentChatPanel.tsx`

**Step 1: 创建组件文件**

```typescript
/**
 * AgentChatPanel — Report Agent 对话面板。
 * 用户输入编辑指令 → 调用 AI 增量编辑 → 返回修改后 HTML → 自动保存。
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/Button';
import type { AgentChatMessage } from '@/api/htmlTemplates';

interface AgentChatPanelProps {
  projectId: string;
  currentHtml: string;
  agentHistory: AgentChatMessage[];
  onHtmlChange: (html: string) => void;
  onHistoryChange: (history: AgentChatMessage[]) => void;
}

const QUICK_ACTIONS = [
  { label: '改标题', prompt: '把报告标题改为：' },
  { label: '换配色', prompt: '把报告的主色调改为：' },
  { label: '加列', prompt: '在表格中添加一列：' },
  { label: '改图表', prompt: '把图表类型改为：' },
];

export function AgentChatPanel({
  projectId,
  currentHtml,
  agentHistory,
  onHtmlChange,
  onHistoryChange,
}: AgentChatPanelProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [agentHistory, loading]);

  const handleSend = useCallback(async (instruction?: string) => {
    const text = (instruction ?? input).trim();
    if (!text || loading || !currentHtml) return;

    const userMsg: AgentChatMessage = {
      role: 'user',
      content: text,
      ts: new Date().toISOString(),
    };
    const newHistory = [...agentHistory, userMsg];
    onHistoryChange(newHistory);
    setInput('');
    setLoading(true);
    setError('');

    try {
      // 动态 import 避免循环依赖
      const { htmlTemplatesApi } = await import('@/api/htmlTemplates');
      const html = await htmlTemplatesApi.agentEdit({
        currentHtml,
        instruction: text,
      });
      onHtmlChange(html);

      const aiMsg: AgentChatMessage = {
        role: 'assistant',
        content: '已更新 ✅',
        action: 'edit',
        ts: new Date().toISOString(),
      };
      const finalHistory = [...newHistory, aiMsg];
      onHistoryChange(finalHistory);

      // 自动保存
      await htmlTemplatesApi.autoSave(projectId, html, finalHistory);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: { message?: string }; message?: string } }; message?: string };
      setError(err.response?.data?.error?.message || err.response?.data?.message || err.message || '编辑失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [input, loading, currentHtml, agentHistory, onHtmlChange, onHistoryChange, projectId]);

  return (
    <div className="flex h-full flex-col">
      {/* 消息列表 */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {agentHistory.length === 0 && (
          <div className="rounded-lg bg-surface-hover px-3 py-4 text-center text-xs text-foreground-muted">
            💬 报告已生成！用自然语言告诉我你想怎么修改：
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {QUICK_ACTIONS.map((q) => (
                <button
                  key={q.label}
                  onClick={() => handleSend(q.prompt)}
                  disabled={loading}
                  className="rounded-md bg-accent-primary/10 px-2 py-1 text-[11px] text-accent-primary hover:bg-accent-primary/20 disabled:opacity-50"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {agentHistory.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                msg.role === 'user'
                  ? 'bg-accent-primary text-foreground-inverse'
                  : 'bg-surface-hover text-foreground-primary'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-surface-hover px-3 py-2 text-xs text-foreground-muted">
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-primary" />
                AI 正在编辑… (~1-2min)
              </span>
            </div>
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-red/10 px-3 py-2 text-xs text-red">
            {error}
          </div>
        )}
      </div>

      {/* 输入框 */}
      <div className="shrink-0 border-t border-border-default p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="输入编辑指令… (如：把 KPI 卡片改成渐变色)"
            disabled={loading}
            className="flex-1 rounded-lg border border-border-default bg-surface-secondary px-3 py-2 text-xs text-foreground-primary placeholder:text-foreground-muted focus:border-accent-primary focus:outline-none disabled:opacity-50"
          />
          <Button
            onClick={() => void handleSend()}
            loading={loading}
            disabled={!input.trim() || loading}
            className="shrink-0 px-3 py-2 text-xs"
          >
            发送
          </Button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: 验证 tsc**

Run: `cd apps/web && ../node_modules/.pnpm/node_modules/.bin/tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/src/routes/AgentChatPanel.tsx
git commit -m "feat: create AgentChatPanel component"
```

---

### Task 10: 重构 HtmlStudio — 添加 phase 状态 + 自动保存

**Objective:** HtmlStudio 从单一配置页改为双阶段（config → chat），生成后自动保存并切换到 Chat。

**Files:**
- Modify: `apps/web/src/routes/HtmlStudio.tsx`

这是最大的改动，拆成 4 个子步骤。

**Step 1: 在 imports 中添加 AgentChatPanel 和新类型**

在文件顶部 import 区域追加：

```typescript
import { AgentChatPanel } from './AgentChatPanel';
import type { AgentChatMessage } from '@/api/htmlTemplates';
```

**Step 2: 添加 phase 状态 + agentHistory 状态**

在现有 state 声明区域（约第 55 行附近，`const [saved, setSaved] = useState(false)` 之后）添加：

```typescript
// ★ 混合模式阶段：config = 首次生成配置；chat = 生成后迭代编辑
const [phase, setPhase] = useState<'config' | 'chat'>('config');
// ★ Agent 对话历史
const [agentHistory, setAgentHistory] = useState<AgentChatMessage[]>([]);
```

**Step 3: 修改 `handleGenerate` — 生成成功后自动保存 + 切换到 chat**

将现有 `handleGenerate`（约第 166-192 行）替换为：

```typescript
const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError('');
    setGeneratedHtml('');
    setSaved(false);
    void updateAiHtmlStatus('generating');
    try {
      const html = await htmlTemplatesApi.generate({
        mode,
        templateId: mode === 'template' ? selectedTpl : undefined,
        prompt: mode === 'ai' ? `${designSpec}\n\n${prompt}`.trim() : undefined,
        campaignId,
        designMd: mode === 'ai' && designMd.trim() ? designMd.trim() : undefined,
        reportPeriod,
      });
      setGeneratedHtml(html);

      // ★ 即生即存：生成成功后自动保存到 project.htmlContent
      if (id) {
        try {
          await htmlTemplatesApi.autoSave(id, html);
          setSaved(true);
        } catch {
          // 自动保存失败不阻塞流程，用户可手动下载
        }
      }

      void updateAiHtmlStatus('generated');

      // ★ 切换到 Chat 阶段
      setPhase('chat');
      const genMsg: AgentChatMessage = {
        role: 'assistant',
        content: '✨ 报告已生成并自动保存！你可以用自然语言修改，比如：「把标题改成 XXX」「KPI 卡片用品牌色渐变」',
        action: 'generate',
        ts: new Date().toISOString(),
      };
      setAgentHistory([genMsg]);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: { message?: string }; message?: string } }; message?: string };
      setError(err.response?.data?.error?.message || err.response?.data?.message || err.message || '生成失败，请重试');
      void updateAiHtmlStatus('pending');
    } finally {
      setGenerating(false);
    }
  }, [mode, selectedTpl, prompt, designSpec, campaignId, designMd, reportPeriod, updateAiHtmlStatus, id]);
```

**Step 4: 在 useEffect 加载已有报告时，检测 htmlContent 并直接进入 chat 阶段**

修改现有 useEffect（约第 75-123 行），在加载完成后检查是否有 htmlContent：

在 `.then((p) => { setProject(p); ... })` 内部，在加载 versions 逻辑之前，添加 htmlContent 检测：

```typescript
// ★ 如果报告已有 htmlContent，直接进入 chat 阶段
projectsApi
  .getHtml(id)
  .then((data) => {
    if (data.html) {
      setGeneratedHtml(data.html);
      setSaved(true);
      setPhase('chat');
      // 从 meta 加载历史对话
      const history = (p.meta as any)?.agentHistory as AgentChatMessage[] | undefined;
      if (history && Array.isArray(history)) {
        setAgentHistory(history);
      } else {
        setAgentHistory([{
          role: 'assistant',
          content: '报告已加载。你可以用自然语言继续编辑。',
          action: 'generate',
          ts: new Date().toISOString(),
        }]);
      }
    }
  })
  .catch(() => {});
```

注意：这段替换现有的 versions 加载逻辑。删除整个 `htmlTemplatesApi.listHtmlVersions(id).then(...)` 代码块（第 83-119 行），替换为上面的 htmlContent 检测。

**Step 5: 删除手动保存相关代码**

- 删除 `showSaveDialog` state（第 72 行）
- 删除 `handleSaveClick`（第 211-213 行）
- 删除 `doSave`（第 216-242 行）
- 删除 `handleVersionSwitch`（第 245-263 行）
- 删除 `versions` state（第 70 行）
- 删除 `activeVersionId` state（第 71 行）
- 删除版本切换器 UI（顶栏中 `versions.length > 0` 的 select 块，约第 308-321 行）
- 删除保存对话框（约第 630-666 行）

**Step 6: 修改左侧面板渲染逻辑**

将 `<aside>` 内的内容用 phase 条件包裹：

```tsx
{!panelCollapsed && (
  <aside className="flex w-[380px] shrink-0 flex-col overflow-hidden border-r border-border-default bg-surface-primary">
    {phase === 'config' ? (
      <div className="flex flex-1 flex-col overflow-y-auto p-5">
        {/* ... 现有的配置面板内容（mode tabs、预设、内容要求、设计规范、生成按钮）... */}
      </div>
    ) : (
      <AgentChatPanel
        projectId={id || ''}
        currentHtml={generatedHtml}
        agentHistory={agentHistory}
        onHtmlChange={(html) => setGeneratedHtml(html)}
        onHistoryChange={setAgentHistory}
      />
    )}
  </aside>
)}
```

**Step 7: 验证 tsc**

Run: `cd apps/web && ../node_modules/.pnpm/node_modules/.bin/tsc --noEmit`
Expected: PASS（如有 unused variable 警告，清理已删除的 state 引用）

**Step 8: Commit**

```bash
git add apps/web/src/routes/HtmlStudio.tsx
git commit -m "feat: refactor HtmlStudio to hybrid mode (config → auto-save → chat)"
```

---

### Task 11: 修改顶栏 — 适配 chat 阶段 + 源码面板切换

**Objective:** 顶栏在 chat 阶段显示不同工具（源码切换、复制、下载），移除版本切换器和保存按钮。

**Files:**
- Modify: `apps/web/src/routes/HtmlStudio.tsx`

**Step 1: 添加源码面板状态**

```typescript
const [showSource, setShowSource] = useState(false);
```

**Step 2: 修改顶栏右侧工具区**

将顶栏右侧（约第 306-333 行）替换为：

```tsx
<div className="flex items-center gap-2">
  {saved && !generating && (
    <span className="flex items-center gap-1 text-xs text-green">
      <span className="h-1.5 w-1.5 rounded-full bg-green" /> 已保存
    </span>
  )}
  {/* 源码面板切换（仅 chat 阶段） */}
  {phase === 'chat' && (
    <button
      onClick={() => setShowSource(!showSource)}
      className={`rounded-md px-2 py-1 text-xs transition ${
        showSource
          ? 'bg-accent-primary text-foreground-inverse'
          : 'text-foreground-secondary hover:bg-surface-hover'
      }`}
      title="查看/编辑 HTML 源码"
    >
      {'</>'} 源码
    </button>
  )}
  {/* 返回配置（仅 chat 阶段，允许重新生成） */}
  {phase === 'chat' && (
    <button
      onClick={() => {
        if (confirm('返回配置面板将重新生成报告，当前内容会被覆盖。确定？')) {
          setPhase('config');
        }
      }}
      className="rounded-md px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
      title="重新配置并生成"
    >
      🔄 重新生成
    </button>
  )}
  <button
    onClick={() => setPanelCollapsed(!panelCollapsed)}
    className="rounded-md px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
  >
    {panelCollapsed ? '☰ 展开' : '⬅ 收起'}
  </button>
</div>
```

**Step 3: Commit**

```bash
git add apps/web/src/routes/HtmlStudio.tsx
git commit -m "feat: update top bar for chat phase + source panel toggle"
```

---

### Task 12: 添加源码面板（右侧可折叠）

**Objective:** 在预览区右侧添加可折叠的 HTML 源码编辑面板，修改后可手动保存。

**Files:**
- Modify: `apps/web/src/routes/HtmlStudio.tsx`

**Step 1: 在预览区 `<main>` 内部，当 `showSource` 为 true 时渲染源码面板**

在预览区的 `<div className="flex flex-1 items-start justify-center overflow-auto p-4">` 之后，添加源码面板：

```tsx
{showSource && phase === 'chat' && (
  <div className="flex h-full w-[420px] shrink-0 flex-col border-l border-border-default bg-surface-primary">
    <div className="flex h-10 shrink-0 items-center justify-between border-b border-border-default px-3">
      <span className="text-xs font-medium text-foreground-secondary">HTML 源码</span>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => {
            // 手动编辑后保存
            if (id && generatedHtml) {
              htmlTemplatesApi.autoSave(id, generatedHtml, agentHistory).then(() => {
                setSaved(true);
                const manualMsg: AgentChatMessage = {
                  role: 'assistant',
                  content: '📝 源码已手动编辑并保存',
                  action: 'manual',
                  ts: new Date().toISOString(),
                };
                setAgentHistory([...agentHistory, manualMsg]);
              }).catch(() => {});
            }
          }}
          className="rounded bg-accent-primary px-2 py-1 text-[11px] text-foreground-inverse hover:bg-accent-secondary"
        >
          💾 保存
        </button>
        <button
          onClick={() => setShowSource(false)}
          className="rounded px-1.5 py-1 text-xs text-foreground-muted hover:bg-surface-hover"
        >
          ✕
        </button>
      </div>
    </div>
    <textarea
      value={generatedHtml}
      onChange={(e) => setGeneratedHtml(e.target.value)}
      className="flex-1 resize-none bg-surface-secondary p-3 font-mono text-[11px] leading-relaxed text-foreground-primary focus:outline-none"
      spellCheck={false}
    />
  </div>
)}
```

**Step 2: 修改预览区 main 容器**

将预览区从 `flex-1` 改为条件宽度——当 showSource 时预览区缩窄：

```tsx
<main className={`flex min-w-0 ${showSource && phase === 'chat' ? 'flex-1' : 'flex-1'} flex-col overflow-hidden bg-surface-subtle`}>
```

（实际上保持 flex-1 即可，源码面板用 shrink-0 固定宽度，flex 布局自动分配。）

**Step 3: 验证 tsc**

Run: `cd apps/web && ../node_modules/.pnpm/node_modules/.bin/tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/src/routes/HtmlStudio.tsx
git commit -m "feat: add collapsible HTML source panel with manual save"
```

---

### Task 13: 更新 ProjectMeta 类型 — 添加 agentHistory 字段

**Objective:** 在共享类型中正式声明 `agentHistory` 字段，确保类型安全。

**Files:**
- Modify: `packages/shared/src/types/theme.ts` (第 268 行附近)

**Step 1: 在 `ProjectMeta` interface 中添加 agentHistory**

在 `aiHtmlStatus` 字段之后（约第 269 行后）添加：

```typescript
  /** Agent 对话历史（Report Agent 模式，存于 meta JSON）。 */
  agentHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
    action?: 'generate' | 'edit' | 'fix' | 'manual';
    ts: string;
  }>;
```

**Step 2: 验证前后端 tsc**

Run: `cd apps/web && ../node_modules/.pnpm/node_modules/.bin/tsc --noEmit`
Run: `cd apps/server && ../node_modules/.pnpm/node_modules/.bin/tsc --noEmit`
Expected: Both PASS

**Step 3: Commit**

```bash
git add packages/shared/src/types/theme.ts
git commit -m "feat: add agentHistory field to ProjectMeta type"
```

---

## 验收清单

完成后逐项验证：

- [ ] **首次生成**：配置面板 → 点击生成 → 自动保存 → 自动切换到 Chat
- [ ] **Chat 编辑**：输入「把标题改成 Test」→ 预览刷新 → 显示已保存
- [ ] **报告列表**：编辑后 `updatedAt` 刷新，按最新编辑排序
- [ ] **复制报告**：复制后副本有独立 htmlContent，可独立编辑
- [ ] **源码面板**：点「源码」→ 显示 HTML → 手动修改 → 保存 → 预览刷新
- [ ] **重新进入**：退出后重新进入报告 → 直接进入 Chat 阶段 → 历史对话加载
- [ ] **tsc 零错误**：前后端 + shared 包全量类型检查通过
- [ ] **浏览器 HMR**：dev server 无报错，页面正常渲染

## 依赖关系

```
Task 1 → Task 2    (EDIT_SYSTEM_PROMPT → editHtml)
Task 2 → Task 3    (editHtml → schema)
Task 3 → Task 4    (schema → controller+route)
Task 5 → Task 6    (autoSaveHtml → controller+route)
Task 7 (独立)       (duplicate 简化)
Task 8 (依赖 Task 4+6 的 API 已定义)
Task 9 (独立组件)
Task 10 (依赖 Task 8+9)
Task 11 (依赖 Task 10)
Task 12 (依赖 Task 10+11)
Task 13 (独立，可提前做)
```

**建议执行顺序：** 13 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12
