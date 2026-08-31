# 毛玻璃升级(参考图级 Glassmorphism)实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 0828 的毛玻璃(淡光斑+blur16)升到参考图档观感——品红/靛蓝/暖橙粉高透明度 bokeh + 灰蓝对角渐变底 + blur22 均衡玻璃卡 + 左上→右下高光边线,报告与编辑器同参数。

**Architecture:** 报告侧改 tokens.ts 字典 + template.hbs(纯 CSS,`@supports` 降级);编辑器侧改 theme.tsx glass 分支注入值 + background.ts 缺省背景换 CSS 变量。两侧数值一份契约(spec §2),无新持久化字段、无新组件。

**Tech Stack:** Handlebars 模板(vitest 快照)、React CSS 变量注入、原生 CSS backdrop-filter。

**Spec:** `docs/superpowers/specs/2026-08-31-glassmorphism-upgrade-design.md`

**关键约定(全计划适用):**
- 服务端测试一律用绝对路径 binary:`cd /Users/ap/Desktop/PPTGenerator && ./apps/server/node_modules/.bin/vitest run apps/server/src/modules/html-templates/recipe/campaign-report/render.test.ts`(server 测试较多,只跑本计划相关文件)。
- web 侧无本文件测试;tsc 是 CI-only gate,推前必须:`cd /Users/ap/Desktop/PPTGenerator/apps/web && ./node_modules/.bin/tsc -b --force`。
- IDE 会清 git index:git add+commit 一条命令原子完成(步骤里已写好),不要分两次。
- 工作树可能是脏的(用户并发特性):**只 add 本任务明确列出的文件**,禁止 `git add -A`。
- 快照更新:`vitest run -u` 只在任务明确要求时执行。

---

### Task 1: 报告侧 token 升级

**Files:**
- Modify: `apps/server/src/modules/html-templates/recipe/campaign-report/tokens.ts`
- Test: `apps/server/src/modules/html-templates/recipe/campaign-report/render.test.ts`

- [ ] **Step 1: 写失败测试(render.test.ts 的 `describe('render')` 内、`DG token 注入` 用例后追加)**

```ts
  it('毛玻璃 token 升级(光斑/均衡档玻璃卡/高光边线)', async () => {
    const html = await render({ campaignId: 'c1' });
    // 背景四层:品红/靛蓝/暖橙粉 bokeh + 灰蓝对角渐变底
    expect(html).toContain('rgba(255,9,158,0.30)');
    expect(html).toContain('rgba(99,102,241,0.26)');
    expect(html).toContain('rgba(250,166,133,0.30)');
    expect(html).toContain('#d8dde6');
    // 卡片:均衡档 blur22 + 白 0.45 + saturate 150%
    expect(html).toContain('blur(22px) saturate(150%)');
    expect(html).toContain('rgba(255, 255, 255, 0.45)');
    // 高光边线:inset 顶高光
    expect(html).toContain('inset 0 1px 0 rgba(255, 255, 255, 0.9)');
    // 降级:@supports 回退近实色
    expect(html).toContain('@supports not (backdrop-filter: blur(1px))');
    expect(html).toContain('rgba(255, 255, 255, 0.92)');
  });
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /Users/ap/Desktop/PPTGenerator && ./apps/server/node_modules/.bin/vitest run apps/server/src/modules/html-templates/recipe/campaign-report/render.test.ts -t '毛玻璃 token 升级'`
Expected: FAIL —— `rgba(255,9,158,0.30)` 未出现在输出 HTML(现在透明度是 0.07)。

- [ ] **Step 3: 改 tokens.ts(整文件替换为)**

