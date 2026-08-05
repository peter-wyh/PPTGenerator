import { useState, useEffect, useCallback, useRef } from 'react';
import { htmlTemplatesApi, type HtmlTemplateSummary } from '@/api/htmlTemplates';
import { Button } from '@/components/Button';
import { BUSINESS_LINES } from '@/projectsMeta';

interface Props {
  /** 已有报告 ID（从报告列表入口时传入）。 */
  projectId?: string;
  /** Campaign ID（必传：Campaign 列表入口直接传 campaignId）。 */
  campaignId?: string;
  /** Campaign 名称（用于默认报告名）。 */
  campaignName?: string;
  onClose: () => void;
  /** 保存成功后的回调（Campaign 模式下传回新报告 ID）。 */
  onSaved?: (projectId: string) => void;
}

type Mode = 'template' | 'ai';
type Theme = 'light' | 'dark';

/** 提示词预设：主题 + 设计规范 + 补充要求，三者组合为完整 prompt。 */
const PROMPT_PRESETS = [
  {
    label: '投放结案',
    theme: 'light' as Theme,
    designSpec: `【配色】背景 #f5f7fa，白色卡片(#fff) + #ebebeb 边框，品牌色 #ff099e（粉色），正文 #1e1c24，次要 #626166
【字体】Outfit（正文）+ Poppins（标题）+ Barlow Condensed（数字，大号粗体）
【布局】max-width 1280px 居中，card 间距 24px，圆角 8px
【图表】Chart.js（CDN 加载），responsive + maintainAspectRatio:false`,
    requirement: `生成一份 DIGCHIC 风格的营销投放结案报告。
【模块结构】
1. Header：左侧商家 Logo + 品牌名，右侧 Campaign 周期标签
2. KPI 总览：5 列网格 — Total Revenue / Clicks / Orders / New Customer / AOV
3. Performance Trend：混合图表（折线=Revenue + 柱状=Orders）
4. Publisher Performance 表格：达人/渠道列表
5. Insight & Analysis（3 列）：Top Categories / Top Products / Top Market
6. Actionable Insights（5 列）：每张卡顶部彩色边条`,
  },
  {
    label: '达人复盘',
    theme: 'light' as Theme,
    designSpec: `【配色】浅色主题，品牌色可自定义，数据对比用互补色
【字体】系统字体 + 数字加粗
【布局】max-width 1200px 居中，卡片式布局`,
    requirement: `生成一份达人投放复盘报告，重点展示达人 ROI 排名、内容效果对比、CPS 带货数据。
包含达人榜单（表格）、各平台效果对比（柱状图）、合作内容截图墙。`,
  },
  {
    label: '效果对比',
    theme: 'light' as Theme,
    designSpec: `【配色】浅色主题，蓝/橙对比色
【字体】系统字体
【布局】max-width 1200px 居中`,
    requirement: `生成一份效果对比报告，将不同平台/达人的关键指标进行横向对比，突出最佳和最差表现。`,
  },
  {
    label: '业务复盘看板',
    theme: 'dark' as Theme,
    designSpec: `【配色体系】--bg:#0a0e18 / --panel:#131a2c / --text:#e9ecf5 / --gold:#d8a657 / --green:#3fcf8e / --red:#ff6b6b
【字体】Noto Serif SC（衬线标题）+ Noto Sans SC（正文）+ JetBrains Mono（数字）
【图表】纯内联 <canvas> + JavaScript，DPR 高清渲染，圆角柱状 + 贝塞尔折线`,
    requirement: `生成一份深色业务结算复盘看板，参照金融结算台账风格。
5 个 section（Hero总览 → 季度卡片 → 按月分析 → 佣金预估 → 运营动作），
每个 section 顶部含序号 01-05 + 衬线标题。
KPI 大数字 58px JetBrains Mono，含 YOY 同比 + 完成率印章。
所有图表用纯内联 canvas 实现，不依赖外部库。`,
  },
];

const CREATOR_SUGGESTIONS = ['alex', 'stella', 'reese', 'stacey'];
const selectCls = 'w-full rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-foreground-primary outline-none focus:border-accent-primary';

/**
 * 生成 HTML 报告 Overlay：
 *  - 模板模式：选择 HTML 模板 → 自动填充 campaign 数据
 *  - AI 模式：输入提示词 → DeepSeek 生成完整 HTML
 *  - 预览（iframe）、复制源码、下载、保存到报告
 *  - 业务线 design.md 回显与二次编辑
 */
