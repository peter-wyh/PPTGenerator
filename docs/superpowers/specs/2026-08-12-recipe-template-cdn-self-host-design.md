# Recipe 报告模板 CDN 自托管 — 设计

- **日期**: 2026-08-12
- **状态**: 设计已确认,待评审 → 转 writing-plans
- **范围**: recipe 报告模板(`template.hbs`)+ 渲染入口(`render.ts`)的海外 CDN 自托管/镜像
- **关联**: [[report-cdn-self-hosted-vendor]](AI 报告的 CDN 自托管,已完成)、`docs/superpowers/specs/2026-08-12-report-roas-kpi-design.md` 代码评审 M-1 发现

## 背景

recipe 报告(`template.hbs` 经 Handlebars 服务端渲染)目前从 **4 个海外 CDN** 拉资源,国内生产不可达:
- `fonts.googleapis.com` / `fonts.gstatic.com`(Google Fonts:Barlow Condensed / Noto Sans / Outfit / Poppins,line 8-10)
- `cdn.tailwindcss.com`(Tailwind play CDN,line 12)→ **无样式**
- `cdnjs.cloudflare.com/.../font-awesome/6.0.0`(line 13)→ **无图标**
- `cdn.jsdelivr.net/npm/chart.js`(line 14)→ **图表不渲染**

后果:recipe 报告在国内生产**裸 HTML**(无布局/无图表/无图标)。之前的 CDN 自托管工作只覆盖了 **AI 报告**(`rewriteExternalAssets` 后处理),recipe 模板被漏掉。

`apps/web/public/vendor/` 已有自托管资源(早前 AI 报告那批):`tailwind/play.min.js`、`chartjs/chart.umd.min.js`(4.4.0)、`fontawesome/css/all.min.css`(6.5.1)+ webfonts。Google Fonts 无自托管资源。

## 目标 / 非目标

**目标**: recipe 模板的 Tailwind / Chart.js / FontAwesome 改用自托管(`/vendor/`,经 `vendorBase` 绝对路径,与 AI 报告一致);Google Fonts 改用国内镜像(`fonts.loli.net`)。recipe 报告在国内生产恢复样式/图表/图标。

**非目标**:
- 不自托管 Google Fonts(用户决策:换国内镜像;自托管 4 家族太重)。
- 不改 AI 报告路径(`rewriteExternalAssets` 已处理)。
- 不改 recipe 模板的其它内容(结构/样式逻辑不动)。
- 不改 `index.html`(app 自己的 fontawesome 已在早前换自托管)。

## 改动

### 1. `apps/server/src/modules/html-templates/recipe/campaign-report/render.ts`
注入 `vendorBase`(与 `ai-generate.service.ts` 的 `SELF_HOST_BASE` 同源逻辑:`PUBLIC_BASE_URL || config.webUrl`),传给模板:
```ts
import { config } from '../../../../config';   // 若未 import 则加
// ...
const vendorBase = (process.env.PUBLIC_BASE_URL || config.webUrl || '').replace(/\/+$/, '');
// ...
return compiled({ ...content, tokens, components, vendorBase });
```
(本地算一行,与 ai-generate 的 SELF_HOST_BASE 各自维护;若后续想 DRY 可抽共享 util,本次不做。)

### 2. `apps/server/src/modules/html-templates/recipe/campaign-report/template.hbs`(head 四处)
- **Google Fonts → 国内镜像**(`fonts.loli.net`,单主机同时服务 CSS+字体):
  - line 8: `<link rel="preconnect" href="https://fonts.googleapis.com">` → `href="https://fonts.loli.net"`
  - line 9: `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` → `href="https://fonts.loli.net" crossorigin`
  - line 10: `href="https://fonts.googleapis.com/css2?..."` → `href="https://fonts.loli.net/css2?..."`(query 不变)
- **Tailwind** line 12: `<script src="https://cdn.tailwindcss.com"></script>` → `<script src="{{vendorBase}}/vendor/tailwind/play.min.js"></script>`
- **FontAwesome** line 13: `cdnjs.../font-awesome/6.0.0/css/all.min.css` → `{{vendorBase}}/vendor/fontawesome/css/all.min.css`(6.0.0→6.5.1,向下兼容)
- **Chart.js** line 14: `https://cdn.jsdelivr.net/npm/chart.js` → `{{vendorBase}}/vendor/chartjs/chart.umd.min.js`(4.4.0 umd)

## 关键决策(已确认)
1. **Tailwind/Chart/FA → 自托管 `/vendor/`**:资源已就绪(早前 AI 报告那批),经 `vendorBase` 绝对路径(export-safe,与 AI 报告 `rewriteExternalAssets` 一致)。
2. **Google Fonts → 国内镜像 `fonts.loli.net`**(用户决策:换镜像,不自托管):单主机同时服务 CSS+字体,preconnect + href 都指它。第三方镜像,若日后不稳可一行换(`fonts.googleapis.cn` 等)。
3. **`vendorBase` 用绝对路径**(PUBLIC_BASE_URL/webUrl):recipe HTML 经 `<iframe srcDoc>` 显示 + 存 DB + 可导出;绝对路径 export-safe(相对 `/vendor/...` 在 srcdoc 同源能用,但导出独立 HTML 会断)。

## 边界 / 风险
- ⚠️ **`vendorBase` 为空**(PUBLIC_BASE_URL/WEB_URL 都没设)→ 模板渲染成 `/vendor/...`(相对),srcdoc 同源可用、export 断。与 AI 报告同病同源:prod 需设 `PUBLIC_BASE_URL`(见 [[report-cdn-self-hosted-vendor]])。
- ⚠️ **FontAwesome 6.0.0 → 6.5.1**:向下兼容(图标 class 基本稳定);极少数 6.0 图标在 6.5 若改名需复核(recipe 模板用的图标都是常见 fa-* 类,风险低)。
- ⚠️ **Chart.js bare → 4.4.0 umd**:recipe 用的是基础 line/bar/new Chart API,4.4.0 稳定。
- ⚠️ **Google Fonts 镜像依赖第三方**(loli.net):若宕机字体回退系统字体(不致命,布局/图表/图标已修)。

## 测试
- **`render.test.ts`**:现有快照会变(head 的 CDN URL 全换)→ **重新生成快照**(`vitest -u`)。新增显式断言:渲染 HTML 含 `{{vendorBase}}/vendor/tailwind/play.min.js`、`/vendor/chartjs/chart.umd.min.js`、`/vendor/fontawesome/css/all.min.css`、`fonts.loli.net`;**不含** `cdn.tailwindcss.com`/`cdn.jsdelivr.net`/`cdnjs.cloudflare.com`/`fonts.googleapis.com`。(test 环境 vendorBase = `config.webUrl`(默认 `http://localhost:5173`),确定性的。)
- server tsc。

## 文件改动
| 文件 | 动作 |
|---|---|
| `apps/server/src/modules/html-templates/recipe/campaign-report/render.ts` | 注入 `vendorBase` |
| `apps/server/src/modules/html-templates/recipe/campaign-report/template.hbs` | head 四处 CDN 替换 |
| `apps/server/src/modules/html-templates/recipe/campaign-report/render.test.ts` | 重生成快照 + 加 CDN 断言 |

(纯 server;无 web 改动 —— `/vendor/` 资源早前已加。)
