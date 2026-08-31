# 毛玻璃升级:参考图级 Glassmorphism(报告 + 编辑器参数对齐)

- **日期**: 2026-08-31
- **状态**: 已确认(用户对 3 个澄清问题与 4 段设计均回复「继续」,按推荐项锁定)
- **范围**: recipe 报告(campaign-report)+ web 编辑器玻璃卡片,同一套 token 参数

## 1. 背景与目标

0828 上线的毛玻璃(97ede23)是「极淡品牌色光斑 + blur16 + 半透明白 0.55」。用户给出参考图:亮灰蓝渐变底、暖橙粉/淡紫高透明度 bokeh 光斑、高模糊(观感 blur24~32)、左上→右下渐变高光边线、大圆角。目标:把两边(报告导出 + 编辑器画布)升到该档观感,同时保留品牌品红识别度。

### 已锁定决策(3 个澄清问题,均按推荐)

| # | 问题 | 决策 |
|---|------|------|
| 1 | 作用层 | **C. 两边都升级,参数对齐**(沿用 0828 做法,避免编辑器/导出割裂) |
| 2 | 光斑配色 | **C. 品红为主 + 暖橙粉辅**(品牌识别 + 参考图冷暖对比) |
| 3 | 玻璃强度 | **均衡档:blur22 / 白 0.45 / 圆角 18**(参考图观感,密集表格可读性仍足) |

### 落选方案

- **纯参数微调**:调数值调不出参考图的边缘渐变高光 + 斜向光泽,这两层现在两边都没有。
- **完全照搬参考图配色**:丢品牌品红识别度。

## 2. 视觉规格(token 契约)

### 2.1 背景层

报告侧 body(保持 0828 的 **800px 平铺**结论——puppeteer 多页切片导出时每页都有光斑,`background-attachment: fixed` 在首视口外会丢):

```css
background-color: #e8ebf0;
background-image:
  radial-gradient(circle at 88% 10%, rgba(255,9,158,0.30) 0%, transparent 40%),   /* 主光斑·品红 */
  radial-gradient(circle at 8% 30%,  rgba(99,102,241,0.26) 0%, transparent 38%),  /* 辅光斑·靛蓝 */
  radial-gradient(circle at 55% 85%, rgba(250,166,133,0.30) 0%, transparent 34%), /* 辅光斑·暖橙粉 */
  linear-gradient(160deg, #d8dde6 0%, #e8ebf0 50%, #f6f7f9 100%);                 /* 灰蓝对角底 */
background-size: 100% 800px; /* 各层同尺寸平铺 */
background-repeat: repeat;
```

编辑器侧:光斑画在**画布页面背景**上——具体是 `CanvasComponent.tsx:123` 处 `background: var(--surface-primary)` 的页面层(现状纯实色,0828 轮只做了卡片玻璃、没做页面背景)。glass=true 时该层换为同样的四层渐变(通过 theme.tsx 注入 `--page-bg` 之类新变量,CanvasComponent 改引用),四层数值同上;glass=false 时变量回退实色,现状外观不变。

### 2.2 卡片层

报告 `.card`:

```css
background: rgba(255,255,255,0.45);
backdrop-filter: blur(22px) saturate(150%);
border-radius: 18px;
border: 1px solid rgba(255,255,255,0.5);
box-shadow:
  0 8px 32px rgba(160,168,182,0.35),
  inset 0 1px 0 rgba(255,255,255,0.9); /* 上沿线高光 */
.card::before {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(120deg, rgba(255,255,255,0.5) 0%, transparent 30%);
}
```

编辑器 `.skin-card` 系(沿用现有 `--card-*` 变量机制,只改注入值 + 新增变量):

```
--card-bg:            rgba 白 0.45(color-mix 通道保留)
--card-blur:          blur(22px) saturate(150%)
--card-border-top:    rgba(255,255,255,0.85)   /* 亮 */
--card-border-left:   rgba(255,255,255,0.45)
--card-border-right:  rgba(255,255,255,0.25)
--card-border-bottom: rgba(255,255,255,0.15)   /* 暗 —— 左上→右下递变,模拟左上光源 */
--card-glow:          rgba(255,255,255,0.9)    /* inset 顶高光,对应报告侧 box-shadow 第二段 */
--card-shadow:        0 8px 32px rgba(160,168,182,0.35)
```

圆角:报告侧固定 18px;编辑器侧走主题 `--radius-card` 联动(现状机制,不强推 18px)。

### 2.3 新增 token(dgTokens 字典)

```
glassBlobMagenta / glassBlobIndigo / glassBlobWarm   — 三个光斑 rgba
glassBg / glassStroke / glassShadow(已有,改值)
glassHighlight — 斜向高光渐变(::before 用)
glassBorderTop/Left/Right/Bottom — 四边递变(编辑器映射;报告侧 .card 用 border + inset 阴影近似)
```

businessLine 覆盖机制(预留设计)天然可覆盖新 token,不新增通道。

## 3. 改动文件

| 文件 | 改动 |
|------|------|
| `apps/server/src/modules/html-templates/recipe/campaign-report/tokens.ts` | 改 3 个 glass token 值,新增 ~7 个 |
| `apps/server/src/modules/html-templates/recipe/campaign-report/template.hbs` | body 背景四层重写;.card 样式升级 + ::before;`@supports` 降级 |
| `apps/web/src/editor/theme.tsx` | glass 分支变量值对齐(145-158 行区域);新增页面背景四层渐变变量注入 |
| `apps/web/src/editor/components/CanvasComponent.tsx` | 页面背景从 `var(--surface-primary)` 改为新背景变量(glass 时为四层渐变,非 glass 回落实色,一行改动) |
| `packages/shared/src/types/theme.ts` / `theme/utils.ts` | 仅当需要持久化新字段时才动(glass 开关已存在,预计**不动**) |

## 4. 错误处理与降级

- **报告侧无 JS、纯 CSS**:`@supports not (backdrop-filter: blur(1px))` 时 `.card { background: rgba(255,255,255,0.92) }`,老 PDF 引擎不穿底。
- **编辑器侧**:`glass: false` 或不支持时现有回退路径不变(`--card-blur: none` + 实色 bg),只改值不动逻辑。
- **性能护栏**:报告 puppeteer blur 已验证(0828),blur22 同量级;编辑器 .skin-card 数量多,saturate 160%→150%,不引入 layout 属性,GPU 合成不受影响。

## 5. 测试计划

- **报告侧**:更新 campaign-report 渲染断言(新 token 出现在输出 HTML);puppeteer 全页导出一次,人眼验收封面/表格页/图表页 3 个代表页。
- **编辑器侧**:theme glass 分支变量断言更新;推前手动跑 `apps/web` 的 `tsc -b --force`(CI-only gate)。
- **回归红线**:报告多页切片**每页都有光斑**(0828 修复的行为不得倒退);`glass:false` 时编辑器回退到非玻璃外观不得变。

## 6. 非目标(明确不做)

- 不改玻璃开关交互(ReportSettingsOverlay 的 Chip UI 保持)
- 不做报告/编辑器之外的新玻璃消费点(如 preview iframe)
- 不引入动画/交互态(悬浮、光泽移动等)