export function GenerateHtmlReportOverlay({ projectId, campaignId, campaignName, onClose, onSaved }: Props) {
  const [mode, setMode] = useState<Mode>('ai');
  const [theme, setTheme] = useState<Theme>('light');
  const [templates, setTemplates] = useState<HtmlTemplateSummary[]>([]);
  const [selectedTpl, setSelectedTpl] = useState<string>('');
  const [prompt, setPrompt] = useState(PROMPT_PRESETS[0].requirement);
  const [designSpec, setDesignSpec] = useState(PROMPT_PRESETS[0].designSpec);
  const [selectedPresetIdx, setSelectedPresetIdx] = useState(0);
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // design.md 回显/编辑
  const [designMd, setDesignMd] = useState('');
  const [designMdLoading, setDesignMdLoading] = useState(false);
  const [designMdExpanded, setDesignMdExpanded] = useState(false);
  const [designMdSource, setDesignMdSource] = useState(''); // 业务线名称

  // 保存表单状态
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [reportName, setReportName] = useState('');
  const [reportBL, setReportBL] = useState('');
  const [reportCreator, setReportCreator] = useState('');

  // 加载 templates
  useEffect(() => {
    htmlTemplatesApi.list({ status: 'PUBLISHED' }).then(setTemplates).catch(() => {});
  }, []);

  // 加载 design.md
  useEffect(() => {
    if (!campaignId) return;
    setDesignMdLoading(true);
    htmlTemplatesApi
      .getDesignGuide(campaignId)
      .then((data) => {
        setDesignMd(data.designMd || '');
        setDesignMdSource(data.businessLineName || '');
      })
      .catch(() => {
        // 静默失败 — designMd 是可选的
      })
      .finally(() => setDesignMdLoading(false));
  }, [campaignId]);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError('');
    setGeneratedHtml('');
    try {
      const html = await htmlTemplatesApi.generate({
        mode,
        templateId: mode === 'template' ? selectedTpl : undefined,
        prompt: mode === 'ai' ? `${designSpec}\n\n${prompt}`.trim() : undefined,
        campaignId,
        theme,
        designMd: mode === 'ai' && designMd.trim() ? designMd.trim() : undefined,
      });
      setGeneratedHtml(html);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.message || e?.message || '生成失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [mode, selectedTpl, prompt, campaignId, theme, designMd]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(generatedHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [generatedHtml]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([generatedHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${projectId || campaignId || 'campaign'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [generatedHtml, projectId, campaignId]);

  // 保存：已有报告 → 更新 HTML；Campaign 入口 → 创建新报告
  const doSave = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (projectId) {
        // 已有报告 — 更新 HTML
        await htmlTemplatesApi.saveHtml(projectId, generatedHtml);
        setSaved(true);
        setTimeout(() => onSaved?.(projectId), 1200);
      } else if (campaignId) {
        // Campaign 入口 — 创建新报告
        const result = await htmlTemplatesApi.saveHtmlAsProject({
          html: generatedHtml,
          campaignId,
          name: reportName.trim() || `${campaignName ?? 'Campaign'} HTML 报告`,
          businessLine: reportBL || undefined,
          creator: reportCreator || undefined,
        });
        setSaved(true);
        setShowSaveForm(false);
        setTimeout(() => onSaved?.(result.projectId), 1200);
      }
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || '保存失败');
    } finally {
      setLoading(false);
    }
  }, [projectId, campaignId, campaignName, generatedHtml, reportName, reportBL, reportCreator, onSaved]);

  // 打开保存表单（Campaign 模式）
  const handleClickSave = useCallback(() => {
    if (projectId) {
      // 已有报告 — 直接保存
      void doSave();
    } else {
      // Campaign 模式 — 先填表单
      setReportName(`${campaignName ?? 'Campaign'} HTML 报告`);
      setShowSaveForm(true);
    }
  }, [projectId, campaignName, doSave]);

  const handleSaveFormSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    void doSave();
  }, [doSave]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-[92vw] max-w-6xl flex-col overflow-hidden rounded-2xl bg-surface-primary shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-default px-6 py-4">
          <h2 className="text-lg skin-fw-heading text-foreground-primary">
            ⚡ 生成 HTML 报告{campaignName ? ` — ${campaignName}` : ''}
          </h2>
          <button onClick={onClose} className="text-foreground-muted hover:text-foreground-primary">✕</button>
        </div>

        {/* Body: left config / right preview */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel — config */}
          <div className="flex w-[360px] shrink-0 flex-col skin-gap-lg overflow-y-auto border-r border-border-default p-5">
            {/* Mode tabs */}
            <div>
              <label className="mb-2 block text-xs skin-fw-body text-foreground-muted">生成方式</label>
              <div className="flex skin-gap-sm">
                <button
                  onClick={() => setMode('ai')}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm transition ${
                    mode === 'ai'
                      ? 'bg-accent-primary text-foreground-inverse'
                      : 'bg-surface-hover text-foreground-secondary'
                  }`}
                >
                  🤖 AI 生成
                </button>
                <button
                  onClick={() => setMode('template')}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm transition ${
                    mode === 'template'
                      ? 'bg-accent-primary text-foreground-inverse'
                      : 'bg-surface-hover text-foreground-secondary'
                  }`}
                >
                  📋 模板填充
                </button>
              </div>
            </div>

            {/* Theme */}
            <div>
              <label className="mb-2 block text-xs skin-fw-body text-foreground-muted">主题</label>
              <div className="flex skin-gap-sm">
                {(['light', 'dark'] as Theme[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`flex-1 rounded-lg px-3 py-1.5 text-xs transition ${
                      theme === t
                        ? 'bg-accent-primary text-foreground-inverse'
                        : 'bg-surface-hover text-foreground-secondary'
                    }`}
                  >
                    {t === 'light' ? '☀️ 浅色' : '🌙 深色'}
                  </button>
                ))}
              </div>
            </div>

            {/* Mode-specific config */}
            {mode === 'ai' ? (
              <div className="space-y-3">
                {/* 报告主题预设 */}
                <div>
                  <label className="mb-1.5 block text-xs skin-fw-body text-foreground-muted">
                    报告主题
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {PROMPT_PRESETS.map((p, idx) => (
                      <button
                        key={p.label}
                        onClick={() => {
                          setSelectedPresetIdx(idx);
                          setPrompt(p.requirement);
                          setDesignSpec(p.designSpec);
                          setTheme(p.theme);
                        }}
                        className={`rounded-md px-2.5 py-1 text-[11px] transition ${
                          selectedPresetIdx === idx
                            ? 'bg-accent-primary text-foreground-inverse'
                            : 'bg-surface-hover text-foreground-secondary hover:text-foreground-primary'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 设计规范（可编辑，合并业务线 designMd） */}
                <div>
                  <label className="mb-1.5 block text-xs skin-fw-body text-foreground-muted">
                    🎨 设计规范（配色 / 字体 / 布局 / 图表引擎）
                  </label>
                  <textarea
                    value={designSpec}
                    onChange={(e) => setDesignSpec(e.target.value)}
                    rows={4}
                    placeholder="配色体系、字体选择、布局参数、图表引擎…"
                    className="w-full resize-none rounded-lg border border-border-default bg-surface-secondary px-3 py-2 text-xs font-mono text-foreground-primary placeholder:text-foreground-muted focus:border-accent-primary focus:outline-none"
                  />
                  {designMdSource && (
                    <p className="mt-1 text-[10px] text-foreground-muted">
                      📎 已叠加业务线「{designMdSource}」设计规范（下方可编辑覆盖）
                    </p>
                  )}
                </div>

                {/* 内容要求 */}
                <div>
                  <label className="mb-1.5 block text-xs skin-fw-body text-foreground-muted">
                    📝 内容要求（模块结构 / 重点指标 / 交互）
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={5}
                    placeholder="描述你想要的报告模块、重点指标、特殊交互…"
                    className="w-full resize-none rounded-lg border border-border-default bg-surface-secondary px-3 py-2 text-sm text-foreground-primary placeholder:text-foreground-muted focus:border-accent-primary focus:outline-none"
                  />
                  {!campaignId && (
                    <p className="mt-1.5 text-[11px] text-amber-500">
                      ⚠️ 未绑定 Campaign，AI 将生成通用模板（无真实数据）
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className="mb-2 block text-xs skin-fw-body text-foreground-muted">
                  选择模板
                </label>
                {templates.length === 0 ? (
                  <p className="rounded-lg bg-surface-hover px-3 py-4 text-center text-xs text-foreground-muted">
                    暂无已发布的 HTML 模板
                  </p>
                ) : (
                  <div className="flex flex-col skin-gap-sm">
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTpl(t.id)}
                        className={`rounded-lg border px-3 py-2 text-left transition ${
                          selectedTpl === t.id
                            ? 'border-accent-primary bg-accent-primary/10'
                            : 'border-border-default hover:border-border-strong'
                        }`}
                      >
                        <div className="text-sm skin-fw-body text-foreground-primary">{t.name}</div>
                        {t.description && (
                          <div className="mt-0.5 text-[11px] text-foreground-muted">{t.description}</div>
                        )}
                        {t.category && (
                          <span className="mt-1 inline-block rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground-secondary">
                            {t.category}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* design.md 回显/编辑（仅 AI 模式且有 campaignId 时显示） */}
            {mode === 'ai' && campaignId && (
              <div className="rounded-lg border border-border-default">
                <button
                  onClick={() => setDesignMdExpanded(!designMdExpanded)}
                  className="flex w-full items-center justify-between px-3 py-2 text-xs skin-fw-body text-foreground-secondary hover:bg-surface-hover"
                >
                  <span className="flex items-center gap-1.5">
                    🎨 业务线设计规范
                    {designMdSource && (
                      <span className="rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground-muted">
                        {designMdSource}
                      </span>
                    )}
                    {designMd.trim() && (
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" title="已加载" />
                    )}
                  </span>
                  <span className="text-foreground-muted">{designMdExpanded ? '▾' : '▸'}</span>
                </button>
                {designMdExpanded && (
                  <div className="border-t border-border-default p-3">
                    {designMdLoading ? (
                      <p className="text-center text-[11px] text-foreground-muted">加载中…</p>
                    ) : (
                      <>
                        <p className="mb-1.5 text-[10px] text-foreground-muted">
                          编辑后点击「生成报告」时自动注入。留空则不附加。
                        </p>
                        <textarea
                          value={designMd}
                          onChange={(e) => setDesignMd(e.target.value)}
                          rows={6}
                          placeholder="业务线 design.md 内容（品牌色、字体、报告结构要求等）…"
                          className="w-full resize-y rounded border border-border-default bg-surface-secondary px-2 py-1.5 font-mono text-[11px] text-foreground-primary placeholder:text-foreground-muted focus:border-accent-primary focus:outline-none"
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Generate button */}
            <Button
              onClick={handleGenerate}
              loading={loading && !generatedHtml}
              disabled={mode === 'template' ? !selectedTpl : !prompt.trim()}
              className="w-full"
            >
              {loading && !generatedHtml ? '生成中… (~15s)' : '✨ 生成报告'}
            </Button>

            {error && !showSaveForm && (
              <p className="rounded-lg bg-red/10 px-3 py-2 text-xs text-red">{error}</p>
            )}
          </div>

          {/* Right panel — preview / source */}
          <div className="relative flex flex-1 flex-col overflow-hidden">
            {generatedHtml ? (
              <>
                {/* Toolbar */}
                <div className="flex items-center justify-between border-b border-border-default px-4 py-2">
                  <div className="flex skin-gap-sm">
                    <Button variant="ghost" onClick={handleCopy} className="px-2 py-1 text-xs">
                      {copied ? '✓ 已复制' : '📋 复制源码'}
                    </Button>
                    <Button variant="ghost" onClick={handleDownload} className="px-2 py-1 text-xs">
                      💾 下载 HTML
                    </Button>
                  </div>
                  <Button variant="primary" onClick={handleClickSave} loading={loading} disabled={saved} className="px-3 py-1 text-xs">
                    {saved ? '✓ 已保存' : projectId ? '保存到报告' : '保存为新报告'}
                  </Button>
                </div>
                {/* iframe preview */}
                <iframe
                  ref={iframeRef}
                  srcDoc={generatedHtml}
                  title="HTML Report Preview"
                  className="h-full w-full flex-1 border-0 bg-white"
                  sandbox="allow-same-origin allow-scripts"
                />
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-foreground-muted">
                <div className="text-center">
                  <div className="mb-3 text-5xl opacity-30">📄</div>
                  <p className="text-sm">选择生成方式，点击「生成报告」预览</p>
                </div>
              </div>
            )}

            {/* 保存报告信息弹窗（Campaign 模式） */}
            {showSaveForm && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
                <form
                  onSubmit={handleSaveFormSubmit}
                  className="w-full max-w-md rounded-xl bg-surface-primary p-6 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="font-headings text-base skin-fw-heading text-foreground-primary">保存报告信息</h3>
                  <p className="mt-1 text-xs text-foreground-muted">填写报告基本信息，保存后可在报告管理中查看。</p>
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="mb-1 block text-sm skin-fw-body text-foreground-secondary">报告名称</label>
                      <input
                        className={selectCls}
                        value={reportName}
                        onChange={(e) => setReportName(e.target.value)}
                        placeholder="例如：WANDER Summer Travel 投放结案"
                        autoFocus
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm skin-fw-body text-foreground-secondary">业务线</label>
                      <select
                        className={selectCls}
                        value={reportBL}
                        onChange={(e) => setReportBL(e.target.value)}
                      >
                        <option value="">（可选）</option>
                        {BUSINESS_LINES.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm skin-fw-body text-foreground-secondary">创建人</label>
                      <input
                        className={selectCls}
                        list="gen-html-creator-suggestions"
                        value={reportCreator}
                        onChange={(e) => setReportCreator(e.target.value)}
                        placeholder="输入创建人姓名"
                      />
                      <datalist id="gen-html-creator-suggestions">
                        {CREATOR_SUGGESTIONS.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </div>
                    {error && (
                      <p className="rounded-lg bg-red/10 px-3 py-2 text-xs text-red">{error}</p>
                    )}
                  </div>
                  <div className="mt-6 flex justify-end skin-gap-sm">
                    <Button type="button" variant="secondary" onClick={() => setShowSaveForm(false)} disabled={loading}>
                      取消
                    </Button>
                    <Button type="submit" loading={loading} disabled={!reportName.trim()}>
                      {saved ? '✓ 已保存' : '保存报告'}
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
