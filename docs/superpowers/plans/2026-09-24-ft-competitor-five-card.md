# FT 月报竞品分析五卡重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 FT 月报指南(`cmt_ft_monthly_001`)的 Competitor Analysis 章从单表形态重构为参考图的五维度卡片 × Data→Insight→Action 固定三段结构,走「参考模板 → CSS 资产 → 指南 v20 → 断言 → GlowLab 实测」全链路。

**Architecture:** 视觉确定性走资产工程路线——新 `.comp-*`/`.cc-*` 组件类追加进 `ft-recap/base.css`(经 `<!--GUIDE_CSS-->` 字节级注入,色值不过 LLM);结构规则重写进 GuideRevision v20(5 处 compare-table 引用点全部替换);validator `checks` 追加数量/禁用断言兜底 AI 拼错;最后以 GlowLab campaign 实测生成 A/B 验证(铁律 1)。

**Tech Stack:** 手写 HTML/CSS(FT design tokens CSS vars)、Chart.js 4(doughnut/radar)、mysql2 直连本地库(端口 3317)、tsx 跑 TS 脚本、jose 签 dev JWT 调 server API(:4000)。

**Spec:** `docs/superpowers/specs/2026-09-24-ft-competitor-five-card-design.md`

**关键上下文(零上下文执行者必读):**
- 本地 DB:`apps/server/.env` 的 `DATABASE_URL`(mysql, 127.0.0.1:3317/mediakit)。**所有 `node -e`/mysql2 脚本必须 `cd apps/server` 后跑**(mysql2 只在该目录 node_modules)。
- 指南真源 = `GuideRevision` 表 active 行(不是 `Guide.content` 列);生成链路读 `ensureActiveRevision`。
- GlowLab:projectId `cmuc13qo7000h6cockqglovg5`,campaignId `camp-glowlab-q4`,现役版本 v5.3(id `cmuc153xy000j6coctd0p935y`)。**存量 v5.3 不动**。
- server 端口 4000(`apps/server/.env` PORT)。生成 2-3 分钟,DeepSeek 间歇 500(socket 180s 断)重试一次即可。
- 提交纪律(memory):**git add + commit 一条原子命令**,防 IDE 清 index。

---

### Task 1: 参考模板 standalone HTML(像素真源)

**Files:**
- Create: `Example/FT_Competitor_Insights_Ref.html`

- [ ] **Step 1: 写入完整模板文件**