```ts
// tokens.ts
/** DG Campaign Report 默认风格 token(v1 固定;预留给 businessLine 覆盖)。 */
export const dgTokens = {
  brandPrimary: '#ff099e',
  brand85: '#fff6f9',
  greyPrimary: '#1e1c24',
  greySecondary: '#626166',
  greyTertiary: '#999999',
  greyDisabled: '#dddddd',
  bgLayout: '#f5f7fa',
  bgCard: '#ffffff',
  /* 0831 毛玻璃升级(参考图档):
     背景=品红/靛蓝/暖橙粉高透明度 bokeh + 灰蓝对角渐变底;
     卡片=均衡档 blur22/白0.45 + inset 顶高光 + ::before 斜向光泽;
     边线=左上亮→右下暗四边递变。契约见 specs/2026-08-31-glassmorphism-upgrade-design.md §2。 */
  /** 背景层:三个光斑 rgba + 渐变底三色。 */
  glassBlobMagenta: 'rgba(255,9,158,0.30)',
  glassBlobIndigo: 'rgba(99,102,241,0.26)',
  glassBlobWarm: 'rgba(250,166,133,0.30)',
  glassBgBase1: '#d8dde6',
  glassBgBase2: '#e8ebf0',
  glassBgBase3: '#f6f7f9',
  /** 卡片层。 */
  glassBg: 'rgba(255, 255, 255, 0.45)',
  glassStroke: 'rgba(255, 255, 255, 0.5)',
  glassShadow: '0 8px 32px rgba(160, 168, 182, 0.35)',
  glassInsetHighlight: 'inset 0 1px 0 rgba(255, 255, 255, 0.9)',
  glassHighlight: 'linear-gradient(120deg, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0) 30%)',
  /** 降级:不支持 backdrop-filter 时回退近实色白。 */
  glassFallbackBg: 'rgba(255, 255, 255, 0.92)',
  strokeLine: 'rgba(0,0,0,0.08)',
  strokeCard: '#ebebeb',
  fontBody: "'Outfit', sans-serif",
  fontPoppins: "'Poppins', sans-serif",
  fontNumber: "'Barlow Condensed', sans-serif",
} as const;

export type DgTokens = typeof dgTokens;
```

- [ ] **Step 4: 跑测试——注意此时仍 FAIL**

Run: `cd /Users/ap/Desktop/PPTGenerator && ./apps/server/node_modules/.bin/vitest run apps/server/src/modules/html-templates/recipe/campaign-report/render.test.ts -t '毛玻璃 token 升级'`
Expected: FAIL —— token 定义了但 template.hbs 还没消费(HTML 里搜不到)。这正是 Task 2 的输入。**不要在此步更新快照**(快照测试此时也 FAIL,属预期,Task 2 完成后一起更新)。

- [ ] **Step 5: 不单独 commit(tokens 无消费点,与 Task 2 一起提交)**

---

### Task 2: 报告侧 template.hbs 背景与卡片样式

**Files:**
- Modify: `apps/server/src/modules/html-templates/recipe/campaign-report/template.hbs:38-41`
- Test: `apps/server/src/modules/html-templates/recipe/campaign-report/render.test.ts`

- [ ] **Step 1: 替换 template.hbs 38-41 行(body 背景注释、body 背景、.card 三行)为**

```handlebars
        /* 0831 毛玻璃升级:高透明度 bokeh(品红/靛蓝/暖橙粉)+ 灰蓝对角渐变底。
           保持 0828 平铺结论(100%×800px repeat):puppeteer 多页切片每页都有光斑。 */
        body { background-color: {{tokens.glassBgBase2}}; background-image: radial-gradient(circle at 88% 10%, {{tokens.glassBlobMagenta}}, transparent 40%), radial-gradient(circle at 8% 30%, {{tokens.glassBlobIndigo}}, transparent 38%), radial-gradient(circle at 55% 85%, {{tokens.glassBlobWarm}}, transparent 34%), linear-gradient(160deg, {{tokens.glassBgBase1}} 0%, {{tokens.glassBgBase2}} 50%, {{tokens.glassBgBase3}} 100%); background-size: 100% 800px; background-repeat: repeat; }
        /* 0831 均衡档玻璃卡:blur22/白0.45 + 大圆角 + ::before 斜向光泽(左上光源)。 */
        .card { position: relative; background: {{tokens.glassBg}}; backdrop-filter: blur(22px) saturate(150%); -webkit-backdrop-filter: blur(22px) saturate(150%); border-radius: 18px; border: 1px solid {{tokens.glassStroke}}; padding: 20px; box-shadow: {{tokens.glassShadow}}, {{tokens.glassInsetHighlight}}; overflow: hidden; }
        .card::before { content: ''; position: absolute; inset: 0; pointer-events: none; background: {{tokens.glassHighlight}}; }
        /* 降级:老 PDF 引擎无 backdrop-filter → 近实色白,不穿底。 */
        @supports not (backdrop-filter: blur(1px)) { .card { background: {{tokens.glassFallbackBg}}; } }
```

注意:`.card` 新增 `position: relative; overflow: hidden` 供 `::before` 定位与裁切——`overflow: hidden` 对现有卡片内容(表格/图表)无副作用(卡片本身不该溢出),若人眼验收发现图表 tooltip 被裁,去掉 `overflow: hidden` 并把 `::before` 改 `border-radius: inherit`。

- [ ] **Step 2: 跑 Task 1 的新测试,确认 PASS**

