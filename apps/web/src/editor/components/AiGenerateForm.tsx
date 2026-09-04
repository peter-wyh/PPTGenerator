import { useState, useEffect, useMemo } from 'react';
import { htmlTemplatesApi, type ModuleCoverageResult } from '@/api/htmlTemplates';
import { Button } from '@/components/Button';
import { MarkdownPreview } from '@/components/MarkdownEditor';
import { getPresetsForBL } from '@/report-presets';

type Mode = 'ai' | 'recipe';

interface Props {
  campaignId?: string;
  /** ★ 报告周期(project.meta.reportPeriod)——模块覆盖预检的判定口径 */
  reportPeriod?: { startDate?: string; endDate?: string };
  onGenerate: (vals: { mode: Mode; prompt: string; designMd: string; guideId: string }) => void;
  generating?: boolean;
  generateLabel?: string;
  error?: string;
}

export function AiGenerateForm({ campaignId, reportPeriod, onGenerate, generating, generateLabel, error }: Props) {
  const [mode, setMode] = useState<Mode>('ai');
  const [prompt, setPrompt] = useState('');
  const [selectedPresetIdx, setSelectedPresetIdx] = useState(0);
  const [structuralGuideId, setStructuralGuideId] = useState('');

  const [designMd, setDesignMd] = useState('');
  const [designMdLoading, setDesignMdLoading] = useState(false);
  const [designMdSource, setDesignMdSource] = useState('');
  const [guides, setGuides] = useState<{ id: string; name: string; layer: 'visual' | 'structural' }[]>([]);
  const [blCode, setBlCode] = useState('');
  const [designMdExpanded, setDesignMdExpanded] = useState(false);
  // ★ 结构指南下拉动态化:该业务线可选指南(拉不到=空数组隐藏字段);选中即注入,无需字符串匹配
  const [structuralGuides, setStructuralGuides] = useState<{ id: string; name: string; overridesVisual?: boolean; checksCount?: number; assetsCount?: number }[]>([]);

  const [systemPrompt, setSystemPrompt] = useState('');
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [promptFullscreen, setPromptFullscreen] = useState(false);
  const [systemPromptFullscreen, setSystemPromptFullscreen] = useState(false);
  const [guideFullscreen, setGuideFullscreen] = useState(false);

  // ★ 模块覆盖预检（生成前）——campaignId/reportPeriod 变化时拉取
  const [moduleCoverage, setModuleCoverage] = useState<ModuleCoverageResult | null>(null);
  const [coverageLoading, setCoverageLoading] = useState(false);

  const presets = useMemo(() => getPresetsForBL(blCode || undefined), [blCode]);

  useEffect(() => {
    if (presets.length > 0) {
      setPrompt(presets[0].requirement);
      setSelectedPresetIdx(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blCode]);

  // ★ 回显=实际注入:同 resolvePairForCampaign(campaignId, guideId) 口径。
  //   结构指南切换即重查——用户看到哪份,生成时就注入哪份。
  useEffect(() => {
    if (!campaignId) {
      setStructuralGuides([]);
      return;
    }
    htmlTemplatesApi
      .getStructuralGuides(campaignId)
      .then(setStructuralGuides)
      .catch(() => setStructuralGuides([]));
  }, [campaignId]);


  useEffect(() => {
    if (!campaignId) return;
    setDesignMdLoading(true);
    htmlTemplatesApi
      .getDesignGuide(campaignId, structuralGuideId || undefined)
      .then((data) => {
        setDesignMd(data.designMd || '');
        setDesignMdSource(data.businessLineName || '');
        setGuides(data.guides ?? []);
        setBlCode(data.businessLineCode || '');
      })
      .catch(() => {})
      .finally(() => setDesignMdLoading(false));
  }, [campaignId, structuralGuideId]);

  useEffect(() => {
    if (!campaignId) {
      setModuleCoverage(null);
      return;
    }
    setCoverageLoading(true);
    htmlTemplatesApi
      .getModuleCoverage(campaignId, reportPeriod)
      .then(setModuleCoverage)
      .catch(() => setModuleCoverage(null))
      .finally(() => setCoverageLoading(false));
  }, [campaignId, reportPeriod?.startDate, reportPeriod?.endDate]);

  useEffect(() => {
    if (!promptFullscreen && !systemPromptFullscreen && !guideFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPromptFullscreen(false);
        setSystemPromptFullscreen(false);
        setGuideFullscreen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [promptFullscreen, systemPromptFullscreen, guideFullscreen]);

  const handleGenerate = () => {
    onGenerate({
      mode,
      prompt: mode === 'ai' ? prompt : '',
      designMd: mode === 'ai' ? designMd.trim() : '',
      guideId: structuralGuideId,
    });
  };

  const triggerSystemPrompt = () => {
    if (!systemPrompt) {
      htmlTemplatesApi.getSystemPrompt().then(setSystemPrompt);
    }
    setShowSystemPrompt(!showSystemPrompt);
  };

  return (
    <>
      {/* Mode tabs */}
      <div className="mb-4">
        <label className="mb-2 block text-xs font-medium text-foreground-muted">生成方式</label>
        <div className="flex gap-2">
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
            onClick={() => setMode('recipe')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm transition ${
              mode === 'recipe'
                ? 'bg-accent-primary text-foreground-inverse'
                : 'bg-surface-hover text-foreground-secondary'
            }`}
          >
            📋 Recipe 模板
          </button>
        </div>
      </div>

      {/* ★ ④ 工具层(四维架构之「工具」)——生成前后自动执行的代码关卡,不进提示词 */}
      {mode === 'ai' && campaignId && (coverageLoading || moduleCoverage) && (
        <div className="mb-4 rounded-lg border border-border-default">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-foreground-secondary">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-surface-hover text-[10px] font-semibold text-foreground-muted">④</span>
              工具 · 生成前数据检查（自动执行，不用 AI）
            </span>
            {moduleCoverage && (
              <span className="text-[10px] text-foreground-muted">
                {moduleCoverage.modules.filter((m) => m.status === 'ok').length}/{moduleCoverage.modules.length} 模块有数据
              </span>
            )}
          </div>
          {coverageLoading ? (
            <p className="px-3 pb-2 text-center text-[11px] text-foreground-muted">检测中…</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border-default px-3 py-2">
              {moduleCoverage!.modules.map((m) => (
                <div
                  key={m.key}
                  className="flex items-center gap-1.5 text-[11px]"
                  title={m.detail || m.label}
                >
                  <span
                    className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                      m.status === 'ok' ? 'bg-green' : 'bg-red'
                    }`}
                  />
                  <span className={m.status === 'ok' ? 'text-foreground-secondary' : 'font-medium text-red'}>
                    {m.label}
                  </span>
                  {m.status === 'missing' && (
                    <span className="shrink-0 text-[10px] text-red" title={m.detail}>✕</span>
                  )}
                </div>
              ))}
            </div>
          )}
          {moduleCoverage && moduleCoverage.modules.some((m) => m.status === 'missing') && (
            <p className="border-t border-border-default px-3 py-1.5 text-[10px] leading-relaxed text-amber-500">
              ⚠️ 红点模块无数据：生成时将渲染 Data Unavailable 占位（不编造）。可在数据管理导入对应数据后重新检测。
            </p>
          )}
        </div>
      )}

      {/* Mode-specific config */}
      {mode === 'ai' ? (
        <div className="space-y-4">
          {/* ══ 提示词构成:四维架构(提示词/文件/skills/工具)中「注入 LLM」的三层,顺序=实际拼装顺序 ══ */}
          <div>
            <div className="mb-2 flex items-center justify-between px-0.5">
              <span className="text-sm font-bold text-foreground-primary">🧱 提示词</span>
              <span className="text-[10px] text-foreground-muted">四步走：①②③ 是给 AI 的提示词 → ④ 是生成后自动跑的工具检查 → 出报告</span>
            </div>

            {/* ① 系统提示词 — 平台规则,自动注入,只读 */}
            <div className="border-b border-border-default">
              <div className="flex items-center justify-between px-3 py-2 hover:bg-surface-hover">
                <button onClick={triggerSystemPrompt} className="flex min-w-0 items-center gap-1.5 text-xs text-foreground-secondary">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-surface-hover text-[10px] font-semibold text-foreground-muted">①</span>
                  <span className="shrink-0">Skill · 平台规则</span>
                  <span className="shrink-0 rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground-muted" title="提示词:所有业务线通用的生成规则(技术栈/样式规范/响应式/图表/表格),存放在代码库,自动带上,无需配置">提示词 · 所有报告通用 · 自动带上</span>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  {showSystemPrompt && systemPrompt && (
                    <button
                      onClick={() => setSystemPromptFullscreen(true)}
                      className="text-[10px] text-foreground-muted hover:text-foreground-primary"
                      title="全屏查看"
                    >
                      ⛶
                    </button>
                  )}
                  <button onClick={triggerSystemPrompt} className="text-foreground-muted">
                    {showSystemPrompt ? '▾' : '▸'}
                  </button>
                </div>
              </div>
              {showSystemPrompt && (
                <div className="max-h-[400px] overflow-y-auto border-t border-border-default bg-white p-4">
                  {systemPrompt ? (
                    <MarkdownPreview content={systemPrompt} />
                  ) : (
                    <p className="text-center text-[11px] text-foreground-muted">加载中…</p>
                  )}
                </div>
              )}
            </div>

            {/* ② 业务线指南 — 双层(视觉+结构)自动注入,只读;报告场景在此选择 */}
            <div className="border-b border-border-default">
              <button
                onClick={() => setDesignMdExpanded(!designMdExpanded)}
                className="flex w-full items-center justify-between px-3 py-2 hover:bg-surface-hover"
              >
                <span className="flex min-w-0 items-center gap-1.5 text-xs text-foreground-secondary">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-surface-hover text-[10px] font-semibold text-foreground-muted">②</span>
                  <span className="shrink-0">Skill · 品牌样式</span>
                  {guides.length > 0 ? (
                    <span
                      className="max-w-[220px] truncate rounded bg-accent-primary/10 px-1.5 py-0.5 text-[10px] text-accent-primary"
                      title={guides.map((g) => `${g.layer === 'visual' ? '固定样式' : '附加样式'}：${g.name}`).join('\n')}
                    >
                      📎 {guides.map((g) => g.name).join(' + ')}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground-muted">
                      {campaignId ? '本业务线未配置' : '未绑定 Campaign'}
                    </span>
                  )}
                  <span className="shrink-0 rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground-muted" title="Skill:某类报告的成套做法——本业务线每次生成都自动带上;在「指南配置」里维护">自动带上 · 在指南配置维护</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {structuralGuideId !== '' && (
                    <span className="text-[10px] text-foreground-muted">
                      结构: {structuralGuides.find((g) => g.id === structuralGuideId)?.name ?? structuralGuideId}
                    </span>
                  )}
                  <span className="text-foreground-muted">{designMdExpanded ? '▾' : '▸'}</span>
                </span>
              </button>
              {designMdExpanded && (
                <div className="space-y-2 border-t border-border-default p-3">
                  {/* 叠加结构指南 — 按指南直接选(id 精确);视觉层规范恒注入 */}
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-foreground-muted">
                      Skill · 选用整套模板（某类报告的成套做法，含配色、字体、页面结构，可附参考文件；选用后不再叠加上面的品牌样式）
                    </label>
                    {campaignId && structuralGuides.length > 0 ? (
                      <select
                        value={structuralGuideId}
                        onChange={(e) => setStructuralGuideId(e.target.value)}
                        className="w-full rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-foreground-primary outline-none focus:border-accent-primary"
                      >
                        <option value="">不选用（按上面的品牌样式生成）</option>
                        {structuralGuides.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}{g.overridesVisual ? '（成套样式）' : ''}
                            {g.assetsCount ? ` · 附 ${g.assetsCount} 个参考文件` : ''}
                            {g.checksCount ? ` · 生成后 ${g.checksCount} 项工具自动检查` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-[11px] text-foreground-muted">
                        {campaignId
                          ? '当前业务线暂无成套模板——将按默认品牌样式生成。'
                          : '未绑定 Campaign，无业务线指南。'}
                      </p>
                    )}
                  </div>
                  {designMdLoading ? (
                    <p className="text-center text-[11px] text-foreground-muted">指南加载中…</p>
                  ) : designMd.trim() ? (
                    <>
                      <p className="text-[10px] leading-relaxed text-foreground-muted">
                        ★ 生成时双层注入（只读）：
                        {guides.map((g) => (
                          <span key={g.id}>
                            {' '}· {g.layer === 'visual' ? '固定样式' : '附加样式'}：
                            <b className="text-foreground-secondary">{g.name}</b>
                          </span>
                        ))}
                        {designMdSource && <>　|　维护入口：数据管理 → 指南（{designMdSource}）</>}
                      </p>
                      <div className="mb-1 flex justify-end">
                        <button
                          onClick={() => setGuideFullscreen(true)}
                          className="text-[10px] text-foreground-muted hover:text-foreground-primary"
                          title="全屏查看"
                        >
                          ⛶ 全屏
                        </button>
                      </div>
                      <textarea
                        value={designMd}
                        readOnly
                        rows={6}
                        placeholder="业务线指南内容（品牌色、字体、报告结构要求等）…"
                        className="w-full resize-y rounded border border-border-default bg-surface-secondary px-2 py-1.5 font-mono text-[11px] text-foreground-secondary placeholder:text-foreground-muted focus:border-accent-primary focus:outline-none"
                      />
                    </>
                  ) : (
                    <p className="text-[11px] text-foreground-muted">无匹配指南内容。</p>
                  )}
                </div>
              )}
            </div>

            {/* ③ 用户提示词 — 唯一可编辑层;模板=快速填充 */}
            <div className="p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-foreground-secondary">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-accent-primary/10 text-[10px] font-semibold text-accent-primary">③</span>
                  <span className="shrink-0">提示词 · 你的要求</span>
                  <span className="shrink-0 rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground-muted" title="提示词:本次生成想强调什么——留空=AI 自己决定,选模板=快速填充,手写=自定义">留空 = AI 自主决策</span>
                </span>
                <button
                  onClick={() => setPromptFullscreen(true)}
                  className="text-[10px] text-foreground-muted hover:text-foreground-primary"
                  title="全屏编辑"
                >
                  ⛶ 全屏
                </button>
              </div>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="shrink-0 text-[10px] text-foreground-muted">快速填充</span>
                <select
                  value={selectedPresetIdx}
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    setSelectedPresetIdx(idx);
                    setPrompt(presets[idx].requirement);
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-border-default bg-surface-primary px-2.5 py-1.5 text-xs text-foreground-primary outline-none focus:border-accent-primary"
                >
                  {presets.map((p, idx) => (
                    <option key={p.label} value={idx}>
                      {p.label}
                      {idx === 0 ? '（默认）' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={8}
                spellCheck={false}
                placeholder="留空 = AI 完全自主决策（推荐）&#10;&#10;或输入差异化指令，如：&#10;• 突出 ROI 和达人排名&#10;• 用深色主题 / 隐藏 Footer&#10;• 增加 Publisher 截图列"
                className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[13px] leading-relaxed text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500"
              />
              {presets[selectedPresetIdx]?.description && (
                <p className="mt-1 text-[10px] leading-relaxed text-foreground-muted">
                  {presets[selectedPresetIdx].description}
                </p>
              )}
              {!campaignId && (
                <p className="mt-1.5 text-[10px] text-amber-500">
                  ⚠️ 未绑定 Campaign，AI 将生成通用模板（无真实数据）
                </p>
              )}
            </div>
          </div>

          {/* 合成指示 — 三组要求 + 一道检查如何变成最终报告 */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10px] text-foreground-muted">
            <span className="rounded bg-surface-hover px-1.5 py-0.5">① 平台规则</span>+
            <span className="rounded bg-surface-hover px-1.5 py-0.5">② 品牌样式</span>
            <span className="text-foreground-muted">→ 系统要求</span> ｜
            <span className="rounded bg-surface-hover px-1.5 py-0.5">③ 你的要求</span>
            <span className="text-foreground-muted">→ 单独传入</span> ｜
            <span className="rounded bg-surface-hover px-1.5 py-0.5">④ 工具检查</span>
            <span className="text-accent-primary">→ 生成报告</span>
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-surface-hover px-3 py-4 text-center">
          <p className="text-xs text-foreground-secondary">
            📋 Recipe 模板模式
          </p>
          <p className="mt-1 text-[11px] text-foreground-muted">
            用本地结构化模板渲染报告(快速、稳定、可四层编辑)。
          </p>
          {!campaignId && (
            <p className="mt-1.5 text-[10px] text-amber-500">
              ⚠️ 未绑定 Campaign,需填 Campaign ID 才能渲染真实数据
            </p>
          )}
        </div>
      )}

      {/* Generate button */}
      <div className="mt-5">
        <Button
          onClick={handleGenerate}
          loading={generating}
          disabled={mode === 'recipe' ? !campaignId : generating}
          className="w-full"
        >
          {generating ? '生成中…' : (generateLabel ?? '✨ 生成报告')}
        </Button>
        {error && (
          <p className="mt-2 rounded-lg bg-red/10 px-3 py-2 text-xs text-red">{error}</p>
        )}
      </div>

      {/* ── Fullscreen Modal: Prompt Editor ── */}
      {promptFullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-200 px-4">
            <span className="text-sm font-medium text-slate-800">提示词编辑器</span>
            <button
              onClick={() => setPromptFullscreen(false)}
              className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
            >
              ✕ 关闭 (Esc)
            </button>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            spellCheck={false}
            autoFocus
            className="flex-1 resize-none bg-white p-6 text-[14px] leading-relaxed text-slate-800 focus:outline-none"
            placeholder="输入提示词…"
          />
        </div>
      )}

      {/* ── Fullscreen Modal: Guide (双层合并全文,只读) ── */}
      {guideFullscreen && designMd.trim() && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-200 px-4">
            <span className="text-sm font-medium text-slate-800">
              📎 业务线指南（只读）{guides.length > 0 && <span className="ml-1 text-slate-400">— {guides.map((g) => g.name).join(' + ')}</span>}
            </span>
            <button
              onClick={() => setGuideFullscreen(false)}
              className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
            >
              ✕ 关闭 (Esc)
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <pre className="mx-auto max-w-4xl overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-[12px] leading-relaxed font-mono text-slate-600 whitespace-pre-wrap">{designMd}</pre>
          </div>
        </div>
      )}

      {/* ── Fullscreen Modal: System Prompt ── */}
      {systemPromptFullscreen && systemPrompt && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-200 px-4">
            <span className="text-sm font-medium text-slate-800">📋 系统提示词 (SYSTEM_PROMPT)</span>
            <button
              onClick={() => setSystemPromptFullscreen(false)}
              className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
            >
              ✕ 关闭 (Esc)
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <div className="mx-auto max-w-4xl">
              <MarkdownPreview content={systemPrompt} />
              {designMd.trim() && (
                <>
                  <hr className="my-6 border-slate-200" />
                  <div className="mb-3 text-sm font-semibold text-slate-800">
                    📎 业务线设计规范 (design.md) {designMdSource && <span className="ml-1 text-slate-400">— {designMdSource}</span>}
                  </div>
                  <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-[12px] leading-relaxed font-mono text-slate-600 whitespace-pre-wrap">{designMd}</pre>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
