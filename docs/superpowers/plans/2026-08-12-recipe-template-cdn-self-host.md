# Recipe 模板 CDN 自托管 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** recipe 报告模板的 Tailwind/Chart.js/FontAwesome 改自托管 `/vendor/`,Google Fonts 改国内镜像 `fonts.loli.net`,经 `render.ts` 注入的 `vendorBase` 绝对路径引用 —— 修复国内生产 recipe 报告裸 HTML(无样式/图表/图标)。

**Architecture:** `render.ts` 注入 `vendorBase`(`PUBLIC_BASE_URL || config.webUrl`,与 AI 报告 `SELF_HOST_BASE` 同源)到 Handlebars 上下文;`template.hbs` head 四处 CDN 引用替换;`render.test.ts` 重新生成快照(head 变了)+ 加显式 CDN 断言。

**Tech Stack:** Node + Handlebars(recipe 模板)、Vitest。

**Spec:** `docs/superpowers/specs/2026-08-12-recipe-template-cdn-self-host-design.md`

---

## File Structure

| 文件 | 职责 | 动作 |
|---|---|---|
| `apps/server/src/modules/html-templates/recipe/campaign-report/render.ts` | recipe 渲染入口 | 注入 `vendorBase` 到模板上下文(+ import config) |
| `apps/server/src/modules/html-templates/recipe/campaign-report/template.hbs` | recipe HTML 模板 | head 四处 CDN 替换(3→自托管,1→镜像) |
| `apps/server/src/modules/html-templates/recipe/campaign-report/render.test.ts` | render 单测 | 加 CDN 断言 + 重新生成快照 |
| `apps/server/src/modules/html-templates/recipe/campaign-report/__snapshots__/render.test.ts.snap` | 快照基线 | 重新生成(head URL 变了) |

---

## Task 1: recipe 模板 CDN 自托管(单 task,TDD)

**Files:**
- Modify: `apps/server/src/modules/html-templates/recipe/campaign-report/render.ts`
- Modify: `apps/server/src/modules/html-templates/recipe/campaign-report/template.hbs`
- Modify: `apps/server/src/modules/html-templates/recipe/campaign-report/render.test.ts`
- Regenerate: `apps/server/src/modules/html-templates/recipe/campaign-report/__snapshots__/render.test.ts.snap`

- [ ] **Step 1: 写失败测试** —— 在 `render.test.ts` 的 `describe('render', ...)` 内加一个 CDN 断言用例(复用现有 `beforeEach` 默认 mock 的 `campaignRow`):

```ts
  it('资源走自托管 /vendor/ + Google Fonts 国内镜像(无海外 CDN)', async () => {
    const html = await render({ campaignId: 'c1' });
    // 三个自托管资源(用后缀断言,与 vendorBase 具体值无关)
    expect(html).toContain('/vendor/tailwind/play.min.js');
    expect(html).toContain('/vendor/chartjs/chart.umd.min.js');
    expect(html).toContain('/vendor/fontawesome/css/all.min.css');
    // Google Fonts 国内镜像
    expect(html).toContain('fonts.loli.net');
    // 不含四个海外 CDN
    expect(html).not.toContain('cdn.tailwindcss.com');
    expect(html).not.toContain('cdn.jsdelivr.net/npm/chart.js');
    expect(html).not.toContain('cdnjs.cloudflare.com');
    expect(html).not.toContain('fonts.googleapis.com');
  });
```

- [ ] **Step 2: 跑测试,确认失败**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/server && pnpm exec vitest run src/modules/html-templates/recipe/campaign-report/render.test.ts
```
Expected: FAIL —— 新用例挂(template 仍是海外 CDN,`not.toContain('cdn.tailwindcss.com')` 等失败)。现有快照用例此刻仍过(template 未改)。

- [ ] **Step 3a: `render.ts` 注入 vendorBase**

3a-1. 顶部加 import(与其它 import 并列;`config` 当前未 import):
```ts
import { config } from '../../../../config';
```
3a-2. 在 `const compiled = ...` 之后(模块级,与 `SELF_HOST_BASE` 同模式)加:
```ts
// recipe 报告自托管资源基础 URL(与 ai-generate.service.ts 的 SELF_HOST_BASE 同源);
// 模板里 {{vendorBase}}/vendor/... 引用。空则回退相对路径(srcdoc 同源可用,export 断)。
const vendorBase = (process.env.PUBLIC_BASE_URL || config.webUrl || '').replace(/\/+$/, '');
```
3a-3. 把 `render` 末尾的 return:
```ts
  return compiled({ ...content, tokens, components });