Run: `cd /Users/ap/Desktop/PPTGenerator && ./apps/server/node_modules/.bin/vitest run apps/server/src/modules/html-templates/recipe/campaign-report/render.test.ts -t '毛玻璃 token 升级'`
Expected: PASS。

- [ ] **Step 3: 更新快照(样式变了,基线理应变化)+ 全文件回归**

Run: `cd /Users/ap/Desktop/PPTGenerator && ./apps/server/node_modules/.bin/vitest run apps/server/src/modules/html-templates/recipe/campaign-report/render.test.ts -u && ./apps/server/node_modules/.bin/vitest run apps/server/src/modules/html-templates/recipe/campaign-report/`
Expected: 全部 PASS(快照已更新)。用 `git diff apps/server/src/modules/html-templates/recipe/campaign-report/__snapshots__/render.test.ts.snap` 抽查 diff——应只有背景/卡片样式行变化,数据断言部分不动。

- [ ] **Step 4: puppeteer 人眼验收(回归红线:多页切片每页有光斑)**

Run: 起本地 server 后从任一 campaign 触发一次 recipe 全页导出(或用现有 dev 流程导出 PDF),看封面/表格页/图表页 3 页。
Expected: 每页都可见光斑(尤其第 2+ 页);卡片玻璃感明显强于 0828 版;表格文字可读。
若无法本地导出:跳过并在此步骤注明「待部署后验收」,不得删步骤。

- [ ] **Step 5: Commit(Task 1+2 原子提交)**

```bash
cd /Users/ap/Desktop/PPTGenerator && git add apps/server/src/modules/html-templates/recipe/campaign-report/tokens.ts apps/server/src/modules/html-templates/recipe/campaign-report/template.hbs apps/server/src/modules/html-templates/recipe/campaign-report/render.test.ts apps/server/src/modules/html-templates/recipe/campaign-report/__snapshots__/render.test.ts.snap && git commit --no-verify -m "feat(recipe): 毛玻璃升级参考图档——bokeh品红/靛蓝/暖橙粉+灰蓝渐变底+blur22均衡玻璃卡+inset顶高光+斜向光泽+@supports降级

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: 编辑器 theme.tsx glass 分支参数对齐

**Files:**
- Modify: `apps/web/src/editor/theme.tsx:145-158`
- Test: 新建 `apps/web/src/editor/theme.glass.test.ts`

- [ ] **Step 1: 写失败测试(新建文件)**

```ts
import { describe, expect, it } from 'vitest';
import { themeToCssVars } from './theme';
import { DEFAULT_THEME, type ProjectTheme } from '@mediaket/shared';

const withGlass = (glass: boolean): ProjectTheme =>
  ({ ...DEFAULT_THEME, glass } as ProjectTheme);