完整内容如下(Chart.js 用相对路径引 web 仓库自托管 vendor;03/05 卡含样例值,已在注释与 SAMPLE 标记声明):

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>FT Competitor Analysis — Five-Card Design Reference (0924)</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;500;600;700&family=Poppins:wght@500;600;700&display=swap" rel="stylesheet">
<style>
/* ========= preview-only stand-ins(非资产,仅供独立预览章节上下文) ========= */
body{ background:#ECECF2; font-family:"Inter",Arial,sans-serif; margin:0; padding:28px; }
.page{ max-width:1120px; margin:0 auto; background:#F9F8F5; border-radius:20px; padding:36px 44px; }
.section-head{ display:flex; align-items:center; gap:12px; margin:0 0 10px; }
.badge.violet{ width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:#fff;background:#6F60A4; }
h2{ font-family:"Libre Baskerville",Georgia,serif; font-size:24px; margin:0; color:#1E1E1E; }
.section-sub{ color:#8B8B93; font-size:13px; margin:0 0 4px; }
.ref-banner{ max-width:1120px;margin:0 auto 14px;padding:10px 16px;border-radius:12px;background:#FFF6E8;border:1px solid #EAD4A8;color:#8A5A13;font-size:12px; }

/* ========= ↓↓↓ 0924 资产块(与 ft-recap/base.css 追加块字节一致,提取区间标记) ↓↓↓ ========= */
.comp-board{
  margin-top:18px; border-radius:var(--radius-md); padding:22px;
  background:linear-gradient(150deg, var(--color-aubergine) 0%, #1E1730 100%);
  border:1px solid rgba(213,239,154,.10);
}
.comp-grid{ display:grid; grid-template-columns:repeat(5,1fr); gap:14px; }
@media (max-width:1100px){ .comp-grid{ grid-template-columns:repeat(3,1fr); } }
@media (max-width:760px){ .comp-grid{ grid-template-columns:repeat(2,1fr); } }
@media (max-width:480px){ .comp-grid{ grid-template-columns:1fr; } }
.comp-card{
  position:relative; display:flex; flex-direction:column; gap:10px;
  background:var(--color-white); border-radius:12px; padding:14px 12px 12px;
  box-shadow:0 4px 12px rgba(0,0,0,.25); min-width:0;
}
.cc-no{
  position:absolute; top:6px; right:10px; font-family:var(--font-display);
  font-size:30px; line-height:1; color:var(--color-aubergine); opacity:.08; font-weight:700;
}
.cc-title{ margin:0; font-family:var(--font-body); font-size:12.5px; font-weight:700; color:var(--color-aubergine-2); }
.cc-sub{ margin:2px 0 0; font-family:var(--font-body); font-size:9.5px; line-height:1.4; color:#8B8B93; }
.cc-seg{ border-radius:10px; padding:9px 10px; }
.cc-seg .cc-tag{
  display:flex; align-items:center; gap:5px; margin-bottom:6px;
  font-family:var(--font-body); font-size:8.5px; font-weight:700; letter-spacing:.14em; text-transform:uppercase;
}
.cc-seg .cc-tag::before{ content:""; width:6px; height:6px; border-radius:50%; background:currentColor; }
.cc-data{ background:var(--color-warm-white); border:1px solid var(--color-divider); }
.cc-data .cc-tag{ color:var(--color-violet); }
.cc-insight{ background:rgba(136,219,165,.18); border:1px solid rgba(136,219,165,.5); }
.cc-insight .cc-tag{ color:#2E6B49; }
.cc-action{ background:rgba(255,168,205,.16); border:1px solid rgba(255,168,205,.5); }
.cc-action .cc-tag{ color:#A33B6C; }
.cc-seg p{ margin:0; font-family:var(--font-body); font-size:10.5px; line-height:1.55; color:var(--color-ink); }
.cc-seg p b{ font-weight:700; color:var(--color-aubergine-2); }
.cc-table{ width:100%; border-collapse:collapse; font-family:var(--font-body); font-size:10px; }
.cc-table th, .cc-table td{ padding:6px 7px; text-align:right; border-bottom:1px solid var(--color-divider); white-space:nowrap; }
.cc-table tr:last-child td{ border-bottom:none; }
.cc-table th{ font-size:9px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#8B8B93; border-bottom:1px solid var(--color-border); }
.cc-table th:first-child, .cc-table td:first-child{ text-align:left; color:var(--color-ink); font-weight:600; }
.cc-table td.us{ font-weight:700; color:var(--color-aubergine-2); }
.cc-table td.rival{ color:#B9B9C0; }
.cc-chart{ position:relative; height:130px; }
.cc-chart canvas{ max-height:130px; }
.cc-kv{ display:flex; align-items:baseline; justify-content:space-between; margin-top:8px; }
.cc-kv .cc-kv-v{ font-family:var(--font-body); font-size:20px; font-weight:700; color:var(--color-aubergine-2); }
.cc-kv .cc-kv-k{ font-family:var(--font-body); font-size:9px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:#8B8B93; }
.cc-bars{ display:flex; flex-direction:column; gap:8px; }
.cbar .cbar-head{ display:flex; justify-content:space-between; align-items:baseline; margin-bottom:3px; }
.cbar .cbar-label{ font-family:var(--font-body); font-size:9.5px; font-weight:600; color:var(--color-ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cbar .cbar-val{ font-family:var(--font-body); font-size:9.5px; font-weight:700; color:var(--color-aubergine-2); flex:none; margin-left:6px; }
.cbar .cbar-track{ height:7px; border-radius:99px; background:var(--color-surface-soft); overflow:hidden; }
.cbar .cbar-fill{ height:100%; border-radius:99px; background:linear-gradient(90deg, var(--color-violet), var(--color-pink-active)); }
.cbar.top .cbar-fill{ background:linear-gradient(90deg, var(--color-pink), var(--color-pink-active)); }
.cc-kpis{ display:grid; grid-template-columns:repeat(2,1fr); gap:7px; }
.ckpi{ background:var(--color-white); border:1px solid var(--color-divider); border-radius:9px; padding:7px 8px; }
.ckpi .ckpi-v{ font-family:var(--font-body); font-size:15px; font-weight:700; color:var(--color-aubergine-2); }
.ckpi .ckpi-k{ display:block; font-family:var(--font-body); font-size:8.5px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:#8B8B93; margin-top:2px; }
.ckpi .ckpi-delta{ display:inline-block; margin-left:5px; font-size:9px; font-weight:700; }
.ckpi .ckpi-delta.up{ color:#2E7D4F; }
.ckpi .ckpi-delta.down{ color:#C0392B; }
.cc-pool{ display:flex; flex-direction:column; gap:6px; }
.cc-pool .cpool-head{ font-family:var(--font-body); font-size:9px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#8B8B93; }
.cpool-row{ display:flex; align-items:center; gap:7px; }
.cpool-row .avatar{ width:20px; height:20px; font-size:9px; }
.cpool-row .cpool-name{ flex:1; min-width:0; font-family:var(--font-body); font-size:10px; font-weight:600; color:var(--color-ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cpool-row .cpool-metric{ font-family:var(--font-body); font-size:9.5px; font-weight:700; color:var(--color-aubergine-2); flex:none; }
.comp-note{ font-size:11px; color:rgba(249,248,245,.55); margin:14px 6px 0; }
/* ========= ↑↑↑ 0924 资产块结束 ========= */
</style>
</head>
<body>
<div class="ref-banner">DESIGN REFERENCE (0924) — Cards 01/02/04 use real GlowLab Oct-2026 values; Card 03 percentages and Card 05 radar values are SAMPLES (render only when real data exists). Review annotations from the source mockup (green "fixed module" pills, demo stickers, signature) are intentionally excluded.</div>
<div class="page">
  <div class="section">
    <div class="section-head"><div class="badge violet">06</div><h2>Competitor Analysis</h2></div>
    <p class="section-sub">How GlowLab's campaign on FANSTOSHOP compares against similar brands / channels in the same category.</p>
    <div class="comp-board">
      <div class="comp-grid">

        <div class="comp-card">
          <div class="cc-no">01</div>
          <h4 class="cc-title">Commercial Commission</h4>
          <p class="cc-sub">Commission model &amp; spend efficiency</p>
          <div class="cc-seg cc-data"><div class="cc-tag">Data</div>
            <table class="cc-table">
              <thead><tr><th>Metric</th><th>Our</th><th>Rival</th></tr></thead>
              <tbody>
                <tr><td>Commission Model</td><td class="us">CPA 16%</td><td class="rival">—</td></tr>
                <tr><td>Avg. CPA</td><td class="us">$5.19</td><td class="rival">—</td></tr>
                <tr><td>Est. Monthly Spend</td><td class="us">$300K</td><td class="rival">—</td></tr>
              </tbody>
            </table>
          </div>
          <div class="cc-seg cc-insight"><div class="cc-tag">Insight</div><p>CPA commission (16%) is the only spend lever; blended CPA of <b>$5.19</b> stays well below the $300K monthly cap.</p></div>
          <div class="cc-seg cc-action"><div class="cc-tag">Action</div><p>Hold the CPA model; renegotiate volume tiers before Q1.</p></div>
        </div>

        <div class="comp-card">
          <div class="cc-no">02</div>
          <h4 class="cc-title">Creator Strategy</h4>
          <p class="cc-sub">Concentration of the creator portfolio</p>
          <div class="cc-seg cc-data"><div class="cc-tag">Data</div>
            <div class="cc-chart"><canvas id="compCreatorMix"></canvas></div>
            <div class="cc-kv"><span class="cc-kv-v">17</span><span class="cc-kv-k">Creators</span></div>
          </div>
          <div class="cc-seg cc-insight"><div class="cc-tag">Insight</div><p>Top 2 creators drive <b>20%</b> of 1.1K orders; the long tail of 15 delivers the rest.</p></div>
          <div class="cc-seg cc-action"><div class="cc-tag">Action</div><p>Re-book Mia Chen &amp; Iris Lin; brief 3 lookalikes in November.</p></div>
        </div>

        <div class="comp-card">
          <div class="cc-no">03</div>
          <h4 class="cc-title">Content Strategy</h4>
          <p class="cc-sub">Share of top-creator content by theme (SAMPLE)</p>
          <div class="cc-seg cc-data"><div class="cc-tag">Data</div>
            <div class="cc-bars">
              <div class="cbar top"><div class="cbar-head"><span class="cbar-label">Honest Review</span><span class="cbar-val">34%</span></div><div class="cbar-track"><div class="cbar-fill" style="width:34%"></div></div></div>
              <div class="cbar"><div class="cbar-head"><span class="cbar-label">Routine Format</span><span class="cbar-val">27%</span></div><div class="cbar-track"><div class="cbar-fill" style="width:27%"></div></div></div>
              <div class="cbar"><div class="cbar-head"><span class="cbar-label">Unboxing</span><span class="cbar-val">22%</span></div><div class="cbar-track"><div class="cbar-fill" style="width:22%"></div></div></div>
              <div class="cbar"><div class="cbar-head"><span class="cbar-label">Tutorial</span><span class="cbar-val">17%</span></div><div class="cbar-track"><div class="cbar-fill" style="width:17%"></div></div></div>
            </div>
          </div>
          <div class="cc-seg cc-insight"><div class="cc-tag">Insight</div><p>"Honest Review" and routine formats dominate this month's top creator content.</p></div>
          <div class="cc-seg cc-action"><div class="cc-tag">Action</div><p>Scale both formats into the Xiaohongshu rotation.</p></div>
        </div>

        <div class="comp-card">
          <div class="cc-no">04</div>
          <h4 class="cc-title">Performance</h4>
          <p class="cc-sub">Efficiency &amp; conversion vs last month</p>
          <div class="cc-seg cc-data"><div class="cc-tag">Data</div>
            <div class="cc-kpis">
              <div class="ckpi"><span class="ckpi-v">1.1%<span class="ckpi-delta up">▲</span></span><span class="ckpi-k">Avg. CTR</span></div>
              <div class="ckpi"><span class="ckpi-v">$5.19</span><span class="ckpi-k">Avg. CPA</span></div>
              <div class="ckpi"><span class="ckpi-v">1.1K<span class="ckpi-delta up">+23.4%</span></span><span class="ckpi-k">Orders</span></div>
              <div class="ckpi"><span class="ckpi-v">47%</span><span class="ckpi-k">New-Customer</span></div>
            </div>
            <div class="cc-pool">
              <span class="cpool-head">Top Creators Pool</span>
              <div class="cpool-row"><span class="avatar">M</span><span class="cpool-name">Mia Chen</span><span class="cpool-metric">116 orders</span></div>
              <div class="cpool-row"><span class="avatar">I</span><span class="cpool-name">Iris Lin</span><span class="cpool-metric">106 orders</span></div>
            </div>
          </div>
          <div class="cc-seg cc-insight"><div class="cc-tag">Insight</div><p>Orders <b>+23.4% MoM</b> on 30.6K clicks; new-customer rate at 47%.</p></div>
          <div class="cc-seg cc-action"><div class="cc-tag">Action</div><p>Shift budget to back-half peaks — top 5 revenue days all landed on or after Oct 17.</p></div>
        </div>

        <div class="comp-card">
          <div class="cc-no">05</div>
          <h4 class="cc-title">Gap &amp; Opportunity</h4>
          <p class="cc-sub">SAMPLE — renders only with real multi-dim competitor data</p>
          <div class="cc-seg cc-data"><div class="cc-tag">Data</div>
            <div class="cc-chart"><canvas id="compRadar"></canvas></div>
          </div>
          <div class="cc-seg cc-insight"><div class="cc-tag">Insight</div><p>Rival leads on Spend &amp; Creator breadth; Our wins on Commission efficiency.</p></div>
          <div class="cc-seg cc-action"><div class="cc-tag">Action</div><p>Close the creator-breadth gap via Influencer Hub packages.</p></div>
        </div>

      </div>
      <p class="comp-note">Data source: Fanstoshop campaign dashboard &amp; order table, Oct 2026. Competitor channel metrics pending third-party verification — shown as "—".</p>
    </div>
  </div>
</div>
<script src="../apps/web/public/vendor/chartjs/chart.umd.min.js"></script>
<script>
Chart.defaults.font.family = 'Inter,Arial,sans-serif';
Chart.defaults.color = '#8B8B93';
new Chart(document.getElementById('compCreatorMix'), {
  type: 'doughnut',
  data: { labels: ['Mia Chen', 'Iris Lin', 'Others'],
    datasets: [{ data: [116, 106, 878], backgroundColor: ['#D5EF9A', '#6F60A4', '#FFA8CD'], borderWidth: 0 }] },
  options: { cutout: '62%', maintainAspectRatio: false, plugins: { legend: { display: false } } }
});
new Chart(document.getElementById('compRadar'), {
  type: 'radar',
  data: { labels: ['Commission', 'Creator Mix', 'Content', 'Performance', 'Spend'],
    datasets: [
      { label: 'Our', data: [82, 74, 68, 77, 65], borderColor: '#FF6B9B', backgroundColor: 'rgba(255,107,155,.18)', pointRadius: 2 },
      { label: 'Rival (sample)', data: [58, 80, 72, 60, 85], borderColor: '#6F60A4', backgroundColor: 'rgba(111,96,164,.14)', pointRadius: 2 }
    ] },
  options: { maintainAspectRatio: false, scales: { r: { ticks: { display: false }, pointLabels: { font: { size: 8 } }, suggestedMin: 0, suggestedMax: 100 } }, plugins: { legend: { display: false } } }
});
</script>
</body>
</html>
```

- [ ] **Step 2: 浏览器预览验收**

Run: `open /Users/ap/Desktop/PPTGenerator/Example/FT_Competitor_Insights_Ref.html`
Expected: 深紫画板上 5 张白卡;01 表格/02 环形图/03 条形/04 KPI+达人池/05 雷达全部渲染;每卡三段 DATA/INSIGHT/ACTION 依序呈现;窗口缩窄到 <1100px 时回落 3 列。图表不显示则检查相对路径 `../apps/web/public/vendor/chartjs/chart.umd.min.js`(用 `ls` 确认文件存在)。**请用户过目确认视觉。**

- [ ] **Step 3: Commit**

```bash
cd /Users/ap/Desktop/PPTGenerator && git add Example/FT_Competitor_Insights_Ref.html && git commit -m "feat(ft): 竞品分析五卡参考模板落库 Example/(0924 像素真源,Data→Insight→Action 三段)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: base.css 追加 0924 资产块

**Files:**
- Modify: `apps/server/src/modules/guides/assets/ft-recap/base.css`(现 464 行,文件尾追加)

- [ ] **Step 1: 从模板提取资产块追加到 base.css**

资产块 = 模板里 `/* ========= ↓↓↓ 0924 资产块` 与 `/* ========= ↑↑↑ 0924 资产块结束` 两个标记之间的内容(不含标记行本身),外加一个段头注释。用 sed 精确提取(字节级一致,防手抄漂移):

```bash
cd /Users/ap/Desktop/PPTGenerator
{ printf '\n/* ===== 0924: Competitor Analysis 五卡(Data→Insight→Action 固定三段) ===== */\n'; sed -n '/↓↓↓ 0924 资产块/,$p' Example/FT_Competitor_Insights_Ref.html | sed '1d' | sed '/↑↑↑ 0924 资产块结束/,$d'; } >> apps/server/src/modules/guides/assets/ft-recap/base.css
```

- [ ] **Step 2: 验证追加结果**

Run: `tail -5 apps/server/src/modules/guides/assets/ft-recap/base.css && grep -c "comp-board\|cc-seg\|cbar" apps/server/src/modules/guides/assets/ft-recap/base.css`
Expected: 尾部为 `.comp-note` 规则;grep 计数 ≥ 3;`wc -l` 约 464+112 ≈ 576 行。

- [ ] **Step 3: 确认既有测试不破**

Run: `cd apps/server && npx vitest run src/modules/guides/guide-css-asset.test.ts`
Expected: PASS(该测试按 ref 路径装载,不 pin hash/字节数)。

- [ ] **Step 4: 记录新 hash(v20 assets 要用)**

Run: `cd /Users/ap/Desktop/PPTGenerator && shasum -a 256 apps/server/src/modules/guides/assets/ft-recap/base.css | cut -c1-16`
Expected: 输出新 16 位 hash(记下来,Task 4 步骤 3 引用)。

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/guides/assets/ft-recap/base.css && git commit -m "feat(guides): ft-recap base.css 追加 0924 竞品五卡组件块(.comp-*/.cc-*,与 Example 参考模板字节一致)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: component-contract.json 补类目

**Files:**
- Modify: `apps/server/src/modules/guides/assets/ft-recap/component-contract.json`(classes 对象追加)

- [ ] **Step 1: 生成精确计数并合入**

该文件是 advisory 文档(无代码引用),条目 = 类名 + base.css 定义次数。用脚本生成后手工合入:

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/server/src/modules/guides/assets/ft-recap && node -e "
const fs=require('fs');const css=fs.readFileSync('base.css','utf8');
const cls=['comp-board','comp-grid','comp-card','cc-no','cc-title','cc-sub','cc-seg','cc-tag','cc-data','cc-insight','cc-action','cc-table','cc-chart','cc-kv','cc-kv-v','cc-kv-k','cc-bars','cbar','cc-kpis','ckpi','ckpi-v','ckpi-k','ckpi-delta','cc-pool','cpool-head','cpool-row','cpool-name','cpool-metric','comp-note'];
const out={};for(const c of cls){out[c]={definedInCss:(css.match(new RegExp('[.:\\\\w->~ ]\\\\.?'+c+'(?![\\\\w-])','g'))||[]).length};}
console.log(JSON.stringify(out,null,2));"
```

把输出的每个条目并进 `component-contract.json` 的 `"classes"` 对象(按字母序插入,保持既有缩进风格);同时在文件头 `note` 值末尾追加 `;0924 新增 .comp-*/.cc-* 竞品五卡类(条目由 base.css 计数生成)`。

- [ ] **Step 2: JSON 合法性验证**

Run: `node -e "JSON.parse(require('fs').readFileSync('/Users/ap/Desktop/PPTGenerator/apps/server/src/modules/guides/assets/ft-recap/component-contract.json','utf8'));console.log('valid')"`
Expected: `valid`

- [ ] **Step 3: Commit**

```bash
cd /Users/ap/Desktop/PPTGenerator && git add apps/server/src/modules/guides/assets/ft-recap/component-contract.json && git commit -m "docs(guides): component-contract 补 0924 竞品五卡类目(definedInCss 计数)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: 指南存档 + GuideRevision v20 落库并激活

**Files:**
- Create: `docs/guides/history/cmt_ft_monthly_001-20260924.md`(改前存档)
- Create: `/tmp/ft-v20-save.cjs`(一次性脚本,不进仓库)
- DB: `GuideRevision` 新增 v20 + `Guide` 表 activeRevisionId/content/updatedAt 更新

**背景:** 指南 content 共 **5 处** compare 引用要改(行 12 组件铁律 / 行 69 组件清单 / 行 81 allMedia 隔离 / 行 87 05 章主条目 / 行 107 规则 8c / 行 131 规则 14——其中 8c 行号 107)。生成读 active revision,所以必须先激活 v20 才能实测;实测失败回滚路径见 Task 6 最后一步。

- [ ] **Step 1: 存档当前 active revision**

```bash
mkdir -p /Users/ap/Desktop/PPTGenerator/docs/guides/history && cd /Users/ap/Desktop/PPTGenerator/apps/server && node -e "
const mysql=require('mysql2/promise');const fs=require('fs');
(async()=>{
  const env=fs.readFileSync('.env','utf8');const m=env.match(/DATABASE_URL=\"(.*)\"/);
  const conn=await mysql.createConnection(m[1]);
  const [[g]]=await conn.query(\"SELECT activeRevisionId FROM Guide WHERE id='cmt_ft_monthly_001'\");
  const [[rev]]=await conn.query('SELECT version,content,assets,checks FROM GuideRevision WHERE id=?',[g.activeRevisionId]);
  fs.writeFileSync('/Users/ap/Desktop/PPTGenerator/docs/guides/history/cmt_ft_monthly_001-20260924.md',
    '<!-- archive: GuideRevision v'+rev.version+' id='+g.activeRevisionId+' archived before 0924 five-card rewrite -->\n'+rev.content);
  console.log('archived v'+rev.version);
  await conn.end();
})().catch(e=>{console.error(e.message);process.exit(1)});"
```
Expected: `archived v19`

- [ ] **Step 2: 写 v20 落库脚本 /tmp/ft-v20-save.cjs**

5 处替换都带命中断言(每处必须恰好命中,否则脚本报错退出,不会半改落库):

```js
/* 一次性脚本:FT 月报指南 v20 —— 竞品章五卡改写。cd apps/server && node /tmp/ft-v20-save.cjs */
const mysql = require('mysql2/promise');
const fs = require('fs');
const crypto = require('crypto');

const NEW_05 = `**05 Competitor Analysis(0924 五卡版式)**：导语「How {CLIENT}'s campaign on FANSTOSHOP compares against similar brands / channels in the same category.」+ 深梅紫画板五卡(**全报告唯一一处 .comp-board,只在本章**;compare-table 形态在月报退役,禁再输出 \`<table class="compare-table">\`)。骨架铁律(逐字照抄,改类名/丢层级=废稿):

\`\`\`html
<div class="comp-board">
  <div class="comp-grid">
    <div class="comp-card">
      <div class="cc-no">01</div>
      <h4 class="cc-title">…</h4><p class="cc-sub">…</p>
      <div class="cc-seg cc-data"><div class="cc-tag">Data</div>…</div>
      <div class="cc-seg cc-insight"><div class="cc-tag">Insight</div><p>…</p></div>
      <div class="cc-seg cc-action"><div class="cc-tag">Action</div><p>…</p></div>
    </div>
    …(其余卡同构)
  </div>
  <p class="comp-note">Data source: …</p>
</div>
\`\`\`

五卡固定维度与 Data 形态(渲染顺序固定,编号按实际渲染数连续 01..N):
1. **Commercial Commission** — \`.cc-table\`(表头=Metric|Our|Rival;行=Commission Model/Avg. CPA/Est. Monthly Spend;我方列 td.us 真值,竞品列 td.rival 无数据一律「—」)
2. **Creator Strategy** — \`.cc-chart\` Chart.js doughnut(TOP3 达人 orders 占比 vs Others,色序 lime/violet/pink)+ \`.cc-kv\`(cc-kv-v=达人计数,cc-kv-k=CREATORS)
3. **Content Strategy** — \`.cc-bars\`(3-4 条 .cbar 主题占比,cbar-val=百分比,最高一条加 .top;主题从达人真实内容/文案推导)
4. **Performance** — \`.cc-kpis\`(2×2 .ckpi:Avg. CTR/Avg. CPA/Orders/New-Customer Rate;priorPeriod 有值时加 .ckpi-delta.up/.down)+ \`.cc-pool\`(TOP3 达人:.avatar + .cpool-name + .cpool-metric)
5. **Gap & Opportunity** — \`.cc-chart\` Chart.js radar(顶点=维度;仅当 analytics.competitors 有**多维**真实数值才渲染;单维 SOV 或无数据→整卡省略)

省略规则(宁缺勿假):每卡独立省略——Data 区我方真源全缺→该卡不渲染;竞品 cell 一律「—」,禁编造竞品数值;Insight/Action 从该卡 Data 区真实指标推导 1-2 句(口径同 06 章),竞品全「—」时禁写竞品差距结论。五卡皆无真源→整章省略。\`.comp-note\` 注明 Data source 与日期。声量表(shareOfVoice 单值横条)不再作为本章形态。`;

function replaceOnce(content, desc, fn) {
  const after = fn(content);
  if (after === content) { console.error('MISS: ' + desc); process.exit(1); }
  return after;
}

(async () => {
  const env = fs.readFileSync('.env', 'utf8');
  const url = env.match(/DATABASE_URL="(.*)"/)[1];
  const conn = await mysql.createConnection(url);

  const [[g]] = await conn.query("SELECT activeRevisionId FROM Guide WHERE id='cmt_ft_monthly_001'");
  const [[rev]] = await conn.query('SELECT version,content,assets,checks FROM GuideRevision WHERE id=?', [g.activeRevisionId]);
  console.log('base: v' + rev.version, 'len=' + rev.content.length);

  let c = rev.content;
  // 1) 行12 组件完整铁律
  c = replaceOnce(c, 'L12 组件铁律 compare-table', s => s.replace('、`.compare-table`（若 04 章有数据）', '、`.comp-board`（若 05 章竞品章有数据）'));
  // 2) 行69 组件清单(行级正则,防行尾反斜杠残影)
  c = replaceOnce(c, 'L69 组件清单 compare-wrap 行', s => s.replace(/^- `\.compare-wrap`.*$/m, '- `.comp-board` + `.comp-grid` + `.comp-card` —— 05 竞品章五卡(0924):卡内三段 `.cc-seg.cc-data/.cc-insight/.cc-action`(各带 `.cc-tag`),`.cc-no` 编号、`.comp-note` 数据源行;compare-wrap/compare-table 月报已退役'));
  // 3) 行81 allMedia 隔离短语
  c = replaceOnce(c, 'L81 allMedia 短语', s => s.replace('也不要复用 .compare-table/.pkg-card 等契约类名', '也不要复用 .comp-card/.pkg-card 等契约类名'));
  // 4) 行87 05 章主条目(行级正则整段替换)
  c = replaceOnce(c, 'L87 05 章主条目', s => s.replace(/^\*\*05 Competitor Analysis\*\*：.*$/m, NEW_05));
  // 5) 行107 规则 8c(行级正则,c. 开头单行)
  c = replaceOnce(c, 'L107 规则8c', s => s.replace(/^   c\. 05 Competitor Analysis 竞品表=PRD 形态.*$/m, '   c. 05 Competitor Analysis=五卡版式(0924):.comp-board 深紫画板 > .comp-grid > .comp-card ×N(N∈[1,5],按实际数据渲染),每卡固定三段 .cc-data/.cc-insight/.cc-action(骨架见第 3 节 05 章条目,逐字照抄)。compare-table 在月报退役——不得输出 table.compare-table。我方真值填充(CTR=总clicks/总impressions,CPA=总gmv/总orders,spend=Campaign.budget);竞品 cell 无数据一律「—」宁空勿假,禁编造;Insight/Action 从真实指标推导。章尾 .comp-note 注明 Data source 与日期。'));
  // 6) 行131 规则 14 前半句
  c = replaceOnce(c, 'L131 规则14 前半', s => s.replace('14. **表格与套餐模块(0915)**: 05 竞品表必须用 `<table class="compare-table">` 且外层 `.tbl-wrap`——CSS 钩子全挂在 `.compare-table` 上,裸 `<table>` 会导致表头无底色/无圆角(样式悬空);', '14. **竞品卡与套餐模块(0924 更新)**: 05 章五卡必须用 `.comp-board > .comp-grid > .comp-card` 骨架——CSS 钩子全挂在 `.comp-*/.cc-*` 上,丢层级=样式悬空;compare-table/.tbl-wrap 形态月报已退役;'));

  if (/compare-table|compare-wrap/.test(c)) { console.error('残留 compare 引用,中止'); process.exit(1); }

  // checks 追加 4 条
  const checks = JSON.parse(rev.checks);
  checks.push(
    { assert: 'count_class in [1,5] .comp-card', message: '竞品五卡数量范围', severity: 'report' },
    { assert: 'count_class in [1,5] .cc-insight', message: 'Insight 段随卡等量', severity: 'report' },
    { assert: 'count_class in [1,5] .cc-action', message: 'Action 段随卡等量', severity: 'report' },
    { assert: 'no_element table.compare-table', message: 'compare-table 月报退役', severity: 'block' },
  );

  // assets: base.css hash 刷新为仓库新文件
  const css = fs.readFileSync('src/modules/guides/assets/ft-recap/base.css', 'utf8');
  const newHash = crypto.createHash('sha256').update(css).digest('hex').slice(0, 16);
  const assets = JSON.parse(rev.assets).map(a => a.ref === 'ft-recap/base.css' ? { ...a, hash: newHash } : a);

  // v20 落库 + 激活 + Guide.content 镜像
  const [[last]] = await conn.query("SELECT MAX(version) AS v FROM GuideRevision WHERE guideId='cmt_ft_monthly_001'");
  const revId = 'cmu_ft_m_v20_0924';
  await conn.query(
    'INSERT INTO GuideRevision (id,guideId,version,content,assets,checks,toolParams,changelog,createdBy,createdAt) VALUES (?,?,?,?,?,?,?,?,?,NOW())',
    [revId, 'cmt_ft_monthly_001', last.v + 1, c, JSON.stringify(assets), JSON.stringify(checks), rev.toolParams ?? '{}', '0924: 05 竞品分析五卡版式(.comp-*/.cc-* 资产)+compare-table 月报退役+新断言;assets hash 校正', 'agent:0924-five-card'],
  );
  await conn.query("UPDATE Guide SET activeRevisionId=?, content=?, updatedAt=NOW() WHERE id='cmt_ft_monthly_001'", [revId, c]);
  console.log('v' + (last.v + 1) + ' saved & activated, id=' + revId + ', new css hash=' + newHash);
  await conn.end();
})().catch(e => { console.error(e.message); process.exit(1); });
```

注意:每个替换走 `replaceOnce` 独立断言——finder 未命中即中止,不会半改落库。

- [ ] **Step 3: 执行落库**

Run: `cd /Users/ap/Desktop/PPTGenerator/apps/server && node /tmp/ft-v20-save.cjs`
Expected: 输出 `base: v19 len=14171` → 6 处 MISS 全不触发 → `v20 saved & activated, id=cmu_ft_m_v20_0924, new css hash=<Task2 Step4 的 hash>`。
任一 `MISS:` 报错时:把 active revision content 导出(`SELECT content ...` 存 /tmp),人工核对对应行的实际字节(注意行尾 `\\` 残影与全角标点),修正 finder 后重跑;**不允许跳过断言硬落库**。

- [ ] **Step 4: 落库结果核验**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/server && node -e "
const mysql=require('mysql2/promise');const fs=require('fs');
(async()=>{
  const env=fs.readFileSync('.env','utf8');const m=env.match(/DATABASE_URL=\"(.*)\"/);
  const conn=await mysql.createConnection(m[1]);
  const [[g]]=await conn.query(\"SELECT activeRevisionId FROM Guide WHERE id='cmt_ft_monthly_001'\");
  const [[rev]]=await conn.query('SELECT version,LEFT(changelog,40) AS cl,LENGTH(content) AS len,JSON_LENGTH(checks) AS nChecks FROM GuideRevision WHERE id=?',[g.activeRevisionId]);
  console.log(rev);
  await conn.end();
})().catch(e=>{console.error(e.message);process.exit(1)});"
```
Expected: `version: 20`,nChecks: 15,len ≈ 15200±600(比 v19 多约 1K)。

- [ ] **Step 5: Commit(存档文件)**

```bash
cd /Users/ap/Desktop/PPTGenerator && git add docs/guides/history/cmt_ft_monthly_001-20260924.md && git commit -m "docs(guides): FT 月报指南 v19 改前存档(runbook 2.4,0924 五卡改写回滚基线)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: 断言干跑(参考模板过新 checks)

- [ ] **Step 1: validateHtml 干跑**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/server && npx tsx -e "
import { readFileSync } from 'fs';
import { validateHtml } from './src/modules/guides/html-validator';
const html = readFileSync('../../Example/FT_Competitor_Insights_Ref.html', 'utf8');
const checks = [
  { assert: 'h2_contains Competitor Analysis', severity: 'report' },
  { assert: 'count_class in [1,5] .comp-card', severity: 'report' },
  { assert: 'count_class in [1,5] .cc-insight', severity: 'report' },
  { assert: 'count_class in [1,5] .cc-action', severity: 'report' },
  { assert: 'no_element table.compare-table', severity: 'block' },
];
const r = validateHtml(html, checks);
console.log(JSON.stringify(r, null, 1));
if (!r.ok || r.failed > 0) process.exit(1);
"
```
Expected: `ok: true, failed: 0`。5 张 .comp-card / 5 段 cc-insight / cc-action 计数命中,无 `table.compare-table`。(若 tsx 相对导入报错,改用 `import { validateHtml } from '/Users/ap/Desktop/PPTGenerator/apps/server/src/modules/guides/html-validator'`。)

---

### Task 6: GlowLab 实测生成 A/B(铁律 1)

- [ ] **Step 1: server 健康检查**

Run: `curl -s -o /dev/null -w '%{http_code}' http://localhost:4000/api/v1/guides`
Expected: `401`(有响应=server 在跑)。`000`/连接拒绝则启动:`cd apps/server && pnpm dev`(后台),等 ~10s 重试。**注意 memory:dev server 可能跑在 worktree 目录——确认 4000 端口进程 cwd 是本仓库**(`lsof -p $(lsof -ti:4000 -sTCP:LISTEN) | grep cwd`),worktree 版看不到新资产。

- [ ] **Step 2: 签 dev JWT**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/server && npx tsx -e "
import { SignJWT } from 'jose';
import { readFileSync } from 'fs';
(async () => {
  const env = readFileSync('.env', 'utf8');
  const secret = new TextEncoder().encode(env.match(/JWT_ACCESS_SECRET=(.*)/)[1].trim());
  const token = await new SignJWT({ role: 'ADMIN', bl: 'FT', type: 'access' })
    .setProtectedHeader({ alg: 'HS256' }).setSubject('cmsxeu26d0000sj6d4emnoj76')
    .setIssuedAt().setExpirationTime('2h').sign(secret);
  console.log(token);
})();" > /tmp/ft-jwt.txt && wc -c /tmp/ft-jwt.txt
```
Expected: 文件非空(~300-400 字节)。(sub 用 DB 已知用户 id;若 401,`SELECT id,role FROM User WHERE role='ADMIN' LIMIT 1` 换一个。)

- [ ] **Step 3: 触发 AI 生成(mode=ai,带 v20 指南)**

```bash
TOKEN=$(cat /tmp/ft-jwt.txt) && curl -s -X POST http://localhost:4000/api/v1/html-templates/generate \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"mode":"ai","campaignId":"camp-glowlab-q4","guideId":"cmt_ft_monthly_001"}' \
  --max-time 320 -o /tmp/ft-ab-raw.json -w '%{http_code}'
```
Expected: `200`(约 2-3 分钟)。`500` 多为 DeepSeek 180s socket 断(memory 已知),原样重试一次;连败两次则停下排查 ai-gateway key(`apps/server/.env`,不是根 `.env`)。

- [ ] **Step 4: 提取 HTML + 结构对比**

```bash
node -e "
const fs=require('fs');const r=JSON.parse(fs.readFileSync('/tmp/ft-ab-raw.json','utf8'));
const html=r.html||r.data?.html||(r.data&&r.data.html);
if(!html){console.error('no html field;keys='+Object.keys(r));process.exit(1)}
fs.writeFileSync('/tmp/ft-ab-new.html',html);
for(const k of ['comp-board','comp-card','cc-insight','cc-action','compare-table','GUIDE_CSS']){
  console.log(k+':',(html.match(new RegExp(k,'g'))||[]).length);
}
console.log('h2:',(html.match(/<h2[^>]*>([^<]*)</g)||[]).map(s=>s.replace(/<[^>]*>/g,'')).join(' | '));"
```
Expected: `comp-board:1+`(CSS 注入后样式表内 1 次+HTML 1 次)、`comp-card≥2`(GlowLab 无竞品数据,预期 4 卡=HTML 4 次)、`cc-insight`/`cc-action` 与 comp-card 等量、`compare-table:0`(block 断言同义)、`GUIDE_CSS:0`(占位符已被替换)、h2 列表含 `Competitor Analysis`。
另导出旧版对照:`/tmp/ft-v53.html`(若不存在,按 Task 4 Step 1 同法从 HtmlVersion `cmuc153xy000j6coctd0p935y` 导出)对比旧 06 章单表形态。

- [ ] **Step 5: 浏览器肉眼验收**

Run: `open /tmp/ft-ab-new.html`
Expected: 06 章为深紫画板五卡结构(预期 4 卡:Commission/Creator/Content/Performance;05 Gap 卡因无竞品数据省略),卡内三段齐整,竞品列为「—」,其余章节(hero/KPI/trend/placement/creator/pkg)不受影响。**请用户过目。**

- [ ] **Step 6: 失败回滚路径(仅当 Step 4/5 不达标)**

```bash
cd /Users/ap/Desktop/PPTGenerator/apps/server && node -e "
const mysql=require('mysql2/promise');const fs=require('fs');
(async()=>{
  const env=fs.readFileSync('.env','utf8');const m=env.match(/DATABASE_URL=\"(.*)\"/);
  const conn=await mysql.createConnection(m[1]);
  const [[rev]]=await conn.query(\"SELECT id,content FROM GuideRevision WHERE guideId='cmt_ft_monthly_001' AND version=19\");
  await conn.query(\"UPDATE Guide SET activeRevisionId=?, content=?, updatedAt=NOW() WHERE id='cmt_ft_monthly_001'\",[rev.id,rev.content]);
  console.log('rolled back to v19',rev.id);
  await conn.end();
})().catch(e=>{console.error(e.message);process.exit(1)});"
```
回滚后分析生成 HTML 差在哪(类名拼错→调指南措辞/断言;视觉崩→调 base.css),修完重走 Task 4(存档文件已含 v19,不重复建)。

---

### Task 7: 收尾(CHANGELOG + spec 校正)

**Files:**
- Modify: `CHANGELOG.md`(若根目录存在;否则跳过本步)
- Modify: `docs/superpowers/specs/2026-09-24-ft-competitor-five-card-design.md`(改点计数 4→5 校正)

- [ ] **Step 1: spec 计数校正**

把 spec 中「指南 content 4 处改写:章节固定清单句(L81)…」一段改为「指南 content **5 处**改写(行 12 组件铁律 / 行 69 组件清单 / 行 81 allMedia 隔离 / 行 87 05 章主条目 / 行 107 规则 8c / 行 131 规则 14,其中两处为组件清单级引用)」,其余不动。

- [ ] **Step 2: CHANGELOG 条目**

`CHANGELOG.md` 顶部(按既有格式)加:

```markdown
## 2026-09-24
- feat(ft): 月报竞品分析章五卡重构——.comp-*/.cc-* 资产落 base.css、指南 v20(5 处 compare 引用替换+4 条新断言)、Example 参考模板;GlowLab 实测通过后激活,compare-table 月报退役
```

- [ ] **Step 3: Commit**

```bash
cd /Users/ap/Desktop/PPTGenerator && git add CHANGELOG.md docs/superpowers/specs/2026-09-24-ft-competitor-five-card-design.md && git commit -m "docs: CHANGELOG 补 0924 竞品五卡条目 + spec 改点计数校正(5 处)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review 记录

- **Spec 覆盖**:A 组件视觉→Task 1/2;B 数据映射/省略→Task 1 样例 + Task 4 NEW_05 文本;C 5 工件→Task 1(模板)/2(css)/3(contract)/4(存档+revision)/;D 验证→Task 1 Step2 预览、Task 5 断言干跑、Task 6 A/B+回滚。✓
- **占位符**:无 TBD/TODO;所有代码块完整可执行。✓
- **类型/命名一致**:`.comp-*`/`.cc-*` 类名在模板(CSS+HTML)、base.css、指南 NEW_05、checks 四处逐字一致(`cc-kv-v`/`cc-kv-k`/`cbar-fill`/`ckpi-delta` 等已交叉核对)。✓
- **已知偏差**:spec 写「通过后激活」,机械上生成必须读 active revision,故 Task 4 先激活、Task 6 失败回滚 v19——语义等价(失败不留在 v20),spec 意图保留。