```
改成:
```ts
  return compiled({ ...content, tokens, components, vendorBase });
```

- [ ] **Step 3b: `template.hbs` head 四处 CDN 替换**

把(约 line 8-14):
```hbs
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600&family=Noto+Sans:wght@400;500;600&family=Outfit:wght@400;500;600;700&family=Poppins:wght@400;500;600&display=swap" rel="stylesheet">

    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
```
改成:
```hbs
    <link rel="preconnect" href="https://fonts.loli.net">
    <link rel="preconnect" href="https://fonts.loli.net" crossorigin>
    <link href="https://fonts.loli.net/css2?family=Barlow+Condensed:wght@500;600&family=Noto+Sans:wght@400;500;600&family=Outfit:wght@400;500;600;700&family=Poppins:wght@400;500;600&display=swap" rel="stylesheet">

    <script src="{{vendorBase}}/vendor/tailwind/play.min.js"></script>
    <link href="{{vendorBase}}/vendor/fontawesome/css/all.min.css" rel="stylesheet">
    <script src="{{vendorBase}}/vendor/chartjs/chart.umd.min.js"></script>
```

- [ ] **Step 4: 重新生成快照 + 跑测试**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/server && pnpm exec vitest run -u src/modules/html-templates/recipe/campaign-report/render.test.ts
```
Expected: 新 CDN 用例 PASS;现有 `HTML 快照` 用例 PASS(快照已用 `-u` 更新成新的 head URL)。确认 `__snapshots__/render.test.ts.snap` 被更新(git status 显示该文件 modified)。

- [ ] **Step 5: server tsc**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/server && pnpm exec tsc -b --force
```
Expected: exit 0。

- [ ] **Step 6: 提交(4 文件,atomic)**

```bash
cd /Users/ap/Desktop/PPTGenerator && git add apps/server/src/modules/html-templates/recipe/campaign-report/render.ts apps/server/src/modules/html-templates/recipe/campaign-report/template.hbs apps/server/src/modules/html-templates/recipe/campaign-report/render.test.ts apps/server/src/modules/html-templates/recipe/campaign-report/__snapshots__/render.test.ts.snap && git commit -m "$(cat <<'EOF'
fix(recipe): 模板 CDN 自托管 —— Tailwind/Chart/FA 走 /vendor/,Google Fonts 走 loli.net

render.ts 注入 vendorBase(PUBLIC_BASE_URL||webUrl)到模板上下文;template.hbs head
四处替换:Tailwind/Chart.js/FontAwesome → {{vendorBase}}/vendor/...(自托管,与 AI 报告
rewriteExternalAssets 一致);Google Fonts → fonts.loli.net 国内镜像。修复国内生产
recipe 报告裸 HTML(无样式/图表/图标)。重生成 render 快照 + 加 CDN 断言。

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## 收尾验证

- [ ] **Step 1: recipe 模块全测**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/server && pnpm exec vitest run src/modules/html-templates/recipe/
```
Expected: 全过(format/mapper/render/narrative/schema)。render 快照为更新后版本。

- [ ] **Step 2: server tsc**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/server && pnpm exec tsc -b --force
```
Expected: exit 0。

> 注:仓库更广 server 套件有与本次无关的预存失败(用户 WIP:projects 模块等),不属本范围。本计划只对 recipe 模板负责。

---

## Self-Review

**1. Spec coverage:**
- `render.ts` 注入 vendorBase → Step 3a。✓
- template.hbs Tailwind/Chart/FA → {{vendorBase}}/vendor/ → Step 3b。✓
- template.hbs Google Fonts → fonts.loli.net → Step 3b。✓
- render.test.ts 重生成快照 + CDN 断言 → Step 1 + Step 4。✓
- 关键决策(3 自托管 + 镜像 + vendorBase 绝对路径)→ Step 3 体现。✓

**2. Placeholder scan:** 无 TBD;render.ts 三处精确编辑(import + const + return)给全;template.hbs 给完整 before/after 块;测试断言确切;命令带 expected。✓

**3. Type consistency:** `vendorBase: string`(模块级 const)在 render.ts 定义、传给 compiled、template `{{vendorBase}}` 引用 —— 一致。`config.webUrl` 已存在(buildCampaignContext 用过)。✓

无问题,无需返工。