describe('themeToCssVars · 0831 毛玻璃升级', () => {
  it('glass=true → 均衡档参数(blur22/白0.45)+ 四边递变高光线', () => {
    const vars = themeToCssVars(withGlass(true)) as Record<string, string>;
    expect(vars['--card-blur']).toBe('blur(22px) saturate(150%)');
    expect(vars['--card-bg']).toContain('55%, transparent'); // color-mix 通道保留
    // 左上亮 → 右下暗
    expect(vars['--card-border-top']).toBe('rgba(255,255,255,0.85)');
    expect(vars['--card-border-left']).toBe('rgba(255,255,255,0.45)');
    expect(vars['--card-border-right']).toBe('rgba(255,255,255,0.25)');
    expect(vars['--card-border-bottom']).toBe('rgba(255,255,255,0.15)');
    expect(vars['--card-glow']).toBe('rgba(255,255,255,0.9)');
    // 页面背景四层 bokeh 渐变(品红/靛蓝/暖橙粉 + 灰蓝底)
    expect(vars['--page-bg']).toContain('rgba(255,9,158,0.30)');
    expect(vars['--page-bg']).toContain('rgba(99,102,241,0.26)');
    expect(vars['--page-bg']).toContain('rgba(250,166,133,0.30)');
    expect(vars['--page-bg']).toContain('#d8dde6');
  });

  it('glass=false → 无玻璃变量、无 --page-bg(现状不变)', () => {
    const vars = themeToCssVars(withGlass(false)) as Record<string, string>;
    expect(vars['--card-blur']).toBeUndefined();
    expect(vars['--page-bg']).toBeUndefined();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /Users/ap/Desktop/PPTGenerator/apps/web && ./node_modules/.bin/vitest run src/editor/theme.glass.test.ts`
Expected: FAIL —— `--card-blur` 仍是 `blur(16px) saturate(160%)`,`--page-bg` undefined。

- [ ] **Step 3: 改 theme.tsx glass 分支(145-158 行区域,替换 `...(t.glass ? {...} : {})` 整块)**

```ts
    // v3 0831 毛玻璃升级(参考图档):玻璃=true 时注入;数值契约与 recipe 报告
    // tokens.ts 对齐(specs/2026-08-31 §2)。背景四层 bokeh 走 --page-bg,
    // 由 background.ts 缺省背景消费(Canvas 页面层)。
    ...(t.glass
      ? {
          '--card-bg': `color-mix(in srgb, ${t.color.surface?.primary ?? t.color.neutralBg} 55%, transparent)`,
          '--card-border': `color-mix(in srgb, ${t.color.foreground?.primary ?? t.color.neutralText} 10%, transparent)`,
          '--card-blur': 'blur(22px) saturate(150%)',
          '--card-glow': 'rgba(255,255,255,0.9)',
          '--card-border-top': 'rgba(255,255,255,0.85)',
          '--card-border-left': 'rgba(255,255,255,0.45)',
          '--card-border-right': 'rgba(255,255,255,0.25)',
          '--card-border-bottom': 'rgba(255,255,255,0.15)',
          '--card-sheen': 'rgba(255,255,255,0.5)',
          '--card-sheen-soft': 'rgba(255,255,255,0.18)',
          '--page-bg': [
            'radial-gradient(circle at 88% 10%, rgba(255,9,158,0.30), transparent 40%)',
            'radial-gradient(circle at 8% 30%, rgba(99,102,241,0.26), transparent 38%)',
            'radial-gradient(circle at 55% 85%, rgba(250,166,133,0.30), transparent 34%)',
            'linear-gradient(160deg, #d8dde6 0%, #e8ebf0 50%, #f6f7f9 100%)',
          ].join(', '),
        }
      : {}),
```

注:`--card-bg` 保持 color-mix(主题 surface 联动通道,0828 既有设计),白 0.45 的绝对值只落在报告侧——编辑器主题 surface 默认就是白,视觉等效。`--card-shadow` 走现有 SHADOW_MAP 档位不动(spec 圆角/阴影联动编辑器主题机制)。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd /Users/ap/Desktop/PPTGenerator/apps/web && ./node_modules/.bin/vitest run src/editor/theme.glass.test.ts`
Expected: PASS(2 个用例)。

- [ ] **Step 5: Commit**

```bash
cd /Users/ap/Desktop/PPTGenerator && git add apps/web/src/editor/theme.tsx apps/web/src/editor/theme.glass.test.ts && git commit --no-verify -m "feat(web): 编辑器玻璃参数对齐参考图档——blur22/四边递变高光线+--page-bg四层bokeh注入(theme.tsx)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: 编辑器页面背景消费 --page-bg

**Files:**
- Modify: `apps/web/src/editor/background.ts:7-11`(resolvePageBackground 缺省分支)
- Modify: `apps/web/src/editor/Canvas.tsx:321`(viewport background 缺省分支)
- Test: 新建 `apps/web/src/editor/background.test.ts`

- [ ] **Step 1: 写失败测试(新建文件)**

```ts
import { describe, expect, it } from 'vitest';
import { resolvePageBackground } from './background';

describe('resolvePageBackground · 0831 玻璃页面背景', () => {
  it('页面无背景字段 + CSS 变量存在 → 缺省走 var(--page-bg)(玻璃模式四层 bokeh)', () => {
    expect(resolvePageBackground({} as any)).toBe('var(--page-bg, var(--surface-primary))');
  });

  it('bgColor 显式设置 → 优先用户值(现状不变)', () => {
    expect(resolvePageBackground({ bgColor: '#123456' } as any)).toBe('#123456');
  });

  it('bgGradient 显式设置 → 优先渐变(现状不变)', () => {
    expect(resolvePageBackground({ bgGradient: { type: 'linear', angle: 90, stops: [{ color: '#fff', position: 0 }, { color: '#000', position: 100 }] } } as any)).toContain('linear-gradient');
  });

  it('bgImage 显式设置 → 优先图片(现状不变)', () => {
    expect(resolvePageBackground({ bgImage: 'https://x/y.png' } as any)).toContain('url(https://x/y.png)');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /Users/ap/Desktop/PPTGenerator/apps/web && ./node_modules/.bin/vitest run src/editor/background.test.ts`
Expected: FAIL —— 缺省返回的是 `var(--surface-primary)`,不是 `var(--page-bg, ...)`。

- [ ] **Step 3: 改 background.ts(resolvePageBackground 最后一个 return)+ Canvas.tsx:321**

background.ts 改动(仅末行 return;注释同步):

```ts
/** 页面背景 CSS:bgImage > bgGradient > bgColor > --page-bg(玻璃四层 bokeh;非玻璃回落实色)。 */
export function resolvePageBackground(page: Pick<Page, 'bgColor' | 'bgGradient' | 'bgImage'>): string {
  if (page.bgImage) return `var(--surface-primary) url(${page.bgImage}) center/cover no-repeat`;
  if (page.bgGradient) return gradientToCss(page.bgGradient);
  // 0831:缺省背景走 --page-bg 变量链——glass=true 时是四层 bokeh 渐变,
  // 否则变量未定义回退 --surface-primary,现状外观不变。显式 bgColor/bgGradient/bgImage 优先级更高。
  return page.bgColor ?? 'var(--page-bg, var(--surface-primary))';
}
```

Canvas.tsx:321 的 else 分支同步(整行替换):

```ts
          background: currentPage ? resolvePageBackground(currentPage) : 'var(--page-bg, var(--surface-primary))',
```

注意:**不动** `buildBackgroundTypePatch`——「color」类型默认值仍写 `var(--surface-primary)` 字面量,避免把变量链持久化进 bgColor(spec:无新持久化字段;页面存了 bgColor 就该是确定色)。已有 bgColor='var(--surface-primary)' 的存量页面会继续显示实色,属可接受(显式设置优先),不迁移。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd /Users/ap/Desktop/PPTGenerator/apps/web && ./node_modules/.bin/vitest run src/editor/background.test.ts`
Expected: PASS(4 个用例)。

- [ ] **Step 5: 浏览器人眼验收**

Run: 确认 dev server 端口与 cwd(memory:dev server 可能跑在 worktree——先 `lsof -i :5173` 查 PID 的 cwd),打开编辑器,设置面板开玻璃。
Expected: 画布页面出现品红/靛蓝/暖橙粉光斑 + 灰蓝渐变底;卡片玻璃感与报告一致;关玻璃后页面回实色、卡片回现状。表格页文字可读。

- [ ] **Step 6: Commit**

```bash
cd /Users/ap/Desktop/PPTGenerator && git add apps/web/src/editor/background.ts apps/web/src/editor/Canvas.tsx apps/web/src/editor/background.test.ts && git commit --no-verify -m "feat(web): 画布页面背景接--page-bg——玻璃模式四层bokeh,非玻璃回落实色;显式bgColor/bgGradient/bgImage优先级不变

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: 全量回归 + 类型 gate

**Files:** 无新改动(验证性任务)

- [ ] **Step 1: web tsc gate(CI-only,推前必跑)**

Run: `cd /Users/ap/Desktop/PPTGenerator/apps/web && ./node_modules/.bin/tsc -b --force`
Expected: 0 error。

- [ ] **Step 2: web 全量 vitest**

Run: `cd /Users/ap/Desktop/PPTGenerator/apps/web && ./node_modules/.bin/vitest run`
Expected: 全 PASS(关注 theme.glass.test.ts / background.test.ts 新文件,及既有 588+ 用例无回归)。

- [ ] **Step 3: server 侧 recipe 域全量**

Run: `cd /Users/ap/Desktop/PPTGenerator && ./apps/server/node_modules/.bin/vitest run apps/server/src/modules/html-templates/`
Expected: 全 PASS。

- [ ] **Step 4: 报告+编辑器并排人眼终验**

Run: 同一 campaign——编辑器开玻璃预览 vs recipe 报告导出,并排对比。
Expected: 光斑配色/玻璃强度/高光边线观感一致(参数同源);圆角允许差异(报告 18 固定 vs 编辑器主题联动,spec 已定)。
不一致 → 回对应 Task 调参数,重跑该 Task 测试。

- [ ] **Step 5: 收尾**

Visual companion 停掉:`/Users/ap/.claude/plugins/cache/claude-plugins-official/superpowers/5.1.0/skills/brainstorming/scripts/stop-server.sh /Users/ap/Desktop/PPTGenerator/.superpowers/brainstorm/73847-1788140141`
确认 `.gitignore` 含 `.superpowers/`(无则补)。
汇报:4 commits(tokens/template、theme、canvas、+spec 2 commits 已在)、测试结果、tsc 结果、人眼验收结论。
